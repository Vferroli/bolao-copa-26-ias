/* ============================================================
   Bolão Copa 2026 · IAs — section renderers & interactions
   ============================================================ */

function render() {
  renderStamp();
  renderPodium();
  const app = document.getElementById("app");
  // com jogo EM ANDAMENTO (começou e não apurado), "Hoje" sobe pro topo — independe
  // do feed live (cobre o buraco em que dados.live some mas o jogo ainda rola)
  const agora = Date.now();
  const temLive = (S.dados.jogos || []).some((j) =>
    kickData(j) === S.HOJE && agora >= new Date(j.kickoff).getTime() && !apurado(j));
  const secs = temLive
    ? [secHoje(), secTorcida(), secScoring(), secPrompt(), secProximos(), secGrupos(), secMata(), secHistorico()]
    : [secTorcida(), secScoring(), secPrompt(), secHoje(), secProximos(), secGrupos(), secMata(), secHistorico()];
  app.innerHTML = secs.join("");
  wireInteractions();
  renderFavBadge();
  wireNavSpy();
  observeReveal();
  countUp();
  // podium is above the fold — reveal on load (don't wait for scroll observer)
  requestAnimationFrame(() => document.getElementById("podium").classList.add("is-in"));
}

/* carimbo relativo que tiquetaqueia ("há Xs / há X min") → sensação de vivo
   mesmo entre atualizações de dados. Acima de 1h, cai pra data/hora. */
function fmtRel(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "agora mesmo";
  if (s < 60) return "há " + s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return "há " + m + " min";
  return null;
}
function paintStamp() {
  const el = document.getElementById("stamp-time");
  if (!el || !S._stampTs) return;
  const rel = fmtRel(S._stampTs);
  if (rel) { el.textContent = rel; el.classList.add("rel"); }
  else {
    const d = new Date(S._stampTs);
    el.textContent = `${dataTZ(d).split("-").reverse().join("/").slice(0, 5)} · ${horaTZ(d)}`;
    el.classList.remove("rel");
  }
}
function renderStamp() {
  S._stampTs = S.dados.atualizado_em ? new Date(S.dados.atualizado_em).getTime() : Date.now();
  paintStamp();
  if (!S._stampTicker) S._stampTicker = setInterval(paintStamp, 10000);
}

/* ---------- PÓDIO / ranking ---------- */

/* indicador de movimento no ranking após o último jogo apurado */
function rankMove(prevPos, id, pos) {
  if (!prevPos) return ""; // nenhum jogo apurado ainda — nada a comparar
  const delta = (prevPos[id] || pos) - pos; // > 0 = subiu posições
  if (delta > 0) {
    return `<span class="rank-move up" title="Subiu ${delta} ${delta > 1 ? "posições" : "posição"} no último jogo">
      <span class="arr" aria-hidden="true">▲</span>${delta}<span class="sr">subiu ${delta}</span></span>`;
  }
  if (delta < 0) {
    const n = -delta;
    return `<span class="rank-move down" title="Caiu ${n} ${n > 1 ? "posições" : "posição"} no último jogo">
      <span class="arr" aria-hidden="true">▼</span>${n}<span class="sr">caiu ${n}</span></span>`;
  }
  return `<span class="rank-move same" title="Manteve a posição no último jogo">
    <span class="arr" aria-hidden="true">–</span><span class="sr">manteve</span></span>`;
}

function renderPodium() {
  const rk = ranking();
  const max = Math.max(1, ...rk.map((r) => r.total));
  const prevPos = posicoesAnteriores();
  const medals = ["🥇", "🥈", "🥉"];
  const host = document.getElementById("podium");
  host.innerHTML = rk
    .map((ia, i) => {
      const w = Math.round((ia.total / max) * 100);
      const pos = i + 1;
      const head = i < 3 ? `<span class="medal">${medals[i]}</span>` : `<span class="num">${pos}º</span>`;
      const meta = pos === 1
        ? `<div class="meta meta-leader"><span class="crown" aria-hidden="true">👑</span> Líder</div>`
        : `<div class="meta">${pos}º lugar</div>`;
      const torce = !!(S.vote && S.vote.mine && S.vote.mine.champ === ia.id);
      return `<article class="rank-card ${i === 0 ? "leader" : ""}${torce ? " torcendo" : ""}" data-pos="${pos}" data-ia="${ia.id}" style="--cor:${ia.cor}">
        <div class="rank-pos">${head}${rankMove(prevPos, ia.id, pos)}</div>
        <div class="rank-id">
          ${kit(ia, "lg")}
          <div>
            <div class="name">${esc(ia.nome)}</div>
            ${meta}
            ${torce ? `<span class="rank-torce">♥ Torcendo</span>` : ""}
          </div>
        </div>
        <div class="rank-pts">
          <div class="val" data-count="${ia.total}">0</div>
          <div class="unit">pontos</div>
        </div>
        <div class="rank-bar"><i style="--w:${w}%"></i></div>
      </article>`;
    })
    .join("");
}

/* ---------- SCORING PANEL ---------- */
function secScoring() {
  const tiers = [
    { v: 25, c: "var(--ok)", d: "Placar exato" },
    { v: 15, c: "var(--gemini)", d: "Vencedor + diferença de gols" },
    { v: 10, c: "var(--open)", d: "Só o vencedor / empate" },
    { v: 5, c: "var(--grok)", d: "Gols de um dos times" },
  ];
  return `<section class="reveal" id="pontuacao">
    <div class="sec-head">
      <span class="kicker">Como pontua</span>
      <h2>Sistema de pontos</h2>
      <span class="pill">faixa × fase + bônus</span>
    </div>
    <div class="card score-panel">
      <div class="tiers">
        ${tiers.map((t) => `<div class="tier" style="--tc:${t.c}">
          <div class="v">${t.v}<small>pts</small></div>
          <div class="d">${t.d}</div>
        </div>`).join("")}
      </div>
      <div class="mults">
        <span class="mult">Grupos <b>×1</b></span>
        <span class="mult">16-avos <b>×1.5</b></span>
        <span class="mult">Oitavas <b>×2</b></span>
        <span class="mult">Quartas <b>×2.5</b></span>
        <span class="mult">Semi <b>×3</b></span>
        <span class="mult">Final <b>×4</b></span>
        <span class="mult bonus">Cravou quem avança <b>+8</b></span>
        <span class="mult bonus">Cravou o artilheiro <b>+3</b></span>
      </div>
    </div>
  </section>`;
}

