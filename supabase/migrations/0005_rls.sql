-- RLS en todas las tablas: el técnico ve solo sus inspecciones; el supervisor ve todas.

alter table public.inspections enable row level security;
alter table public.attachments enable row level security;
alter table public.answers enable row level security;
alter table public.findings enable row level security;
alter table public.signatures enable row level security;
alter table public.audit_log enable row level security;

-- inspections
create policy inspections_select on public.inspections for select to authenticated
  using (technician_id = auth.uid() or public.is_supervisor());
create policy inspections_insert on public.inspections for insert to authenticated
  with check (technician_id = auth.uid() and status = 'draft');
create policy inspections_update on public.inspections for update to authenticated
  using ((technician_id = auth.uid() and status = 'draft')
         or (public.is_supervisor() and status = 'submitted'))
  with check ((technician_id = auth.uid() and status in ('draft', 'submitted'))
              or (public.is_supervisor() and status in ('submitted', 'approved', 'rejected')));
-- Sin policy de DELETE: nadie elimina inspecciones.

-- Tablas hijas: lectura por dueño o supervisor; escritura solo del técnico dueño en borrador.
create policy attachments_select on public.attachments for select to authenticated
  using (exists (select 1 from public.inspections i where i.id = attachments.inspection_id
                 and (i.technician_id = auth.uid() or public.is_supervisor())));
create policy attachments_write on public.attachments for all to authenticated
  using (exists (select 1 from public.inspections i where i.id = attachments.inspection_id
                 and i.technician_id = auth.uid() and i.status = 'draft'))
  with check (exists (select 1 from public.inspections i where i.id = attachments.inspection_id
                      and i.technician_id = auth.uid() and i.status = 'draft'));

create policy answers_select on public.answers for select to authenticated
  using (exists (select 1 from public.inspections i where i.id = answers.inspection_id
                 and (i.technician_id = auth.uid() or public.is_supervisor())));
create policy answers_write on public.answers for all to authenticated
  using (exists (select 1 from public.inspections i where i.id = answers.inspection_id
                 and i.technician_id = auth.uid() and i.status = 'draft'))
  with check (exists (select 1 from public.inspections i where i.id = answers.inspection_id
                      and i.technician_id = auth.uid() and i.status = 'draft'));

create policy findings_select on public.findings for select to authenticated
  using (exists (select 1 from public.inspections i where i.id = findings.inspection_id
                 and (i.technician_id = auth.uid() or public.is_supervisor())));
create policy findings_write on public.findings for all to authenticated
  using (exists (select 1 from public.inspections i where i.id = findings.inspection_id
                 and i.technician_id = auth.uid() and i.status = 'draft'))
  with check (exists (select 1 from public.inspections i where i.id = findings.inspection_id
                      and i.technician_id = auth.uid() and i.status = 'draft'));

-- signatures: lectura dueño/supervisor; inserta solo un supervisor.
create policy signatures_select on public.signatures for select to authenticated
  using (exists (select 1 from public.inspections i where i.id = signatures.inspection_id
                 and (i.technician_id = auth.uid() or public.is_supervisor())));
create policy signatures_insert on public.signatures for insert to authenticated
  with check (public.is_supervisor() and signer_id = auth.uid());

-- audit_log: solo lectura para supervisor (escribe el trigger, que es security definer).
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_supervisor());

grant usage on sequence public.folio_seq to authenticated;

-- ---------- Storage: buckets privados ----------
insert into storage.buckets (id, name, public) values
  ('inspection-photos', 'inspection-photos', false),
  ('signatures', 'signatures', false),
  ('reports', 'reports', false)
on conflict (id) do update set public = false;

-- Fotos: ruta {technician_uid}/{inspection_id}/{archivo}. El técnico sube a su carpeta;
-- el supervisor lee todo. Se sube antes de que exista la fila de la inspección (offline).
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_supervisor()));

-- Firmas: ruta {inspection_id}/{archivo}. Sube solo un supervisor; leen dueño y supervisor.
create policy signatures_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'signatures' and public.is_supervisor());
create policy signatures_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and (
    public.is_supervisor() or exists (
      select 1 from public.inspections i
      where i.id::text = (storage.foldername(name))[1] and i.technician_id = auth.uid())));

-- Informes PDF: ruta {inspection_id}/{folio}.pdf. Los escribe el servidor (service role).
create policy reports_select on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (
    public.is_supervisor() or exists (
      select 1 from public.inspections i
      where i.id::text = (storage.foldername(name))[1] and i.technician_id = auth.uid())));
