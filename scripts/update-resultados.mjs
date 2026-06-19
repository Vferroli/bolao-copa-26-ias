#!/usr/bin/env node
/* ============================================================
   Bolão Copa 2026 · IAs — atualizador de resultados
   Lê dados.json, busca placares/escalações nas APIs e preenche:
     - jogos[].real.casa / .fora / .avancou (jogos encerrados)
     - jogos[].real.marcadores (quem marcou, p/ bônus de artilheiro)
     - jogos[].escalacoes (titulares/reservas/formação, via Highlightly)
     - live[]  (jogos em andamento: placar + minuto)

   Provedores (free):
     - football-data.org      → finais (primário; sem ao vivo no free).
     - API-Football (3 chaves)→ ao vivo (fonte 1) + marcadores + fallback finais.
     - Highlightly (3 chaves) → ao vivo (fonte 2) + escalações. Host direto
                                soccer.highlightly.net, header X-RapidAPI-Key,
                                WC 2026 leagueId=1635.

   Rotação de chaves: afFetch/hlFetch fazem round-robin entre as chaves de cada
   provedor, leem a cota restante do header e pulam chave esgotada. Live alterna
   entre API-Football e Highlightly a cada poll, com intervalo ADAPTATIVO ao
   orçamento (mais rápido com cota sobrando, mais lento perto de acabar).

   Roda no GitHub Actions em loop (~55s). Sem dependências externas (fetch nativo).
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const DADOS = join(__dir, "..", "dados.json");
const STATE = join(__dir, "..", ".live-state.json"); // efêmero por-run (não commitado)

const FD_KEY = process.env.FOOTBALL_DATA_KEY || "";

const AF_KEYS = [
  process.env.API_FOOTBALL_KEY,
  process.env.API_FOOTBALL_KEY_2,
  process.env.API_FOOTBALL_KEY_3,
].filter(Boolean);

const HL_ALL = [
  process.env.HIGHLIGHTLY_KEY,
  process.env.HIGHLIGHTLY_KEY_2,
  process.env.HIGHLIGHTLY_KEY_3,
  process.env.HIGHLIGHTLY_KEY_4,
  process.env.HIGHLIGHTLY_KEY_5,
  process.env.HIGHLIGHTLY_KEY_6,
  process.env.HIGHLIGHTLY_KEY_7,
].filter(Boolean);
// Live + marcadores migraram p/ ESPN (sem cota). Highlightly ficou em 2 papéis:
// KEY → escalações/lineups; KEY_2.._7 → FALLBACK do live (só quando o ESPN falha,
// uso raro → não estoura cota). Faltando chave dedicada, cai no pool inteiro.
const HL_LINEUP_KEYS = [process.env.HIGHLIGHTLY_KEY].filter(Boolean);
const HL_LIVE_KEYS = [
  process.env.HIGHLIGHTLY_KEY_2,
  process.env.HIGHLIGHTLY_KEY_3,
  process.env.HIGHLIGHTLY_KEY_4,
  process.env.HIGHLIGHTLY_KEY_5,
  process.env.HIGHLIGHTLY_KEY_6,
  process.env.HIGHLIGHTLY_KEY_7,
].filter(Boolean);
const hlLineupKeys = HL_LINEUP_KEYS.length ? HL_LINEUP_KEYS : HL_ALL;
const hlLiveKeys = HL_LIVE_KEYS.length ? HL_LIVE_KEYS : HL_ALL;

const HL_BASE = "https://soccer.highlightly.net";
const WC_LEAGUE_HL = 1635; // FIFA World Cup 2026 (Highlightly)

// Supabase: espelha o live[] numa linha (id=1) p/ entrega via Realtime ao front
// (push, sem cache do raw). service_role escreve; anon só lê. Degrada sem a key.
const SB_URL = "https://lnwjafoycccjapxmyumt.supabase.co";
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY_BOLAO || "";
async function pushLiveSupabase(live) {
  if (!SB_SERVICE_KEY) return;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/live_state?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: "Bearer " + SB_SERVICE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ payload: live, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) console.log(`supabase live push: HTTP ${r.status} ${(await r.text()).slice(0, 140)}`);
    else console.log(`supabase live push: ${live.length} jogo(s)`);
  } catch (e) { console.log("supabase live push erro:", e.message); }
}

/* janela: só consulta jogos sem placar com kickoff entre -ATRAS e +30min.
   JANELA_ATRAS_H sobrescreve o padrão (ex.: 240 p/ backfill inicial). */
const ATRAS_MS = (Number(process.env.JANELA_ATRAS_H) || 48) * 3600 * 1000;
const FRENTE_MS = 30 * 60 * 1000;

const apurado = (j) => j.real && j.real.casa != null && j.real.fora != null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- de-para de seleções (provider name -> meu id) ---------- */
const slug = (s) =>
  String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* aliases: slug do nome do provedor -> meu id (só os que diferem do slug do id) */
