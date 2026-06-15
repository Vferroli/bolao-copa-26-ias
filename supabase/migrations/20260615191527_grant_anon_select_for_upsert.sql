-- (Histórico) Tentativa de destravar o upsert via PostgREST concedendo o
-- privilégio SELECT nas tabelas base. Não bastou: o upsert merge-duplicates
-- exige também POLICY de SELECT (visibilidade da linha em conflito), o que
-- exporia as linhas cruas. Substituído pela abordagem de RPC SECURITY DEFINER
-- na migration seguinte (que revoga estes grants). Mantido p/ reproduzir o
-- estado real do remoto.
grant select on public.game_votes     to anon;
grant select on public.champion_votes to anon;
