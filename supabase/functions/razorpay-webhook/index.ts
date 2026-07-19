import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-razorpay-signature, x-razorpay-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const eventId = req.headers.get("x-razorpay-event-id");

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!webhookSecret || !supabaseUrl || !serviceKey) {
      return json({ error: "Webhook server configuration is incomplete." }, 500);
    }

    const expected = await hmacHex(webhookSecret, rawBody);
    if (!safeEqual(expected, signature)) {
      return json({ error: "Invalid webhook signature." }, 401);
    }

    const payload = JSON.parse(rawBody);
    const eventType = String(payload.event ?? "unknown");
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: eventRow, error: eventError } = await admin
      .from("webhook_events")
      .insert({
        provider: "razorpay",
        provider_event_id: eventId,
        event_type: eventType,
        signature,
        payload,
      })
      .select("id")
      .single();

    if (eventError?.code === "23505") {
      return json({ received: true, duplicate: true });
    }
    if (eventError) throw eventError;

    if (["payment.captured", "order.paid"].includes(eventType)) {
      const payment = payload?.payload?.payment?.entity;
      const razorpayOrderId = payment?.order_id ?? payload?.payload?.order?.entity?.id;
      const paymentId = payment?.id;

      if (razorpayOrderId && paymentId && payment?.status === "captured" && payment?.captured === true) {
        const { data: order } = await admin
          .from("orders")
          .select("id,amount_paise,currency")
          .eq("razorpay_order_id", razorpayOrderId)
          .maybeSingle();

        if (order) {
          const amountMatches = Number(payment.amount) === Number(order.amount_paise);
          const currencyMatches = String(payment.currency).toUpperCase() === String(order.currency).toUpperCase();

          if (!amountMatches || !currencyMatches) {
            throw new Error("Webhook payment amount or currency does not match the internal order.");
          }

          const { error: fulfillError } = await admin.rpc("fulfill_paid_order", {
            p_order_id: order.id,
            p_payment_id: paymentId,
            p_signature: signature,
            p_payload: payload,
          });
          if (fulfillError) throw fulfillError;
        }
      }
    }

    await admin
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", eventRow.id);

    return json({ received: true });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, 500);
  }
});
