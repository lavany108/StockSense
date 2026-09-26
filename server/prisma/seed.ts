import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@123', 12);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@stocksense.io' },
    update: {},
    create: {
      name: 'Manager',
      email: 'manager@stocksense.io',
      passwordHash,
      role: 'MANAGER',
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@stocksense.io' },
    update: {},
    create: {
      name: 'Staff',
      email: 'staff@stocksense.io',
      passwordHash,
      role: 'STAFF',
    },
  });

  // ── Warehouses ─────────────────────────────────────────────────────────────
  const wh1 = await prisma.warehouse.upsert({
    where: { code: 'WH1' },
    update: {},
    create: { name: 'Main Warehouse', code: 'WH1' },
  });

  const wh2 = await prisma.warehouse.upsert({
    where: { code: 'WH2' },
    update: {},
    create: { name: 'Secondary Warehouse', code: 'WH2' },
  });

  // ── Locations ──────────────────────────────────────────────────────────────
  const mainStore = await prisma.location.upsert({
    where: { id: 'loc-main-store' },
    update: {},
    create: { id: 'loc-main-store', name: 'Main Store', type: 'INTERNAL', warehouseId: wh1.id },
  });

  const productionRack = await prisma.location.upsert({
    where: { id: 'loc-prod-rack' },
    update: {},
    create: { id: 'loc-prod-rack', name: 'Production Rack', type: 'INTERNAL', warehouseId: wh1.id },
  });

  const vendorLoc = await prisma.location.upsert({
    where: { id: 'loc-vendor' },
    update: {},
    create: { id: 'loc-vendor', name: 'VENDOR', type: 'VENDOR', warehouseId: null },
  });

  const customerLoc = await prisma.location.upsert({
    where: { id: 'loc-customer' },
    update: {},
    create: { id: 'loc-customer', name: 'CUSTOMER', type: 'CUSTOMER', warehouseId: null },
  });

  const damageLoc = await prisma.location.upsert({
    where: { id: 'loc-damage' },
    update: {},
    create: { id: 'loc-damage', name: 'DAMAGE', type: 'DAMAGE', warehouseId: null },
  });

  // ── Category ───────────────────────────────────────────────────────────────
  const rawMaterials = await prisma.category.upsert({
    where: { name: 'Raw Materials' },
    update: {},
    create: { name: 'Raw Materials' },
  });

  const furniture = await prisma.category.upsert({
    where: { name: 'Furniture' },
    update: {},
    create: { name: 'Furniture' },
  });

  const packaging = await prisma.category.upsert({
    where: { name: 'Packaging' },
    update: {},
    create: { name: 'Packaging' },
  });

  // ── Products ───────────────────────────────────────────────────────────────
  const steelRods = await prisma.product.upsert({
    where: { sku: 'SKU-0042' },
    update: {},
    create: {
      sku: 'SKU-0042',
      name: 'Steel Rods',
      uom: 'kg',
      safetyStock: 100,
      reorderQty: 200,
      categoryId: rawMaterials.id,
    },
  });

  const officeChairs = await prisma.product.upsert({
    where: { sku: 'SKU-0101' },
    update: {},
    create: {
      sku: 'SKU-0101',
      name: 'Office Chairs',
      uom: 'Units',
      safetyStock: 20,
      reorderQty: 50,
      categoryId: furniture.id,
    },
  });

  const packingTape = await prisma.product.upsert({
    where: { sku: 'SKU-0202' },
    update: {},
    create: {
      sku: 'SKU-0202',
      name: 'Packing Tape',
      uom: 'Rolls',
      safetyStock: 50,
      reorderQty: 100,
      categoryId: packaging.id,
    },
  });

  // ── Partner ────────────────────────────────────────────────────────────────
  const supplier = await prisma.partner.upsert({
    where: { id: 'partner-supplier-1' },
    update: {},
    create: { id: 'partner-supplier-1', name: 'Global Steel Suppliers', type: 'SUPPLIER' },
  });

  const customer = await prisma.partner.upsert({
    where: { id: 'partner-customer-1' },
    update: {},
    create: { id: 'partner-customer-1', name: 'ABC Manufacturing', type: 'CUSTOMER' },
  });

  // ── Documents + Moves + StockLevels ───────────────────────────────────────
  // We'll delete existing moves and recalculate to avoid duplicates on re-seed
  await prisma.stockMove.deleteMany({ where: { productId: steelRods.id } });
  await prisma.documentLine.deleteMany({ where: { productId: steelRods.id } });
  await prisma.document.deleteMany({ where: { createdById: manager.id } });
  await prisma.stockLevel.deleteMany({ where: { productId: steelRods.id } });

  // 1) RECEIPT: VENDOR → Main Store +100
  const receiptDoc = await prisma.document.create({
    data: {
      docNumber: 'REC-2026-0001',
      type: 'RECEIPT',
      status: 'DONE',
      sourceLocationId: vendorLoc.id,
      destLocationId: mainStore.id,
      partnerId: supplier.id,
      scheduledDate: new Date(),
      createdById: manager.id,
      lines: {
        create: { productId: steelRods.id, qty: 100, pickedQty: 100 },
      },
    },
  });

  await prisma.stockMove.create({
    data: {
      productId: steelRods.id,
      fromLocationId: vendorLoc.id,
      toLocationId: mainStore.id,
      qty: 100,
      refType: 'RECEIPT',
      documentId: receiptDoc.id,
      performedById: manager.id,
    },
  });

  // 2) TRANSFER: Main Store → Production Rack 100
  const transferDoc = await prisma.document.create({
    data: {
      docNumber: 'TRF-2026-0001',
      type: 'TRANSFER',
      status: 'DONE',
      sourceLocationId: mainStore.id,
      destLocationId: productionRack.id,
      scheduledDate: new Date(),
      createdById: manager.id,
      lines: {
        create: { productId: steelRods.id, qty: 100, pickedQty: 100 },
      },
    },
  });

  await prisma.stockMove.create({
    data: {
      productId: steelRods.id,
      fromLocationId: mainStore.id,
      toLocationId: productionRack.id,
      qty: 100,
      refType: 'TRANSFER',
      documentId: transferDoc.id,
      performedById: staff.id,
    },
  });

  // 3) DELIVERY: Production Rack → CUSTOMER -20
  const deliveryDoc = await prisma.document.create({
    data: {
      docNumber: 'DEL-2026-0001',
      type: 'DELIVERY',
      status: 'DONE',
      sourceLocationId: productionRack.id,
      destLocationId: customerLoc.id,
      partnerId: customer.id,
      scheduledDate: new Date(),
      createdById: manager.id,
      lines: {
        create: { productId: steelRods.id, qty: 20, pickedQty: 20 },
      },
    },
  });

  await prisma.stockMove.create({
    data: {
      productId: steelRods.id,
      fromLocationId: productionRack.id,
      toLocationId: customerLoc.id,
      qty: 20,
      refType: 'DELIVERY',
      documentId: deliveryDoc.id,
      performedById: staff.id,
    },
  });

  // 4) ADJUSTMENT: Production Rack → DAMAGE -3
  const adjustmentDoc = await prisma.document.create({
    data: {
      docNumber: 'ADJ-2026-0001',
      type: 'ADJUSTMENT',
      reasonCode: 'DAMAGED',
      reasonNote: 'Damaged in transit',
      validatedAt: new Date(),
      status: 'DONE',
      sourceLocationId: productionRack.id,
      destLocationId: damageLoc.id,
      scheduledDate: new Date(),
      createdById: manager.id,
      lines: {
        create: { productId: steelRods.id, qty: 3, pickedQty: 3 },
      },
    },
  });

  await prisma.stockMove.create({
    data: {
      productId: steelRods.id,
      fromLocationId: productionRack.id,
      toLocationId: damageLoc.id,
      qty: 3,
      refType: 'ADJUSTMENT',
      documentId: adjustmentDoc.id,
      performedById: manager.id,
    },
  });

  // ── Stock Levels ──────────────────────────────────────────────────────────
  // Steel Rods: Main Store = 0 (all transferred out), Production Rack = 77
  await prisma.stockLevel.upsert({
    where: { productId_locationId: { productId: steelRods.id, locationId: mainStore.id } },
    update: { qty: 0 },
    create: { productId: steelRods.id, locationId: mainStore.id, qty: 0 },
  });

  await prisma.stockLevel.upsert({
    where: { productId_locationId: { productId: steelRods.id, locationId: productionRack.id } },
    update: { qty: 77 },
    create: { productId: steelRods.id, locationId: productionRack.id, qty: 77 },
  });

  // Office Chairs: below safety stock (safetyStock=20, actual=5)
  await prisma.stockLevel.upsert({
    where: { productId_locationId: { productId: officeChairs.id, locationId: mainStore.id } },
    update: { qty: 5 },
    create: { productId: officeChairs.id, locationId: mainStore.id, qty: 5 },
  });

  // Packing Tape: adequate stock
  await prisma.stockLevel.upsert({
    where: { productId_locationId: { productId: packingTape.id, locationId: mainStore.id } },
    update: { qty: 80 },
    create: { productId: packingTape.id, locationId: mainStore.id, qty: 80 },
  });

  // ── Print verification ────────────────────────────────────────────────────
  const stockLevels = await prisma.stockLevel.findMany({
    include: { product: true, location: true },
    orderBy: [{ product: { name: 'asc' } }],
  });

  const moveCount = await prisma.stockMove.count();

  console.log('\n📦 Stock Levels:');
  console.table(
    stockLevels.map((sl) => ({
      Product: sl.product.name,
      SKU: sl.product.sku,
      Location: sl.location.name,
      Qty: sl.qty,
      UOM: sl.product.uom,
      SafetyStock: sl.product.safetyStock,
      BelowSafety: sl.qty < sl.product.safetyStock ? '⚠️ YES' : '✅ OK',
    }))
  );

  console.log(`\n📝 Total StockMoves: ${moveCount}`);
  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
