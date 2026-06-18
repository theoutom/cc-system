-- Create daftar_pc table
CREATE TABLE IF NOT EXISTS public.daftar_pc (
    no_pc integer PRIMARY KEY,
    client_key text UNIQUE NOT NULL,
    nama_pc text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daftar_pc ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Allow public (anon/authenticated) to read PC list (to verify codes on client and display on web)
CREATE POLICY "Allow public read access to daftar_pc" ON public.daftar_pc
    FOR SELECT TO public USING (true);

-- Allow admins (authenticated/service-role) to manage PCs
CREATE POLICY "Allow admin all access to daftar_pc" ON public.daftar_pc
    FOR ALL TO public USING (true); -- fallback to public for simple dashboard inserts

-- Insert initial 4 PCs
INSERT INTO public.daftar_pc (no_pc, client_key, nama_pc) VALUES
(1, 'cc-pc1-key-secret', 'PC 01'),
(2, 'cc-pc2-key-secret', 'PC 02'),
(3, 'cc-pc3-key-secret', 'PC 03'),
(4, 'cc-pc4-key-secret', 'PC 04')
ON CONFLICT (no_pc) DO NOTHING;
