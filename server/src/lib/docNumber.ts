import { DocType, PrismaClient } from '@prisma/client';

const PREFIX: Record<DocType, string> = {
  RECEIPT: 'REC',
  DELIVERY: 'DEL',
  TRANSFER: 'TRF',
  ADJUSTMENT: 'ADJ',
};

/**
 * Generate a unique sequential document number like REC-2026-0001.
 * Must be called inside a serializable transaction to be safe, or just use
 * the timestamp+random approach for speed. We use count+1 per type+year.
 */
export const generateDocNumber = async (
  prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  type: DocType
): Promise<string> => {
  const year = new Date().getFullYear();
  // Count existing docs of this type this year
  const count = await (prisma as PrismaClient).document.count({
    where: {
      type,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `${PREFIX[type]}-${year}-${seq}`;
};
