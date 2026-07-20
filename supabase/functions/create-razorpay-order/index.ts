import { createClient } from "npm:@supabase/supabase-js@2";

function allowedOrigins() {
  return (Deno.env.get("APP_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = allowedOrigins();
  const permitted = configured.length === 0 || !origin || configured.includes(origin);
  return {
    "Access-Control-Allow-Origin": permitted ? (origin || "*") : configured[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function originAllowed(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = allowedOrigins();
  return configured.length === 0 || !origin || configured.includes(origin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!originAllowed(req)) return json(req, { error: "This application origin is not allowed." }, 403);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(req, { error: "Supabase server environment is incomplete." }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { error: "Please sign in before purchasing." }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json(req, { error: "Your sign-in session is invalid or expired." }, 401);
    }

    const user = authData.user;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json();
    const productId = String(body.product_id ?? "");
    const voucherCode = String(body.voucher_code ?? body.coupon_code ?? "").trim().toUpperCase();

    if (!productId) return json(req, { error: "Product is required." }, 400);

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id,name,status,audience")
      .eq("id", productId)
      .single();

    if (productError || !product || product.status !== "published") {
      return json(req, { error: "This product is not available." }, 404);
    }

    const now = new Date().toISOString();
    const { data: version, error: versionError } = await admin
      .from("product_versions")
      .select("id,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,starts_at,ends_at")
      .eq("product_id", product.id)
      .eq("is_current", true)
      .maybeSingle();

    if (versionError || !version) {
      return json(req, { error: "No active price exists for this product." }, 409);
    }
    if ((version.starts_at && version.starts_at > now) || (version.ends_at && version.ends_at < now)) {
      return json(req, { error: "This offer is outside its sale period." }, 409);
    }

    let organizationId: string | null = null;
    if (product.audience === "school") {
      const { data: membership } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("member_role", ["institute_owner", "institute_admin", "school_owner", "school_admin"])
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return json(req, { error: "Create your school workspace before buying this plan." }, 409);
      }
      organizationId = membership.organization_id;
    }

    let voucherId: string | null = null;
    let legacyCouponId: string | null = null;
    let discountPaise = 0;
    let discountPercent: number | null = null;
    let voucherPurpose: string | null = null;
    let offlineReference: string | null = null;

    if (voucherCode) {
      const { data: voucher, error: voucherError } = await admin
        .from("voucher_codes")
        .select("id,code,discount_percent,purpose,product_id,allowed_email,organization_id,usage_limit,per_user_limit,used_count,starts_at,ends_at,active,offline_payment_reference")
        .eq("code", voucherCode)
        .maybeSingle();

      if (voucherError && voucherError.code !== "42P01") throw voucherError;

      if (voucher) {
        if (!voucher.active) return json(req, { error: "Voucher is inactive." }, 400);
        if ((voucher.starts_at && voucher.starts_at > now) || (voucher.ends_at && voucher.ends_at < now)) {
          return json(req, { error: "Voucher is outside its active period." }, 400);
        }
        if (voucher.product_id && voucher.product_id !== product.id) {
          return json(req, { error: "Voucher does not apply to this product." }, 400);
        }
        if (voucher.organization_id && voucher.organization_id !== organizationId) {
          return json(req, { error: "Voucher is assigned to a different school." }, 400);
        }
        if (voucher.allowed_email && voucher.allowed_email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
          return json(req, { error: "Voucher is assigned to a different account." }, 400);
        }

        const reservationCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const usageQuery = admin
          .from("orders")
          .select("id,status,created_at,user_id")
          .eq("voucher_id", voucher.id)
          .in("status", ["created", "payment_pending", "paid"]);
        const { data: voucherOrders, error: voucherOrdersError } = await usageQuery;
        if (voucherOrdersError) throw voucherOrdersError;

        const reserved = (voucherOrders ?? []).filter((order) =>
          order.status === "paid" || new Date(order.created_at).toISOString() >= reservationCutoff
        );
        if (voucher.usage_limit && reserved.length >= voucher.usage_limit) {
          return json(req, { error: "Voucher usage limit has been reached." }, 400);
        }
        if (reserved.filter((order) => order.user_id === user.id).length >= voucher.per_user_limit) {
          return json(req, { error: "This account has already used or reserved the voucher." }, 400);
        }

        discountPercent = Number(voucher.discount_percent);
        discountPaise = Math.min(
          version.selling_price_paise,
          Math.floor(version.selling_price_paise * discountPercent / 100),
        );
        voucherId = voucher.id;
        voucherPurpose = voucher.purpose;
        offlineReference = voucher.purpose === "offline_payment" ? voucher.offline_payment_reference : null;
      } else {
        const { data: coupon } = await admin
          .from("coupons")
          .select("*")
          .eq("code", voucherCode)
          .eq("active", true)
          .maybeSingle();

        if (!coupon) return json(req, { error: "Voucher or coupon code is invalid." }, 400);
        if ((coupon.starts_at && coupon.starts_at > now) || (coupon.ends_at && coupon.ends_at < now)) {
          return json(req, { error: "Coupon is not active." }, 400);
        }
        if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
          return json(req, { error: "Coupon usage limit has been reached." }, 400);
        }
        if (version.selling_price_paise < coupon.minimum_order_paise) {
          return json(req, { error: "Order value is below the coupon minimum." }, 400);
        }

        const { count } = await admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("coupon_id", coupon.id)
          .eq("status", "paid");

        if ((count ?? 0) >= coupon.per_user_limit) {
          return json(req, { error: "You have already used this coupon." }, 400);
        }

        discountPaise = coupon.discount_type === "percentage"
          ? Math.floor(version.selling_price_paise * coupon.discount_value / 100)
          : coupon.discount_value;
        if (coupon.max_discount_paise) discountPaise = Math.min(discountPaise, coupon.max_discount_paise);
        discountPaise = Math.min(discountPaise, version.selling_price_paise);
        legacyCouponId = coupon.id;
      }
    }

    const amountPaise = version.selling_price_paise - discountPaise;
    const isZeroValueVoucher = amountPaise === 0 && Boolean(voucherId && discountPercent === 100);
    if (amountPaise < 100 && !isZeroValueVoucher) {
      return json(req, { error: "Final payable amount must be at least ₹1. Use a Super Admin 100% voucher for complimentary or offline-paid access." }, 400);
    }
    if (!isZeroValueVoucher && (!keyId || !keySecret)) {
      return json(req, { error: "Razorpay secrets are not configured." }, 500);
    }

    const receipt = `ev${Date.now()}${user.id.replaceAll("-", "").slice(0, 8)}`;
    const { data: internalOrder, error: insertError } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        product_id: product.id,
        product_version_id: version.id,
        coupon_id: legacyCouponId,
        voucher_id: voucherId,
        subtotal_paise: version.selling_price_paise,
        discount_paise: discountPaise,
        amount_paise: amountPaise,
        currency: "INR",
        status: "created",
        receipt,
        payment_source: isZeroValueVoucher
          ? (voucherPurpose === "offline_payment" ? "offline_voucher" : "voucher")
          : "razorpay",
        offline_reference: offlineReference,
        commerce_metadata: {
          requested_code: voucherCode || null,
          voucher_purpose: voucherPurpose,
        },
      })
      .select("id,payment_source")
      .single();

    if (insertError || !internalOrder) {
      return json(req, { error: insertError?.message ?? "Could not create internal order." }, 409);
    }

    if (isZeroValueVoucher) {
      const { data: entitlementId, error: fulfillmentError } = await admin.rpc("fulfill_voucher_order", {
        p_order_id: internalOrder.id,
      });
      if (fulfillmentError) {
        await admin.from("orders").update({ status: "failed", failure_reason: fulfillmentError.message }).eq("id", internalOrder.id);
        throw fulfillmentError;
      }

      return json(req, {
        success: true,
        free_access: true,
        internal_order_id: internalOrder.id,
        entitlement_id: entitlementId,
        amount: 0,
        currency: "INR",
        product_name: product.name,
        discount_paise: discountPaise,
        discount_percent: discountPercent,
        payment_source: internalOrder.payment_source,
        message: voucherPurpose === "offline_payment"
          ? "Offline payment recorded and access granted."
          : "Voucher applied and access granted.",
      });
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
          evidara_order_id: internalOrder.id,
          product_id: product.id,
          voucher_code: voucherCode || undefined,
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

      return json(req, { error: razorpayOrder?.error?.description ?? "Razorpay order creation failed." }, 502);
    }

    await admin
      .from("orders")
      .update({ status: "payment_pending", razorpay_order_id: razorpayOrder.id })
      .eq("id", internalOrder.id);

    return json(req, {
      key_id: keyId,
      internal_order_id: internalOrder.id,
      razorpay_order_id: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      product_name: product.name,
      discount_paise: discountPaise,
      discount_percent: discountPercent,
      voucher_applied: Boolean(voucherId || legacyCouponId),
      customer: {
        name: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
      },
    });
  } catch (error) {
    console.error(error);
    return json(req, { error: error instanceof Error ? error.message : "Unable to create order." }, 500);
  }
});
