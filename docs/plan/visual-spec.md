# DELTA STRIKE — Especificação Visual (pixel a pixel)

> Documento normativo. O implementador NÃO deve tomar nenhuma decisão visual:
> tudo o que se desenha na tela está definido aqui — cores, coordenadas,
> matrizes de sprites, frames e sequências. Referência de design: aparência do
> River Raid (Atari 2600, NTSC). Todos os assets abaixo são desenhos ORIGINAIS
> criados para este projeto, com a mesma leitura/silhueta do clássico. Nenhum
> dado foi extraído de ROM.

---

## 0. Convenções deste documento

- Resolução lógica do jogo: **160×210 px**, pixels quadrados, origem `(0,0)` no
  canto superior esquerdo. `x` cresce para a direita, `y` cresce para baixo.
- Intervalos de coordenadas são **inclusivos**: `y=162..209` são 48 linhas.
- Sprites são dados como matrizes de caracteres em blocos de código:
  - `.` = pixel transparente (não desenhar);
  - letras = cores, conforme a legenda da Seção 3.2 (ex.: `Y` = amarelo).
- Âncora de todo sprite = **canto superior esquerdo** da matriz.
- "Frame" de animação = troca a cada N *frames de jogo* a 60 fps (N indicado
  caso a caso).
- A fonte mini (3×5) usa `X` como tinta genérica; a cor é definida no ponto de
  uso.

---

## 1. Princípios de renderização (obrigatórios)

1. **Nada de suavização.** `ctx.imageSmoothingEnabled = false` em todos os
   contextos; CSS `image-rendering: pixelated` no canvas visível.
2. **Cores chapadas.** Proibido: gradientes, sombras, blur, anti-aliasing,
   transparência parcial (alpha ≠ 1) e qualquer filtro. Todo pixel é 100%
   opaco e de uma das cores da Paleta Canônica (Seção 13).
3. **Coordenadas inteiras.** Todas as posições/desenhos em inteiros; o scroll
   do rio avança em incrementos inteiros de pixel (1–4 px/frame conforme a
   velocidade). Nunca desenhar em posição fracionária.
4. **Sombreado por linha (estilo TIA).** Sprites multicoloridos variam a cor
   por LINHA horizontal (como o hardware do 2600), nunca com dithering.
5. **Sem contornos.** Cor chapada encontra cor chapada (rio→margem, etc.) sem
   linha de contorno.
6. O jogo inteiro é desenhado num **canvas offscreen de 160×210** e depois
   copiado (escalado) para o canvas visível — ver Seção 2.

---

## 2. Apresentação na página (fora da resolução lógica)

- Fundo da página (`html, body`): **preto `#000000`**, sem margens.
- O canvas visível fica **centralizado horizontal e verticalmente** na viewport
  (flexbox), com **letterbox preto** nas sobras.
- **Escala**: maior inteiro `k ≥ 1` tal que `160·k ≤ viewportWidth` e
  `210·k ≤ viewportHeight`. Se nem `k=1` couber (viewport minúscula), usar
  escala fracionária `min(vw/160, vh/210)` como exceção única.
- Orientação alvo no celular: **portrait** (o manifest fixa
  `"orientation": "portrait"`).
- **Dica de teclado (somente desktop)**: uma única linha de texto HTML abaixo
  do canvas, fora dele:
  - texto exato: `← → dirigir · ↑ ↓ velocidade · ESPAÇO atirar · ENTER start · P pausa · M som`
  - fonte: `12px monospace`, cor `#666666`, `text-align: center`;
  - ocultar quando `('ontouchstart' in window)` for verdadeiro.
- Em touch **não há** botões visuais permanentes durante o jogo (zonas de toque
  são invisíveis). O único controle desenhado é o botão START na tela de
  título (Seção 11.1).

---

## 3. Layout da tela lógica (160×210)

```
y=0   ┌──────────────────────────────┐
      │        PLAYFIELD             │  y = 0..161  (162 linhas)
      │  rio, margens, entidades     │
y=161 ├──────────────────────────────┤
y=162 │ linha preta (2 px)           │  y = 162..163
y=164 │        HUD (cinza)           │  y = 164..209
y=209 └──────────────────────────────┘
x=0                                x=159
```

### 3.1 Regiões fixas

| Região                    | Coordenadas               | Cor de fundo        |
|---------------------------|---------------------------|---------------------|
| Playfield                 | x=0..159, y=0..161        | rio/margens (Seç.5) |
| Separador                 | x=0..159, y=162..163      | `#000000`           |
| HUD                       | x=0..159, y=164..209      | `#ABABAB`           |

### 3.2 Legenda de cores dos sprites (letra → cor)

Esta legenda vale para TODAS as matrizes do documento. Valores hex na Seção 13.

