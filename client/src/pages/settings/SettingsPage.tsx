import React, { useState, useEffect } from 'react';
import { Settings, Warehouse, FolderTree, Shield, Check } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.get('/warehouses'), api.get('/categories')]).then(([wh, cat]) => {
      setWarehouses(wh.data || []);
      setCategories(cat.data || []);
    });
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="h-6 w-6 text-[#dfbed3]" />
          System Settings & Master Data
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review warehouse topologies, product category taxonomies, and permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Warehouses Card */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-[#dfbed3]" />
              Active Warehouses
            </CardTitle>
            <CardDescription>Multi-warehouse segmentation</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-xs">{wh.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {wh.code}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {wh._count?.locations || 0} configured location(s)
                  </p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Categories Card */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-[#dfbed3]" />
              Product Categories
            </CardTitle>
            <CardDescription>Catalog taxonomy structure</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-white text-xs">{cat.name}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {cat._count?.products || 0} product(s) linked
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
