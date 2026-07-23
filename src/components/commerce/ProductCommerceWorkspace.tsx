'use client';

import { BarChart3, Package, TicketPercent } from 'lucide-react';
import { AdminProductManager } from '@/components/commerce/AdminProductManager';
import { AdminVoucherManager } from '@/components/commerce/AdminVoucherManager';
import { ProductAnalyticsDashboard } from '@/components/commerce/ProductAnalyticsDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ProductCommerceWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Evidara commerce</div>
        <h1 className="mt-2 text-2xl font-bold text-[#14232B]">Products, vouchers and purchase analytics</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#6B7980]">Bundle published question papers into student or school products, activate offline school seats and measure verified purchases.</p>
      </div>
      <Tabs defaultValue="products">
        <TabsList className="h-auto flex-wrap bg-[#E7ECEB]/60 p-1">
          <TabsTrigger value="products"><Package className="mr-2 h-4 w-4" />Products</TabsTrigger>
          <TabsTrigger value="vouchers"><TicketPercent className="mr-2 h-4 w-4" />Vouchers</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-5"><AdminProductManager /></TabsContent>
        <TabsContent value="vouchers" className="mt-5"><AdminVoucherManager /></TabsContent>
        <TabsContent value="analytics" className="mt-5"><ProductAnalyticsDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