| Letra | Nome                       | Hex       |
|-------|----------------------------|-----------|
| `.`   | transparente               | —         |
| `K`   | preto                      | `#000000` |
| `W`   | branco                     | `#F2F2F2` |
| `H`   | cinza HUD                  | `#ABABAB` |
| `I`   | cinza claro (estrada)      | `#CDCDCD` |
| `J`   | cinza escuro (estrada)     | `#797979` |
| `Y`   | amarelo principal          | `#FFF456` |
| `P`   | amarelo pálido (flash)     | `#FFFF98` |
| `G`   | ouro (rotor/explosão)      | `#FFC545` |
| `M`   | magenta (depósito FUEL)    | `#EA51EB` |
| `R`   | vermelho                   | `#B21D17` |
| `C`   | laranja-tijolo (ponte)     | `#C85F24` |
| `D`   | marrom escuro (ponte)      | `#833008` |
| `S`   | marrom sombra (ponte)      | `#451904` |
| `T`   | marrom tronco (árvore)     | `#391701` |
| `N`   | azul-marinho (helicóptero) | `#0C048B` |
| `E`   | verde-heli (helicóptero)   | `#0A4108` |
| `A`   | ciano claro (jato inimigo) | `#73CFEF` |
| `B`   | azul-céu (jato inimigo)    | `#73B6EF` |
| `Z`   | azul-violeta (jato inimigo)| `#7382F7` |
| `O`   | azul do rio                | `#584FDA` |
| `Q`   | verde-oliva (margem clara) | `#649228` |
| `X`   | verde-floresta (margem esc.)| `#0C4A1C` |
| `V`   | verde claro (navio/faixa)  | `#61D070` |
| `L`   | verde-lima (árvore)        | `#B2D241` |

---

## 4. Paleta — origem e regras

- Os valores hex foram fixados a partir da leitura da paleta NTSC do Atari
  2600 tal como renderizada pelos emuladores clássicos (família Stella/z26) em
  capturas do jogo de referência. **O valor normativo é o hex** — a coluna de
  código TIA na Seção 13 é apenas informativa/aproximada.
- É proibido usar qualquer cor fora da Paleta Canônica.
- Não existem variações de brilho dinâmicas (sem "day/night", sem fade).
  Transições de tela são **corte seco** (estilo 2600).

---

## 5. Playfield: rio, margens, estrada e ponte

### 5.1 Rio e margens

- **Rio**: preencher todo o playfield com azul `O #584FDA`; as margens são
  desenhadas por cima.
- **Margens** (esquerda e direita) e **ilhas**: retângulos chapados de verde.
  - Cor da margem alterna **por seção** (uma seção = trecho entre duas pontes):
    seções ímpares (1ª, 3ª, ...) = verde-oliva `Q #649228`; seções pares =
    verde-floresta `X #0C4A1C`. A troca de cor acontece exatamente na linha da
    ponte (a estrada/ponte é a fronteira).
  - Árvores e casas usam as mesmas cores em ambas as seções.
- **Quantização "playfield 2600"** (obrigatória):
  - toda borda vertical de margem/ilha fica em `x` múltiplo de **4**;
  - a largura da margem só muda em degraus: segmentos horizontais de altura
    mínima **4 px** (altura típica 8 px), variação máxima de **8 px** de
    largura por degrau;
  - resultado: contorno "escadinha" retangular, jamais diagonal ou curva.
- A geometria do rio (larguras, bifurcações em torno de ilhas, afunilamentos)
  é definida na spec de gameplay; este documento fixa apenas a regra de
  desenho acima.
- O rio NÃO tem textura, ondas nem brilhos: azul 100% chapado.

### 5.2 Estrada (nas margens, na altura de cada ponte)

Verificado no original: a estrada é **horizontal**, cruzando as duas margens
exatamente na faixa vertical da ponte (não existe estrada vertical). Faixa de
**16 linhas** de altura, alinhada com a ponte (mesmo `y`):

| Linhas da faixa (relativas, 0..15) | Cor |
|------------------------------------|-----|
| 0                                  | `J #797979` |
| 1..6                               | `I #CDCDCD` |
| 7                                  | `Y #FFF456` (linha central da pista) |
| 8..14                              | `I #CDCDCD` |
| 15                                 | `J #797979` |

- Desenhar a estrada sobre TODA a largura da margem esquerda e direita
  (x=0 até a borda do rio; da outra borda do rio até x=159).
- A estrada rola junto com o playfield (faz parte do cenário).

### 5.3 Ponte (sobre o canal, entre as duas metades da estrada)

- No trecho da ponte o canal tem largura fixa de **64 px centrados**
  (x=48..111) — a ponte é um bloco de **64×16 px** que completa a estrada.
- Linhas 1..14 são preenchimentos de cor sólida de borda a borda (64 px);
  linhas 0 e 15 são o padrão de "vigas/pilares" com água aparecendo:

