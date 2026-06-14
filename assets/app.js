/* Bolão Copa 2026 — IAs · painel
   Lê dados.json, calcula a apuração (REGRAS.md) e desenha tudo.
   Datas/horas em horário de Brasília. Placar ao vivo: TheSportsDB. */

/* ---------- logos oficiais das IAs (Lobehub icons) ---------- */
const LOGOS = {
  claude:
    '<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757"/></svg>',
  gpt:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"/></svg>',
  gemini:
    '<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#4285F4"/></svg>',
  grok:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>',
};

const estado = { dados: null, prompt: "", fases: {}, ia: {}, TZ: "America/Sao_Paulo", HOJE: "" };

/* ---------- carregamento ---------- */
async function carregar() {
  try {
    const resp = await fetch("dados.json?ts=" + Date.now());
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    estado.dados = await resp.json();
  } catch (e) {
    document.getElementById("app").innerHTML =
      `<div class="aviso erro">Não consegui carregar <code>dados.json</code> (${e.message}).</div>`;
    return;
  }
  estado.TZ = estado.dados.fuso || "America/Sao_Paulo";
  estado.HOJE = dataTZ(new Date());
  estado.dados.fases.forEach((f) => (estado.fases[f.id] = f));
  estado.dados.ias.forEach((i) => (estado.ia[i.id] = i));
  try {
    estado.prompt = await (await fetch("PROMPT.md?ts=" + Date.now())).text();
  } catch (_) {
    estado.prompt = "";
  }
  render();
  carregarAoVivo();
}

/* ---------- datas em horário local (Brasília) ---------- */
function dataTZ(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: estado.TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
function horaTZ(d) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: estado.TZ, hour: "2-digit", minute: "2-digit",
  }).format(d);
}
function rotuloData(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const txt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC", weekday: "long", day: "2-digit", month: "long",
  }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
const kickData = (j) => dataTZ(new Date(j.kickoff));
const kickHora = (j) => horaTZ(new Date(j.kickoff));

/* ---------- apuração (espelha REGRAS.md) ---------- */
function faixaBase(palpite, real) {
  const pc = palpite.casa, pf = palpite.fora, rc = real.casa, rf = real.fora;
  const golsDeUm = pc === rc || pf === rf ? 5 : 0;
  if (pc === rc && pf === rf) return 25;
  if (rc === rf) return pc === pf ? 10 : golsDeUm;
  if (pc === pf) return golsDeUm;
  if (Math.sign(pc - pf) === Math.sign(rc - rf)) return pc - pf === rc - rf ? 15 : 10;
  return golsDeUm;
}
function pontosJogo(jogo, palpite) {
  const r = jogo.real;
  if (!palpite || r == null || r.casa == null || r.fora == null) return null;
  const fase = estado.fases[jogo.fase];
  let pts = faixaBase(palpite, r) * fase.mult;
  if (fase.mata && palpite.avanca && r.avancou && palpite.avanca === r.avancou) pts += 8;
  return pts;
}
function ranking() {
  const tot = {};
  estado.dados.ias.forEach((i) => (tot[i.id] = 0));
  estado.dados.jogos.forEach((j) => {
    estado.dados.ias.forEach((i) => {
      const p = pontosJogo(j, j.palpites && j.palpites[i.id]);
      if (p != null) tot[i.id] += p;
    });
  });
  return estado.dados.ias.map((i) => ({ ...i, total: tot[i.id] })).sort((a, b) => b.total - a.total);
}

/* ---------- helpers ---------- */
const fmt = (n) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const placarPalpite = (p) => (p && p.casa != null && p.fora != null ? `${p.casa}-${p.fora}` : "—");
const apurado = (j) => j.real && j.real.casa != null && j.real.fora != null;
const time = (id) => (estado.dados.times && estado.dados.times[id]) || { nome: id, flag: "" };
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function logoIA(ia) {
  return `<span class="ia-logo" style="color:${ia.cor}" title="${esc(ia.nome)}">${LOGOS[ia.id] || ""}</span>`;
}

