# Regras — Bolão Copa 2026 (IAs)

Jogadores: **Claude**, **GPT**, **Gemini**, **Grok**.
Cada IA dá um palpite de placar por jogo. Pontos saem da combinação **faixa base × multiplicador de fase (+ bônus fixo)**.

---

## 1. Faixa base (por jogo)

Vale **somente a melhor faixa atingida** — não acumula.

| Faixa | Condição | Base |
|-------|----------|------|
| Placar exato | acertou o placar cheio (ex: palpite 2-1, real 2-1) | **25** |
| Vencedor + saldo | acertou quem ganha **e** o saldo de gols, mas não o placar (palpite 2-1, real 3-2) | **15** |
| Só vencedor | acertou só quem ganha/empate (palpite 2-1, real 4-0) | **10** |
| Gols de 1 time | errou o resultado, mas cravou os gols de um dos times (palpite 2-1, real 2-3) | **5** |
| Errou tudo | nada acima | **0** |

Notas:
- **Empate**: previu empate e empatou = entra em "Só vencedor" (10). Se acertou o placar do empate = exato (25).
- Precedência é de cima pra baixo: pega a primeira que bater, ignora as de baixo.

---

## 2. Multiplicador por fase

Aplica sobre a **base** do jogo.

| Fase | Multiplicador |
|------|---------------|
| Fase de grupos | ×1 |
| 16-avos | ×1.5 |
| Oitavas | ×2 |
| Quartas | ×2.5 |
| Semifinal | ×3 |
| Disputa de 3º | ×2 |
| Final | ×4 |

Lógica: cada fase pesa mais que a anterior, então quem foi mal nos grupos ainda vira o bolão na reta final. Final ×4 deixa um jogo decidir muito.

---

## 3. Bônus de classificação (mata-mata)

Só em jogos de mata-mata. **+8 fixo, fora do multiplicador.**

- Cravou quem avança (independente do placar): **+8**.
- Soma depois do multiplicador, não multiplica.
- Mantém o bônus como complemento, não protagonista (se entrasse no mult, "Brasil se classifica" na final viraria 32 sozinho e distorceria).

---

## 4. Fórmula

```
pontos_jogo = (base × mult_fase) + bônus_classificação
```

`bônus` = 8 se mata-mata e cravou quem avança, senão 0. Em fase de grupos, bônus = 0 sempre.

---

## 5. Exemplos

| Situação | Conta | Total |
|----------|-------|-------|
| Quartas, placar exato | 25 × 2.5 | **62,5** |
| Quartas, só vencedor | 10 × 2.5 | **25** |
| Grupos, placar exato | 25 × 1 | **25** |
| Oitavas, vencedor+saldo, e cravou quem avança | (15 × 2) + 8 | **38** |
| Final, placar exato, cravou campeão | (25 × 4) + 8 | **108** |
| 16-avos, gols de 1 time, errou quem avança | 5 × 1.5 | **7,5** |

Repare: "só vencedor" numa quarta (25) empata com "placar exato" nos grupos (25) — proposital, pra fase de grupos não virar irrelevante.

---

## 6. Operação

- **Palpites** entram antes do jogo e ficam travados (persistem após apuração).
- **Placar real** entra depois do jogo.
- **Pontos** são calculados na apuração e gravados no `BOLAO.md`.
- Status por jogo: `aberto` (sem placar real) → `apurado` (placar lançado, pontos calculados).
