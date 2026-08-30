'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  School,
  Search,
  TrendingUp,
  CheckCircle,
  XCircle,
  Shield,
  FileText,
  FilePlus,
  ArrowRight,
  CreditCard,
  Activity,
  Crown,
  Package,
  Database,
} from 'lucide-react';

import { useAppStore } from '@/store/use-app-store';
import { useAuth } from '@/context/AuthProvider';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';


import { Tooltip } from '@/components/ui/tooltip';

import { ProductCommerceWorkspace } from '@/components/commerce/ProductCommerceWorkspace';

// ─── Shared helpers ────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  published: 'bg-[var(--teal)] text-white',
  review: 'bg-[#F2B84B] text-[var(--foreground)]',
  draft: 'bg-[var(--line)] text-[var(--muted-foreground)]',
  active: 'bg-[var(--teal)] text-white',
  closed: 'bg-[var(--muted-foreground)] text-white',
  scheduled: 'bg-[#F2B84B] text-[var(--foreground)]',
  revoked: 'bg-[#B54747] text-white',
  expired: 'bg-[#B54747]/60 text-white',
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatNumber = (num: number) => {
  if (num >= 1000) return num.toLocaleString('en-IN');
  return num.toString();
};

// ─── Shared UI helpers ─────────────────────────────────────────────

/** Consistent loading state used across all admin views. */
function AdminLoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-4 md:p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--teal)] border-t-transparent" />
        <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
      </div>
    </div>
  );
}

/** Consistent error state used across all admin views. */
function AdminErrorState({ title, message, onRetry }: { title: string; message: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-4 md:p-6">
      <Card className="shadow-sm rounded-xl w-full max-w-md border-destructive/20">
        <CardContent className="p-5 sm:p-6">
          <XCircle className="mb-3 h-8 w-8 text-destructive" />
          <h1 className="font-semibold text-[var(--foreground)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p>
          <Button className="mt-4" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 1. AdminDashboardView (Command Centre) ────────────────────────

type PlatformOverview = {
  generatedAt: string;
  role?: string;
  stats: {
    users: number;
    schools: number;
    products: number;
    papers: number;
    questions: number;
    revenuePaise: number | null;
    activeSubscriptions: number;
  };
  subscriptions: Array<{
    id: string;
    school: string;
    city: string;
    plan: string;
    seats: number;
    seatsUsed: number;
    status: string;
    startsAt: string;
    expiry: string;
  }>;
};

function usePlatformOverview() {
  const { session } = useAuth();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = session?.access_token;
    if (!token) {
      setError('Platform sign-in is required.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/platform-overview/', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || 'Unable to load platform overview.');
      setData(p);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Unable to load platform overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [session?.access_token]);

  return { data, error, loading, refresh };
}

export function AdminDashboardView() {
  const setView = useAppStore((s) => s.setView);
  const accessRole = useAppStore((s) => s.user?.accessRole);
  const { data, error, loading, refresh } = usePlatformOverview();

  if (loading) return <AdminLoadingState message="Loading live platform overview…" />;
  if (error || !data)
    return (
      <AdminErrorState
        title="Platform overview unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  const cards = [
    ['Schools', data.stats.schools, School, 'admin-subscriptions'],
    ['Users', data.stats.users, Users, 'admin-access'],
    ['Papers', data.stats.papers, FileText, 'admin-papers'],
    ...(accessRole !== 'super_admin' || data.stats.revenuePaise == null
      ? []
      : [['Revenue', formatCurrency(data.stats.revenuePaise / 100), TrendingUp, 'admin-products'] as const]),
    ['Active Subs', data.stats.activeSubscriptions, CreditCard, 'admin-subscriptions'],
    ['Questions', data.stats.questions, FilePlus, 'admin-questions'],
  ] as const;

  return (
    <motion.div className="space-y-5 sm:space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Command Centre</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Authorized platform data · {new Date(data.generatedAt).toLocaleString('en-IN')}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value, Icon, view]) => (
          <Card
            key={label}
            className="cursor-pointer shadow-sm rounded-xl transition-shadow hover:shadow-md"
            onClick={() => setView(view)}
          >
            <CardContent className="p-3 sm:p-4 text-center">
              <Icon className="mx-auto mb-2 h-5 w-5 text-[var(--teal)]" />
              <p className="text-lg font-bold">{typeof value === 'number' ? formatNumber(value) : value}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Operational status notice */}
      <Card className="shadow-sm rounded-xl">
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">Operational status is not inferred</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Fabricated uptime and "all systems operational" claims have been removed. Use authenticated
            readiness checks for service health.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── 4. AdminProductsView ──────────────────────────────────────────

export function AdminProductsView() {
  return <ProductCommerceWorkspace />;
}

// ─── 5. AdminSubscriptionsView ─────────────────────────────────────

export function AdminSubscriptionsView() {
  const { data, error, loading, refresh } = usePlatformOverview();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  if (loading) return <AdminLoadingState message="Loading live subscriptions…" />;
  if (error || !data)
    return (
      <AdminErrorState
        title="Subscriptions unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  const filtered = data.subscriptions.filter(
    (sub) =>
      (!search || `${sub.school} ${sub.city} ${sub.plan}`.toLowerCase().includes(search.toLowerCase())) &&
      (statusFilter === 'all' || sub.status === statusFilter)
  );

  return (
    <motion.div className="space-y-5 sm:space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Subscriptions</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Live institution subscription and seat state. Revenue is sourced only from verified paid orders.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Records</p>
            <p className="text-2xl font-bold">{data.subscriptions.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Active</p>
            <p className="text-2xl font-bold text-[var(--teal)]">{data.stats.activeSubscriptions}</p>
          </CardContent>
        </Card>
        {data.stats.revenuePaise != null ? (
          <Card className="shadow-sm rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-[var(--muted-foreground)]">Paid-order revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(data.stats.revenuePaise / 100)}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-[var(--muted-foreground)]">Revenue</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">Per institution only</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Open Institutions for payment detail.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search & filter */}
      <Card className="shadow-sm rounded-xl">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              className="pl-9"
              placeholder="Search institutions or plans"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
        </CardContent>
      </Card>

      {/* Subscriptions table */}
      <Card className="shadow-sm rounded-xl">
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="font-medium">{sub.school}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{sub.city}</div>
                  </TableCell>
                  <TableCell>{sub.plan}</TableCell>
                  <TableCell>{sub.seatsUsed}/{sub.seats}</TableCell>
                  <TableCell>
                    <Badge className={statusBadge[sub.status] || 'bg-[var(--line)] text-[var(--foreground)]'}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(sub.expiry).toLocaleDateString('en-IN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
              No matching live subscription records.
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