/* ---------- render ---------- */
function render() {
  const app = document.getElementById("app");
  const grupo = estado.dados.jogos.filter((j) => j.fase === "grupos");
  const hoje = grupo.filter((j) => kickData(j) === estado.HOJE);
  const prox = grupo.filter((j) => kickData(j) > estado.HOJE);
  const hist = grupo.filter((j) => kickData(j) < estado.HOJE);

  app.innerHTML =
    blocoRanking() +
    blocoAoVivo() +
    blocoHoje(hoje) +
    blocoAgenda("🗓️", "Próximos jogos", prox, false) +
    blocoGrupos() +
    blocoMataMata() +
    blocoAgenda("📜", "Histórico", hist, true);

  document.getElementById("atualizado").textContent = "Dados de " + (estado.dados.atualizado || "—");
  app.querySelectorAll("[data-prompt-jogo]").forEach((btn) =>
    btn.addEventListener("click", () => copiarPrompt(Number(btn.dataset.promptJogo), btn))
  );
}

function blocoRanking() {
  const r = ranking();
  const medalhas = ["🥇", "🥈", "🥉", "4º"];
  const cards = r
    .map(
      (ia, i) => `<div class="rank-card" style="--cor:${ia.cor}">
        <div class="rank-pos">${medalhas[i] || i + 1 + "º"}</div>
        ${logoIA(ia)}
        <div class="rank-nome">${esc(ia.nome)}</div>
        <div class="rank-pts">${fmt(ia.total)}<span>pts</span></div>
      </div>`
    )
    .join("");
  return `<section><h2>🏆 Ranking</h2><div class="rank-grid">${cards}</div></section>`;
}

function confrontoHTML(j, big) {
  const c = time(j.casa), f = time(j.fora);
  const ao = apurado(j);
  const placar = ao ? `${j.real.casa} <span>x</span> ${j.real.fora}` : `<span class="vs">×</span>`;
  return `<div class="confronto ${big ? "big" : ""}">
    <span class="time casa"><span class="flag">${c.flag || ""}</span> ${esc(c.nome)}</span>
    <span class="placar ${ao ? "final" : ""}">${placar}</span>
    <span class="time fora">${esc(f.nome)} <span class="flag">${f.flag || ""}</span></span>
  </div>`;
}

function palpitesHTML(j, comPts) {
  return estado.dados.ias
    .map((ia) => {
      const p = j.palpites && j.palpites[ia.id];
      if (!p) return "";
      const pts = comPts ? pontosJogo(j, p) : null;
      return `<span class="chip" style="--cor:${ia.cor}">${logoIA(ia)}<b>${placarPalpite(p)}</b>${
        pts == null ? "" : `<em>+${fmt(pts)}</em>`
      }</span>`;
    })
    .join("");
}

function blocoHoje(hoje) {
  const cabec = `<h2>📅 Jogos de hoje <span class="data-hoje">${estado.HOJE.split("-").reverse().join("/")}</span></h2>`;
  if (!hoje.length)
    return `<section>${cabec}<div class="aviso">Nenhum jogo da fase de grupos hoje. Veja os próximos jogos abaixo.</div></section>`;
  hoje.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return `<section>${cabec}${hoje.map(cardHoje).join("")}</section>`;
}

function cardHoje(j) {
  const fase = estado.fases[j.fase];
  const ao = apurado(j);
  const pals = palpitesHTML(j, ao);
  return `<div class="jogo-card">
    <div class="jogo-top">
      <span class="badge" style="--mc:${corFase(j.fase)}">${esc(fase.nome)}${j.grupo ? " · Grupo " + j.grupo : ""} · ×${fase.mult}</span>
      <span class="hora">${kickHora(j)}</span>
    </div>
    ${confrontoHTML(j, true)}
    <div class="palpites">${pals || '<span class="sem-pal">Sem palpites ainda — copie o prompt e pergunte às IAs.</span>'}</div>
    <div class="jogo-acoes">
      <button class="btn" data-prompt-jogo="${j.id}">📋 Copiar prompt deste jogo</button>
      <span class="status ${ao ? "ok" : "open"}">${ao ? "✓ apurado" : "○ aberto"}</span>
    </div>
  </div>`;
}

function linhaJogo(j, comPts) {
  const ao = apurado(j);
  const pals = palpitesHTML(j, comPts);
  const acao = comPts ? "" : `<button class="btn pequeno" data-prompt-jogo="${j.id}">📋 prompt</button>`;
  return `<div class="linha ${ao ? "fin" : ""}">
    <div class="linha-top">
      <span class="hora">${kickHora(j)}</span>
      ${confrontoHTML(j, false)}
      <span class="status ${ao ? "ok" : "open"}">${ao ? "✓" : "○"}</span>
    </div>
    ${pals ? `<div class="linha-pals">${pals}</div>` : ""}
    ${acao}
  </div>`;
}

