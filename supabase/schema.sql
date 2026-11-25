-- =====================================================================
--  MIS DEUDAS · Esquema de base de datos para Supabase
--  Pegar TODO este archivo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tarjetas (con su ciclo de facturación) ----------
create table if not exists public.tarjetas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,                      -- ej. SAGA FALABELLA (JHONATAN)
  banco       text not null,                      -- ej. SAGA FALABELLA  (donde se paga)
  dia_cierre  int  not null check (dia_cierre between 1 and 31),  -- último día del ciclo
  dia_pago    int  not null check (dia_pago between 1 and 31),    -- día en que se paga
  meses_pago  int  not null default 1 check (meses_pago between 0 and 2), -- meses entre cierre y pago
  color       text not null default '#1f9d6b',
  activa      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Personas que usan las tarjetas ----------
create table if not exists public.personas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,
  activa      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Compras / consumos ----------
create table if not exists public.compras (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  persona_id          uuid not null references public.personas(id) on delete restrict,
  tarjeta_id          uuid not null references public.tarjetas(id) on delete restrict,
  descripcion         text not null default '',
  monto_total         numeric(12,2) not null check (monto_total >= 0),
  num_cuotas          int not null default 1 check (num_cuotas between 1 and 60),
  fecha_compra        date not null,
  primera_fecha_pago  date not null,
  pago_manual         boolean not null default false,   -- true si se cambió la fecha a mano
  importado           boolean not null default false,   -- viene del Excel antiguo
  cuota_ref           text,                             -- ej. '2/3' en registros importados
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Cuotas (una fila por mes a pagar) ----------
create table if not exists public.cuotas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  compra_id   uuid not null references public.compras(id) on delete cascade,
  numero      int not null,
  total       int not null,
  monto       numeric(12,2) not null,
  fecha_pago  date not null
);
create index if not exists cuotas_fecha_idx on public.cuotas(user_id, fecha_pago);
create index if not exists cuotas_compra_idx on public.cuotas(compra_id);

-- ---------- Estado de cuenta por banco y mes (monto que cobra el banco) ----------
create table if not exists public.estados_cuenta (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  banco        text not null,
  periodo      text not null,          -- 'YYYY-MM' (mes de pago)
  monto_banco  numeric(12,2),
  pagado       boolean not null default false,
  unique (user_id, banco, periodo)
);

-- ---------- Seguridad: cada usuario solo ve SUS datos ----------
alter table public.tarjetas       enable row level security;
alter table public.personas       enable row level security;
alter table public.compras        enable row level security;
alter table public.cuotas         enable row level security;
alter table public.estados_cuenta enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tarjetas','personas','compras','cuotas','estados_cuenta'] loop
    execute format('drop policy if exists "solo_dueno" on public.%I', t);
    execute format(
      'create policy "solo_dueno" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
