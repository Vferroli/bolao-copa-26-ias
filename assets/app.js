/* ============================================================
   Bolão Copa 2026 · IAs — render (vanilla, no build)
   Reads dados.json, mirrors REGRAS.md scoring, draws the page.
   ============================================================ */

/* ---------- AI logos (official marks, Lobehub) ---------- */
const LOGOS = {
  claude:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/></svg>',
  gpt:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"/></svg>',
  gemini:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"/></svg>',
  grok:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>',
};

const S = { dados: null, fases: {}, ia: {}, TZ: "America/Sao_Paulo", HOJE: "", prompt: "" };

/* ---------- helpers ---------- */
const fmt = (n) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const placar = (p) => (p && p.casa != null && p.fora != null ? `${p.casa}-${p.fora}` : "—");
const apurado = (j) => j.real && j.real.casa != null && j.real.fora != null;
const time = (id) => (S.dados.times && S.dados.times[id]) || { nome: id, flag: "" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function dataTZ(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: S.TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function horaTZ(d) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: S.TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}
function rotuloData(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const txt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
const kickData = (j) => dataTZ(new Date(j.kickoff));
const kickHora = (j) => horaTZ(new Date(j.kickoff));

function kit(ia, cls) {
  return `<span class="kit ${cls || ""}" style="--cor:${ia.cor}" title="${esc(ia.nome)}">${LOGOS[ia.id] || ""}</span>`;
}

/* ---------- bandeiras (SVG via flagcdn — renderiza igual em qualquer device) ----------
   Inglaterra/Escócia usam código de subdivisão (gb-eng/gb-sct). Fallback: emoji do dados.json. */
const ISO = {
  algeria: "dz", argentina: "ar", australia: "au", austria: "at", belgium: "be",
  "bosnia-herzegovina": "ba", brazil: "br", canada: "ca", "cape-verde": "cv", colombia: "co",
  croatia: "hr", curacao: "cw", "czech-republic": "cz", "dr-congo": "cd", ecuador: "ec",
  egypt: "eg", england: "gb-eng", france: "fr", germany: "de", ghana: "gh",
  haiti: "ht", iran: "ir", iraq: "iq", "ivory-coast": "ci", japan: "jp",
  jordan: "jo", mexico: "mx", morocco: "ma", netherlands: "nl", "new-zealand": "nz",
  norway: "no", panama: "pa", paraguay: "py", portugal: "pt", qatar: "qa",
  "saudi-arabia": "sa", scotland: "gb-sct", senegal: "sn", "south-africa": "za", "south-korea": "kr",
  spain: "es", sweden: "se", switzerland: "ch", tunisia: "tn", turkey: "tr",
  uruguay: "uy", usa: "us", uzbekistan: "uz",
};
function bandeira(id) {
  const iso = ISO[id];
  if (!iso) { const t = time(id); return `<span class="flag flag-emoji">${t.flag || ""}</span>`; }
  return `<img class="flag flag-img" src="https://flagcdn.com/${iso}.svg" loading="lazy" decoding="async" alt="" />`;
}

/* ---------- scoring (mirrors REGRAS.md) ---------- */
function faixaBase(p, r) {
  const pc = p.casa, pf = p.fora, rc = r.casa, rf = r.fora;
  const golsDeUm = pc === rc || pf === rf ? 5 : 0;
  if (pc === rc && pf === rf) return 25;
  if (rc === rf) return pc === pf ? 10 : golsDeUm;
  if (pc === pf) return golsDeUm;
  if (Math.sign(pc - pf) === Math.sign(rc - rf)) return pc - pf === rc - rf ? 15 : 10;
  return golsDeUm;
}
function pontosJogo(j, p) {
  const r = j.real;
  if (!p || r == null || r.casa == null || r.fora == null) return null;
  const fase = S.fases[j.fase];
  let pts = faixaBase(p, r) * fase.mult;
  if (fase.mata && p.avanca && r.avancou && p.avanca === r.avancou) pts += 8;
  // bônus artilheiro: cravou 1 marcador (e não palpitou 0x0) e ele marcou → +3 fixo
  if (cravouMarcador(p, r)) pts += 3;
  return pts;
}

/* ---------- bônus artilheiro: fuzzy de nome (Jaro-Winkler, sem libs) ----------
   O palpite traz o NOME do jogador (texto livre da IA); o real traz a lista de
   quem marcou (via API). Normaliza (sem acento/sufixos) e casa por token com
   Jaro-Winkler — robusto a apelido, grafia e abreviação. Limiar conservador. */
function jaro(a, b) {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const win = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const fa = new Array(la).fill(false), fb = new Array(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - win), hi = Math.min(i + win + 1, lb);
    for (let k = lo; k < hi; k++) {
      if (fb[k] || a[i] !== b[k]) continue;
      fa[i] = fb[k] = true; m++; break;
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < la; i++) {
    if (!fa[i]) continue;
    while (!fb[k]) k++;
    if (a[i] !== b[k++]) t++;
  }
  return (m / la + m / lb + (m - t / 2) / m) / 3;
}
function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let p = 0;
  const max = Math.min(4, a.length, b.length);
  while (p < max && a[p] === b[p]) p++;
  return j + p * 0.1 * (1 - j);
}
const normNome = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/['’`.\-]/g, " ")
  .replace(/\b(jr|junior|filho|neto|i{2,3})\b/g, " ")
  .replace(/\s+/g, " ").trim();
const tokensNome = (s) => normNome(s).split(" ").filter((t) => t.length > 1);

/* true se o palpite de artilheiro bateu com algum gol do jogo. Regra: não vale
   se a IA palpitou 0x0 (não pode cravar marcador num jogo sem gols). */
function cravouMarcador(p, r) {
  if (!p || !p.marcador || (p.casa === 0 && p.fora === 0)) return false;
  if (!r || !Array.isArray(r.marcadores) || !r.marcadores.length) return false;
  const pt = tokensNome(p.marcador);
  if (!pt.length) return false;
  for (const nome of r.marcadores) {
    for (const b of tokensNome(nome)) {
      for (const a of pt) if (jaroWinkler(a, b) >= 0.9) return true;
    }
  }
  return false;
}
function ranking() {
  const tot = {};
  S.dados.ias.forEach((i) => (tot[i.id] = 0));
  S.dados.jogos.forEach((j) => {
    S.dados.ias.forEach((i) => {
      const p = pontosJogo(j, j.palpites && j.palpites[i.id]);
      if (p != null) tot[i.id] += p;
    });
  });
  return S.dados.ias.map((i) => ({ ...i, total: tot[i.id] })).sort((a, b) => b.total - a.total);
}

/* ---------- group standings ---------- */
function standings(grupo) {
  const teams = {};
  Object.entries(S.dados.times).forEach(([id, t]) => {
    if (t.grupo === grupo) teams[id] = { id, ...t, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
  });
  S.dados.jogos.forEach((j) => {
    if (j.fase !== "grupos" || j.grupo !== grupo || !apurado(j)) return;
    const a = teams[j.casa], b = teams[j.fora];
    if (!a || !b) return;
    const gc = j.real.casa, gf = j.real.fora;
    a.j++; b.j++; a.gp += gc; a.gc += gf; b.gp += gf; b.gc += gc;
    if (gc > gf) { a.v++; b.d++; a.pts += 3; }
    else if (gc < gf) { b.v++; a.d++; b.pts += 3; }
    else { a.e++; b.e++; a.pts++; b.pts++; }
  });
  return Object.values(teams).sort((x, y) =>
    y.pts - x.pts || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp || x.nome.localeCompare(y.nome)
  );
}

document.addEventListener("DOMContentLoaded", carregar);

/* dados.json servido pelo GitHub raw (CDN) — assim atualizar placar é só git push,
   sem deploy no Netlify (que cobra ~15 créditos/deploy). Cache-bust mantém o live
   fresco (raw cacheia 300s, mas a query fura o cache). Fallback: cópia same-origin. */
const DATA_RAW = "https://raw.githubusercontent.com/Vferroli/bolao-copa-26-ias/main/dados.json";
async function fetchDados() {
  try {
    const r = await fetch(DATA_RAW + "?ts=" + Date.now(), { cache: "no-store" });
    if (r.ok) return await r.json();
    throw new Error("raw HTTP " + r.status);
  } catch (_) {
    const r = await fetch("dados.json?ts=" + Date.now(), { cache: "no-store" }); // fallback local
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  }
}

async function carregar() {
  try {
    S.dados = await fetchDados();
  } catch (e) {
    document.getElementById("app").innerHTML =
      `<div class="card" style="padding:18px;color:#fca5a5">Não consegui carregar <code>dados.json</code> (${e.message}).</div>`;
    return;
  }
  S.TZ = S.dados.fuso || "America/Sao_Paulo";
  // demo-friendly "today": use dataset reference date so the panel is always populated
  S.HOJE = S.dados.atualizado || dataTZ(new Date());
  indexar();
  S._stamp = S.dados.atualizado_em || "";
  render();
  iniciarPoll();
}

function indexar() {
  S.fases = {}; S.ia = {};
  S.dados.fases.forEach((f) => (S.fases[f.id] = f));
  S.dados.ias.forEach((i) => (S.ia[i.id] = i));
}

/* auto-atualização adaptativa: repolla dados.json e re-renderiza só quando muda.
   Rápido (60s) só quando há jogo ao vivo ou prestes a começar; lento (5min)
   o resto do tempo. Pausa em aba oculta. Economiza requisições (e crédito). */
const POLL_VIVO = 60000;    // 1 min: jogo rolando / janela de jogo
const POLL_OCIOSO = 300000; // 5 min: sem jogo por perto

function temJogoPorPerto() {
  if (Array.isArray(S.dados.live) && S.dados.live.length) return true;
  const agora = Date.now(), J = 2 * 3600 * 1000; // ±2h de qualquer kickoff sem placar
  return (S.dados.jogos || []).some((j) => {
    if (j.real && j.real.casa != null) return false;
    const k = new Date(j.kickoff).getTime();
    return k >= agora - J && k <= agora + J;
  });
}

function iniciarPoll() {
  let timer = null;
  async function tick() {
    if (!document.hidden) {
      try {
        const novo = await fetchDados();
        if ((novo.atualizado_em || "") !== S._stamp) {
          S._stamp = novo.atualizado_em || "";
          S.dados = novo;
          S.TZ = novo.fuso || S.TZ;
          S.HOJE = novo.atualizado || S.HOJE;
          indexar();
          render();
        }
      } catch (_) { /* silencioso: tenta de novo no próximo tick */ }
    }
    agendar();
  }
  function agendar() {
    clearTimeout(timer);
    timer = setTimeout(tick, temJogoPorPerto() ? POLL_VIVO : POLL_OCIOSO);
  }
  agendar();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