/* ---------- O QUE FOI SOLICITADO ÀS IAS ---------- */
function secPrompt() {
  return `<section class="reveal" id="prompt-ias">
    <div class="prompt-cta card">
      <span class="pc-badge" aria-hidden="true">🤖</span>
      <div class="pc-txt">
        <span class="kicker">IA vs IA</span>
        <h3>O que foi solicitado para as IAs</h3>
        <p>Um único prompt, idêntico para Claude, GPT, Gemini e Grok: pesquisar a fundo, cravar UM placar e responder num formato fixo. Sem chute genérico.</p>
      </div>
      <button class="pc-btn" id="open-prompt" type="button">
        Conferir <span aria-hidden="true">→</span>
      </button>
    </div>
  </section>`;
}

/* "Copa ao vivo / No gramado agora" foi mesclada em "Jogos de hoje" (secHoje):
   o jogo ao vivo vira card destacado no topo de Hoje, com placar em tempo real
   + palpites + voto + escalações no MESMO card. Sem redundância. */

/* ---------- live: helpers de gols ---------- */
const liveEntry = (id) => (Array.isArray(S.dados.live) ? S.dados.live : []).find((l) => String(l.id) === String(id));
const liveGolsNomes = (id) => { const e = liveEntry(id); return e && Array.isArray(e.gols) ? e.gols.map((g) => g.nome).filter(Boolean) : []; };

/* ---------- chips de palpite ---------- */
function chips(j, comPts) {
  // num jogo AO VIVO, destaca o palpite de artilheiro que já marcou (autor do gol live)
  const liveNomes = !apurado(j) ? liveGolsNomes(j.id) : [];
  const cells = S.dados.ias.map((ia) => {
    const p = j.palpites && j.palpites[ia.id];
    if (!p) return `<div class="chip miss" style="--cor:${ia.cor}">
      ${kit(ia, "sm")}<span class="who">${esc(ia.nome)}</span><span class="gv">—</span></div>`;
    const pts = comPts ? pontosJogo(j, p) : null;
    let marcCls = "", hitLive = false;
    if (p.marcador) {
      if (apurado(j)) marcCls = cravouMarcador(p, j.real) ? " ok" : " no";
      else if (liveNomes.length && cravouMarcador(p, { marcadores: liveNomes })) { marcCls = " ok hit"; hitLive = true; }
    }
    const marc = p.marcador ? `<span class="marc${marcCls}">⚽ ${esc(p.marcador)}</span>` : "";
    return `<div class="chip${hitLive ? " hit" : ""}" style="--cor:${ia.cor}">
      ${kit(ia, "sm")}<span class="who">${esc(ia.nome)}</span>
      <span class="gv">${placar(p)}</span>
      ${pts == null ? "" : `<span class="pts">+${fmt(pts)}</span>`}
      ${marc}
    </div>`;
  });
  const any = S.dados.ias.some((ia) => j.palpites && j.palpites[ia.id]);
  if (!any) return `<div class="preds"><span class="sem-pal">As IAs ainda não cravaram este jogo.</span></div>`;
  return `<div class="preds">${cells.join("")}</div>`;
}

/* ---------- ESCALAÇÕES (lineups) ---------- */
const POS_ORDER = { G: 0, D: 1, M: 2, F: 3 };
const POS_LABEL = { G: "Goleiro", D: "Defesa", M: "Meio-campo", F: "Ataque" };
const POS_COR = { G: "var(--gold)", D: "var(--gemini)", M: "var(--ok)", F: "var(--claude)" };

