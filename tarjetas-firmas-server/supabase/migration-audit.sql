begin;
create table if not exists public.firmas_generadas_hyperesg (
    id uuid primary key default gen_random_uuid(),
    user_email text not null,
    plantilla text not null check (plantilla in ('ejecutiva', 'minimalista')),
    nombre text not null, rol text not null, correo text not null,
    telefono text not null, linkedin text,
    created_at timestamptz not null default now()
);
alter table public.firmas_generadas add column if not exists user_id uuid;
alter table public.firmas_generadas add column if not exists datos_ingresados jsonb;
alter table public.firmas_generadas_hyperesg add column if not exists user_id uuid;
alter table public.firmas_generadas_hyperesg add column if not exists datos_ingresados jsonb;

-- Identidad y fecha provienen del servidor, nunca del formulario.
create or replace function public.identificar_generacion_firma()
returns trigger language plpgsql set search_path = '' as $$
begin
    if auth.uid() is null
       or coalesce(auth.jwt()->'app_metadata'->>'provider', '') <> 'azure'
       or not coalesce(auth.jwt()->'amr' @> '[{"method":"oauth"}]'::jsonb, false)
       or coalesce(auth.jwt()->>'email', '') = '' then
        raise exception 'Se requiere sesión corporativa Microsoft' using errcode = '42501';
    end if;
    new.user_id := auth.uid();
    new.user_email := auth.jwt()->>'email';
    new.created_at := statement_timestamp();
    if new.datos_ingresados is null or jsonb_typeof(new.datos_ingresados) <> 'object'
       or not (new.datos_ingresados ?& array['nombre','rol','correo','telefono','linkedin','plantilla','foto_perfil'])
       or octet_length(new.datos_ingresados::text) > 2097152
       or jsonb_typeof(new.datos_ingresados->'nombre') <> 'string'
       or jsonb_typeof(new.datos_ingresados->'rol') <> 'string'
       or jsonb_typeof(new.datos_ingresados->'correo') <> 'string'
       or jsonb_typeof(new.datos_ingresados->'telefono') <> 'string'
       or jsonb_typeof(new.datos_ingresados->'linkedin') <> 'string'
       or jsonb_typeof(new.datos_ingresados->'plantilla') <> 'string'
       or jsonb_typeof(new.datos_ingresados->'foto_perfil') not in ('null','string') then
        raise exception 'Faltan los datos originales' using errcode = '23514';
    end if;
    return new;
end;
$$;
drop trigger if exists identificar_generacion on public.firmas_generadas;
create trigger identificar_generacion before insert on public.firmas_generadas
for each row execute function public.identificar_generacion_firma();
drop trigger if exists identificar_generacion on public.firmas_generadas_hyperesg;
create trigger identificar_generacion before insert on public.firmas_generadas_hyperesg
for each row execute function public.identificar_generacion_firma();
alter table public.firmas_generadas enable row level security;
alter table public.firmas_generadas_hyperesg enable row level security;
revoke all on table public.firmas_generadas, public.firmas_generadas_hyperesg from anon, authenticated;
grant insert on table public.firmas_generadas, public.firmas_generadas_hyperesg to authenticated;
drop policy if exists "solo azure del dominio fractal puede insertar" on public.firmas_generadas;
drop policy if exists "cualquier usuario azure del tenant puede insertar" on public.firmas_generadas_hyperesg;
drop policy if exists "registro propio azure" on public.firmas_generadas;
create policy "registro propio azure" on public.firmas_generadas for insert to authenticated
with check (
    user_id = auth.uid() and user_email = auth.jwt()->>'email'
    and auth.jwt()->'app_metadata'->>'provider' = 'azure'
    and auth.jwt()->'amr' @> '[{"method":"oauth"}]'::jsonb
    and lower(auth.jwt()->>'email') like '%@estrategiasfractal.com'
);
drop policy if exists "registro propio azure" on public.firmas_generadas_hyperesg;
create policy "registro propio azure" on public.firmas_generadas_hyperesg for insert to authenticated
with check (
    user_id = auth.uid() and user_email = auth.jwt()->>'email'
    and auth.jwt()->'app_metadata'->>'provider' = 'azure'
    and auth.jwt()->'amr' @> '[{"method":"oauth"}]'::jsonb
);
-- Los registros anteriores se preservan; no se inventa identidad histórica.
notify pgrst, 'reload schema';
commit;
