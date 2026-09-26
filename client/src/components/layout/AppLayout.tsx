import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  History,
  QrCode,
  Settings,
  Search,
  Bell,
  LogOut,
  User as UserIcon,
  Warehouse as WarehouseIcon,
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
  ShoppingCart,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { joinWarehouseRoom, subscribeToSocket } from '@/lib/socket';
import api from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const isManager = user?.role === 'MANAGER';
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [reorderDrafts, setReorderDrafts] = useState<any[]>([]);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Fetch low stock info & reorder drafts for the notification bell
  const fetchLowStockInfo = async () => {
    try {
      const [kpiRes, levelsRes, draftsRes] = await Promise.all([
        api.get('/dashboard/kpis').catch(() => ({ data: {} })),
        api.get('/stock/levels?belowSafety=true&limit=20').catch(() => ({ data: {} })),
        api.get('/reorders/drafts').catch(() => ({ data: { drafts: [] } })),
      ]);

      if (kpiRes.data?.lowStockCount !== undefined) {
        setLowStockCount(kpiRes.data.lowStockCount);
      }
      if (levelsRes.data?.data) {
        setLowStockItems(levelsRes.data.data);
      }
      if (draftsRes.data?.drafts) {
        setReorderDrafts(draftsRes.data.drafts);
      }
    } catch (err) {
      console.warn('Error fetching low stock info for bell:', err);
    }
  };

  useEffect(() => {
    fetchLowStockInfo();

    if (user?.warehouseId) {
      joinWarehouseRoom(user.warehouseId);
    }

    const unsubStatus = subscribeToSocket('document:validated', fetchLowStockInfo);
    const unsubStock = subscribeToSocket('stock:updated', fetchLowStockInfo);
    const unsubAlert = subscribeToSocket('alert:low-stock', fetchLowStockInfo);
    const unsubCreated = subscribeToSocket('document:created', fetchLowStockInfo);

    return () => {
      unsubStatus();
      unsubStock();
      unsubAlert();
      unsubCreated();
    };
  }, [user?.warehouseId]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Operations', path: '/operations', icon: ArrowLeftRight },
    { name: 'Move History', path: '/history', icon: History },
    { name: 'Scan', path: '/scan', icon: QrCode },
    ...(isManager ? [{ name: 'Settings', path: '/settings', icon: Settings }] : []),
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleReviewDraft = (draft: any) => {
    setIsLowStockModalOpen(false);
    navigate(`/operations?docId=${draft.id}&docNumber=${draft.docNumber}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ── Left Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar-responsive w-64 flex-shrink-0 flex flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        {/* Brand / Logo */}
        <div className="sidebar-brand h-16 flex items-center gap-3 px-6 border-b border-slate-800/80">
          <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-tr from-[#714B67] to-[#9c638d] flex items-center justify-center text-white shadow-md shadow-[#714B67]/30 ring-1 ring-white/20">
            <WarehouseIcon className="h-5 w-5" />
          </div>
          <div className="sidebar-brand-text">
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">StockSense</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#714B67]/30 text-[#e4bfe0] border border-[#714B67]/50">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight">Double-Entry IMS</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="sidebar-section-label px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive: active }) =>
                  `sidebar-nav-link flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-[#714B67] text-white shadow-md shadow-[#714B67]/25 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="sidebar-label">{item.name}</span>
                {item.name === 'Dashboard' && lowStockCount > 0 && (
                  <span className="sidebar-label ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {lowStockCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom User Info & Role indicator */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/90">
          <div
            onClick={() => navigate('/profile')}
            className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-[#714B67]/30 border border-[#714B67]/50 flex items-center justify-center text-[#dfbed3] font-bold text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="sidebar-user-info truncate">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <Badge
              variant={user?.role === 'MANAGER' ? 'default' : 'secondary'}
              className="sidebar-user-info text-[10px] py-0 px-1.5 uppercase font-mono tracking-wider ml-1"
            >
              {user?.role || 'STAFF'}
            </Badge>
          </div>
        </div>
      </aside>

      {/* ── Main Layout Column ────────────────────────────────────────────────── */}
      <div className="main-content-responsive flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md z-30">
          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-80 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Global search (docs, SKU, product)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-800 bg-slate-950/60 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#714B67] focus:ring-1 focus:ring-[#714B67] transition-all"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
              ↵
            </kbd>
          </form>

          {/* Right Controls: Low Stock Bell & Profile Dropdown */}
          <div className="flex items-center gap-3">
            {/* Low-stock Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  fetchLowStockInfo();
                  setIsLowStockModalOpen(true);
                }}
                className="relative p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
                title={
                  lowStockCount > 0
                    ? `${lowStockCount} items below safety stock`
                    : 'No low stock alerts'
                }
              >
                <Bell className="h-5 w-5" />
                {lowStockCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 ring-2 ring-slate-950 animate-bounce">
                    {lowStockCount}
                  </span>
                )}
              </button>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-2 pr-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800/80 transition-all text-left"
              >
                <div className="h-7 w-7 rounded-lg bg-[#714B67] flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'M'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-200 leading-none">
                    {user?.name || 'Account'}
                  </p>
                  <span className="text-[10px] text-slate-400 leading-tight capitalize">
                    {user?.role?.toLowerCase() || 'staff'}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
              </button>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-800 mb-1">
                      <p className="text-xs font-semibold text-white">{user?.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                      <div className="mt-1.5">
                        <Badge variant="subtle" className="text-[10px]">
                          {user?.role} Permissions
                        </Badge>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                    >
                      <UserIcon className="h-4 w-4 text-slate-400" />
                      <span>My Profile</span>
                    </button>

                    {isManager && (
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-slate-400" />
                        <span>Settings & Master Data</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors mt-1"
                    >
                      <LogOut className="h-4 w-4 text-rose-400" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>

      {/* ── Low Stock & Auto-Draft PO Modal (from Bell) ────────────────────────── */}
      <Dialog open={isLowStockModalOpen} onOpenChange={setIsLowStockModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Low Stock Alerts & Auto-Draft POs ({lowStockCount})
            </DialogTitle>
            <DialogDescription>
              Inventory items below safety stock thresholds with auto-generated replenishment purchase orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Auto-Drafted POs Section */}
            {reorderDrafts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#dfbed3] uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Auto-Drafted Replenishment POs ({reorderDrafts.length})
                </h4>
                <div className="space-y-2">
                  {reorderDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="p-3 rounded-xl border border-[#714B67]/40 bg-[#714B67]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {draft.docNumber}
                          </span>
                          <Badge variant="draft" className="text-[10px]">
                            DRAFT RECEIPT
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Product: <span className="font-mono text-amber-300">{draft.lines?.[0]?.product?.sku}</span> &bull;{' '}
                          Reorder Target: <strong className="text-white">{draft.lines?.[0]?.qty} {draft.lines?.[0]?.product?.uom}</strong>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Supplier: {draft.partner?.name || 'Default Supplier'} &rarr; Dest: {draft.destLocation?.name || 'Main Stock'}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleReviewDraft(draft)}
                        className="text-xs h-8 bg-[#714B67] hover:bg-[#5f3d56] text-white self-start sm:self-auto shrink-0 shadow-sm"
                      >
                        Review Auto-Drafted PO
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock Items List */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Products Below Safety Minimum
              </h4>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-950/60 rounded-xl border border-slate-800">
                  All inventory balances currently exceed safety stock levels.
                </p>
              ) : (
                lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-amber-300">
                          {item.product?.sku}
                        </span>
                        <span className="text-xs text-white font-medium">
                          {item.product?.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Warehouse: {item.location?.warehouse?.name || 'Main Warehouse'} &bull; Bin:{' '}
                        {item.location?.name || 'Internal'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-rose-400">
                        {item.qty} {item.product?.uom}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Safety Min: {item.product?.safetyStock}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLowStockModalOpen(false);
                navigate('/products');
              }}
            >
              Catalog View
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsLowStockModalOpen(false)}>
              Dismiss
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
