import React, { useState, useEffect } from 'react';
import { QrCode, ScanLine, Search, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

export const ScanPage: React.FC = () => {
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async (codeToLookup: string) => {
    if (!codeToLookup.trim()) return;
    setLoading(true);
    setScannedResult(null);

    try {
      // Search products by SKU or barcode
      const res = await api.get(`/products?limit=10`);
      const match = res.data?.data?.find(
        (p: any) =>
          p.sku.toLowerCase() === codeToLookup.trim().toLowerCase() ||
          p.name.toLowerCase().includes(codeToLookup.trim().toLowerCase())
      );

      if (match) {
        // Fetch levels for this product
        const levelsRes = await api.get(`/stock/levels?productId=${match.id}`);
        setScannedResult({
          product: match,
          levels: levelsRes.data?.data || [],
        });
        toast.success(`Matched SKU: ${match.sku}`);
      } else {
        toast.error(`No inventory record found matching "${codeToLookup}"`);
      }
    } catch (e) {
      toast.error('Scan lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <QrCode className="h-6 w-6 text-[#dfbed3]" />
          Barcode & QR Code Scanner
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Instant product and bin location lookup using camera vision or wedge barcode inputs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scanner Viewfinder / Manual input */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-[#dfbed3]" />
              Barcode Input & Scan Simulation
            </CardTitle>
            <CardDescription>
              Scan with hardware scanner or enter SKU / barcode below.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-4">
            <div className="relative rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-8 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-2xl bg-[#714B67]/20 border border-[#714B67]/40 flex items-center justify-center text-[#dfbed3] mb-3 animate-pulse">
                <ScanLine className="h-8 w-8" />
              </div>
              <p className="text-xs font-semibold text-white">Scanner Active & Ready</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Aim scanner at product barcode or location label
              </p>

              {/* Quick Preset Buttons for testing */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {['SKU-0042', 'SKU-0101', 'SKU-0202'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setManualCode(preset);
                      handleLookup(preset);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-[#714B67] hover:text-white transition-all font-mono"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup(manualCode);
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Enter or scan SKU (e.g. SKU-0042)..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono text-xs"
              />
              <Button type="submit" loading={loading} className="px-4">
                <Search className="h-4 w-4 mr-1.5" />
                Find
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Scan Result Details */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Match Details</CardTitle>
            <CardDescription>Real-time location balances for scanned item</CardDescription>
          </CardHeader>

          <CardContent className="p-5 pt-0">
            {!scannedResult ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center p-6 border border-slate-800/80 rounded-xl">
                <QrCode className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-xs">No barcode scanned yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Click one of the SKU test buttons above to inspect live data.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs text-[#dfbed3] font-semibold">
                        {scannedResult.product.sku}
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        {scannedResult.product.name}
                      </h4>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {scannedResult.product.category?.name || 'General'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Safety Min</span>
                      <span className="font-mono text-sm font-semibold text-amber-400">
                        {scannedResult.product.safetyStock} {scannedResult.product.uom}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Location Balances
                  </h5>
                  {scannedResult.levels.length === 0 ? (
                    <p className="text-xs text-slate-500">No stock levels recorded.</p>
                  ) : (
                    scannedResult.levels.map((lvl: any) => (
                      <div
                        key={lvl.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-medium text-white">{lvl.location?.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {lvl.location?.warehouse?.name || 'Warehouse'}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-white">
                          {lvl.qty} {scannedResult.product.uom}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScanPage;
