-- Supabase/Postgres production schema for Ludu Aaddaa
create type public.user_role as enum ('player','admin');
create type public.payment_status as enum ('pending','approved','rejected');
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, phone text unique, full_name text, role public.user_role not null default 'player', balance numeric(12,2) not null default 0, hold_balance numeric(12,2) not null default 0, created_at timestamptz not null default now());
create table if not exists public.deposit_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), amount numeric(12,2) not null check (amount >= 500), method text not null default 'bkash', sender_number text not null, receiver_number text not null default '01670201266', trx_id text not null unique, status public.payment_status not null default 'pending', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, note text, created_at timestamptz not null default now());
create table if not exists public.withdraw_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), amount numeric(12,2) not null check (amount >= 2000), method text not null default 'bkash', account_number text not null, status public.payment_status not null default 'pending', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, note text, created_at timestamptz not null default now());
create table if not exists public.matches (id uuid primary key default gen_random_uuid(), room_code text unique not null, status text not null default 'waiting', bet_amount numeric(12,2) not null check (bet_amount between 100 and 5000), table_fee numeric(12,2) not null default 10, state jsonb not null default '{}'::jsonb, winner_id uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.profiles enable row level security; alter table public.deposit_requests enable row level security; alter table public.matches enable row level security;
alter table public.withdraw_requests enable row level security;
create policy "users read own profile" on public.profiles for select using (auth.uid()=id);
create policy "users create deposits" on public.deposit_requests for insert with check (auth.uid()=user_id);
create policy "users read own deposits" on public.deposit_requests for select using (auth.uid()=user_id);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create policy "admins manage deposits" on public.deposit_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "users create withdrawals" on public.withdraw_requests for insert with check (auth.uid()=user_id);
create policy "users read own withdrawals" on public.withdraw_requests for select using (auth.uid()=user_id);
create policy "admins manage withdrawals" on public.withdraw_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read matches" on public.matches for select using (auth.role()='authenticated');