const ALIAS = {
  "cote-divoire": "ivory-coast",
  "cote-d-ivoire": "ivory-coast",
  "korea-republic": "south-korea",
  "republic-of-korea": "south-korea",
  "korea-south": "south-korea",
  "ir-iran": "iran",
  "iran-islamic-republic": "iran",
  "czechia": "czech-republic",
  "turkiye": "turkey",
  "united-states": "usa",
  "united-states-of-america": "usa",
  "congo-dr": "dr-congo",
  "democratic-republic-of-congo": "dr-congo",
  "congo-democratic-republic": "dr-congo",
  "bosnia-and-herzegovina": "bosnia-herzegovina",
  "cabo-verde": "cape-verde",
  "cape-verde-islands": "cape-verde",
  "cabo-verde-islands": "cape-verde",
  "cap-vert": "cape-verde",
  "holland": "netherlands",
};

function buildResolver(times) {
  const ids = new Set(Object.keys(times));
  const byName = {}; // slug(nome pt) -> id
  for (const [id, t] of Object.entries(times)) byName[slug(t.nome)] = id;
  return (nome) => {
    if (!nome) return null;
    const s = slug(nome);
    if (ids.has(s)) return s; // slug == id (cobre a maioria)
    if (ALIAS[s]) return ALIAS[s];
    if (byName[s]) return byName[s]; // bateu com o nome pt
    return null;
  };
}

/* ---------- rotação de chaves + cota ----------
   rotor(keys, header, slot, state) -> async (url) => Response|null.
   Round-robin: começa no cursor, pula chave c/ cota ~0, lê a cota do header e
   persiste em state[slot].rem[i]. Retorna null quando todas esgotadas. */
const REM_HEADERS = [
  "x-ratelimit-requests-remaining", // API-Football (diário) e RapidAPI
  "x-ratelimit-remaining",
  "ratelimit-remaining",
  "x-requests-available",
];
const remOf = (r) => {
  for (const h of REM_HEADERS) {
    const v = r.headers.get(h);
    if (v != null && v !== "") return Number(v);
  }
  return null;
};

function rotor(keys, headerName, slot, state) {
  if (!state[slot]) state[slot] = { cur: 0, rem: {} };
  const s = state[slot];
  return async (url) => {
    if (!keys.length) return null;
    for (let n = 0; n < keys.length; n++) {
      const i = (s.cur + n) % keys.length;
      if ((s.rem[i] ?? 999) <= 2) continue; // chave esgotada -> pula
      let r;
      try {
        r = await fetch(url, { headers: { [headerName]: keys[i] } });
      } catch (e) {
        console.log(`${slot}: chave ${i + 1} fetch erro: ${e.message}`);
        continue;
      }
      const rem = remOf(r);
      if (rem != null) s.rem[i] = rem;
      s.cur = (i + 1) % keys.length; // avança o round-robin
      if (r.status === 429) { s.rem[i] = 0; console.log(`${slot}: chave ${i + 1} 429 -> esgotada`); continue; }
      return r;
    }
    return null; // todas as chaves sem cota
  };
}

/* ---------- finais: football-data.org (primário) ----------
   normaliza p/ {homeId, awayId, status, h, a, winnerId, min}
   status: "LIVE" | "FINISHED" | "OTHER" */
async function fetchFootballData(dates, resolve) {
  if (!FD_KEY) return null;
  const from = dates[0], to = dates[dates.length - 1];
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${from}&dateTo=${to}`;
  let r = await fetch(url, { headers: { "X-Auth-Token": FD_KEY } });
  if (r.status === 429) { // respeita o ratelimiter: 429 -> espera e tenta 1x
    const wait = (Number(r.headers.get("retry-after")) || 60) * 1000;
    console.log(`football-data 429: aguardando ${wait / 1000}s`);
    await sleep(wait);
    r = await fetch(url, { headers: { "X-Auth-Token": FD_KEY } });
  }
  if (!r.ok) throw new Error(`football-data ${r.status}`);
  const rest = r.headers.get("x-requests-available-minute");
  if (rest != null && Number(rest) <= 1) console.log(`football-data: cota baixa (${rest}/min restante)`);
  const data = await r.json();
  const LIVE = new Set(["IN_PLAY", "PAUSED", "LIVE"]);
  return (data.matches || []).map((m) => {
    const st = m.status;
    const ft = m.score?.fullTime || {};
    const win = m.score?.winner;
    const homeRaw = m.homeTeam?.name || m.homeTeam?.shortName;
    const awayRaw = m.awayTeam?.name || m.awayTeam?.shortName;
    const homeId = resolve(homeRaw);
    const awayId = resolve(awayRaw);
    return {
      homeId, awayId, homeRaw, awayRaw,
      status: st === "FINISHED" ? "FINISHED" : LIVE.has(st) ? "LIVE" : "OTHER",
      h: ft.home, a: ft.away,
      min: m.minute != null ? `${m.minute}'` : (st === "PAUSED" ? "INT" : ""),
      winnerId: win === "HOME_TEAM" ? homeId : win === "AWAY_TEAM" ? awayId : null,
    };
  });
}

