-- Run this once in Supabase Dashboard > SQL Editor > New query > Run.

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles: one row per login (admin or team member)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- pages: the donation pages (one per team member)
-- ============================================================
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  owner_id uuid references profiles(id) on delete set null,
  label text,
  theme text not null default 'classic',
  title text not null default 'Make a Donation',
  subtitle text not null default 'Support us with any amount.',
  hero_image_url text,
  enabled_gateways text[] not null default array['paypal', 'stripe', 'bank'],
  payment_settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table profiles
  add column if not exists page_id uuid references pages(id) on delete set null;

-- ============================================================
-- donations: the private invoice record for every payment
-- ============================================================
create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null default ('INV-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  page_id uuid not null references pages(id) on delete cascade,
  donor_name text,
  donor_email text,
  donor_address text,
  donor_phone text,
  donor_country text,
  is_anonymous boolean not null default false,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'USD',
  message text,
  gateway text not null check (gateway in ('paypal', 'stripe', 'bank', 'applepay', 'googlepay')),
  gateway_reference text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- Why a payment failed (only set while status = 'failed'). failure_code holds
-- PayPal's own error code for a declined capture, e.g. INSTRUMENT_DECLINED.
alter table donations
  add column if not exists failure_reason text check (failure_reason in ('cancelled', 'checkout_error', 'capture_declined')),
  add column if not exists failure_code text;

-- How far a donor got before leaving, used to explain pending invoices:
-- 'form' = submitted the form, 'paypal' = a PayPal checkout was opened.
alter table donations
  add column if not exists checkout_step text check (checkout_step in ('form', 'paypal'));

-- Which saved PayPal account (payment_settings.paypal.accounts[].id) a PayPal
-- order was created with; the capture has to use the same account.
alter table donations
  add column if not exists paypal_account_id text;

create index if not exists donations_page_id_idx on donations(page_id);

-- ============================================================
-- Completed donations can never be deleted (blocks every role,
-- including the service key — this is not an RLS policy).
-- ============================================================
create or replace function prevent_completed_donation_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' then
    raise exception 'Completed donations cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_completed_donation_delete on donations;
create trigger trg_prevent_completed_donation_delete
before delete on donations
for each row
execute function prevent_completed_donation_delete();

-- ============================================================
-- settings: one global row holding site-wide payment settings
-- ============================================================
create table if not exists settings (
  id text primary key default 'global',
  payment_settings jsonb not null default '{}'
);

insert into settings (id) values ('global') on conflict (id) do nothing;

-- ============================================================
-- helper: is_admin() avoids infinite recursion in RLS policies
-- ============================================================
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table profiles enable row level security;
alter table pages enable row level security;
alter table donations enable row level security;
alter table settings enable row level security;

create policy "settings_admin_all" on settings
  for all using (is_admin()) with check (is_admin());

create policy "profiles_self_select" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "pages_admin_all" on pages
  for all using (is_admin()) with check (is_admin());

create policy "pages_member_select_own" on pages
  for select using (owner_id = auth.uid());

create policy "pages_public_select" on pages
  for select to anon using (true);

create policy "donations_admin_all" on donations
  for all using (is_admin()) with check (is_admin());

create policy "donations_member_select_own" on donations
  for select using (
    page_id in (select page_id from profiles where id = auth.uid())
  );

-- ============================================================
-- public_donor_wall: safe subset for the public donation page
-- (no invoice_number, gateway, gateway_reference, or status)
-- ============================================================
create or replace view public_donor_wall
with (security_invoker = false) as
  select
    id,
    page_id,
    case when is_anonymous then 'Anonymous' else donor_name end as display_name,
    amount,
    currency,
    message,
    created_at
  from donations
  where status = 'completed'
  order by created_at desc;

grant select on public_donor_wall to anon, authenticated;
