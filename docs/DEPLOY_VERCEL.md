# Probar en Vercel

Hay dos maneras de probar. La **A** no necesita nada más; la **B** necesita un proyecto de Supabase.

## A. Demo de los formatos (sin Supabase, 2 minutos)

Carpeta `demo/` del repositorio: HTML estáticos con los formularios interactivos y el informe en el diseño Cobre.

1. En Vercel: **Add New → Project → Import** del repositorio de GitHub `CNAVEA98/Inspecciones_BBOSCH`.
2. Framework Preset: **Other**. Sin comando de build. **Root Directory: `demo`**.
3. Abra la URL: `/` (portada), `/inspecciones.html` (menú de formularios), `/informe.html`.

Todo corre en el navegador; el borrador se guarda en `localStorage` y el envío es simulado.

## B. La app completa (Next.js + Supabase)

### 1. Proyecto de Supabase (use uno de PRUEBA, no el de producción)

1. Cree un proyecto en supabase.com.
2. En **SQL Editor** pegue y ejecute, en este orden:
   1. Los archivos de `supabase/migrations/` del `0001` al `0006` (esquema, RLS, buckets privados y RPC).
   2. Del `supabase/seed.sql`, solo el catálogo y la plantilla (4 áreas, 5 equipos, 2 modos y la plantilla de 29 ítems);
      **no** ejecute el bloque «Usuarios de desarrollo» (crea cuentas con contraseñas conocidas).
3. **Authentication → Providers → Email**: para la prueba desactive «Confirm email» (si no, el registro exige confirmar el correo).
4. Cree usuarios (**Authentication → Users → Add user**, o regístrese en la app). Todos parten como `technician`.
5. Para hacer supervisor a alguien, ejecute en el SQL Editor:

   ```sql
   update public.profiles set role = 'supervisor'
   where id = (select id from auth.users where email = 'CORREO@EJEMPLO.CL');
   ```
6. **Project Settings → API**: copie `Project URL` y la clave `anon public`.

> Las migraciones `0001` a `0006` y el seed se aplicaron sin errores en Supabase local (2026-10-30), pero **no se han
> ejecutado en un proyecto Supabase remoto**. Si algún bloque falla, copie el mensaje de error y repórtelo.

### 2. Vercel

1. Importe el repositorio de GitHub `CNAVEA98/Inspecciones_BBOSCH` (Root Directory: la raíz del repo).
2. Framework: **Next.js** (se detecta solo). Gestor: pnpm (se toma de `packageManager` en `package.json`).
3. **Environment Variables** (Production y Preview):

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `anon public` |

   No se necesita la clave `service_role` todavía (solo la usará el PDF).
4. Deploy. Abra la URL y pruebe `/login`.

### 3. Qué se puede probar y qué no (estado a 2026-10-29)

| Se puede probar | Aún no existe |
|---|---|
| Registro e ingreso, redirección por rol | Service worker / instalación como PWA |
| Cambio de rol en `/supervisor/usuarios` | Bandeja del supervisor, aprobar/rechazar y firma |
| Flujo del técnico: Área → Equipo → Modo → formulario, fotos, firma, envío | PDF |
| Envío a la cola y a Supabase (revise las tablas `inspections`, `answers`, `attachments`) | Vista de las inspecciones ya enviadas |

Prueba de red apagada: con el formulario abierto, desactive la red del navegador (DevTools → Network → Offline), complete
y envíe; el indicador debe decir «Sin conexión, 1 guardada en el equipo» y enviarse al reconectar. Como aún no hay
service worker, **abra la inspección antes de cortar la red** y no recargue la página.

### 4. Seguridad

- Use un proyecto de Supabase de prueba. Las contraseñas de `supabase/seed.sql` (usuarios `@mlp.local`) son solo de desarrollo
  no deben ejecutarse en un Supabase remoto.
- No suba `.env*` a ningún repositorio.
