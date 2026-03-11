/**
 * Edge Function: stripe-webhook
 *
 * Handles ALL Stripe webhook events. Idempotent — duplicate events are ignored.
 * Signature-verified using Stripe webhook secret.
 *
 * Events handled:
 * - checkout.session.completed → finalize org creation
 * - customer.subscription.created/updated/deleted → sync subscription status
 * - customer.subscription.trial_will_end → send warning notification
 * - invoice.paid/payment_failed/finalized → sync invoices
 * - payment_method.attached/detached → sync payment methods
 * - customer.updated → sync customer metadata
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.14.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req: Request) => {
  // Stripe webhooks are POST-only, no CORS needed
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const supabase = getSupabase();

  // Idempotency: check if we already processed this event
  const { data: existing } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Store the event
  await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    payload: event.data,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(supabase, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(supabase, event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalized":
        await handleInvoice(supabase, event.data.object as Stripe.Invoice);
        break;

      case "payment_method.attached":
      case "payment_method.detached":
        await handlePaymentMethod(supabase, event.data.object as Stripe.PaymentMethod, event.type);
        break;

      case "customer.updated":
        await handleCustomerUpdated(supabase, event.data.object as Stripe.Customer);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await supabase
      .from("stripe_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    await supabase
      .from("stripe_webhook_events")
      .update({ processing_error: (err as Error).message })
      .eq("stripe_event_id", event.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof getSupabase>,
  session: Stripe.Checkout.Session
) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const orgId = session.metadata?.org_id;

  if (!orgId) {
    console.error("checkout.session.completed: missing org_id in metadata");
    return;
  }

  // Upsert stripe_customer
  await supabase.from("stripe_customers").upsert(
    {
      org_id: orgId,
      stripe_customer_id: customerId,
      email: session.customer_details?.email || null,
      name: session.customer_details?.name || null,
    },
    { onConflict: "org_id" }
  );

  // Update org status
  await supabase
    .from("organizations")
    .update({ status: "active" })
    .eq("id", orgId)
    .in("status", ["trialing", "grace_period"]);

  // Update signup lead
  if (session.metadata?.lead_id) {
    await supabase
      .from("signup_leads")
      .update({
        status: "payment_completed",
        org_id: orgId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", session.metadata.lead_id);
  }

  // Subscription will be synced via customer.subscription.created event
  console.log(`Checkout completed for org ${orgId}, customer ${customerId}`);
}

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof getSupabase>,
  sub: Stripe.Subscription
) {
  const customerId = sub.customer as string;

  // Find org by stripe customer
  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!customer) {
    console.error(`No org found for Stripe customer ${customerId}`);
    return;
  }

  const orgId = customer.org_id;

  // Find plan_version by Stripe price ID
  const priceId = sub.items.data[0]?.price.id;
  const { data: planVersion } = await supabase
    .from("plan_versions")
    .select("id")
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .eq("status", "published")
    .single();

  // Find metered item (if any)
  const meteredItem = sub.items.data.find(
    (item) => item.price.recurring?.usage_type === "metered"
  );

  await supabase.from("stripe_subscriptions").upsert(
    {
      org_id: orgId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      plan_version_id: planVersion?.id || null,
      status: sub.status,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      stripe_metered_item_id: meteredItem?.id || null,
      stripe_data: { items: sub.items.data.map((i) => ({ id: i.id, price_id: i.price.id })) },
    },
    { onConflict: "stripe_subscription_id" }
  );

  // Sync org status
  const orgStatus = mapSubStatusToOrgStatus(sub.status);
  if (orgStatus) {
    await supabase
      .from("organizations")
      .update({ status: orgStatus })
      .eq("id", orgId);
  }

  // Update plan_limits from plan_version features
  if (planVersion?.id) {
    const { data: pv } = await supabase
      .from("plan_versions")
      .select("features, included_sessions, included_tokens, included_livekit_minutes")
      .eq("id", planVersion.id)
      .single();

    if (pv) {
      await supabase
        .from("organizations")
        .update({
          plan_limits: {
            ...pv.features,
            included_sessions: pv.included_sessions,
            included_tokens: pv.included_tokens,
            included_livekit_minutes: pv.included_livekit_minutes,
          },
        })
        .eq("id", orgId);
    }
  }

  console.log(`Subscription ${sub.id} synced for org ${orgId}: ${sub.status}`);
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof getSupabase>,
  sub: Stripe.Subscription
) {
  await supabase
    .from("stripe_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  // Find org and update status
  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("org_id")
    .eq("stripe_customer_id", sub.customer as string)
    .single();

  if (customer) {
    await supabase
      .from("organizations")
      .update({ status: "churned" })
      .eq("id", customer.org_id);
  }

  console.log(`Subscription ${sub.id} deleted/canceled`);
}

async function handleTrialWillEnd(
  supabase: ReturnType<typeof getSupabase>,
  sub: Stripe.Subscription
) {
  // Find org owner to notify
  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("org_id")
    .eq("stripe_customer_id", sub.customer as string)
    .single();

  if (customer) {
    // Insert notification for org owner
    const { data: owner } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("org_id", customer.org_id)
      .eq("role", "owner")
      .eq("is_active", true)
      .single();

    if (owner) {
      await supabase.from("notification_log").insert({
        user_profile_id: owner.id,
        org_id: customer.org_id,
        notification_type: "trial_ending",
        title: "Seu periodo de teste esta acabando",
        body: "Seu trial termina em 3 dias. Adicione um metodo de pagamento para continuar usando a plataforma.",
        data: { subscription_id: sub.id, trial_end: sub.trial_end },
      });
    }
  }

  console.log(`Trial will end for subscription ${sub.id}`);
}

async function handleInvoice(
  supabase: ReturnType<typeof getSupabase>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!customer) return;

  await supabase.from("stripe_invoices").upsert(
    {
      org_id: customer.org_id,
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: (invoice.subscription as string) || null,
      status: invoice.status || "draft",
      amount_due_cents: invoice.amount_due,
      amount_paid_cents: invoice.amount_paid,
      currency: invoice.currency,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      invoice_pdf_url: invoice.invoice_pdf || null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      stripe_data: {
        number: invoice.number,
        lines_count: invoice.lines?.data?.length || 0,
      },
    },
    { onConflict: "stripe_invoice_id" }
  );

  // If payment failed, update org status
  if (invoice.status === "open" && invoice.attempt_count && invoice.attempt_count > 1) {
    await supabase
      .from("organizations")
      .update({ status: "grace_period", grace_period_ends_at: new Date(Date.now() + 7 * 86400000).toISOString() })
      .eq("id", customer.org_id)
      .eq("status", "active");
  }

  console.log(`Invoice ${invoice.id} synced: ${invoice.status}`);
}

async function handlePaymentMethod(
  supabase: ReturnType<typeof getSupabase>,
  pm: Stripe.PaymentMethod,
  eventType: string
) {
  if (eventType === "payment_method.detached") {
    await supabase
      .from("stripe_payment_methods")
      .delete()
      .eq("stripe_payment_method_id", pm.id);
    return;
  }

  // payment_method.attached
  const customerId = pm.customer as string;
  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!customer) return;

  await supabase.from("stripe_payment_methods").upsert(
    {
      org_id: customer.org_id,
      stripe_payment_method_id: pm.id,
      type: pm.type,
      card_brand: pm.card?.brand || null,
      card_last4: pm.card?.last4 || null,
      card_exp_month: pm.card?.exp_month || null,
      card_exp_year: pm.card?.exp_year || null,
      billing_details: pm.billing_details || {},
    },
    { onConflict: "stripe_payment_method_id" }
  );
}

async function handleCustomerUpdated(
  supabase: ReturnType<typeof getSupabase>,
  customer: Stripe.Customer
) {
  await supabase
    .from("stripe_customers")
    .update({
      email: customer.email || null,
      name: customer.name || null,
      metadata: customer.metadata || {},
    })
    .eq("stripe_customer_id", customer.id);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapSubStatusToOrgStatus(subStatus: string): string | null {
  switch (subStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "grace_period";
    case "canceled":
    case "unpaid":
      return "suspended";
    default:
      return null;
  }
}
