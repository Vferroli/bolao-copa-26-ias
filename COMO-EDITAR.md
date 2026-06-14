# Como editar o `dados.json` na mão

O painel inteiro sai do `dados.json`. O jeito mais fácil é me mandar os dados aqui no Claude Code e eu edito. Mas se quiser fazer sozinho (pelo app/web do GitHub, no celular ou PC), é só seguir o formato abaixo.

> Dica: depois de editar, confira que continua um JSON válido (sem vírgula sobrando). O GitHub avisa se quebrar.

## Estrutura

```jsonc
{
  "atualizado": "2026-06-14",        // data que você mexeu (aparece no rodapé do painel)
  "ao_vivo": { "league_id": 4429 },  // Copa do Mundo no TheSportsDB; não precisa mexer
  "ias": [ ... ],                     // as 4 IAs e suas cores; já preenchido
  "fases": [ ... ],                   // multiplicadores e quantos jogos cada fase tem; já preenchido
  "jogos": [ ... ]                    // <- aqui é onde você mexe no dia a dia
}
```

## Adicionar um jogo

Copie um bloco e ajuste. `fase` tem que ser um dos ids: `grupos`, `16avos`, `oitavas`, `quartas`, `semi`, `terceiro`, `final`.

```jsonc
{
  "id": 4,                            // qualquer número único
  "fase": "grupos",
  "casa": "Argentina",
  "fora": "Nigéria",
  "data": "2026-06-15",               // AAAA-MM-DD; jogos com a data de hoje aparecem em "Jogos de hoje"
  "hora": "16:00",
  "real": { "casa": null, "fora": null, "avancou": null },  // null = ainda não jogou
  "palpites": {
    "claude": { "casa": 2, "fora": 0, "avanca": null },
    "gpt":    { "casa": 1, "fora": 0, "avanca": null },
    "gemini": { "casa": 2, "fora": 1, "avanca": null },
    "grok":   { "casa": 3, "fora": 1, "avanca": null }
  }
}
```

## Lançar o placar real (apurar)

Preencha `real`. Os pontos aparecem sozinhos:

```jsonc
"real": { "casa": 2, "fora": 1, "avancou": null }
```

## Mata-mata (bônus de classificação +8)

Nos jogos de mata-mata, em cada palpite diga quem a IA crava pra avançar no campo `avanca` (nome igual ao do time), e quando o jogo acabar preencha `avancou` no `real` com quem passou de verdade:

```jsonc
"real": { "casa": 1, "fora": 1, "avancou": "Brasil" },
"palpites": {
  "claude": { "casa": 2, "fora": 1, "avanca": "Brasil" }   // cravou quem passou -> +8
}
```

## Lembretes

- `casa`/`fora` nos palpites e no real são **números** (gols), não texto.
- `avanca` e `avancou` são **texto** com o nome do time (ou `null`).
- As fases de mata-mata já aparecem no painel como "a definir" até você cadastrar os jogos.
- O multiplicador de cada fase está em `fases` e não precisa ser repetido no jogo.
