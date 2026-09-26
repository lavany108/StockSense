import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  RotateCcw,
  FileText,
  Warehouse as WarehouseIcon,
  Calendar,
  Building2,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  User as UserIcon,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { z } from 'zod';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/Sheet';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

type DocTypeTab = 'ALL' | 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT';

export const OperationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isManager = user?.role === 'MANAGER';
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const [activeTab, setActiveTab] = useState<DocTypeTab>(
    (searchParams.get('type') as DocTypeTab) || 'ALL'
  );

  // Filter States (4 filters)
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [warehouseFilter, setWarehouseFilter] = useState<string>(searchParams.get('warehouseId') || '');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Data States
  const [documents, setDocuments] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Document for Detail View / Stepper
  const [selectedDocId, setSelectedDocId] = useState<string | null>(searchParams.get('docId') || null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New Document Dialog State
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [newDocType, setNewDocType] = useState<'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT'>('RECEIPT');
  const [sourceLocId, setSourceLocId] = useState('');
  const [destLocId, setDestLocId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('INVENTORY_COUNT_CORRECTION');
  const [reasonNote, setReasonNote] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [docLines, setDocLines] = useState<Array<{ productId: string; qty: number; locationId?: string }>>([
    { productId: '', qty: 1 },
  ]);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Fetch Master references
  const fetchMasterData = async () => {
    try {
      const [whRes, locRes, prodRes, partRes, levelsRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/locations'),
        api.get('/products?limit=200'),
        api.get('/partners'),
        api.get('/stock/levels?limit=500'),
      ]);
      setWarehouses(whRes.data || []);
      setLocations(locRes.data || []);
      setProducts(prodRes.data?.data || []);
      setPartners(partRes.data || []);
      setStockLevels(levelsRes.data?.data || []);
    } catch (e) {
      console.error('Error fetching master data:', e);
    }
  };

  // Fetch Documents list with active filters
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.set('type', activeTab);
      if (statusFilter) params.set('status', statusFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const res = await api.get(`/documents?${params.toString()}`);
      setDocuments(res.data?.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load operations documents');
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific document detail
  const fetchDocumentDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/documents/${id}`);
      setSelectedDoc(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.errors?.document || 'Failed to load document detail');
      setSelectedDocId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [activeTab, statusFilter, warehouseFilter, search]);

  useEffect(() => {
    if (selectedDocId) {
      fetchDocumentDetail(selectedDocId);
    } else {
      setSelectedDoc(null);
    }
  }, [selectedDocId]);

  // Handle auto-opening doc from query param (like low stock draft po)
  useEffect(() => {
    const qDoc = searchParams.get('docNumber');
    if (qDoc && documents.length > 0) {
      const found = documents.find((d) => d.docNumber === qDoc);
      if (found) {
        setSelectedDocId(found.id);
      }
    }
  }, [searchParams, documents]);

  // Available stock helper for delivery lines at source location
  const getAvailableStock = (prodId: string, locId: string) => {
    if (!prodId || !locId) return 0;
    const match = stockLevels.find((sl) => sl.productId === prodId && sl.locationId === locId);
    return match ? match.qty : 0;
  };

  // State machine action transitions
  const handleAdvanceStatus = async (targetStatus: 'WAITING' | 'READY') => {
    if (!selectedDoc) return;
    setActionLoading(targetStatus);
    try {
      const res = await api.patch(`/documents/${selectedDoc.id}/assign`);
      toast.success(`Document ${selectedDoc.docNumber} transitioned to ${res.data.status}`);
      fetchDocumentDetail(selectedDoc.id);
      fetchDocuments();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.errors?.status ||
        err.response?.data?.errors?.validation ||
        'Failed to advance document status';
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleValidateDoc = async () => {
    if (!selectedDoc) return;
    setActionLoading('VALIDATE');
    try {
      const res = await api.post(`/documents/${selectedDoc.id}/validate`);
      toast.success(`Operation ${selectedDoc.docNumber} validated! Stock ledger updated.`);
      fetchDocumentDetail(selectedDoc.id);
      fetchDocuments();
      // Also refresh stock levels
      const levelsRes = await api.get('/stock/levels?limit=500');
      setStockLevels(levelsRes.data?.data || []);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.errors?.validation ||
        err.response?.data?.errors?.status ||
        err.response?.data?.message ||
        'Validation failed: Insufficient stock or invalid state';
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDoc = async () => {
    if (!selectedDoc) return;
    setActionLoading('CANCEL');
    try {
      const res = await api.post(`/documents/${selectedDoc.id}/cancel`);
      toast.success(`Operation ${selectedDoc.docNumber} canceled.`);
      fetchDocumentDetail(selectedDoc.id);
      fetchDocuments();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.errors?.status ||
        err.response?.data?.errors?.validation ||
        'Failed to cancel operation';
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  // Open New Document Dialog
  const handleOpenNewDoc = (typeToOpen?: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT') => {
    const type = typeToOpen || (activeTab === 'ALL' ? 'RECEIPT' : activeTab);
    setNewDocType(type);

    const internalLocs = locations.filter((l) => l.type === 'INTERNAL');
    const firstInternal = internalLocs[0]?.id || '';
    const secondInternal = internalLocs[1]?.id || internalLocs[0]?.id || '';

    if (type === 'RECEIPT') {
      setDestLocId(firstInternal);
      const firstSupplier = partners.find((p) => p.type === 'SUPPLIER')?.id || '';
      setSelectedPartnerId(firstSupplier);
    } else if (type === 'DELIVERY') {
      setSourceLocId(firstInternal);
      const firstCust = partners.find((p) => p.type === 'CUSTOMER')?.id || '';
      setSelectedPartnerId(firstCust);
    } else if (type === 'TRANSFER') {
      setSourceLocId(firstInternal);
      setDestLocId(secondInternal);
    } else if (type === 'ADJUSTMENT') {
      setReasonCode('INVENTORY_COUNT_CORRECTION');
      setReasonNote('Routine cycle count audit reconciliation');
      setDocLines([{ productId: products[0]?.id || '', qty: 1, locationId: firstInternal }]);
    }

    if (type !== 'ADJUSTMENT') {
      setDocLines([{ productId: products[0]?.id || '', qty: 1 }]);
    }

    setScheduledDate('');
    setIsNewDocOpen(true);
  };

  // Submit New Document Form
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation checks
    if (newDocType === 'TRANSFER' && sourceLocId === destLocId) {
      toast.error('Transfer source and destination locations must differ');
      return;
    }

    if (newDocType === 'ADJUSTMENT' && !reasonNote.trim()) {
      toast.error('A clear explanatory reason note is required for adjustments');
      return;
    }

    if (docLines.length === 0 || docLines.some((l) => !l.productId || l.qty === 0)) {
      toast.error('Please specify valid products and quantities for all lines');
      return;
    }

    // For delivery, check stock availability
    if (newDocType === 'DELIVERY') {
      for (const line of docLines) {
        const avail = getAvailableStock(line.productId, sourceLocId);
        if (avail <= 0) {
          const prod = products.find((p) => p.id === line.productId);
          toast.error(`Zero stock available for ${prod?.sku || 'item'} at selected source location`);
          return;
        }
        if (line.qty > avail) {
          const prod = products.find((p) => p.id === line.productId);
          toast.error(`Requested ${line.qty} of ${prod?.sku} exceeds available stock (${avail})`);
          return;
        }
      }
    }

    setCreateSubmitting(true);
    try {
      let payload: any = {
        type: newDocType,
        lines: docLines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          ...(newDocType === 'ADJUSTMENT' ? { locationId: l.locationId || sourceLocId } : {}),
        })),
      };

      if (scheduledDate) {
        payload.scheduledDate = new Date(scheduledDate).toISOString();
      }

      if (newDocType === 'RECEIPT') {
        payload.destLocationId = destLocId;
        if (selectedPartnerId) payload.partnerId = selectedPartnerId;
      } else if (newDocType === 'DELIVERY') {
        payload.sourceLocationId = sourceLocId;
        if (selectedPartnerId) payload.partnerId = selectedPartnerId;
      } else if (newDocType === 'TRANSFER') {
        payload.sourceLocationId = sourceLocId;
        payload.destLocationId = destLocId;
      } else if (newDocType === 'ADJUSTMENT') {
        payload.reasonCode = reasonCode;
        payload.reasonNote = reasonNote;
      }

      const res = await api.post('/documents', payload);
      toast.success(`Document ${res.data.docNumber} created in DRAFT state`);
      setIsNewDocOpen(false);
      fetchDocuments();
      setSelectedDocId(res.data.id);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.errors?.validation ||
        err.response?.data?.errors?.location ||
        err.response?.data?.errors?.destLocationId ||
        err.response?.data?.errors?.sourceLocationId ||
        err.response?.data?.message ||
        'Failed to create document';
      toast.error(errMsg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Helper to add line
  const handleAddLine = () => {
    const firstInternal = locations.find((l) => l.type === 'INTERNAL')?.id || '';
    setDocLines([
      ...docLines,
      {
        productId: products[0]?.id || '',
        qty: 1,
        ...(newDocType === 'ADJUSTMENT' ? { locationId: firstInternal } : {}),
      },
    ]);
  };

  // Helper to remove line
  const handleRemoveLine = (idx: number) => {
    if (docLines.length <= 1) return;
    setDocLines(docLines.filter((_, i) => i !== idx));
  };

  const internalLocations = locations.filter((l) => l.type === 'INTERNAL');
  const supplierPartners = partners.filter((p) => p.type === 'SUPPLIER');
  const customerPartners = partners.filter((p) => p.type === 'CUSTOMER');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ArrowLeftRight className="h-6 w-6 text-[#dfbed3]" />
            Operations & Document State Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Double-entry operations with strict finite lifecycle: DRAFT &rarr; WAITING &rarr; READY &rarr; DONE.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            className="text-xs h-9 bg-slate-900 border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenNewDoc()}
            className="text-xs h-9 bg-[#714B67] hover:bg-[#5f3d56] text-white shadow-md shadow-[#714B67]/20"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Operation
          </Button>
        </div>
      </div>

      {/* ── Operation Type Tabs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'ALL', label: 'All Operations', icon: Layers },
            { id: 'RECEIPT', label: 'Receipts (IN)', icon: ArrowDownLeft },
            { id: 'DELIVERY', label: 'Deliveries (OUT)', icon: ArrowUpRight },
            { id: 'TRANSFER', label: 'Internal Transfers', icon: ArrowLeftRight },
            { id: 'ADJUSTMENT', label: 'Inventory Adjustments', icon: AlertTriangle },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchParams((prev) => {
                  if (tab.id === 'ALL') prev.delete('type');
                  else prev.set('type', tab.id);
                  return prev;
                });
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#714B67] text-white shadow-md shadow-[#714B67]/25 ring-1 ring-white/10'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar Card (4 Filters) ───────────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Global Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search doc # or partner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* 2. Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714B67]"
              >
                <option value="">All Statuses (DRAFT &rarr; DONE)</option>
                <option value="DRAFT">DRAFT</option>
                <option value="WAITING">WAITING</option>
                <option value="READY">READY</option>
                <option value="DONE">DONE</option>
                <option value="CANCELED">CANCELED</option>
              </select>
            </div>

            {/* 3. Warehouse Filter */}
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

            {/* 4. Reset Filters Button */}
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setWarehouseFilter('');
                  setDateFilter('');
                }}
                className="text-xs h-9 text-slate-400 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Operations Documents Table ────────────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-36">Doc Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flow / Partner</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#dfbed3]" />
                      <span>Loading operations pipeline...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No operational documents found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create a new Receipt, Delivery, Transfer, or Adjustment above.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  return (
                    <TableRow
                      key={doc.id}
                      className="border-slate-800/60 hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedDocId(doc.id)}
                    >
                      {/* Doc Number Badge */}
                      <TableCell className="font-mono text-xs font-bold text-white">
                        <span className="text-[#dfbed3] hover:underline flex items-center gap-1.5">
                          {doc.docNumber}
                          <ChevronRight className="h-3 w-3 text-slate-500" />
                        </span>
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            doc.type === 'RECEIPT'
                              ? 'text-emerald-300 border-emerald-800/50 bg-emerald-950/40'
                              : doc.type === 'DELIVERY'
                              ? 'text-rose-300 border-rose-800/50 bg-rose-950/40'
                              : doc.type === 'TRANSFER'
                              ? 'text-blue-300 border-blue-800/50 bg-blue-950/40'
                              : 'text-amber-300 border-amber-800/50 bg-amber-950/40'
                          }`}
                        >
                          {doc.type}
                        </Badge>
                      </TableCell>

                      {/* Status Pill */}
                      <TableCell>
                        <StatusBadge status={doc.status} />
                      </TableCell>

                      {/* Flow / Partner */}
                      <TableCell>
                        <div className="text-xs text-slate-200">
                          {doc.partner?.name ? (
                            <span className="font-semibold text-white">{doc.partner.name} &bull; </span>
                          ) : null}
                          <span className="text-slate-400 font-mono text-[11px]">
                            {doc.sourceLocation?.name || 'VENDOR'} &rarr; {doc.destLocation?.name || 'CUSTOMER'}
                          </span>
                        </div>
                        {doc.reasonCode && (
                          <span className="text-[10px] text-amber-400 font-mono block">
                            Reason: {doc.reasonCode}
                          </span>
                        )}
                      </TableCell>

                      {/* Lines */}
                      <TableCell className="text-xs text-slate-300 font-mono">
                        {doc.lines?.length || 0} line(s)
                      </TableCell>

                      {/* Created By */}
                      <TableCell className="text-xs text-slate-400">
                        {doc.createdBy?.name || 'System'}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(doc.createdAt)}
                      </TableCell>

                      {/* Detail CTA */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDocId(doc.id)}
                          className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                        >
                          Inspect Stepper
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
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

      {/* ── Document Detail Sheet / Stepper Drawer ────────────────────────────── */}
      <Sheet open={!!selectedDocId} onOpenChange={(open) => !open && setSelectedDocId(null)}>
        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto flex flex-col justify-between">
          <div>
            <SheetHeader>
              <div className="flex items-center justify-between pr-8">
                <SheetTitle className="font-mono text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#dfbed3]" />
                  {selectedDoc?.docNumber || 'Document Detail'}
                </SheetTitle>
                {selectedDoc && <StatusBadge status={selectedDoc.status} />}
              </div>
              <SheetDescription>
                Double-entry transaction state machine and execution controls.
              </SheetDescription>
            </SheetHeader>

            {detailLoading || !selectedDoc ? (
              <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-[#dfbed3]" />
                <span className="text-xs">Loading document record...</span>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* ── Status Stepper ────────────────────────────────────────────── */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                    Document Lifecycle Stepper
                  </span>

                  {selectedDoc.status === 'CANCELED' ? (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2 text-rose-300 text-xs">
                      <ShieldAlert className="h-4 w-4 text-rose-400" />
                      <span>This operation was canceled by a Manager and is in a terminal state.</span>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-between">
                      {/* Step Line */}
                      <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-slate-800 -z-0" />

                      {/* Step 1: DRAFT */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            ['DRAFT', 'WAITING', 'READY', 'DONE'].includes(selectedDoc.status)
                              ? 'bg-slate-700 text-white ring-4 ring-slate-900'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          1
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300 mt-1">DRAFT</span>
                      </div>

                      {/* Step 2: WAITING */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            ['WAITING', 'READY', 'DONE'].includes(selectedDoc.status)
                              ? 'bg-blue-600 text-white ring-4 ring-slate-900'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          2
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300 mt-1">WAITING</span>
                      </div>

                      {/* Step 3: READY */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            ['READY', 'DONE'].includes(selectedDoc.status)
                              ? 'bg-amber-500 text-slate-950 ring-4 ring-slate-900 font-extrabold'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          3
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300 mt-1">READY</span>
                      </div>

                      {/* Step 4: DONE */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            selectedDoc.status === 'DONE'
                              ? 'bg-emerald-500 text-slate-950 ring-4 ring-slate-900 font-extrabold'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          4
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300 mt-1">DONE</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Document Metadata ─────────────────────────────────────────── */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Operation Type</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedDoc.type}
                    </Badge>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Source Location</span>
                    <span className="font-medium text-white font-mono">
                      {selectedDoc.sourceLocation?.name || 'VENDOR (External)'}
                      {selectedDoc.sourceLocation?.warehouse && ` (${selectedDoc.sourceLocation.warehouse.name})`}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Destination Location</span>
                    <span className="font-medium text-white font-mono">
                      {selectedDoc.destLocation?.name || 'CUSTOMER (External)'}
                      {selectedDoc.destLocation?.warehouse && ` (${selectedDoc.destLocation.warehouse.name})`}
                    </span>
                  </div>

                  {selectedDoc.partner && (
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Partner Entity</span>
                      <span className="font-semibold text-slate-200">
                        {selectedDoc.partner.name} ({selectedDoc.partner.type})
                      </span>
                    </div>
                  )}

                  {selectedDoc.reasonCode && (
                    <div className="py-1 border-b border-slate-800/80">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Adjustment Reason</span>
                        <span className="font-mono text-amber-300 font-semibold">{selectedDoc.reasonCode}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 bg-slate-900 p-2 rounded">
                        {selectedDoc.reasonNote}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Initiated By</span>
                    <span className="text-slate-200">{selectedDoc.createdBy?.name || 'Staff User'}</span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Creation Timestamp</span>
                    <span className="text-slate-200 font-mono">{formatDate(selectedDoc.createdAt)}</span>
                  </div>
                </div>

                {/* ── Line Items List ───────────────────────────────────────────── */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Document Lines ({selectedDoc.lines?.length || 0})
                  </h4>

                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 bg-slate-950">
                          <TableHead className="text-xs">SKU & Item</TableHead>
                          <TableHead className="text-right text-xs">Expected Qty</TableHead>
                          <TableHead className="text-right text-xs">Picked / Done</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDoc.lines?.map((line: any) => (
                          <TableRow key={line.id} className="border-slate-800/60">
                            <TableCell>
                              <div className="font-mono text-xs font-semibold text-[#dfbed3]">
                                {line.product?.sku}
                              </div>
                              <div className="text-xs text-white">{line.product?.name}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-white">
                              {line.qty} {line.product?.uom}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-400">
                              {selectedDoc.status === 'DONE' ? line.qty : line.pickedQty || 0} {line.product?.uom}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* ── Committed Stock Moves (If DONE) ──────────────────────────── */}
                {selectedDoc.stockMoves && selectedDoc.stockMoves.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Committed Stock Moves (Double-Entry Ledger)
                    </h4>

                    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-2">
                      {selectedDoc.stockMoves.map((sm: any) => (
                        <div
                          key={sm.id}
                          className="flex justify-between items-center text-xs p-2 rounded bg-slate-950 border border-slate-800/80"
                        >
                          <div>
                            <span className="font-mono font-bold text-white">{sm.product?.sku}</span>
                            <span className="text-[11px] text-slate-400 block">
                              {sm.fromLocation?.name || 'VENDOR'} &rarr; {sm.toLocation?.name || 'CUSTOMER'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            +{sm.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Stepper Action Buttons (Role-Aware) ────────────────────────────── */}
          {selectedDoc && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Cancel Button (MANAGER ONLY, only if not DONE or CANCELED) */}
                {isManager && selectedDoc.status !== 'DONE' && selectedDoc.status !== 'CANCELED' ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    loading={actionLoading === 'CANCEL'}
                    onClick={handleCancelDoc}
                    className="text-xs h-9 bg-rose-950/70 border border-rose-800 text-rose-300 hover:bg-rose-900"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Cancel Doc
                  </Button>
                ) : (
                  <div />
                )}

                {/* State Transition Actions */}
                <div className="flex items-center gap-2">
                  {selectedDoc.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      loading={actionLoading === 'WAITING'}
                      onClick={() => handleAdvanceStatus('WAITING')}
                      className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Assign &rarr; WAITING
                    </Button>
                  )}

                  {selectedDoc.status === 'WAITING' && (
                    <Button
                      size="sm"
                      loading={actionLoading === 'READY'}
                      onClick={() => handleAdvanceStatus('READY')}
                      className="text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                    >
                      Mark Ready &rarr; READY
                    </Button>
                  )}

                  {selectedDoc.status === 'READY' && (
                    <Button
                      size="sm"
                      loading={actionLoading === 'VALIDATE'}
                      onClick={handleValidateDoc}
                      className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-900/30"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Validate &rarr; DONE
                    </Button>
                  )}

                  {selectedDoc.status === 'DONE' && (
                    <span className="text-xs font-mono text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ledger Immutable (DONE)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── New Document Dialog (Receipt/Delivery/Transfer/Adjustment) ─────────── */}
      <Dialog open={isNewDocOpen} onOpenChange={setIsNewDocOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Plus className="h-5 w-5 text-[#dfbed3]" />
              Create Operational Document ({newDocType})
            </DialogTitle>
            <DialogDescription>
              Submit an immutable stock movement draft into the document pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDocument} className="space-y-4 py-2">
            {/* Type Selector Tabs */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Operation Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT'] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => handleOpenNewDoc(t)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                      newDocType === t
                        ? 'bg-[#714B67] border-[#9c638d] text-white shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Partner / Location Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* RECEIPT: Vendor Partner + Dest INTERNAL */}
              {newDocType === 'RECEIPT' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Vendor / Supplier
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                    >
                      <option value="">Default Vendor (Generic)</option>
                      {supplierPartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Destination Storage Location <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={destLocId}
                      onChange={(e) => setDestLocId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                      required
                    >
                      {internalLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.warehouse?.name || 'WH'} &bull; {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* DELIVERY: Source INTERNAL + Customer Partner */}
              {newDocType === 'DELIVERY' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Source Storage Location <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={sourceLocId}
                      onChange={(e) => setSourceLocId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                      required
                    >
                      {internalLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.warehouse?.name || 'WH'} &bull; {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Customer Partner
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                    >
                      <option value="">Default Customer (Generic)</option>
                      {customerPartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* TRANSFER: Source INTERNAL + Dest INTERNAL (must differ) */}
              {newDocType === 'TRANSFER' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Source Location (From) <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={sourceLocId}
                      onChange={(e) => setSourceLocId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                      required
                    >
                      {internalLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.warehouse?.name || 'WH'} &bull; {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Destination Location (To) <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={destLocId}
                      onChange={(e) => setDestLocId(e.target.value)}
                      className={`w-full h-10 rounded-xl border bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none ${
                        sourceLocId === destLocId ? 'border-rose-500' : 'border-slate-800 focus:border-[#714B67]'
                      }`}
                      required
                    >
                      {internalLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.warehouse?.name || 'WH'} &bull; {loc.name}
                        </option>
                      ))}
                    </select>
                    {sourceLocId === destLocId && (
                      <p className="text-[11px] text-rose-400 mt-1">Source & destination must differ</p>
                    )}
                  </div>
                </>
              )}

              {/* ADJUSTMENT: Reason Code + Note */}
              {newDocType === 'ADJUSTMENT' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Reason Code <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                      required
                    >
                      <option value="INVENTORY_COUNT_CORRECTION">INVENTORY_COUNT_CORRECTION</option>
                      <option value="DAMAGED">DAMAGED</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="LOST_THEFT">LOST_THEFT</option>
                      <option value="FOUND_STOCK">FOUND_STOCK</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Reason Note <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Broken box found during physical cycle count"
                      value={reasonNote}
                      onChange={(e) => setReasonNote(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                </>
              )}
            </div>

            {/* Line Items Builder */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Document Line Items ({docLines.length})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="h-7 text-xs bg-slate-950 border-slate-800 text-slate-300"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {docLines.map((line, idx) => {
                  const avail = newDocType === 'DELIVERY' ? getAvailableStock(line.productId, sourceLocId) : null;
                  const isZero = avail !== null && avail <= 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between"
                    >
                      {/* Product Selector */}
                      <div className="flex-1 w-full">
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const updated = [...docLines];
                            updated[idx].productId = e.target.value;
                            setDocLines(updated);
                          }}
                          className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                          required
                        >
                          <option value="" disabled>
                            Select Product
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name} ({p.uom})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* ADJUSTMENT: Location Selector per Line */}
                      {newDocType === 'ADJUSTMENT' && (
                        <div className="w-full sm:w-48">
                          <select
                            value={line.locationId || internalLocations[0]?.id}
                            onChange={(e) => {
                              const updated = [...docLines];
                              updated[idx].locationId = e.target.value;
                              setDocLines(updated);
                            }}
                            className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                            required
                          >
                            {internalLocations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Quantity Input with Available Indicator */}
                      <div className="w-full sm:w-36 flex items-center gap-1.5">
                        <div className="relative w-full">
                          <Input
                            type="number"
                            min="1"
                            max={newDocType === 'DELIVERY' && avail !== null ? avail : undefined}
                            placeholder="Qty"
                            value={line.qty}
                            disabled={isZero}
                            onChange={(e) => {
                              const updated = [...docLines];
                              updated[idx].qty = parseInt(e.target.value, 10) || 1;
                              setDocLines(updated);
                            }}
                            className={`h-9 text-xs font-mono ${isZero ? 'opacity-50' : ''}`}
                            required
                          />
                        </div>

                        {docLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLine(idx)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Delivery Availability Warning */}
                      {newDocType === 'DELIVERY' && avail !== null && (
                        <div className="w-full sm:w-auto text-[10px] font-mono whitespace-nowrap">
                          {isZero ? (
                            <span className="text-rose-400 font-semibold">Available: 0 (Disabled)</span>
                          ) : (
                            <span className="text-emerald-400">Available: {avail}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsNewDocOpen(false)}
                disabled={createSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createSubmitting}
                className="bg-[#714B67] hover:bg-[#5f3d56] text-white"
              >
                Create Document
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OperationsPage;
