import { DashboardShell } from '@/components/DashboardShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { ProductCommerceWorkspace } from '@/components/commerce/ProductCommerceWorkspace';

export default function AdminProducts() {
  return (
    <ProtectedPage allowed="admin">
      <DashboardShell kind="admin">
        <ProductCommerceWorkspace />
      </DashboardShell>
    </ProtectedPage>
  );
}
