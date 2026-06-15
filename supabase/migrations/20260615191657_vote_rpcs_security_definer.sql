-- Escrita de votos via RPC SECURITY DEFINER (roda como owner, bypassa RLS).
-- Motivo: upsert (merge-duplicates) via PostgREST exigiria policy de SELECT nas
-- tabelas base, o que exporia as linhas cruas. Com RPC, anon NÃO toca as tabelas
-- base (sem grants, sem policies) — só chama as funções e lê as views agregadas.
-- anon_id é fornecido pelo cliente (sem login); spoofar é possível mas é só um
-- bolão casual (anti-fraude leve, por design).

create or replace function public.cast_game_vote(p_anon uuid, p_game_id text, p_ia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ia not in ('claude','gpt','gemini','grok') then
    raise exception 'ia inválida: %', p_ia;
  end if;
  if p_game_id is null or length(p_game_id) = 0 or length(p_game_id) > 64 then
    raise exception 'game_id inválido';
  end if;
  insert into public.game_votes(anon_id, game_id, ia)
  values (p_anon, p_game_id, p_ia)
  on conflict (anon_id, game_id) do update set ia = excluded.ia, updated_at = now();
end;
$$;

create or replace function public.cast_champion_vote(p_anon uuid, p_ia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ia not in ('claude','gpt','gemini','grok') then
    raise exception 'ia inválida: %', p_ia;
  end if;
  insert into public.champion_votes(anon_id, ia)
  values (p_anon, p_ia)
  on conflict (anon_id) do update set ia = excluded.ia, updated_at = now();
end;
$$;

-- só anon (e authenticated) podem executar; público geral não.
revoke all on function public.cast_game_vote(uuid, text, text)     from public;
revoke all on function public.cast_champion_vote(uuid, text)        from public;
grant execute on function public.cast_game_vote(uuid, text, text)   to anon, authenticated;
grant execute on function public.cast_champion_vote(uuid, text)     to anon, authenticated;

-- fecha o acesso direto às tabelas base: escrita só via RPC, leitura só via views.
revoke select, insert, update on public.game_votes     from anon;
revoke select, insert, update on public.champion_votes from anon;
drop policy if exists game_votes_insert     on public.game_votes;
drop policy if exists game_votes_update     on public.game_votes;
drop policy if exists champion_votes_insert on public.champion_votes;
drop policy if exists champion_votes_update on public.champion_votes;
