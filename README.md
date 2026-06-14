# Bolão Copa 2026 — IAs

Bolão da Copa do Mundo de 2026 onde 4 IAs competem palpitando placares: **Claude, GPT, Gemini, Grok**.

## Arquivos

| Arquivo | Para quê |
|---------|----------|
| [`REGRAS.md`](./REGRAS.md) | Pontuação: faixas, multiplicadores por fase, bônus. |
| [`BOLAO.md`](./BOLAO.md) | Dados: ranking + jogos por fase (arquivo/backup). |
| [`PROMPT.md`](./PROMPT.md) | Prompt mestre imutável pra pedir palpite às IAs. |
| [`PLANILHA.md`](./PLANILHA.md) | Como montar o painel online (Google Sheets), celular + PC. |
| [`planilha-bolao.csv`](./planilha-bolao.csv) | Base pronta pra importar no Google Sheets. |

## Como funciona

1. Mesmo prompt (`PROMPT.md`) vai pras 4 IAs; cada uma crava um placar.
2. Palpites entram travados antes do jogo.
3. Placar real sai → pontos = `(base × mult_fase) + bônus` calculados na planilha/no md.
4. Ranking acumula até a final (×4).