Linha 0 e linha 15 (literal, 64 caracteres — `S` = marrom sombra, `.` = rio):

```
SSSS....SSSS....SSSS....SSSS....SSSS....SSSS....SSSS....SSSS....
```

| Linhas 1..14 | Cor |
|--------------|-----|
| 1            | `C #C85F24` |
| 2            | `D #833008` |
| 3            | `C` |
| 4            | `D` |
| 5            | `C` |
| 6            | `D` |
| 7            | `G #FFC545` (a linha amarela da estrada continua sobre a ponte, em tom ouro) |
| 8            | `D` |
| 9            | `C` |
| 10           | `D` |
| 11           | `C` |
| 12           | `D` |
| 13           | `C` |
| 14           | `D` |

- **Ponte explodindo** (ao ser atingida): por **32 frames**, alternar a cada
  4 frames entre a matriz normal e uma versão com troca de cores
  `C→Y`, `D→G`, `G→P` (flicker de fogo). Junto, desenhar 4 explosões
  genéricas 16×16 (Seção 7.7) lado a lado sobre a ponte, em
  x = 48, 64, 80, 96 (y = topo da ponte), avançando os 3 frames normalmente.
- **Ponte destruída**: após a sequência, a ponte é removida por completo
  (o rio aparece); desenhar o sprite de destroços (Seção 7.8) por 60 frames
  nas duas cabeceiras (x=44 e x=108, y = linha 6 da faixa).

### 5.4 Decoração das margens (casas e árvores)

Entram no jogo (fiel ao original, que decora as margens com casinhas e
árvores). Regras:

- Aparecem SOMENTE sobre margem verde; nunca sobre a estrada, nunca sobre o
  rio, nunca a menos de 8 px da borda da água.
- Padrões permitidos (escolhidos pela geração de terreno, spec de gameplay):
  1. **Casa** sozinha;
  2. **Árvore** sozinha;
  3. **Casa + árvore**: árvore com âncora deslocada `(+10, +10)` em relação à
     âncora da casa (árvore abaixo e à direita — composição típica do
     original).
- Densidade visual alvo: 1 decoração a cada 40–80 px de rolagem, alternando
  lado esquerdo/direito.

**Casa — 20×9 px** (telhado preto escalonado, corpo branco, 3 janelas pretas):

```
......KKKKKKKK......
....KKKKKKKKKKKK....
..KKKKKKKKKKKKKKKK..
.WWWWWWWWWWWWWWWWWW.
.WWWWWWWWWWWWWWWWWW.
.WW.KKK..KKK..KKK.WW
.WW.KKK..KKK..KKK.WW
.WWWWWWWWWWWWWWWWWW.
.WWWWWWWWWWWWWWWWWW.
```

**Árvore — 12×9 px** (copa verde-lima em cruz, tronco marrom):

```
.....LL.....
....LLLL....
..LLLLLLLL..
.LLLLLLLLLL.
LLLLLLLLLLLL
..LLLLLLLL..
....LLLL....
.....TT.....
.....TT.....
```

---

## 6. Entidades — tabela geral

| Entidade            | Tamanho  | Frames | Espelhamento |
|---------------------|----------|--------|--------------|
| Player (jato delta) | 14×12    | 1 + 2 de explosão | não |
| Míssil do player    | 2×6      | 1      | não |
| Helicóptero         | 16×10    | 2 (rotor) | sim (horizontal) |
| Navio               | 24×8     | 1      | sim (horizontal) |
| Jato inimigo        | 16×8     | 1      | sim (horizontal) |
| Depósito FUEL       | 12×24    | 1      | não |
| Ponte               | 64×16    | 1 + flicker | não |
| Explosão genérica   | 16×16    | 3      | não |
| Destroços           | 8×6      | 2      | não |
| Mini-avião (vidas)  | 8×6      | 1      | não |

Regra de espelhamento: sprites com direção (helicóptero, navio, jato inimigo)
são desenhados espelhados horizontalmente quando se movem para a esquerda. As
matrizes abaixo mostram a versão "movendo para a DIREITA".

---

## 7. Sprites (matrizes normativas)

### 7.1 Player — jato delta, 14×12, cor única `Y`

**Decisão de fidelidade:** no original o avião NÃO inclina ao manobrar — o
sprite é um só. Delta Strike segue igual: **um único estado**, sem variantes
"inclinado". (Os "3 estados" foram avaliados e descartados por fidelidade.)

```
......YY......
......YY......
.....YYYY.....
.....YYYY.....
....YYYYYY....
.YYYYYYYYYYYY.
YYYYYYYYYYYYYY
YYY..YYYY..YYY
.....YYYY.....
..Y..YYYY..Y..
.YYYYYYYYYYYY.
.YYY..YY..YYY.
```

