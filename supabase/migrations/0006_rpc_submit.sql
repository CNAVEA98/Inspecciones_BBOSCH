-- RPC transaccionales e idempotentes (security invoker: RLS y guards siguen aplicando).

create function public.submit_inspection(p jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid := (p -> 'inspection' ->> 'id')::uuid;
  v_tpl uuid := (p -> 'inspection' ->> 'template_id')::uuid;
  v_row public.inspections;
begin
  -- Reintento de un envío que ya se completó: devolver lo existente, sin duplicar.
  select * into v_row from public.inspections where id = v_id;
  if found and v_row.status <> 'draft' then
    return jsonb_build_object('id', v_row.id, 'folio', v_row.folio, 'status', v_row.status, 'duplicate', true);
  end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p -> 'attachments', '[]'::jsonb)) as a(storage_path text)
    where a.storage_path not like auth.uid()::text || '/%'
  ) then
    raise exception 'Ruta de adjunto inválida' using errcode = '42501';
  end if;

  insert into public.inspections (id, area_id, equipment_type_id, work_mode_id, template_id,
                                  template_version, equipment_tag, started_at)
  select v_id,
         (p -> 'inspection' ->> 'area_id')::uuid,
         (p -> 'inspection' ->> 'equipment_type_id')::uuid,
         (p -> 'inspection' ->> 'work_mode_id')::uuid,
         v_tpl, ft.version,
         coalesce(p -> 'inspection' ->> 'equipment_tag', ''),
         coalesce((p -> 'inspection' ->> 'started_at')::timestamptz, now())
  from public.form_templates ft where ft.id = v_tpl
  on conflict (id) do update set equipment_tag = excluded.equipment_tag;

  delete from public.findings where inspection_id = v_id;
  delete from public.answers where inspection_id = v_id;

  insert into public.attachments (id, inspection_id, storage_path, kind, mime, size_bytes)
  select a.id, v_id, a.storage_path, coalesce(a.kind, 'photo'), coalesce(a.mime, 'image/jpeg'), a.size_bytes
  from jsonb_to_recordset(coalesce(p -> 'attachments', '[]'::jsonb))
    as a(id uuid, storage_path text, kind text, mime text, size_bytes int)
  on conflict (id) do nothing;

  insert into public.answers (inspection_id, item_key, value)
  select v_id, a.item_key, a.value
  from jsonb_to_recordset(coalesce(p -> 'answers', '[]'::jsonb)) as a(item_key text, value jsonb);

  insert into public.findings (id, inspection_id, item_key, severity, description, photo_attachment_id)
  select f.id, v_id, f.item_key, f.severity, coalesce(f.description, ''), f.photo_attachment_id
  from jsonb_to_recordset(coalesce(p -> 'findings', '[]'::jsonb))
    as f(id uuid, item_key text, severity text, description text, photo_attachment_id uuid);

  update public.inspections set status = 'submitted' where id = v_id returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'folio', v_row.folio, 'status', v_row.status, 'duplicate', false);
end;
$$;

create function public.review_inspection(
  p_id uuid, p_decision text, p_comment text, p_signature_path text
)
returns jsonb
language plpgsql
as $$
declare
  v_row public.inspections;
begin
  if not public.is_supervisor() then
    raise exception 'Solo un supervisor puede revisar' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisión inválida';
  end if;
  if coalesce(btrim(p_comment), '') = '' then
    raise exception 'El comentario es obligatorio';
  end if;

  insert into public.signatures (inspection_id, decision, comment, image_path)
  values (p_id, p_decision, p_comment, p_signature_path);

  update public.inspections
     set status = p_decision, review_comment = p_comment
   where id = p_id
   returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'folio', v_row.folio, 'status', v_row.status);
end;
$$;

grant execute on function public.submit_inspection(jsonb) to authenticated;
grant execute on function public.review_inspection(uuid, text, text, text) to authenticated;
