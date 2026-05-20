create or replace function public.nomono_safe_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if value is null or value = '' then
    return null;
  end if;

  return value::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function public.nomono_safe_date(value text)
returns date
language plpgsql
immutable
as $$
begin
  if value is null or value = '' then
    return current_date;
  end if;

  return value::date;
exception
  when others then
    return current_date;
end;
$$;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_roles (role_id, role_name, description, is_active, created_at, updated_at)
select
  value->>'roleId',
  coalesce(value->>'roleName', ''),
  coalesce(value->>'description', ''),
  coalesce((value->>'isActive')::boolean, true),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'roles', '[]'::jsonb)) value
where coalesce(value->>'roleId', '') <> ''
on conflict (role_id) do update set
  role_name = excluded.role_name,
  description = excluded.description,
  is_active = excluded.is_active,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_vip_items (id, name, category, hpp, default_qty, active)
select
  value->>'id',
  coalesce(value->>'name', ''),
  coalesce(value->>'category', 'Minuman'),
  coalesce((value->>'hpp')::numeric, 0),
  coalesce((value->>'defaultQty')::integer, 0),
  coalesce((value->>'active')::boolean, true)
from legacy_state, jsonb_array_elements(coalesce(data->'items', '[]'::jsonb)) value
where coalesce(value->>'id', '') <> ''
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  hpp = excluded.hpp,
  default_qty = excluded.default_qty,
  active = excluded.active;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_checklist_templates (
  template_id,
  template_name,
  template_type,
  role_id,
  description,
  is_active,
  created_at,
  updated_at
)
select
  value->>'templateId',
  coalesce(value->>'templateName', ''),
  case when value->>'templateType' in ('opening', 'closing', 'custom') then value->>'templateType' else 'opening' end,
  coalesce(value->>'roleId', ''),
  coalesce(value->>'description', ''),
  coalesce((value->>'isActive')::boolean, true),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'checklistTemplates', '[]'::jsonb)) value
where coalesce(value->>'templateId', '') <> ''
on conflict (template_id) do update set
  template_name = excluded.template_name,
  template_type = excluded.template_type,
  role_id = excluded.role_id,
  description = excluded.description,
  is_active = excluded.is_active,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_staff (
  staff_id,
  staff_name,
  role_id,
  opening_template_id,
  closing_template_id,
  is_active,
  permission_level,
  created_at,
  updated_at
)
select
  value->>'staffId',
  coalesce(value->>'staffName', ''),
  coalesce(value->>'roleId', ''),
  coalesce(value->>'openingTemplateId', ''),
  coalesce(value->>'closingTemplateId', ''),
  coalesce((value->>'isActive')::boolean, true),
  case when value->>'permissionLevel' in ('Staff', 'Supervisor', 'Manager') then value->>'permissionLevel' else 'Staff' end,
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'staff', '[]'::jsonb)) value
where coalesce(value->>'staffId', '') <> ''
on conflict (staff_id) do update set
  staff_name = excluded.staff_name,
  role_id = excluded.role_id,
  opening_template_id = excluded.opening_template_id,
  closing_template_id = excluded.closing_template_id,
  is_active = excluded.is_active,
  permission_level = excluded.permission_level,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_checklist_template_items (
  template_item_id,
  template_id,
  item_name,
  item_description,
  sort_order,
  photo_required,
  note_required,
  is_active,
  created_at,
  updated_at
)
select
  value->>'templateItemId',
  coalesce(value->>'templateId', ''),
  coalesce(value->>'itemName', ''),
  coalesce(value->>'itemDescription', ''),
  coalesce((value->>'sortOrder')::integer, 1),
  coalesce((value->>'photoRequired')::boolean, false),
  coalesce((value->>'noteRequired')::boolean, false),
  coalesce((value->>'isActive')::boolean, true),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'checklistTemplateItems', '[]'::jsonb)) value
where coalesce(value->>'templateItemId', '') <> ''
on conflict (template_item_id) do update set
  template_id = excluded.template_id,
  item_name = excluded.item_name,
  item_description = excluded.item_description,
  sort_order = excluded.sort_order,
  photo_required = excluded.photo_required,
  note_required = excluded.note_required,
  is_active = excluded.is_active,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_vip_sessions (
  id,
  date,
  start_time,
  end_time,
  booking_name,
  room,
  staff_name,
  status,
  notes,
  created_at,
  updated_at
)
select
  value->>'id',
  public.nomono_safe_date(value->>'date'),
  coalesce(value->>'startTime', ''),
  coalesce(value->>'endTime', ''),
  coalesce(value->>'bookingName', ''),
  coalesce(value->>'room', ''),
  coalesce(value->>'staffName', ''),
  case when value->>'status' in ('draft', 'completed') then value->>'status' else 'completed' end,
  coalesce(value->>'notes', ''),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'sessions', '[]'::jsonb)) value
