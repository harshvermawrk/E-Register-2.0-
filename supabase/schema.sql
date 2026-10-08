-- E-Register free test database (Supabase PostgreSQL).
-- Run this once in Supabase Dashboard > SQL Editor for a NEW test project.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id text primary key,
  sno integer not null check (sno > 0),
  account_number text not null,
  name text not null check (length(trim(name)) > 0),
  initials text not null default '',
  avatar_color text not null default '#2563EB',
  hometown text not null default '',
  phone text not null default '',
  email text not null default '',
  status text not null check (status in ('Active', 'Inactive', 'Pending')),
  join_date date not null,
  entry_amount numeric(12, 2) check (entry_amount is null or entry_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.payments (
  id text primary key,
  member_id text not null references public.members(id) on delete restrict,
  payment_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('UPI', 'Cash', 'Bank Transfer', 'Cheque')),
  status text not null check (status in ('Paid', 'Pending', 'Failed')),
  receipt_id text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  financial_year_start integer not null check (financial_year_start between 2000 and 2200),
  period_id text not null check (period_id in ('period-1', 'period-2', 'period-3', 'period-4')),
  title text not null check (length(trim(title)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null,
  notes text not null default '',
  payment_mode text check (payment_mode is null or payment_mode in ('UPI', 'Cash', 'Bank Transfer', 'Cheque')),
  status text not null default 'Paid' check (status in ('Paid', 'Pending', 'Failed')),
  receipt_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists payments_member_date_idx on public.payments (member_id, payment_date desc);
create index if not exists payments_date_status_idx on public.payments (payment_date, status);
create index if not exists expenses_year_date_idx on public.expenses (financial_year_start, expense_date desc);
create unique index if not exists members_active_sno_idx on public.members (sno) where archived_at is null;
create unique index if not exists members_active_account_number_idx on public.members (account_number) where archived_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

-- This function is owned by the database owner and only answers whether the
-- signed-in account was explicitly allowlisted by the project owner.
create or replace function public.is_e_register_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_e_register_admin() from public, anon;
grant execute on function public.is_e_register_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select, insert, update on table public.members, public.payments, public.expenses to authenticated;

drop policy if exists "E-Register admin can read admin list" on public.admin_users;
create policy "E-Register admin can read admin list"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "E-Register admin manages members" on public.members;
create policy "E-Register admin manages members"
on public.members for all to authenticated
using ((select public.is_e_register_admin()))
with check ((select public.is_e_register_admin()));

drop policy if exists "E-Register admin manages payments" on public.payments;
create policy "E-Register admin manages payments"
on public.payments for all to authenticated
using ((select public.is_e_register_admin()))
with check ((select public.is_e_register_admin()));

drop policy if exists "E-Register admin manages expenses" on public.expenses;
create policy "E-Register admin manages expenses"
on public.expenses for all to authenticated
using ((select public.is_e_register_admin()))
with check ((select public.is_e_register_admin()));
