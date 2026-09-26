import React, { useState } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Building,
  Mail,
  Calendar,
} from 'lucide-react';
import { z } from 'zod';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<ChangePasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = changePasswordSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setFormErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success('Your password has been changed successfully!');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.errors?.currentPassword ||
        err.response?.data?.errors?.newPassword ||
        err.response?.data?.message ||
        'Failed to change password. Please check your current password.';
      setFormErrors({ currentPassword: errMsg });
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <UserIcon className="h-6 w-6 text-[#dfbed3]" />
          My Profile & Account Security
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your StockSense Pro user credentials, role permissions, and session credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── User Profile Information Card ─────────────────────────────────── */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <ShieldCheck className="h-4 w-4 text-[#dfbed3]" />
              Account Details
            </CardTitle>
            <CardDescription>Verified session identity</CardDescription>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="h-12 w-12 rounded-xl bg-[#714B67] flex items-center justify-center text-white font-bold text-xl shadow-inner">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{user?.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3 w-3 text-slate-500" />
                  {user?.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={user?.role === 'MANAGER' ? 'default' : 'secondary'}>
                    {user?.role} ROLE
                  </Badge>
                  {user?.warehouseId && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      WH: {user.warehouseId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs space-y-2.5 text-slate-400 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                  User ID
                </span>
                <span className="font-mono text-slate-200 text-[11px]">{user?.id}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                  Role Capabilities
                </span>
                <span className="text-emerald-400 font-medium">
                  {user?.role === 'MANAGER'
                    ? 'Full Master CRUD + Doc Validation/Cancellation'
                    : 'Floor Operations & Document Execution'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  Auth Mechanism
                </span>
                <span className="text-slate-200 font-mono text-[11px]">
                  httpOnly Cookie (JWT)
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Account Created
                </span>
                <span className="text-slate-200 font-mono text-[11px]">
                  {formatDate(user?.createdAt || new Date().toISOString())}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Change Password Form Card ─────────────────────────────────────── */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <KeyRound className="h-4 w-4 text-[#dfbed3]" />
              Change Password
            </CardTitle>
            <CardDescription>Update your login credentials securely</CardDescription>
          </CardHeader>

          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="p-5 pt-0 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Current Password <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className={formErrors.currentPassword ? 'border-rose-500 ring-1 ring-rose-500' : ''}
                />
                {formErrors.currentPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">{formErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password (min 8 characters) <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className={formErrors.newPassword ? 'border-rose-500 ring-1 ring-rose-500' : ''}
                />
                {formErrors.newPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">{formErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={formErrors.confirmPassword ? 'border-rose-500 ring-1 ring-rose-500' : ''}
                />
                {formErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">{formErrors.confirmPassword}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-5 pt-2 flex justify-end">
              <Button
                type="submit"
                loading={submitting}
                className="bg-[#714B67] hover:bg-[#5f3d56] text-white w-full sm:w-auto text-xs h-9 shadow-md shadow-[#714B67]/20"
              >
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                Update Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
