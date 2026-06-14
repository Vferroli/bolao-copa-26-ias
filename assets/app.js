/* Bolão Copa 2026 — IAs · painel
   Lê dados.json, calcula a apuração (REGRAS.md) e desenha tudo.
   Placar ao vivo: TheSportsDB (CORS liberado, chave grátis). */

const HOJE = new Date().toISOString().slice(0, 10); // AAAA-MM-DD (UTC)

const estado = {
  dados: null,
  prompt: "",
  fases: {}, // id -> config da fase
  ia: {}, // id -> config da ia
};

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

  estado.dados.fases.forEach((f) => (estado.fases[f.id] = f));
  estado.dados.ias.forEach((i) => (estado.ia[i.id] = i));

  // prompt mestre (pro botão "copiar prompt do jogo")
  try {
    estado.prompt = await (await fetch("PROMPT.md?ts=" + Date.now())).text();
  } catch (_) {
    estado.prompt = "";
  }

  render();
  carregarAoVivo();
}

/* ---------- apuração (espelha REGRAS.md) ---------- */

function faixaBase(palpite, real) {
  const pc = palpite.casa, pf = palpite.fora, rc = real.casa, rf = real.fora;
  const golsDeUm = pc === rc || pf === rf ? 5 : 0;

  if (pc === rc && pf === rf) return 25; // placar exato

  // empate de verdade: previu empate -> "só vencedor" (10); senão tenta gols de 1 time
  // (REGRAS.md: empate previsto com placar diferente vale 10, não 15)
  if (rc === rf) return pc === pf ? 10 : golsDeUm;

  // real teve vencedor; se previu empate, errou o vencedor -> só gols de 1 time
  if (pc === pf) return golsDeUm;

  // ambos com vencedor
  if (Math.sign(pc - pf) === Math.sign(rc - rf)) {
    return pc - pf === rc - rf ? 15 : 10; // vencedor + saldo : só vencedor
  }
  return golsDeUm; // errou o vencedor
}

// pontos de um jogo pra uma IA. null = jogo ainda aberto (sem placar real)
function pontosJogo(jogo, palpite) {
  const r = jogo.real;
  if (!palpite || r == null || r.casa == null || r.fora == null) return null;
  const fase = estado.fases[jogo.fase];
  let pts = faixaBase(palpite, r) * fase.mult;
  if (fase.mata && palpite.avanca && r.avancou && palpite.avanca === r.avancou) {
    pts += 8; // bônus de classificação (fora do multiplicador)
  }
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
  return estado.dados.ias
    .map((i) => ({ ...i, total: tot[i.id] }))
    .sort((a, b) => b.total - a.total);
}

/* ---------- helpers ---------- */

const fmt = (n) =>
  n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");

const placarPalpite = (p) =>
  p && p.casa != null && p.fora != null ? `${p.casa}-${p.fora}` : "—";

const apurado = (j) => j.real && j.real.casa != null && j.real.fora != null;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

/* ---------- render ---------- */

function render() {
  const app = document.getElementById("app");
  app.innerHTML =
    blocoRanking() + blocoHoje() + blocoAoVivoPlaceholder() + blocoFases();

  document.getElementById("atualizado").textContent =
    "Dados de " + (estado.dados.atualizado || "—");

  // botões copiar prompt
  app.querySelectorAll("[data-prompt-jogo]").forEach((btn) => {
    btn.addEventListener("click", () => copiarPrompt(Number(btn.dataset.promptJogo), btn));
  });
}

function blocoRanking() {
  const r = ranking();
  const medalhas = ["🥇", "🥈", "🥉", "4º"];
  const cards = r
    .map((ia, i) => {
      return `<div class="rank-card" style="--cor:${ia.cor}">
        <div class="rank-pos">${medalhas[i] || i + 1 + "º"}</div>
        <div class="rank-nome">${esc(ia.nome)}</div>
        <div class="rank-pts">${fmt(ia.total)}<span>pts</span></div>
      </div>`;
    })
    .join("");
  return `<section class="ranking">
    <h2>🏆 Ranking</h2>
    <div class="rank-grid">${cards}</div>
  </section>`;
}

function blocoHoje() {
  const hoje = estado.dados.jogos
    .filter((j) => j.data === HOJE)
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  const cabec = `<h2>📅 Jogos de hoje <span class="data-hoje">${HOJE.split("-").reverse().join("/")}</span></h2>`;

  if (!hoje.length) {
    return `<section class="hoje">${cabec}
      <div class="aviso">Nenhum jogo cadastrado pra hoje. Próximos jogos ficam nas fases abaixo.</div>
    </section>`;
  }

  const cards = hoje.map((j) => cardJogoHoje(j)).join("");
  return `<section class="hoje">${cabec}${cards}</section>`;
}

