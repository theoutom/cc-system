-- ================================================================
-- MIGRATION SPRINT 4: Jam Peminjaman, Jam Acara, Jam Pengembalian
-- Aman dijalankan berulang kali
-- ================================================================

-- ── Tambah kolom waktu ke tabel peminjaman ───────────────────
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS jam_peminjaman  TIME,  -- jam pengambilan alat
  ADD COLUMN IF NOT EXISTS jam_acara       TIME,  -- jam mulai acara/kegiatan
  ADD COLUMN IF NOT EXISTS jam_pengembalian TIME; -- jam perkiraan pengembalian alat (berpasangan dgn perkiraan_kembali)

-- ── Verifikasi ───────────────────────────────────────────────
SELECT
  '✅ MIGRATION_sprint4 berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'peminjaman'
     AND column_name IN ('jam_peminjaman','jam_acara','jam_pengembalian')) AS kolom_waktu_count;