function plRow(p) {
  const pos = p && p.pos in POS_ORDER ? p.pos : "";
  return `<li class="pl" style="--pc:${POS_COR[pos] || "var(--faint)"}">
    <span class="num">${p.num != null ? esc(String(p.num)) : "–"}</span>
    <span class="nm">${esc(p.nome || "—")}</span>
  </li>`;
}
function plGrouped(players) {
  const arr = (players || []).slice();
  let out = "";
  ["G", "D", "M", "F"].forEach((g) => {
    const list = arr.filter((p) => p.pos === g).sort((a, b) => (a.num || 0) - (b.num || 0));
    if (!list.length) return;
    out += `<li class="pl-grp">${POS_LABEL[g]}</li>` + list.map(plRow).join("");
  });
  const rest = arr.filter((p) => !(p.pos in POS_ORDER));
  if (rest.length) out += rest.map(plRow).join("");
  return out;
}
function lnCol(teamId, side, formacao, tecnico) {
  if (!side) return "";
  const t = time(teamId);
  const tit = side.titulares || [];
  const res = side.reservas || [];
  const coach = tecnico ? `<div class="ln-coach">Téc. <b>${esc(tecnico)}</b></div>` : "";
  const form = formacao ? `<span class="ln-form">${esc(formacao)}</span>` : "";
  const subs = res.length
    ? `<details class="ln-subs"><summary>Reservas <b>${res.length}</b></summary>
        <ul class="ln-list">${plGrouped(res)}</ul></details>`
    : "";
  const lista = tit.length
    ? `<ul class="ln-list">${plGrouped(tit)}</ul>`
    : `<p class="ln-empty">Titulares ainda não divulgados.</p>`;
  return `<div class="ln-col">
    <div class="ln-head">${bandeira(teamId)}<span class="ln-team">${esc(t.nome)}</span>${form}</div>
    ${coach}
    ${lista}
    ${subs}
  </div>`;
}
function pitchRows(titulares, formacao) {
  const tit = (titulares || []).slice();
  const gk = tit.filter((p) => p.pos === "G");
  const others = tit
    .filter((p) => p.pos !== "G")
    .sort((a, b) => (POS_ORDER[a.pos] ?? 9) - (POS_ORDER[b.pos] ?? 9) || (a.num || 0) - (b.num || 0));
  const lines = String(formacao || "").split(/[^0-9]+/).map((n) => parseInt(n, 10)).filter((n) => n > 0);
  const sum = lines.reduce((a, b) => a + b, 0);
  let rows;
  if (lines.length && sum === others.length) {
    rows = []; let i = 0;
    lines.forEach((n) => { rows.push(others.slice(i, i + n)); i += n; });
  } else {
    rows = ["D", "M", "F"].map((g) => others.filter((p) => p.pos === g)).filter((r) => r.length);
    const unk = others.filter((p) => !(p.pos in POS_ORDER));
    if (unk.length) rows.push(unk);
  }
  return { gk, rows };
}
function pitchDot(p) {
  return `<div class="pf-dot"><span class="pf-num">${p.num != null ? esc(String(p.num)) : ""}</span>
    <span class="pf-name">${esc(p.nome || "")}</span></div>`;
}
function pitch(teamId, side, formacao) {
  if (!side || !(side.titulares && side.titulares.length)) return "";
  const t = time(teamId);
  const { gk, rows } = pitchRows(side.titulares, formacao);
  const body =
    rows.slice().reverse().map((r) => `<div class="pf-row">${r.map(pitchDot).join("")}</div>`).join("") +
    (gk.length ? `<div class="pf-row pf-gk">${gk.map(pitchDot).join("")}</div>` : "");
  return `<div class="pf-team">
    <div class="pf-head">${bandeira(teamId)}<span class="ln-team">${esc(t.nome)}</span>${formacao ? `<span class="ln-form">${esc(formacao)}</span>` : ""}</div>
    <div class="pitch">${body}</div>
  </div>`;
}
function escalacoes(j, ctx) {
  const e = j && j.escalacoes;
  if (!e || !e.casa || !e.fora) return "";
  const fc = (e.formacao && e.formacao.casa) || "";
  const ff = (e.formacao && e.formacao.fora) || "";
  const tc = (e.tecnico && e.tecnico.casa) || "";
  const tf = (e.tecnico && e.tecnico.fora) || "";
  const uid = `${ctx}-${j.id}`;
  const meta = [fc, ff].filter(Boolean).join(" · ");
  const hasField =
    (e.casa.titulares && e.casa.titulares.length) || (e.fora.titulares && e.fora.titulares.length);
  const seg = hasField
    ? `<div class="lv-seg" role="group" aria-label="Modo de visualização">
        <button type="button" data-view="lista" aria-pressed="true">Lista</button>
        <button type="button" data-view="campo" aria-pressed="false">Campo</button>
      </div>`
    : "";
  return `<div class="lineup">
    <button class="lineup-toggle" type="button" aria-expanded="false" aria-controls="lineup-${uid}" data-lineup="${uid}">
      <span class="lt-ico" aria-hidden="true"></span>
      <span class="lt-lbl">Escalações</span>
      ${meta ? `<span class="lt-meta">${esc(meta)}</span>` : ""}
      <span class="lt-chev" aria-hidden="true">▾</span>
    </button>
    <div class="lineup-body" id="lineup-${uid}" data-view="lista">
      <div class="lb-inner"><div class="lb-pad">
        <div class="lb-top"><span class="lb-src">Escalações${e.fonte ? " · " + esc(e.fonte) : ""}</span>${seg}</div>
        <div class="lv-lista lineup-cols">
          ${lnCol(j.casa, e.casa, fc, tc)}
          ${lnCol(j.fora, e.fora, ff, tf)}
        </div>
        ${hasField ? `<div class="lv-campo"><div class="pitch-pair">${pitch(j.casa, e.casa, fc)}${pitch(j.fora, e.fora, ff)}</div></div>` : ""}
      </div></div>
    </div>
  </div>`;
}

/* ---------- JOGOS DE HOJE (inclui o ao vivo destacado) ---------- */
const faseLbl = (j) => (j.fase === "grupos" ? "Grupo " + j.grupo : (S.fases[j.fase] && S.fases[j.fase].nome) || "Mata-mata");

/* card de jogo de hoje. liveData != null → destacado, placar em tempo real.
   prevScores/newScores: detecção de gol p/ o flash (comparado ao render anterior). */
