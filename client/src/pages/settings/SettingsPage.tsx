import React, { useState, useEffect } from 'react';
import {
  Settings,
  Warehouse as WarehouseIcon,
  MapPin,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  ShieldAlert,
  Layers,
  Sliders,
  AlertTriangle,
  FolderTree,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { z } from 'zod';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
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
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

type SettingsTab = 'WAREHOUSES' | 'LOCATIONS' | 'REORDERS';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isManager = user?.role === 'MANAGER';

  const [activeTab, setActiveTab] = useState<SettingsTab>('WAREHOUSES');

  // Master Data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [reorderRules, setReorderRules] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Warehouse Modal State
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '' });
  const [warehouseSubmitting, setWarehouseSubmitting] = useState(false);

  // Location Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    type: 'INTERNAL' as 'INTERNAL' | 'VENDOR' | 'CUSTOMER' | 'TRANSIT' | 'DAMAGE',
    warehouseId: '',
  });
  const [locationSubmitting, setLocationSubmitting] = useState(false);

  // Reorder Rule Modal State
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [editingReorderRule, setEditingReorderRule] = useState<any | null>(null);
  const [reorderForm, setReorderForm] = useState({
    productId: '',
    minQty: 10,
    reorderQty: 25,
  });
  const [reorderSubmitting, setReorderSubmitting] = useState(false);

  // Delete Confirm Modal
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'WAREHOUSE' | 'LOCATION' | 'REORDER';
    item: any;
  } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      const [whRes, locRes, rulesRes, prodRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/locations'),
        api.get('/reorders/rules').catch(() => ({ data: [] })),
        api.get('/products?limit=100'),
      ]);
      setWarehouses(whRes.data || []);
      setLocations(locRes.data || []);
      setReorderRules(rulesRes.data || []);
      setProducts(prodRes.data?.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isManager) {
      fetchAllSettings();
    }
  }, [isManager]);

  // ── Warehouse Handlers ──────────────────────────────────────────────────────
  const handleOpenAddWarehouse = () => {
    setEditingWarehouse(null);
    setWarehouseForm({ name: '', code: '' });
    setIsWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (wh: any) => {
    setEditingWarehouse(wh);
    setWarehouseForm({ name: wh.name, code: wh.code });
    setIsWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.name.trim() || !warehouseForm.code.trim()) {
      toast.error('Warehouse name and unique code are required');
      return;
    }

    setWarehouseSubmitting(true);
    try {
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, warehouseForm);
        toast.success(`Warehouse ${warehouseForm.name} updated`);
      } else {
        await api.post('/warehouses', warehouseForm);
        toast.success(`Warehouse ${warehouseForm.name} created`);
      }
      setIsWarehouseModalOpen(false);
      fetchAllSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.code || 'Failed to save warehouse');
    } finally {
      setWarehouseSubmitting(false);
    }
  };

  // ── Location Handlers ───────────────────────────────────────────────────────
  const handleOpenAddLocation = () => {
    setEditingLocation(null);
    setLocationForm({
      name: '',
      type: 'INTERNAL',
      warehouseId: warehouses[0]?.id || '',
    });
    setIsLocationModalOpen(true);
  };

  const handleOpenEditLocation = (loc: any) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name,
      type: loc.type,
      warehouseId: loc.warehouseId || '',
    });
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationForm.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    setLocationSubmitting(true);
    try {
      const payload = {
        name: locationForm.name,
        type: locationForm.type,
        warehouseId: locationForm.type === 'INTERNAL' ? locationForm.warehouseId || null : null,
      };

      if (editingLocation) {
        await api.put(`/locations/${editingLocation.id}`, payload);
        toast.success(`Location ${locationForm.name} updated`);
      } else {
        await api.post('/locations', payload);
        toast.success(`Location ${locationForm.name} created`);
      }
      setIsLocationModalOpen(false);
      fetchAllSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save location');
    } finally {
      setLocationSubmitting(false);
    }
  };

  // ── Reorder Rule Handlers ───────────────────────────────────────────────────
  const handleOpenAddReorderRule = () => {
    setEditingReorderRule(null);
    setReorderForm({
      productId: products[0]?.id || '',
      minQty: 10,
      reorderQty: 25,
    });
    setIsReorderModalOpen(true);
  };

  const handleOpenEditReorderRule = (rule: any) => {
    setEditingReorderRule(rule);
    setReorderForm({
      productId: rule.productId,
      minQty: rule.minQty,
      reorderQty: rule.reorderQty,
    });
    setIsReorderModalOpen(true);
  };

  const handleSaveReorderRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reorderForm.productId) {
      toast.error('Please select a product');
      return;
    }

    setReorderSubmitting(true);
    try {
      if (editingReorderRule) {
        await api.put(`/reorders/rules/${editingReorderRule.id}`, reorderForm);
        toast.success('Reorder rule updated');
      } else {
        await api.post('/reorders/rules', reorderForm);
        toast.success('Reorder rule created');
      }
      setIsReorderModalOpen(false);
      fetchAllSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save reorder rule');
    } finally {
      setReorderSubmitting(false);
    }
  };

  // ── Delete Handler ──────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleteSubmitting(true);
    try {
      if (itemToDelete.type === 'WAREHOUSE') {
        await api.delete(`/warehouses/${itemToDelete.item.id}`);
        toast.success(`Warehouse deleted`);
      } else if (itemToDelete.type === 'LOCATION') {
        await api.delete(`/locations/${itemToDelete.item.id}`);
        toast.success(`Location deleted`);
      } else if (itemToDelete.type === 'REORDER') {
        await api.delete(`/reorders/rules/${itemToDelete.item.id}`);
        toast.success(`Reorder rule deleted`);
      }
      setItemToDelete(null);
      fetchAllSettings();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.errors?.location ||
        err.response?.data?.errors?.warehouse ||
        err.response?.data?.message ||
        'Delete failed: Item is referenced by existing stock or documents';
      toast.error(errMsg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Staff Role Guard (Requirement: Hide manager-only UI from STAFF) ──────────
  if (!isManager) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="border-rose-900/60 bg-rose-950/20 backdrop-blur-sm text-center p-8">
          <ShieldAlert className="h-12 w-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">Manager Access Required</h2>
          <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto">
            You are logged in with <strong className="text-white">STAFF</strong> role permissions. Master data
            configuration (warehouses, location topologies, and safety reorder rules) is restricted to Managers.
          </p>
          <div className="mt-6">
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/dashboard')}
              className="text-xs border-slate-700 hover:bg-slate-800"
            >
              Return to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-[#dfbed3]" />
            Warehouse Topologies & Master Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure multi-warehouse hierarchies, internal and virtual location bins, and automated safety stock reorder rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllSettings}
            className="text-xs h-9 bg-slate-900 border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'WAREHOUSES', label: `Warehouses (${warehouses.length})`, icon: WarehouseIcon },
            { id: 'LOCATIONS', label: `Locations & Bins (${locations.length})`, icon: MapPin },
            { id: 'REORDERS', label: `Reorder Rules (${reorderRules.length})`, icon: Sliders },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#714B67] text-white shadow-md shadow-[#714B67]/25'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: Warehouses CRUD ────────────────────────────────────────────── */}
      {activeTab === 'WAREHOUSES' && (
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-slate-800/80">
            <div>
              <CardTitle className="text-base text-white">Warehouses Master</CardTitle>
              <CardDescription>Enterprise warehouse facilities</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleOpenAddWarehouse}
              className="text-xs h-9 bg-[#714B67] hover:bg-[#5f3d56] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Warehouse
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead>Code</TableHead>
                  <TableHead>Warehouse Name</TableHead>
                  <TableHead>Locations Count</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh) => (
                  <TableRow key={wh.id} className="border-slate-800/60">
                    <TableCell className="font-mono font-bold text-xs text-[#dfbed3]">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {wh.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-white text-xs">{wh.name}</TableCell>
                    <TableCell className="text-slate-300 text-xs font-mono">
                      {wh._count?.locations ??
                        locations.filter((l) => l.warehouseId === wh.id).length}{' '}
                      location(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditWarehouse(wh)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-300"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItemToDelete({ type: 'WAREHOUSE', item: wh })}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 2: Locations CRUD ─────────────────────────────────────────────── */}
      {activeTab === 'LOCATIONS' && (
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-slate-800/80">
            <div>
              <CardTitle className="text-base text-white">Locations & Racks Master</CardTitle>
              <CardDescription>Internal physical zones, shelves, and virtual counterpart locations</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleOpenAddLocation}
              className="text-xs h-9 bg-[#714B67] hover:bg-[#5f3d56] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Location
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead>Location Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id} className="border-slate-800/60">
                    <TableCell className="font-semibold text-white text-xs">
                      {loc.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          loc.type === 'INTERNAL'
                            ? 'text-emerald-300 border-emerald-800/60 bg-emerald-950/40'
                            : loc.type === 'VENDOR'
                            ? 'text-blue-300 border-blue-800/60 bg-blue-950/40'
                            : loc.type === 'CUSTOMER'
                            ? 'text-purple-300 border-purple-800/60 bg-purple-950/40'
                            : 'text-amber-300 border-amber-800/60 bg-amber-950/40'
                        }`}
                      >
                        {loc.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {loc.warehouse?.name ? (
                        <span className="font-medium text-white">
                          {loc.warehouse.name} ({loc.warehouse.code})
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Virtual System Location</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditLocation(loc)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-300"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItemToDelete({ type: 'LOCATION', item: loc })}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 3: Reorder Rules CRUD ─────────────────────────────────────────── */}
      {activeTab === 'REORDERS' && (
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-slate-800/80">
            <div>
              <CardTitle className="text-base text-white">Automated Reorder Rules</CardTitle>
              <CardDescription>
                Replenishment triggers: auto-generate draft POs when inventory drops below safety minimum
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleOpenAddReorderRule}
              className="text-xs h-9 bg-[#714B67] hover:bg-[#5f3d56] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Reorder Rule
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead>Product SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Min Safety Threshold</TableHead>
                  <TableHead className="text-right">Auto Reorder Quantity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reorderRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                      No automated reorder rules defined yet. Add one to activate automatic PO drafts.
                    </TableCell>
                  </TableRow>
                ) : (
                  reorderRules.map((rule) => (
                    <TableRow key={rule.id} className="border-slate-800/60">
                      <TableCell className="font-mono font-bold text-xs text-[#dfbed3]">
                        {rule.product?.sku}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-white">
                        {rule.product?.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-amber-400">
                        {rule.minQty} {rule.product?.uom}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                        {rule.reorderQty} {rule.product?.uom}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditReorderRule(rule)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-300"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setItemToDelete({ type: 'REORDER', item: rule })}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Warehouse Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isWarehouseModalOpen} onOpenChange={setIsWarehouseModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WarehouseIcon className="h-5 w-5 text-[#dfbed3]" />
              {editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
            </DialogTitle>
            <DialogDescription>Define facility code and warehouse name.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWarehouse} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Warehouse Code (e.g. WH1) <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. WH1"
                value={warehouseForm.code}
                onChange={(e) =>
                  setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })
                }
                className="font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Warehouse Name <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. Central Distribution Hub"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsWarehouseModalOpen(false)}
                disabled={warehouseSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={warehouseSubmitting}
                className="bg-[#714B67] hover:bg-[#5f3d56] text-white"
              >
                {editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Location Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#dfbed3]" />
              {editingLocation ? 'Edit Location' : 'Add Location'}
            </DialogTitle>
            <DialogDescription>Configure storage shelf, bay, or virtual location counterpart.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLocation} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Location Name / Shelf <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. Stock Shelf A-01"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Location Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={locationForm.type}
                onChange={(e) =>
                  setLocationForm({
                    ...locationForm,
                    type: e.target.value as any,
                  })
                }
                className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
              >
                <option value="INTERNAL">INTERNAL (Warehouse Storage Shelf/Bay)</option>
                <option value="VENDOR">VENDOR (External Supplier Counterpart)</option>
                <option value="CUSTOMER">CUSTOMER (External Customer Counterpart)</option>
                <option value="TRANSIT">TRANSIT (Inter-warehouse In-Transit)</option>
                <option value="DAMAGE">DAMAGE (Inventory Loss / Scrap Counterpart)</option>
              </select>
            </div>

            {locationForm.type === 'INTERNAL' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Warehouse <span className="text-rose-400">*</span>
                </label>
                <select
                  value={locationForm.warehouseId}
                  onChange={(e) => setLocationForm({ ...locationForm, warehouseId: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                  required
                >
                  <option value="" disabled>
                    Select Warehouse
                  </option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsLocationModalOpen(false)}
                disabled={locationSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={locationSubmitting}
                className="bg-[#714B67] hover:bg-[#5f3d56] text-white"
              >
                {editingLocation ? 'Save Changes' : 'Create Location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reorder Rule Dialog ───────────────────────────────────────────────── */}
      <Dialog open={isReorderModalOpen} onOpenChange={setIsReorderModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-[#dfbed3]" />
              {editingReorderRule ? 'Edit Reorder Rule' : 'New Reorder Rule'}
            </DialogTitle>
            <DialogDescription>Define safety stock threshold and PO draft quantity.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReorderRule} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product <span className="text-rose-400">*</span>
              </label>
              <select
                value={reorderForm.productId}
                onChange={(e) => setReorderForm({ ...reorderForm, productId: e.target.value })}
                className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                disabled={!!editingReorderRule}
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Min Safety Stock <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={reorderForm.minQty}
                  onChange={(e) =>
                    setReorderForm({ ...reorderForm, minQty: parseFloat(e.target.value) || 0 })
                  }
                  className="font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reorder Batch Qty <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={reorderForm.reorderQty}
                  onChange={(e) =>
                    setReorderForm({ ...reorderForm, reorderQty: parseFloat(e.target.value) || 0 })
                  }
                  className="font-mono text-xs"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsReorderModalOpen(false)}
                disabled={reorderSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={reorderSubmitting}
                className="bg-[#714B67] hover:bg-[#5f3d56] text-white"
              >
                {editingReorderRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-white">
                {itemToDelete?.item?.name || itemToDelete?.item?.code || itemToDelete?.item?.product?.sku}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              variant="secondary"
              onClick={() => setItemToDelete(null)}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteSubmitting}
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
