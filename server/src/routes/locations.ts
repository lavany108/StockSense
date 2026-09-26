import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────
const createLocationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['INTERNAL', 'VENDOR', 'CUSTOMER', 'TRANSIT', 'DAMAGE']),
  warehouseId: z.string().uuid().optional().nullable(),
});

// ── GET /locations ────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouseId = req.query['warehouseId'] as string | undefined;
    const type = req.query['type'] as string | undefined;
    const locations = await prisma.location.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        ...(type ? { type: type as 'INTERNAL' | 'VENDOR' | 'CUSTOMER' | 'TRANSIT' | 'DAMAGE' } : {}),
      },
      include: { warehouse: { select: { name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch (e) {
    next(e);
  }
});

// ── GET /locations/:id ────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        warehouse: true,
        stockLevels: { include: { product: true } },
      },
    });
    if (!location) {
      res.status(404).json({ errors: { location: 'Not found' } });
      return;
    }
    res.json(location);
  } catch (e) {
    next(e);
  }
});

// ── POST /locations ───────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  validate(createLocationSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as z.infer<typeof createLocationSchema>;
      const location = await prisma.location.create({ data });
      res.status(201).json(location);
    } catch (e) {
      next(e);
    }
  }
);

// ── PUT /locations/:id ────────────────────────────────────────────────────────
router.put(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  validate(createLocationSchema.partial()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const location = await prisma.location.update({
        where: { id },
        data: req.body,
      });
      res.json(location);
    } catch (e) {
      next(e);
    }
  }
);

// ── DELETE /locations/:id (blocked if stock exists) ───────────────────────────
router.delete(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const stockExists = await prisma.stockLevel.findFirst({
        where: { locationId: id, qty: { gt: 0 } },
      });

      if (stockExists) {
        res.status(409).json({
          errors: { location: 'Cannot delete location with existing stock. Transfer stock first.' },
        });
        return;
      }

      await prisma.location.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
