import React, { useState, useEffect } from 'react';
import { History, Search, ArrowRight, RefreshCw, FileText } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { formatDate } from '@/lib/utils';

export const MovesPage: React.FC = () => {
  const [moves, setMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMoves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/moves?limit=100');
      setMoves(res.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoves();
  }, []);

  const filtered = moves.filter(
    (m) =>
      m.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      m.document?.docNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="h-6 w-6 text-[#dfbed3]" />
            Double-Entry Stock Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable audit log of all physical inventory movements between source and destination locations.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMoves}
          className="text-xs h-9 bg-slate-900 border-slate-800 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh Ledger
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search moves by SKU, item, or doc..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <span className="text-xs text-slate-400">
              Total moves: {filtered.length} entries
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference Doc</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product SKU & Name</TableHead>
                <TableHead>From Location</TableHead>
                <TableHead>To Location</TableHead>
                <TableHead>Quantity Moved</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Loading ledger...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No ledger move records found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs font-semibold text-white">
                      {m.document?.docNumber || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {m.refType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-slate-200">
                        {m.product?.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {m.product?.sku}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {m.fromLocation?.name || 'VENDOR'}
                      {m.fromLocation?.warehouse && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {m.fromLocation.warehouse.code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {m.toLocation?.name || 'CUSTOMER'}
                      {m.toLocation?.warehouse && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {m.toLocation.warehouse.code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-400">
                      +{m.qty} {m.product?.uom}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {m.performedBy?.name || 'System'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(m.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MovesPage;