/* finais: fallback API-Football (rotação de chaves) */
async function fetchApiFootball(dates, resolve, afFetch) {
  if (!AF_KEYS.length) return null;
  const out = [];
  for (const date of dates) {
    const url = `https://v3.football.api-sports.io/fixtures?date=${date}&league=1&season=2026`;
    const r = await afFetch(url);
    if (!r) { console.log("api-football fixtures: sem cota"); continue; }
    if (!r.ok) throw new Error(`api-football ${r.status}`);
    const data = await r.json();
    const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
    const FIN = new Set(["FT", "AET", "PEN"]);
    for (const fx of data.response || []) {
      const sh = fx.fixture?.status?.short;
      const homeRaw = fx.teams?.home?.name, awayRaw = fx.teams?.away?.name;
      const homeId = resolve(homeRaw);
      const awayId = resolve(awayRaw);
      const winnerId = fx.teams?.home?.winner ? homeId : fx.teams?.away?.winner ? awayId : null;
      out.push({
        homeId, awayId, homeRaw, awayRaw,
        status: FIN.has(sh) ? "FINISHED" : LIVE.has(sh) ? "LIVE" : "OTHER",
        h: fx.goals?.home, a: fx.goals?.away,
        min: fx.fixture?.status?.elapsed ? `${fx.fixture.status.elapsed}'` : "",
        winnerId,
      });
    }
  }
  return out;
}

async function buscar(dates, resolve, afFetch) {
  const provedores = [
    ["football-data.org", () => fetchFootballData(dates, resolve)],
    ["api-football", () => fetchApiFootball(dates, resolve, afFetch)],
  ];
  for (const [nome, fn] of provedores) {
    try {
      const res = await fn();
      if (res && res.length) { console.log(`✓ fonte: ${nome} (${res.length} partidas)`); return res; }
      if (res) console.log(`· ${nome}: 0 partidas`);
    } catch (e) {
      console.log(`! ${nome} falhou: ${e.message} — tentando próximo`);
    }
  }
  return [];
}

/* ===================== ESPN: ao vivo + eventos + marcadores =====================
   API pública do ESPN (site.api.espn.com), liga `fifa.world`. Gratuita, SEM chave
   e SEM cota — substitui API-Football/Highlightly no caminho de live e marcadores
   (a Highlightly fica só nas escalações). Cobre placar ao vivo + minuto, gols (com
   autor), cartões e substituições. `keyEvents[].scoringPlay` marca os gols; gol
   contra (type "Own Goal") NÃO credita autor. Nome -> "I. Sobrenome" (formato do
   dados.json). Cache por-run em `cache = { sb, sum }` (live precisa de dado fresco
   a cada run; nada persiste entre runs). */
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const espnDay = (iso) => iso.slice(0, 10).replace(/-/g, ""); // "2026-06-17" -> "20260617"

async function espnFetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) { console.log(`espn http ${r.status} ${url.slice(-40)}`); return null; }
    return await r.json();
  } catch (e) { console.log("espn fetch erro:", e.message); return null; }
}

// lista de events do scoreboard por data (YYYYMMDD); null = falha de rede
async function espnScoreboard(date, cache) {
  if (date in cache.sb) return cache.sb[date];
  const j = await espnFetch(`${ESPN_BASE}/scoreboard?dates=${date}`);
  return (cache.sb[date] = j ? (j.events || []) : null);
}

// datas candidatas p/ o bucket do ESPN. ESPN agrupa pela data LOCAL da SEDE:
// jogo noturno na América (kickoff UTC já no dia seguinte) cai no bucket do dia
// ANTERIOR. Tenta dia(UTC), dia-1 e dia+1 p/ não perder o live (off-by-one TZ).
const espnDaysFor = (iso) => {
  const t = new Date(iso).getTime();
  return [0, -1, 1].map((off) => espnDay(new Date(t + off * 86400000).toISOString()));
};

// acha o event ESPN do MEU jogo varrendo as datas candidatas (cache por-data).
// -> { hit, events } achou | { hit:null } sem jogo | { netFail:true } rede caiu.
async function espnLocate(j, resolve, cache) {
  let netFail = false;
  for (const date of espnDaysFor(j.kickoff)) {
    const events = await espnScoreboard(date, cache);
    if (events == null) { netFail = true; continue; }
    const hit = espnEventOf(j, events, resolve);
    if (hit) return { hit, events };
  }
  return netFail ? { netFail: true } : { hit: null };
}

async function espnSummary(eventId, cache) {
  if (eventId in cache.sum) return cache.sum[eventId];
  return (cache.sum[eventId] = await espnFetch(`${ESPN_BASE}/summary?event=${eventId}`));
}

// "Lionel Messi" -> "L. Messi"; mono-nome fica como está
const abbrevNome = (full) => {
  const p = String(full || "").trim().split(/\s+/);
  return p.length < 2 ? (p[0] || "") : `${p[0][0]}. ${p.slice(1).join(" ")}`;
};

