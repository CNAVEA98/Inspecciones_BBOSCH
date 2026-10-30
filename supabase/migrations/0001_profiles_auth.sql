-- Perfiles y roles. El rol NUNCA lo elige el usuario: el alta siempre crea 'technician'
-- y solo un supervisor (o el service role / SQL directo) puede cambiarlo.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'technician' check (role in ('technician', 'supervisor')),
  created_at timestamptz not null default now()
);

create function public.is_supervisor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'supervisor'
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.guard_profile_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null          -- null = service role o SQL directo
     and not public.is_supervisor() then
    raise exception 'Solo un supervisor puede cambiar el rol' using errcode = '42501';
  end if;
  new.id := old.id;
  return new;
end;
$$;

create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_supervisor());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_supervisor())
  with check (id = auth.uid() or public.is_supervisor());
-- Sin policy de INSERT/DELETE: los perfiles los crea solo el trigger de alta.
