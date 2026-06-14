#!/usr/bin/env node
/* ============================================================
   Bolão Copa 2026 · IAs — atualizador de resultados
   Lê dados.json, busca placares na API e preenche:
     - jogos[].real.casa / .fora / .avancou (jogos encerrados)
     - live[]  (jogos em andamento: placar + minuto)
   Provedores (free): football-data.org (primário) + API-Football (fallback).
   Roda no GitHub Actions a cada 5 min. Sem dependências externas (fetch nativo).
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DADOS = join(__dir, "..", "dados.json");

const FD_KEY = process.env.FOOTBALL_DATA_KEY || "";
const AF_KEY = process.env.API_FOOTBALL_KEY || "";

/* janela: só consulta jogos sem placar com kickoff entre -ATRAS e +30min.
   JANELA_ATRAS_H sobrescreve o padrão (ex.: 240 p/ backfill inicial). */
const ATRAS_MS = (Number(process.env.JANELA_ATRAS_H) || 48) * 3600 * 1000;
const FRENTE_MS = 30 * 60 * 1000;

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

/* ---------- provedores ---------- */
/* normaliza para: {homeId, awayId, status, h, a, winnerId}
   status: "LIVE" | "FINISHED" | "OTHER"                                   */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFootballData(dates, resolve) {
  if (!FD_KEY) return null;
  const from = dates[0], to = dates[dates.length - 1];
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${from}&dateTo=${to}`;
  let r = await fetch(url, { headers: { "X-Auth-Token": FD_KEY } });
  // respeita o ratelimiter (instrução do provedor): 429 -> espera e tenta 1x
  if (r.status === 429) {
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
    const homeId = resolve(m.homeTeam?.name || m.homeTeam?.shortName);
    const awayId = resolve(m.awayTeam?.name || m.awayTeam?.shortName);
    return {
      homeId, awayId,
      status: st === "FINISHED" ? "FINISHED" : LIVE.has(st) ? "LIVE" : "OTHER",
      h: ft.home, a: ft.away,
      min: m.minute != null ? `${m.minute}'` : (st === "PAUSED" ? "INT" : ""),
      winnerId: win === "HOME_TEAM" ? homeId : win === "AWAY_TEAM" ? awayId : null,
    };
  });
}

async function fetchApiFootball(dates, resolve) {
  if (!AF_KEY) return null;
  const out = [];
  for (const date of dates) {
    const url = `https://v3.football.api-sports.io/fixtures?date=${date}&league=1&season=2026`;
    const r = await fetch(url, { headers: { "x-apisports-key": AF_KEY } });
    if (!r.ok) throw new Error(`api-football ${r.status}`);
    const data = await r.json();
    const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
    const FIN = new Set(["FT", "AET", "PEN"]);
    for (const fx of data.response || []) {
      const sh = fx.fixture?.status?.short;
      const homeId = resolve(fx.teams?.home?.name);
      const awayId = resolve(fx.teams?.away?.name);
      const winnerId = fx.teams?.home?.winner ? homeId : fx.teams?.away?.winner ? awayId : null;
      out.push({
        homeId, awayId,
        status: FIN.has(sh) ? "FINISHED" : LIVE.has(sh) ? "LIVE" : "OTHER",
        h: fx.goals?.home, a: fx.goals?.away,
        min: fx.fixture?.status?.elapsed ? `${fx.fixture.status.elapsed}'` : "",
        winnerId,
      });
    }
  }
  return out;
}

async function buscar(dates, resolve) {
  const provedores = [
    ["football-data.org", fetchFootballData],
    ["api-football", fetchApiFootball],
  ];
  for (const [nome, fn] of provedores) {
    try {
      const res = await fn(dates, resolve);
      if (res && res.length) { console.log(`✓ fonte: ${nome} (${res.length} partidas)`); return res; }
      if (res) console.log(`· ${nome}: 0 partidas`);
    } catch (e) {
      console.log(`! ${nome} falhou: ${e.message} — tentando próximo`);
    }
  }
  return [];
}

/* ---------- main ---------- */
const apurado = (j) => j.real && j.real.casa != null && j.real.fora != null;

async function main() {
  if (!FD_KEY && !AF_KEY) {
    console.log("Nenhuma chave (FOOTBALL_DATA_KEY / API_FOOTBALL_KEY). Nada a fazer.");
    process.exit(0);
  }
  const dados = JSON.parse(await readFile(DADOS, "utf8"));
  const resolve = buildResolver(dados.times);
  const fases = {};
  dados.fases.forEach((f) => (fases[f.id] = f));

  const agora = Date.now();
  const alvos = dados.jogos.filter((j) => {
    if (apurado(j)) return false;
    const k = new Date(j.kickoff).getTime();
    return k >= agora - ATRAS_MS && k <= agora + FRENTE_MS;
  });
  if (!alvos.length) {
    console.log("Sem jogos na janela. Nada a fazer.");
    process.exit(0);
  }

  const dates = [...new Set(alvos.map((j) => j.kickoff.slice(0, 10)))].sort();
  console.log(`Janela: ${alvos.length} jogo(s), datas ${dates.join(", ")}`);

  const partidas = await buscar(dates, resolve);
  if (!partidas.length) { console.log("Sem dados das fontes."); process.exit(0); }

  /* índice por par de times (independe da ordem casa/fora do provedor) */
  const idx = {};
  for (const p of partidas) {
    if (!p.homeId || !p.awayId) {
      console.log(`? time não mapeado: ${p.homeId || "?"} x ${p.awayId || "?"}`);
      continue;
    }
    idx[`${p.homeId}|${p.awayId}`] = p;
    idx[`${p.awayId}|${p.homeId}`] = { ...p, _rev: true };
  }

  const live = [];
  let mudou = false;

  for (const j of alvos) {
    const p = idx[`${j.casa}|${j.fora}`];
    if (!p) continue;
    // placar na orientação do MEU jogo (casa/fora do dados.json)
    const h = p._rev ? p.a : p.h;
    const a = p._rev ? p.h : p.a;

    if (p.status === "FINISHED" && h != null && a != null) {
      j.real.casa = h; j.real.fora = a;
      if (fases[j.fase]?.mata) j.real.avancou = p.winnerId || (h > a ? j.casa : a > h ? j.fora : null);
      console.log(`FT ${j.casa} ${h}-${a} ${j.fora}`);
      mudou = true;
    } else if (p.status === "LIVE" && h != null && a != null) {
      live.push({ id: j.id, casa: h, fora: a, min: p.min || "ao vivo" });
    }
  }

  // live[] sempre reflete o estado atual (some quando jogo encerra)
  const liveAntes = JSON.stringify(dados.live || []);
  const liveAgora = JSON.stringify(live);
  if (liveAntes !== liveAgora) { dados.live = live; mudou = true; }

  if (!mudou) { console.log("Sem mudanças."); process.exit(0); }

  dados.atualizado = dates[dates.length - 1] >= new Date().toISOString().slice(0, 10)
    ? new Date().toISOString().slice(0, 10) : dados.atualizado;
  dados.atualizado_em = new Date().toISOString();

  await writeFile(DADOS, JSON.stringify(dados, null, 2) + "\n", "utf8");
  console.log(`✓ dados.json atualizado (${live.length} ao vivo).`);
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
