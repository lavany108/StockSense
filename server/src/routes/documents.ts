import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { emitToWarehouse } from '../lib/socket';
import { DocType, DocStatus, LocationType, AdjustmentReason } from '@prisma/client';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive(),
  // For ADJUSTMENT: location is per-line
  locationId: z.string().min(1).optional(),
});

const createDocSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('RECEIPT'),
    sourceLocationId: z.string().min(1).optional(), // auto-resolved to VENDOR if omitted
    destLocationId: z.string().min(1),              // must be INTERNAL
    partnerId: z.string().min(1).optional(),
    scheduledDate: z.string().datetime().optional(),
    lines: z.array(lineSchema).min(1),
  }),
  z.object({
    type: z.literal('DELIVERY'),
    sourceLocationId: z.string().min(1),            // must be INTERNAL
    destLocationId: z.string().min(1).optional(),   // auto-resolved to CUSTOMER if omitted
    partnerId: z.string().min(1).optional(),
    scheduledDate: z.string().datetime().optional(),
    lines: z.array(lineSchema).min(1),
  }),
  z.object({
    type: z.literal('TRANSFER'),
    sourceLocationId: z.string().min(1),            // must be INTERNAL
    destLocationId: z.string().min(1),              // must be INTERNAL, must differ
    scheduledDate: z.string().datetime().optional(),
    lines: z.array(lineSchema).min(1),
  }),
  z.object({
    type: z.literal('ADJUSTMENT'),
    reasonCode: z.enum(['DAMAGED', 'EXPIRED', 'LOST_THEFT', 'INVENTORY_COUNT_CORRECTION', 'FOUND_STOCK']),
    reasonNote: z.string().min(1),
    scheduledDate: z.string().datetime().optional(),
    lines: z.array(
      z.object({
        productId: z.string().min(1),
        qty: z.number(), // can be negative for loss
        locationId: z.string().min(1), // required for adjustments
      })
    ).min(1),
  }),
]);

