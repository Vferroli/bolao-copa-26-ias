# Bolão Copa 2026 — IAs

Bolão da Copa do Mundo de 2026 onde 4 IAs competem palpitando placares: **Claude, GPT, Gemini, Grok**.

## 📱 O painel

Um painel web (celular + PC, mesma URL) que mostra ranking, jogos do dia, todas as fases e placar ao vivo — com a **apuração calculada sozinha**.

➡️ **Quando o GitHub Pages estiver ligado:** `https://vferroli.github.io/bolao-copa-26-ias/`

### Ligar o GitHub Pages (uma vez só)

1. No GitHub, abra o repositório → **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Branch: `main` · pasta `/ (root)` → **Save**.
4. Espere ~1 min e abra a URL acima. Salve nos favoritos do celular e do PC.

> Enquanto desenvolvo numa branch, dá pra apontar o Pages pra ela; o normal é deixar em `main`.

## 🔁 O dia a dia (o fluxo prático)

1. **Antes dos jogos:** no painel, no card do jogo do dia, toque em **"Copiar prompt deste jogo"** e cole nas 4 IAs.
2. **Recebeu as 4 respostas:** cole elas aqui pra mim (no Claude Code). Eu preencho os palpites no `dados.json`, faço commit e push — o painel atualiza sozinho.
3. **Saiu o placar real:** me manda o resultado (ex: "Brasil 2 x 1 Marrocos"). Eu lanço, a apuração e o ranking recalculam na hora.
4. **Mata-mata:** me diz quem cada IA cravou pra avançar e quem realmente avançou; o bônus +8 entra automático.

> Quer fazer sem mim? Dá pra editar o `dados.json` pelo app/web do GitHub. O formato está explicado em [`COMO-EDITAR.md`](./COMO-EDITAR.md).

## 🔴 Placar ao vivo

A seção "Copa ao vivo" puxa os jogos da Copa do TheSportsDB (chave grátis, já configurada). Quando um jogo de hoje do bolão tem os mesmos nomes de time da API, o placar parcial aparece dentro do card. Para o endpoint de *livescore* minuto a minuto há um campo opcional pra colar uma chave própria.

## 📂 Arquivos

| Arquivo | Para quê |
|---------|----------|
| `index.html` + `assets/` | O painel web em si. |
| [`dados.json`](./dados.json) | **A fonte única** de jogos, palpites e placares. É o que eu edito. |
| [`REGRAS.md`](./REGRAS.md) | Pontuação: faixas, multiplicadores por fase, bônus. |
| [`PROMPT.md`](./PROMPT.md) | Prompt mestre pra pedir palpite às IAs. |
| [`COMO-EDITAR.md`](./COMO-EDITAR.md) | Como editar o `dados.json` na mão, se quiser. |
| [`BOLAO.md`](./BOLAO.md) | Tabela em markdown (backup legível). |
| [`PLANILHA.md`](./PLANILHA.md) + `planilha-bolao.csv` | Alternativa em Google Sheets (rota antiga). |

## Como funciona a pontuação

`pontos = (faixa base × multiplicador da fase) + bônus de classificação`. Detalhes em [`REGRAS.md`](./REGRAS.md).
