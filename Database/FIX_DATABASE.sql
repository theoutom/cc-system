-- =============================================
-- JALANKAN INI JIKA ADA ERROR SAAT BUAT USER
-- Supabase SQL Editor → New Query → Run ▶
-- =============================================

-- 1. Drop trigger lama yang bermasalah
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Hapus semua RLS policy lama di tabel profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;
DROP POLICY IF EXISTS "Allow trigger to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- 3. Buat ulang function handle_new_user dengan SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nama, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    'anggota'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Buat trigger baru
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Pastikan RLS aktif
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 6. Buat policy baru yang benar
CREATE POLICY "Semua user bisa lihat profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "User bisa update profil sendiri"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin bisa update semua profil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy INSERT untuk trigger (pakai service_role)
CREATE POLICY "Service role bisa insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- 7. Verifikasi
SELECT 'Setup berhasil! Coba buat user baru sekarang.' as status;