const listQuerySchema = z.object({
  type: z.enum(['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT']).optional(),
  status: z.enum(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED']).optional(),
  warehouseId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get or find the singleton virtual location of a given type */
async function getVirtualLocation(type: LocationType) {
  const loc = await prisma.location.findFirst({ where: { type } });
  if (!loc) throw new Error(`No ${type} location configured in the system`);
  return loc;
}

/** Generate doc number: PREFIX-YEAR-NNNN */
async function genDocNumber(type: DocType): Promise<string> {
  const prefixes: Record<DocType, string> = {
    RECEIPT: 'REC', DELIVERY: 'DEL', TRANSFER: 'TRF', ADJUSTMENT: 'ADJ',
  };
  const year = new Date().getFullYear();
  const count = await prisma.document.count({
    where: {
      type,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    },
  });
  return `${prefixes[type]}-${year}-${String(count + 1).padStart(4, '0')}`;
}

// ── GET /documents ────────────────────────────────────────────────────────────

router.get(
  '/',
  requireAuth,
  validate(listQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type, status, warehouseId, search, page, limit } =
        req.query as unknown as z.infer<typeof listQuerySchema>;
      const skip = (page - 1) * limit;

      const where = {
        ...(type ? { type: type as DocType } : {}),
        ...(status ? { status: status as DocStatus } : {}),
        ...(warehouseId
          ? {
              OR: [
                { sourceLocation: { warehouseId } },
                { destLocation: { warehouseId } },
              ],
            }
          : {}),
        ...(search
          ? {
              OR: [
                { docNumber: { contains: search, mode: 'insensitive' as const } },
                { partner: { name: { contains: search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            partner: true,
            sourceLocation: { include: { warehouse: true } },
            destLocation: { include: { warehouse: true } },
            lines: { include: { product: { select: { id: true, sku: true, name: true, uom: true } } } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.count({ where }),
      ]);

      res.json({ data: documents, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (e) {
      next(e);
    }
  }
);

// ── GET /documents/:id ────────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        partner: true,
        sourceLocation: { include: { warehouse: true } },
        destLocation: { include: { warehouse: true } },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, uom: true, safetyStock: true },
            },
          },
        },
        stockMoves: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    });
    if (!doc) { res.status(404).json({ errors: { document: 'Not found' } }); return; }
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

// ── POST /documents ───────────────────────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  validate(createDocSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createDocSchema>;
      const userId = req.user!.userId;

      let sourceLocationId: string;
      let destLocationId: string;

      // ── Resolve locations ─────────────────────────────────────────────────
      if (body.type === 'RECEIPT') {
        // source = VENDOR (auto), dest = must be INTERNAL
        const vendorLoc = body.sourceLocationId
          ? await prisma.location.findUniqueOrThrow({ where: { id: body.sourceLocationId } })
          : await getVirtualLocation('VENDOR');
        const destLoc = await prisma.location.findUniqueOrThrow({ where: { id: body.destLocationId } });
        if (destLoc.type !== 'INTERNAL') {
          res.status(400).json({ errors: { destLocationId: 'Destination must be an INTERNAL location' } });
          return;
        }
        sourceLocationId = vendorLoc.id;
        destLocationId = destLoc.id;
      } else if (body.type === 'DELIVERY') {
        // source = must be INTERNAL, dest = CUSTOMER (auto)
        const srcLoc = await prisma.location.findUniqueOrThrow({ where: { id: body.sourceLocationId } });
        if (srcLoc.type !== 'INTERNAL') {
          res.status(400).json({ errors: { sourceLocationId: 'Source must be an INTERNAL location' } });
          return;
        }
        const customerLoc = body.destLocationId
          ? await prisma.location.findUniqueOrThrow({ where: { id: body.destLocationId } })
          : await getVirtualLocation('CUSTOMER');
        sourceLocationId = srcLoc.id;
        destLocationId = customerLoc.id;
      } else if (body.type === 'TRANSFER') {
        const srcLoc = await prisma.location.findUniqueOrThrow({ where: { id: body.sourceLocationId } });
        const dstLoc = await prisma.location.findUniqueOrThrow({ where: { id: body.destLocationId } });
        if (srcLoc.type !== 'INTERNAL' || dstLoc.type !== 'INTERNAL') {
          res.status(400).json({ errors: { location: 'Both locations must be INTERNAL for a transfer' } });
          return;
        }
        if (srcLoc.id === dstLoc.id) {
          res.status(400).json({ errors: { location: 'Source and destination locations must differ' } });
          return;
        }
        sourceLocationId = srcLoc.id;
        destLocationId = dstLoc.id;
      } else {
        // ADJUSTMENT
        const lossLoc = await getVirtualLocation('DAMAGE');
        const lineLocId = body.type === 'ADJUSTMENT' ? body.lines[0].locationId : undefined;
        if (!lineLocId) {
          res.status(400).json({ errors: { locationId: 'Adjustment line requires locationId' } });
          return;
        }
        sourceLocationId = lineLocId;
        destLocationId = lossLoc.id;
      }

      const docNumber = await genDocNumber(body.type);

      // Determine the warehouse from the internal location
      const internalLocId = body.type === 'RECEIPT' ? destLocationId :
                            body.type === 'DELIVERY' ? sourceLocationId :
                            body.type === 'TRANSFER' ? sourceLocationId :
                            null;

      // For ADJUSTMENT lines, find location from first line
      let warehouseId: string | null = null;
      if (internalLocId) {
        const loc = await prisma.location.findUnique({ where: { id: internalLocId } });
        warehouseId = loc?.warehouseId ?? null;
      } else if (body.type === 'ADJUSTMENT' && body.lines[0]?.locationId) {
        const loc = await prisma.location.findUnique({ where: { id: body.lines[0].locationId } });
        warehouseId = loc?.warehouseId ?? null;
      }

      const doc = await prisma.document.create({
        data: {
          docNumber,
          type: body.type,
          status: 'DRAFT',
          sourceLocationId,
          destLocationId,
          ...(body.type !== 'TRANSFER' && body.type !== 'ADJUSTMENT' && body.partnerId
            ? { partnerId: body.partnerId }
            : {}),
          ...(body.type === 'ADJUSTMENT'
            ? { reasonCode: body.reasonCode as AdjustmentReason, reasonNote: body.reasonNote }
            : {}),
          scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
          createdById: userId,
          lines: {
            create: body.lines.map((line) => ({
              productId: line.productId,
              qty: Math.abs(line.qty),
              pickedQty: 0,
            })),
          },
        },
        include: {
          lines: { include: { product: true } },
          sourceLocation: { include: { warehouse: true } },
          destLocation: { include: { warehouse: true } },
          partner: true,
        },
      });

      // Emit socket event
      if (warehouseId) {
        emitToWarehouse(warehouseId, 'document:created', {
          id: doc.id,
          docNumber: doc.docNumber,
          type: doc.type,
          status: doc.status,
        });
      }

      res.status(201).json(doc);
    } catch (e) {
      next(e);
    }
  }
);

// ── PATCH /documents/:id/assign — DRAFT→WAITING or WAITING→READY ─────────────

router.patch(
  '/:id/assign',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log(`PATCH /documents/${req.params['id']}/assign START`);
      const id = req.params['id'] as string;
      const doc = await prisma.document.findUnique({
        where: { id },
        include: { sourceLocation: { include: { warehouse: true } }, destLocation: { include: { warehouse: true } } },
      });
      if (!doc) { res.status(404).json({ errors: { document: 'Not found' } }); return; }

      const transitions: Record<string, DocStatus> = {
        DRAFT: 'WAITING',
        WAITING: 'READY',
      };

      const next_status = transitions[doc.status];
      if (!next_status) {
        res.status(409).json({ errors: { status: `Cannot advance from ${doc.status}` } });
        return;
      }

      const updated = await prisma.document.update({
        where: { id },
        data: { status: next_status },
      });

      const warehouseId = doc.sourceLocation?.warehouseId ?? doc.destLocation?.warehouseId;
      if (warehouseId) {
        emitToWarehouse(warehouseId, 'document:status_changed', {
          id: updated.id, docNumber: updated.docNumber, status: updated.status,
        });
      }

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// ── POST /documents/:id/validate — READY→DONE (atomic transaction) ────────────

router.post(
  '/:id/validate',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log(`POST /documents/${req.params['id']}/validate START`);
    const docId = req.params['id'] as string;
    const userId = req.user!.userId;

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // ── 1. Lock the document row ─────────────────────────────────────
          const [docRow] = await tx.$queryRaw<Array<{
            id: string; type: string; status: string;
            sourceLocationId: string | null; destLocationId: string | null;
            reasonCode: string | null; reasonNote: string | null;
          }>>`
            SELECT id, type, status, "sourceLocationId", "destLocationId", "reasonCode", "reasonNote"
            FROM documents
            WHERE id = ${docId}
            FOR UPDATE
          `;

          if (!docRow) throw Object.assign(new Error('Not found'), { httpStatus: 404 });
          if (docRow.status !== 'READY') {
            throw Object.assign(
              new Error(`Document must be in READY state to validate (current: ${docRow.status})`),
              { httpStatus: 409 }
            );
          }

          const docType = docRow.type as DocType;

          // ── 2. Fetch lines ───────────────────────────────────────────────
          const lines = await tx.documentLine.findMany({
            where: { documentId: docId },
            include: {
              product: { select: { id: true, sku: true, name: true, safetyStock: true } },
            },
          });

          if (lines.length === 0) throw Object.assign(new Error('Document has no lines'), { httpStatus: 400 });

          // ── 3. Check availability for DELIVERY (row-lock stock levels) ──
          if (docType === 'DELIVERY') {
            const srcLocId = docRow.sourceLocationId!;

            for (const line of lines) {
              // FOR UPDATE lock on the specific stock_level row
              const [stockRow] = await tx.$queryRaw<Array<{ qty: number }>>`
                SELECT qty FROM stock_levels
                WHERE "productId" = ${line.productId} AND "locationId" = ${srcLocId}
                FOR UPDATE
              `;
              const available = stockRow?.qty ?? 0;
              if (line.qty > available) {
                throw Object.assign(
                  new Error(
                    `Cannot deliver ${line.qty} of ${line.product.sku}, only ${available} available at source location`
                  ),
                  { httpStatus: 409, code: 'INSUFFICIENT_STOCK' }
                );
              }
            }
          }

          // For TRANSFER, also check availability
          if (docType === 'TRANSFER') {
            const srcLocId = docRow.sourceLocationId!;
            for (const line of lines) {
              const [stockRow] = await tx.$queryRaw<Array<{ qty: number }>>`
                SELECT qty FROM stock_levels
                WHERE "productId" = ${line.productId} AND "locationId" = ${srcLocId}
                FOR UPDATE
              `;
              const available = stockRow?.qty ?? 0;
              if (line.qty > available) {
                throw Object.assign(
                  new Error(
                    `Cannot transfer ${line.qty} of ${line.product.sku}, only ${available} available at source location`
                  ),
                  { httpStatus: 409, code: 'INSUFFICIENT_STOCK' }
                );
              }
            }
          }

          // ── 4. Create StockMoves + upsert StockLevels ────────────────────
          const stockMovesCreated = [];
          const lowStockAlerts: Array<{ productId: string; sku: string; name: string; qty: number; safetyStock: number; locationId: string }> = [];

          for (const line of lines) {
            let fromLocationId: string | null = null;
            let toLocationId: string | null = null;

            if (docType === 'RECEIPT') {
              fromLocationId = docRow.sourceLocationId;
              toLocationId = docRow.destLocationId;
            } else if (docType === 'DELIVERY') {
              fromLocationId = docRow.sourceLocationId;
              toLocationId = docRow.destLocationId;
            } else if (docType === 'TRANSFER') {
              fromLocationId = docRow.sourceLocationId;
              toLocationId = docRow.destLocationId;
            } else if (docType === 'ADJUSTMENT') {
              // Line-level location: use product's location for negative adjustments (loss)
              // We need location from the line — fetch from doc lines
              const fullLine = await tx.documentLine.findUnique({
                where: { id: line.id },
                // Note: locationId is not on DocumentLine model, we encode it differently
                // For ADJ, sourceLocation = the INTERNAL location, destLocation = DAMAGE
              });
              // For simplicity: ADJUSTMENT already stores sourceLocationId (internal) and destLocationId (damage)
              fromLocationId = docRow.sourceLocationId;
              toLocationId = docRow.destLocationId;
            }

            const move = await tx.stockMove.create({
              data: {
                productId: line.productId,
                fromLocationId,
                toLocationId,
                qty: line.qty,
                refType: docType,
                documentId: docId,
                performedById: userId,
              },
            });
            stockMovesCreated.push(move);

            // ── Upsert StockLevels ────────────────────────────────────────
            // Decrement from source (if INTERNAL)
            if (fromLocationId) {
              const fromLoc = await tx.location.findUnique({ where: { id: fromLocationId } });
              if (fromLoc?.type === 'INTERNAL') {
                const updated = await tx.stockLevel.upsert({
                  where: { productId_locationId: { productId: line.productId, locationId: fromLocationId } },
                  update: { qty: { decrement: line.qty } },
                  create: { productId: line.productId, locationId: fromLocationId, qty: -line.qty },
                });
                // Check low stock
                if (updated.qty < line.product.safetyStock) {
                  lowStockAlerts.push({
                    productId: line.productId,
                    sku: line.product.sku,
                    name: line.product.name,
                    qty: updated.qty,
                    safetyStock: line.product.safetyStock,
                    locationId: fromLocationId,
                  });
                }
              }
            }

            // Increment at destination (if INTERNAL)
            if (toLocationId) {
              const toLoc = await tx.location.findUnique({ where: { id: toLocationId } });
              if (toLoc?.type === 'INTERNAL') {
                const updated = await tx.stockLevel.upsert({
                  where: { productId_locationId: { productId: line.productId, locationId: toLocationId } },
                  update: { qty: { increment: line.qty } },
                  create: { productId: line.productId, locationId: toLocationId, qty: line.qty },
                });
                if (updated.qty < line.product.safetyStock) {
                  lowStockAlerts.push({
                    productId: line.productId,
                    sku: line.product.sku,
                    name: line.product.name,
                    qty: updated.qty,
                    safetyStock: line.product.safetyStock,
                    locationId: toLocationId,
                  });
                }
              }
            }
          }

          // ── 5. Mark document DONE ─────────────────────────────────────────
          const done = await tx.document.update({
            where: { id: docId },
            data: { status: 'DONE', validatedAt: new Date() },
            include: {
              sourceLocation: { include: { warehouse: true } },
              destLocation: { include: { warehouse: true } },
              lines: { include: { product: true } },
            },
          });

          return { doc: done, moves: stockMovesCreated, lowStockAlerts };
        },
        { timeout: 15000 }
      );

      // ── 6. Emit socket events (after tx commit) ───────────────────────────
      const warehouseId =
        result.doc.sourceLocation?.warehouseId ?? result.doc.destLocation?.warehouseId;

      if (warehouseId) {
        emitToWarehouse(warehouseId, 'document:validated', {
          id: result.doc.id,
          docNumber: result.doc.docNumber,
          type: result.doc.type,
          status: result.doc.status,
        });

        emitToWarehouse(warehouseId, 'stock:updated', {
          documentId: result.doc.id,
          moves: result.moves.length,
        });

        for (const alert of result.lowStockAlerts) {
          emitToWarehouse(warehouseId, 'alert:low-stock', alert);
        }
      }

      console.log(`POST /documents/${docId}/validate DONE`);
      res.json(result.doc);
    } catch (e: unknown) {
      console.error(`POST /documents/${req.params['id']}/validate ERROR:`, e);
      const err = e as Error & { httpStatus?: number; code?: string };
      if (err.httpStatus) {
        res.status(err.httpStatus).json({ errors: { validation: err.message } });
        return;
      }
      next(e);
    }
  }
);

// ── POST /documents/:id/cancel — MANAGER only, blocked if DONE ───────────────

router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const doc = await prisma.document.findUnique({
        where: { id },
        include: {
          sourceLocation: { include: { warehouse: true } },
          destLocation: { include: { warehouse: true } },
        },
      });
      if (!doc) { res.status(404).json({ errors: { document: 'Not found' } }); return; }
      if (doc.status === 'DONE') {
        res.status(409).json({ errors: { status: 'Cannot cancel a DONE document. Create a counter-adjustment instead.' } });
        return;
      }
      if (doc.status === 'CANCELED') {
        res.status(409).json({ errors: { status: 'Document is already canceled' } });
        return;
      }

      const updated = await prisma.document.update({
        where: { id },
        data: { status: 'CANCELED', canceledAt: new Date() },
      });

      const warehouseId = doc.sourceLocation?.warehouseId ?? doc.destLocation?.warehouseId;
      if (warehouseId) {
        emitToWarehouse(warehouseId, 'document:status_changed', {
          id: updated.id, docNumber: updated.docNumber, status: updated.status,
        });
      }

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
