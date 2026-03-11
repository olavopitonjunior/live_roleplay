/**
 * Edge Function: manage-subscription
 *
 * Manage existing Stripe subscriptions:
 * - cancel (at period end)
 * - cancel_immediately
 * - resume (reactivate canceled)
 * - change_plan (switch to different plan)
 *
 * Requires JWT auth with owner or admin role.
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

type Action = "cancel" | "cancel_immediately" | "resume" | "change_plan";

interface ManageRequest {
  action: Action;
  // For change_plan
  new_plan_version_id?: string;
  billing_interval?: "month" | "year";
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return corsErrorResponse("Method not allowed", 405, req);
  }

  try {
    const body: ManageRequest = await req.json();

    // Authenticate — requires JWT with owner or admin role
    const authResult = await authenticate(req, { body, requiredRole: "admin" });
    if (!authResult.authenticated) {
      return corsErrorResponse(authResult.error || "Unauthorized", authResult.status || 401, req);
    }
    const auth = authResult.context!;

    if (!auth.org_id) {
      return corsErrorResponse("No organization found", 400, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find active subscription for this org
    const { data: sub, error: subError } = await supabase
      .from("stripe_subscriptions")
      .select("stripe_subscription_id, status")
      .eq("org_id", auth.org_id)
      .in("status", ["active", "trialing", "past_due"])
      .single();

    if (subError || !sub) {
      return corsErrorResponse("No active subscription found", 404, req);
    }

    const subId = sub.stripe_subscription_id;

    switch (body.action) {
      case "cancel": {
        await stripe.subscriptions.update(subId, {
          cancel_at_period_end: true,
        });

        await supabase
          .from("stripe_subscriptions")
          .update({ cancel_at_period_end: true })
          .eq("stripe_subscription_id", subId);

        return corsJsonResponse({ success: true, message: "Subscription will cancel at period end" }, req);
      }

      case "cancel_immediately": {
        await stripe.subscriptions.cancel(subId);

        await supabase
          .from("stripe_subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId);

        await supabase
          .from("organizations")
          .update({ status: "churned" })
          .eq("id", auth.org_id);

        return corsJsonResponse({ success: true, message: "Subscription canceled immediately" }, req);
      }

      case "resume": {
        // Can only resume if cancel_at_period_end is true
        await stripe.subscriptions.update(subId, {
          cancel_at_period_end: false,
        });

        await supabase
          .from("stripe_subscriptions")
          .update({ cancel_at_period_end: false })
          .eq("stripe_subscription_id", subId);

        return corsJsonResponse({ success: true, message: "Subscription resumed" }, req);
      }

      case "change_plan": {
        if (!body.new_plan_version_id) {
          return corsErrorResponse("Missing new_plan_version_id", 400, req);
        }

        // Fetch new plan version
        const { data: newPlan, error: planError } = await supabase
          .from("plan_versions")
          .select("id, stripe_price_id_monthly, stripe_price_id_yearly, stripe_metered_price_id")
          .eq("id", body.new_plan_version_id)
          .eq("status", "published")
          .single();

        if (planError || !newPlan) {
          return corsErrorResponse("Invalid plan version", 400, req);
        }

        const interval = body.billing_interval || "month";
        const newPriceId =
          interval === "year"
            ? newPlan.stripe_price_id_yearly
            : newPlan.stripe_price_id_monthly;

        if (!newPriceId) {
          return corsErrorResponse("No price configured for this billing interval", 400, req);
        }

        // Get current subscription items
        const currentSub = await stripe.subscriptions.retrieve(subId);
        const currentItem = currentSub.items.data[0];

        // Update subscription with new price (prorate by default)
        await stripe.subscriptions.update(subId, {
          items: [{ id: currentItem.id, price: newPriceId }],
          proration_behavior: "create_prorations",
          metadata: { plan_version_id: body.new_plan_version_id },
        });

        // Update local record
        await supabase
          .from("stripe_subscriptions")
          .update({ plan_version_id: body.new_plan_version_id })
          .eq("stripe_subscription_id", subId);

        return corsJsonResponse({ success: true, message: "Plan changed successfully" }, req);
      }

      default:
        return corsErrorResponse(`Invalid action: ${body.action}`, 400, req);
    }
  } catch (err) {
    console.error("manage-subscription error:", err);
    return corsErrorResponse((err as Error).message || "Internal error", 500, req);
  }
});