function cardHoje(j, liveData, prevScores, newScores, opts) {
  opts = opts || {};
  const c = time(j.casa), f = time(j.fora);
  const fim = apurado(j);
  const emJogo = !!opts.emJogo && !fim;   // começou e não acabou (com ou sem feed live)
  const stale = !!opts.stale;             // liveData é o último conhecido (feed sumiu)
  let top, score, scoreCls;
  if (emJogo) {
    // bola rolando: badge "Ao vivo" mesmo se o feed sumiu — nunca volta pra "Aberto"
    const minTxt = liveData && liveData.min ? esc(liveData.min) : "em andamento";
    top = `<div class="game-top live">
        <span class="live-tag"><span class="blink"></span> Ao vivo</span>
        <span class="time">${minTxt} · ${faseLbl(j)}</span>
      </div>`;
    if (liveData && liveData.casa != null) {
      const key = `${liveData.casa}-${liveData.fora}`;
      if (!stale) newScores[j.id] = key;
      const changed = !stale && (j.id in prevScores) && prevScores[j.id] !== key;
      score = `${liveData.casa}<em>:</em>${liveData.fora}`;
      scoreCls = (changed ? "flash " : "") + (stale ? "stale" : "");
    } else {
      score = "–"; scoreCls = "tbd"; // começou mas sem placar (feed indisponível)
    }
  } else if (fim) {
    top = `<div class="game-top">
        <span class="tag">${faseLbl(j)}</span>
        <span class="status done">Apurado</span>
        <span class="time">Encerrado</span>
      </div>`;
    score = `${j.real.casa}<em>:</em>${j.real.fora}`;
    scoreCls = "";
  } else {
    top = `<div class="game-top">
        <span class="tag">${faseLbl(j)}</span>
        <span class="status open">Aberto</span>
        <span class="time">Hoje · ${kickHora(j)}</span>
      </div>`;
    score = kickHora(j);
    scoreCls = "tbd";
  }
  // goleadores: ao vivo (autor + minuto) ou encerrado (lista de real.marcadores, só nomes)
  const golItens = emJogo && liveData && Array.isArray(liveData.gols) && liveData.gols.length
    ? liveData.gols.map((g) => `⚽ ${esc(g.nome)}${g.min != null ? ` <b>${g.min}'</b>` : ""}`)
    : fim && Array.isArray(j.real.marcadores) && j.real.marcadores.length
    ? j.real.marcadores.map((n) => `⚽ ${esc(n)}`)
    : [];
  const gols = golItens.length
    ? `<div class="live-gols">${golItens.map((g) => `<span class="lg">${g}</span>`).join("")}</div>`
    : "";
  // cartões (só ao vivo): 🟨 amarelo / 🟥 vermelho + jogador + minuto
  const cartoes = emJogo && liveData && Array.isArray(liveData.cartoes) && liveData.cartoes.length
    ? `<div class="live-cards">${liveData.cartoes.map((c) => `<span class="lc ${c.cor === "vermelho" ? "red" : "yellow"}"><span class="cd"></span>${esc(c.nome)}${c.min != null ? ` <b>${c.min}'</b>` : ""}</span>`).join("")}</div>`
    : "";
  // substituições (só ao vivo): entrou ⬆ / saiu ⬇
  const subs = emJogo && liveData && Array.isArray(liveData.subs) && liveData.subs.length
    ? `<div class="live-subs">${liveData.subs.map((s) => `<span class="sub">${s.min != null ? `<b>${s.min}'</b>` : ""}<span class="in">▲ ${esc(s.entrou || "—")}</span><span class="out">▼ ${esc(s.saiu || "—")}</span></span>`).join("")}</div>`
    : "";
  return `<article class="game${emJogo ? " live featured" : ""}"${emJogo ? ` data-live="${j.id}"` : ""}>
      ${top}
      <div class="match big">
        <div class="team home"><span class="tn">${esc(c.nome)}</span>${bandeira(j.casa)}</div>
        <div class="score ${scoreCls}">${score}</div>
        <div class="team away">${bandeira(j.fora)}<span class="tn">${esc(f.nome)}</span></div>
      </div>
      ${gols}
      ${cartoes}
      ${subs}
      <div class="game-sep"></div>
      <div class="preds-lbl">Palpites das IAs</div>
      ${chips(j, fim)}
      ${voteMatch(j, "hoje")}
      ${escalacoes(j, "hoje")}
    </article>`;
}

/* card do 1º jogo de amanhã ("a seguir") — agora com palpites também */
function cardProximo(j) {
  const a = time(j.casa), b = time(j.fora);
  return `<article class="game next-card">
      <div class="game-top">
        <span class="tag">${faseLbl(j)}</span>
        <span class="next-tag">A seguir</span>
        <span class="time">${rotuloData(kickData(j)).split(",")[0]} · ${kickHora(j)}</span>
      </div>
      <div class="match big">
        <div class="team home"><span class="tn">${esc(a.nome)}</span>${bandeira(j.casa)}</div>
        <div class="score tbd">${kickHora(j)}</div>
        <div class="team away">${bandeira(j.fora)}<span class="tn">${esc(b.nome)}</span></div>
      </div>
      <div class="game-sep"></div>
      <div class="preds-lbl">Palpites das IAs</div>
      ${chips(j, false)}
      ${voteMatch(j, "next")}
      ${escalacoes(j, "next")}
    </article>`;
}

function secHoje() {
  const now = Date.now();
  const liveById = {};
  (Array.isArray(S.dados.live) ? S.dados.live : []).forEach((l) => { liveById[l.id] = l; });
  // memória do último placar ao vivo conhecido — sobrevive a buracos do feed
  S._liveLast = S._liveLast || {};
  Object.values(liveById).forEach((l) => { if (l && l.casa != null) S._liveLast[l.id] = { casa: l.casa, fora: l.fora, min: l.min, gols: l.gols, subs: l.subs, cartoes: l.cartoes }; });

  // "em jogo" = começou (relógio passou do kickoff) e NÃO apurado — independe do feed
  const emJogo = (j) => now >= new Date(j.kickoff).getTime() && !apurado(j);
  const byKick = (a, b) => a.kickoff.localeCompare(b.kickoff);
  // jogos de hoje (todas as fases) ∪ qualquer jogo em andamento; dedup
  const seen = new Set();
  const todayU = S.dados.jogos.filter((j) => (kickData(j) === S.HOJE || emJogo(j)) && (seen.has(j.id) ? false : seen.add(j.id)));
  // grupos na ordem: em jogo → próximos de hoje → (amanhã) → encerrados de hoje
  const liveG = todayU.filter(emJogo).sort(byKick);
  const upG = todayU.filter((j) => !emJogo(j) && !apurado(j)).sort(byKick);
  const doneG = todayU.filter(apurado).sort(byKick);
  const prox = S.dados.jogos
    .filter((j) => !apurado(j) && !emJogo(j) && kickData(j) > S.HOJE)
    .sort(byKick)[0];
  if (!liveG.length && !upG.length && !doneG.length && !prox) return "";

  // flash de gol: compara placares ao vivo com o render anterior
  const prevScores = S._liveScores || {};
  const newScores = {};
  const card = (j) => {
    if (!emJogo(j)) return cardHoje(j, null, prevScores, newScores, { emJogo: false });
    const cur = liveById[j.id], last = S._liveLast[j.id];
    const live = cur || last || null;            // placar atual, senão o último conhecido
    const stale = !cur && !!last;                // feed sumiu → mostra último (sem flash)
    return cardHoje(j, live, prevScores, newScores, { emJogo: true, stale });
  };
  const cards = [
    ...liveG.map(card),
    ...upG.map(card),
    prox ? cardProximo(prox) : "",
    ...doneG.map(card),
  ].join("");
  S._liveScores = newScores;

  const hasLive = liveG.length > 0;
  return `<section class="reveal" id="hoje">
    <div class="sec-head">
      <span class="kicker">Rodada de hoje</span>
      <h2>${hasLive ? "Hoje · ao vivo" : "Jogos de hoje"}</h2>
      <span class="pill">${hasLive ? "tempo real" : rotuloData(S.HOJE)}</span>
    </div>
    <div class="today-grid">${cards}</div>
  </section>`;
}

/* ---------- PRÓXIMOS (agenda por dia) ---------- */
function secProximos() {
  const fut = S.dados.jogos
    .filter((j) => j.fase === "grupos" && kickData(j) > S.HOJE)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!fut.length) return "";
  const dias = {};
  fut.forEach((j) => { (dias[kickData(j)] = dias[kickData(j)] || []).push(j); });
  const blocos = Object.keys(dias).sort().map((d, i) => {
    const lista = dias[d];
    const fixes = lista.map((j) => {
      const a = time(j.casa), b = time(j.fora);
      return `<div class="fix">
        <span class="fh">${kickHora(j)}</span>
        <div class="fm">
          <span class="t home"><span>${esc(a.nome)}</span>${bandeira(j.casa)}</span>
          <span class="x">×</span>
          <span class="t away">${bandeira(j.fora)}<span>${esc(b.nome)}</span></span>
        </div>
      </div>`;
    }).join("");
    return `<details class="day" ${i === 0 ? "open" : ""}>
      <summary>
        <span class="day-date">${rotuloData(d)}</span>
        <span class="day-count">${lista.length} jogo${lista.length > 1 ? "s" : ""}</span>
        <span class="day-chev">▾</span>
      </summary>
      <div class="day-body">${fixes}</div>
    </details>`;
  }).join("");
  return `<section class="reveal" id="proximos">
    <div class="sec-head">
      <span class="kicker">Agenda</span>
      <h2>Próximos jogos</h2>
      <span class="pill">Fase de grupos completa</span>
    </div>
    <div class="agenda">${blocos}</div>
    ${secMataDatas()}
  </section>`;
}

