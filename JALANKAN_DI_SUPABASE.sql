-- ================================================================
-- CC SYSTEM — MIGRATION LENGKAP (v1 + v2 + v3 + v4)
-- Aman dijalankan berulang kali (menggunakan IF NOT EXISTS / DROP IF EXISTS)
-- 
-- CARA MENJALANKAN:
-- 1. Buka https://supabase.com/dashboard
-- 2. Pilih project CC System
-- 3. Klik menu "SQL Editor" di sidebar kiri
-- 4. Klik "+ New query"
-- 5. Copy-paste SELURUH isi file ini
-- 6. Klik tombol "Run" (Ctrl+Enter)
-- 7. Pastikan output bawah menampilkan: "Migration berhasil!"
-- ================================================================


-- ════════════════════════════════════════════════════════════
-- BAGIAN 1: KOLOM BARU DI TABEL peminjaman
-- ════════════════════════════════════════════════════════════

-- Kolom items_dipinjam: array UUID alat yang dipinjam
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS items_dipinjam UUID[] DEFAULT '{}';

-- Kolom asal_organisasi: nama org/ekskul/instansi (wajib untuk non-Sekolah)
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS asal_organisasi TEXT;

-- Index untuk mempercepat query items_dipinjam
CREATE INDEX IF NOT EXISTS idx_peminjaman_items_dipinjam
  ON peminjaman USING GIN (items_dipinjam);


-- ════════════════════════════════════════════════════════════
-- BAGIAN 2: RLS POLICIES — AKSES TAMU (tanpa login)
-- ════════════════════════════════════════════════════════════

-- Aktifkan RLS di semua tabel
ALTER TABLE peminjaman  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengembalian ENABLE ROW LEVEL SECURITY;

-- ── Tabel peminjaman ─────────────────────────────────────────

-- Hapus policy lama kalau ada
DROP POLICY IF EXISTS "Anon can insert peminjaman"       ON peminjaman;
DROP POLICY IF EXISTS "Public insert peminjaman"          ON peminjaman;
DROP POLICY IF EXISTS "Authenticated can view peminjaman" ON peminjaman;
DROP POLICY IF EXISTS "Anon can view active peminjaman"   ON peminjaman;
DROP POLICY IF EXISTS "Anon can return peminjaman"        ON peminjaman;
DROP POLICY IF EXISTS "Users can view all peminjaman"     ON peminjaman;
DROP POLICY IF EXISTS "Users can insert peminjaman"       ON peminjaman;
DROP POLICY IF EXISTS "Users can update peminjaman"       ON peminjaman;
DROP POLICY IF EXISTS "Admins can delete peminjaman"      ON peminjaman;

-- Tamu & member bisa buat peminjaman baru
CREATE POLICY "cc_peminjaman_insert"
  ON peminjaman FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Member & admin bisa lihat semua peminjaman
CREATE POLICY "cc_peminjaman_select_auth"
  ON peminjaman FOR SELECT
  TO authenticated
  USING (true);

-- Tamu hanya bisa lihat yang aktif (untuk cari saat pengembalian)
CREATE POLICY "cc_peminjaman_select_anon"
  ON peminjaman FOR SELECT
  TO anon
  USING (status IN ('approved', 'active'));

-- Member & admin bisa update (approve, reject, dll)
CREATE POLICY "cc_peminjaman_update_auth"
  ON peminjaman FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tamu bisa update status jadi 'returned' saja (pengembalian publik)
CREATE POLICY "cc_peminjaman_update_anon"
  ON peminjaman FOR UPDATE
  TO anon
  USING (status IN ('approved', 'active'))
  WITH CHECK (status = 'returned');

-- Admin bisa hapus
CREATE POLICY "cc_peminjaman_delete"
  ON peminjaman FOR DELETE
  TO authenticated
  USING (true);

-- ── Tabel inventaris ─────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can view inventaris"          ON inventaris;
DROP POLICY IF EXISTS "Anon can update inventaris status" ON inventaris;
DROP POLICY IF EXISTS "Users can view inventaris"         ON inventaris;
DROP POLICY IF EXISTS "Admins can manage inventaris"      ON inventaris;

-- Semua (termasuk tamu) bisa lihat inventaris (untuk form peminjaman publik)
CREATE POLICY "cc_inventaris_select"
  ON inventaris FOR SELECT
  TO anon, authenticated
  USING (true);

-- Member & admin bisa update (approve mengubah status)
CREATE POLICY "cc_inventaris_update_auth"
  ON inventaris FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tamu bisa update status saat pengembalian
CREATE POLICY "cc_inventaris_update_anon"
  ON inventaris FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (status IN ('Tersedia', 'Dipinjam'));

-- Admin bisa insert & delete
CREATE POLICY "cc_inventaris_insert"
  ON inventaris FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cc_inventaris_delete"
  ON inventaris FOR DELETE
  TO authenticated
  USING (true);

-- ── Tabel pengembalian ───────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert pengembalian"  ON pengembalian;
DROP POLICY IF EXISTS "Users can view pengembalian"   ON pengembalian;
DROP POLICY IF EXISTS "Users can insert pengembalian" ON pengembalian;

-- Semua (tamu juga) bisa catat pengembalian
CREATE POLICY "cc_pengembalian_insert"
  ON pengembalian FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Member & admin bisa lihat semua riwayat pengembalian
CREATE POLICY "cc_pengembalian_select"
  ON pengembalian FOR SELECT
  TO authenticated
  USING (true);


-- ════════════════════════════════════════════════════════════
-- BAGIAN 3: VERIFIKASI — cek output di bawah setelah Run
-- ════════════════════════════════════════════════════════════

SELECT
  '✅ Migration berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'peminjaman'
   AND column_name IN ('items_dipinjam', 'asal_organisasi')) AS kolom_baru_ada,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('peminjaman','inventaris','pengembalian')) AS total_policies;
