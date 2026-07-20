import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AdminProductManager } from "@/components/commerce/AdminProductManager";
import { AdminVoucherManager } from "@/components/commerce/AdminVoucherManager";

export default function AdminProducts() {
  return (
    <ProtectedPage allowed="admin">
      <DashboardShell kind="admin">
        <div>
          <span className="rm-label">Evidara V6.7 production commerce</span>
          <h1 style={{ margin: "5px 0", fontSize: 34, color: "#14232B" }}>Plans, pricing, vouchers and payment evidence</h1>
          <p style={{ color: "#44545C", maxWidth: 900 }}>
            Publish products, control current pricing and create percentage-only vouchers. Offline-paid and complimentary access remains linked to an auditable order and redemption record.
          </p>
        </div>
        <AdminProductManager />
        <div style={{ marginTop: 28 }}>
          <AdminVoucherManager />
        </div>
      </DashboardShell>
    </ProtectedPage>
  );
}
