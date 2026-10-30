-- Catálogo data-driven: agregar un área, equipo o modo = INSERT, sin tocar código.

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

create table public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

create table public.work_modes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

alter table public.areas enable row level security;
alter table public.equipment_types enable row level security;
alter table public.work_modes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['areas', 'equipment_types', 'work_modes'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_supervisor()) with check (public.is_supervisor())', t || '_write', t);
  end loop;
end $$;
