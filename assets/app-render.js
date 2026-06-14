/* ============================================================
   Bolão Copa 2026 · IAs — section renderers & interactions
   ============================================================ */

function render() {
  renderStamp();
  renderPodium();
  const app = document.getElementById("app");
  app.innerHTML = [
    secScoring(),
    secAoVivo(),
    secHoje(),
    secProximos(),
    secGrupos(),
    secMata(),
    secHistorico(),
  ].join("");
  wireInteractions();
  observeReveal();
  countUp();
  // podium is above the fold — reveal on load (don't wait for scroll observer)
  requestAnimationFrame(() => document.getElementById("podium").classList.add("is-in"));
}

function renderStamp() {
  const el = document.getElementById("stamp-time");
  if (!el) return;
  const d = S.dados.atualizado_em ? new Date(S.dados.atualizado_em) : new Date();
  el.textContent = `${dataTZ(d).split("-").reverse().join("/").slice(0, 5)} · ${horaTZ(d)}`;
}

/* ---------- PÓDIO / ranking ---------- */
function renderPodium() {
  const rk = ranking();
  const max = Math.max(1, ...rk.map((r) => r.total));
  const medals = ["🥇", "🥈", "🥉"];
  const host = document.getElementById("podium");
  host.innerHTML = rk
    .map((ia, i) => {
      const w = Math.round((ia.total / max) * 100);
      const pos = i + 1;
      const head = i < 3 ? `<span class="medal">${medals[i]}</span>` : `<span class="num">${pos}º</span>`;
      return `<article class="rank-card ${i === 0 ? "leader" : ""}" data-pos="${pos}" style="--cor:${ia.cor}">
        ${i === 0 ? '<span class="confetti-host" aria-hidden="true"></span>' : ""}
        <div class="rank-pos">${head}</div>
        <div class="rank-id">
          ${kit(ia, "lg")}
          <div>
            <div class="name">${esc(ia.nome)}</div>
            <div class="meta">${pos === 1 ? "líder" : pos + "º lugar"}</div>
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
    { v: 15, c: "var(--gemini)", d: "Vencedor + saldo de gols" },
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
      </div>
    </div>
  </section>`;
}

/* ---------- COPA AO VIVO (placar real de dados.live + próximos) ---------- */
function liveModel() {
  const byId = {};
  S.dados.jogos.forEach((j) => (byId[j.id] = j));
  // jogos ao vivo: alimentados pelo script/API em dados.live
  const live = (Array.isArray(S.dados.live) ? S.dados.live : [])
    .map((l) => ({ j: byId[l.id], casa: l.casa, fora: l.fora, min: l.min }))
    .filter((x) => x.j)
    .sort((a, b) => a.j.kickoff.localeCompare(b.j.kickoff));
  const liveIds = new Set(live.map((x) => x.j.id));
  const ref = S.dados.atualizado_em || new Date().toISOString();
  const prox = S.dados.jogos
    .filter((j) => !apurado(j) && !liveIds.has(j.id) && j.kickoff > ref)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(0, live.length ? 3 : 4);
  return { live, prox };
}
function secAoVivo() {
  const { live, prox } = liveModel();
  if (!live.length && !prox.length) return "";
  const faseLbl = (j) => (j.fase === "grupos" ? "Grupo " + j.grupo : (S.fases[j.fase] && S.fases[j.fase].nome) || "Mata-mata");
  const liveCards = live.map(({ j, casa, fora, min }) => {
    const c = time(j.casa), f = time(j.fora);
    return `<article class="live-card featured" data-live="${j.id}">
      <div class="live-head">
        <span class="live-tag"><span class="blink"></span> Ao vivo</span>
        <span class="live-min">${esc(min || "ao vivo")} · ${faseLbl(j)}</span>
      </div>
      <div class="match big">
        <div class="team home"><span class="tn">${esc(c.nome)}</span><span class="flag">${c.flag}</span></div>
        <div class="score">${casa}<em>:</em>${fora}</div>
        <div class="team away"><span class="flag">${f.flag}</span><span class="tn">${esc(f.nome)}</span></div>
      </div>
    </article>`;
  }).join("");
  const proxCards = prox.map((j) => {
    const a = time(j.casa), b = time(j.fora);
    return `<article class="live-card next">
      <div class="live-head">
        <span class="next-tag">A seguir</span>
        <span class="live-min">${rotuloData(kickData(j)).split(",")[0]} · ${kickHora(j)}</span>
      </div>
      <div class="match">
        <div class="team home"><span class="tn">${esc(a.nome)}</span><span class="flag">${a.flag}</span></div>
        <div class="score tbd">vs</div>
        <div class="team away"><span class="flag">${b.flag}</span><span class="tn">${esc(b.nome)}</span></div>
      </div>
    </article>`;
  }).join("");
  const headPill = live.length ? "tempo real" : "em breve";
  return `<section class="reveal" id="aovivo">
    <div class="sec-head">
      <span class="kicker">Copa ao vivo</span>
      <h2>${live.length ? "No gramado agora" : "A seguir"}</h2>
      <span class="pill">${headPill}</span>
    </div>
    <div class="live-grid">${liveCards}${proxCards}</div>
  </section>`;
}

/* ---------- chips de palpite ---------- */
function chips(j, comPts) {
  const cells = S.dados.ias.map((ia) => {
    const p = j.palpites && j.palpites[ia.id];
    if (!p) return `<div class="chip miss" style="--cor:${ia.cor}">
      ${kit(ia, "sm")}<span class="who">${esc(ia.nome)}</span><span class="gv">—</span></div>`;
    const pts = comPts ? pontosJogo(j, p) : null;
    return `<div class="chip" style="--cor:${ia.cor}">
      ${kit(ia, "sm")}<span class="who">${esc(ia.nome)}</span>
      <span class="gv">${placar(p)}</span>
      ${pts == null ? "" : `<span class="pts">+${fmt(pts)}</span>`}
    </div>`;
  });
  const any = S.dados.ias.some((ia) => j.palpites && j.palpites[ia.id]);
  if (!any) return `<div class="preds"><span class="sem-pal">As IAs ainda não cravaram este jogo.</span></div>`;
  return `<div class="preds">${cells.join("")}</div>`;
}

/* ---------- JOGOS DE HOJE ---------- */
function secHoje() {
  const hoje = S.dados.jogos
    .filter((j) => j.fase === "grupos" && kickData(j) === S.HOJE)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!hoje.length) return "";
  const cards = hoje.map((j) => {
    const c = time(j.casa), f = time(j.fora);
    const fim = apurado(j);
    const sc = fim
      ? `${j.real.casa}<em>:</em>${j.real.fora}`
      : `${kickHora(j)}`;
    return `<article class="game">
      <div class="game-top">
        <span class="tag">Grupo ${j.grupo}</span>
        ${fim ? '<span class="status done">Apurado</span>' : '<span class="status open">Aberto</span>'}
        <span class="time">${fim ? "Encerrado" : "Hoje · " + kickHora(j)}</span>
      </div>
      <div class="match big">
        <div class="team home"><span class="tn">${esc(c.nome)}</span><span class="flag">${c.flag}</span></div>
        <div class="score ${fim ? "" : "tbd"}">${sc}</div>
        <div class="team away"><span class="flag">${f.flag}</span><span class="tn">${esc(f.nome)}</span></div>
      </div>
      <div class="game-sep"></div>
      <div class="preds-lbl">Palpites das IAs</div>
      ${chips(j, fim)}
    </article>`;
  }).join("");
  const cta = `<button class="cta-day" data-prompt-dia="${S.HOJE}">
    <span class="ico">📋</span> Copiar prompt do dia · ${hoje.length} jogo${hoje.length > 1 ? "s" : ""}
  </button>`;
  return `<section class="reveal" id="hoje">
    <div class="sec-head">
      <span class="kicker">Rodada de hoje</span>
      <h2>Jogos de hoje</h2>
      <span class="pill">${rotuloData(S.HOJE)}</span>
    </div>
    ${cta}
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
  const blocos = Object.keys(dias).sort().slice(0, 6).map((d, i) => {
    const lista = dias[d];
    const fixes = lista.map((j) => {
      const a = time(j.casa), b = time(j.fora);
      return `<div class="fix">
        <span class="fh">${kickHora(j)}</span>
        <div class="fm">
          <span class="t home"><span>${esc(a.nome)}</span><span class="flag">${a.flag}</span></span>
          <span class="x">×</span>
          <span class="t away"><span class="flag">${b.flag}</span><span>${esc(b.nome)}</span></span>
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
    </div>
    <div class="agenda">${blocos}</div>
  </section>`;
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
        <td class="team-cell"><span class="rk">${i + 1}</span><span class="flag">${t.flag}</span>${esc(t.nome)}</td>
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
    return `<div class="hrow">
      <div class="hmatch">
        <div class="t home"><span>${esc(c.nome)}</span><span class="flag">${c.flag}</span></div>
        <div class="fin">${j.real.casa}<span style="color:var(--faint)">:</span>${j.real.fora}</div>
        <div class="t away"><span class="flag">${f.flag}</span><span>${esc(f.nome)}</span></div>
      </div>
      <div class="hpts">${pills}</div>
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
   INTERACTIONS & ANIMATIONS
   ============================================================ */
function wireInteractions() {
  document.querySelectorAll("[data-prompt-dia]").forEach((btn) =>
    btn.addEventListener("click", () => copiarPromptDia(btn.dataset.promptDia, btn))
  );
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
  spawnConfetti();
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

/* confetti behind the leader */
function spawnConfetti() {
  const host = document.querySelector(".confetti-host");
  if (!host || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cols = ["#ffce5c", "#d97757", "#10a37f", "#4285f4", "#a78bfa"];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("i");
    const sz = 4 + Math.random() * 5;
    s.style.cssText = `position:absolute;top:0;left:${Math.random() * 100}%;width:${sz}px;height:${sz * 1.6}px;
      background:${cols[i % cols.length]};border-radius:1px;opacity:0;
      animation:confetti-fall ${1.6 + Math.random() * 1.6}s ease-in ${Math.random() * 1.2}s infinite;`;
    host.appendChild(s);
  }
}

/* ---------- copiar prompt do dia ---------- */
function copiarPromptDia(dateStr, btn) {
  const jogos = S.dados.jogos
    .filter((j) => j.fase === "grupos" && kickData(j) === dateStr)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const linhas = jogos.map((j, i) => {
    const c = time(j.casa), f = time(j.fora);
    return `${i + 1}. ${c.nome} x ${f.nome} (Grupo ${j.grupo}, ${kickHora(j)})`;
  }).join("\n");
  const n = jogos.length;
  const base = S.prompt && S.prompt.trim() ? S.prompt.trim() + "\n\n" : "";
  const texto = `${base}Jogos de hoje (${rotuloData(dateStr)}):\n${linhas}\n\n` +
    `Há ${n} jogo${n > 1 ? "s" : ""}. Palpite TODOS de uma vez, cada um no formato:\n` +
    "```\nResposta do XXXX\n" + jogos.map((j) => {
      const c = time(j.casa), f = time(j.fora);
      return `${c.nome} [gols] x [gols] ${f.nome}`;
    }).join("\n") + "\n```";
  const done = () => {
    const old = btn.innerHTML;
    btn.classList.add("flash");
    btn.innerHTML = "✓ Prompt copiado!";
    setTimeout(() => { btn.classList.remove("flash"); btn.innerHTML = old; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(done).catch(done);
  } else {
    const ta = document.createElement("textarea");
    ta.value = texto; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta); done();
  }
}