- Posição inicial/respawn: âncora em `x=73, y=140` (centro do sprite em
  x=80).
- Leitura: nariz fino, asas delta a meia-altura, entalhe, cauda dupla.

**Player explodindo — frame A (bola de fogo), 14×12:**

```
..............
.....GGGG.....
...GGYYYYGG...
..GYYPPPPYYG..
.GYPPPPPPPPYG.
.GYPPPPPPPPYG.
.GYPPPPPPPPYG.
.GYPPPPPPPPYG.
..GYYPPPPYYG..
...GGYYYYGG...
.....GGGG.....
..............
```

**Player explodindo — frame B (estilhaços), 14×12:**

```
.W...G....R...
....R....W....
.G.....G....W.
.....W......R.
R...G...W.....
.....R....G...
..W......R....
G....W.......G
....R...G.....
.W.......W..R.
...G...R......
W.....W....G..
```

Sequência de morte: ver Seção 10.2.

### 7.2 Míssil do player — 2×6, cor única `Y`

```
YY
YY
YY
YY
YY
YY
```

- Nasce com âncora em `(playerX + 6, playerY - 6)` e sobe.
- Só existe **um míssil na tela por vez** (cadência fiel; detalhado na spec de
  gameplay).

### 7.3 Helicóptero — 16×10, 2 frames (rotor alterna)

Cores por linha (estilo TIA): rotor ouro `G`, cabine verde-heli `E`,
fuselagem/cauda azul-marinho `N`, apoios `E`. Cauda à esquerda = voando para a
direita.

**Frame 1:**

```
..GGGGGGG.......
........G.......
.........GGGGGGG
.......EEEE.....
GG....EEEEEE....
NNNNNNNNNNNNNN..
.NNNNNNNNNNNNN..
......E....E....
.....EEEEEEEEE..
................
```

**Frame 2:**

```
.........GGGGGGG
........G.......
..GGGGGGG.......
GG.....EEEE.....
......EEEEEE....
NNNNNNNNNNNNNN..
.NNNNNNNNNNNNN..
......E....E....
.....EEEEEEEEE..
................
```

- Troca de frame a cada **8 frames** de jogo (~7,5 Hz).
- Espelhar horizontalmente quando voar para a esquerda (cauda sempre atrás).

### 7.4 Navio — 24×8

Superestrutura preta `K` com chaminé, casco vermelho `R`, linha d'água
verde-clara `V`. Proa à direita = movendo para a direita.

```
..........KK............
..........KK............
.......KKKKKKKK.........
....KKKKKKKKKKKKKK......
.KKKKKKKKKKKKKKKKKKKK...
RRRRRRRRRRRRRRRRRRRRRRRR
.RRRRRRRRRRRRRRRRRRRRRR.
..VVVVVVVVVVVVVVVVVVVV..
```

### 7.5 Jato inimigo — 16×8

Dardo com asas em seta, 3 tons de azul por linha (`A` claro em cima, `B` no
meio, `Z` embaixo). Nariz à direita = voando para a direita; espelhar para a
esquerda.

```
................
.........A......
..........AA....
AAAAAAAAAAAAAA..
BBBBBBBBBBBBBBBB
ZZZZZZZZZZZZZZ..
..........ZZ....
.........Z......
```

### 7.6 Depósito de combustível — 12×24, letras F-U-E-L vazadas

Bandas horizontais alternadas magenta `M` / branco `W`, topo e base
arredondados. As letras são **vazadas** (pixels transparentes — o rio aparece
através delas, exatamente como a leitura do original). Depósitos só existem
sobre a água, então o vazado sempre mostra azul.

```
..MMMMMMMM..
.MMMMMMMMMM.
MMM......MMM
MMM..MMMMMMM
MMM.....MMMM
MMM..MMMMMMM
MMM..MMMMMMM
WWW..WW..WWW
WWW..WW..WWW
WWW..WW..WWW
WWW..WW..WWW
WWW......WWW
MMM......MMM
MMM..MMMMMMM
MMM....MMMMM
MMM..MMMMMMM
MMM......MMM
WWW..WWWWWWW
WWW..WWWWWWW
WWW..WWWWWWW
WWW..WWWWWWW
WWW......WWW
.MMMMMMMMMM.
..MMMMMMMM..
```

Leitura de cima para baixo: banda M com `F`, banda W com `U`, banda M com `E`,
banda W com `L`.

### 7.7 Explosão genérica — 16×16, 3 frames

Cada frame dura **8 frames de jogo** (total 24). Depois entram os destroços
(7.8).

**Frame 1 — flash:**

```
................
................
......PPPP......
....PPYYYYPP....
....PYYYYYYP....
...PYYYPPYYYP...
...PYYPPPPYYP...
...PYYPPPPYYP...
...PYYYPPYYYP...
....PYYYYYYP....
....PPYYYYPP....
......PPPP......
................
................
................
................
```

