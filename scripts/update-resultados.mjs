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
].filter(Boolean);
// KEY → escalações (baixa frequência); KEY_2/_3 → 2ª fonte live.
// Se faltar chave dedicada, cai p/ o pool inteiro.
const HL_LINEUP_KEYS = [process.env.HIGHLIGHTLY_KEY].filter(Boolean);
const HL_LIVE_KEYS = [process.env.HIGHLIGHTLY_KEY_2, process.env.HIGHLIGHTLY_KEY_3].filter(Boolean);
const hlLineupKeys = HL_LINEUP_KEYS.length ? HL_LINEUP_KEYS : HL_ALL;
const hlLiveKeys = HL_LIVE_KEYS.length ? HL_LIVE_KEYS : HL_ALL;

const HL_BASE = "https://soccer.highlightly.net";
const WC_LEAGUE_HL = 1635; // FIFA World Cup 2026 (Highlightly)

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

const sumRem = (slot, n, state) => {
  const s = state[slot];
  let t = 0;
  for (let i = 0; i < n; i++) t += s && s.rem[i] != null ? s.rem[i] : 100;
  return t;
};

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

/* ---------- ao vivo: fonte 1 = API-Football (live=all) ----------
   1 request cobre TODOS os jogos simultâneos. Retorna array | undefined (falhou) */
async function liveApiFootball(dados, resolve, afFetch) {
  const r = await afFetch("https://v3.football.api-sports.io/fixtures?live=all");
  if (!r) { console.log("AF live: sem cota"); return undefined; }
  if (!r.ok) { console.log("AF live http", r.status); return undefined; }
  const data = await r.json();
  const byPair = {};
  dados.jogos.forEach((j) => { byPair[`${j.casa}|${j.fora}`] = j; byPair[`${j.fora}|${j.casa}`] = j; });
  const arr = [];
  for (const f of data.response || []) {
    if (String(f.league && f.league.id) !== "1") continue; // só Copa
    const homeId = resolve(f.teams?.home?.name);
    const awayId = resolve(f.teams?.away?.name);
    const j = byPair[`${homeId}|${awayId}`];
    if (!j || apurado(j)) continue;
    const casa = homeId === j.casa ? f.goals.home : f.goals.away;
    const fora = homeId === j.casa ? f.goals.away : f.goals.home;
    if (casa == null || fora == null) continue;
    const sh = f.fixture?.status?.short, el = f.fixture?.status?.elapsed;
    const min = sh === "HT" ? "Intervalo" : el != null ? `${el}'` : "ao vivo";
    arr.push({ id: j.id, casa, fora, min, _fxId: f.fixture?.id }); // _fxId p/ buscar os gols
  }
  console.log(`live AF: ${arr.length} jogo(s)`);
  return arr;
}

/* ---------- gols ao vivo (autor + minuto) ----------
   Enriquece cada item do live com `gols: [{nome, min}]`. Só chama a API de eventos
   quando o placar do jogo MUDOU vs o ciclo anterior (gol) — economiza cota. Usa o
   fixture id da fonte AF; em ciclo Highlightly (sem _fxId) reaproveita o que tem.
   Estado por-run em state.liveGols = { [id]: { total, gols } }. */