// acha o ESPN event do MEU jogo (par de times, em qualquer orientação)
function espnEventOf(j, events, resolve) {
  for (const e of events || []) {
    const cs = e.competitions?.[0]?.competitors || [];
    const home = cs.find((c) => c.homeAway === "home");
    const away = cs.find((c) => c.homeAway === "away");
    const h = resolve(home?.team?.displayName), a = resolve(away?.team?.displayName);
    if ((h === j.casa && a === j.fora) || (h === j.fora && a === j.casa)) return { e, home, away, hId: h };
  }
  return null;
}

// extrai gols/subs/cartoes do summary.keyEvents, orientado ao MEU jogo
function espnEventos(sum, j, resolve) {
  const lado = (k) => { const t = resolve(k.team?.displayName); return t === j.casa ? "casa" : t === j.fora ? "fora" : null; };
  const minOf = (k) => { const m = String(k.clock?.displayValue ?? "").match(/\d+/); return m ? parseInt(m[0], 10) : null; };
  const goals = [], subs = [], cards = [];
  for (const k of (sum?.keyEvents || [])) {
    const type = String(k.type?.text || "");
    const nomes = (k.participants || []).map((p) => p.athlete?.displayName).filter(Boolean);
    if (k.scoringPlay && !/own goal/i.test(type) && !/own goal/i.test(k.text || "")) {
      if (nomes[0]) goals.push({ nome: abbrevNome(nomes[0]), min: minOf(k), lado: lado(k) });
    } else if (/card/i.test(type)) {
      const cor = /red|second yellow/i.test(type) ? "vermelho" : /yellow/i.test(type) ? "amarelo" : null;
      if (cor && nomes[0]) cards.push({ nome: abbrevNome(nomes[0]), cor, min: minOf(k), lado: lado(k) });
    } else if (/substitution/i.test(type)) {
      // texto "X replaces Y" -> participants[0] entrou, [1] saiu
      if (nomes[0] || nomes[1]) subs.push({ entrou: abbrevNome(nomes[0] || ""), saiu: abbrevNome(nomes[1] || ""), min: minOf(k), lado: lado(k) });
    }
  }
  return { goals, subs, cards };
}

const ESPN_LIVE = new Set(["in"]); // status.type.state

/* ao vivo: 1 scoreboard por data + 1 summary por jogo ao vivo (enriquece gols/
   cartões/subs). Retorna array (novo live[]) | [] (sem jogo) | undefined (falhou). */
async function liveEspn(dados, resolve, cache) {
  const agora = Date.now();
  const janela = dados.jogos.filter((j) => {
    if (apurado(j)) return false;
    const k = new Date(j.kickoff).getTime();
    return k <= agora + 60000 && k > agora - 3.5 * 3600 * 1000;
  });
  if (!janela.length) return [];
  const arr = [];
  for (const j of janela) {
    const loc = await espnLocate(j, resolve, cache);
    if (loc.netFail) return undefined; // falha de rede -> mantém live atual
    const hit = loc.hit;
    if (!hit || !ESPN_LIVE.has(hit.e.status?.type?.state)) continue;
    const hs = parseInt(hit.home?.score, 10), as = parseInt(hit.away?.score, 10);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const casa = hit.hId === j.casa ? hs : as;
    const fora = hit.hId === j.casa ? as : hs;
    const det = String(hit.e.status?.type?.detail || hit.e.status?.displayClock || "ao vivo");
    const min = /^ht\b|half ?time|intervalo/i.test(det) ? "Intervalo" : det;
    const item = { id: j.id, casa, fora, min };
    const sum = await espnSummary(hit.e.id, cache);
    if (sum) {
      const { goals, subs, cards } = espnEventos(sum, j, resolve);
      if (goals.length) item.gols = goals;
      if (subs.length) item.subs = subs;
      if (cards.length) item.cartoes = cards;
    }
    arr.push(item);
  }
  console.log(`live ESPN: ${arr.length} jogo(s)`);
  return arr;
}

/* marcadores finais (bônus de artilheiro). Idempotente: só jogo encerrado sem a
   lista. 0x0 -> lista vazia sem chamada. ESPN é ilimitado -> sem backoff/cota. */
async function marcadoresEspn(dados, resolve, cache) {
  const pend = dados.jogos.filter((j) => apurado(j) && !Array.isArray(j.real.marcadores));
  if (!pend.length) return false;
  let mudou = false;
  for (const j of pend) {
    if ((j.real.casa + j.real.fora) === 0) { j.real.marcadores = []; mudou = true; continue; }
    const hit = (await espnLocate(j, resolve, cache)).hit;
    if (!hit) { console.log(`marcadores ESPN: sem evento p/ ${j.casa} x ${j.fora}`); continue; }
    const sum = await espnSummary(hit.e.id, cache);
    const { goals } = sum ? espnEventos(sum, j, resolve) : { goals: [] };
    if (goals.length) {
      j.real.marcadores = goals.map((g) => g.nome);
      console.log(`marcadores ${j.casa} x ${j.fora}: ${j.real.marcadores.join(", ")}`);
      mudou = true;
    } else {
      console.log(`marcadores ${j.casa} x ${j.fora}: eventos ainda indisponíveis`);
    }
  }
  return mudou;
}

