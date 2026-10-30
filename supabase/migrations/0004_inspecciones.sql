-- Inspecciones y tablas hijas. Los IDs son UUID generados en el cliente (idempotencia offline).

create sequence public.folio_seq;

create table public.inspections (
  id uuid primary key,
  folio text unique,
  area_id uuid not null references public.areas (id),
  equipment_type_id uuid not null references public.equipment_types (id),
  work_mode_id uuid not null references public.work_modes (id),
  template_id uuid not null references public.form_templates (id),
  template_version int not null,
  technician_id uuid not null default auth.uid() references public.profiles (id),
  equipment_tag text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  review_comment text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index inspections_technician_idx on public.inspections (technician_id);
create index inspections_status_idx on public.inspections (status, submitted_at desc);

create table public.attachments (
  id uuid primary key,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  storage_path text not null,
  kind text not null default 'photo' check (kind in ('photo', 'finding_photo', 'participant_signature')),
  mime text not null default 'image/jpeg',
  size_bytes int,
  created_at timestamptz not null default now()
);
create index attachments_inspection_idx on public.attachments (inspection_id);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  item_key text not null,
  value jsonb not null,
  unique (inspection_id, item_key)
);

create table public.findings (
  id uuid primary key,
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  item_key text not null,
  severity text not null check (severity in ('baja', 'media', 'alta', 'critica')),
  description text not null default '',
  photo_attachment_id uuid references public.attachments (id),
  created_at timestamptz not null default now()
);
create index findings_inspection_idx on public.findings (inspection_id);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null unique references public.inspections (id),
  signer_id uuid not null default auth.uid() references public.profiles (id),
  signed_at timestamptz not null default now(),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  image_path text not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid,
  action text not null,
  actor_id uuid,
  at timestamptz not null default now(),
  diff jsonb
);

-- ---------- Guard de transiciones e inmutabilidad ----------

create function public.guard_inspection()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las inspecciones no se pueden eliminar' using errcode = '42501';
  end if;

  if old.status in ('approved', 'rejected') then
    raise exception 'La inspección firmada es inmutable' using errcode = '42501';
  end if;

  if new.id <> old.id or new.technician_id <> old.technician_id then
    raise exception 'No se puede cambiar el identificador ni el técnico' using errcode = '42501';
  end if;

  if new.status = old.status then
    -- Sin transición: folio y datos de revisión no son editables.
    new.folio := old.folio;
    new.submitted_at := old.submitted_at;
    new.review_comment := old.review_comment;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'submitted' then
    if auth.uid() is not null and auth.uid() <> old.technician_id then
      raise exception 'Solo el técnico dueño puede enviar la inspección' using errcode = '42501';
    end if;
    new.folio := 'INS-' || to_char(now() at time zone 'America/Santiago', 'YYYY')
                 || '-' || lpad(nextval('public.folio_seq')::text, 6, '0');
    new.submitted_at := now();
    new.review_comment := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  if old.status = 'submitted' and new.status in ('approved', 'rejected') then
    if auth.uid() is not null and not public.is_supervisor() then
      raise exception 'Solo un supervisor puede revisar' using errcode = '42501';
    end if;
    if not exists (select 1 from public.signatures s where s.inspection_id = old.id) then
      raise exception 'La revisión requiere firma' using errcode = '42501';
    end if;
    new.folio := old.folio;
    new.submitted_at := old.submitted_at;
    new.reviewed_at := now();
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    return new;
  end if;

  raise exception 'Transición de estado no permitida: % -> %', old.status, new.status using errcode = '42501';
end;
$$;

create trigger guard_inspection
  before update or delete on public.inspections
  for each row execute function public.guard_inspection();

-- Tablas hijas: solo se escriben mientras la inspección está en borrador.
create function public.guard_child_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_id := old.inspection_id;
  else
    v_id := new.inspection_id;
  end if;
  select status into v_status from public.inspections where id = v_id;
  if v_status is distinct from 'draft' then
    raise exception 'La inspección no admite cambios (estado: %)', coalesce(v_status, 'inexistente')
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger guard_child_write before insert or update or delete on public.answers
  for each row execute function public.guard_child_write();
create trigger guard_child_write before insert or update or delete on public.findings
  for each row execute function public.guard_child_write();
create trigger guard_child_write before insert or update or delete on public.attachments
  for each row execute function public.guard_child_write();

create function public.guard_signature()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Las firmas son inmutables' using errcode = '42501';
  end if;
  if (select status from public.inspections where id = new.inspection_id) is distinct from 'submitted' then
    raise exception 'Solo se firma una inspección enviada' using errcode = '42501';
  end if;
  new.signer_id := coalesce(auth.uid(), new.signer_id);
  new.signed_at := now();
  return new;
end;
$$;

create trigger guard_signature before insert or update or delete on public.signatures
  for each row execute function public.guard_signature();

-- ---------- Auditoría ----------

create function public.log_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  insert into public.audit_log (table_name, row_id, action, actor_id, diff)
  values (
    tg_table_name,
    (v_row ->> 'id')::uuid,
    tg_op,
    auth.uid(),
    case when tg_op = 'UPDATE'
         then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
         else v_row end
  );
  return null;
end;
$$;

create trigger audit_inspections after insert or update on public.inspections
  for each row execute function public.log_audit();
create trigger audit_signatures after insert on public.signatures
  for each row execute function public.log_audit();
create trigger audit_form_templates after insert or update or delete on public.form_templates
  for each row execute function public.log_audit();
create trigger audit_profiles after update on public.profiles
  for each row execute function public.log_audit();

create function public.protect_audit_log()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log es solo de inserción' using errcode = '42501';
end;
$$;

create trigger protect_audit_log before update or delete on public.audit_log
  for each row execute function public.protect_audit_log();
