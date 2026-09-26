import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['MANAGER', 'STAFF']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

// ── Helper ────────────────────────────────────────────────────────────────────
function setAuthCookie(res: Response, userId: string, email: string, role: string): void {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '24h') as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;
  const token = jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET as string,
    { expiresIn }
  );
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('stocksense_token', token, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 24 * 60 * 60 * 1000,
  });
}

// ── POST /signup ──────────────────────────────────────────────────────────────
router.post(
  '/signup',
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password, role } = req.body as z.infer<typeof signupSchema>;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ errors: { email: 'Email already registered' } });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role: role || 'STAFF' },
      });

      setAuthCookie(res, user.id, user.email, user.role);
      res.status(201).json({ id: user.id, email: user.email, role: user.role, name: user.name });
    } catch (e) {
      next(e);
    }
  }
);

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ errors: { credentials: 'Invalid email or password' } });
        return;
      }

      setAuthCookie(res, user.id, user.email, user.role);
      res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
    } catch (e) {
      next(e);
    }
  }
);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      if (!user) {
        res.status(404).json({ errors: { user: 'Not found' } });
        return;
      }
      res.json(user);
    } catch (e) {
      next(e);
    }
  }
);

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('stocksense_token');
  res.json({ message: 'Logged out' });
});

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  validate(forgotSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body as z.infer<typeof forgotSchema>;

      // Max 5 attempts in 10 minutes
      const windowStart = new Date(Date.now() - 10 * 60 * 1000);
      const recentCount = await prisma.otpToken.count({
        where: { email, createdAt: { gte: windowStart } },
      });
      if (recentCount >= 5) {
        res.status(429).json({ errors: { otp: 'Too many OTP requests. Try again in 10 minutes.' } });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      // Always respond the same way to avoid user enumeration
      if (user) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.otpToken.create({ data: { email, hashedOtp, expiresAt } });

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV OTP] email=${email} otp=${otp}`);
        }
      }

      res.json({ message: 'If that email exists, an OTP has been sent.' });
    } catch (e) {
      next(e);
    }
  }
);

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post(
  '/reset-password',
  validate(resetSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, otp, newPassword } = req.body as z.infer<typeof resetSchema>;

      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

      const token = await prisma.otpToken.findFirst({
        where: {
          email,
          hashedOtp,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!token) {
        res.status(400).json({ errors: { otp: 'Invalid, expired, or already used OTP' } });
        return;
      }

      // Mark as used (single-use enforcement)
      await prisma.otpToken.update({ where: { id: token.id }, data: { used: true } });

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { email }, data: { passwordHash } });

      res.json({ message: 'Password reset successfully' });
    } catch (e) {
      next(e);
    }
  }
);

// ── POST /change-password ─────────────────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) {
        res.status(404).json({ errors: { user: 'User not found' } });
        return;
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ errors: { currentPassword: 'Incorrect current password' } });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      res.json({ message: 'Password changed successfully' });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