/* ---------- eventos ao vivo (gols + substituições, via Highlightly) ----------
   Enriquece cada item do live com `gols:[{nome,min}]` e `subs:[{entrou,saiu,min}]`.
   Chama /events quando o placar MUDOU (gol) OU passou EVENTS_TTL desde a última
   busca (p/ pegar substituições, que não mexem no placar). Mapeia jogo->matchId
   pela lista por data (cacheada), valendo em ciclo AF ou HL. Sem cota → mantém o
   último conhecido. Estado por-run em state.liveEv = { [id]: { total, gols, subs, at } }. */
const EVENTS_TTL = 90 * 1000; // no máx 1 /events a cada 90s por jogo em andamento
async function enrichEventos(arr, dados, resolve, state, hlFetch) {
  if (!Array.isArray(arr)) return;
  state.liveEv = state.liveEv || {};
  const agora = Date.now();
  const keep = (e, prev) => { if (prev) { e.gols = prev.gols; if (prev.subs?.length) e.subs = prev.subs; if (prev.cartoes?.length) e.cartoes = prev.cartoes; } };
  for (const e of arr) {
    const total = (e.casa || 0) + (e.fora || 0);
    const prev = state.liveEv[e.id];
    const mudouPlacar = !prev || prev.total !== total;
    const expirou = !prev || (agora - (prev.at || 0)) > EVENTS_TTL;
    if (prev && !mudouPlacar && !expirou) { keep(e, prev); continue; } // recente → reusa
    const j = dados.jogos.find((x) => x.id === e.id);
    if (!j) { keep(e, prev); continue; }
    const list = await hlDateList(j.kickoff.slice(0, 10), hlFetch, state);
    if (!list) { keep(e, prev); continue; }                          // sem cota → mantém
    const mid = hlMatchId(j, list, resolve);
    if (mid == null) { keep(e, prev); continue; }
    const { ok, goals, subs, cards } = await hlEvents(mid, hlFetch, resolve, j);
    if (!ok) { keep(e, prev); continue; }                            // sem cota/erro → mantém
    e.gols = goals;
    if (subs.length) e.subs = subs;
    if (cards.length) e.cartoes = cards;
    state.liveEv[e.id] = { total, gols: goals, subs, cartoes: cards, at: agora };
    console.log(`eventos ${e.id}: ${goals.length} gol(s), ${subs.length} sub(s), ${cards.length} cartão(ões)`);
  }
  // limpa estado de jogos que não estão mais ao vivo
  const ids = new Set(arr.map((e) => String(e.id)));
  for (const k of Object.keys(state.liveEv)) if (!ids.has(String(k))) delete state.liveEv[k];
}

/* ---------- ao vivo: fonte 2 = Highlightly (/matches por data) ----------
   1 request por data cobre todos os jogos. score.current = "H - A" (string). */
const HL_LIVE = new Set([
  "First half", "Half time", "Second half", "Extra time",
  "Break time", "Penalties", "In progress",
]);
const parseScore = (s) => {
  if (!s) return null;
  const p = String(s).split(/\s*-\s*/).map((x) => parseInt(x, 10));
  return p.length === 2 && p.every(Number.isFinite) ? p : null;
};

async function liveHighlightly(dados, resolve, hlFetch, state) {
  const agora = Date.now();
  const dates = [...new Set(dados.jogos.filter((j) => {
    if (apurado(j)) return false;
    const k = new Date(j.kickoff).getTime();
    return k <= agora + 60000 && k > agora - 3.5 * 3600 * 1000;
  }).map((j) => j.kickoff.slice(0, 10)))];
  if (!dates.length) return [];
  const byPair = {};
  dados.jogos.forEach((j) => { byPair[`${j.casa}|${j.fora}`] = j; byPair[`${j.fora}|${j.casa}`] = j; });
  const arr = [];
  let ok = false;
  for (const date of dates) {
    const r = await hlFetch(`${HL_BASE}/matches?leagueId=${WC_LEAGUE_HL}&date=${date}&limit=50`);
    if (!r) { console.log("HL live: sem cota"); return ok ? arr : undefined; }
    if (!r.ok) { console.log("HL live http", r.status); return ok ? arr : undefined; }
    ok = true;
    const data = await r.json();
    const list = data.data || [];
    (state.hlList ??= {})[date] = list; // reusa p/ mapear escalações
    for (const m of list) {
      const homeId = resolve(m.homeTeam?.name);
      const awayId = resolve(m.awayTeam?.name);
      const j = byPair[`${homeId}|${awayId}`];
      if (!j || apurado(j)) continue;
      const st = m.state?.description;
      if (!HL_LIVE.has(st)) continue;
      const sc = parseScore(m.state?.score?.current);
      if (!sc) continue;
      const casa = homeId === j.casa ? sc[0] : sc[1];
      const fora = homeId === j.casa ? sc[1] : sc[0];
      const clock = m.state?.clock;
      const min = st === "Half time" ? "Intervalo" : clock != null ? `${clock}'` : "ao vivo";
      arr.push({ id: j.id, casa, fora, min });
    }
  }
  console.log(`live HL: ${arr.length} jogo(s)`);
  return arr;
}