async function enrichGols(arr, state, afFetch) {
  if (!Array.isArray(arr)) return;
  state.liveGols = state.liveGols || {};
  for (const e of arr) {
    const total = (e.casa || 0) + (e.fora || 0);
    const prev = state.liveGols[e.id];
    if (total === 0) { delete e._fxId; continue; }                 // 0x0: sem gol
    if (prev && prev.total === total && Array.isArray(prev.gols)) { // sem mudança → reusa
      e.gols = prev.gols; delete e._fxId; continue;
    }
    if (e._fxId == null) {                                          // fonte sem fixture id (HL)
      if (prev && prev.gols) e.gols = prev.gols;                    // mantém até um ciclo AF
      continue;
    }
    const fx = e._fxId; delete e._fxId;
    const r = await afFetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fx}`);
    if (!r) { console.log(`gols: eventos ${fx} sem cota`); if (prev?.gols) e.gols = prev.gols; continue; }
    if (!r.ok) { console.log(`gols: eventos ${fx} http ${r.status}`); if (prev?.gols) e.gols = prev.gols; continue; }
    const data = await r.json();
    const gols = (data.response || [])
      .filter((x) => x.type === "Goal" && x.detail !== "Own Goal" && x.detail !== "Missed Penalty")
      .map((x) => ({ nome: x.player?.name || "—", min: x.time?.elapsed != null ? x.time.elapsed : null }))
      .filter((g) => g.nome && g.nome !== "—");
    e.gols = gols;
    state.liveGols[e.id] = { total, gols };
    console.log(`gols ${e.id}: ${gols.map((g) => g.nome + (g.min != null ? " " + g.min + "'" : "")).join(", ") || "(?)"}`);
  }
  // limpa estado de jogos que não estão mais ao vivo
  const ids = new Set(arr.map((e) => String(e.id)));
  for (const k of Object.keys(state.liveGols)) if (!ids.has(String(k))) delete state.liveGols[k];
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

/* ---------- orquestração do ao vivo (throttle adaptativo + alternância) ----------
   intervalo = segundos_até_fim / cota_total_restante (clamp 30..240s).
   Alterna AF/Highlightly a cada poll; se uma fonte esgota, usa a outra.
   Retorna: array (novo live[]) | [] (sem jogo) | undefined (throttled/falhou). */
function liveInterval(dados, state) {
  const now = Date.now();
  let endMax = 0;
  for (const j of dados.jogos) {
    if (apurado(j)) continue;
    const k = new Date(j.kickoff).getTime();
    if (k <= now + 60000 && k > now - 3.5 * 3600 * 1000) endMax = Math.max(endMax, k + 8100 * 1000); // +2h15
  }
  if (!endMax) return null; // nenhum jogo em janela ao vivo
  const segLeft = Math.max((endMax - now) / 1000, 60);
  const budget = Math.max(
    sumRem("af", AF_KEYS.length, state) + sumRem("hll", hlLiveKeys.length, state) - 20, // reserva marcadores
    1,
  );
  return Math.min(240, Math.max(30, Math.round(segLeft / budget)));
}

async function tickLive(dados, resolve, state, afFetch, hlFetch) {
  const intervalo = liveInterval(dados, state);
  if (intervalo == null) return []; // sem jogo agora
  const now = Date.now();
  if (now - (state.lastLive || 0) < intervalo * 1000) return undefined; // ainda não

  const afOk = AF_KEYS.length && sumRem("af", AF_KEYS.length, state) > 2;
  const hlOk = hlLiveKeys.length && sumRem("hll", hlLiveKeys.length, state) > 2;
  let useHL;
  if (afOk && hlOk) useHL = (state.liveSrc = (state.liveSrc || 0) ^ 1) === 1; // alterna
  else if (hlOk) useHL = true;
  else if (afOk) useHL = false;
  else return undefined; // ambas esgotadas -> mantém live atual

  const arr = useHL
    ? await liveHighlightly(dados, resolve, hlFetch, state)
    : await liveApiFootball(dados, resolve, afFetch);
  if (arr === undefined) return undefined; // falhou -> mantém atual
  await enrichGols(arr, state, afFetch); // autor dos gols (só quando o placar muda)
  state.lastLive = now;
  console.log(`live: fonte=${useHL ? "highlightly" : "api-football"} intervalo=${intervalo}s`);
  return arr;
}

/* ---------- artilheiros (API-Football, rotação) ----------
   Grava em jogos[].real.marcadores a lista de quem fez gol (p/ bônus de palpite
   de marcador). Gol contra e pênalti perdido NÃO entram. Idempotente. */
async function marcadores(dados, resolve, afFetch) {
  if (!AF_KEYS.length) return false;
  const pend = dados.jogos.filter((j) => apurado(j) && !Array.isArray(j.real.marcadores));
  if (!pend.length) return false;

  // 1) mapeia par de times -> fixture.id (por data)
  const dates = [...new Set(pend.map((j) => j.kickoff.slice(0, 10)))].sort();
  const fxId = {};
  for (const date of dates) {
    const r = await afFetch(`https://v3.football.api-sports.io/fixtures?date=${date}&league=1&season=2026`);
    if (!r) { console.log(`marcadores: fixtures ${date} sem cota`); continue; }
    if (!r.ok) { console.log(`marcadores: fixtures ${date} http ${r.status}`); continue; }
    const data = await r.json();
    for (const fx of data.response || []) {
      const hId = resolve(fx.teams?.home?.name), aId = resolve(fx.teams?.away?.name);
      const id = fx.fixture?.id;
      if (hId && aId && id != null) { fxId[`${hId}|${aId}`] = id; fxId[`${aId}|${hId}`] = id; }
    }
  }

  // 2) eventos de gol por jogo encerrado
  let mudou = false;
  for (const j of pend) {
    const id = fxId[`${j.casa}|${j.fora}`];
    if (id == null) { console.log(`marcadores: sem fixture p/ ${j.casa} x ${j.fora}`); continue; }
    const r = await afFetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${id}`);
    if (!r) { console.log(`marcadores: eventos ${id} sem cota`); continue; }
    if (!r.ok) { console.log(`marcadores: eventos ${id} http ${r.status}`); continue; }
    const data = await r.json();
    const ev = data.response || [];
    const nomes = ev
      .filter((e) => e.type === "Goal" && e.detail !== "Own Goal" && e.detail !== "Missed Penalty")
      .map((e) => e.player?.name)
      .filter(Boolean);
    const totalGols = j.real.casa + j.real.fora;
    // só grava se a API já tem eventos do jogo (evita lista vazia prematura)
    if (totalGols === 0 || ev.length) {
      j.real.marcadores = nomes;
      console.log(`marcadores ${j.casa} x ${j.fora}: ${nomes.join(", ") || "(nenhum)"}`);
      mudou = true;
    }
  }
  return mudou;
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
    let mid = null;
    for (const m of list) {
      const h = resolve(m.homeTeam?.name), a = resolve(m.awayTeam?.name);
      if ((h === j.casa && a === j.fora) || (h === j.fora && a === j.casa)) { mid = m.id; break; }
    }
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
  const dados = JSON.parse(await readFile(DADOS, "utf8"));
  const resolve = buildResolver(dados.times);
  const fases = {};
  dados.fases.forEach((f) => (fases[f.id] = f));

  let state = {};
  try { state = JSON.parse(await readFile(STATE, "utf8")); } catch {}
  const afFetch = rotor(AF_KEYS, "x-apisports-key", "af", state);
  const hlLiveFetch = rotor(hlLiveKeys, "X-RapidAPI-Key", "hll", state);
  const hlLineupFetch = rotor(hlLineupKeys, "X-RapidAPI-Key", "hln", state);

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

    if (await marcadores(dados, resolve, afFetch)) mudou = true;
  } else {
    console.log("Sem jogos na janela p/ finais.");
  }

  // AO VIVO (AF + Highlightly alternados, throttle adaptativo)
  const liveNovo = await tickLive(dados, resolve, state, afFetch, hlLiveFetch);
  const limpo = (arr) => (arr || []).filter((l) => {
    const j = dados.jogos.find((x) => x.id === l.id);
    return j && !apurado(j); // tira jogos já encerrados
  });
  const liveFinal = liveNovo === undefined ? limpo(dados.live) : limpo(liveNovo);
  if (JSON.stringify(dados.live || []) !== JSON.stringify(liveFinal)) { dados.live = liveFinal; mudou = true; }

  // ESCALAÇÕES (Highlightly, baixa frequência)
  if (await escalacoes(dados, resolve, hlLineupFetch, state)) mudou = true;

  // persiste cotas/timers (efêmero por-run; não commitado)
  try { await writeFile(STATE, JSON.stringify(state)); } catch {}

  if (!mudou) { console.log("Sem mudanças."); return; }

  const hoje = new Date().toISOString().slice(0, 10);
  if (dates.length && dates[dates.length - 1] >= hoje) dados.atualizado = hoje;
  dados.atualizado_em = new Date().toISOString();

  await writeFile(DADOS, JSON.stringify(dados, null, 2) + "\n", "utf8");
  console.log(`✓ dados.json atualizado (${liveFinal.length} ao vivo).`);
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
