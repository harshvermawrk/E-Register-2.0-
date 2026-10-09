create table if not exists public.batwaara_year_settings (
  register_year integer primary key check (register_year between 2000 and 2200),
  amount numeric(12, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists batwaara_year_settings_set_updated_at on public.batwaara_year_settings;
create trigger batwaara_year_settings_set_updated_at before update on public.batwaara_year_settings
for each row execute function public.set_updated_at();

alter table public.batwaara_year_settings enable row level security;
grant select, insert, update on table public.batwaara_year_settings to authenticated;

drop policy if exists "E-Register admin manages Batwaara yearly amounts" on public.batwaara_year_settings;
create policy "E-Register admin manages Batwaara yearly amounts"
on public.batwaara_year_settings for all to authenticated
using ((select public.is_e_register_admin()))
with check ((select public.is_e_register_admin()));
