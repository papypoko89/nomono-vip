create table if not exists public.nomono_roles (
  role_id text primary key,
  role_name text not null default '',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nomono_vip_items (
  id text primary key,
  name text not null default '',
  category text not null default 'Minuman',
  hpp numeric not null default 0,
  default_qty integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.nomono_staff (
  staff_id text primary key,
  staff_name text not null default '',
  role_id text not null default '',
  opening_template_id text not null default '',
  closing_template_id text not null default '',
  is_active boolean not null default true,
  permission_level text not null default 'Staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_staff_permission_level_check check (permission_level in ('Staff', 'Supervisor', 'Manager'))
);

create table if not exists public.nomono_checklist_templates (
  template_id text primary key,
  template_name text not null default '',
  template_type text not null default 'opening',
  role_id text not null default '',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_checklist_templates_type_check check (template_type in ('opening', 'closing', 'custom'))
);

create table if not exists public.nomono_checklist_template_items (
  template_item_id text primary key,
  template_id text not null references public.nomono_checklist_templates(template_id) on delete cascade,
  item_name text not null default '',
  item_description text not null default '',
  sort_order integer not null default 1,
  photo_required boolean not null default false,
  note_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nomono_vip_sessions (
  id text primary key,
  date date not null,
  start_time text not null default '',
  end_time text not null default '',
  booking_name text not null default '',
  room text not null default '',
  staff_name text not null default '',
  status text not null default 'completed',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_vip_sessions_status_check check (status in ('draft', 'completed'))
);

create table if not exists public.nomono_vip_session_items (
  id text primary key,
  session_id text not null references public.nomono_vip_sessions(id) on delete cascade,
  item_id text not null default '',
  item_name text not null default '',
  hpp numeric not null default 0,
  prepared_qty integer not null default 0,
  sealed_left_qty integer not null default 0,
  used_qty integer not null default 0,
  return_to_stock_qty integer not null default 0,
  total_cost numeric not null default 0,
  majoo_input_done boolean not null default false
);

create table if not exists public.nomono_checklist_runs (
  run_id text primary key,
  date date not null,
  staff_id text not null default '',
  staff_name text not null default '',
  role_id text not null default '',
  role_name text not null default '',
  template_id text not null default '',
  template_name text not null default '',
  template_type text not null default 'opening',
  status text not null default 'in_progress',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_checklist_runs_type_check check (template_type in ('opening', 'closing', 'custom')),
  constraint nomono_checklist_runs_status_check check (status in ('not_started', 'in_progress', 'completed', 'has_issue'))
);

create table if not exists public.nomono_checklist_run_items (
  run_item_id text primary key,
  run_id text not null references public.nomono_checklist_runs(run_id) on delete cascade,
  template_item_id text not null default '',
  issue_id text,
  item_name text not null default '',
  item_description text not null default '',
  status text not null default 'pending',
  note text not null default '',
  photo_url text not null default '',
  photo_thumbnail_url text not null default '',
  photo_file_name text,
  photo_required boolean not null default false,
  note_required boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_checklist_run_items_status_check check (status in ('pending', 'done', 'issue', 'skipped'))
);

create table if not exists public.nomono_photo_uploads (
  photo_id text primary key,
  run_id text not null default '',
  run_item_id text not null default '',
  staff_id text not null default '',
  staff_name text not null default '',
  file_name text not null default '',
  file_url text not null default '',
  thumbnail_url text not null default '',
  uploaded_at timestamptz not null default now()
);

create table if not exists public.nomono_issues (
  issue_id text primary key,
  source text not null default 'manual',
  source_id text not null default '',
  title text not null default '',
  description text not null default '',
  status text not null default 'open',
  priority text not null default 'medium',
  area text not null default '',
  related_checklist_run_id text not null default '',
  related_checklist_run_item_id text not null default '',
  created_by_name text not null default '',
  assigned_to_name text not null default '',
  photo_url text not null default '',
  photo_thumbnail_url text not null default '',
  resolved_at timestamptz,
  resolved_by_name text not null default '',
  closed_at timestamptz,
  closed_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomono_issues_source_check check (source in ('checklist', 'vip_complimentary', 'manual')),
  constraint nomono_issues_status_check check (status in ('open', 'in_progress', 'resolved', 'closed')),
  constraint nomono_issues_priority_check check (priority in ('low', 'medium', 'high', 'urgent'))
);

create table if not exists public.nomono_issue_comments (
  comment_id text primary key,
  issue_id text not null references public.nomono_issues(issue_id) on delete cascade,
  comment text not null default '',
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.nomono_settings (
  id text primary key default 'main',
  auto_sync boolean not null default true,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint nomono_settings_main_check check (id = 'main')
);

insert into public.nomono_settings (id, auto_sync)
values ('main', true)
on conflict (id) do nothing;

create index if not exists nomono_staff_role_idx on public.nomono_staff(role_id);
create index if not exists nomono_template_items_template_idx on public.nomono_checklist_template_items(template_id);
create index if not exists nomono_vip_sessions_date_idx on public.nomono_vip_sessions(date);
create index if not exists nomono_vip_session_items_session_idx on public.nomono_vip_session_items(session_id);
create index if not exists nomono_checklist_runs_date_idx on public.nomono_checklist_runs(date);
create index if not exists nomono_checklist_runs_staff_idx on public.nomono_checklist_runs(staff_id);
create index if not exists nomono_checklist_run_items_run_idx on public.nomono_checklist_run_items(run_id);
create index if not exists nomono_issues_status_idx on public.nomono_issues(status);
create index if not exists nomono_issue_comments_issue_idx on public.nomono_issue_comments(issue_id);

drop trigger if exists set_nomono_roles_updated_at on public.nomono_roles;
create trigger set_nomono_roles_updated_at before update on public.nomono_roles for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_vip_items_updated_at on public.nomono_vip_items;
create trigger set_nomono_vip_items_updated_at before update on public.nomono_vip_items for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_staff_updated_at on public.nomono_staff;
create trigger set_nomono_staff_updated_at before update on public.nomono_staff for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_checklist_templates_updated_at on public.nomono_checklist_templates;
create trigger set_nomono_checklist_templates_updated_at before update on public.nomono_checklist_templates for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_checklist_template_items_updated_at on public.nomono_checklist_template_items;
create trigger set_nomono_checklist_template_items_updated_at before update on public.nomono_checklist_template_items for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_vip_sessions_updated_at on public.nomono_vip_sessions;
create trigger set_nomono_vip_sessions_updated_at before update on public.nomono_vip_sessions for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_checklist_runs_updated_at on public.nomono_checklist_runs;
create trigger set_nomono_checklist_runs_updated_at before update on public.nomono_checklist_runs for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_checklist_run_items_updated_at on public.nomono_checklist_run_items;
create trigger set_nomono_checklist_run_items_updated_at before update on public.nomono_checklist_run_items for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_issues_updated_at on public.nomono_issues;
create trigger set_nomono_issues_updated_at before update on public.nomono_issues for each row execute function public.set_updated_at();

drop trigger if exists set_nomono_settings_updated_at on public.nomono_settings;
create trigger set_nomono_settings_updated_at before update on public.nomono_settings for each row execute function public.set_updated_at();

alter table public.nomono_roles enable row level security;
alter table public.nomono_vip_items enable row level security;
alter table public.nomono_staff enable row level security;
alter table public.nomono_checklist_templates enable row level security;
alter table public.nomono_checklist_template_items enable row level security;
alter table public.nomono_vip_sessions enable row level security;
alter table public.nomono_vip_session_items enable row level security;
alter table public.nomono_checklist_runs enable row level security;
alter table public.nomono_checklist_run_items enable row level security;
alter table public.nomono_photo_uploads enable row level security;
alter table public.nomono_issues enable row level security;
alter table public.nomono_issue_comments enable row level security;
alter table public.nomono_settings enable row level security;

drop policy if exists "anon full access nomono roles" on public.nomono_roles;
create policy "anon full access nomono roles" on public.nomono_roles for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono vip items" on public.nomono_vip_items;
create policy "anon full access nomono vip items" on public.nomono_vip_items for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono staff" on public.nomono_staff;
create policy "anon full access nomono staff" on public.nomono_staff for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono checklist templates" on public.nomono_checklist_templates;
create policy "anon full access nomono checklist templates" on public.nomono_checklist_templates for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono checklist template items" on public.nomono_checklist_template_items;
create policy "anon full access nomono checklist template items" on public.nomono_checklist_template_items for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono vip sessions" on public.nomono_vip_sessions;
create policy "anon full access nomono vip sessions" on public.nomono_vip_sessions for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono vip session items" on public.nomono_vip_session_items;
create policy "anon full access nomono vip session items" on public.nomono_vip_session_items for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono checklist runs" on public.nomono_checklist_runs;
create policy "anon full access nomono checklist runs" on public.nomono_checklist_runs for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono checklist run items" on public.nomono_checklist_run_items;
create policy "anon full access nomono checklist run items" on public.nomono_checklist_run_items for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono photo uploads" on public.nomono_photo_uploads;
create policy "anon full access nomono photo uploads" on public.nomono_photo_uploads for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono issues" on public.nomono_issues;
create policy "anon full access nomono issues" on public.nomono_issues for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono issue comments" on public.nomono_issue_comments;
create policy "anon full access nomono issue comments" on public.nomono_issue_comments for all to anon using (true) with check (true);

drop policy if exists "anon full access nomono settings" on public.nomono_settings;
create policy "anon full access nomono settings" on public.nomono_settings for all to anon using (true) with check (true);
