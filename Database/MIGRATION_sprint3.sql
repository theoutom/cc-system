-- ================================================================
-- MIGRATION SPRINT 3: Blacklist, History Alat, Foto Kondisi
-- Aman dijalankan berulang kali
-- ================================================================

-- ── 1. Blacklist per profil anggota CC ───────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_blacklisted  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_alasan TEXT;

-- ── 2. Daftar hitam peminjam eksternal (by nama) ─────────────
CREATE TABLE IF NOT EXISTS daftar_hitam (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nama       TEXT        NOT NULL,
  alasan     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Foto kondisi saat pengembalian ────────────────────────
ALTER TABLE pengembalian
  ADD COLUMN IF NOT EXISTS foto_kondisi TEXT;

-- ── 4. Verifikasi ────────────────────────────────────────────
SELECT
  '✅ MIGRATION_sprint3 berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'profiles'
     AND column_name IN ('is_blacklisted','blacklist_alasan'))         AS profiles_cols,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name = 'daftar_hitam')                                  AS daftar_hitam_exists,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'pengembalian' AND column_name = 'foto_kondisi') AS foto_col;