/* ---------- gols via Highlightly (/events/{matchId}) ----------
   A API-Football não cobre os eventos da Copa 2026 (plano) → a fonte dos
   marcadores/gols passou a ser a Highlightly, que já provê live+escalações.
   Extrai os autores de gol; gol contra e pênalti perdido NÃO entram. Tolerante
   ao shape de player/time; loga 1 evento cru se não conseguir extrair (ajuste). */
/* eventos da Highlightly = array de { team:{name}, time:"7"|"90+1", type:"Goal"|
   "Yellow Card"|"Substitution"|..., player:"Nome", substituted:"Nome"|null, ... }.
   Gol: type "Goal" (autor = player); "Own Goal"/"Missed Penalty" fora.
   Sub: type "Substitution" — pela doc, player = quem SAIU, substituted = quem ENTROU. */
const evMin = (t) => { const m = String(t ?? "").match(/\d+/); return m ? parseInt(m[0], 10) : null; };
const evPlayer = (e) => String(e.player ?? "").trim();
const evIsGoal = (e) => {
  const t = String(e.type ?? "").toLowerCase();
  return t.includes("goal") && !t.includes("own"); // "Goal" sim; "Own Goal" não
};
const evIsSub = (e) => String(e.type ?? "").toLowerCase().includes("substitution");
// cartão: "Yellow Card" → amarelo; "Red Card" e "Second Yellow card" (= expulsão) → vermelho
const evCardColor = (e) => {
  const t = String(e.type ?? "").toLowerCase();
  if (!t.includes("card")) return null;
  if (t.includes("red") || t.includes("second yellow")) return "vermelho";
  if (t.includes("yellow")) return "amarelo";
  return null;
};

// lado do evento relativo ao MEU jogo ("casa"|"fora"|null) via team.name -> resolve
const evSide = (e, resolve, j) => {
  if (!resolve || !j) return null;
  const t = resolve(e.team?.name);
  return t === j.casa ? "casa" : t === j.fora ? "fora" : null;
};

async function hlEvents(mid, hlFetch, resolve, j) {
  const r = await hlFetch(`${HL_BASE}/events/${mid}`);
  if (!r) return { ok: false, goals: [], subs: [] };     // sem cota
  if (!r.ok) { console.log(`eventos HL: ${mid} http ${r.status}`); return { ok: false, goals: [], subs: [] }; }
  const data = await r.json();
  const list = Array.isArray(data) ? data : (data.data || data.events || []);
  const goals = list
    .filter(evIsGoal)
    .map((e) => ({ nome: evPlayer(e), min: evMin(e.time), lado: evSide(e, resolve, j) }))
    .filter((g) => g.nome);
  const subs = list
    .filter(evIsSub)
    .map((e) => ({ entrou: String(e.substituted ?? "").trim(), saiu: evPlayer(e), min: evMin(e.time), lado: evSide(e, resolve, j) }))
    .filter((s) => s.entrou || s.saiu);
  const cards = list
    .map((e) => ({ nome: evPlayer(e), cor: evCardColor(e), min: evMin(e.time), lado: evSide(e, resolve, j) }))
    .filter((c) => c.cor && c.nome);
  if (!goals.length && !subs.length && !cards.length && list.length) // shape inesperado → 1 evento cru pro log
    console.log(`eventos HL DEBUG ${mid}: ${JSON.stringify(list[0]).slice(0, 320)}`);
  return { ok: true, goals, subs, cards };
}

/* orquestração do ao vivo: ESPN é o primário (grátis, sem cota). Só cai p/ a
   Highlightly (rotor de chaves) quando o ESPN FALHA (rede/endpoint fora) — como
   fallback raro, sem risco de estourar a cota. Retorna array | [] | undefined. */
async function tickLive(dados, resolve, state, cache, hlFetch) {
  const arr = await liveEspn(dados, resolve, cache);
  if (arr !== undefined) return arr; // ESPN ok (inclui [] = sem jogo na janela)
  console.log("live: ESPN falhou -> fallback Highlightly");
  const hl = await liveHighlightly(dados, resolve, hlFetch, state);
  if (hl === undefined) return undefined;
  await enrichEventos(hl, dados, resolve, state, hlFetch);
  return hl;
}

// par de times do MEU jogo -> matchId da Highlightly (na lista já cacheada por data)
function hlMatchId(j, list, resolve) {
  for (const m of list) {
    const h = resolve(m.homeTeam?.name), a = resolve(m.awayTeam?.name);
    if ((h === j.casa && a === j.fora) || (h === j.fora && a === j.casa)) return m.id;
  }
  return null;
}