function cardJogoHoje(j) {
  const fase = estado.fases[j.fase];
  const ao = apurado(j);
  const placar = ao ? `${j.real.casa} <span>x</span> ${j.real.fora}` : `<span class="vs">×</span>`;

  const palpites = estado.dados.ias
    .map((ia) => {
      const p = j.palpites && j.palpites[ia.id];
      const pts = pontosJogo(j, p);
      return `<div class="pal" style="--cor:${ia.cor}">
        <span class="pal-ia">${esc(ia.nome)}</span>
        <span class="pal-placar">${placarPalpite(p)}</span>
        <span class="pal-pts">${pts == null ? "" : fmt(pts) + " pts"}</span>
      </div>`;
    })
    .join("");

  return `<div class="jogo-card" id="jogo-${j.id}" data-live-casa="${esc(j.casa)}" data-live-fora="${esc(j.fora)}">
    <div class="jogo-top">
      <span class="badge" style="--mc:${corFase(j.fase)}">${esc(fase.nome)} · ×${fase.mult}</span>
      <span class="hora">${j.hora ? esc(j.hora) : ""}</span>
    </div>
    <div class="confronto">
      <span class="time casa">${esc(j.casa)}</span>
      <span class="placar ${ao ? "final" : ""}">${placar}</span>
      <span class="time fora">${esc(j.fora)}</span>
    </div>
    <div class="live-linha" data-live-slot="${j.id}"></div>
    <div class="palpites">${palpites}</div>
    <div class="jogo-acoes">
      <button class="btn" data-prompt-jogo="${j.id}">📋 Copiar prompt deste jogo</button>
      <span class="status ${ao ? "ok" : "open"}">${ao ? "✓ apurado" : "○ aberto"}</span>
    </div>
  </div>`;
}

function blocoAoVivoPlaceholder() {
  return `<section class="aovivo">
    <h2>🔴 Copa ao vivo <span class="sub">TheSportsDB</span></h2>
    <div id="aovivo-conteudo" class="aviso">Buscando jogos da Copa…</div>
    <div class="aovivo-cfg">
      <label>Chave da API (opcional, p/ livescore):
        <input id="apikey" type="text" placeholder="usa a grátis '3' por padrão" />
      </label>
      <button class="btn pequeno" id="salvar-key">Salvar e atualizar</button>
    </div>
  </section>`;
}

function corFase(id) {
  const cores = {
    grupos: "#64748b", "16avos": "#0891b2", oitavas: "#7c3aed",
    quartas: "#db2777", semi: "#ea580c", terceiro: "#65a30d", final: "#eab308",
  };
  return cores[id] || "#64748b";
}

function blocoFases() {
  const html = estado.dados.fases
    .map((f) => {
      const jogos = estado.dados.jogos.filter((j) => j.fase === f.id);
      const aberto = f.id === "grupos";
      return `<details class="fase" ${aberto ? "open" : ""}>
        <summary><span class="badge" style="--mc:${corFase(f.id)}">${esc(f.nome)} · ×${f.mult}</span>
          <span class="fase-cont">${jogos.length || (f.slots ? f.slots + " a definir" : "—")}</span></summary>
        ${tabelaFase(f, jogos)}
      </details>`;
    })
    .join("");
  return `<section class="fases"><h2>📊 Todas as fases</h2>${html}</section>`;
}

