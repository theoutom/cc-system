-- ================================================================
-- MIGRATION SPRINT 5: Email Peminjam
-- Aman dijalankan berulang kali
-- ================================================================

ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS email_peminjam TEXT;

-- Verifikasi
SELECT
  '✅ MIGRATION_sprint5 berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'peminjaman' AND column_name = 'email_peminjam') AS kolom_email;
