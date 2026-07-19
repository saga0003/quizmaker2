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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Supabase server environment is incomplete." }, 500);
    }
    if (!keyId || !keySecret) {
      return json({ error: "Razorpay secrets are not configured." }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Please login before purchasing." }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Your login session is invalid or expired." }, 401);
    }

    const user = authData.user;
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const productId = String(body.product_id ?? "");
    const couponCode = String(body.coupon_code ?? "").trim().toUpperCase();

    if (!productId) return json({ error: "Product is required." }, 400);

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id,name,status,audience")
      .eq("id", productId)
      .single();

    if (productError || !product || product.status !== "published") {
      return json({ error: "This product is not available." }, 404);
    }

    const now = new Date().toISOString();
    const { data: version, error: versionError } = await admin
      .from("product_versions")
      .select("id,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,starts_at,ends_at")
      .eq("product_id", product.id)
      .eq("is_current", true)
      .maybeSingle();

    if (versionError || !version) {
      return json({ error: "No active price exists for this product." }, 409);
    }
    if ((version.starts_at && version.starts_at > now) || (version.ends_at && version.ends_at < now)) {
      return json({ error: "This offer is outside its sale period." }, 409);
    }

    let organizationId: string | null = null;
    if (product.audience === "school") {
      const { data: membership } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("member_role", ["school_owner", "school_admin"])
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return json({ error: "Create your school workspace before buying this plan." }, 409);
      }
      organizationId = membership.organization_id;
    }

    let couponId: string | null = null;
    let discountPaise = 0;

    if (couponCode) {
      const { data: coupon } = await admin
        .from("coupons")
        .select("*")
        .eq("code", couponCode)
        .eq("active", true)
        .maybeSingle();

      if (!coupon) return json({ error: "Coupon code is invalid." }, 400);
      if ((coupon.starts_at && coupon.starts_at > now) || (coupon.ends_at && coupon.ends_at < now)) {
        return json({ error: "Coupon is not active." }, 400);
      }
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        return json({ error: "Coupon usage limit has been reached." }, 400);
      }
      if (version.selling_price_paise < coupon.minimum_order_paise) {
        return json({ error: "Order value is below the coupon minimum." }, 400);
      }

      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("coupon_id", coupon.id)
        .eq("status", "paid");

      if ((count ?? 0) >= coupon.per_user_limit) {
        return json({ error: "You have already used this coupon." }, 400);
      }

      discountPaise = coupon.discount_type === "percentage"
        ? Math.floor(version.selling_price_paise * coupon.discount_value / 100)
        : coupon.discount_value;

      if (coupon.max_discount_paise) {
        discountPaise = Math.min(discountPaise, coupon.max_discount_paise);
      }
      discountPaise = Math.min(discountPaise, version.selling_price_paise);
      couponId = coupon.id;
    }

    const amountPaise = version.selling_price_paise - discountPaise;
    if (amountPaise < 100) {
      return json({ error: "Final payable amount must be at least ₹1." }, 400);
    }

    const receipt = `rm${Date.now()}${user.id.replaceAll("-", "").slice(0, 8)}`;
    const { data: internalOrder, error: insertError } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        product_id: product.id,
        product_version_id: version.id,
        coupon_id: couponId,
        subtotal_paise: version.selling_price_paise,
        discount_paise: discountPaise,
        amount_paise: amountPaise,
        currency: "INR",
        status: "created",
        receipt,
      })
      .select("id")
      .single();

    if (insertError || !internalOrder) {
      throw insertError ?? new Error("Could not create internal order.");
    }

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          rankmint_order_id: internalOrder.id,
          product_id: product.id,
        },
      }),
    });

    const razorpayOrder = await razorpayResponse.json();
    if (!razorpayResponse.ok) {
      await admin
        .from("orders")
        .update({
          status: "failed",
          failure_reason: razorpayOrder?.error?.description ?? "Razorpay order creation failed",
        })
        .eq("id", internalOrder.id);

      return json({ error: razorpayOrder?.error?.description ?? "Razorpay order creation failed." }, 502);
    }

    await admin
      .from("orders")
      .update({ status: "payment_pending", razorpay_order_id: razorpayOrder.id })
      .eq("id", internalOrder.id);

    return json({
      key_id: keyId,
      internal_order_id: internalOrder.id,
      razorpay_order_id: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      product_name: product.name,
      discount_paise: discountPaise,
      customer: {
        name: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
      },
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to create order." }, 500);
  }
});