**Frame 2 — bola de fogo:**

```
.....CCCCCC.....
...CCGGGGGGCC...
..CGGYYYYYYGGC..
.CGYYYYYYYYYYGC.
.CGYYPPPPPPYYGC.
CGYYPPPPPPPPYYGC
CGYPPPPPPPPPPYGC
CGYPPPPPPPPPPYGC
CGYPPPPPPPPPPYGC
CGYPPPPPPPPPPYGC
CGYYPPPPPPPPYYGC
.CGYYPPPPPPYYGC.
.CGYYYYYYYYYYGC.
..CGGYYYYYYGGC..
...CCGGGGGGCC...
.....CCCCCC.....
```

**Frame 3 — dispersão:**

```
..W.....G....R..
......R.......W.
.R..........G...
....G...W.......
W.........R....G
...R....G.......
.........W...R..
..G..W..........
..........G....W
.W....R.........
............R...
...W....G.......
.........W....G.
..R.....W.......
......G....R....
W.............W.
```

Centragem por alvo (a explosão é desenhada centrada no centro do alvo):

| Alvo         | Explosões e âncoras (relativas à âncora do alvo) |
|--------------|---------------------------------------------------|
| Helicóptero  | 1 explosão em `(0, -3)` |
| Jato inimigo | 1 explosão em `(0, -4)` |
| Navio        | 2 explosões, em `(0, -6)` e `(8, -6)` |
| Depósito     | 2 explosões, em `(-2, 0)` e `(-2, 8)` |
| Ponte        | 4 explosões (ver 5.3) |
| Player       | usa os frames próprios da Seção 7.1 |

### 7.8 Destroços — 8×6, 2 frames (alternam a cada 8 frames, duram 60 frames)

Ficam boiando/parados no ponto da morte da entidade e rolam com o cenário
(fiel aos "restos" que o original deixa na água).

**Frame 1:**

```
W..G..R.
..R...W.
G...W...
.W....G.
...R..W.
W...G...
```

**Frame 2:**

```
.G..W..R
R....G..
..W...R.
G...W...
.R....G.
..W..R..
```

### 7.9 Mini-avião (ícone de vidas) — 8×6, cor única `Y`

```
...YY...
...YY...
.YYYYYY.
YYYYYYYY
...YY...
..YYYY..
```

---

## 8. Fontes

### 8.1 Dígitos do placar — 8×10, estilo "gordo" Atari, cor `Y`

Traço de 2 px, cantos arredondados por degrau. Avanço horizontal: **10 px**
(8 do glifo + 2 de espaço).

**0**
```
.YYYYYY.
YYYYYYYY
YY....YY
YY....YY
YY....YY
YY....YY
YY....YY
YY....YY
YYYYYYYY
.YYYYYY.
```

**1**
```
...YY...
..YYY...
.YYYY...
...YY...
...YY...
...YY...
...YY...
...YY...
.YYYYYY.
.YYYYYY.
```

**2**
```
.YYYYYY.
YYYYYYYY
YY....YY
......YY
....YYYY
..YYYY..
.YYY....
YY......
YYYYYYYY
YYYYYYYY
```

**3**
```
YYYYYYYY
YYYYYYYY
......YY
....YYY.
....YYY.
......YY
......YY
YY....YY
YYYYYYYY
.YYYYYY.
```

**4**
```
....YYY.
...YYYY.
..YYYYY.
.YY.YYY.
YY..YYY.
YYYYYYYY
YYYYYYYY
....YYY.
....YYY.
....YYY.
```

**5**
```
YYYYYYYY
YYYYYYYY
YY......
YYYYYYY.
YYYYYYYY
......YY
......YY
YY....YY
YYYYYYYY
.YYYYYY.
```

**6**
```
..YYYYY.
.YYYYYYY
YY......
YY......
YYYYYYY.
YYYYYYYY
YY....YY
YY....YY
YYYYYYYY
.YYYYYY.
```

**7**
```
YYYYYYYY
YYYYYYYY
......YY
.....YY.
....YY..
...YY...
..YY....
..YY....
..YY....
..YY....
```

**8**
```
.YYYYYY.
YYYYYYYY
YY....YY
YY....YY
.YYYYYY.
.YYYYYY.
YY....YY
YY....YY
YYYYYYYY
.YYYYYY.
```

**9**
```
.YYYYYY.
YYYYYYYY
YY....YY
YY....YY
YYYYYYYY
.YYYYYYY
......YY
......YY
YYYYYYY.
.YYYYY..
```

**! (exclamação — usada no placar em 1.000.000)**
```
...YY...
...YY...
...YY...
...YY...
...YY...
...YY...
........
........
...YY...
...YY...
```

### 8.2 Mini-fonte 3×5 (A–Z e 0–9)

