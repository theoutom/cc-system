-- ================================================================
-- MIGRATION SPRINT 2: Denda per hari + Maintenance mode
-- Aman dijalankan berulang kali (IF NOT EXISTS)
-- ================================================================

-- ── 1. Kolom baru di inventaris ──────────────────────────────
ALTER TABLE inventaris
  ADD COLUMN IF NOT EXISTS denda_per_hari INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_maintenance  BOOLEAN DEFAULT false;

-- ── 2. Verifikasi ────────────────────────────────────────────
SELECT
  '✅ MIGRATION_sprint2 berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'inventaris'
     AND column_name IN ('denda_per_hari','in_maintenance')) AS inv_cols;