where coalesce(value->>'id', '') <> ''
on conflict (id) do update set
  date = excluded.date,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  booking_name = excluded.booking_name,
  room = excluded.room,
  staff_name = excluded.staff_name,
  status = excluded.status,
  notes = excluded.notes,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_vip_session_items (
  id,
  session_id,
  item_id,
  item_name,
  hpp,
  prepared_qty,
  sealed_left_qty,
  used_qty,
  return_to_stock_qty,
  total_cost,
  majoo_input_done
)
select
  item->>'id',
  session->>'id',
  coalesce(item->>'itemId', ''),
  coalesce(item->>'itemName', ''),
  coalesce((item->>'hpp')::numeric, 0),
  coalesce((item->>'preparedQty')::integer, 0),
  coalesce((item->>'sealedLeftQty')::integer, 0),
  coalesce((item->>'usedQty')::integer, 0),
  coalesce((item->>'returnToStockQty')::integer, 0),
  coalesce((item->>'totalCost')::numeric, 0),
  coalesce((item->>'majooInputDone')::boolean, false)
from legacy_state,
  jsonb_array_elements(coalesce(data->'sessions', '[]'::jsonb)) session,
  jsonb_array_elements(coalesce(session->'items', '[]'::jsonb)) item
where coalesce(item->>'id', '') <> ''
  and coalesce(session->>'id', '') <> ''
on conflict (id) do update set
  session_id = excluded.session_id,
  item_id = excluded.item_id,
  item_name = excluded.item_name,
  hpp = excluded.hpp,
  prepared_qty = excluded.prepared_qty,
  sealed_left_qty = excluded.sealed_left_qty,
  used_qty = excluded.used_qty,
  return_to_stock_qty = excluded.return_to_stock_qty,
  total_cost = excluded.total_cost,
  majoo_input_done = excluded.majoo_input_done;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_checklist_runs (
  run_id,
  date,
  staff_id,
  staff_name,
  role_id,
  role_name,
  template_id,
  template_name,
  template_type,
  status,
  started_at,
  completed_at,
  created_at,
  updated_at
)
select
  value->>'runId',
  public.nomono_safe_date(value->>'date'),
  coalesce(value->>'staffId', ''),
  coalesce(value->>'staffName', ''),
  coalesce(value->>'roleId', ''),
  coalesce(value->>'roleName', ''),
  coalesce(value->>'templateId', ''),
  coalesce(value->>'templateName', ''),
  case when value->>'templateType' in ('opening', 'closing', 'custom') then value->>'templateType' else 'opening' end,
  case when value->>'status' in ('not_started', 'in_progress', 'completed', 'has_issue') then value->>'status' else 'in_progress' end,
  public.nomono_safe_timestamptz(value->>'startedAt'),
  public.nomono_safe_timestamptz(value->>'completedAt'),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'checklistRuns', '[]'::jsonb)) value
where coalesce(value->>'runId', '') <> ''
on conflict (run_id) do update set
  date = excluded.date,
  staff_id = excluded.staff_id,
  staff_name = excluded.staff_name,
  role_id = excluded.role_id,
  role_name = excluded.role_name,
  template_id = excluded.template_id,
  template_name = excluded.template_name,
  template_type = excluded.template_type,
  status = excluded.status,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_checklist_run_items (
  run_item_id,
  run_id,
  template_item_id,
  issue_id,
  item_name,
  item_description,
  status,
  note,
  photo_url,
  photo_thumbnail_url,
  photo_file_name,
  photo_required,
  note_required,
  completed_at,
  created_at,
  updated_at
)
select
  value->>'runItemId',
  coalesce(value->>'runId', ''),
  coalesce(value->>'templateItemId', ''),
  nullif(value->>'issueId', ''),
  coalesce(value->>'itemName', ''),
  coalesce(value->>'itemDescription', ''),
  case when value->>'status' in ('pending', 'done', 'issue', 'skipped') then value->>'status' else 'pending' end,
  coalesce(value->>'note', ''),
  coalesce(value->>'photoUrl', ''),
  coalesce(value->>'photoThumbnailUrl', ''),
  nullif(value->>'photoFileName', ''),
  coalesce((value->>'photoRequired')::boolean, false),
  coalesce((value->>'noteRequired')::boolean, false),
  public.nomono_safe_timestamptz(value->>'completedAt'),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'checklistRunItems', '[]'::jsonb)) value
