-- ================================================================
-- MIGRATION: Tambah kolom items_dipinjam ke tabel peminjaman
-- Jalankan di Supabase SQL Editor → New Query → Run ▶
-- ================================================================

-- 1. Tambah kolom items_dipinjam (array UUID referensi ke inventaris)
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS items_dipinjam UUID[] DEFAULT '{}';

-- 2. (Opsional) Buat index untuk mempercepat query
CREATE INDEX IF NOT EXISTS idx_peminjaman_items_dipinjam
  ON peminjaman USING GIN (items_dipinjam);

-- 3. Verifikasi kolom berhasil ditambahkan
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'peminjaman' AND column_name = 'items_dipinjam';

-- Hasil yang diharapkan:
-- column_name       | data_type
-- items_dipinjam    | ARRAY
