import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { DocType, DocStatus } from '@prisma/client';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const movesQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  refType: z.enum(['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const levelsQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  belowSafety: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const kpiQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});

// ── GET /stock/moves — immutable ledger ────────────────────────────────────────

router.get(
  '/moves',
  requireAuth,
  validate(movesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, locationId, warehouseId, refType, from, to, page, limit } =
        req.query as unknown as z.infer<typeof movesQuerySchema>;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (productId) where['productId'] = productId;
      if (refType) where['refType'] = refType;
      if (from || to) {
        where['createdAt'] = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }
      if (locationId) {
        where['OR'] = [{ fromLocationId: locationId }, { toLocationId: locationId }];
      }
      if (warehouseId) {
        where['OR'] = [
          { fromLocation: { warehouseId } },
          { toLocation: { warehouseId } },
        ];
      }

      const [moves, total] = await Promise.all([
        prisma.stockMove.findMany({
          where,
          include: {
            product: { select: { id: true, sku: true, name: true, uom: true } },
            fromLocation: { include: { warehouse: { select: { name: true, code: true } } } },
            toLocation: { include: { warehouse: { select: { name: true, code: true } } } },
            document: { select: { id: true, docNumber: true, type: true, status: true } },
            performedBy: { select: { id: true, name: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.stockMove.count({ where }),
      ]);

      res.json({ data: moves, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (e) {
      next(e);
    }
  }
);

// ── GET /stock/levels — on-hand balances per product/location ─────────────────

router.get(
  '/levels',
  requireAuth,
  validate(levelsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { warehouseId, productId, belowSafety, page, limit } =
        req.query as unknown as z.infer<typeof levelsQuerySchema>;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (productId) where['productId'] = productId;
      if (warehouseId) where['location'] = { warehouseId };
      if (belowSafety) {
        // qty < product.safetyStock — we handle in post-filter since prisma can't compare cross-relations
        // Alternatively we use a raw query; for simplicity we over-fetch and filter
      }

      const [levels, total] = await Promise.all([
        prisma.stockLevel.findMany({
          where,
          include: {
            product: {
              select: { id: true, sku: true, name: true, uom: true, safetyStock: true, category: { select: { name: true } } },
            },
            location: {
              include: { warehouse: { select: { id: true, name: true, code: true } } },
            },
          },
          skip,
          take: limit,
          orderBy: [{ product: { name: 'asc' } }, { location: { name: 'asc' } }],
        }),
        prisma.stockLevel.count({ where }),
      ]);

      const filtered = belowSafety
        ? levels.filter((sl) => sl.qty < sl.product.safetyStock)
        : levels;

      res.json({
        data: filtered,
        meta: { total: belowSafety ? filtered.length : total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (e) {
      next(e);
    }
  }
);

// ── GET /stock/kpis — dashboard KPIs ─────────────────────────────────────────

router.get(
  '/kpis',
  requireAuth,
  validate(kpiQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { warehouseId, categoryId } = req.query as unknown as z.infer<typeof kpiQuerySchema>;

      // Build warehouse filter for documents
      const docWarehouseFilter = warehouseId
        ? {
            OR: [
              { sourceLocation: { warehouseId } },
              { destLocation: { warehouseId } },
            ],
          }
        : {};

      // Build category filter for products
      const productCategoryFilter = categoryId ? { categoryId } : {};

      const [
        totalProducts,
        lowStockRows,
        pendingReceipts,
        pendingDeliveries,
        transfersScheduled,
      ] = await Promise.all([
        // 1. Total active products (optionally filtered by category)
        prisma.product.count({ where: productCategoryFilter }),

        // 2. Low stock: count distinct products below safety stock at any INTERNAL location
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT sl."productId") AS count
          FROM stock_levels sl
          JOIN products p ON sl."productId" = p.id
          JOIN locations l ON sl."locationId" = l.id
          WHERE sl.qty < p."safetyStock"
            AND l.type = 'INTERNAL'
        `,

        // 3. Pending receipts (DRAFT | WAITING | READY)
        prisma.document.count({
          where: {
            type: 'RECEIPT' as DocType,
            status: { in: ['DRAFT', 'WAITING', 'READY'] as DocStatus[] },
            ...docWarehouseFilter,
          },
        }),

        // 4. Pending deliveries
        prisma.document.count({
          where: {
            type: 'DELIVERY' as DocType,
            status: { in: ['DRAFT', 'WAITING', 'READY'] as DocStatus[] },
            ...docWarehouseFilter,
          },
        }),

        // 5. Transfers scheduled (not yet DONE/CANCELED)
        prisma.document.count({
          where: {
            type: 'TRANSFER' as DocType,
            status: { in: ['DRAFT', 'WAITING', 'READY'] as DocStatus[] },
            ...docWarehouseFilter,
          },
        }),
      ]);

      res.json({
        totalProducts,
        lowStockCount: Number(lowStockRows[0]?.count ?? 0),
        pendingReceipts,
        pendingDeliveries,
        transfersScheduled,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
