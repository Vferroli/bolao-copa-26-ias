# Supabase — Bolão Público

Backend só das **votações do público** (placares/resultados continuam em `dados.json` via GitHub). Isolado: tráfego de voto não toca o deploy do Netlify.

## Setup (1ª vez)
1. Cria projeto em supabase.com (região São Paulo).
2. Preenche `.env` na raiz (ver `.env.example`):
   - `SUPABASE_ACCESS_TOKEN` — Account > Access Tokens (segredo, p/ o MCP).
   - `SUPABASE_PROJECT_REF` — Project Settings > General > Reference ID.
   - `SUPABASE_URL` + `SUPABASE_ANON_KEY` — Project Settings > API (públicos, vão no front).
3. Reinicia o Claude Code p/ carregar o MCP `supabase` (definido em `.mcp.json`).

## Migrations
- Fonte da verdade: `supabase/migrations/*.sql` (versionado, timestamp no nome).
- Aplicar: o Claude aplica via MCP Supabase (`apply_migration`) — ou, com Supabase CLI linkado, `supabase db push`.
- Antes de criar/alterar schema, consultar o MCP p/ confirmar o estado real do remoto.

## Schema (v1 — `20260615153000_bolao_publico_votos.sql`)
- `game_votes` (PK `anon_id`+`game_id`) — voto por jogo.
- `champion_votes` (PK `anon_id`) — IA favorita pro título.
- `anon_id` = UUID no localStorage (sem login). "Seu voto" vive no cliente; backend só agrega.
- RLS: anon faz upsert (insert+update), sem ler linhas cruas nem deletar.
- Leitura pública só via views `game_vote_tallies` / `champion_vote_tallies` (contagens, zero PII).

## Front (cliente)
- Escreve com `Prefer: resolution=merge-duplicates, return=minimal` (upsert sem precisar de SELECT).
- Lê as views p/ as barras %. Esconde % até n≥5 (regra de produto, no front).
