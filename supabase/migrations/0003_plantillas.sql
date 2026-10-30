-- Plantillas de formulario versionadas. Una versión publicada es inmutable:
-- para cambiar un formulario se inserta una versión nueva.

create table public.form_templates (
  id uuid primary key default gen_random_uuid(),
  equipment_type_id uuid not null references public.equipment_types (id),
  work_mode_id uuid not null references public.work_modes (id),
  version int not null check (version > 0),
  schema jsonb not null check (jsonb_typeof(schema) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (equipment_type_id, work_mode_id, version)
);

create function public.protect_published_template()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    raise exception 'La plantilla publicada es inmutable; cree una versión nueva' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger protect_published_template
  before update or delete on public.form_templates
  for each row execute function public.protect_published_template();

alter table public.form_templates enable row level security;

create policy form_templates_select on public.form_templates for select to authenticated
  using (status = 'published' or public.is_supervisor());
create policy form_templates_write on public.form_templates for all to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());

-- Combinaciones equipo × modo con su última plantilla publicada (null = sin plantilla).
create view public.catalog_combinations with (security_invoker = true) as
select
  et.id as equipment_type_id,
  wm.id as work_mode_id,
  (
    select ft.id from public.form_templates ft
    where ft.equipment_type_id = et.id and ft.work_mode_id = wm.id and ft.status = 'published'
    order by ft.version desc limit 1
  ) as template_id
from public.equipment_types et
cross join public.work_modes wm
where et.active and wm.active;
