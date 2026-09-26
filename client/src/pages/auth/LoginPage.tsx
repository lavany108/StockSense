import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Warehouse, Mail, Lock, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { toast } from 'sonner';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const loginToStore = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFillDemoCreds = () => {
    setEmail('manager@stocksense.io');
    setPassword('Demo@123');
    setErrors({});
    toast.info('Demo Manager credentials filled');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      loginToStore(res.data);
      toast.success(`Welcome back, ${res.data.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ form: err.response?.data?.message || 'Authentication failed. Please check credentials.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#714B67]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#714B67] to-[#9c638d] items-center justify-center text-white shadow-xl shadow-[#714B67]/40 ring-1 ring-white/20 mb-3">
            <Warehouse className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            StockSense <span className="text-xs uppercase px-2 py-0.5 rounded bg-[#714B67]/30 text-[#e4bfe0] border border-[#714B67]/50 font-mono">PRO</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Double-Entry Warehouse Management System
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Enter your warehouse credentials to access your session.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4 space-y-4">
            {/* Quick Demo Credentials Assistant */}
            <div className="p-3 rounded-xl border border-[#714B67]/40 bg-[#714B67]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#dfbed3]" />
                <div className="text-xs">
                  <span className="font-semibold text-white">Demo Creds:</span>{' '}
                  <span className="text-slate-300 font-mono">manager@stocksense.io</span> /{' '}
                  <span className="text-slate-300 font-mono">Demo@123</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillDemoCreds}
                className="text-xs px-2.5 py-1 rounded-lg bg-[#714B67] text-white hover:bg-[#5f3d56] transition-colors font-medium shadow-sm"
              >
                Auto Fill
              </button>
            </div>

            {errors.form && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {errors.form}
              </div>
            )}

            {errors.credentials && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {errors.credentials}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Work Email</label>
                <Input
                  type="email"
                  placeholder="manager@stocksense.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email}
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#dfbed3] hover:text-white transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.password}
                  required
                />
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-sm font-semibold rounded-xl mt-2"
              >
                Sign In to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="p-6 pt-0 flex justify-center border-t border-slate-800/60 mt-2 pt-4">
            <p className="text-xs text-slate-400">
              Need a new warehouse account?{' '}
              <Link to="/signup" className="text-[#dfbed3] font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
