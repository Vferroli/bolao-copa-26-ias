# CLAUDE.md — Bolão Copa 2026 · IAs

One-page (SPA estática) que acompanha um bolão da Copa 2026 entre 4 IAs (Claude, GPT, Gemini, Grok). Cada IA palpita o mesmo jogo; pontos por placar acertado. Sem build, sem framework.

## Stack e arquivos
- `index.html` — shell + modal "O que foi pedido às IAs".
- `assets/app.js` — load de dados, helpers, scoring (espelha REGRAS.md), logos das IAs, `bandeira()` (SVG flagcdn + mapa `ISO`).
- `assets/app-render.js` — render das seções + interações (modal, count-up, poll).
- `assets/style.css` — design dark "scoreboard", mobile-first.
- `dados.json` — TODO o estado (times, fases, jogos, palpites, real, live).
- `scripts/update-resultados.mjs` — busca placares na API e atualiza `dados.json`.
- `.github/workflows/resultados.yml` — roda o script (auto-corrente).
- `REGRAS.md` (pontuação), `PROMPT.md` (briefing enviado às IAs).

## ⚠️ Deploy / custo (LER ANTES DE COMMITAR)
- Site no **Netlify** (repo público). Netlify cobra **~15 créditos/deploy** (~300/ciclo → ~20 deploys).
- **NÃO fazer deploy sem autorização explícita do usuário.**
- `netlify.toml` tem `ignore`: só deploya quando **`index.html` ou `assets/**`** mudam. `dados.json`, workflow, scripts e `.md` **não** deployam.
- Mudanças de dados/placar/palpite: commitar com **`[skip ci]`** + push (sem deploy).
- Mudanças de código (index/assets): só após "ok" do usuário (gera deploy).

## Fluxo de dados (live)
- O front lê `dados.json` do **GitHub raw/CDN** (`raw.githubusercontent.com/.../main/dados.json?ts=`), não do Netlify → atualizar dado = só `git push`, sem deploy. Fallback: cópia same-origin.
- Poll adaptativo: 60s com jogo, 5min ocioso.

## Resultados (automático)
- Workflow roda `update-resultados.mjs`: **football-data.org** (primário, competição `WC`) com fallback **API-Football** (`league=1, season=2026`).
- Preenche `jogos[].real` (placar final), `jogos[].real.avancou` (mata-mata), **`jogos[].real.marcadores`** (lista de quem marcou, via API-Football `/fixtures/events`, p/ o bônus de artilheiro) e `live[]` (em jogo). Commits com `[skip ci]`.
- O schedule do GitHub é instável → o workflow faz loop ~50min e **se redispara** (auto-corrente) via secret `DISPATCH_PAT`. Para após 2026-07-20.
- Reiniciar corrente se parar: `gh workflow run "Atualizar resultados" --repo Vferroli/bolao-copa-26-ias`.
- Atualização manual sob demanda: `FOOTBALL_DATA_KEY=... node scripts/update-resultados.mjs` → commit `[skip ci]` → push.

## Palpites (manual)
- Vivem em `dados.json` → `jogos[].palpites = { claude:{casa,fora}, gpt:{...}, gemini:{...}, grok:{...} }`. Campos por IA: `casa`, `fora`, `avanca` (mata-mata) e **`marcador`** (palpite de artilheiro, string).
- **Artilheiro (`marcador`)**: nome do jogador que a IA crava p/ marcar. O scoring (`app.js`) já consome esse campo (compara com `real.marcadores` via Jaro-Winkler → **+3**) e o render (`app-render.js`) já mostra no chip. **Já está no `main`/deployado** — adicionar `marcador` é **só edição de dado (commit `[skip ci]`, NÃO gera deploy)**, não precisa mexer em `assets/**`. Ex.: `"claude": { "casa": 2, "fora": 1, "avanca": null, "marcador": "Vinícius Júnior" }`. Em palpite 0x0 o +3 não vale (deixe `marcador` ausente/null). Detalhes em `REGRAS.md` §4.
- Usuário envia os palpites; preencher no `dados.json`, commit `[skip ci]`, push. Sem UI de input (site é público).
- ⚠️ Antes de afirmar que um campo/feature "não existe", faça `git pull` no `main` e confira o código atual — o esquema evolui.

## Secrets (GitHub Actions)
- `FOOTBALL_DATA_KEY` (obrigatório), `DISPATCH_PAT` (corrente; fine-grained, Actions read+write), `API_FOOTBALL_KEY` (placar ao vivo + **`real.marcadores`** do bônus de artilheiro; sem ela o +3 fica dormente).

## Notas
- IDs de times = slugs em inglês (ex.: `ivory-coast`, `south-korea`). Bandeiras via flagcdn (mapa `ISO` em app.js; Inglaterra/Escócia = `gb-eng`/`gb-sct`).
- Mata-mata: datas em `fases[].inicio/.fim`; chaveamento (`secMata`) é placeholder até existir jogo de mata-mata no JSON.
- Formato 48 times: 2 primeiros + 8 melhores 3os avançam (marcação amarela nas tabelas).