/* ---------- escalações (Highlightly) ----------
   Lineup sai ~30min antes do kickoff (no máx +15min). Busca 1x por jogo, cacheada
   em jogos[].escalacoes. Idempotente. Técnico não vem nesse endpoint -> null. */
const HL_POS = { Goalkeeper: "G", Defender: "D", Midfielder: "M", Forward: "F" };
const parseHLTeam = (t) => ({
  titulares: (t.initialLineup || []).flat().map((p) => ({ num: p.number, nome: p.name, pos: HL_POS[p.position] || "?" })),
  reservas: (t.substitutes || []).map((p) => ({ num: p.number, nome: p.name, pos: HL_POS[p.position] || "?" })),
});

async function hlDateList(date, hlFetch, state) {
  state.hlList ??= {};
  if (state.hlList[date]) return state.hlList[date];
  const r = await hlFetch(`${HL_BASE}/matches?leagueId=${WC_LEAGUE_HL}&date=${date}&limit=50`);
  if (!r) { console.log(`escalação: matches ${date} sem cota`); return null; }
  if (!r.ok) { console.log(`escalação: matches ${date} http ${r.status}`); return null; }
  const data = await r.json();
  state.hlList[date] = data.data || [];
  return state.hlList[date];
}

async function escalacoes(dados, resolve, hlFetch, state) {
  if (!hlLineupKeys.length) return false;
  const agora = Date.now();
  const pend = dados.jogos.filter((j) => {
    if (j.escalacoes || apurado(j)) return false;
    const k = new Date(j.kickoff).getTime();
    return k <= agora + 35 * 60000 && k >= agora - 25 * 60000; // janela do lineup
  });
  if (!pend.length) return false;

  // backoff por-jogo: não rebusca lineup ainda-indisponível mais que a cada 5min
  // (protege a cota da chave de lineup; o script roda a cada ~55s no loop).
  state.lineupTry ??= {};
  const recente = (id) => agora - (state.lineupTry[id] || 0) < 5 * 60000;

  let mudou = false;
  for (const j of pend) {
    if (recente(j.id)) continue;
    state.lineupTry[j.id] = agora;
    const list = await hlDateList(j.kickoff.slice(0, 10), hlFetch, state);
    if (!list) break; // sem cota -> tenta no próximo ciclo
    const mid = hlMatchId(j, list, resolve);
    if (mid == null) { console.log(`escalação: sem matchId p/ ${j.casa} x ${j.fora}`); continue; }

    const r = await hlFetch(`${HL_BASE}/lineups/${mid}`);
    if (!r) { console.log("escalação: lineups sem cota"); break; }
    if (!r.ok) { console.log(`escalação ${j.casa} x ${j.fora}: http ${r.status}`); continue; }
    const data = await r.json();
    const home = data.homeTeam, away = data.awayTeam;
    if (!home?.initialLineup?.length) { console.log(`escalação ${j.casa} x ${j.fora}: ainda indisponível`); continue; }

    const homeIsCasa = resolve(home.name) === j.casa;
    const C = homeIsCasa ? home : away, F = homeIsCasa ? away : home;
    j.escalacoes = {
      fonte: "highlightly",
      formacao: { casa: C.formation || null, fora: F.formation || null },
      tecnico: { casa: null, fora: null }, // endpoint de lineup não traz técnico
      casa: parseHLTeam(C),
      fora: parseHLTeam(F),
    };
    console.log(`escalação ${j.casa} x ${j.fora}: ok (${C.formation} / ${F.formation})`);
    mudou = true;
  }
  return mudou;
}

