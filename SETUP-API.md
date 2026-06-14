# Atualização automática de resultados

Os placares são preenchidos sozinhos por um job do **GitHub Actions** que roda a cada
5 minutos, busca os jogos em APIs gratuitas e atualiza o `dados.json`. O site recarrega
o `dados.json` a cada 45s, então tabelas, pontos e o "ao vivo" mudam **sem reload manual**.

```
API de futebol  →  scripts/update-resultados.mjs (cron 5min)  →  dados.json  →  site
```

## O que é automático e o que é manual

| Campo | Quem preenche |
|-------|---------------|
| `jogos[].real.casa/.fora` (placar final) | **Automático** (API) |
| `jogos[].real.avancou` (mata-mata) | **Automático** (vencedor da API) |
| `live[]` (placar ao vivo + minuto) | **Automático** (API) |
| `jogos[].palpites` (palpites das IAs) | **Manual** — é o ponto do bolão |

## Provedores (free)

1. **Primário — football-data.org**: free dá ~10 req/min, aguenta o polling o dia todo.
   - Cadastro: https://www.football-data.org/client/register
   - Pega o token (`X-Auth-Token`).
2. **Fallback — API-Football (api-sports.io)**: free 100 req/dia. Entra só se o primário falhar.
   - Cadastro: https://www.api-sports.io/ (ou via RapidAPI).

> Basta **uma** chave para funcionar. Com as duas, ganha redundância.

## Configurar (1 vez)

No GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Nome do secret | Valor |
|----------------|-------|
| `FOOTBALL_DATA_KEY` | token do football-data.org |
| `API_FOOTBALL_KEY` | chave do API-Football (opcional) |

Depois, **Actions → Atualizar resultados → Run workflow** para testar na hora.

## Rodar local (teste)

```bash
FOOTBALL_DATA_KEY=xxxx node scripts/update-resultados.mjs
```

O script só consulta jogos sem placar com início entre -48h e +30min (economiza cota).
Se um time não casar com a API, ele loga `? time não mapeado: ...` — adicione o apelido
em `ALIAS` dentro de `scripts/update-resultados.mjs`.

## Limites (do plano free)

- **Atraso ~5 min**: é o cron mínimo do GitHub Actions. Minuto-a-minuto exigiria um
  servidor sempre ligado (não-free).
- Cobertura da Copa 2026 depende do provedor — confira que `competition WC` (football-data)
  e `league=1, season=2026` (API-Football) retornam os jogos antes do torneio.
