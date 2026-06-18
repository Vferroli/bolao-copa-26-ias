# CLAUDE.md — Bolão Copa 2026 · IAs

One-page (SPA estática) que acompanha um bolão da Copa 2026 entre 4 IAs (Claude, GPT, Gemini, Grok). Cada IA palpita o mesmo jogo; pontos por placar acertado. Sem build, sem framework.

## Stack e arquivos
- `index.html` — shell + modal "O que foi pedido às IAs".
- `assets/app.js` — load de dados, helpers, scoring (espelha REGRAS.md), logos das IAs, `bandeira()` (SVG flagcdn + mapa `ISO`).
- `assets/app-render.js` — render das seções + interações (modal, count-up, poll).
- `assets/style.css` — design dark "scoreboard", mobile-first.
- `dados.json` — TODO o estado (times, fases, jogos, palpites, real, live, **escalacoes**).
- `scripts/update-resultados.mjs` — busca placares/escalações nas APIs e atualiza `dados.json`. Live + gols/cartões/subs + marcadores via **ESPN** (grátis, sem cota); finais via football-data.org; escalações + **fallback do live** via Highlightly (`rotor()` = round-robin de chaves c/ leitura de cota). Estado efêmero em `.live-state.json` (gitignored).
- `.github/workflows/resultados.yml` — roda o script (auto-corrente).
- `REGRAS.md` (pontuação), `PROMPT.md` (briefing enviado às IAs).

## ⚠️ Deploy / custo (LER ANTES DE COMMITAR)
- Site no **Netlify** (repo público). Netlify cobra **~15 créditos/deploy** (~300/ciclo → ~20 deploys).
- **NÃO fazer deploy sem autorização explícita do usuário.**
- `netlify.toml` tem `ignore`: só deploya quando **`index.html` ou `assets/**`** mudam. `dados.json`, workflow, scripts e `.md` **não** deployam.
- Mudanças de dados/placar/palpite: commitar com **`[skip ci]`** + push (sem deploy).
- Mudanças de código (index/assets): só após "ok" do usuário (gera deploy).

## ⚠️ Teste real do front (OBRIGATÓRIO antes de commitar mudança em `index.html`/`assets/**`)
- **Toda alteração de front exige teste real meu**, não só syntax-check/leitura. Abrir o site internamente, **olhar o que foi feito e validar o comportamento** antes de propor commit/deploy.
- Como (headless, sem deps): server estático local (`node` http simples na raiz) → **Chrome headless** (`--headless=new --remote-debugging-port`) dirigido via **DevTools Protocol** (Node 22 tem `WebSocket` nativo). Validar: render dos componentes, **0 erros de console**, e o **caminho real** (ex.: clicar/disparar a ação e confirmar efeito — voto → RPC Supabase → view → UI).
- O front lê `dados.json` do GitHub raw e fala com o Supabase real → teste local exercita backend de verdade. **Limpar dados de teste** (via MCP Supabase) e encerrar chrome/server ao fim.
- Só depois de validado, reportar resultado e pedir o "ok" de deploy.

## Fluxo de dados (live)
- O front lê `dados.json` do **GitHub raw** (`raw.githubusercontent.com/.../main/dados.json`), não do Netlify → atualizar dado = só `git push`, sem deploy. `fetchDados`: raw → fallback cópia same-origin.
- ⚠️ **raw cacheia ~300s e IGNORA `?ts=`** (testado: X-Cache HIT) → dado fica no máx ~5min atrás. É o piso confiável e self-healing. **jsDelivr foi testado e DESCARTADO**: cacheia a resolução de `@main` por 12h e não solta nem com `purge.jsdelivr.net` (servia dado preso de ~50min). Não reintroduzir jsDelivr p/ esse arquivo.
- Poll adaptativo: **30s** com jogo, 5min ocioso. Pausa em aba oculta; `visibilitychange` força tick ao voltar.
- Percepção "ao vivo": carimbo relativo "há Xs" (tiquetaqueia 10s) + **flash no placar** quando muda entre renders (gol). Render global + classe `.score.flash`.

