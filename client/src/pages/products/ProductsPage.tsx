import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  QrCode,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Layers,
  Warehouse as WarehouseIcon,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/Sheet';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

// ── Zod Schema matching backend validation ──────────────────────────────────
const productFormSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU too long'),
  name: z.string().min(1, 'Product name is required').max(100, 'Name too long'),
  uom: z.string().min(1, 'Unit of measure is required'),
  categoryId: z.string().uuid('Please select a valid category'),
  safetyStock: z.coerce.number().min(0, 'Safety stock must be 0 or positive'),
  reorderQty: z.coerce.number().min(0, 'Reorder quantity must be 0 or positive'),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export const ProductsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isManager = user?.role === 'MANAGER';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'>('ALL');

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    uom: 'Units',
    categoryId: '',
    safetyStock: 10,
    reorderQty: 20,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Detail Drawer state
  const [selectedProductForDrawer, setSelectedProductForDrawer] = useState<any | null>(null);
  const [drawerStockData, setDrawerStockData] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // QR Label Modal state
  const [selectedProductForQR, setSelectedProductForQR] = useState<any | null>(null);

  // Delete Confirm Modal state
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, levelsRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/categories'),
        api.get('/stock/levels?limit=300'),
      ]);
      setProducts(prodRes.data?.data || []);
      setCategories(catRes.data || []);
      setStockLevels(levelsRes.data?.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load products data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute on-hand total and per-location breakdown
  const getProductStockInfo = (productId: string) => {
    const levels = stockLevels.filter((sl) => sl.productId === productId && sl.qty > 0);
    const totalOnHand = levels.reduce((sum, sl) => sum + (sl.qty || 0), 0);
    return { totalOnHand, locations: levels };
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      uom: 'Units',
      categoryId: categories[0]?.id || '',
      safetyStock: 10,
      reorderQty: 20,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (prod: any) => {
    setEditingProduct(prod);
    setFormData({
      sku: prod.sku,
      name: prod.name,
      uom: prod.uom || 'Units',
      categoryId: prod.categoryId,
      safetyStock: prod.safetyStock || 0,
      reorderQty: prod.reorderQty || 0,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Submit Add or Edit Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = productFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(fieldErrors);
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, result.data);
        toast.success(`Product ${result.data.sku} updated successfully`);
      } else {
        await api.post('/products', result.data);
        toast.success(`Product ${result.data.sku} created successfully`);
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setFormErrors(serverErrors);
        toast.error(serverErrors.sku || serverErrors.name || 'Validation failed');
      } else {
        toast.error(err.response?.data?.message || 'Failed to save product');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Detail Drawer
  const handleOpenDrawer = async (prod: any) => {
    setSelectedProductForDrawer(prod);
    setDrawerLoading(true);
    try {
      const res = await api.get(`/products/${prod.id}/stock-by-location`);
      setDrawerStockData(res.data);
    } catch (err) {
      toast.error('Failed to fetch stock-by-location details');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/products/${productToDelete.id}`);
      toast.success(`Product ${productToDelete.sku} deleted`);
      setProductToDelete(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.product || 'Cannot delete product with existing stock movements');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory ? p.categoryId === selectedCategory : true;

    const { totalOnHand } = getProductStockInfo(p.id);
    let matchesStatus = true;
    if (statusFilter === 'IN_STOCK') {
      matchesStatus = totalOnHand >= p.safetyStock && totalOnHand > 0;
    } else if (statusFilter === 'LOW') {
      matchesStatus = totalOnHand < p.safetyStock && totalOnHand > 0;
    } else if (statusFilter === 'OUT') {
      matchesStatus = totalOnHand === 0;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Package className="h-6 w-6 text-[#dfbed3]" />
            Products & Inventory Catalog
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Master catalog with real-time on-hand stock by location, safety stock thresholds, and barcode QR generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="text-xs h-9 bg-slate-900 border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isManager && (
            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="text-xs h-9 bg-[#714B67] hover:bg-[#5f3d56] text-white shadow-md shadow-[#714B67]/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* ── Main Catalog Card ─────────────────────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader className="p-5 pb-4 border-b border-slate-800/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by SKU, product name, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714B67]"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status Filter Pills */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                {(
                  [
                    { id: 'ALL', label: 'All' },
                    { id: 'IN_STOCK', label: 'In Stock' },
                    { id: 'LOW', label: 'Low Stock' },
                    { id: 'OUT', label: 'Out of Stock' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg transition-all font-medium ${
                      statusFilter === tab.id
                        ? 'bg-[#714B67] text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-28">SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Per-Location Stock</TableHead>
                <TableHead className="text-right">Total On Hand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#dfbed3]" />
                      <span>Loading products catalog...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                    <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No products found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Try adjusting your search criteria or add a new product.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((prod) => {
                  const { totalOnHand, locations } = getProductStockInfo(prod.id);
                  const isOut = totalOnHand === 0;
                  const isLow = totalOnHand > 0 && totalOnHand < prod.safetyStock;
                  const isInStock = totalOnHand >= prod.safetyStock && totalOnHand > 0;

                  return (
                    <TableRow key={prod.id} className="border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      {/* SKU Badge */}
                      <TableCell className="font-mono font-semibold text-white">
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] bg-slate-950/80 border-slate-700 text-[#e4bfe0]"
                        >
                          {prod.sku}
                        </Badge>
                      </TableCell>

                      {/* Product Name */}
                      <TableCell>
                        <div
                          className="font-medium text-slate-100 cursor-pointer hover:text-[#dfbed3] transition-colors"
                          onClick={() => handleOpenDrawer(prod)}
                        >
                          {prod.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Safety: {prod.safetyStock} | Reorder: {prod.reorderQty}
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <Badge variant="subtle" className="text-[10px]">
                          {prod.category?.name || 'General'}
                        </Badge>
                      </TableCell>

                      {/* UOM */}
                      <TableCell className="text-slate-300 text-xs font-mono">
                        {prod.uom}
                      </TableCell>

                      {/* Per-Location Stock Chips */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {locations.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic">No stock in bins</span>
                          ) : (
                            locations.slice(0, 3).map((sl) => (
                              <span
                                key={sl.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-mono"
                                title={`${sl.location?.warehouse?.name || 'WH'}: ${sl.location?.name}`}
                              >
                                <span className="text-slate-400 truncate max-w-[80px]">
                                  {sl.location?.name}
                                </span>
                                <span className="font-bold text-emerald-400">{sl.qty}</span>
                              </span>
                            ))
                          )}
                          {locations.length > 3 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{locations.length - 3} more
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Total On Hand */}
                      <TableCell className="text-right font-mono text-xs font-bold text-white">
                        {totalOnHand} <span className="text-slate-400 font-normal">{prod.uom}</span>
                      </TableCell>

                      {/* In Stock / Low / Out Pill */}
                      <TableCell>
                        {isOut ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 text-[10px] bg-rose-950/80 text-rose-300 border-rose-800/60"
                          >
                            <XCircle className="h-3 w-3" />
                            Out of Stock
                          </Badge>
                        ) : isLow ? (
                          <Badge
                            variant="ready"
                            className="gap-1 text-[10px] bg-amber-950/80 text-amber-300 border-amber-800/60"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="done"
                            className="gap-1 text-[10px] bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            In Stock
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                            title="View Stock Breakdown"
                            onClick={() => handleOpenDrawer(prod)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-[#dfbed3] hover:bg-slate-800"
                            title="QR Code Label"
                            onClick={() => setSelectedProductForQR(prod)}
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>

                          {isManager && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-blue-300 hover:bg-slate-800"
                                title="Edit Product"
                                onClick={() => handleOpenEdit(prod)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                                title="Delete Product"
                                onClick={() => setProductToDelete(prod)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Add / Edit Product Dialog (Zod Mirroring) ─────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[#dfbed3]" />
              {editingProduct ? `Edit Product: ${editingProduct.sku}` : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update catalog metadata and reorder safety thresholds.'
                : 'Define SKU, category, and minimum stock triggers for double-entry tracking.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            {/* SKU Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product SKU <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. SKU-1001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                disabled={!!editingProduct}
                className={`font-mono ${formErrors.sku ? 'border-rose-500 ring-1 ring-rose-500' : ''}`}
              />
              {formErrors.sku && <p className="text-[11px] text-rose-400 mt-1">{formErrors.sku}</p>}
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Name <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. 10mm Steel Bolt Grade 8.8"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={formErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : ''}
              />
              {formErrors.name && <p className="text-[11px] text-rose-400 mt-1">{formErrors.name}</p>}
            </div>

            {/* Category and UOM Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-100 focus:outline-none focus:border-[#714B67]"
                >
                  <option value="" disabled>
                    Select Category
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {formErrors.categoryId && (
                  <p className="text-[11px] text-rose-400 mt-1">{formErrors.categoryId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Unit of Measure <span className="text-rose-400">*</span>
                </label>
                <Input
                  placeholder="Units, kg, m, boxes..."
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  className={formErrors.uom ? 'border-rose-500 ring-1 ring-rose-500' : ''}
                />
                {formErrors.uom && <p className="text-[11px] text-rose-400 mt-1">{formErrors.uom}</p>}
              </div>
            </div>

            {/* Safety Stock & Reorder Qty */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Safety Stock (Min)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.safetyStock}
                  onChange={(e) =>
                    setFormData({ ...formData, safetyStock: parseInt(e.target.value, 10) || 0 })
                  }
                  className={formErrors.safetyStock ? 'border-rose-500 ring-1 ring-rose-500' : ''}
                />
                {formErrors.safetyStock && (
                  <p className="text-[11px] text-rose-400 mt-1">{formErrors.safetyStock}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Auto Reorder Qty
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.reorderQty}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderQty: parseInt(e.target.value, 10) || 0 })
                  }
                  className={formErrors.reorderQty ? 'border-rose-500 ring-1 ring-rose-500' : ''}
                />
                {formErrors.reorderQty && (
                  <p className="text-[11px] text-rose-400 mt-1">{formErrors.reorderQty}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsFormOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={formSubmitting}
                className="bg-[#714B67] hover:bg-[#5f3d56] text-white"
              >
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Drawer (Stock-by-location) ─────────────────────────────────── */}
      <Sheet
        open={!!selectedProductForDrawer}
        onOpenChange={(open) => !open && setSelectedProductForDrawer(null)}
      >
        <SheetContent side="right" className="sm:max-w-md flex flex-col justify-between">
          <div>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#dfbed3]" />
                Stock by Location
              </SheetTitle>
              <SheetDescription>
                Live balance breakdown across warehouse racks and zones.
              </SheetDescription>
            </SheetHeader>

            {selectedProductForDrawer && (
              <div className="space-y-4 py-4">
                {/* Product Summary Header Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="font-mono text-xs text-[#dfbed3]">
                        {selectedProductForDrawer.sku}
                      </Badge>
                      <h3 className="text-base font-bold text-white mt-1">
                        {selectedProductForDrawer.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Category: {selectedProductForDrawer.category?.name || 'General'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Total On Hand</span>
                      <span className="font-mono text-xl font-bold text-white">
                        {drawerStockData?.totalQty ?? '...'} {selectedProductForDrawer.uom}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-400">
                    <span>Safety Threshold: {selectedProductForDrawer.safetyStock} {selectedProductForDrawer.uom}</span>
                    <span>Reorder Target: {selectedProductForDrawer.reorderQty} {selectedProductForDrawer.uom}</span>
                  </div>
                </div>

                {/* Stock per Location List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Internal Storage Locations
                  </h4>

                  {drawerLoading ? (
                    <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#dfbed3]" />
                      <span className="text-xs">Fetching location balances...</span>
                    </div>
                  ) : !drawerStockData?.locations || drawerStockData.locations.length === 0 ? (
                    <div className="p-6 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
                      <WarehouseIcon className="h-6 w-6 mx-auto mb-1 text-slate-600" />
                      <p className="text-xs text-slate-400">Zero inventory currently recorded</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Create a Receipt in Operations to stock this product.
                      </p>
                    </div>
                  ) : (
                    drawerStockData.locations.map((sl: any) => (
                      <div
                        key={sl.id}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-white text-xs">
                              {sl.location?.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                            Warehouse: {sl.location?.warehouse?.name || 'Main Warehouse'} ({sl.location?.warehouse?.code || 'WH'})
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-emerald-400">
                            {sl.qty} {selectedProductForDrawer.uom}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedProductForDrawer(null)}
            >
              Close Drawer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Per-Product QR Label Modal (qrcode.react) ─────────────────────────── */}
      <Dialog
        open={!!selectedProductForQR}
        onOpenChange={(open) => !open && setSelectedProductForQR(null)}
      >
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800 text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-[#dfbed3]" />
              Barcode & QR Label
            </DialogTitle>
            <DialogDescription className="text-center">
              Physical bin or packaging label for warehouse scanner tracking.
            </DialogDescription>
          </DialogHeader>

          {selectedProductForQR && (
            <div className="space-y-4 py-2">
              {/* Printable Label Card */}
              <div
                id="printable-qr-label"
                className="p-5 rounded-2xl bg-white text-slate-950 border border-slate-200 shadow-lg flex flex-col items-center justify-center text-center space-y-3"
              >
                <div className="w-full border-b border-slate-200 pb-2">
                  <span className="text-[10px] tracking-widest uppercase font-bold text-slate-600 block">
                    StockSense Pro IMS
                  </span>
                  <h3 className="font-bold text-base text-slate-950 leading-tight">
                    {selectedProductForQR.name}
                  </h3>
                </div>

                <div className="p-3 bg-white rounded-xl shadow-inner border border-slate-100 flex items-center justify-center">
                  <QRCodeSVG
                    value={selectedProductForQR.sku}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="w-full pt-1">
                  <div className="font-mono font-bold text-sm tracking-widest text-slate-950 bg-slate-100 py-1 rounded">
                    {selectedProductForQR.sku}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 mt-2 font-mono">
                    <span>Category: {selectedProductForQR.category?.name || 'General'}</span>
                    <span>UOM: {selectedProductForQR.uom}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedProductForQR(null)}
                  className="w-full"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="w-full bg-[#714B67] hover:bg-[#5f3d56] text-white"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print Label
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────────── */}
      <Dialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Product
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete SKU <strong className="text-white font-mono">{productToDelete?.sku}</strong> ({productToDelete?.name})?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              variant="secondary"
              onClick={() => setProductToDelete(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteLoading}
              onClick={handleDeleteProduct}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsPage;
