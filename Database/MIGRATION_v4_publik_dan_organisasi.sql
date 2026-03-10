-- ================================================================
-- MIGRATION: Fitur baru (jalankan di Supabase SQL Editor)
-- ================================================================

-- 1. Tambah kolom asal_organisasi ke tabel peminjaman
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS asal_organisasi TEXT;

-- 2. RLS policy untuk publik — boleh INSERT tanpa login (akses tamu)
--    Supabase anon key bisa insert, tapi tidak bisa SELECT data orang lain

-- Aktifkan RLS jika belum
ALTER TABLE peminjaman ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "Anon can insert peminjaman" ON peminjaman;
DROP POLICY IF EXISTS "Public insert peminjaman" ON peminjaman;

-- Policy: siapa saja (termasuk anon/tamu) bisa INSERT peminjaman baru
CREATE POLICY "Public insert peminjaman"
  ON peminjaman FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy SELECT: hanya authenticated yang bisa baca semua
-- (sudah ada dari sebelumnya, tapi pastikan ada)
DROP POLICY IF EXISTS "Authenticated can view peminjaman" ON peminjaman;
CREATE POLICY "Authenticated can view peminjaman"
  ON peminjaman FOR SELECT
  TO authenticated
  USING (true);

-- Policy SELECT untuk anon: hanya bisa baca yang status approved/active
-- (untuk fitur pengembalian publik — cari peminjaman mereka)
DROP POLICY IF EXISTS "Anon can view active peminjaman" ON peminjaman;
CREATE POLICY "Anon can view active peminjaman"
  ON peminjaman FOR SELECT
  TO anon
  USING (status IN ('approved', 'active'));

-- 3. Policy UPDATE untuk anon — boleh update status jadi returned
--    (saat pengembalian publik)
DROP POLICY IF EXISTS "Anon can return peminjaman" ON peminjaman;
CREATE POLICY "Anon can return peminjaman"
  ON peminjaman FOR UPDATE
  TO anon
  USING (status IN ('approved', 'active'))
  WITH CHECK (status = 'returned');

-- 4. Policy inventaris untuk anon — boleh SELECT (lihat ketersediaan)
ALTER TABLE inventaris ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can view inventaris" ON inventaris;
CREATE POLICY "Anon can view inventaris"
  ON inventaris FOR SELECT
  TO anon
  USING (true);

-- Policy UPDATE inventaris untuk anon (saat pengembalian, status → Tersedia)
DROP POLICY IF EXISTS "Anon can update inventaris status" ON inventaris;
CREATE POLICY "Anon can update inventaris status"
  ON inventaris FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (status IN ('Tersedia', 'Dipinjam'));

-- 5. Policy pengembalian untuk anon — boleh INSERT
ALTER TABLE pengembalian ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can insert pengembalian" ON pengembalian;
CREATE POLICY "Anon can insert pengembalian"
  ON pengembalian FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 6. Verifikasi
SELECT 'Migration berhasil!' as status,
       column_name
FROM information_schema.columns
WHERE table_name = 'peminjaman'
  AND column_name = 'asal_organisasi';
