import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/reorders/drafts
 *
 * For every product whose total on-hand stock (sum across INTERNAL locations)
 * is below its safetyStock, auto-generate a DRAFT RECEIPT document from the
 * product's default supplier (first Partner of type SUPPLIER), or a generic
 * vendor location if none exists.
 *
 * Returns the list of generated (or already existing pending) DRAFT receipts.
 */
router.get(
  '/drafts',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Find all products below safety stock (aggregate stock_levels)
      const belowSafety = await prisma.$queryRaw<
        Array<{ productId: string; totalQty: number; safetyStock: number; reorderQty: number; sku: string; name: string; categoryId: string }>
      >`
        SELECT
          p.id AS "productId",
          p.sku,
          p.name,
          p."safetyStock",
          p."reorderQty",
          p."categoryId",
          COALESCE(SUM(sl.qty), 0)::float AS "totalQty"
        FROM products p
        LEFT JOIN stock_levels sl ON sl."productId" = p.id
        LEFT JOIN locations l ON sl."locationId" = l.id AND l.type = 'INTERNAL'
        GROUP BY p.id
        HAVING COALESCE(SUM(sl.qty), 0) < p."safetyStock"
      `;

      if (belowSafety.length === 0) {
        res.json({ message: 'No products below safety stock', drafts: [] });
        return;
      }

      // 2. Get the first supplier partner (default)
      const defaultSupplier = await prisma.partner.findFirst({
        where: { type: 'SUPPLIER' },
      });

      // 3. Get or resolve the VENDOR virtual location
      const vendorLoc = await prisma.location.findFirst({ where: { type: 'VENDOR' } });
      if (!vendorLoc) {
        res.status(500).json({ errors: { system: 'No VENDOR location configured' } });
        return;
      }

      // 4. Find a default INTERNAL location (first warehouse's first internal location)
      const defaultInternalLoc = await prisma.location.findFirst({
        where: { type: 'INTERNAL' },
        include: { warehouse: true },
      });
      if (!defaultInternalLoc) {
        res.status(500).json({ errors: { system: 'No INTERNAL location configured' } });
        return;
      }

      // 5. Get manager user for creating docs
      const managerUser = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
      if (!managerUser) {
        res.status(500).json({ errors: { system: 'No manager user found' } });
        return;
      }

      const drafts = [];
      const year = new Date().getFullYear();

      for (const product of belowSafety) {
        // Check if there's already a pending DRAFT RECEIPT for this product
        const existing = await prisma.document.findFirst({
          where: {
            type: 'RECEIPT',
            status: { in: ['DRAFT', 'WAITING', 'READY'] },
            lines: { some: { productId: product.productId } },
          },
          include: { lines: { include: { product: true } }, partner: true },
        });

        if (existing) {
          drafts.push({ ...existing, _note: 'existing_pending', product });
          continue;
        }

        // Count existing docs this year for doc number
        const count = await prisma.document.count({
          where: {
            type: 'RECEIPT',
            createdAt: {
              gte: new Date(`${year}-01-01T00:00:00.000Z`),
              lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
            },
          },
        });
        const docNumber = `REC-${year}-${String(count + 1).padStart(4, '0')}`;

        const reorderQty = product.reorderQty > 0 ? product.reorderQty : product.safetyStock * 2;

        const draft = await prisma.document.create({
          data: {
            docNumber,
            type: 'RECEIPT',
            status: 'DRAFT',
            sourceLocationId: vendorLoc.id,
            destLocationId: defaultInternalLoc.id,
            partnerId: defaultSupplier?.id,
            createdById: managerUser.id,
            lines: {
              create: [{ productId: product.productId, qty: reorderQty, pickedQty: 0 }],
            },
          },
          include: {
            lines: { include: { product: true } },
            sourceLocation: true,
            destLocation: { include: { warehouse: true } },
            partner: true,
          },
        });

        drafts.push({ ...draft, _note: 'auto_generated', product });
      }

      res.json({
        count: drafts.length,
        belowSafetyCount: belowSafety.length,
        drafts,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ── Schemas for Reorder Rules ─────────────────────────────────────────────────
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const reorderRuleSchema = z.object({
  productId: z.string().uuid(),
  minQty: z.number().min(0),
  reorderQty: z.number().min(0),
});

// ── GET /reorders/rules ───────────────────────────────────────────────────────
router.get('/rules', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rules = await prisma.reorderRule.findMany({
      include: {
        product: { select: { id: true, sku: true, name: true, uom: true, safetyStock: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (e) {
    next(e);
  }
});

// ── POST /reorders/rules ──────────────────────────────────────────────────────
router.post(
  '/rules',
  requireAuth,
  requireRole('MANAGER'),
  validate(reorderRuleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as z.infer<typeof reorderRuleSchema>;
      const rule = await prisma.reorderRule.create({
        data,
        include: { product: true },
      });
      // Optionally sync with product's safetyStock and reorderQty
      await prisma.product.update({
        where: { id: data.productId },
        data: { safetyStock: Math.round(data.minQty), reorderQty: Math.round(data.reorderQty) },
      });
      res.status(201).json(rule);
    } catch (e) {
      next(e);
    }
  }
);

// ── PUT /reorders/rules/:id ───────────────────────────────────────────────────
router.put(
  '/rules/:id',
  requireAuth,
  requireRole('MANAGER'),
  validate(reorderRuleSchema.partial()),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const rule = await prisma.reorderRule.update({
        where: { id },
        data: req.body,
        include: { product: true },
      });
      if (req.body.minQty !== undefined || req.body.reorderQty !== undefined) {
        await prisma.product.update({
          where: { id: rule.productId },
          data: {
            ...(req.body.minQty !== undefined ? { safetyStock: Math.round(req.body.minQty) } : {}),
            ...(req.body.reorderQty !== undefined ? { reorderQty: Math.round(req.body.reorderQty) } : {}),
          },
        });
      }
      res.json(rule);
    } catch (e) {
      next(e);
    }
  }
);

// ── DELETE /reorders/rules/:id ────────────────────────────────────────────────
router.delete(
  '/rules/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await prisma.reorderRule.delete({ where: { id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
