# Planilha online (Google Sheets) — celular + PC

Objetivo: acompanhar e digitar placar de qualquer lugar; pontos e ranking calculam sozinhos.

## Passo a passo (uma vez só)

1. Abra **sheets.google.com** → **Em branco**.
2. **Arquivo → Importar → Fazer upload** → mande o `planilha-bolao.csv`.
   - Em "Local de importação" escolha **Substituir planilha**. Separador: detectar automaticamente.
3. **Arquivo → Configurações** → Local/Locale = **Estados Unidos** → Salvar.
   _(Deixa a fórmula usar vírgula e nomes em inglês — evita dor de cabeça.)_
4. Clique na célula **J2** (coluna `Pts`) e cole a fórmula:

   ```
   =IF(OR($G2="",$H2=""),"",(IF(AND(E2=G2,F2=H2),25,IF((E2-F2)=(G2-H2),15,IF(SIGN(E2-F2)=SIGN(G2-H2),10,IF(OR(E2=G2,F2=H2),5,0))))*C2)+IF(I2=TRUE,8,0))
   ```

5. Selecione **J2**, copie (Ctrl+C), pinte de **J3 até a última linha** e cole. Pronto — cada linha calcula sozinha.

## Ranking (numa aba ou ao lado)

Em qualquer célula livre, uma por IA:

```
=SUMIF($D:$D,"Claude",$J:$J)
=SUMIF($D:$D,"GPT",$J:$J)
=SUMIF($D:$D,"Gemini",$J:$J)
=SUMIF($D:$D,"Grok",$J:$J)
```

## Uso no dia a dia

- **Placar saiu** (veja no FlashScore / Google / SofaScore): preencha **RealCasa** e **RealFora** nas 4 linhas daquele jogo. Pts e ranking atualizam na hora.
- **Mata-mata**: marque `CravouAvanco` = **TRUE** na linha da IA que cravou quem avançou (+8 entra automático). Nos grupos deixe FALSE.
- **Novo jogo**: adicione 4 linhas (uma por IA) com os palpites e o `Mult` da fase (grupos 1 · 16-avos 1.5 · oitavas 2 · quartas 2.5 · semi 3 · 3º lugar 2 · final 4). Arraste a fórmula de Pts pra elas.

## Compartilhar / abrir no celular

- Canto superior direito → **Compartilhar** → gere link.
- Instale o app **Google Sheets** no celular, logado no mesmo Gmail — aparece sozinho.

## Sobre o BOLAO.md

A planilha vira o painel ao vivo. O `BOLAO.md` no repo continua como **arquivo/backup**: quando quiser, me cola os placares e eu mantenho ele e a memória sincronizados.
