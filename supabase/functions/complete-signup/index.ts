/**
 * Edge Function: complete-signup
 *
 * Idempotent org creation after:
 * 1. Stripe Checkout success (checkout.session.completed webhook also handles this)
 * 2. Free trial signup (no payment required)
 *
 * Flow:
 * - Create org (if not exists)
 * - Create user_profile (owner)
 * - Create stripe_customer (for future billing)
 * - Create onboarding_status
 * - Update signup_lead status
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.14.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

interface SignupRequest {
  // From Stripe Checkout success
  checkout_session_id?: string;
  // For free trial (no Stripe)
  company_name?: string;
  slug?: string;
  industry?: string;
  plan_slug?: string; // e.g. 'starter'
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return corsErrorResponse("Method not allowed", 405, req);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: SignupRequest = await req.json();

    // Get the authenticated user (must be signed up via Supabase Auth)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return corsErrorResponse("Authentication required", 401, req);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return corsErrorResponse("Invalid auth token", 401, req);
    }

    // Idempotency: check if user already has a profile
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id, org_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single();

    if (existingProfile) {
      // Already completed — return existing org
      const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, name, status")
        .eq("id", existingProfile.org_id)
        .single();

      return corsJsonResponse({ org, profile_id: existingProfile.id, already_exists: true }, req);
    }

    let companyName = body.company_name || user.user_metadata?.company_name || user.email?.split("@")[0] || "My Company";
    let slug = body.slug || generateSlug(companyName);
    let stripeCustomerId: string | null = null;

    // If checkout_session_id provided, fetch details from Stripe
    if (body.checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(body.checkout_session_id);
      stripeCustomerId = session.customer as string;

      if (session.customer_details?.name) {
        companyName = session.customer_details.name;
        slug = generateSlug(companyName);
      }
    }

    // Ensure slug is unique
    let finalSlug = slug;
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", finalSlug)
        .single();

      if (!existing) break;
      attempts++;
      finalSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Determine org status
    const isTrial = !body.checkout_session_id;
    const trialEndsAt = isTrial
      ? new Date(Date.now() + 14 * 86400000).toISOString()
      : null;

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: companyName,
        slug: finalSlug,
        status: isTrial ? "trialing" : "active",
        industry: body.industry || null,
        trial_ends_at: trialEndsAt,
        settings: {},
        plan_limits: {},
      })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating org:", orgError);
      return corsErrorResponse("Failed to create organization", 500, req);
    }

    // Create user_profile (owner)
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        org_id: org.id,
        auth_user_id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Owner",
        role: "owner",
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating profile:", profileError);
      return corsErrorResponse("Failed to create user profile", 500, req);
    }

    // Set owner_id on org
    await supabase
      .from("organizations")
      .update({ owner_id: profile.id })
      .eq("id", org.id);

    // Create Stripe customer (if not already from checkout)
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email!,
        name: companyName,
        metadata: { org_id: org.id, profile_id: profile.id },
      });
      stripeCustomerId = stripeCustomer.id;
    }

    // Store Stripe customer link
    await supabase.from("stripe_customers").insert({
      org_id: org.id,
      stripe_customer_id: stripeCustomerId,
      email: user.email!,
      name: companyName,
    });

    // Create trial subscription if no checkout
    if (isTrial) {
      // Find the default trial plan
      const { data: trialPlan } = await supabase
        .from("plan_versions")
        .select("id, stripe_price_id_monthly")
        .eq("status", "published")
        .order("base_fee_cents", { ascending: true })
        .limit(1)
        .single();

      if (trialPlan?.stripe_price_id_monthly) {
        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{ price: trialPlan.stripe_price_id_monthly }],
          trial_period_days: 14,
          payment_behavior: "default_incomplete",
          metadata: { org_id: org.id, plan_version_id: trialPlan.id },
        });

        await supabase.from("stripe_subscriptions").insert({
          org_id: org.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: stripeCustomerId,
          plan_version_id: trialPlan.id,
          status: "trialing",
          trial_start: new Date().toISOString(),
          trial_end: trialEndsAt,
        });
      }
    }

    // Create onboarding status
    await supabase.from("onboarding_status").insert({
      org_id: org.id,
    });

    // Update signup lead if exists
    if (user.email) {
      await supabase
        .from("signup_leads")
        .update({
          status: "org_created",
          org_id: org.id,
          converted_at: new Date().toISOString(),
        })
        .eq("email", user.email)
        .in("status", ["signup_started", "payment_completed", "payment_pending"]);
    }

    return corsJsonResponse(
      {
        org: { id: org.id, slug: org.slug, name: org.name, status: org.status },
        profile_id: profile.id,
        already_exists: false,
      },
      req
    );
  } catch (err) {
    console.error("complete-signup error:", err);
    return corsErrorResponse((err as Error).message || "Internal error", 500, req);
  }
});
