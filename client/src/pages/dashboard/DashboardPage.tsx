import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Package,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  X,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '@/lib/api';
import { subscribeToSocket, joinWarehouseRoom } from '@/lib/socket';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface KPIs {
  totalProducts: number;
  lowStockCount: number;
  pendingReceipts: number;
  pendingDeliveries: number;
  transfersScheduled: number;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface LowStockItem {
  id: string;
  qty: number;
  product: {
    id: string;
    sku: string;
    name: string;
    uom: string;
    safetyStock: number;
    category?: { name: string };
  };
  location?: {
    name: string;
    warehouse?: { id: string; name: string; code: string };
  };
}

export const DashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active filter params
  const typeFilter = searchParams.get('type') || '';
  const statusFilter = searchParams.get('status') || '';
  const warehouseFilter = searchParams.get('warehouseId') || '';
  const categoryFilter = searchParams.get('categoryId') || '';
  const searchQuery = searchParams.get('search') || '';

  // State
  const [kpis, setKpis] = useState<KPIs>({
    totalProducts: 0,
    lowStockCount: 0,
    pendingReceipts: 0,
    pendingDeliveries: 0,
    transfersScheduled: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [movesData, setMovesData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Update query params helper
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'ALL') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // Fetch Master Data (Warehouses + Categories)
  const fetchMetadata = async () => {
    try {
      const [whRes, catRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/categories'),
      ]);
      setWarehouses(whRes.data || []);
      setCategories(catRes.data || []);
    } catch (e) {
      console.error('Failed to load warehouses/categories:', e);
    }
  };

  // Fetch KPIs
  const fetchKPIs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);

      const res = await api.get(`/dashboard/kpis?${params.toString()}`);
      setKpis(res.data);
    } catch (e) {
      console.error('Failed to fetch KPIs:', e);
    }
  }, [warehouseFilter, categoryFilter]);

  // Fetch Low Stock details
  const fetchLowStockItems = useCallback(async () => {
    try {
      const res = await api.get('/stock/levels?belowSafety=true&limit=20');
      setLowStockItems(res.data?.data || []);
    } catch (e) {
      console.error('Failed to fetch low stock items:', e);
    }
  }, []);

  // Fetch Recent Documents
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '10');

      const res = await api.get(`/documents?${params.toString()}`);
      setDocuments(res.data?.data || []);
    } catch (e) {
      console.error('Failed to fetch documents:', e);
    }
  }, [typeFilter, statusFilter, warehouseFilter, searchQuery]);

  // Fetch Chart Data: Weekly Stock Moves + Category Distribution
  const fetchCharts = useCallback(async () => {
    try {
      const [movesRes, catRes, prodRes] = await Promise.all([
        api.get('/stock/moves?limit=100'),
        api.get('/categories'),
        api.get('/products?limit=100'),
      ]);

      const moves = movesRes.data?.data || [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayCounts: Record<string, { receipts: number; deliveries: number; transfers: number }> = {
        Mon: { receipts: 0, deliveries: 0, transfers: 0 },
        Tue: { receipts: 0, deliveries: 0, transfers: 0 },
        Wed: { receipts: 0, deliveries: 0, transfers: 0 },
        Thu: { receipts: 0, deliveries: 0, transfers: 0 },
        Fri: { receipts: 0, deliveries: 0, transfers: 0 },
        Sat: { receipts: 0, deliveries: 0, transfers: 0 },
        Sun: { receipts: 0, deliveries: 0, transfers: 0 },
      };

      moves.forEach((m: any) => {
        const d = new Date(m.createdAt);
        const day = days[d.getDay()];
        if (dayCounts[day]) {
          if (m.refType === 'RECEIPT') dayCounts[day].receipts += Number(m.qty || 1);
          else if (m.refType === 'DELIVERY') dayCounts[day].deliveries += Number(m.qty || 1);
          else dayCounts[day].transfers += Number(m.qty || 1);
        }
      });

      // Format for Recharts
      const formattedMoves = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
        day,
        Receipts: dayCounts[day].receipts,
        Deliveries: dayCounts[day].deliveries,
        Transfers: dayCounts[day].transfers,
      }));
      setMovesData(formattedMoves);

      // Donut Chart: Stock / Products by Category
      const cats = catRes.data || [];
      const prods = prodRes.data?.data || [];
      const catCountMap: Record<string, number> = {};

      cats.forEach((c: any) => {
        catCountMap[c.name] = 0;
      });

      prods.forEach((p: any) => {
        const catName = p.category?.name || 'Uncategorized';
        catCountMap[catName] = (catCountMap[catName] || 0) + 1;
      });

      const donut = Object.entries(catCountMap)
        .filter(([_, count]) => count > 0)
        .map(([name, value]) => ({ name, value }));

      setCategoryDistribution(
        donut.length > 0
          ? donut
          : [
              { name: 'Raw Materials', value: 1 },
              { name: 'Furniture', value: 1 },
              { name: 'Packaging', value: 1 },
            ]
      );
    } catch (e) {
      console.error('Failed to load chart data:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchKPIs(),
      fetchLowStockItems(),
      fetchDocuments(),
      fetchCharts(),
    ]);
    setRefreshing(false);
  }, [fetchKPIs, fetchLowStockItems, fetchDocuments, fetchCharts]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  // Real-time socket listeners
  useEffect(() => {
    if (warehouseFilter) {
      joinWarehouseRoom(warehouseFilter);
    }

    const unsubValidated = subscribeToSocket('document:validated', () => {
      refreshAll();
    });

    const unsubUpdated = subscribeToSocket('stock:updated', () => {
      refreshAll();
    });

    const unsubDashboard = subscribeToSocket('refresh:dashboard', () => {
      refreshAll();
    });

    return () => {
      unsubValidated();
      unsubUpdated();
      unsubDashboard();
    };
  }, [warehouseFilter, refreshAll]);

  // Colors for Donut Chart
  const DONUT_COLORS = ['#714B67', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const hasActiveFilters = Boolean(typeFilter || statusFilter || warehouseFilter || categoryFilter || searchQuery);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header & Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Warehouse Overview</h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Ledger Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time double-entry inventory ledger, document state machine, and safety stock monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            loading={refreshing}
            className="text-xs h-9 bg-slate-900 border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/operations')}
            className="text-xs h-9 bg-[#714B67] hover:bg-[#5f3d56] shadow-sm shadow-[#714B67]/30 text-white font-medium"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
            New Operation
          </Button>
        </div>
      </div>

      {/* ── Low Stock Banner (Yellow Warning Banner when lowStockCount > 0) ────── */}
      {kpis.lowStockCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900/60 p-4 shadow-lg shadow-amber-950/20 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-300">
                    Low Stock Threshold Warning
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {kpis.lowStockCount} {kpis.lowStockCount === 1 ? 'Product' : 'Products'} Affected
                  </span>
                </div>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  {lowStockItems.length > 0 ? (
                    <span>
                      Critical balance detected: <strong className="text-white font-semibold">{lowStockItems[0].product?.name}</strong>{' '}
                      ({lowStockItems[0].qty} {lowStockItems[0].product?.uom} on hand vs safety minimum of{' '}
                      {lowStockItems[0].product?.safetyStock} {lowStockItems[0].product?.uom}).
                    </span>
                  ) : (
                    'One or more products have fallen below their safety reorder levels at internal storage locations.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-12 sm:pl-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/products')}
                className="h-8 text-xs border-amber-500/40 bg-amber-950/30 text-amber-200 hover:bg-amber-900/50"
              >
                Inspect Inventory
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5 KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-slate-800 bg-slate-900/70">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="skeleton-shimmer h-3 w-24" />
                  <Skeleton className="skeleton-shimmer h-8 w-8 rounded-lg" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="skeleton-shimmer h-8 w-16 mb-2" />
                <Skeleton className="skeleton-shimmer h-3 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
        {/* KPI 1: Total Products */}
        <Card className="border-slate-800 bg-slate-900/70 hover:border-slate-700/80 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Products</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Package className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {kpis.totalProducts}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Active registered SKUs</p>
          </CardContent>
        </Card>

        {/* KPI 2: Low Stock Alerts */}
        <Card className={`border-slate-800 bg-slate-900/70 hover:border-slate-700/80 transition-all ${kpis.lowStockCount > 0 ? 'border-amber-500/40 bg-amber-950/10' : ''}`}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Low Stock Alerts</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-bold tracking-tight font-mono ${kpis.lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
              {kpis.lowStockCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Below safety thresholds</p>
          </CardContent>
        </Card>

        {/* KPI 3: Pending Receipts */}
        <Card className="border-slate-800 bg-slate-900/70 hover:border-slate-700/80 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Pending Receipts</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {kpis.pendingReceipts}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Incoming supplier shipments</p>
          </CardContent>
        </Card>

        {/* KPI 4: Pending Deliveries */}
        <Card className="border-slate-800 bg-slate-900/70 hover:border-slate-700/80 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Pending Deliveries</span>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[#dfbed3]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {kpis.pendingDeliveries}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Awaiting pick & pack fulfillment</p>
          </CardContent>
        </Card>

        {/* KPI 5: Transfers Scheduled */}
        <Card className="border-slate-800 bg-slate-900/70 hover:border-slate-700/80 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Scheduled Transfers</span>
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {kpis.transfersScheduled}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Inter-location movements</p>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* ── Interactive Filter Chips (Driving URL Params) ────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Filter className="h-3.5 w-3.5 text-[#dfbed3]" />
              <span>Operational Filters</span>
              {hasActiveFilters && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#714B67]/30 text-[#e4bfe0]">
                  Active
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
            {/* Filter 1: Document Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Document Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'All', value: '' },
                  { label: 'Receipt', value: 'RECEIPT' },
                  { label: 'Delivery', value: 'DELIVERY' },
                  { label: 'Transfer', value: 'TRANSFER' },
                  { label: 'Adjustment', value: 'ADJUSTMENT' },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => updateFilter('type', t.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      typeFilter === t.value
                        ? 'bg-[#714B67] text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 2: Document Status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'All', value: '' },
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'Waiting', value: 'WAITING' },
                  { label: 'Ready', value: 'READY' },
                  { label: 'Done', value: 'DONE' },
                  { label: 'Canceled', value: 'CANCELED' },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateFilter('status', s.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      statusFilter === s.value
                        ? 'bg-[#714B67] text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 3: Warehouse */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Warehouse
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => updateFilter('warehouseId', '')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    !warehouseFilter
                      ? 'bg-[#714B67] text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  All WH
                </button>
                {warehouses.map((wh) => (
                  <button
                    key={wh.id}
                    onClick={() => updateFilter('warehouseId', wh.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      warehouseFilter === wh.id
                        ? 'bg-[#714B67] text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                    }`}
                    title={wh.name}
                  >
                    {wh.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 4: Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Category (KPIs)
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => updateFilter('categoryId', '')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    !categoryFilter
                      ? 'bg-[#714B67] text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => updateFilter('categoryId', cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      categoryFilter === cat.id
                        ? 'bg-[#714B67] text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Recharts Analytics Section ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Weekly Stock Moves (Bar Chart) */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Weekly Stock Movements</CardTitle>
                <CardDescription>
                  Volume of double-entry ledger moves categorized by operational flow
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-[#714B67]" /> Receipts
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Deliveries
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Transfers
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Receipts" fill="#714B67" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Deliveries" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Transfers" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Stock by Category (Donut Chart) */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-base">Stock by Category</CardTitle>
            <CardDescription>Product catalog breakdown across segments</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryDistribution.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-xs text-slate-300 font-medium">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Documents Table ────────────────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#dfbed3]" />
                Recent Warehouse Documents
              </CardTitle>
              <CardDescription>
                Live operational documents subject to strict DRAFT &rarr; WAITING &rarr; READY &rarr; DONE state transitions
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Showing {documents.length} records
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Items / Quantities</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No documents matching the active filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  const lineSummary = doc.lines?.length
                    ? `${doc.lines[0]?.product?.name || 'Item'} (${doc.lines[0]?.qty} ${doc.lines[0]?.product?.uom || 'Units'})${
                        doc.lines.length > 1 ? ` +${doc.lines.length - 1} more` : ''
                      }`
                    : 'No lines';

                  return (
                    <TableRow key={doc.id} className="hover:bg-slate-800/50">
                      <TableCell className="font-mono text-xs font-semibold text-white">
                        {doc.docNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 truncate max-w-[90px]">
                            {doc.sourceLocation?.name || 'VENDOR'}
                          </span>
                          <span className="text-slate-500">&rarr;</span>
                          <span className="text-slate-200 font-medium truncate max-w-[90px]">
                            {doc.destLocation?.name || 'CUSTOMER'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        {lineSummary}
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        {doc.partner?.name || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/operations')}
                          className="h-8 text-xs text-slate-300 hover:text-white"
                        >
                          View
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
