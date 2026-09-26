import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight, ArrowLeft, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import api from '@/lib/api';
import { toast } from 'sonner';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus the first empty digit or first digit on load
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleOtpChange = (index: number, val: string) => {
    // Allow only single digits or pasted strings
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const copy = [...otpDigits];
      copy[index] = '';
      setOtpDigits(copy);
      return;
    }

    if (cleaned.length > 1) {
      // Pasted multiple digits
      handleOtpPaste(cleaned);
      return;
    }

    const copy = [...otpDigits];
    copy[index] = cleaned[0];
    setOtpDigits(copy);

    // Auto-advance to next input box
    if (index < 5 && cleaned[0]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (pastedText: string) => {
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('');
    const copy = [...otpDigits];
    digits.forEach((d, idx) => {
      copy[idx] = d;
    });
    setOtpDigits(copy);
    const nextIdx = Math.min(digits.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setErrors({ otp: 'Please enter all 6 digits of the OTP' });
      return;
    }

    if (newPassword.length < 8) {
      setErrors({ newPassword: 'Password must be at least 8 characters long' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        email,
        otp,
        newPassword,
      });

      toast.success(res.data?.message || 'Password reset successfully! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ form: err.response?.data?.message || 'Failed to reset password. Check OTP or try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#714B67]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#714B67] to-[#9c638d] items-center justify-center text-white shadow-xl shadow-[#714B67]/40 ring-1 ring-white/20 mb-3">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Verification & Reset</h1>
          <p className="text-xs text-slate-400 mt-1">Enter the 6-digit OTP code and choose a new password</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xl">Set New Password</CardTitle>
            <CardDescription>
              Check your server logs or inbox for the 6-digit verification code.
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
                <label className="text-xs font-medium text-slate-300">Email Address</label>
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

              {/* 6-box OTP with Auto-Advance */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">6-Digit Verification Code</label>
                  <span className="text-[10px] text-slate-500 font-mono">Auto-advance active</span>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={(e) => {
                        e.preventDefault();
                        handleOtpPaste(e.clipboardData.getData('text'));
                      }}
                      className={`h-12 w-full text-center text-lg font-bold font-mono rounded-xl border bg-slate-900/90 text-white transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-[#714B67] ${
                        errors.otp
                          ? 'border-rose-500/80 bg-rose-950/20 text-rose-300'
                          : digit
                          ? 'border-[#714B67] bg-[#714B67]/10'
                          : 'border-slate-800'
                      }`}
                    />
                  ))}
                </div>

                {errors.otp && (
                  <p className="text-xs text-rose-400 font-medium px-1 flex items-center gap-1 mt-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-rose-400" />
                    {errors.otp}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">New Password (min 8 chars)</label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.newPassword}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.confirmPassword}
                  required
                />
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-sm font-semibold rounded-xl mt-2"
              >
                Reset Password & Continue
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

export default ResetPasswordPage;