/* ---------- main ---------- */
async function main() {
  if (!FD_KEY && !AF_KEYS.length && !HL_ALL.length) {
    console.log("Nenhuma chave configurada. Nada a fazer.");
    return;
  }
  // self-heal: se o dados.json local estiver inválido (ex.: marcadores de
  // conflito de um rebase), restaura do HEAD em vez de crashar o loop inteiro.
  let dados;
  try {
    dados = JSON.parse(await readFile(DADOS, "utf8"));
  } catch (e) {
    console.log(`dados.json local inválido (${e.message}) — restaurando do HEAD`);
    try {
      execSync(`git checkout HEAD -- "${DADOS}"`, { stdio: "ignore" });
      dados = JSON.parse(await readFile(DADOS, "utf8"));
    } catch (e2) {
      console.error("ERRO: não consegui restaurar dados.json:", e2.message);
      return;
    }
  }
  const resolve = buildResolver(dados.times);
  const fases = {};
  dados.fases.forEach((f) => (fases[f.id] = f));

  let state = {};
  try { state = JSON.parse(await readFile(STATE, "utf8")); } catch {}
  const afFetch = rotor(AF_KEYS, "x-apisports-key", "af", state);
  const hlLineupFetch = rotor(hlLineupKeys, "X-RapidAPI-Key", "hln", state);
  const hlLiveFetch = rotor(hlLiveKeys, "X-RapidAPI-Key", "hll", state); // fallback do live
  const cache = { sb: {}, sum: {} }; // ESPN: scoreboard/summary por-run (live + marcadores)

  const agora = Date.now();
  const alvos = dados.jogos.filter((j) => {
    if (apurado(j)) return false;
    const k = new Date(j.kickoff).getTime();
    return k >= agora - ATRAS_MS && k <= agora + FRENTE_MS;
  });

  let mudou = false;
  let dates = [];

  // FINAIS + MARCADORES (só se há jogo na janela)
  if (alvos.length) {
    dates = [...new Set(alvos.map((j) => j.kickoff.slice(0, 10)))].sort();
    console.log(`Janela: ${alvos.length} jogo(s), datas ${dates.join(", ")}`);
    const partidas = await buscar(dates, resolve, afFetch);

    const idx = {};
    for (const p of partidas) {
      if (!p.homeId || !p.awayId) {
        const h = p.homeId || `?(${p.homeRaw ?? "—"})`;
        const a = p.awayId || `?(${p.awayRaw ?? "—"})`;
        console.log(`? time não mapeado: ${h} x ${a}`);
        continue;
      }
      idx[`${p.homeId}|${p.awayId}`] = p;
      idx[`${p.awayId}|${p.homeId}`] = { ...p, _rev: true };
    }

    for (const j of alvos) {
      const p = idx[`${j.casa}|${j.fora}`];
      if (!p) continue;
      const h = p._rev ? p.a : p.h; // orientação do MEU jogo
      const a = p._rev ? p.h : p.a;
      if (p.status === "FINISHED" && h != null && a != null) {
        j.real.casa = h; j.real.fora = a;
        if (fases[j.fase]?.mata) j.real.avancou = p.winnerId || (h > a ? j.casa : a > h ? j.fora : null);
        console.log(`FT ${j.casa} ${h}-${a} ${j.fora}`);
        mudou = true;
      }
    }

    if (await marcadoresEspn(dados, resolve, cache)) mudou = true;
  } else {
    console.log("Sem jogos na janela p/ finais.");
  }

  // AO VIVO (ESPN, gratuito/ilimitado — sem cota/rotação)
  const liveNovo = await tickLive(dados, resolve, state, cache, hlLiveFetch);
  // As fontes ALTERNAM e às vezes uma não reporta um jogo em andamento → não pode
  // ZERAR o placar nesse ciclo (causava o placar "piscar"/sumir). Mantém o último
  // placar conhecido de jogos ainda na janela de jogo (kickoff até +3.5h, !apurado).
  const agoraTs = Date.now();
  const naJanela = (j) => {
    const k = new Date(j.kickoff).getTime();
    return agoraTs >= k && agoraTs <= k + 3.5 * 3600 * 1000;
  };
  let merged;
  if (liveNovo === undefined) {
    merged = Array.isArray(dados.live) ? dados.live : []; // fetch falhou → mantém atual
  } else {
    const novoIds = new Set(liveNovo.map((l) => l.id));
    merged = [...liveNovo];
    for (const l of (dados.live || [])) {
      if (novoIds.has(l.id)) continue; // veio no ciclo novo → já está
      const j = dados.jogos.find((x) => x.id === l.id);
      if (j && !apurado(j) && naJanela(j)) merged.push(l); // segura o último conhecido
    }
  }
  const limpo = (arr) => (arr || []).filter((l) => {
    const j = dados.jogos.find((x) => x.id === l.id);
    return j && !apurado(j); // tira jogos já encerrados
  });
  const liveFinal = limpo(merged);
  if (JSON.stringify(dados.live || []) !== JSON.stringify(liveFinal)) {
    dados.live = liveFinal; mudou = true;
    await pushLiveSupabase(liveFinal); // push imediato p/ o Realtime (antes do commit git)
  }

  // ESCALAÇÕES (Highlightly, baixa frequência)
  if (await escalacoes(dados, resolve, hlLineupFetch, state)) mudou = true;

  // persiste cotas/timers (efêmero por-run; não commitado)
  try { await writeFile(STATE, JSON.stringify(state)); } catch {}

  // "hoje" no FUSO do bolão (Brasília), não em UTC — senão às 21h BRT (00h UTC) o
  // site "vira o dia" 3h antes e os jogos tardios de hoje somem de "Jogos de hoje".
  // Feito ANTES do early-return: o rollover de dia precisa commitar mesmo sem outra
  // mudança (senão 'atualizado' fica preso na data UTC até um jogo mexer).
  const TZ = dados.fuso || "America/Sao_Paulo";
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (dates.length && dates[dates.length - 1] >= hoje && dados.atualizado !== hoje) {
    dados.atualizado = hoje;
    mudou = true;
  }

  if (!mudou) { console.log("Sem mudanças."); return; }

  dados.atualizado_em = new Date().toISOString();
  await writeFile(DADOS, JSON.stringify(dados, null, 2) + "\n", "utf8");
  console.log(`✓ dados.json atualizado (${liveFinal.length} ao vivo).`);
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