/* ---------- datas do mata-mata (roadmap) ---------- */
function fmtDiaCurto(iso) {
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [, m, dia] = iso.split("-");
  return `${dia} ${MES[Number(m) - 1]}`;
}
function secMataDatas() {
  const fases = (S.dados.fases || []).filter((f) => f.mata && f.inicio);
  if (!fases.length) return "";
  const linhas = fases.map((f) => {
    const dt = f.fim && f.fim !== f.inicio
      ? `${fmtDiaCurto(f.inicio)} – ${fmtDiaCurto(f.fim)}`
      : fmtDiaCurto(f.inicio);
    return `<div class="kr">
      <span class="kr-fase">${esc(f.nome)}</span>
      <span class="kr-mx">×${fmt(f.mult)}</span>
      <span class="kr-data">${dt}</span>
    </div>`;
  }).join("");
  return `<div class="mata-datas">
    <div class="md-head"><span class="kicker">Eliminatórias · datas</span></div>
    <div class="kr-list">${linhas}</div>
    <p class="md-note">Confrontos definidos após a fase de grupos. Fases finais valem mais pontos.</p>
  </div>`;
}

/* ---------- GRUPOS & classificação ---------- */
function secGrupos() {
  const grupos = [...new Set(Object.values(S.dados.times).map((t) => t.grupo))].sort();
  const top3 = melhoresTerceiros(grupos); // Set com os 8 melhores 3º colocados
  const cards = grupos.map((g) => {
    const tab = standings(g);
    const rows = tab.map((t, i) => {
      const sg = t.gp - t.gc;
      const cls = i < 2 ? "qual" : (i === 2 && top3.has(t.id) ? "qual3" : "");
      return `<tr class="${cls}">
        <td class="team-cell"><span class="rk">${i + 1}</span>${bandeira(t.id)}${esc(t.nome)}</td>
        <td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td>
        <td>${sg > 0 ? "+" + sg : sg}</td><td class="pts">${t.pts}</td>
      </tr>`;
    }).join("");
    return `<div class="grp">
      <div class="grp-head">
        <span class="grp-badge">${g}</span>
        <span class="lbl">Grupo ${g}</span>
      </div>
      <table class="tbl">
        <thead><tr>
          <th class="team-cell">Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>P</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="grp-foot">
        <span class="q"></span> 2 primeiros
        <span class="q q3"></span> 3º entre os 8 melhores
      </div>
    </div>`;
  }).join("");
  return `<section class="reveal" id="grupos">
    <div class="sec-head">
      <span class="kicker">Fase de grupos</span>
      <h2>Grupos &amp; classificação</h2>
      <span class="pill">2 + 8 melhores 3º</span>
    </div>
    <div class="groups-grid">${cards}</div>
  </section>`;
}

/* 8 melhores terceiros (formato Copa 2026): 3º de cada grupo, ranqueados por
   pts > saldo > gols pró; os 8 primeiros avançam aos 16-avos. */
function melhoresTerceiros(grupos) {
  const terceiros = grupos
    .map((g) => standings(g)[2])
    .filter(Boolean)
    .filter((t) => t.j > 0) // só conta quem já jogou (evita marcar grupo vazio)
    .sort((a, b) =>
      b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || a.nome.localeCompare(b.nome)
    );
  return new Set(terceiros.slice(0, 8).map((t) => t.id));
}

/* ---------- MATA-MATA (chaveamento) ---------- */
function secMata() {
  const tbd = (txt) => `<div class="slot tbd"><span class="flag">⚽</span><span class="nm">${txt}</span><span class="sc">–</span></div>`;
  const tie = (a, b, cls) => `<div class="tie ${cls || ""}">${a}${b}</div>`;
  const rounds = [
    { lbl: "16-avos", mx: "×1.5", ties: [["1º A", "2º B"], ["1º C", "2º D"], ["1º E", "2º F"], ["1º G", "2º H"]] },
    { lbl: "Oitavas", mx: "×2", ties: [["Venc. 1", "Venc. 2"], ["Venc. 3", "Venc. 4"]] },
    { lbl: "Quartas", mx: "×2.5", ties: [["Venc. A", "Venc. B"]] },
    { lbl: "Semi", mx: "×3", ties: [["Finalista 1", "Finalista 2"]] },
  ];
  const cols = rounds.map((r) => `<div class="round">
    <div class="round-lbl">${r.lbl} <span class="mx">${r.mx}</span></div>
    ${r.ties.map(([x, y]) => tie(tbd(x), tbd(y))).join("")}
  </div>`).join("");
  const finalCol = `<div class="round">
    <div class="round-lbl">Final <span class="mx">×4</span></div>
    ${tie(tbd("Campeão A"), tbd("Campeão B"), "final-tie")}
  </div>`;
  const trophy = `<div class="trophy-final"><div class="cup">🏆</div><div class="cap">Campeão 2026</div></div>`;
  return `<section class="reveal" id="mata">
    <div class="sec-head">
      <span class="kicker">Eliminatórias</span>
      <h2>Mata-mata</h2>
      <span class="pill">fases valem mais</span>
    </div>
    <div class="card" style="padding:16px">
      <div class="bracket-scroll"><div class="bracket">${cols}${finalCol}${trophy}</div></div>
    </div>
  </section>`;
}

