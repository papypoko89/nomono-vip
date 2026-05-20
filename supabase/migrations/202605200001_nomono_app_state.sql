create table if not exists public.nomono_app_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_nomono_app_state_updated_at on public.nomono_app_state;
create trigger set_nomono_app_state_updated_at
before update on public.nomono_app_state
for each row
execute function public.set_updated_at();

alter table public.nomono_app_state enable row level security;

drop policy if exists "anon read nomono app state" on public.nomono_app_state;
create policy "anon read nomono app state"
on public.nomono_app_state
for select
to anon
using (id = 'main');

drop policy if exists "anon insert nomono app state" on public.nomono_app_state;
create policy "anon insert nomono app state"
on public.nomono_app_state
for insert
to anon
with check (id = 'main');

drop policy if exists "anon update nomono app state" on public.nomono_app_state;
create policy "anon update nomono app state"
on public.nomono_app_state
for update
to anon
using (id = 'main')
with check (id = 'main');

insert into public.nomono_app_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('nomono-checklist-photos', 'nomono-checklist-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "anon read checklist photos" on storage.objects;
create policy "anon read checklist photos"
on storage.objects
for select
to anon
using (bucket_id = 'nomono-checklist-photos');

drop policy if exists "anon upload checklist photos" on storage.objects;
create policy "anon upload checklist photos"
on storage.objects
for insert
to anon
with check (bucket_id = 'nomono-checklist-photos');

drop policy if exists "anon update checklist photos" on storage.objects;
create policy "anon update checklist photos"
on storage.objects
for update
to anon
using (bucket_id = 'nomono-checklist-photos')
with check (bucket_id = 'nomono-checklist-photos');
