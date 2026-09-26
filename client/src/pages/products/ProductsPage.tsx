import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, levelsRes] = await Promise.all([
        api.get('/products?limit=50'),
        api.get('/stock/levels?limit=100'),
      ]);
      setProducts(prodRes.data?.data || []);
      setStockLevels(levelsRes.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute on-hand quantity per product
  const getOnHandQty = (productId: string) => {
    const levels = stockLevels.filter((sl) => sl.productId === productId);
    return levels.reduce((sum, sl) => sum + (sl.qty || 0), 0);
  };

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-[#dfbed3]" />
            Products & Catalog
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Product master catalog with safety stock thresholds and real-time inventory balances.
          </p>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search products by SKU or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <span className="text-xs text-slate-400">
              Total: {filtered.length} products
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Safety Stock</TableHead>
                <TableHead>On Hand Total</TableHead>
                <TableHead>Stock Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading products catalog...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((prod) => {
                  const onHand = getOnHandQty(prod.id);
                  const isLow = onHand < prod.safetyStock;

                  return (
                    <TableRow key={prod.id}>
                      <TableCell className="font-mono text-xs font-semibold text-white">
                        {prod.sku}
                      </TableCell>
                      <TableCell className="font-medium text-slate-100">
                        {prod.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {prod.category?.name || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300 text-xs">
                        {prod.uom}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">
                        {prod.safetyStock} {prod.uom}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-white">
                        {onHand} {prod.uom}
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1 text-[11px]">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="done" className="gap-1 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Optimal
                          </Badge>
                        )}
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

export default ProductsPage;