/* ---------- HISTÓRICO ---------- */
function secHistorico() {
  const fin = S.dados.jogos
    .filter((j) => apurado(j) && S.dados.ias.some((ia) => j.palpites && j.palpites[ia.id]))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  if (!fin.length) return "";
  const rows = fin.map((j) => {
    const c = time(j.casa), f = time(j.fora);
    const pills = S.dados.ias.map((ia) => {
      const p = j.palpites && j.palpites[ia.id];
      const pts = pontosJogo(j, p);
      if (!p) return "";
      return `<span class="ppill" style="--cor:${ia.cor}">${kit(ia, "sm")}<b>${placar(p)}</b>
        <span class="pp ${pts ? "" : "zero"}">+${fmt(pts || 0)}</span></span>`;
    }).join("");
    const gols = Array.isArray(j.real.marcadores) && j.real.marcadores.length
      ? `<div class="hgols">${j.real.marcadores.map((n) => `<span>⚽ ${esc(n)}</span>`).join("")}</div>`
      : "";
    return `<div class="hrow">
      <div class="hmatch">
        <div class="t home"><span>${esc(c.nome)}</span>${bandeira(j.casa)}</div>
        <div class="fin">${j.real.casa}<span style="color:var(--faint)">:</span>${j.real.fora}</div>
        <div class="t away">${bandeira(j.fora)}<span>${esc(f.nome)}</span></div>
      </div>
      <div class="hpts">${pills}</div>
      ${gols}
    </div>`;
  }).join("");
  return `<section class="reveal" id="historico">
    <div class="sec-head">
      <span class="kicker">Apurados</span>
      <h2>Histórico</h2>
      <span class="pill">${fin.length} jogo${fin.length > 1 ? "s" : ""}</span>
    </div>
    <div class="hist">${rows}</div>
  </section>`;
}

/* ============================================================
   VOTO DO PÚBLICO (sem login) — render dos componentes
   A) voto por jogo (.vote-match, dentro dos cards)
   B) IA favorita pro título (badge na topbar + seção #torcida)
   Estado vem de S.vote (app.js): mine (localStorage) + tallies (Supabase).
   ============================================================ */
const jogoById = (id) => S.dados.jogos.find((j) => String(j.id) === String(id));

/* estado do voto por jogo: open → votável; live/locked → resultado; resolved → resultado+selo */
function voteState(j) {
  if (apurado(j)) return "resolved";
  const liveIds = new Set((Array.isArray(S.dados.live) ? S.dados.live : []).map((l) => l.id));
  if (liveIds.has(j.id)) return "live";
  if (Date.now() >= new Date(j.kickoff).getTime()) return "locked"; // trava no apito
  return "open";
}
const vTally = (id) => (S.vote && S.vote.tallies.games[id]) || {};
const vTotal = (t) => S.dados.ias.reduce((a, ia) => a + (t[ia.id] || 0), 0);
const vShow = (total) => total >= VOTE_MIN;

/* ---------- Componente A: voto por jogo ---------- */
function voteMatch(j, ctx) {
  if (!S.vote) return "";
  const st = voteState(j);
  const mine = S.vote.mine.games[j.id] || null;
  const t = vTally(j.id);
  const total = vTotal(t);
  if (st === "open") {
    const head = total === 0
      ? `<div class="vote-empty"><span class="vote-spark" aria-hidden="true"></span><span>Ninguém cravou ainda. <b>Seja o primeiro!</b></span></div>`
      : `<div class="vote-head"><span class="vote-q">Qual IA crava esse jogo?</span><span class="vote-meta">${total} voto${total === 1 ? "" : "s"}</span></div>`;
    const foot = mine
      ? `<div class="vote-foot"><span>Seu palpite: <b style="color:#fff">${esc(S.ia[mine].nome)}</b></span><span class="vote-edit-hint">toque pra trocar</span></div>`
      : `<div class="vote-foot"><span class="vote-cta">Toque pra cravar sua aposta</span></div>`;
    return `<div class="vote-match" data-game="${esc(j.id)}" data-ctx="${ctx}">${head}${voteOpts(j, mine)}${foot}</div>`;
  }
  // travado / ao vivo / encerrado → modo resultado
  const seal = st === "resolved" ? voteSeal(j, t, total) : "";
  const head = st === "resolved" ? ""
    : `<div class="vote-head"><span class="vote-q">O público cravou</span><span class="vote-lock">Votação fechada</span></div>`;
  const body = total === 0
    ? `<p class="vote-note">Ninguém votou neste jogo.</p>`
    : voteResults(j, mine, vShow(total)) + (vShow(total) ? "" : `<div class="vote-note">Percentuais liberam a partir de ${VOTE_MIN} votos</div>`);
  return `<div class="vote-match" data-game="${esc(j.id)}" data-ctx="${ctx}" data-state="${st}">${seal}${head}${body}</div>`;
}

function voteOpts(j, mine) {
  return `<div class="vote-opts" role="radiogroup" aria-label="Qual IA crava esse jogo?">
    ${S.dados.ias.map((ia) => {
      const m = ia.id === mine;
      return `<button class="vote-opt ${m ? "is-mine" : ""}" type="button" role="radio" aria-checked="${m}" data-ia="${ia.id}" style="--cor:${ia.cor}">
        ${m ? `<span class="vote-you">Você</span>` : ""}
        ${kit(ia)}
        <span class="vote-opt-name">${esc(ia.nome)}</span>
        <span class="vote-dot" aria-hidden="true"></span>
      </button>`;
    }).join("")}
  </div>`;
}

function voteResults(j, mine, showPct) {
  const t = vTally(j.id);
  const total = vTotal(t);
  const max = Math.max(1, ...S.dados.ias.map((ia) => t[ia.id] || 0));
  return `<div class="vote-results">
    ${S.dados.ias.map((ia) => {
      const v = t[ia.id] || 0;
      const pct = total ? Math.round((v / total) * 100) : 0;
      const fill = showPct ? pct : Math.round((v / max) * 100);
      const m = ia.id === mine;
      const val = showPct ? `${pct}<small>%</small>` : `${v}<small>voto${v === 1 ? "" : "s"}</small>`;
      return `<div class="vote-bar ${m ? "is-mine" : ""}" style="--cor:${ia.cor};--pct:${fill}%">
        ${kit(ia)}
        <span class="vote-bar-name">${esc(ia.nome)}${m ? `<span class="vote-mine-tag">Você</span>` : ""}</span>
        <span class="vote-bar-track"><span class="vote-bar-fill"></span></span>
        <span class="vote-bar-val">${val}</span>
      </div>`;
    }).join("")}
  </div>`;
}

