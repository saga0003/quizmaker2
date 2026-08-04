'use client';

import { BarChart3, Package, TicketPercent } from 'lucide-react';
import { AdminProductManager } from '@/components/commerce/AdminProductManager';
import { AdminVoucherManager } from '@/components/commerce/AdminVoucherManager';
import { ProductAnalyticsDashboard } from '@/components/commerce/ProductAnalyticsDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from '@/components/commerce/commerce-prototype.module.css';

export function ProductCommerceWorkspace() {
  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Evidara commerce</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">Products, vouchers and analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#6B7980]">Bundle Evidara master papers into student or school products, control payment evidence and measure verified commerce.</p>
      </div>
      <Tabs defaultValue="products">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-[#E7ECEB] bg-transparent p-0">
          <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#0E5A5A] data-[state=active]:bg-transparent data-[state=active]:text-[#0E5A5A] data-[state=active]:shadow-none"><Package className="mr-2 h-4 w-4" />Products</TabsTrigger>
          <TabsTrigger value="vouchers" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#0E5A5A] data-[state=active]:bg-transparent data-[state=active]:text-[#0E5A5A] data-[state=active]:shadow-none"><TicketPercent className="mr-2 h-4 w-4" />Vouchers</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#0E5A5A] data-[state=active]:bg-transparent data-[state=active]:text-[#0E5A5A] data-[state=active]:shadow-none"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-6"><AdminProductManager /></TabsContent>
        <TabsContent value="vouchers" className="mt-6"><AdminVoucherManager /></TabsContent>
        <TabsContent value="analytics" className="mt-6"><ProductAnalyticsDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
