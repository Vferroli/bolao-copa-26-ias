-- Bolão Público — votação das IAs (sem login, identidade = anon_id no localStorage).
-- Duas mecânicas:
--   game_votes     : 1 voto por (anon_id, jogo) — qual IA o usuário acha que pontua mais.
--   champion_votes : 1 voto por anon_id — IA favorita pro título da Copa.
-- Identidade é um UUID gerado no cliente; não há auth. anon_id NÃO é segredo.
-- O "seu voto" mora no localStorage do cliente; o backend só agrega.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.game_votes (
  anon_id    uuid        not null,
  game_id    text        not null,
  ia         text        not null check (ia in ('claude','gpt','gemini','grok')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (anon_id, game_id)
);

create table if not exists public.champion_votes (
  anon_id    uuid        not null primary key,
  ia         text        not null check (ia in ('claude','gpt','gemini','grok')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices p/ agregação por IA.
create index if not exists game_votes_game_ia_idx     on public.game_votes (game_id, ia);
create index if not exists champion_votes_ia_idx      on public.champion_votes (ia);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists game_votes_touch on public.game_votes;
create trigger game_votes_touch
  before update on public.game_votes
  for each row execute function public.touch_updated_at();

drop trigger if exists champion_votes_touch on public.champion_votes;
create trigger champion_votes_touch
  before update on public.champion_votes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — anon pode inserir/atualizar (upsert), mas NÃO ler linhas cruas.
-- Leitura pública só via views agregadas (abaixo). Sem DELETE.
-- ---------------------------------------------------------------------------
alter table public.game_votes     enable row level security;
alter table public.champion_votes enable row level security;

drop policy if exists game_votes_insert on public.game_votes;
create policy game_votes_insert on public.game_votes
  for insert to anon with check (true);

drop policy if exists game_votes_update on public.game_votes;
create policy game_votes_update on public.game_votes
  for update to anon using (true) with check (true);

drop policy if exists champion_votes_insert on public.champion_votes;
create policy champion_votes_insert on public.champion_votes
  for insert to anon with check (true);

drop policy if exists champion_votes_update on public.champion_votes;
create policy champion_votes_update on public.champion_votes
  for update to anon using (true) with check (true);

-- Privilégios de tabela (RLS filtra por cima). return=minimal no cliente evita SELECT.
grant insert, update on public.game_votes     to anon;
grant insert, update on public.champion_votes to anon;

-- ---------------------------------------------------------------------------
-- Views agregadas (SECURITY DEFINER via security_invoker=off → ignoram RLS base).
-- Só contagens, zero PII. É o que o front lê p/ montar as barras %.
-- ---------------------------------------------------------------------------
create or replace view public.game_vote_tallies
with (security_invoker = off) as
  select game_id, ia, count(*)::int as votes
  from public.game_votes
  group by game_id, ia;

create or replace view public.champion_vote_tallies
with (security_invoker = off) as
  select ia, count(*)::int as votes
  from public.champion_votes
  group by ia;

grant select on public.game_vote_tallies     to anon;
grant select on public.champion_vote_tallies to anon;