Uso: título (escalada), textos de UI, letras `E`/`F` do medidor, hi-score.
Formato: 5 linhas de 3 caracteres, separadas por `/`. `X` = tinta,
`.` = transparente. Avanço horizontal: **4 px** (3 + 1) na escala 1.

| Ch | Linhas                     | Ch | Linhas                     |
|----|----------------------------|----|----------------------------|
| A  | `.X. / X.X / XXX / X.X / X.X` | N  | `XX. / X.X / X.X / X.X / X.X` |
| B  | `XX. / X.X / XX. / X.X / XX.` | O  | `XXX / X.X / X.X / X.X / XXX` |
| C  | `.XX / X.. / X.. / X.. / .XX` | P  | `XXX / X.X / XXX / X.. / X..` |
| D  | `XX. / X.X / X.X / X.X / XX.` | Q  | `XXX / X.X / X.X / XXX / ..X` |
| E  | `XXX / X.. / XX. / X.. / XXX` | R  | `XXX / X.X / XX. / X.X / X.X` |
| F  | `XXX / X.. / XX. / X.. / X..` | S  | `.XX / X.. / .X. / ..X / XX.` |
| G  | `.XX / X.. / X.X / X.X / .XX` | T  | `XXX / .X. / .X. / .X. / .X.` |
| H  | `X.X / X.X / XXX / X.X / X.X` | U  | `X.X / X.X / X.X / X.X / XXX` |
| I  | `XXX / .X. / .X. / .X. / XXX` | V  | `X.X / X.X / X.X / X.X / .X.` |
| J  | `..X / ..X / ..X / X.X / .X.` | W  | `X.X / X.X / XXX / XXX / X.X` |
| K  | `X.X / XX. / X.. / XX. / X.X` | X  | `X.X / X.X / .X. / X.X / X.X` |
| L  | `X.. / X.. / X.. / X.. / XXX` | Y  | `X.X / X.X / .X. / .X. / .X.` |
| M  | `X.X / XXX / XXX / X.X / X.X` | Z  | `XXX / ..X / .X. / X.. / XXX` |

| Ch | Linhas                     | Ch | Linhas                     |
|----|----------------------------|----|----------------------------|
| 0  | `XXX / X.X / X.X / X.X / XXX` | 5  | `XXX / X.. / XXX / ..X / XXX` |
| 1  | `.X. / XX. / .X. / .X. / XXX` | 6  | `XXX / X.. / XXX / X.X / XXX` |
| 2  | `XXX / ..X / XXX / X.. / XXX` | 7  | `XXX / ..X / .X. / .X. / .X.` |
| 3  | `XXX / ..X / XXX / ..X / XXX` | 8  | `XXX / X.X / XXX / X.X / XXX` |
| 4  | `X.X / X.X / XXX / ..X / ..X` | 9  | `XXX / X.X / XXX / ..X / XXX` |

Escalas usadas (sempre inteiras, nearest-neighbor):
- ×1 (3×5): medidor, hi-score, indicador de mute;
- ×2 (6×10, avanço 8): "PAUSA", botão START;
- ×3 (9×15, avanço 12): título "DELTA STRIKE".

### 8.3 Glifo "½" — 9×9, cor `K` (usado no medidor de combustível)

```
.K.......
KK....K..
.K...K...
.K..K....
KKKK..KKK
..K.....K
.K....KKK
......K..
......KKK
```

---

## 9. HUD (y=162..209) — detalhamento normativo

Ordem de desenho: fundo → placar → medidor → vidas → faixa arco-íris → mute.

### 9.1 Fundo

- `y=162..163`: retângulo preto `#000000`, x=0..159 (separador).
- `y=164..209`: retângulo cinza `#ABABAB`, x=0..159.

### 9.2 Placar (score)

- Dígitos 8×10 amarelos (`Y`), fonte da Seção 8.1, em `y=166..175`.
- **Alinhado à direita com borda fixa em x=104** (o dígito das unidades ocupa
  x=96..103). Avanço 10 px por dígito, crescendo para a esquerda.
- Sem zeros à esquerda; score inicial exibe `0`.
- Máximo 6 dígitos (999999). Ao ultrapassar: exibir `!!!!!!` (Seção 10.5).

### 9.3 Medidor de combustível

- Caixa de **48×14 px** em `x=56..103, y=178..191`:
  - borda preta de 2 px (todas as arestas);
  - interior cinza `#ABABAB` (mesmo do fundo, como no original);
  - "entalhes" pretos de 2×2 nos dois cantos superiores INTERNOS do medidor
    (x=58..59 y=180..181 e x=100..101 y=180..181).
- Marcações (pretas, desenhadas antes do ponteiro):
  - letra `E` (mini-fonte ×1) com âncora em `(61, 182)`;
  - glifo `½` (Seção 8.3) com âncora em `(75, 180)`;
  - letra `F` (mini-fonte ×1) com âncora em `(96, 182)`.