function tabelaFase(f, jogos) {
  const cabIas = estado.dados.ias
    .map((i) => `<th style="--cor:${i.cor}" colspan="2">${esc(i.nome)}</th>`)
    .join("");
  const subIas = estado.dados.ias.map(() => `<th>palpite</th><th>pts</th>`).join("");

  let linhas = jogos
    .map((j) => {
      const ao = apurado(j);
      const real = ao ? `${j.real.casa}-${j.real.fora}` : "—";
      const cels = estado.dados.ias
        .map((ia) => {
          const p = j.palpites && j.palpites[ia.id];
          const pts = pontosJogo(j, p);
          return `<td>${placarPalpite(p)}</td><td class="pts">${pts == null ? "—" : fmt(pts)}</td>`;
        })
        .join("");
      return `<tr>
        <td class="conf">${esc(j.casa)} <i>x</i> ${esc(j.fora)}</td>
        <td class="real">${real}</td>
        <td class="st">${ao ? "✓" : "○"}</td>
        ${cels}
      </tr>`;
    })
    .join("");

  // slots em aberto pro mata-mata ainda não definido
  if (!jogos.length && f.slots) {
    const vazio = estado.dados.ias.map(() => `<td>—</td><td class="pts">—</td>`).join("");
    for (let k = 0; k < f.slots; k++) {
      linhas += `<tr class="adefinir">
        <td class="conf">a definir <i>x</i> a definir</td>
        <td class="real">—</td><td class="st">○</td>${vazio}
      </tr>`;
    }
  }

  if (!linhas) linhas = `<tr><td colspan="${3 + estado.dados.ias.length * 2}" class="vazio">Sem jogos.</td></tr>`;

  return `<div class="tab-wrap"><table class="tab">
    <thead>
      <tr><th rowspan="2">Jogo</th><th rowspan="2">Real</th><th rowspan="2">St</th>${cabIas}</tr>
      <tr>${subIas}</tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}

/* ---------- copiar prompt ---------- */

function copiarPrompt(idJogo, btn) {
  const j = estado.dados.jogos.find((x) => x.id === idJogo);
  if (!j) return;
  const fase = estado.fases[j.fase];
  const linhaMata = fase.mata ? " (mata-mata — diga também quem avança)" : "";
  const texto =
    (estado.prompt || "O jogo que você vai palpitar é:") +
    `\n${j.casa} x ${j.fora} — ${fase.nome}${linhaMata}\n`;
  navigator.clipboard.writeText(texto).then(
    () => flash(btn, "✓ Copiado!"),
    () => flash(btn, "Erro ao copiar")
  );
}

function flash(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.classList.add("flash");
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove("flash");
  }, 1500);
}

/* ---------- ao vivo (TheSportsDB) ---------- */

function normaliza(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

async function carregarAoVivo() {
  const cont = document.getElementById("aovivo-conteudo");
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
    const base = `https://www.thesportsdb.com/api/v1/json/${key}`;
    const [prox, pass] = await Promise.all([
      fetch(`${base}/eventsnextleague.php?id=${liga}`).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/eventspastleague.php?id=${liga}`).then((r) => r.json()).catch(() => ({})),
    ]);
    eventos = [].concat(pass.events || [], prox.events || []);
  } catch (_) {
    eventos = [];
  }

  if (!eventos.length) {
    cont.className = "aviso";
    cont.innerHTML =
      "Sem jogos da Copa retornados pela API agora. (A Copa pode não estar em andamento, ou a chave grátis está limitada.)";
    return;
  }

  // casa o placar da API com os jogos de hoje do bolão, por nome dos times
  eventos.forEach((ev) => {
    const evCasa = normaliza(ev.strHomeTeam), evFora = normaliza(ev.strAwayTeam);
    estado.dados.jogos
      .filter((j) => j.data === HOJE)
      .forEach((j) => {
        if (normaliza(j.casa) === evCasa && normaliza(j.fora) === evFora) {
          const slot = document.querySelector(`[data-live-slot="${j.id}"]`);
          if (slot && ev.intHomeScore != null) {
            slot.innerHTML = `<span class="live-tag">ao vivo/API</span> ${esc(ev.strHomeTeam)} ${ev.intHomeScore} x ${ev.intAwayScore} ${esc(ev.strAwayTeam)} <em>${esc(ev.strStatus || "")}</em>`;
          }
        }
      });
  });

  const recentes = eventos
    .filter((e) => e.intHomeScore != null)
    .slice(-6)
    .reverse()
    .map(
      (e) =>
        `<div class="ev"><span>${esc(e.strHomeTeam)}</span><b>${e.intHomeScore} - ${e.intAwayScore}</b><span>${esc(e.strAwayTeam)}</span><i>${esc((e.dateEvent || "").split("-").reverse().join("/"))}</i></div>`
    )
    .join("");
  const prox = eventos
    .filter((e) => e.intHomeScore == null)
    .slice(0, 6)
    .map(
      (e) =>
        `<div class="ev futuro"><span>${esc(e.strHomeTeam)}</span><b>×</b><span>${esc(e.strAwayTeam)}</span><i>${esc((e.dateEvent || "").split("-").reverse().join("/"))} ${esc(e.strTime ? e.strTime.slice(0, 5) : "")}</i></div>`
    )
    .join("");

  cont.className = "aovivo-grid";
  cont.innerHTML =
    (recentes ? `<div class="ev-col"><h3>Últimos resultados</h3>${recentes}</div>` : "") +
    (prox ? `<div class="ev-col"><h3>Próximos jogos</h3>${prox}</div>` : "");
}

carregar();
