import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Search, CheckCircle2, XCircle, ArrowRight, Clock, Plus } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export const OperationsPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');

      const res = await api.get(`/documents?${params.toString()}`);
      setDocuments(res.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [typeFilter, statusFilter]);

  const handleValidate = async (id: string, docNumber: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/documents/${id}/validate`);
      toast.success(`Operation ${docNumber} validated and committed to ledger!`);
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.document || 'Validation failed. Check document status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdvanceStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'DRAFT' ? 'WAITING' : currentStatus === 'WAITING' ? 'READY' : null;
    if (!nextStatus) return;

    setActionLoadingId(id);
    try {
      await api.patch(`/documents/${id}/status`, { status: nextStatus });
      toast.success(`Document transitioned to ${nextStatus}`);
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.status || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-[#dfbed3]" />
            Warehouse Operations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage Receipts, Deliveries, Internal Transfers, and Cycle Adjustments.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {['', 'RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === t
                ? 'bg-[#714B67] text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t || 'All Operations'}
          </button>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">Document Pipeline</CardTitle>
          <CardDescription>
            Strict document lifecycle: DRAFT &rarr; WAITING &rarr; READY &rarr; DONE
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Location Flow</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">State Machine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Loading operations...
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No documents found.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
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
                      {doc.partner?.name || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {doc.sourceLocation?.name || 'VENDOR'} &rarr; {doc.destLocation?.name || 'CUSTOMER'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {doc.lines?.length || 0} line(s)
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {doc.status === 'READY' ? (
                        <Button
                          size="sm"
                          loading={actionLoadingId === doc.id}
                          onClick={() => handleValidate(doc.id, doc.docNumber)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Validate &rarr; DONE
                        </Button>
                      ) : doc.status === 'DRAFT' || doc.status === 'WAITING' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={actionLoadingId === doc.id}
                          onClick={() => handleAdvanceStatus(doc.id, doc.status)}
                          className="h-8 text-xs text-slate-300 hover:text-white"
                        >
                          Advance &rarr; {doc.status === 'DRAFT' ? 'WAITING' : 'READY'}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">Terminal ({doc.status})</span>
                      )}
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

export default OperationsPage;