- **Ponteiro**: retângulo amarelo `Y` de **2×10 px**, `y=180..189`;
  posição: `x = 58 + round(fuel × 42)` com `fuel ∈ [0,1]`
  (E vazio: x=58..59; F cheio: x=100..101). Desenhado por cima das marcações.

### 9.4 Vidas

- Dígito 8×10 amarelo com o número de vidas de reserva (0–9), âncora
  `(8, 180)`.
- Mini-avião (Seção 7.9) ao lado, âncora `(20, 182)`.

### 9.5 Faixa decorativa arco-íris (assinatura do Delta Strike)

Desenho original nosso (NÃO reproduz o logotipo Activision — apenas evoca uma
faixa colorida na base, genérica):

- Retângulo de **112×6 px** em `x=24..135, y=198..203`, composto por 6 linhas
  horizontais de 1 px, de cima para baixo:

| Linha | Cor |
|-------|-----|
| y=198 | `R #B21D17` |
| y=199 | `C #C85F24` |
| y=200 | `G #FFC545` |
| y=201 | `Y #FFF456` |
| y=202 | `V #61D070` |
| y=203 | `Z #7382F7` |

### 9.6 Indicador de mute

- Quando o som estiver mutado: letra `M` (mini-fonte ×1) preta, âncora
  `(148, 182)`. Ausente quando o som está ativo.

---

## 10. Efeitos e sequências

Todos os tempos em frames de jogo a 60 fps.

### 10.1 Explosão de entidade

1. Congela a entidade e a substitui pelos 3 frames da explosão genérica
   (8 frames cada, total 24), posicionados conforme a tabela da Seção 7.7.
2. Em seguida, destroços (7.8): 2 frames alternando a cada 8, por 60 frames,
   rolando com o cenário.

### 10.2 Morte do player

1. Player substituído pelos frames A/B de explosão (7.1), alternando a cada
   4 frames, por **48 frames**.
2. Player invisível por **30 frames** (cenário continua parado; scroll para).
3. Corte seco: decrementa o dígito de vidas, rio reposicionado num trecho
   reto (spec de gameplay), player reaparece em `x=73, y=140`.
4. Sem efeito de invulnerabilidade e sem piscar após o respawn (fiel ao
   original). Sem fade, sem shake.

### 10.3 Coleta de combustível (sobrevoo do depósito)

Nenhum efeito visual extra além do ponteiro subindo (o feedback é sonoro).
O depósito permanece desenhado normalmente sob o player.

### 10.4 Flicker de renderização

NÃO simular o flicker de sprites do 2600 (limitação, não estética). Todas as
entidades são desenhadas de forma estável a 60 fps.

### 10.5 Placar em 1.000.000

Ao passar de 999999, o placar exibe permanentemente `!!!!!!` (seis glifos `!`
da Seção 8.1, mesmas métricas/posição do placar) até o fim da partida — fiel
ao comportamento-assinatura do original.

---

## 11. Telas e estados

### 11.1 Tela de título

Fundo = playfield inicial estático (rio reto, sem entidades móveis, sem
scroll) + HUD normal (score 0, vidas iniciais, ponteiro em F). Sobre o
playfield:

| Elemento | Especificação |
|----------|---------------|
| Título   | `DELTA STRIKE` em mini-fonte ×3 amarela `Y`, âncora `(10, 20)` (largura total 141 px) |
| Chamada  | Desktop: `APERTE ENTER` · Touch: `TOQUE PARA JOGAR` — mini-fonte ×1 amarela, centralizada horizontalmente, `y=100..104`; pisca: 30 frames visível, 30 invisível |
| Hi-score | `HI` + espaço (4 px) + valor em mini-fonte ×1 branca `W`, centralizado, `y=112..116` |
| Botão START (somente touch) | Retângulo `x=56..103, y=126..141`: fundo preto, borda branca de 1 px, texto `START` em mini-fonte ×2 amarela com âncora `(61, 129)` |

### 11.2 Pausa

Playfield e HUD congelados (última imagem), sem escurecer. Texto `PAUSA` em
mini-fonte ×2 amarela, centralizado (âncora x=61), `y=76..85`, piscando
30/30.

### 11.3 Game over

Após a última vida: tela congelada, dígito de vidas mostra `0`, e o placar
pisca (30 visível / 30 invisível) até ENTER/START, quando volta à tela de
título (corte seco). Sem texto adicional (fiel ao minimalismo do original).

### 11.4 Início de partida / respawn

Sempre corte seco (nenhuma transição animada). O primeiro frame da partida já
mostra o rio completo e o player na posição inicial.

---

## 12. PWA / ícones / meta

