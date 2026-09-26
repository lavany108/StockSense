import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Warehouse, Mail, Lock, User, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { toast } from 'sonner';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const loginToStore = useAuthStore((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STAFF' | 'MANAGER'>('STAFF');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters long' });
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/signup', { name, email, password, role });
      loginToStore(res.data);
      toast.success(`Account created successfully! Welcome to StockSense, ${res.data.name}.`);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ form: err.response?.data?.message || 'Failed to create account. Please check your inputs.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#714B67]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#714B67] to-[#9c638d] items-center justify-center text-white shadow-xl shadow-[#714B67]/40 ring-1 ring-white/20 mb-3">
            <Warehouse className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            StockSense <span className="text-xs uppercase px-2 py-0.5 rounded bg-[#714B67]/30 text-[#e4bfe0] border border-[#714B67]/50 font-mono">PRO</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Create your operator or manager profile</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xl">Create Account</CardTitle>
            <CardDescription>
              Join the warehouse team and start tracking double-entry stock moves.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4 space-y-4">
            {errors.form && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Full Name</label>
                <Input
                  type="text"
                  placeholder="Alex Mercer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={<User className="h-4 w-4" />}
                  error={errors.name}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Work Email</label>
                <Input
                  type="email"
                  placeholder="alex@stocksense.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Password (min 8 characters)</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Role & Responsibility</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('STAFF')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      role === 'STAFF'
                        ? 'border-[#714B67] bg-[#714B67]/20 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Warehouse className="h-4 w-4 text-[#dfbed3]" />
                    <div>
                      <p className="text-xs font-semibold">Floor Staff</p>
                      <p className="text-[10px] text-slate-400">Picks, packs & receives</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('MANAGER')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      role === 'MANAGER'
                        ? 'border-[#714B67] bg-[#714B67]/20 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Shield className="h-4 w-4 text-[#dfbed3]" />
                    <div>
                      <p className="text-xs font-semibold">Manager</p>
                      <p className="text-[10px] text-slate-400">Cancels, audits & sets data</p>
                    </div>
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-sm font-semibold rounded-xl mt-2"
              >
                Complete Registration
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="p-6 pt-0 flex justify-center border-t border-slate-800/60 mt-2 pt-4">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="text-[#dfbed3] font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
