"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CreditCard, LoaderCircle, ShieldCheck, TicketPercent } from "lucide-react";
import { demoProducts } from "@/data/demoProducts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { discountPercent, rupees, StoreProduct } from "@/types/commerce";
import { useAuth } from "@/context/AuthProvider";

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function isSchoolRole(role?: string | null) {
  return Boolean(role && (role.startsWith("school_") || role.startsWith("institute_") || ["teacher", "reviewer", "invigilator"].includes(role)));
}

export function ProductStore() {
  const [products, setProducts] = useState<StoreProduct[]>(demoProducts);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [buying, setBuying] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "student" | "school">("all");
  const [accepted, setAccepted] = useState(false);
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchProducts() {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("get_store_products");
      if (!error) setProducts((data ?? []).map((product: StoreProduct) => ({ ...product, features: Array.isArray(product.features) ? product.features : [] })));
      if (error) setMessage(`Store connection: ${error.message}`);
      setLoading(false);
    }
    void fetchProducts();
  }, []);

  const visible = useMemo(
    () => products.filter((product) => filter === "all" || product.audience === filter || product.audience === "both"),
    [filter, products],
  );

  async function buy(product: StoreProduct) {
    setMessage("");
    if (!accepted) {
      setMessage("Please accept the Terms, Privacy Policy and Refund Policy before continuing.");
      return;
    }

    const client = supabase;
    if (!client) {
      setMessage("Demo checkout completed. Connect Supabase and Razorpay to process a real payment or voucher.");
      return;
    }
    if (!user) {
      localStorage.setItem("evidara_after_login", "/products/");
      router.push("/login/");
      return;
    }
    if (product.audience === "school" && !isSchoolRole(profile?.role)) {
      setMessage("Register your school workspace before purchasing a school plan.");
      return;
    }

    const destination = product.audience === "school" ? "/school/subscription/" : "/student/purchases/";
    setBuying(product.id);

    try {
      const { data: order, error: orderError } = await client.functions.invoke("create-razorpay-order", {
        body: { product_id: product.id, voucher_code: voucherCode.trim() || null },
      });
      if (orderError) throw orderError;
      if (order?.error) throw new Error(order.error);

      if (order?.free_access) {
        setMessage(order.message ?? "Voucher applied and access granted.");
        router.push(`${destination}?voucher=success`);
        router.refresh();
        return;
      }

      const scriptReady = await loadRazorpay();
      if (!scriptReady) throw new Error("Razorpay Checkout could not load. Check your internet connection or browser blockers.");

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Evidara",
        description: order.product_name,
        order_id: order.razorpay_order_id,
        prefill: { name: order.customer?.name, email: order.customer?.email },
        theme: { color: "#0E5A5A" },
        handler: async (response) => {
          const { data: verified, error: verifyError } = await client.functions.invoke("verify-razorpay-payment", {
            body: { internal_order_id: order.internal_order_id, ...response },
          });
          if (verifyError) {
            setMessage(`Payment was received, but verification needs attention: ${verifyError.message}`);
            return;
          }
          if (!verified?.success) {
            setMessage(verified?.error ?? "Payment verification failed.");
            return;
          }
          router.push(`${destination}?payment=success`);
          router.refresh();
        },
        modal: { ondismiss: () => setMessage("Payment window closed. No access was granted.") },
      });
      checkout.on("payment.failed", () => setMessage("Payment failed. You can try again without creating duplicate access."));
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      setBuying(null);
    }
  }

  return <div>
    <div className="rm-card" style={{ padding: 16, display: "grid", gap: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["all", "student", "school"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "rm-btn-dark" : "rm-btn-secondary"} style={{ textTransform: "capitalize" }}>{item}</button>)}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 290 }}>
          <TicketPercent size={18} color="#0E5A5A" />
          <input className="rm-input" placeholder="Voucher or coupon code" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} />
        </label>
      </div>
      <label style={{ display: "flex", gap: 9, alignItems: "start", fontSize: 13, color: "#44545C" }}>
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} style={{ marginTop: 3 }} />
        <span>I agree to the <Link href="/terms/" style={{ textDecoration: "underline", fontWeight: 700 }}>Terms</Link>, <Link href="/privacy/" style={{ textDecoration: "underline", fontWeight: 700 }}>Privacy Policy</Link> and <Link href="/refund-policy/" style={{ textDecoration: "underline", fontWeight: 700 }}>Refund Policy</Link>.</span>
      </label>
    </div>

    {message && <div role="status" style={{ padding: 14, borderRadius: 12, background: "#FCF1DB", border: "1px solid #F5C66F", marginBottom: 18, fontWeight: 650, color: "#14232B" }}>{message}</div>}

    {loading ? <div style={{ padding: 50, textAlign: "center" }}><LoaderCircle className="spin" /> Loading live products…</div> : <div className="product-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
      {visible.map((product) => {
        const off = discountPercent(product.mrp_paise, product.selling_price_paise);
        return <article key={product.id} className="rm-card" style={{ padding: 22, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {product.is_featured && <span className="rm-badge" style={{ position: "absolute", right: 14, top: 14, background: "#FCF1DB", color: "#14232B" }}>Featured</span>}
          <div className="rm-label">{product.exam_type || product.audience} · {product.product_type.replaceAll("_", " ")}</div>
          <h2 style={{ color: "#14232B", fontSize: 24, margin: "12px 0 7px", paddingRight: product.is_featured ? 70 : 0 }}>{product.name}</h2>
          <p style={{ color: "#44545C", lineHeight: 1.6, minHeight: 50 }}>{product.short_description}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "8px 0 18px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 30, color: "#14232B" }}>{rupees(product.selling_price_paise)}</strong>
            {off > 0 && <><s style={{ color: "#6B7980" }}>{rupees(product.mrp_paise)}</s><span className="rm-badge" style={{ background: "#DCE9E7", color: "#0E5A5A" }}>{off}% OFF</span></>}
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 20, flex: 1 }}>
            {product.features.map((feature) => <div key={feature} style={{ display: "flex", gap: 8, alignItems: "start", fontSize: 14 }}><CheckCircle2 size={18} color="#237A57" style={{ flex: "0 0 auto" }} />{feature}</div>)}
          </div>
          <div style={{ fontSize: 12, color: "#6B7980", marginBottom: 12 }}>{product.access_days ? `${product.access_days} days access` : "Access as configured"}{product.max_attempts ? ` · ${product.max_attempts} attempts` : ""}{product.student_limit ? ` · ${product.student_limit} students` : ""}</div>
          <button onClick={() => void buy(product)} disabled={buying === product.id} className="rm-btn-primary" style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, background: "#0E5A5A" }}>
            {buying === product.id ? <LoaderCircle size={18} className="spin" /> : <CreditCard size={18} />}
            Pay securely or apply voucher
          </button>
        </article>;
      })}
    </div>}

    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 24, color: "#44545C", fontSize: 13 }}>
      <ShieldCheck size={18} color="#0E5A5A" />Access is granted only after server-side Razorpay verification or a controlled 100% voucher fulfilment.
    </div>
    <style jsx>{`@media(max-width:920px){.product-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:620px){.product-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
