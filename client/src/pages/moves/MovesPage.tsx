import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Warehouse as WarehouseIcon,
  Package,
  User as UserIcon,
  ChevronRight,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export const MovesPage: React.FC = () => {
  const [moves, setMoves] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchMoves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('refType', typeFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (productFilter) params.set('productId', productFilter);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate).toISOString());
      params.set('limit', '100');

      const res = await api.get(`/stock/moves?${params.toString()}`);
      setMoves(res.data?.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load stock move ledger');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiltersMaster = async () => {
    try {
      const [whRes, prodRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/products?limit=100'),
      ]);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFiltersMaster();
  }, []);

  useEffect(() => {
    fetchMoves();
  }, [typeFilter, warehouseFilter, productFilter, fromDate, toDate]);

  // Client-side text search
  const filteredMoves = moves.filter((m) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      m.product?.name?.toLowerCase().includes(term) ||
      m.product?.sku?.toLowerCase().includes(term) ||
      m.document?.docNumber?.toLowerCase().includes(term) ||
      m.fromLocation?.name?.toLowerCase().includes(term) ||
      m.toLocation?.name?.toLowerCase().includes(term) ||
      m.performedBy?.name?.toLowerCase().includes(term)
    );
  });

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredMoves.length === 0) {
      toast.error('No stock moves available to export');
      return;
    }

    const headers = [
      'ID',
      'Timestamp',
      'Reference Doc',
      'Move Type',
      'Product SKU',
      'Product Name',
      'Quantity',
      'UOM',
      'From Location',
      'From Warehouse',
      'To Location',
      'To Warehouse',
      'Performed By',
    ];

    const rows = filteredMoves.map((m) => [
      m.id,
      new Date(m.createdAt).toISOString(),
      m.document?.docNumber || '—',
      m.refType,
      `"${m.product?.sku || ''}"`,
      `"${(m.product?.name || '').replace(/"/g, '""')}"`,
      m.qty,
      m.product?.uom || 'Units',
      `"${m.fromLocation?.name || 'VENDOR'}"`,
      `"${m.fromLocation?.warehouse?.name || 'External'}"`,
      `"${m.toLocation?.name || 'CUSTOMER'}"`,
      `"${m.toLocation?.warehouse?.name || 'External'}"`,
      `"${m.performedBy?.name || 'System'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StockSense_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredMoves.length} move records to CSV`);
  };

  // Helper for Move Type Icon and Styles
  const getMoveTypeConfig = (type: string) => {
    switch (type) {
      case 'RECEIPT':
        return {
          icon: ArrowDownLeft,
          color: 'text-emerald-400',
          bg: 'bg-emerald-950/60',
          border: 'border-emerald-800/60',
          badgeText: 'text-emerald-300',
          deltaPrefix: '+',
          deltaColor: 'text-emerald-400',
        };
      case 'DELIVERY':
        return {
          icon: ArrowUpRight,
          color: 'text-rose-400',
          bg: 'bg-rose-950/60',
          border: 'border-rose-800/60',
          badgeText: 'text-rose-300',
          deltaPrefix: '-',
          deltaColor: 'text-rose-400',
        };
      case 'TRANSFER':
        return {
          icon: ArrowLeftRight,
          color: 'text-blue-400',
          bg: 'bg-blue-950/60',
          border: 'border-blue-800/60',
          badgeText: 'text-blue-300',
          deltaPrefix: '⇄ ',
          deltaColor: 'text-blue-400',
        };
      case 'ADJUSTMENT':
      default:
        return {
          icon: AlertTriangle,
          color: 'text-amber-400',
          bg: 'bg-amber-950/60',
          border: 'border-amber-800/60',
          badgeText: 'text-amber-300',
          deltaPrefix: '⚠ ',
          deltaColor: 'text-amber-400',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <History className="h-6 w-6 text-[#dfbed3]" />
            Double-Entry Move Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable timeline audit trail of all physical and virtual warehouse inventory movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMoves}
            className="text-xs h-9 bg-slate-900 border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            className="text-xs h-9 bg-emerald-700 hover:bg-emerald-600 text-white shadow"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Filters Card (Date Range, Warehouse, Product, Type) ───────────────── */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search move or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Warehouse Filter */}
            <div>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714B67]"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714B67]"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714B67]"
              >
                <option value="">All Move Types</option>
                <option value="RECEIPT">RECEIPT (Vendor &rarr; Stock)</option>
                <option value="DELIVERY">DELIVERY (Stock &rarr; Customer)</option>
                <option value="TRANSFER">TRANSFER (Stock &rarr; Stock)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Stock &harr; Loss)</option>
              </select>
            </div>
          </div>

          {/* Date Range Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Date Range:
              </span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 text-xs w-36 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-500">&rarr;</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 text-xs w-36 bg-slate-950 border-slate-800"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono text-[11px]">
                Showing {filteredMoves.length} records
              </span>

              {(search || typeFilter || warehouseFilter || productFilter || fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('');
                    setWarehouseFilter('');
                    setProductFilter('');
                    setFromDate('');
                    setToDate('');
                  }}
                  className="h-7 text-xs text-slate-400 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Vertical Timeline Ledger ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80">
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <Skeleton className="skeleton-shimmer h-6 w-16" />
                    <Skeleton className="skeleton-shimmer h-5 w-24" />
                    <Skeleton className="skeleton-shimmer h-5 w-32" />
                  </div>
                  <Skeleton className="skeleton-shimmer h-7 w-20" />
                </div>
                <div className="pt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="skeleton-shimmer h-5 w-32" />
                    <Skeleton className="skeleton-shimmer h-4 w-4 rounded-full" />
                    <Skeleton className="skeleton-shimmer h-5 w-32" />
                  </div>
                  <Skeleton className="skeleton-shimmer h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMoves.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40">
            <History className="h-8 w-8 text-slate-600 mb-1" />
            <p className="text-sm font-semibold text-slate-300">No stock movements recorded</p>
            <p className="text-xs text-slate-500">
              When documents are validated to DONE, immutable moves will stream here.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
            {filteredMoves.map((move) => {
              const config = getMoveTypeConfig(move.refType);
              const Icon = config.icon;

              const fromName = move.fromLocation?.name || 'VENDOR (Supplier)';
              const toName = move.toLocation?.name || 'CUSTOMER (Destination)';
              const fromWh = move.fromLocation?.warehouse?.code;
              const toWh = move.toLocation?.warehouse?.code;

              return (
                <div key={move.id} className="relative group">
                  {/* Timeline Dot Icon */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-3 h-7 w-7 rounded-full border ${config.border} ${config.bg} ${config.color} flex items-center justify-center shadow-lg ring-4 ring-slate-950 transition-transform group-hover:scale-110`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Ledger Move Card */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition-all hover:border-slate-700 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                      {/* Move Type & Reference Doc */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono font-bold ${config.badgeText} ${config.bg} ${config.border}`}
                        >
                          {move.refType}
                        </Badge>

                        {move.document?.docNumber && (
                          <span className="font-mono text-xs font-semibold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {move.document.docNumber}
                          </span>
                        )}

                        <span className="text-slate-400 text-xs">&bull;</span>

                        {/* Product SKU and Name */}
                        <span className="font-mono text-xs font-bold text-[#dfbed3]">
                          {move.product?.sku}
                        </span>
                        <span className="text-xs text-slate-200 font-medium truncate max-w-xs">
                          {move.product?.name}
                        </span>
                      </div>

                      {/* Quantity Delta Badge */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`font-mono text-sm font-extrabold px-2.5 py-0.5 rounded-lg ${config.bg} border ${config.border} ${config.deltaColor}`}
                        >
                          {config.deltaPrefix}
                          {move.qty} {move.product?.uom || 'Units'}
                        </span>
                      </div>
                    </div>

                    {/* Location Path Chips + User / Timestamp */}
                    <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      {/* Location Path Flow */}
                      <div className="flex flex-wrap items-center gap-1.5 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] flex items-center gap-1">
                          {fromWh && <span className="text-slate-500 font-bold">{fromWh}/</span>}
                          {fromName}
                        </span>

                        <span className="text-slate-500 text-xs">&rarr;</span>

                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] flex items-center gap-1">
                          {toWh && <span className="text-slate-500 font-bold">{toWh}/</span>}
                          {toName}
                        </span>
                      </div>

                      {/* User Attribution & Timestamp */}
                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3 text-slate-500" />
                          {move.performedBy?.name || 'System'}
                        </span>

                        <span className="text-slate-600">&bull;</span>

                        <span className="font-mono text-slate-400 whitespace-nowrap">
                          {formatDate(move.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovesPage;
