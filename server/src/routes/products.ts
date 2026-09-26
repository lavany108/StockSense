import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────
const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  uom: z.string().min(1),
  safetyStock: z.number().int().min(0).default(0),
  reorderQty: z.number().int().min(0).default(0),
  categoryId: z.string().uuid(),
});

const searchQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
});

// ── GET /products ─────────────────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  validate(searchQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, page, limit, categoryId } = req.query as unknown as z.infer<typeof searchQuerySchema>;
      const skip = (page - 1) * limit;

      const where = {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { sku: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(categoryId ? { categoryId } : {}),
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: { category: true },
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        data: products,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (e) {
      next(e);
    }
  }
);

// ── GET /products/:id ─────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      res.status(404).json({ errors: { product: 'Not found' } });
      return;
    }
    res.json(product);
  } catch (e) {
    next(e);
  }
});

// ── GET /products/:id/stock-by-location ───────────────────────────────────────
router.get('/:id/stock-by-location', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ errors: { product: 'Not found' } });
      return;
    }

    const stockLevels = await prisma.stockLevel.findMany({
      where: { productId: id },
      include: {
        location: {
          include: { warehouse: { select: { name: true, code: true } } },
        },
      },
      orderBy: { location: { name: 'asc' } },
    });

    const totalQty = stockLevels.reduce((sum, sl) => sum + sl.qty, 0);

    res.json({
      product: { id: product.id, sku: product.sku, name: product.name, safetyStock: product.safetyStock },
      totalQty,
      belowSafetyStock: totalQty < product.safetyStock,
      locations: stockLevels,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /products ────────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  validate(createProductSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as z.infer<typeof createProductSchema>;
      const product = await prisma.product.create({
        data,
        include: { category: true },
      });
      res.status(201).json(product);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        res.status(409).json({ errors: { sku: 'SKU already exists' } });
        return;
      }
      next(e);
    }
  }
);

// ── PUT /products/:id ─────────────────────────────────────────────────────────
router.put(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  validate(createProductSchema.partial()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const product = await prisma.product.update({
        where: { id },
        data: req.body,
        include: { category: true },
      });
      res.json(product);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        res.status(409).json({ errors: { sku: 'SKU already exists' } });
        return;
      }
      next(e);
    }
  }
);

// ── DELETE /products/:id ──────────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await prisma.product.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
