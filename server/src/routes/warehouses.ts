import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────
const createWarehouseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

// ── GET /warehouses ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: { _count: { select: { locations: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(warehouses);
  } catch (e) {
    next(e);
  }
});

// ── GET /warehouses/:id ───────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: { locations: true },
    });
    if (!warehouse) {
      res.status(404).json({ errors: { warehouse: 'Not found' } });
      return;
    }
    res.json(warehouse);
  } catch (e) {
    next(e);
  }
});

// ── POST /warehouses ──────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  validate(createWarehouseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, code } = req.body as z.infer<typeof createWarehouseSchema>;
      const warehouse = await prisma.warehouse.create({ data: { name, code } });
      res.status(201).json(warehouse);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        res.status(409).json({ errors: { code: 'Warehouse code already exists' } });
        return;
      }
      next(e);
    }
  }
);

// ── PUT /warehouses/:id ───────────────────────────────────────────────────────
router.put(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  validate(createWarehouseSchema.partial()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const warehouse = await prisma.warehouse.update({
        where: { id },
        data: req.body,
      });
      res.json(warehouse);
    } catch (e) {
      next(e);
    }
  }
);

// ── DELETE /warehouses/:id ────────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await prisma.warehouse.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