- `manifest.webmanifest`: `"background_color": "#000000"`,
  `"theme_color": "#000000"`, `"display": "fullscreen"`,
  `"orientation": "portrait"`.
- **Ícones** (`icon-192.png`, `icon-512.png`) — desenho original, gerado uma
  única vez (fora do runtime) seguindo esta receita determinística:
  - fundo integral azul-rio `#584FDA`;
  - duas colunas laterais verde-oliva `#649228` com largura de 1/5 do ícone
    (192: 38 px; 512: 102 px), coladas às bordas esquerda/direita;
  - sprite do player (7.1) escalado nearest-neighbor, centrado:
    ×8 no de 192 (112×96) e ×24 no de 512 (336×288);
  - sem texto, sem borda, cantos retos (o SO aplica a máscara).
- Favicon: o mesmo desenho do `icon-192.png`.

---

## 13. PALETA CANÔNICA (tabela final)

Coluna "TIA aprox." é **informativa** (hue/luma NTSC aproximados); o valor
normativo é o hex.

| Nome                          | Uso principal                              | Hex       | TIA aprox. |
|-------------------------------|--------------------------------------------|-----------|------------|
| Preto                         | fundo da página, separador, superestrutura do navio, janelas, marcações do medidor | `#000000` | `$00` |
| Cinza HUD                     | fundo do HUD e interior do medidor         | `#ABABAB` | `$0A` |
| Cinza claro (estrada)         | leito da estrada                           | `#CDCDCD` | `$0C` |
| Cinza escuro (estrada)        | acostamento da estrada                     | `#797979` | `$06` |
| Branco                        | casas, bandas do depósito, hi-score        | `#F2F2F2` | `$0E` |
| Amarelo principal             | player, míssil, placar, vidas, linha da estrada, textos | `#FFF456` | `$1C` |
| Amarelo pálido                | núcleo de explosões (flash)                | `#FFFF98` | `$1E` |
| Ouro                          | rotor do helicóptero, linha da ponte, explosões | `#FFC545` | `$1A` |
| Magenta                       | bandas do depósito FUEL                    | `#EA51EB` | `$5A` |
| Vermelho                      | casco do navio, estilhaços, arco-íris      | `#B21D17` | `$42` |
| Laranja-tijolo                | listras claras da ponte, borda de explosão | `#C85F24` | `$38` |
| Marrom escuro                 | listras escuras da ponte                   | `#833008` | `$34` |
| Marrom sombra                 | vigas/pilares da ponte                     | `#451904` | `$32` |
| Marrom tronco                 | tronco das árvores                         | `#391701` | `$30` |
| Azul-marinho                  | fuselagem do helicóptero                   | `#0C048B` | `$82` |
| Verde-heli                    | cabine/apoios do helicóptero               | `#0A4108` | `$D0` |
| Ciano claro                   | linha superior do jato inimigo             | `#73CFEF` | `$AC` |
| Azul-céu                      | linha média do jato inimigo                | `#73B6EF` | `$9C` |
| Azul-violeta                  | linha inferior do jato inimigo, arco-íris  | `#7382F7` | `$88` |
| Azul do rio                   | água                                       | `#584FDA` | `$86` |
| Verde-oliva                   | margens (seções ímpares)                   | `#649228` | `$D6` |
| Verde-floresta                | margens (seções pares)                     | `#0C4A1C` | `$D2` |
| Verde claro                   | linha d'água do navio, arco-íris           | `#61D070` | `$C8` |
| Verde-lima                    | copa das árvores                           | `#B2D241` | `$DA` |

Total: 24 cores + transparente. Nenhuma outra cor é permitida em nenhuma
superfície do jogo, página ou ícone (exceção única: o texto de dica de teclado
`#666666` fora do canvas, Seção 2).

---

## 14. Checklist de fidelidade (verificação visual final)

1. Rio azul-arroxeado chapado; margens verdes com contorno em escadinha 4 px.
2. Cor da margem alterna oliva/floresta a cada ponte.
3. Estrada cinza horizontal com linha amarela cruzando as margens só na
   altura das pontes; ponte marrom listrada com a linha em ouro.
4. Depósito FUEL com bandas magenta/branco e letras vazadas.
5. Helicóptero com rotor ouro alternando em 2 frames; navio comprido preto/
   vermelho/verde; jato inimigo em 3 azuis.
6. Player amarelo, sem inclinação, míssil único amarelo.
7. HUD: faixa cinza, dígitos amarelos "gordos" alinhados à direita, medidor
   E ½ F com ponteiro amarelo, dígito de vidas + mini-avião, faixa arco-íris.
8. Explosões: flash → bola de fogo → dispersão → destroços na água.
9. `!!!!!!` ao estourar 999999.
10. Zero anti-aliasing, zero gradientes, zero alpha, escala inteira com
    letterbox preto.
