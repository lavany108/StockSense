import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────
const createPartnerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['SUPPLIER', 'CUSTOMER']),
});

// ── GET /partners ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const type = req.query['type'] as string | undefined;
    const partners = await prisma.partner.findMany({
      where: type ? { type: type as 'SUPPLIER' | 'CUSTOMER' } : {},
      orderBy: { name: 'asc' },
    });
    res.json(partners);
  } catch (e) {
    next(e);
  }
});

// ── GET /partners/:id ─────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    if (!partner) {
      res.status(404).json({ errors: { partner: 'Not found' } });
      return;
    }
    res.json(partner);
  } catch (e) {
    next(e);
  }
});

// ── POST /partners ────────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  validate(createPartnerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as z.infer<typeof createPartnerSchema>;
      const partner = await prisma.partner.create({ data });
      res.status(201).json(partner);
    } catch (e) {
      next(e);
    }
  }
);

// ── PUT /partners/:id ─────────────────────────────────────────────────────────
router.put(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  validate(createPartnerSchema.partial()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const partner = await prisma.partner.update({
        where: { id },
        data: req.body,
      });
      res.json(partner);
    } catch (e) {
      next(e);
    }
  }
);

// ── DELETE /partners/:id ──────────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await prisma.partner.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