/* selo "público acertou?": IA mais votada × IA que mais pontuou no jogo */
function crowdLeader(t) {
  let best = null, bv = 0;
  S.dados.ias.forEach((ia) => { const v = t[ia.id] || 0; if (v > bv) { bv = v; best = ia.id; } });
  return best;
}
function topScorerIa(j) {
  let best = null, bp = -1;
  S.dados.ias.forEach((ia) => {
    const p = pontosJogo(j, j.palpites && j.palpites[ia.id]);
    if (p != null && p > bp) { bp = p; best = ia.id; }
  });
  return bp > 0 ? best : null;
}
function voteSeal(j, t, total) {
  if (!total) return "";
  const leader = crowdLeader(t), top = topScorerIa(j);
  if (!leader || !top) return "";
  const nome = esc(S.ia[leader].nome);
  if (leader === top) {
    return `<div class="vote-seal vote-seal--hit"><span class="vote-seal-ico">✓</span><span>O público acertou — <b>${nome}</b> foi a mais cravada e a que mais pontuou.</span></div>`;
  }
  return `<div class="vote-seal vote-seal--miss"><span class="vote-seal-ico">✕</span><span>O público errou — a mais votada (<b>${nome}</b>) não foi quem mais pontuou.</span></div>`;
}

/* ---------- Componente B: IA favorita pro título ---------- */
function secTorcida() {
  if (!S.vote) return "";
  return `<section class="reveal" id="torcida">
    <div class="sec-head">
      <span class="kicker">Torcida das IAs</span>
      <h2>Quem leva o título?</h2>
      <span class="pill">voto do público</span>
    </div>
    <div class="card vote-fav" style="padding:18px">
      <div id="fav-chooser">${favChooserHtml()}</div>
      <div id="fav-board">${favBoardHtml()}</div>
    </div>
  </section>`;
}
function favChooserHtml() {
  const mine = S.vote.mine.champ;
  return `<div class="fav-choose">
    <div class="fav-q">Em quem você torce pro título?</div>
    <div class="vote-fav-pick" role="radiogroup" aria-label="Escolha sua IA favorita pro título">
      ${S.dados.ias.map((ia) => {
        const m = ia.id === mine;
        return `<button class="vote-fav-opt ${m ? "is-mine" : ""}" type="button" role="radio" aria-checked="${m}" data-champ="${ia.id}" style="--cor:${ia.cor}">${kit(ia)}<span class="vote-fav-opt-name">${esc(ia.nome)}</span></button>`;
      }).join("")}
    </div>
  </div>`;
}
function favBoardHtml() {
  const champ = (S.vote.tallies.champ) || {};
  const total = S.dados.ias.reduce((a, ia) => a + (champ[ia.id] || 0), 0);
  const showPct = total >= VOTE_MIN;
  const mine = S.vote.mine.champ;
  const max = Math.max(1, ...S.dados.ias.map((ia) => champ[ia.id] || 0));
  const sorted = S.dados.ias.slice().sort((a, b) => (champ[b.id] || 0) - (champ[a.id] || 0));
  const rows = sorted.map((ia, i) => {
    const v = champ[ia.id] || 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    const fill = showPct ? pct : Math.round((v / max) * 100);
    const leader = i === 0 && v > 0;
    const m = ia.id === mine;
    const val = showPct ? `${pct}` : `${v}`;
    const unit = showPct ? "do público" : `voto${v === 1 ? "" : "s"}`;
    return `<div class="vote-board-row ${leader ? "leader" : ""} ${m ? "is-mine" : ""}" style="--cor:${ia.cor}">
      <span class="vote-board-pos">${i + 1}</span>
      ${kit(ia)}
      <div class="vote-board-id">
        <div class="vote-board-name">${esc(ia.nome)}${leader ? `<span class="vote-board-crown">👑</span>` : ""}${m ? `<span class="vote-mine-tag">Sua torcida</span>` : ""}</div>
        <div class="vote-board-track"><span class="vote-board-fill" style="--pct:${fill}%"></span></div>
      </div>
      <div class="vote-board-val"><span class="v">${val}${showPct ? "<small style='font-size:0.6em'>%</small>" : ""}</span><span class="u">${unit}</span></div>
    </div>`;
  }).join("");
  const head = `<div class="fav-board-head"><span class="fav-board-ttl">Torcida do público</span><span class="pill">${total} voto${total === 1 ? "" : "s"}</span></div>`;
  const note = showPct ? "" : `<div class="vote-note">Percentuais liberam a partir de ${VOTE_MIN} votos</div>`;
  return `${head}<div class="vote-board">${rows}</div>${note}`;
}
function favBadgeHtml() {
  if (!S.vote) return "";
  const id = S.vote.mine.champ;
  if (!id) {
    return `<button class="vote-fav-badge is-empty" type="button" id="fav-badge" aria-label="Escolher IA favorita pro título">
      <span class="kit" style="--cor:var(--faint)" aria-hidden="true">★</span>
      <span class="vote-fav-txt"><span class="vote-fav-lbl">Sua torcida</span><span class="vote-fav-name">Escolher IA</span></span>
    </button>`;
  }
  const ia = S.ia[id];
  return `<button class="vote-fav-badge" type="button" id="fav-badge" style="--cor:${ia.cor}" aria-label="Você torce: ${esc(ia.nome)}. Toque para trocar.">
    ${kit(ia)}
    <span class="vote-fav-txt"><span class="vote-fav-lbl">Você torce</span><span class="vote-fav-name">${esc(ia.nome)}</span></span>
    <span class="vote-fav-edit">trocar</span>
  </button>`;
}
function renderFavBadge() {
  const slot = document.getElementById("fav-slot");
  if (slot) slot.innerHTML = favBadgeHtml();
}

/* ---------- re-render dirigido por estado (sem re-render global) ---------- */
function refreshGameVotes(gameId) {
  document.querySelectorAll(".vote-match").forEach((el) => {
    if (el.dataset.game !== String(gameId)) return;
    const j = jogoById(gameId);
    if (j) el.outerHTML = voteMatch(j, el.dataset.ctx);
  });
}
function refreshChampUI() {
  const ch = document.getElementById("fav-chooser"); if (ch) ch.innerHTML = favChooserHtml();
  const bd = document.getElementById("fav-board"); if (bd) bd.innerHTML = favBoardHtml();
  renderFavBadge();
  refreshPodiumTorcendo();
}
/* destaca no placar geral a IA que o usuário escolheu torcer (borda + tag),
   sem re-renderizar o pódio (evita replay do count-up). */
