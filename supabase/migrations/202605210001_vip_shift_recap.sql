alter table public.nomono_vip_items
add column if not exists unit text not null default 'botol',
add column if not exists is_draft boolean not null default true;

alter table public.nomono_vip_sessions
add column if not exists shift integer not null default 1,
add column if not exists cashier_staff_id text not null default '',
add column if not exists recap_id text;

create table if not exists public.nomono_shift_settings (
  shift integer primary key,
  label text not null default '',
  start_time text not null default '',
  end_time text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint nomono_shift_settings_shift_check check (shift in (1, 2, 3))
);

create table if not exists public.nomono_majoo_recaps (
  recap_id text primary key,
  date date not null,
  shift integer not null,
  cashier_staff_id text not null default '',
  status_majoo text not null default 'pending',
  total_hpp numeric not null default 0,
  recap_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_majoo_recaps_shift_check check (shift in (1, 2, 3)),
  constraint nomono_majoo_recaps_status_check check (status_majoo in ('pending', 'done')),
  constraint nomono_majoo_recaps_unique_shift unique (date, shift)
);

insert into public.nomono_shift_settings (shift, label, start_time, end_time, is_active)
values
  (1, 'Shift 1', '08:00', '12:00', true),
  (2, 'Shift 2', '12:00', '17:00', true),
  (3, 'Shift 3', '17:00', '22:00', true)
on conflict (shift) do nothing;

update public.nomono_vip_items
set unit = 'botol'
where unit = '';

update public.nomono_vip_sessions
set cashier_staff_id = coalesce((
  select staff_id
  from public.nomono_staff
  where staff_name = public.nomono_vip_sessions.staff_name
  limit 1
), '')
where cashier_staff_id = '';

update public.nomono_vip_sessions
set shift = case
  when coalesce(end_time, '') >= '12:00' and coalesce(end_time, '') < '17:00' then 2
  when coalesce(end_time, '') >= '17:00' then 3
  else 1
end
where shift is null or shift not in (1, 2, 3);

create index if not exists nomono_vip_sessions_shift_idx on public.nomono_vip_sessions(date, shift);
create index if not exists nomono_vip_sessions_recap_idx on public.nomono_vip_sessions(recap_id);
create index if not exists nomono_majoo_recaps_date_shift_idx on public.nomono_majoo_recaps(date, shift);

drop trigger if exists set_nomono_shift_settings_updated_at on public.nomono_shift_settings;
create trigger set_nomono_shift_settings_updated_at before update on public.nomono_shift_settings for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_majoo_recaps_updated_at on public.nomono_majoo_recaps;
create trigger set_nomono_majoo_recaps_updated_at before update on public.nomono_majoo_recaps for each row execute function public.set_updated_at();

alter table public.nomono_shift_settings enable row level security;
alter table public.nomono_majoo_recaps enable row level security;

drop policy if exists "anon full access nomono shift settings" on public.nomono_shift_settings;
create policy "anon full access nomono shift settings" on public.nomono_shift_settings for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono majoo recaps" on public.nomono_majoo_recaps;
create policy "anon full access nomono majoo recaps" on public.nomono_majoo_recaps for all to anon using (true) with check (true);
