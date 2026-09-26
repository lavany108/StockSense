-- Migration: document_engine_fields
-- Adds docNumber, reasonCode, reasonNote, validatedAt, canceledAt to documents
-- Adds AdjustmentReason enum

-- Create enum
CREATE TYPE "AdjustmentReason" AS ENUM (
  'DAMAGED',
  'EXPIRED',
  'LOST_THEFT',
  'INVENTORY_COUNT_CORRECTION',
  'FOUND_STOCK'
);

-- Add docNumber with a temporary default so existing rows can be filled
ALTER TABLE "documents"
  ADD COLUMN "docNumber" TEXT;

-- Backfill existing rows with unique doc numbers based on type + id
UPDATE "documents"
SET "docNumber" = CONCAT(
  CASE type
    WHEN 'RECEIPT' THEN 'REC'
    WHEN 'DELIVERY' THEN 'DEL'
    WHEN 'TRANSFER' THEN 'TRF'
    WHEN 'ADJUSTMENT' THEN 'ADJ'
    ELSE 'DOC'
  END,
  '-SEED-',
  SUBSTR(id::text, 1, 8)
);

-- Now make it NOT NULL and UNIQUE
ALTER TABLE "documents"
  ALTER COLUMN "docNumber" SET NOT NULL;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_docNumber_key" UNIQUE ("docNumber");

-- Add optional reason fields
ALTER TABLE "documents"
  ADD COLUMN "reasonCode" "AdjustmentReason",
  ADD COLUMN "reasonNote" TEXT,
  ADD COLUMN "validatedAt" TIMESTAMPTZ,
  ADD COLUMN "canceledAt" TIMESTAMPTZ;
