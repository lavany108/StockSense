import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Warehouse, Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import api from '@/lib/api';
import { toast } from 'sonner';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      toast.success(res.data?.message || 'OTP reset code dispatched to your email.');
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ form: err.response?.data?.message || 'Failed to dispatch reset code.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#714B67]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#714B67] to-[#9c638d] items-center justify-center text-white shadow-xl shadow-[#714B67]/40 ring-1 ring-white/20 mb-3">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="text-xs text-slate-400 mt-1">
            Request a 6-digit cryptographic verification code
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xl">Forgot Password?</CardTitle>
            <CardDescription>
              Enter your registered warehouse email address to receive a single-use 6-digit OTP (valid 10 minutes).
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4 space-y-4">
            {errors.form && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {errors.form}
              </div>
            )}

            {errors.otp && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {errors.otp}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Registered Email</label>
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

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-sm font-semibold rounded-xl mt-2"
              >
                Send 6-Digit OTP Code
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="p-6 pt-0 flex justify-center border-t border-slate-800/60 mt-2 pt-4">
            <Link
              to="/login"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
