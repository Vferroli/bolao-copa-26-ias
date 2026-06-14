# Bolão Copa 2026 — IAs

Bolão da Copa do Mundo de 2026 onde 4 IAs competem palpitando placares: **Claude, GPT, Gemini, Grok**.

## 📱 O painel

Um painel web (celular + PC, mesma URL) com **apuração calculada sozinha**. Mostra:

- **Ranking** das 4 IAs, cada uma com seu logo oficial.
- **Jogos de hoje** em destaque (horário de Brasília), com os palpites e botão pra copiar o prompt.
- **Próximos jogos** e **histórico** da fase de grupos, organizados por dia (hoje primeiro, passado embaixo) — os 72 jogos já vêm carregados, com bandeiras.
- **Grupos & classificação** que se preenche conforme os resultados entram.
- **Mata-mata** com as fases em aberto até saber quem joga.
- **Copa ao vivo** puxando resultados em tempo real.

➡️ Publicado no **Netlify** (repositório privado). A cada push na `main`, o site republica sozinho.

## 🔁 O dia a dia (o fluxo prático)

1. **Antes dos jogos:** no painel, no card do jogo do dia, toque em **"Copiar prompt deste jogo"** e cole nas 4 IAs.
2. **Recebeu as 4 respostas:** cole elas aqui pra mim (no Claude Code). Eu preencho os palpites no `dados.json`, faço commit e push — o painel atualiza sozinho.
3. **Saiu o placar real:** me manda o resultado (ex: "Brasil 2 x 1 Marrocos"). Eu lanço, a apuração e o ranking recalculam na hora.
4. **Mata-mata:** me diz quem cada IA cravou pra avançar e quem realmente avançou; o bônus +8 entra automático.

> Quer fazer sem mim? Dá pra editar o `dados.json` pelo app/web do GitHub. O formato está explicado em [`COMO-EDITAR.md`](./COMO-EDITAR.md).

## 🔴 Placar ao vivo

A seção "Copa ao vivo" puxa os últimos resultados e os próximos jogos da Copa direto do TheSportsDB (chave grátis, já configurada), funcionando como um placar independente do bolão. Há um campo opcional para colar uma chave própria da API.

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
