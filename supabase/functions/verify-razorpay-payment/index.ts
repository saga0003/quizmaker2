import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey || !keyId || !keySecret) {
      return json({ error: "Server payment configuration is incomplete." }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Login required." }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Login required." }, 401);

    const user = authData.user;
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const internalOrderId = String(body.internal_order_id ?? "");
    const paymentId = String(body.razorpay_payment_id ?? "");
    const razorpayOrderId = String(body.razorpay_order_id ?? "");
    const signature = String(body.razorpay_signature ?? "");

    if (!internalOrderId || !paymentId || !razorpayOrderId || !signature) {
      return json({ error: "Incomplete payment response." }, 400);
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,user_id,razorpay_order_id,status,amount_paise,currency")
      .eq("id", internalOrderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) return json({ error: "Order not found for this account." }, 404);
    if (order.razorpay_order_id !== razorpayOrderId) {
      return json({ error: "Order identifier mismatch." }, 400);
    }

    const expectedSignature = await hmacHex(keySecret, `${order.razorpay_order_id}|${paymentId}`);
    if (!safeEqual(expectedSignature, signature)) {
      return json({ error: "Payment signature verification failed." }, 400);
    }

    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
    });
    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return json({ error: payment?.error?.description ?? "Unable to verify payment with Razorpay." }, 502);
    }

    if (payment.order_id !== order.razorpay_order_id) {
      return json({ error: "Razorpay payment belongs to a different order." }, 400);
    }
    if (Number(payment.amount) !== Number(order.amount_paise)) {
      return json({ error: "Paid amount does not match the expected order amount." }, 400);
    }
    if (String(payment.currency).toUpperCase() !== String(order.currency).toUpperCase()) {
      return json({ error: "Payment currency does not match the order currency." }, 400);
    }
    if (payment.status !== "captured" || payment.captured !== true) {
      return json({ error: "Payment is authentic but has not been captured yet.", pending: true }, 409);
    }

    const { data: entitlementId, error: fulfillError } = await admin.rpc("fulfill_paid_order", {
      p_order_id: order.id,
      p_payment_id: paymentId,
      p_signature: signature,
      p_payload: payment,
    });

    if (fulfillError) throw fulfillError;
    return json({ success: true, entitlement_id: entitlementId });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Payment verification failed." }, 500);
  }
});
