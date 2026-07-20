"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Edit3, LoaderCircle, RefreshCw, ShieldCheck, TicketPercent } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { rupees } from "@/types/commerce";

type ProductOption = { id: string; name: string };
type Voucher = {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  purpose: "promotion" | "offline_payment" | "scholarship" | "manual_access";
  product_id: string | null;
  allowed_email: string | null;
  organization_id: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  offline_payment_reference: string | null;
  offline_amount_paise: number | null;
  internal_note: string | null;
  created_at: string;
};
type Redemption = {
  id: string;
  voucher_id: string;
  order_id: string;
  user_id: string;
  organization_id: string | null;
  discount_paise: number;
  payment_source: string;
  offline_reference: string | null;
  created_at: string;
};

type FormState = {
  id: string;
  code: string;
  description: string;
  discount_percent: string;
  purpose: Voucher["purpose"];
  product_id: string;
  allowed_email: string;
  organization_id: string;
  usage_limit: string;
  per_user_limit: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  offline_payment_reference: string;
  offline_amount_rupees: string;
  internal_note: string;
};

const emptyForm: FormState = {
  id: "",
  code: "",
  description: "",
  discount_percent: "10",
  purpose: "promotion",
  product_id: "",
  allowed_email: "",
  organization_id: "",
  usage_limit: "1",
  per_user_limit: "1",
  starts_at: "",
  ends_at: "",
  active: true,
  offline_payment_reference: "",
  offline_amount_rupees: "",
  internal_note: "",
};

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `EVI-${Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function AdminVoucherManager() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [organizationNames, setOrganizationNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const voucherById = useMemo(
    () => Object.fromEntries(vouchers.map((voucher) => [voucher.id, voucher])),
    [vouchers],
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const [voucherResult, redemptionResult, productResult] = await Promise.all([
      supabase.from("voucher_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("voucher_redemptions").select("id,voucher_id,order_id,user_id,organization_id,discount_paise,payment_source,offline_reference,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("products").select("id,name").order("name"),
    ]);

    const error = voucherResult.error ?? redemptionResult.error ?? productResult.error;
    if (error) {
      setMessage(error.message.includes("voucher_codes")
        ? "Apply Supabase migration 24 before using voucher controls."
        : error.message);
      setBusy(false);
      return;
    }

    const nextVouchers = (voucherResult.data ?? []) as Voucher[];
    const nextRedemptions = (redemptionResult.data ?? []) as Redemption[];
    setVouchers(nextVouchers);
    setRedemptions(nextRedemptions);
    setProducts((productResult.data ?? []) as ProductOption[]);

    const userIds = [...new Set(nextRedemptions.map((item) => item.user_id))];
    const organizationIds = [...new Set(nextRedemptions.map((item) => item.organization_id).filter(Boolean))] as string[];

    const [profilesResult, organizationsResult] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
      organizationIds.length ? supabase.from("organizations").select("id,name").in("id", organizationIds) : Promise.resolve({ data: [], error: null }),
    ]);

    setProfileNames(Object.fromEntries((profilesResult.data ?? []).map((item) => [item.id, item.full_name || item.id])));
    setOrganizationNames(Object.fromEntries((organizationsResult.data ?? []).map((item) => [item.id, item.name])));
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(voucher: Voucher) {
    setForm({
      id: voucher.id,
      code: voucher.code,
      description: voucher.description ?? "",
      discount_percent: String(voucher.discount_percent),
      purpose: voucher.purpose,
      product_id: voucher.product_id ?? "",
      allowed_email: voucher.allowed_email ?? "",
      organization_id: voucher.organization_id ?? "",
      usage_limit: voucher.usage_limit ? String(voucher.usage_limit) : "",
      per_user_limit: String(voucher.per_user_limit),
      starts_at: toLocalInput(voucher.starts_at),
      ends_at: toLocalInput(voucher.ends_at),
      active: voucher.active,
      offline_payment_reference: voucher.offline_payment_reference ?? "",
      offline_amount_rupees: voucher.offline_amount_paise ? String(voucher.offline_amount_paise / 100) : "",
      internal_note: voucher.internal_note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!supabase) {
      setMessage("Connect Supabase before creating production vouchers.");
      return;
    }

    const percentage = Number(form.discount_percent);
    if (percentage === 100 && !form.allowed_email.trim() && !form.organization_id.trim()) {
      setMessage("For security, a 100% voucher must be assigned to an email address or school ID.");
      return;
    }
    if (form.purpose === "offline_payment" && (!form.offline_payment_reference.trim() || Number(form.offline_amount_rupees) <= 0)) {
      setMessage("Offline-payment vouchers require the received amount and a transaction, receipt or invoice reference.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("admin_upsert_voucher", {
      p_voucher_id: form.id || null,
      p_code: form.code.trim().toUpperCase(),
      p_description: form.description || null,
      p_discount_percent: percentage,
      p_purpose: form.purpose,
      p_product_id: form.product_id || null,
      p_allowed_email: form.allowed_email || null,
      p_organization_id: form.organization_id || null,
      p_usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      p_per_user_limit: Number(form.per_user_limit || 1),
      p_starts_at: toIso(form.starts_at),
      p_ends_at: toIso(form.ends_at),
      p_active: form.active,
      p_offline_payment_reference: form.offline_payment_reference || null,
      p_offline_amount_paise: form.offline_amount_rupees ? Math.round(Number(form.offline_amount_rupees) * 100) : null,
      p_internal_note: form.internal_note || null,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(form.id ? "Voucher updated. Existing redemption history remains unchanged." : "Voucher created and ready for controlled use.");
      setForm(emptyForm);
      await load();
    }
    setBusy(false);
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setMessage(`${code} copied. Share it only with the assigned account or school.`);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <form onSubmit={save} className="rm-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <span className="rm-label">Super Admin only</span>
            <h2 style={{ margin: "5px 0", color: "#14232B" }}>{form.id ? "Edit voucher" : "Create voucher or offline-payment access"}</h2>
            <p style={{ margin: 0, color: "#44545C", maxWidth: 760 }}>
              Discounts are percentage-only. A 100% voucher creates a zero-value order, preserves the offline or manual-access evidence and grants the same entitlement as a verified purchase.
            </p>
          </div>
          {form.id && <button type="button" className="rm-btn-secondary" onClick={() => setForm(emptyForm)}>Create another</button>}
        </div>

        <div className="voucher-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          <label>
            <span className="rm-label">Voucher code</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="rm-input" value={form.code} onChange={(event) => update("code", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} required minLength={4} maxLength={32} />
              <button type="button" className="rm-btn-secondary" onClick={() => update("code", generateCode())}>Generate</button>
            </div>
          </label>
          <label>
            <span className="rm-label">Discount</span>
            <div style={{ position: "relative" }}>
              <input type="number" min="1" max="100" className="rm-input" value={form.discount_percent} onChange={(event) => update("discount_percent", event.target.value)} required />
              <span style={{ position: "absolute", right: 13, top: 12, fontWeight: 800, color: "#0E5A5A" }}>%</span>
            </div>
          </label>
          <label>
            <span className="rm-label">Purpose</span>
            <select className="rm-input" value={form.purpose} onChange={(event) => update("purpose", event.target.value as Voucher["purpose"])}>
              <option value="promotion">Promotion</option>
              <option value="offline_payment">Offline payment received</option>
              <option value="scholarship">Scholarship / sponsored access</option>
              <option value="manual_access">Manual access grant</option>
            </select>
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <span className="rm-label">Description visible to administrators</span>
            <input className="rm-input" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Example: Annual school plan paid by bank transfer" />
          </label>
          <label>
            <span className="rm-label">Limit to product</span>
            <select className="rm-input" value={form.product_id} onChange={(event) => update("product_id", event.target.value)}>
              <option value="">Any published product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>

          <label>
            <span className="rm-label">Assigned email</span>
            <input type="email" className="rm-input" value={form.allowed_email} onChange={(event) => update("allowed_email", event.target.value.toLowerCase())} placeholder="Required for account-bound 100% access" />
          </label>
          <label>
            <span className="rm-label">Assigned school ID</span>
            <input className="rm-input" value={form.organization_id} onChange={(event) => update("organization_id", event.target.value)} placeholder="Optional organization UUID" />
          </label>
          <label>
            <span className="rm-label">Total uses</span>
            <input type="number" min="1" className="rm-input" value={form.usage_limit} onChange={(event) => update("usage_limit", event.target.value)} placeholder="Blank = unlimited" />
          </label>

          <label>
            <span className="rm-label">Uses per account</span>
            <input type="number" min="1" className="rm-input" value={form.per_user_limit} onChange={(event) => update("per_user_limit", event.target.value)} required />
          </label>
          <label>
            <span className="rm-label">Starts at</span>
            <input type="datetime-local" className="rm-input" value={form.starts_at} onChange={(event) => update("starts_at", event.target.value)} />
          </label>
          <label>
            <span className="rm-label">Ends at</span>
            <input type="datetime-local" className="rm-input" value={form.ends_at} onChange={(event) => update("ends_at", event.target.value)} />
          </label>

          {form.purpose === "offline_payment" && <>
            <label>
              <span className="rm-label">Amount received ₹</span>
              <input type="number" min="1" step="0.01" className="rm-input" value={form.offline_amount_rupees} onChange={(event) => update("offline_amount_rupees", event.target.value)} required />
            </label>
            <label style={{ gridColumn: "span 2" }}>
              <span className="rm-label">Offline transaction / receipt / invoice reference</span>
              <input className="rm-input" value={form.offline_payment_reference} onChange={(event) => update("offline_payment_reference", event.target.value)} required />
            </label>
          </>}

          <label style={{ gridColumn: "1/-1" }}>
            <span className="rm-label">Internal note</span>
            <textarea className="rm-input" rows={3} value={form.internal_note} onChange={(event) => update("internal_note", event.target.value)} placeholder="Internal evidence or approval note. This is not shown to the redeemer." />
          </label>
          <label style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 9, fontWeight: 750 }}>
            <input type="checkbox" checked={form.active} onChange={(event) => update("active", event.target.checked)} />
            Voucher is active
          </label>
        </div>

        <div style={{ marginTop: 14, padding: 14, border: "1px solid #DCE9E7", background: "#F7F9F7", borderRadius: 12, display: "flex", gap: 10, alignItems: "flex-start", color: "#44545C" }}>
          <ShieldCheck size={20} color="#0E5A5A" style={{ flex: "0 0 auto" }} />
          <span>100% vouchers are deliberately account- or school-bound. Server-side checks recalculate the discount and prevent reuse, product mismatch and unverified access.</span>
        </div>

        <button disabled={busy} className="rm-btn-primary" style={{ marginTop: 18, width: "100%", display: "flex", gap: 8, justifyContent: "center", alignItems: "center", background: "#0E5A5A" }}>
          {busy ? <LoaderCircle size={18} className="spin" /> : <TicketPercent size={18} />}
          {form.id ? "Save voucher changes" : "Create controlled voucher"}
        </button>
        {message && <div role="status" style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#FCF1DB", color: "#14232B" }}>{message}</div>}
      </form>

      <section className="rm-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><span className="rm-label">Voucher register</span><h2 style={{ color: "#14232B" }}>Active, scheduled and historical vouchers</h2></div>
          <button className="rm-btn-secondary" onClick={() => void load()} disabled={busy}><RefreshCw size={16} /> Refresh</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
            <thead><tr style={{ textAlign: "left", color: "#44545C" }}><th style={{ padding: 10 }}>Code</th><th>Discount</th><th>Purpose</th><th>Assigned to</th><th>Uses</th><th>Period</th><th>Status</th><th /></tr></thead>
            <tbody>{vouchers.map((voucher) => <tr key={voucher.id} style={{ borderTop: "1px solid #DCE9E7" }}>
              <td style={{ padding: 12 }}><strong>{voucher.code}</strong><div style={{ fontSize: 12, color: "#6B7980" }}>{voucher.description || "No description"}</div></td>
              <td><strong>{voucher.discount_percent}%</strong></td>
              <td>{voucher.purpose.replaceAll("_", " ")}{voucher.offline_amount_paise ? <div style={{ fontSize: 12, color: "#6B7980" }}>{rupees(voucher.offline_amount_paise)} received</div> : null}</td>
              <td>{voucher.allowed_email || (voucher.organization_id ? `School ${voucher.organization_id.slice(0, 8)}…` : "General")}</td>
              <td>{voucher.used_count} / {voucher.usage_limit ?? "∞"}</td>
              <td style={{ fontSize: 12 }}>{voucher.starts_at ? new Date(voucher.starts_at).toLocaleString("en-IN") : "Immediately"}<br />to {voucher.ends_at ? new Date(voucher.ends_at).toLocaleString("en-IN") : "No expiry"}</td>
              <td><span className="rm-badge" style={{ background: voucher.active ? "#DCE9E7" : "#E7ECEB", color: voucher.active ? "#0E5A5A" : "#44545C" }}>{voucher.active ? "Active" : "Inactive"}</span></td>
              <td><div style={{ display: "flex", gap: 8 }}><button className="rm-btn-secondary" onClick={() => void copyCode(voucher.code)} title="Copy voucher"><Copy size={15} /></button><button className="rm-btn-secondary" onClick={() => edit(voucher)}><Edit3 size={15} /> Edit</button></div></td>
            </tr>)}</tbody>
          </table>
          {!vouchers.length && !busy && <p style={{ color: "#6B7980" }}>No vouchers have been created.</p>}
        </div>
      </section>

      <section className="rm-card" style={{ padding: 20 }}>
        <div><span className="rm-label">Redemption ledger</span><h2 style={{ color: "#14232B" }}>Latest payment discounts and offline access records</h2></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 930 }}>
            <thead><tr style={{ textAlign: "left", color: "#44545C" }}><th style={{ padding: 10 }}>Date</th><th>Voucher</th><th>Account / school</th><th>Discount</th><th>Source</th><th>Reference</th><th>Order</th></tr></thead>
            <tbody>{redemptions.map((redemption) => <tr key={redemption.id} style={{ borderTop: "1px solid #DCE9E7" }}>
              <td style={{ padding: 12 }}>{new Date(redemption.created_at).toLocaleString("en-IN")}</td>
              <td><strong>{voucherById[redemption.voucher_id]?.code ?? redemption.voucher_id.slice(0, 8)}</strong></td>
              <td>{profileNames[redemption.user_id] ?? redemption.user_id.slice(0, 8)}{redemption.organization_id ? <div style={{ fontSize: 12, color: "#6B7980" }}>{organizationNames[redemption.organization_id] ?? redemption.organization_id.slice(0, 8)}</div> : null}</td>
              <td>{rupees(redemption.discount_paise)}</td>
              <td>{redemption.payment_source.replaceAll("_", " ")}</td>
              <td>{redemption.offline_reference || "—"}</td>
              <td><code>{redemption.order_id.slice(0, 12)}…</code></td>
            </tr>)}</tbody>
          </table>
          {!redemptions.length && !busy && <p style={{ color: "#6B7980" }}>No vouchers have been redeemed yet.</p>}
        </div>
      </section>

      <style jsx>{`@media(max-width:900px){.voucher-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.voucher-form-grid>*{grid-column:auto!important}.voucher-form-grid>label[style*="1/-1"]{grid-column:1/-1!important}}@media(max-width:620px){.voucher-form-grid{grid-template-columns:1fr!important}.voucher-form-grid>*{grid-column:1!important}}`}</style>
    </div>
  );
}
