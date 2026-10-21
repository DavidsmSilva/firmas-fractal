-- Tabla de auditoría: quién generó su firma y cuándo.
create table if not exists firmas_generadas (
    id uuid primary key default gen_random_uuid(),
    user_email text not null,
    nombre text not null,
    rol text not null,
    correo text not null,
    telefono text not null,
    linkedin text,
    created_at timestamptz not null default now()
);

alter table firmas_generadas enable row level security;

-- Grant base de Postgres: sin esto, Postgres deniega la operación antes de
-- siquiera evaluar la policy de RLS. Solo se otorga INSERT (no SELECT/UPDATE/
-- DELETE) — la policy de abajo decide CUÁLES inserts se permiten.
grant insert on table firmas_generadas to authenticated;

-- Solo usuarios autenticados vía Azure AD, con dominio @estrategiasfractal.com,
-- pueden insertar su propio registro. El provider y el email vienen del JWT
-- firmado por Supabase Auth, no son manipulables desde el cliente.
create policy "solo azure del dominio fractal puede insertar"
on firmas_generadas
for insert
to authenticated
with check (
    (auth.jwt() -> 'app_metadata' ->> 'provider') = 'azure'
    and (auth.jwt() ->> 'email') like '%@estrategiasfractal.com'
);

-- A propósito no se crea ninguna policy de SELECT/UPDATE/DELETE para "anon" ni
-- "authenticated": por defecto, con RLS habilitado y sin policy, la operación
-- queda denegada. Las consultas para ver quién generó su firma se hacen desde
-- el SQL Editor o el dashboard de Supabase (ahí se usa la service_role, que
-- ignora RLS), nunca desde el navegador.