function blocoAgenda(emoji, titulo, jogos, decrescente) {
  if (!jogos.length) return "";
  const porDia = {};
  jogos.forEach((j) => {
    const d = kickData(j);
    (porDia[d] = porDia[d] || []).push(j);
  });
  let dias = Object.keys(porDia).sort();
  if (decrescente) dias.reverse();
  const blocos = dias
    .map((d, idx) => {
      const lista = porDia[d].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
      const aberto = !decrescente && idx === 0 ? "open" : "";
      return `<details class="dia" ${aberto}>
        <summary><span class="dia-rot">${rotuloData(d)}</span><span class="dia-cont">${lista.length} jogo${lista.length > 1 ? "s" : ""}</span></summary>
        <div class="dia-jogos">${lista.map((j) => linhaJogo(j, decrescente)).join("")}</div>
      </details>`;
    })
    .join("");
  return `<section><h2>${emoji} ${titulo} <span class="sub">${jogos.length} jogos</span></h2>${blocos}</section>`;
}

function blocoGrupos() {
  const grupos = {};
  Object.entries(estado.dados.times).forEach(([id, t]) => {
    (grupos[t.grupo] = grupos[t.grupo] || []).push({ id, ...t });
  });
  const tabela = (gid) => {
    const st = {};
    grupos[gid].forEach((t) => (st[t.id] = { ...t, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }));
    estado.dados.jogos
      .filter((j) => j.fase === "grupos" && j.grupo === gid && apurado(j))
      .forEach((j) => {
        const a = st[j.casa], b = st[j.fora];
        if (!a || !b) return;
        a.j++; b.j++; a.gp += j.real.casa; a.gc += j.real.fora; b.gp += j.real.fora; b.gc += j.real.casa;
        if (j.real.casa > j.real.fora) { a.v++; a.pts += 3; b.d++; }
        else if (j.real.casa < j.real.fora) { b.v++; b.pts += 3; a.d++; }
        else { a.e++; b.e++; a.pts++; b.pts++; }
      });
    const ordem = Object.values(st).sort(
      (x, y) => y.pts - x.pts || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp || x.nome.localeCompare(y.nome)
    );
    const linhas = ordem
      .map(
        (t, i) => `<tr class="${i < 2 ? "classifica" : ""}">
        <td class="conf"><span class="flag">${t.flag}</span> ${esc(t.nome)}</td>
        <td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td><td>${t.gp - t.gc > 0 ? "+" : ""}${t.gp - t.gc}</td><td class="ptg">${t.pts}</td>
      </tr>`
      )
      .join("");
    return `<details class="grupo">
      <summary><span class="badge" style="--mc:#475569">Grupo ${gid}</span>
        <span class="grupo-times">${grupos[gid].map((t) => t.flag).join(" ")}</span></summary>
      <div class="tab-wrap"><table class="tab compact">
        <thead><tr><th class="conf">Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Pts</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
    </details>`;
  };
  const html = Object.keys(grupos).sort().map(tabela).join("");
  return `<section><h2>🏟️ Grupos &amp; classificação</h2><div class="grupos-grid">${html}</div></section>`;
}

function blocoMataMata() {
  const fases = estado.dados.fases.filter((f) => f.mata);
  const html = fases
    .map((f) => {
      const jogos = estado.dados.jogos.filter((j) => j.fase === f.id);
      const cont = jogos.length || (f.slots ? f.slots + " a definir" : "—");
      let linhas;
      if (jogos.length) {
        linhas = jogos.map((j) => linhaJogo(j, apurado(j))).join("");
      } else {
        linhas = Array.from(
          { length: f.slots },
          () => `<div class="linha vazio"><div class="linha-top"><span class="hora">—</span>
            <div class="confronto"><span class="time casa">a definir</span><span class="placar"><span class="vs">×</span></span><span class="time fora">a definir</span></div>
            <span class="status open">○</span></div></div>`
        ).join("");
      }
      return `<details class="dia">
        <summary><span class="badge" style="--mc:${corFase(f.id)}">${esc(f.nome)} · ×${f.mult}</span><span class="dia-cont">${cont}</span></summary>
        <div class="dia-jogos">${linhas}</div>
      </details>`;
    })
    .join("");
  return `<section><h2>🔝 Mata-mata <span class="sub">em aberto</span></h2>${html}</section>`;
}

