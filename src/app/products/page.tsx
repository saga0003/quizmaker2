import { Navbar } from '@/components/Navbar';
import { ProductStore } from '@/components/commerce/ProductStore';
import { SetupBanner } from '@/components/SetupBanner';

export default function ProductsPage() {
  return (
    <>
      <SetupBanner />
      <Navbar />
      <main className="rm-container" style={{ padding: '46px 0 70px' }}>
        <div style={{ maxWidth: 800, marginBottom: 28 }}>
          <span className="rm-label">Evidara Paper Series</span>
          <h1 style={{ fontSize: 'clamp(36px,6vw,54px)', lineHeight: 1.08, color: '#14232B', margin: '8px 0 12px' }}>Choose the right series for a student or school</h1>
          <p style={{ color: '#44545C', fontSize: 17, lineHeight: 1.7 }}>See every paper included, preview the product, pay securely online or apply an authorised voucher for school offline activation.</p>
        </div>
        <ProductStore />
      </main>
    </>
  );
}
