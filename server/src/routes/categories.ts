import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────
const createCategorySchema = z.object({
  name: z.string().min(1),
});

// ── GET /categories ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (e) {
    next(e);
  }
});

// ── GET /categories/:id ───────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!category) {
      res.status(404).json({ errors: { category: 'Not found' } });
      return;
    }
    res.json(category);
  } catch (e) {
    next(e);
  }
});

// ── POST /categories ──────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  validate(createCategorySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name } = req.body as z.infer<typeof createCategorySchema>;
      const category = await prisma.category.create({ data: { name } });
      res.status(201).json(category);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        res.status(409).json({ errors: { name: 'Category name already exists' } });
        return;
      }
      next(e);
    }
  }
);

// ── PUT /categories/:id ───────────────────────────────────────────────────────
router.put(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  validate(createCategorySchema.partial()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const category = await prisma.category.update({
        where: { id },
        data: req.body,
      });
      res.json(category);
    } catch (e) {
      next(e);
    }
  }
);

// ── DELETE /categories/:id ────────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await prisma.category.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
