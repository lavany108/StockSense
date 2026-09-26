/**
 * StockSense Pro — Document Engine Verification Script
 *
 * Tests:
 *   1. RECEIPT 100 units → TRANSFER → DELIVER 20 → ADJUST −3 → assert 77 remaining
 *   2. Two concurrent validations of the same delivery → exactly one must succeed (409)
 */

import { PrismaClient } from '@prisma/client';
import assert from 'assert';

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = process.env.API_BASE || 'http://localhost:5000/api/v1';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/stocksense_token=([^;]+)/);
  if (!match) throw new Error('Login failed: no token cookie');
  return match[1];
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `stocksense_token=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── Main test ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  StockSense Pro — Document Engine Verification');
  console.log('═══════════════════════════════════════════════════\n');

  // ── 0. Auth ────────────────────────────────────────────────────────────────
  console.log('🔑 Logging in as manager...');
  const token = await login('manager@stocksense.io', 'Demo@123');
  console.log('   ✅ Authenticated\n');

  // ── 0b. Fetch master data ──────────────────────────────────────────────────
  const { data: warehousesRaw } = await api('GET', '/warehouses', token);
  const warehouseList = Array.isArray(warehousesRaw)
    ? warehousesRaw as Array<{ id: string; code: string }>
    : (warehousesRaw as { data: Array<{ id: string; code: string }> }).data;
  const wh = warehouseList[0];
  if (!wh) throw new Error('No warehouses found — run seed first');
  console.log(`📦 Using warehouse: ${wh.code} (${wh.id})\n`);

  const { data: locsRaw } = await api('GET', `/locations?warehouseId=${wh.id}&type=INTERNAL`, token);
  const internalLocs = Array.isArray(locsRaw)
    ? locsRaw as Array<{ id: string; name: string; type: string }>
    : (locsRaw as Array<{ id: string; name: string; type: string }>);
  if (internalLocs.length < 2) throw new Error('Need at least 2 INTERNAL locations in this warehouse');
  const srcLoc = internalLocs[0];
  const dstLoc = internalLocs[1];
  console.log(`📍 Source location: ${srcLoc.name}`);
  console.log(`📍 Dest location:   ${dstLoc.name}\n`);

  const { data: productsRes } = await api('GET', '/products?limit=1', token);
  const product = (productsRes as { data: Array<{ id: string; sku: string; name: string }> }).data[0];
  if (!product) throw new Error('No products found — run seed first');
  console.log(`🔩 Test product: ${product.name} (${product.sku})\n`);

  // ═══════════════════════════════════════════════════
  //  TEST 1 — RECEIPT 100 → TRANSFER → DELIVER 20 → ADJUST −3 → assert 77
  // ═══════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Full document workflow (100 → transfer → deliver 20 → adjust −3 → expect 77)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1a. RECEIPT: VENDOR → srcLoc, qty=100
  console.log('📥 Step 1: Create RECEIPT 100 units...');
  const { data: receipt } = await api('POST', '/documents', token, {
    type: 'RECEIPT',
    destLocationId: srcLoc.id,
    lines: [{ productId: product.id, qty: 100 }],
  });
  const receiptId = (receipt as { id: string }).id;
  console.log(`   Created RECEIPT ${(receipt as { docNumber: string }).docNumber} [${receiptId}]`);

  // Advance to READY
  await api('PATCH', `/documents/${receiptId}/assign`, token); // DRAFT→WAITING
  await api('PATCH', `/documents/${receiptId}/assign`, token); // WAITING→READY
  const { status: r1Status, data: r1Val } = await api('POST', `/documents/${receiptId}/validate`, token);
  assert.strictEqual(r1Status, 200, `RECEIPT validate failed: ${JSON.stringify(r1Val)}`);
  console.log(`   ✅ RECEIPT validated → DONE\n`);

  // Check srcLoc stock = 100
  const { data: levelsAfterReceipt } = await api('GET', `/stock/levels?productId=${product.id}`, token);
  const srcLevel1 = (levelsAfterReceipt as { data: Array<{ locationId: string; qty: number }> })
    .data.find((l) => l.locationId === srcLoc.id);
  console.log(`   Stock at ${srcLoc.name}: ${srcLevel1?.qty ?? 'N/A'} (expected ≥ 100)`);

  // 1b. TRANSFER: srcLoc → dstLoc, qty=100
  console.log('\n🔄 Step 2: TRANSFER 100 units to dest location...');
  const { data: transfer } = await api('POST', '/documents', token, {
    type: 'TRANSFER',
    sourceLocationId: srcLoc.id,
    destLocationId: dstLoc.id,
    lines: [{ productId: product.id, qty: 100 }],
  });
  const transferId = (transfer as { id: string }).id;
  console.log(`   Created TRANSFER ${(transfer as { docNumber: string }).docNumber}`);
  await api('PATCH', `/documents/${transferId}/assign`, token);
  await api('PATCH', `/documents/${transferId}/assign`, token);
  const { status: tStatus, data: tVal } = await api('POST', `/documents/${transferId}/validate`, token);
  assert.strictEqual(tStatus, 200, `TRANSFER validate failed: ${JSON.stringify(tVal)}`);
  console.log(`   ✅ TRANSFER validated → DONE\n`);

  // 1c. DELIVERY: dstLoc → CUSTOMER, qty=20
  console.log('📤 Step 3: DELIVERY 20 units...');
  const { data: delivery } = await api('POST', '/documents', token, {
    type: 'DELIVERY',
    sourceLocationId: dstLoc.id,
    lines: [{ productId: product.id, qty: 20 }],
  });
  const deliveryId = (delivery as { id: string }).id;
  console.log(`   Created DELIVERY ${(delivery as { docNumber: string }).docNumber}`);
  await api('PATCH', `/documents/${deliveryId}/assign`, token);
  await api('PATCH', `/documents/${deliveryId}/assign`, token);
  const { status: dStatus, data: dVal } = await api('POST', `/documents/${deliveryId}/validate`, token);
  assert.strictEqual(dStatus, 200, `DELIVERY validate failed: ${JSON.stringify(dVal)}`);
  console.log(`   ✅ DELIVERY validated → DONE\n`);

  // 1d. ADJUSTMENT: dstLoc → DAMAGE, qty=3
  console.log('🔧 Step 4: ADJUSTMENT −3 units (DAMAGED)...');
  const { data: adjustment } = await api('POST', '/documents', token, {
    type: 'ADJUSTMENT',
    reasonCode: 'DAMAGED',
    reasonNote: 'Damaged during verification test',
    lines: [{ productId: product.id, qty: 3, locationId: dstLoc.id }],
  });
  const adjustId = (adjustment as { id: string }).id;
  console.log(`   Created ADJUSTMENT ${(adjustment as { docNumber: string }).docNumber}`);
  await api('PATCH', `/documents/${adjustId}/assign`, token);
  await api('PATCH', `/documents/${adjustId}/assign`, token);
  const { status: aStatus, data: aVal } = await api('POST', `/documents/${adjustId}/validate`, token);
  assert.strictEqual(aStatus, 200, `ADJUSTMENT validate failed: ${JSON.stringify(aVal)}`);
  console.log(`   ✅ ADJUSTMENT validated → DONE\n`);

  // 1e. Assert final stock = 77 at dstLoc
  console.log('🔍 Step 5: Asserting final stock level...');
  const { data: finalLevels } = await api('GET', `/stock/levels?productId=${product.id}`, token);
  const dstLevel = (finalLevels as { data: Array<{ locationId: string; qty: number }> })
    .data.find((l) => l.locationId === dstLoc.id);

  console.log(`\n   📊 Final stock at ${dstLoc.name}: ${dstLevel?.qty}`);
  console.log(`   Expected: 77`);
  assert.strictEqual(
    dstLevel?.qty,
    77,
    `❌ ASSERTION FAILED: Expected 77 at ${dstLoc.name}, got ${dstLevel?.qty}`
  );
  console.log(`   ✅ ASSERTION PASSED: 100 received → 100 transferred → 20 delivered → 3 adjusted = 77\n`);

  // ═══════════════════════════════════════════════════
  //  TEST 2 — Concurrent validation race: exactly one must succeed
  // ═══════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Concurrent validation of same delivery — exactly one must win (409 for the other)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create a second delivery of 5 units (we still have 77 at dstLoc)
  console.log('📤 Creating DELIVERY 5 units for race test...');
  const { data: raceDelivery } = await api('POST', '/documents', token, {
    type: 'DELIVERY',
    sourceLocationId: dstLoc.id,
    lines: [{ productId: product.id, qty: 5 }],
  });
  const raceId = (raceDelivery as { id: string }).id;
  console.log(`   Created DELIVERY ${(raceDelivery as { docNumber: string }).docNumber} [${raceId}]`);
  await api('PATCH', `/documents/${raceId}/assign`, token);
  await api('PATCH', `/documents/${raceId}/assign`, token);
  console.log(`   Advanced to READY\n`);

  // Fire two concurrent validations
  console.log('⚡ Firing two concurrent POST validate requests...');
  const [res1, res2] = await Promise.all([
    api('POST', `/documents/${raceId}/validate`, token),
    api('POST', `/documents/${raceId}/validate`, token),
  ]);

  console.log(`   Request A → HTTP ${res1.status}`);
  console.log(`   Request B → HTTP ${res2.status}`);

  const statuses = [res1.status, res2.status].sort();
  const oneSucceeded = statuses.includes(200);
  const oneRejected = statuses.includes(409) || statuses.includes(500);

  // One must be 200, the other must be non-200 (409 from status guard or 500 from serializable tx)
  assert.ok(
    oneSucceeded,
    `❌ Neither request succeeded (statuses: ${res1.status}, ${res2.status})`
  );
  assert.ok(
    oneRejected || statuses.filter((s) => s === 200).length === 1,
    `❌ Both requests succeeded — race condition NOT prevented!`
  );

  const successes = [res1, res2].filter((r) => r.status === 200).length;
  const failures = [res1, res2].filter((r) => r.status !== 200).length;

  assert.strictEqual(successes, 1, `Expected exactly 1 success, got ${successes}`);
  assert.strictEqual(failures, 1, `Expected exactly 1 failure, got ${failures}`);

  console.log(`\n   ✅ ASSERTION PASSED: Exactly 1 succeeded, 1 rejected — optimistic lock works!\n`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('  ALL TESTS PASSED ✅');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n  Test 1: 100 → transfer → deliver 20 → adjust −3 = 77  ✅`);
  console.log(`  Test 2: Concurrent validate → exactly 1 wins           ✅\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ VERIFICATION FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
