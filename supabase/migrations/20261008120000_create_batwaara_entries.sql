-- Additive migration for a standalone, year-based Batwaara register.
-- Existing member and payment rows remain untouched; legacy member entries
-- are copied so the new register can be used without rewriting Member data.
create table if not exists public.batwaara_entries (
  id text primary key,
  register_year integer not null check (register_year between 2000 and 2200),
  member_id text references public.members(id) on delete set null,
  person_name text not null check (length(trim(person_name)) > 0),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  given boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists batwaara_entries_year_created_idx
  on public.batwaara_entries (register_year, created_at, id);

drop trigger if exists batwaara_entries_set_updated_at on public.batwaara_entries;
create trigger batwaara_entries_set_updated_at before update on public.batwaara_entries
for each row execute function public.set_updated_at();

alter table public.batwaara_entries enable row level security;
grant select, insert, update on table public.batwaara_entries to authenticated;

drop policy if exists "E-Register admin manages Batwaara entries" on public.batwaara_entries;
create policy "E-Register admin manages Batwaara entries"
on public.batwaara_entries for all to authenticated
using ((select public.is_e_register_admin()))
with check ((select public.is_e_register_admin()));

insert into public.batwaara_entries (
  id, register_year, member_id, person_name, amount, given, created_at
)
select
  'LEGACY-' || m.id || '-' || extract(year from m.join_date)::integer,
  extract(year from m.join_date)::integer,
  m.id,
  m.name,
  coalesce(
    m.entry_amount,
    (
      select sum(p.amount)
      from public.payments p
      where p.member_id = m.id
        and p.status = 'Paid'
        and extract(year from p.payment_date) = extract(year from m.join_date)
    )
  ),
  exists (
    select 1
    from public.payments p
    where p.member_id = m.id
      and p.status = 'Paid'
      and extract(year from p.payment_date) = extract(year from m.join_date)
  ),
  m.created_at
from public.members m
where m.archived_at is null
on conflict (id) do nothing;
