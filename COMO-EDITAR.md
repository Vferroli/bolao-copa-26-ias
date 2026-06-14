# Como editar o `dados.json` na mão

O painel inteiro sai do `dados.json`. O jeito mais fácil é me mandar os dados aqui no Claude Code e eu edito. Mas se quiser fazer sozinho (pelo app/web do GitHub), o formato está abaixo.

> Todos os **72 jogos da fase de grupos já estão cadastrados**, com bandeiras, datas e horários. No dia a dia você só vai (1) preencher os palpites das IAs e (2) lançar o placar real. Os jogos de mata-mata entram quando se souber quem joga.

## Como os times funcionam

Cada time tem um **id** (ex: `brazil`, `morocco`). Os jogos usam esses ids em `casa` e `fora`. O nome em português e a bandeira ficam no dicionário `times`, no topo do arquivo — não precisa mexer nele.

```jsonc
"times": {
  "brazil":  { "nome": "Brasil",   "flag": "🇧🇷", "grupo": "C" },
  "morocco": { "nome": "Marrocos", "flag": "🇲🇦", "grupo": "C" }
}
```

## Lançar os palpites das IAs

Ache o jogo na lista `jogos` (procure pelos ids dos times) e preencha `palpites`. `casa`/`fora` são **números** (gols):

```jsonc
{
  "id": 13,
  "fase": "grupos",
  "grupo": "C",
  "casa": "brazil",
  "fora": "morocco",
  "kickoff": "2026-06-13T22:00:00Z",
  "real": { "casa": null, "fora": null, "avancou": null },
  "palpites": {
    "claude": { "casa": 2, "fora": 1, "avanca": null },
    "gpt":    { "casa": 2, "fora": 0, "avanca": null },
    "gemini": { "casa": 3, "fora": 1, "avanca": null },
    "grok":   { "casa": 1, "fora": 1, "avanca": null }
  }
}
```

Se um jogo ainda não tem palpites, deixe `"palpites": {}`.

## Lançar o placar real (apurar)

Preencha `real`. Os pontos aparecem sozinhos no painel:

```jsonc
"real": { "casa": 2, "fora": 1, "avancou": null }
```

### Apuração automática pela API

Quando um jogo **termina de verdade**, o painel busca o resultado na TheSportsDB
e preenche o `real` sozinho — o ranking se atualiza sem ninguém lançar nada.
Esses jogos aparecem marcados como **"✓ apurado · API"**.

- O lançamento **na mão sempre vence**: se você já tiver preenchido o `real` no
  `dados.json`, a API nunca sobrescreve. Use isso para corrigir um placar errado
  ou apurar antes da API atualizar.
- A auto-apuração roda toda vez que alguém abre o painel; nada é gravado no
  `dados.json` (é só em memória, no navegador).
- O `avancou` do mata-mata continua sendo manual — a API só preenche os gols.

## Mata-mata (bônus de classificação +8)

Nos jogos de mata-mata, em cada palpite diga quem a IA crava pra avançar no campo `avanca` (use o **id** do time), e quando o jogo acabar preencha `avancou` no `real` com quem passou de verdade:

```jsonc
"real": { "casa": 1, "fora": 1, "avancou": "brazil" },
"palpites": {
  "claude": { "casa": 2, "fora": 1, "avanca": "brazil" }
}
```

## Datas e horários

- `kickoff` é o horário do jogo em **UTC** (formato `AAAA-MM-DDThh:mm:00Z`). O painel converte sozinho para o horário de Brasília e usa isso para decidir o que é "hoje", "próximo" e "histórico".
- O campo `fuso` no topo (`America/Sao_Paulo`) define esse fuso.

## Lembretes

- `casa`/`fora` nos palpites e no `real` são **números** (gols).
- `casa`/`fora` no jogo, e `avanca`/`avancou`, são **ids de time** (texto, como `brazil`) — ou `null`.
- Depois de editar, confira que continua um JSON válido (o GitHub avisa se quebrar).