function refreshPodiumTorcendo() {
  const champ = S.vote && S.vote.mine ? S.vote.mine.champ : null;
  document.querySelectorAll("#podium .rank-card").forEach((el) => {
    const on = el.dataset.ia === champ;
    el.classList.toggle("torcendo", on);
    const has = el.querySelector(".rank-torce");
    if (on && !has) {
      const holder = el.querySelector(".rank-id > div");
      if (holder) holder.insertAdjacentHTML("beforeend", `<span class="rank-torce">♥ Torcendo</span>`);
    } else if (!on && has) {
      has.remove();
    }
  });
}
/* chamado pelo app.js quando as tallies chegam/atualizam */
function refreshAllVotes() {
  document.querySelectorAll(".vote-match").forEach((el) => {
    const j = jogoById(el.dataset.game);
    if (j) el.outerHTML = voteMatch(j, el.dataset.ctx);
  });
  refreshChampUI();
}

/* ---------- ações (otimista + reconcília com o servidor) ---------- */
async function onVoteGame(gameId, ia) {
  if (!S.vote) return;
  const j = jogoById(gameId);
  if (!j || voteState(j) !== "open") return; // travado: ignora
  const prev = S.vote.mine.games[gameId] || null;
  if (prev === ia) return;
  const t = S.vote.tallies.games[gameId] = S.vote.tallies.games[gameId] || {};
  if (prev) t[prev] = Math.max(0, (t[prev] || 0) - 1);
  t[ia] = (t[ia] || 0) + 1;
  S.vote.mine.games[gameId] = ia;
  saveMine();
  refreshGameVotes(gameId);
  try { const r = await sbVoteGame(gameId, ia); if (!r.ok) throw new Error(r.status); } catch (_) {}
  refreshTallies();
}
async function onVoteChamp(ia) {
  if (!S.vote) return;
  const prev = S.vote.mine.champ;
  if (prev === ia) return;
  const c = S.vote.tallies.champ;
  if (prev) c[prev] = Math.max(0, (c[prev] || 0) - 1);
  c[ia] = (c[ia] || 0) + 1;
  S.vote.mine.champ = ia;
  saveMine();
  refreshChampUI();
  try { const r = await sbVoteChamp(ia); if (!r.ok) throw new Error(r.status); } catch (_) {}
  refreshTallies();
}

/* ---------- wiring (delegação no document, uma vez só) ---------- */
function wireVotes() {
  if (S._voteWired) return;
  S._voteWired = true;
  document.addEventListener("click", (e) => {
    const opt = e.target.closest(".vote-opt");
    if (opt) { const m = opt.closest(".vote-match"); if (m) onVoteGame(m.dataset.game, opt.dataset.ia); return; }
    const fav = e.target.closest(".vote-fav-opt");
    if (fav) { onVoteChamp(fav.dataset.champ); return; }
    const badge = e.target.closest("#fav-badge");
    if (badge) {
      const sec = document.getElementById("torcida");
      if (sec) sec.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }
  });
}

/* ============================================================
   INTERACTIONS & ANIMATIONS
   ============================================================ */
function wireInteractions() {
  setupPromptModal();
  wireLineups();
  wireVotes();
}

/* ---------- escalações: toggle do acordeão + Lista/Campo ---------- */
function wireLineups() {
  document.querySelectorAll(".lineup-toggle").forEach((btn) => {
    const wrap = btn.closest(".lineup");
    const inner = wrap && wrap.querySelector(".lb-inner");
    if (inner) inner.inert = true; // colapsado por padrão (fora do tab order)
    btn.addEventListener("click", () => {
      const open = wrap.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      if (inner) inner.inert = !open;
    });
  });
  document.querySelectorAll(".lineup-body .lv-seg button[data-view]").forEach((b) => {
    b.addEventListener("click", () => {
      const body = b.closest(".lineup-body");
      body.dataset.view = b.dataset.view;
      body.querySelectorAll(".lv-seg button[data-view]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b))
      );
    });
  });
}

/* ---------- modal: o que foi pedido às IAs ---------- */
function setupPromptModal() {
  const modal = document.getElementById("prompt-modal");
  const opener = document.getElementById("open-prompt");
  if (!modal) return;
  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => {
      modal.classList.add("show");
      const x = modal.querySelector(".modal-x");
      if (x) x.focus();
    });
  };
  const close = () => {
    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
    modal.setAttribute("aria-hidden", "true");
    const finish = () => { modal.hidden = true; modal.removeEventListener("transitionend", finish); };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else setTimeout(finish, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  if (opener) opener.addEventListener("click", open);
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });
  // contenção simples de foco
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...modal.querySelectorAll('a[href],button:not([disabled])')].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* count-up for ranking points */
function countUp() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("#podium .val[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count) || 0;
    if (reduce || target === 0) { el.textContent = fmt(target); return; }
    const dur = 1100, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(target * e * 10) / 10);
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    };
    requestAnimationFrame(step);
    // fallback: guarantee final value even if rAF is throttled (background tab)
    setTimeout(() => { el.textContent = fmt(target); }, dur + 300);
  });
}

/* scrollspy do menu de âncoras (mobile): destaca a seção visível */
function wireNavSpy() {
  const links = [...document.querySelectorAll(".nav-mobile a")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const map = {};
  links.forEach((a) => { map[a.getAttribute("href").slice(1)] = a; });
  const targets = Object.keys(map).map((id) => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => l.classList.remove("active"));
      const a = map[en.target.id];
      if (a) a.classList.add("active");
    });
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
  targets.forEach((t) => io.observe(t));
}

/* scroll reveal */
function observeReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
  els.forEach((e) => io.observe(e));
  // safety: if the observer never fires (some embedded contexts), reveal anyway
  setTimeout(() => els.forEach((e) => e.classList.add("is-in")), 2600);
}

/* destaque da IA líder é estático agora (CSS: glow + selo "👑 Líder") —
   confete/sheen infinitos removidos por peso no mobile. */