## Resultados (automático)
- Workflow roda `update-resultados.mjs`. **Finais**: football-data.org (primário, competição `WC`) com fallback API-Football (`league=1, season=2026`).
- **Ao vivo + gols/cartões/subs + marcadores = ESPN** (`site.api.espn.com/apis/site/v2/sports/soccer/fifa.world`, liga `fifa.world`): API pública **grátis, sem chave, sem cota**. `scoreboard?dates=YYYYMMDD` dá placar/minuto/status (`status.type.state === "in"` = ao vivo); `summary?event=ID` dá `keyEvents[]` (gol = `scoringPlay:true`, exceto `Own Goal`; cartão/substituição por `type.text`). 1 scoreboard/data + 1 summary/jogo-ao-vivo por run. Cache por-run em `cache={sb,sum}`; **nada persiste entre runs** (live precisa de dado fresco). Funções: `liveEspn`, `espnEventos`, `marcadoresEspn`.
- **Por que ESPN**: API-Football não cobre live da WC2026 (retornava 0 jogos) e as 6 chaves Highlightly estouravam a cota diária em dias de vários jogos. ESPN ilimitado resolve de vez. **Highlightly virou FALLBACK do live** (`liveHighlightly`+`enrichEventos`, via `rotor`): `tickLive` só cai p/ ela quando o ESPN FALHA (rede/endpoint fora) — uso raro, sem risco de cota. Highlightly segue também nas escalações.
- Nomes saem normalizados p/ **`"I. Sobrenome"`** (`abbrevNome`, ex.: "Lionel Messi" → "L. Messi"); de-para de seleções via `resolve()`/`ALIAS` (cobre "Congo DR", "Korea Republic" etc.; só placeholders TBD de chaveamento ficam fora).
- Preenche `jogos[].real` (placar final), `jogos[].real.avancou` (mata-mata), **`jogos[].real.marcadores`** (lista de quem marcou, via ESPN `summary.keyEvents`, p/ o bônus de artilheiro — gol contra não credita autor), **`jogos[].escalacoes`** (ver abaixo) e `live[]` (em jogo, com `gols/cartoes/subs`). Commits com `[skip ci]`.
- O schedule do GitHub é instável → o workflow faz loop ~50min e **se redispara** (auto-corrente) via secret `DISPATCH_PAT`. Para após 2026-07-20.
- Reiniciar corrente se parar: `gh workflow run "Atualizar resultados" --repo Vferroli/bolao-copa-26-ias`.
- Atualização manual sob demanda: `FOOTBALL_DATA_KEY=... node scripts/update-resultados.mjs` → commit `[skip ci]` → push. (Live/marcadores via ESPN rodam sem nenhuma chave.)
- **Verificar mapeamento de times**: num dia de jogo, ler o log do Actions. `live ESPN: N jogo(s)` confirma o live; `escalação … ok` confirma lineup salvo; **`? time não mapeado: ?(Nome)`** (finais) ou um jogo que não aparece no live = nome de seleção que não casou → adicionar entrada no mapa `ALIAS` do script (ex.: `"korea-republic": "south-korea"`).

## Escalações (automático)
- `jogos[].escalacoes` (opcional; só existe perto/depois do kickoff): `{ fonte, formacao:{casa,fora}, tecnico:{casa,fora}, casa:{titulares,reservas}, fora:{...} }`. Jogador = `{ num, nome, pos }`, `pos ∈ {G,D,M,F}`. **`tecnico` vem `null`** (endpoint Highlightly `/lineups` não expõe técnico).
- Fonte: **Highlightly** `/lineups/{matchId}` (mapeia matchId via `/matches`). Lineup sai ~30min antes do kickoff (máx +15min); busca na janela kickoff −25/+35min, **idempotente** (não rebusca se já existe) + backoff 5min/jogo.
- Front (`app-render.js`): acordeão "Escalações" nos cards live/a seguir/hoje (2 colunas casa|fora, titulares G→D→M→F, reservas, toggle Lista/Campo). Degrada gracioso: sem `escalacoes` → sem botão. **Já no `main`/deployado.**

## Palpites (manual)
- Vivem em `dados.json` → `jogos[].palpites = { claude:{casa,fora}, gpt:{...}, gemini:{...}, grok:{...} }`. Campos por IA: `casa`, `fora`, `avanca` (mata-mata) e **`marcador`** (palpite de artilheiro, string).
- **Artilheiro (`marcador`)**: nome do jogador que a IA crava p/ marcar. O scoring (`app.js`) já consome esse campo (compara com `real.marcadores` via Jaro-Winkler → **+3**) e o render (`app-render.js`) já mostra no chip. **Já está no `main`/deployado** — adicionar `marcador` é **só edição de dado (commit `[skip ci]`, NÃO gera deploy)**, não precisa mexer em `assets/**`. Ex.: `"claude": { "casa": 2, "fora": 1, "avanca": null, "marcador": "Vinícius Júnior" }`. Em palpite 0x0 o +3 não vale (deixe `marcador` ausente/null). Detalhes em `REGRAS.md` §4.
- Usuário envia os palpites; preencher no `dados.json`, commit `[skip ci]`, push. Sem UI de input (site é público).
- ⚠️ Antes de afirmar que um campo/feature "não existe", faça `git pull` no `main` e confira o código atual — o esquema evolui.

## Secrets (GitHub Actions)
- `FOOTBALL_DATA_KEY` (obrigatório; finais), `DISPATCH_PAT` (corrente; fine-grained, Actions read+write).
- **Live + marcadores = ESPN, sem chave** (não precisa de secret nenhum).
- **API-Football** (só fallback dos finais): `API_FOOTBALL_KEY`, `API_FOOTBALL_KEY_2`, `API_FOOTBALL_KEY_3` (rotação; contas c/ e-mails distintos). Não usado mais p/ live.
- **Highlightly**: `HIGHLIGHTLY_KEY` (escalações/lineups); `HIGHLIGHTLY_KEY_2..7` (**fallback do live**, rotor — só acionado quando o ESPN falha). Faltando chave dedicada, `rotor` cai pro pool inteiro.
- Todas opcionais exceto `FOOTBALL_DATA_KEY` — o código lê via `.filter(Boolean)` e degrada (sem Highlightly → sem escalações e sem fallback de live; live/finais/marcadores seguem via ESPN+football-data).

## Notas
- IDs de times = slugs em inglês (ex.: `ivory-coast`, `south-korea`). Bandeiras via flagcdn (mapa `ISO` em app.js; Inglaterra/Escócia = `gb-eng`/`gb-sct`).
- Mata-mata: datas em `fases[].inicio/.fim`; chaveamento (`secMata`) é placeholder até existir jogo de mata-mata no JSON.
- Formato 48 times: 2 primeiros + 8 melhores 3os avançam (marcação amarela nas tabelas).