where coalesce(value->>'runItemId', '') <> ''
on conflict (run_item_id) do update set
  run_id = excluded.run_id,
  template_item_id = excluded.template_item_id,
  issue_id = excluded.issue_id,
  item_name = excluded.item_name,
  item_description = excluded.item_description,
  status = excluded.status,
  note = excluded.note,
  photo_url = excluded.photo_url,
  photo_thumbnail_url = excluded.photo_thumbnail_url,
  photo_file_name = excluded.photo_file_name,
  photo_required = excluded.photo_required,
  note_required = excluded.note_required,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_photo_uploads (
  photo_id,
  run_id,
  run_item_id,
  staff_id,
  staff_name,
  file_name,
  file_url,
  thumbnail_url,
  uploaded_at
)
select
  value->>'photoId',
  coalesce(value->>'runId', ''),
  coalesce(value->>'runItemId', ''),
  coalesce(value->>'staffId', ''),
  coalesce(value->>'staffName', ''),
  coalesce(value->>'fileName', ''),
  coalesce(value->>'fileUrl', ''),
  coalesce(value->>'thumbnailUrl', ''),
  coalesce(public.nomono_safe_timestamptz(value->>'uploadedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'photoUploads', '[]'::jsonb)) value
where coalesce(value->>'photoId', '') <> ''
on conflict (photo_id) do update set
  run_id = excluded.run_id,
  run_item_id = excluded.run_item_id,
  staff_id = excluded.staff_id,
  staff_name = excluded.staff_name,
  file_name = excluded.file_name,
  file_url = excluded.file_url,
  thumbnail_url = excluded.thumbnail_url,
  uploaded_at = excluded.uploaded_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_issues (
  issue_id,
  source,
  source_id,
  title,
  description,
  status,
  priority,
  area,
  related_checklist_run_id,
  related_checklist_run_item_id,
  created_by_name,
  assigned_to_name,
  photo_url,
  photo_thumbnail_url,
  resolved_at,
  resolved_by_name,
  closed_at,
  closed_by_name,
  created_at,
  updated_at
)
select
  value->>'issueId',
  case when value->>'source' in ('checklist', 'vip_complimentary', 'manual') then value->>'source' else 'manual' end,
  coalesce(value->>'sourceId', ''),
  coalesce(value->>'title', ''),
  coalesce(value->>'description', ''),
  case when value->>'status' in ('open', 'in_progress', 'resolved', 'closed') then value->>'status' else 'open' end,
  case when value->>'priority' in ('low', 'medium', 'high', 'urgent') then value->>'priority' else 'medium' end,
  coalesce(value->>'area', ''),
  coalesce(value->>'relatedChecklistRunId', ''),
  coalesce(value->>'relatedChecklistRunItemId', ''),
  coalesce(value->>'createdByName', ''),
  coalesce(value->>'assignedToName', ''),
  coalesce(value->>'photoUrl', ''),
  coalesce(value->>'photoThumbnailUrl', ''),
  public.nomono_safe_timestamptz(value->>'resolvedAt'),
  coalesce(value->>'resolvedByName', ''),
  public.nomono_safe_timestamptz(value->>'closedAt'),
  coalesce(value->>'closedByName', ''),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now()),
  coalesce(public.nomono_safe_timestamptz(value->>'updatedAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'issues', '[]'::jsonb)) value
where coalesce(value->>'issueId', '') <> ''
on conflict (issue_id) do update set
  source = excluded.source,
  source_id = excluded.source_id,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  priority = excluded.priority,
  area = excluded.area,
  related_checklist_run_id = excluded.related_checklist_run_id,
  related_checklist_run_item_id = excluded.related_checklist_run_item_id,
  created_by_name = excluded.created_by_name,
  assigned_to_name = excluded.assigned_to_name,
  photo_url = excluded.photo_url,
  photo_thumbnail_url = excluded.photo_thumbnail_url,
  resolved_at = excluded.resolved_at,
  resolved_by_name = excluded.resolved_by_name,
  closed_at = excluded.closed_at,
  closed_by_name = excluded.closed_by_name,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_issue_comments (comment_id, issue_id, comment, created_by_name, created_at)
select
  value->>'commentId',
  coalesce(value->>'issueId', ''),
  coalesce(value->>'comment', ''),
  coalesce(value->>'createdByName', ''),
  coalesce(public.nomono_safe_timestamptz(value->>'createdAt'), now())
from legacy_state, jsonb_array_elements(coalesce(data->'issueComments', '[]'::jsonb)) value
where coalesce(value->>'commentId', '') <> ''
on conflict (comment_id) do update set
  issue_id = excluded.issue_id,
  comment = excluded.comment,
  created_by_name = excluded.created_by_name,
  created_at = excluded.created_at;

with legacy_state as (
  select data
  from public.nomono_app_state
  where id = 'main'
)
insert into public.nomono_settings (id, auto_sync, last_synced_at)
select
  'main',
  coalesce(((data->'sync')->>'autoSync')::boolean, true),
  public.nomono_safe_timestamptz((data->'sync')->>'lastSyncedAt')
from legacy_state
on conflict (id) do update set
  auto_sync = excluded.auto_sync,
  last_synced_at = excluded.last_synced_at;
