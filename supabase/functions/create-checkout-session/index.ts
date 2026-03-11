/**
 * Edge Function: create-checkout-session
 *
 * Creates a Stripe Checkout session for:
 * 1. New signup (creates org after payment)
 * 2. Plan upgrade/downgrade (existing org)
 *
 * Returns the Stripe Checkout URL for redirect.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.14.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

interface CheckoutRequest {
  plan_version_id: string;
  billing_interval?: "month" | "year";
  success_url?: string;
  cancel_url?: string;
  // For new signups (no existing org)
  email?: string;
  company_name?: string;
  lead_id?: string;
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return corsErrorResponse("Method not allowed", 405, req);
  }

  try {
    const body: CheckoutRequest = await req.json();

    if (!body.plan_version_id) {
      return corsErrorResponse("Missing plan_version_id", 400, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch plan version with pricing
    const { data: planVersion, error: pvError } = await supabase
      .from("plan_versions")
      .select("*, plans(slug, display_name)")
      .eq("id", body.plan_version_id)
      .eq("status", "published")
      .single();

    if (pvError || !planVersion) {
      return corsErrorResponse("Invalid or inactive plan", 400, req);
    }

    const interval = body.billing_interval || "month";
    const priceId =
      interval === "year"
        ? planVersion.stripe_price_id_yearly
        : planVersion.stripe_price_id_monthly;

    if (!priceId) {
      return corsErrorResponse(`No Stripe price configured for ${interval} billing`, 400, req);
    }

    const origin = req.headers.get("origin") || "https://app.liveroleplay.com";
    const successUrl = body.success_url || `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancel_url || `${origin}/checkout/cancel`;

    // Try to authenticate — optional (new signups won't have auth)
    const authResult = await authenticate(req, { body });
    const isExistingOrg = authResult.authenticated && authResult.context?.org_id;

    let stripeCustomerId: string | undefined;
    let orgId: string | undefined;

    if (isExistingOrg) {
      orgId = authResult.context!.org_id!;

      // Find existing Stripe customer
      const { data: existingCustomer } = await supabase
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("org_id", orgId)
        .single();

      stripeCustomerId = existingCustomer?.stripe_customer_id;
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 },
    ];

    // Add metered price if exists
    if (planVersion.stripe_metered_price_id) {
      lineItems.push({ price: planVersion.stripe_metered_price_id });
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan_version_id: body.plan_version_id,
        ...(orgId ? { org_id: orgId } : {}),
        ...(body.lead_id ? { lead_id: body.lead_id } : {}),
      },
      subscription_data: {
        metadata: {
          plan_version_id: body.plan_version_id,
          ...(orgId ? { org_id: orgId } : {}),
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      locale: "pt-BR",
    };

    // For existing customers, use their Stripe ID
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else {
      // For new signups, collect email
      sessionParams.customer_email = body.email || undefined;
    }

    // Trial for new signups (if plan has trial)
    if (!isExistingOrg && planVersion.features?.trial_days) {
      sessionParams.subscription_data!.trial_period_days = planVersion.features.trial_days;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Track in signup_leads if lead_id provided
    if (body.lead_id) {
      await supabase
        .from("signup_leads")
        .update({
          status: "payment_pending",
          stripe_checkout_session_id: session.id,
        })
        .eq("id", body.lead_id);
    }

    return corsJsonResponse(
      {
        checkout_url: session.url,
        session_id: session.id,
      },
      req
    );
  } catch (err) {
    console.error("Error creating checkout session:", err);
    return corsErrorResponse(
      (err as Error).message || "Internal error",
      500,
      req
    );
  }
});