function corFase(id) {
  const cores = {
    grupos: "#64748b", "16avos": "#0891b2", oitavas: "#7c3aed",
    quartas: "#db2777", semi: "#ea580c", terceiro: "#65a30d", final: "#eab308",
  };
  return cores[id] || "#64748b";
}

/* ---------- copiar prompt ---------- */
function copiarPrompt(idJogo, btn) {
  const j = estado.dados.jogos.find((x) => x.id === idJogo);
  if (!j) return;
  const fase = estado.fases[j.fase];
  const linhaMata = fase.mata ? " (mata-mata — diga também quem avança)" : "";
  const texto =
    (estado.prompt || "O jogo que você vai palpitar é:") +
    `\n${time(j.casa).nome} x ${time(j.fora).nome} — ${fase.nome}${j.grupo ? " (Grupo " + j.grupo + ")" : ""}${linhaMata}\n`;
  navigator.clipboard.writeText(texto).then(() => flash(btn, "✓ Copiado!"), () => flash(btn, "Erro"));
}
function flash(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.classList.add("flash");
  setTimeout(() => { btn.textContent = orig; btn.classList.remove("flash"); }, 1500);
}

/* ---------- ao vivo (TheSportsDB) ---------- */
function blocoAoVivo() {
  return `<section class="aovivo">
    <h2>🔴 Copa ao vivo <span class="sub">TheSportsDB</span></h2>
    <div id="aovivo-conteudo" class="aviso">Buscando jogos da Copa…</div>
    <div class="aovivo-cfg">
      <label>Chave da API (opcional): <input id="apikey" type="text" placeholder="usa a grátis '3' por padrão" /></label>
      <button class="btn pequeno" id="salvar-key">Salvar e atualizar</button>
    </div>
  </section>`;
}
async function carregarAoVivo() {
  const cont = document.getElementById("aovivo-conteudo");
  if (!cont) return;
  const cfg = estado.dados.ao_vivo || {};
  const liga = cfg.league_id || 4429;
  const keyInput = document.getElementById("apikey");
  const keyGuardada = localStorage.getItem("bolao_apikey") || "";
  if (keyInput) keyInput.value = keyGuardada;
  const key = keyGuardada || cfg.chave_padrao || "3";
  document.getElementById("salvar-key")?.addEventListener("click", () => {
    localStorage.setItem("bolao_apikey", keyInput.value.trim());
    carregarAoVivo();
  });

  let eventos = [];
  try {
    const b = `https://www.thesportsdb.com/api/v1/json/${key}`;
    const [prox, pass] = await Promise.all([
      fetch(`${b}/eventsnextleague.php?id=${liga}`).then((r) => r.json()).catch(() => ({})),
      fetch(`${b}/eventspastleague.php?id=${liga}`).then((r) => r.json()).catch(() => ({})),
    ]);
    eventos = [].concat(pass.events || [], prox.events || []);
  } catch (_) {
    eventos = [];
  }
  if (!eventos.length) {
    cont.className = "aviso";
    cont.innerHTML = "Sem jogos da Copa retornados pela API agora. (Pode não estar em andamento, ou a chave grátis está limitada.)";
    return;
  }
  const ev = (e, fut) =>
    `<div class="ev ${fut ? "futuro" : ""}"><span>${esc(e.strHomeTeam)}</span><b>${
      fut ? "×" : e.intHomeScore + " - " + e.intAwayScore
    }</b><span>${esc(e.strAwayTeam)}</span><i>${esc((e.dateEvent || "").split("-").reverse().join("/"))} ${esc(
      fut && e.strTime ? e.strTime.slice(0, 5) : ""
    )}</i></div>`;
  const recentes = eventos.filter((e) => e.intHomeScore != null).slice(-6).reverse().map((e) => ev(e, false)).join("");
  const futuros = eventos.filter((e) => e.intHomeScore == null).slice(0, 6).map((e) => ev(e, true)).join("");
  cont.className = "aovivo-grid";
  cont.innerHTML =
    (recentes ? `<div class="ev-col"><h3>Últimos resultados</h3>${recentes}</div>` : "") +
    (futuros ? `<div class="ev-col"><h3>Próximos jogos</h3>${futuros}</div>` : "");
}

carregar();
