# DELTA STRIKE — Arquitetura Técnica

> **Status:** especificação normativa. O implementador NÃO deve tomar decisões de design por conta própria: tudo que não está aqui está em `docs/plan/game-design.md`, `docs/plan/visual-spec.md` ou `docs/plan/audio-spec.md`, sempre referenciado como constante `DS.C.NOME`.
>
> **Convenção de origem das constantes:** `[ARQ]` = valor fixado NESTE documento (final). `[GD]` = valor vem do game-design. `[VS]` = valor vem do visual-spec. `[AS]` = valor vem do audio-spec.
>
> Idioma dos docs: pt-BR. Código, identificadores, nomes de arquivos e strings internas: **inglês**.

---

## 1. Visão geral

DELTA STRIKE é uma recriação fiel do gameplay/visual/som de River Raid (Atari 2600, 1982) com assets 100 % originais. Roda em browser desktop e mobile, 100 % offline (PWA), sem build step, sem frameworks, sem rede.

**Pilares técnicos (pinados, não rediscutir):**

- HTML5 Canvas 2D + JavaScript vanilla, scripts clássicos (não ES modules), carregados em ordem no `index.html`.
- Namespace global único `DS` (window.DS). Nenhum outro global.
- Resolução lógica **160×210 px** desenhada num canvas offscreen e escalada para o canvas visível com nearest-neighbor.
- Playfield: linhas de tela `y = 0..161` (162 px). HUD: linhas `y = 162..209` (48 px).
- Web Audio API, sons 100 % sintetizados (estética TIA), desbloqueio no primeiro gesto.
- Update determinístico a 60 Hz fixos; rio gerado por PRNG semeado (mulberry32) — mesma seed ⇒ mesmo jogo.

### 1.1 Árvore de arquivos (completa e final)

```
Delta-Strike/
├── index.html
├── style.css
├── manifest.webmanifest
├── sw.js
├── icons/
│   ├── icon-192.png        (gerado por tools/make_icons.py)
│   └── icon-512.png        (gerado por tools/make_icons.py)
├── js/
│   ├── constants.js        → define DS.C e DS.U
│   ├── sprites.js          → define DS.Sprites
│   ├── audio.js            → define DS.Audio
│   ├── river.js            → define DS.River
│   ├── entities.js         → define DS.Entities
│   └── game.js             → define DS.Game
├── tools/
│   └── make_icons.py       (utilitário dev; NÃO é servido nem cacheado)
└── docs/plan/…             (estes documentos; não servidos)
```

Nenhum outro arquivo de runtime é permitido. Nenhuma imagem/som externo: todos os sprites são pixel-maps em `sprites.js`, todo som é sintetizado em `audio.js`.

### 1.2 Convenções de código (obrigatórias)

Cada arquivo `js/*.js` segue exatamente este esqueleto:

```js
/* DELTA STRIKE — <module>.js */
(function () {
  'use strict';
  window.DS = window.DS || {};

  // ... conteúdo do módulo ...

  DS.ModuleName = { /* API pública */ };
})();
```

- `'use strict'` em todo arquivo, dentro da IIFE.
- Proibido `console.log` em produção. Permitido apenas `console.error` (e `console.warn` para falhas recuperáveis, ex.: localStorage indisponível).
- Proibido `setInterval`/`setTimeout` para lógica de jogo (apenas `requestAnimationFrame`). `setTimeout` é permitido só em código não-jogo (ex.: fade de hints via CSS é preferível).
- Todo estado mutável de módulo fica em variáveis locais da IIFE; a API pública expõe funções e, quando especificado, propriedades de leitura.
- Ordem de dependência (e de carga): `constants → sprites → audio → river → entities → game`. Um módulo só pode referenciar módulos anteriores na ordem. `game.js` conhece todos; `entities.js` conhece `C, U, Sprites, Audio, River`; `river.js` conhece `C, U, Sprites`; etc.

---

## 2. Sistema de coordenadas e câmera

### 2.1 Definições

- **Mundo:** coordenadas em px lógicos. `worldX ∈ [0, 160)` (não há scroll horizontal; worldX ≡ screenX). **`worldY` cresce PARA CIMA** — o jogador sobe o rio, então `player.y` só aumenta durante o voo.
- **Tela (playfield):** `screenY` cresce para baixo, `screenY ∈ [0, 161]`.
- **Câmera:** `cameraY` = worldY correspondente à linha de tela `screenY = 0` (topo do playfield).

### 2.2 Fórmulas de conversão (normativas)

```
screenY = cameraY - worldY          // mundo → tela
worldY  = cameraY - screenY         // tela → mundo
screenX = worldX                    // idêntico
```

Intervalo de mundo visível no playfield: `worldY ∈ [cameraY - 161, cameraY]`.

### 2.3 Âncora de entidades e arredondamento

- Toda entidade guarda posição pelo **centro** do sprite: `(x, y)` floats.
- Desenho: `sx = Math.round(x - w/2)`, `sy = Math.round((cameraY - y) - h/2)`, onde `{w,h} = DS.Sprites.size(name)`. Só arredondar no desenho; a simulação usa floats.

### 2.4 Câmera segue o jogador

O jogador fica fixo na linha de tela `DS.C.PLAYER_SCREEN_Y = 130` `[ARQ]` (VS pode ajustar ±4 px; se ajustar, muda só a constante):

```
cameraY = player.y + DS.C.PLAYER_SCREEN_Y
```

Recalculada todo update de `PLAYING` **depois** de `DS.Entities.update`. O scroll do mundo é, portanto, exatamente a velocidade vertical do jogador — não existe velocidade de scroll separada. Durante `DYING`, `RESPAWN` (antes do reposicionamento), `PAUSED`, `GAMEOVER` e `TITLE` a câmera não se move.

### 2.5 Início de mundo

- O rio é definido para `worldY >= 0`. `DS.River.channelAt` com argumento negativo retorna o canal de `worldY = 0` (clamp).
- Posição inicial do jogador em novo jogo: `player.y = DS.C.PLAYER_START_Y` `[GD]` (recomendação: `31`, que coloca a base do playfield exatamente em `worldY = 0`). `player.x = 80` (centro) `[ARQ]`.

---

## 3. Game loop

Implementado em `game.js`. `requestAnimationFrame` + **timestep fixo** com acumulador. Render direto (sem interpolação — em 160×210 com snap para pixel inteiro, interpolação não traz benefício e quebraria o look Atari).

### 3.1 Constantes `[ARQ]`

```js
DS.C.DT             = 1 / 60;   // s, passo fixo de simulação
DS.C.MAX_FRAME_DELTA = 0.25;    // s, clamp p/ aba em background
DS.C.MAX_STEPS      = 5;        // máx. updates por frame de render
```

### 3.2 Código de referência (normativo)

```js
var last = 0, acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (!last) { last = now; return; }
  var delta = (now - last) / 1000;
  last = now;
  if (delta > DS.C.MAX_FRAME_DELTA) delta = DS.C.DT; // voltou de background: descarta o tempo perdido
  acc += delta;
  var steps = 0;
  while (acc >= DS.C.DT && steps < DS.C.MAX_STEPS) {
    update(DS.C.DT);          // determinístico, sempre com DT fixo
    acc -= DS.C.DT;
    steps++;
  }
  if (steps === DS.C.MAX_STEPS) acc = 0; // anti "spiral of death": descarta backlog
  render();                   // desenha o estado atual no offscreen e blita
}
requestAnimationFrame(frame);
```

Regras:

- `update()` NUNCA recebe delta variável. Toda física usa `DS.C.DT`.
- Um contador global de ticks `tick` (int, incrementa 1 por update) existe em `game.js` e é usado para piscar textos (ex.: visível quando `(tick / 30 | 0) % 2 === 0` = 0,5 s ligado / 0,5 s desligado) e passado a quem precisar de animação sincronizada.
- `render()` roda 1× por frame de rAF, mesmo se `steps === 0`.

---

## 4. Máquina de estados

### 4.1 Estados e transições

```
                 start*        (colisão | fuel==0)
  TITLE ───────────────▶ PLAYING ───────────────▶ DYING
    ▲                     ▲   │ ▲                   │ timer DYING_TIME
    │                     │   ▼ │ (P/visib.)        ▼
    │        timer/start  │  PAUSED         lives>0 ? RESPAWN : GAMEOVER
    │                     │                    │ timer RESPAWN_TIME
    └────── GAMEOVER ◀────┴────────────────────┘  → PLAYING
```

`start*` = Enter no teclado, clique do mouse ou qualquer touchstart.

Constantes: `DS.C.DYING_TIME` `[GD]` (~1,0 s), `DS.C.RESPAWN_TIME` `[GD]` (~0,8 s), `DS.C.GAMEOVER_TIME` `[GD]` (~4 s).

Nomes canônicos (strings, expostos em `DS.Game.state`):
`'title' | 'playing' | 'paused' | 'dying' | 'respawn' | 'gameover'`.

### 4.2 O que roda em cada estado (tabela normativa)

| Estado | update (por tick) | render (por frame) | Entradas aceitas |
|---|---|---|---|
| `title` | nada de simulação; só edge-inputs | `River.render` com `cameraY = DS.C.TITLE_CAMERA_Y` `[ARQ]`=161 (rio estático da seção 0); logo; texto blink "PRESS START"; HUD zerado | start → `startRun()`; M → mute |
| `playing` | Input → `Entities.update(DT, input)` → `cameraY` → fuel drain → checagens (fuel≤0 → `Entities.killPlayer('fuel')`) → áudio (engine/refuel/lowfuel) | `River.render` → `Entities.render` → HUD | setas/touch, fire, P → paused, M |
| `paused` | nada | mesmo frame congelado (playfield+HUD) + texto "PAUSE" piscando | P/start → playing; M |
| `dying` | `Entities.updateExplosions(DT)`; decrementa `stateTimer`; ao zerar: `lives > 0 ? enterRespawn() : enterGameOver()` | igual a playing (mundo congelado, explosão anima) | M |
| `respawn` | decrementa `stateTimer`; ao zerar → playing | mundo já reposicionado no checkpoint; jogador pisca (visível se `(tick/6|0)%2===0`) | M |
| `gameover` | decrementa `stateTimer`; ao zerar OU start → `enterTitle()` | frame congelado + "GAME OVER" + score final centralizados | start, M |

### 4.3 Funções privadas de transição em `game.js` (nomes normativos)

```js
function enterTitle()            // para loops de áudio, reseta hud demo
function startRun()              // score=0, lives=DS.C.LIVES_START, fuel=DS.C.FUEL_MAX,
                                 // DS.River.init(seed) NÃO é rechamado (rio é fixo por seed),
                                 // DS.Entities.startRun(DS.C.PLAYER_START_Y), state='playing',
                                 // DS.Audio.startLoop('engine')
function enterDying(cause)       // state='dying', stateTimer=DS.C.DYING_TIME,
                                 // DS.Audio.stopLoop('engine'); stopLoop('fuelLow'); stopLoop('refuel');
                                 // DS.Audio.play('explosionPlayer')
function enterRespawn()          // lives--, fuel=DS.C.FUEL_MAX,
                                 // checkpointY = DS.River.sectionStartY(DS.River.sectionAt(deathY)) + DS.C.RESPAWN_OFFSET [GD],
                                 // DS.Entities.respawn(checkpointY), cameraY recalculada,
                                 // state='respawn', stateTimer=DS.C.RESPAWN_TIME
function enterGameOver()         // state='gameover', stateTimer=DS.C.GAMEOVER_TIME, persiste hiscore
function togglePause()           // playing ⇄ paused; ao pausar: DS.Audio.stopLoop('engine');
                                 // ao voltar: DS.Audio.startLoop('engine')
```

Observações de fidelidade:

- **Vidas:** decremento acontece em `enterRespawn`/antes de `enterGameOver` — i.e., quando a morte é consumada. `enterDying` não mexe em vidas; a checagem `lives > 0` na saída de `dying` usa o valor corrente (se `lives` era 1 e o jogador morreu, `dying` → `gameover` e lives vai a 0 ali).
  Implementação normativa: ao final de `dying`, faça `lives--; if (lives > 0) enterRespawnSemDecrementar() else enterGameOver()`. Ou seja: **o decremento ocorre uma única vez, no fim de `dying`**.
- **Checkpoint:** recomeça no início da seção corrente (comportamento do original). Fuel volta a cheio `[GD]`. Score é mantido.
- `visibilitychange` com `document.hidden === true` durante `playing` chama `togglePause()`.

---

## 5. `js/constants.js` — `DS.C` e `DS.U`

### 5.1 `DS.C`

Objeto plano, congelado no fim do arquivo com `Object.freeze(DS.C)`. Contém **todas** as constantes numéricas e a paleta. Zero números mágicos nos outros módulos.

Lista canônica de nomes (o game-design/visual/audio specs preenchem os valores; nomes NÃO mudam):

```js
DS.C = {
  // --- Apresentação [ARQ] ---
  LOGICAL_W: 160, LOGICAL_H: 210,
  PLAYFIELD_H: 162,            // linhas 0..161
  HUD_Y: 162, HUD_H: 48,       // linhas 162..209
  PLAYER_SCREEN_Y: 130,
  TITLE_CAMERA_Y: 161,

  // --- Loop [ARQ] ---
  DT: 1 / 60, MAX_FRAME_DELTA: 0.25, MAX_STEPS: 5,

  // --- Seeds / RNG [ARQ] ---
  DEFAULT_SEED: 0x0D517A,      // "D51 7A" — seed oficial do jogo

  // --- Estados / timers [GD] ---
  DYING_TIME: 0, RESPAWN_TIME: 0, GAMEOVER_TIME: 0,
  RESPAWN_OFFSET: 0,           // px acima do início da seção onde o player renasce

  // --- Player [GD] ---
  PLAYER_START_Y: 0,
  PLAYER_SPEED_MIN: 0, PLAYER_SPEED_CRUISE: 0, PLAYER_SPEED_MAX: 0, // px/s (mundo)
  PLAYER_ACCEL: 0,             // px/s² ao segurar cima/baixo
  PLAYER_STEER_SPEED: 0,       // px/s lateral
  PLAYER_MIN_X: 0, PLAYER_MAX_X: 160,

  // --- Tiro [GD] ---
  MISSILE_SPEED: 0,            // px/s para cima (relativo ao mundo)
  MISSILE_MAX_ONSCREEN: 0,     // fidelidade Atari: verificar no game-design (1 ou 2)
  FIRE_COOLDOWN: 0,            // s entre tiros com botão segurado (autofire)

  // --- Fuel [GD] ---
  FUEL_MAX: 0, FUEL_DRAIN_PER_S: 0, REFUEL_PER_S: 0, FUEL_LOW_FRAC: 0,

  // --- Vidas / score [GD] ---
  LIVES_START: 0, EXTRA_LIFE_SCORE: 0,
  SCORE_SHIP: 0, SCORE_HELI: 0, SCORE_FUEL: 0, SCORE_JET: 0, SCORE_BRIDGE: 0,

  // --- Rio [GD] ---
  SECTION_LEN: 0,              // px de mundo por seção (ponte a ponte)
  RIVER_STEP: 0,               // px de mundo por "strip" (largura constante dentro do strip)
  RIVER_MIN_HALF: 0, RIVER_MAX_HALF: 0, // metade-largura navegável, px
  ISLAND_CHANCE: 0, ISLAND_MIN_LEN: 0, ISLAND_MAX_LEN: 0,
  SPAWN_AHEAD: 16, CULL_BEHIND: 16,    // [ARQ] margens de ativação/culling (px de mundo)

  // --- Inimigos [GD] ---
  SHIP_SPEED: 0, HELI_SPEED: 0, JET_SPEED: 0,
  ENEMY_MOVE_CHANCE: 0,        // fração de inimigos que nascem se movendo
  BRIDGE_HP: 1,
  HITBOX_SHRINK: 0,            // px descontados de cada lado da AABB (pode ser por tipo; ver §9.6)

  // --- Explosão [VS+GD] ---
  EXPLOSION_FRAME_TIME: 0,     // s por frame do sprite 'explosion'

  // --- Touch / input [ARQ, tunável] ---
  TOUCH_JOY_RADIUS: 48,        // px CSS p/ deflexão máxima do joystick virtual
  TOUCH_DEADZONE: 8,           // px CSS
  BLINK_TICKS: 30,             // meio-período de blink de textos (0,5 s)

  // --- Paleta e layout de HUD [VS] ---
  PALETTE: { /* chaves nomeadas → '#rrggbb'; ver visual-spec (NTSC Atari) */ },
  HUD: { /* posições exatas de score, gauge, vidas, faixa — ver visual-spec */ }
};
```

Valores marcados `0` acima são placeholders: o **implementador de constants.js copia os valores finais do game-design/visual/audio spec**. Nomes extras podem ser adicionados pelos outros specs, nunca removidos/renomeados.

### 5.2 `DS.U` — utilidades puras `[ARQ]` (ficam em constants.js)

```js
DS.U.mulberry32(seed)   // → function(): float [0,1). Implementação normativa abaixo.
DS.U.clamp(v, lo, hi)   // → number
DS.U.sectionSeed(seed, i) // → uint32: (seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0
DS.U.aabb(ax, ay, aw, ah, bx, by, bw, bh) // → bool; caixas centro+dim, mundo
```

`mulberry32` (normativo, byte a byte):

```js
DS.U.mulberry32 = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
```

`aabb` (normativo): recebe centros e dimensões; retorna
`Math.abs(ax - bx) * 2 < (aw + bw) && Math.abs(ay - by) * 2 < (ah + bh)`.

---

## 6. `js/sprites.js` — `DS.Sprites`

### 6.1 Formato de dados (contrato com visual-spec)

Dados privados no arquivo, formato normativo:

```js
var DATA = {
  player: {
    palette: { Y: 'PLAYER_BODY', W: 'PLAYER_DETAIL' }, // char → chave em DS.C.PALETTE
    frames: [
      [ '..YY..',    // frame 0 = reto. Cada string = 1 linha; chars = pixels;
        '.YYYY.',    // '.' = transparente. Todas as linhas do frame têm o mesmo length.
        'YYYYYY' ],
      [ /* frame 1 = inclinado à ESQUERDA */ ],
      [ /* frame 2 = inclinado à DIREITA */ ]
    ]
  },
  // ... demais sprites
};
```

- Cores nunca são hex literais aqui: sempre chaves de `DS.C.PALETTE` (single source of truth do visual-spec).
- Todos os frames de um sprite têm as mesmas dimensões.

### 6.2 Nomes de sprite canônicos (contrato; pixels vêm do visual-spec)

| nome | frames | uso |
|---|---|---|
| `player` | 3 (0=reto, 1=esq, 2=dir) | jato do jogador |
| `heli` | 2 (rotor alternando) | helicóptero |
| `ship` | 1 | navio |
| `jet` | 1 (desenhar espelhado via frame 1 se VS quiser; senão 1) | jato inimigo |
| `fuel` | 1 | depósito FUEL |
| `bridge` | 1 | ponte (largura = vão do rio na linha da ponte; VS define) |
| `explosion` | N `[VS]` | explosão (usada por qualquer morte) |
| `lifeIcon` | 1 | indicador de vidas no HUD |
| `fuelGauge` | 1 | fundo do medidor E–F |
| `fuelPointer` | 1 | ponteiro do medidor |
| `logo` | 1 | logotipo "DELTA STRIKE" da tela de título |
| `font` | 1 por glifo (ver 6.3) | fonte bitmap para textos/score |
| `decorTree`, `decorHouse` | 1 cada | decoração das margens `[VS]` |

### 6.3 API pública (assinaturas exatas)

```js
DS.Sprites.init()
//   Pré-renderiza cada frame de cada sprite em um canvas offscreen próprio
//   (document.createElement('canvas'), ctx sem alpha desnecessário).
//   Deve ser chamada 1× por DS.Game.init() ANTES de qualquer draw. Retorna undefined.

DS.Sprites.draw(ctx, name, frame, x, y)
//   ctx: CanvasRenderingContext2D (o offscreen 160×210)
//   name: string (tabela 6.2). frame: int (aplicar frame % frameCount).
//   x, y: canto SUPERIOR-ESQUERDO em px de TELA, inteiros (caller já converteu/arredondou).
//   Desenha via drawImage do canvas pré-renderizado. Retorna undefined.

DS.Sprites.size(name)        // → { w: int, h: int } (dimensões do frame 0)
DS.Sprites.frameCount(name)  // → int

DS.Sprites.drawText(ctx, text, x, y)
//   Desenha text (string) com a fonte bitmap 'font', monoespaçada,
//   avanço = DS.C.FONT_W + 1 px [VS]. Charset mínimo garantido:
//   'A'–'Z', '0'–'9', ' ', '-', '.', '!' . Chars fora do charset são pulados
//   (avança sem desenhar). x,y = canto superior-esquerdo do primeiro glifo.

DS.Sprites.textWidth(text)   // → int px (p/ centralizar: x = (160 - w) >> 1)
```

Não há tinting em runtime: variações de cor = sprites/entradas de paleta distintas definidas pelo VS.

---

## 7. `js/audio.js` — `DS.Audio`

Contrato de API (a síntese — osciladores, envelopes, ruído, frequências — está no audio-spec; as assinaturas e nomes de som abaixo são fixos):

```js
DS.Audio.init()
//   Cria estado interno; NÃO cria AudioContext ainda (autoplay policy).
//   Lê mute persistido: localStorage['ds.muted'] === '1'. Retorna undefined.

DS.Audio.unlock()
//   Cria/resume o AudioContext. DEVE ser chamada dentro de um handler de
//   gesto do usuário (keydown/mousedown/touchstart). Idempotente. Retorna undefined.

DS.Audio.play(name)
//   One-shot. name ∈ { 'shot', 'explosionEnemy', 'explosionPlayer',
//   'explosionBridge', 'extraLife' } [AS pode adicionar, não renomear].
//   Sem-op silencioso se muted ou não desbloqueado.

DS.Audio.startLoop(name) / DS.Audio.stopLoop(name)
//   Loops contínuos. name ∈ { 'engine', 'fuelLow', 'refuel' }.
//   startLoop é idempotente (não empilha); stopLoop de loop parado é no-op.

DS.Audio.setEngine(throttle01)
//   throttle01: float 0..1 (velocidade normalizada do player:
//   (speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)). Modula pitch do loop 'engine'.

DS.Audio.setMuted(m)   // bool; persiste em localStorage['ds.muted'] ('1'/'0'),
                       // silencia/restaura master gain imediatamente
DS.Audio.isMuted()     // → bool
DS.Audio.stopAll()     // para todos os loops e one-shots ativos
```

### 7.1 Mapa evento → som (normativo; quem chama)

| Evento | Chamador | Chamada |
|---|---|---|
| míssil disparado | entities | `play('shot')` |
| inimigo destruído | entities | `play('explosionEnemy')` |
| ponte destruída | entities | `play('explosionBridge')` |
| morte do player (`enterDying`) | game | `play('explosionPlayer')` + stopLoops |
| início do jogo / resume | game | `startLoop('engine')` |
| pausa / morte / gameover / title | game | `stopLoop('engine')` |
| todo tick de playing | game | `setEngine(throttle01)` |
| fuel < `FUEL_LOW_FRAC` (bordas) | game | `startLoop('fuelLow')` / `stopLoop('fuelLow')` |
| reabastecendo (bordas; ver §9.8) | game | `startLoop('refuel')` / `stopLoop('refuel')` |
| vida extra ganha | game | `play('extraLife')` |
| M pressionado | game | `setMuted(!isMuted())` |

Regra de separação: **entities chama `DS.Audio.play` diretamente apenas para SFX instantâneos causados por ele** (tiro, explosões de inimigo/ponte); tudo que depende de estado do jogo (engine, fuel, vidas, morte do player) é responsabilidade do game via hooks.

---

## 8. `js/river.js` — `DS.River`

### 8.1 Modelo do rio

- O mundo é dividido em **seções** de `DS.C.SECTION_LEN` px: seção `i` cobre `worldY ∈ [i·SECTION_LEN, (i+1)·SECTION_LEN)`.
- **Ponte `b`** (b ≥ 1) fica em `worldY = b·SECTION_LEN` (linha central da ponte). A seção 0 (início do jogo) não tem ponte em y=0.
- Dentro de uma seção, o rio é **piecewise-constant**: fatias ("strips") de `DS.C.RIVER_STEP` px de altura; dentro de um strip, o canal não muda (bordas em degraus, como no Atari). Strips por seção: `SECTION_LEN / RIVER_STEP` (game-design DEVE escolher valores com divisão exata).
- Cada strip tem 1 ou 2 **intervalos navegáveis**: `{ xl, xr }` com `xl` inclusivo, `xr` exclusivo, inteiros, `0 ≤ xl < xr ≤ 160`. Dois intervalos = ilha no meio (ordenados por `xl` crescente).
- Na linha da ponte, a geração força **canal único, reto e centrado** por uma janela de ±`DS.C.BRIDGE_FLAT` px `[GD]` (a ponte e a "estrada" cinza atravessam a tela inteira).

### 8.2 Geração determinística

- Seed global `seed` (uint32) vem de `DS.Game` (URL `?seed=` ou `DS.C.DEFAULT_SEED`).
- Cada seção é gerada **sob demanda e isolada**: `rng = DS.U.mulberry32(DS.U.sectionSeed(seed, i))`. Assim `channelAt` é uma função pura de (seed, worldY) — não importa a ordem em que as seções são visitadas.
- A seção gerada é cacheada em um objeto `sections[i] = { strips, spawns, decor }` onde:
  - `strips`: array de arrays de intervalos (índice = strip dentro da seção).
  - `spawns`: array de spawn records (§8.4), ordenado por `y` crescente.
  - `decor`: array `{ sprite, x, y }` de decoração de margem (árvores/casas), coordenadas de mundo, para o próprio `River.render` desenhar.
- **Continuidade entre seções:** o primeiro strip da seção `i` deve casar com o último da seção `i−1`. Regra normativa: toda seção começa e termina em "canal único centrado de meia-largura `DS.C.RIVER_MAX_HALF`" (a janela da ponte força isso no início; a geração converge para isso no fim). Com isso, seções são independentes e ainda contínuas.
- O algoritmo de passeio da largura/posição do canal (quanto varia por strip, quando abre ilha, etc.) é definido no game-design (`docs/plan/game-design.md`, seção "Geração do rio"), usando SOMENTE `rng()` desta seção — nunca `Math.random()`. `Math.random()` é **proibido em todo o projeto** (exceção: nenhum).

### 8.3 API pública (assinaturas exatas)

```js
DS.River.init(seed)
//   seed: uint32. Limpa cache de seções, guarda seed. Retorna undefined.
//   Chamada 1× por DS.Game.init(); NÃO é rechamada em startRun (rio fixo por sessão).

DS.River.channelAt(worldY)
//   worldY: number (float ok; clamp para >= 0).
//   → Array de 1 ou 2 intervalos { xl: int, xr: int } (xl incl., xr excl.),
//   ordenados por xl. O ARRAY RETORNADO É COMPARTILHADO/CACHEADO:
//   o caller NÃO PODE MUTÁ-LO nem retê-lo entre ticks.

DS.River.sectionAt(worldY)      // → int: Math.max(0, Math.floor(worldY / DS.C.SECTION_LEN))
DS.River.sectionStartY(i)       // → number: i * DS.C.SECTION_LEN
DS.River.bridgeY(b)             // → number: b * DS.C.SECTION_LEN  (b >= 1)

DS.River.spawns(i)
//   i: int índice de seção. → Array (cacheado, não mutar) de spawn records (§8.4).

DS.River.render(ctx, cameraY)
//   Desenha TODO o playfield de fundo (linhas 0..161): água, margens,
//   degraus, ilhas, faixa de estrada nas linhas de ponte, e decor.
//   Algoritmo normativo: para cada screenY de 0 a 161:
//     worldY = cameraY - screenY; ivs = channelAt(worldY);
//     fillRect da linha inteira com PALETTE.GRASS; depois fillRect de cada
//     intervalo com PALETTE.WATER; se |worldY - bridgeY(b)| <= ROAD_HALF [VS]
//     para algum b, pinta as partes de terra com PALETTE.ROAD.
//   Depois desenha decor visível via DS.Sprites.draw.
//   (Otimização permitida: agrupar linhas do mesmo strip num fillRect maior.
//    O resultado por pixel deve ser idêntico ao algoritmo acima.)
```

### 8.4 Spawn record (contrato River → Entities)

```js
{
  id:   'sNN-KK',        // string única: NN = seção, KK = índice no array
  type: 'ship'|'heli'|'jet'|'fuel'|'bridge',
  x:    int,             // centro, px de mundo (jet: x de entrada, 0 ou 160)
  y:    number,          // centro, worldY  (bridge: exatamente bridgeY(b))
  dir:  -1|1,            // sentido horizontal inicial
  v:    float            // rng() bruto [0,1) — entities usa p/ variantes
                          // (ex.: v < DS.C.ENEMY_MOVE_CHANCE ⇒ nasce se movendo)
}
```

- Cada seção `i ≥ 1` contém exatamente 1 record `type:'bridge'` com `y = sectionStartY(i)` — é o **primeiro** do array. Quantidades/posições dos demais: game-design.
- River garante: spawns de `ship`/`heli`/`fuel` têm `x` dentro de um intervalo navegável no seu `y`; `jet` tem `x ∈ {0, 160}`.

---

## 9. `js/entities.js` — `DS.Entities`

### 9.1 Estado interno

```js
var player;        // { x, y, speed, bank(-1|0|1), alive, fireCooldown }
var enemies = [];  // { rec, type, x, y, dir, moving, animT, alive }
var missiles = []; // { x, y }  (do player; inimigos não atiram — fiel ao original)
var bridges = {};  // b -> { b, x:80, y, hp, destroyed }  (persistente na run)
var explosions = [];// { x, y, t }
var pending = [];  // spawn records armados, ordenados por y, ainda não instanciados
var hooks;         // callbacks do game (§9.3)
var nextSection;   // próxima seção cujos spawns ainda não foram enfileirados
```

Arrays com remoção por swap-remove (`arr[i] = arr[arr.length-1]; arr.pop()`), sem alocação por tick além do inevitável.

### 9.2 API pública (assinaturas exatas)

```js
DS.Entities.init(hooks)
//   hooks: objeto §9.3 (todas as funções obrigatórias). Retorna undefined.

DS.Entities.startRun(startY)
//   Nova partida: zera enemies/missiles/explosions/bridges/pending,
//   nextSection = 0, cria player em (80, startY), speed = DS.C.PLAYER_SPEED_CRUISE,
//   alive = true. Retorna undefined.

DS.Entities.respawn(checkpointY)
//   Pós-morte: limpa enemies/missiles/explosions; player realocado em
//   (80, checkpointY), speed = CRUISE, alive = true.
//   Re-arma spawns: pending = todos os records com y > checkpointY das seções
//   [sectionAt(checkpointY) .. nextSection-1] JÁ CONSUMIDAS, exceto bridges
//   com destroyed === true; nextSection = max(nextSection, sectionAt(checkpointY)+1)
//   — na prática, como checkpointY > bridgeY(seção corrente), pontes já
//   destruídas ficam atrás do checkpoint e nunca re-armam. Retorna undefined.

DS.Entities.update(dt, input)
//   dt: sempre DS.C.DT. input: { steer: float -1..1, throttle: float -1..1,
//   fire: bool }. Executa §9.4. Retorna undefined.

DS.Entities.updateExplosions(dt)
//   Usado no estado 'dying': avança APENAS animações de explosão.

DS.Entities.render(ctx, cameraY)
//   Ordem de desenho: bridges → fuel/ship/heli/jet → missiles → player
//   (se alive; no estado respawn o game controla o blink via
//   DS.Entities.setPlayerVisible(v)) → explosions.

DS.Entities.setPlayerVisible(v)   // bool; só afeta render (blink de respawn)

DS.Entities.killPlayer(cause)
//   cause: 'bank'|'enemy'|'bridge'|'fuel'. Se player.alive: alive=false,
//   cria explosion em (player.x, player.y), chama hooks.onPlayerDeath(cause).
//   Idempotente dentro do mesmo tick.

DS.Entities.getPlayer()
//   → referência ao objeto player (leitura; game usa x, y, speed, alive).
```

### 9.3 Hooks (contrato Entities → Game; chamadas síncronas durante update)

```js
{
  onScore(points, source),      // source ∈ 'ship'|'heli'|'jet'|'fuel'|'bridge'
  onPlayerDeath(cause),         // game faz enterDying(cause)
  onBridgeDestroyed(b),         // int índice da ponte (métrica/checkpoint implícito)
  onRefuel()                    // chamado A CADA TICK em que o player está
                                // sobrepondo um depósito vivo (game soma fuel)
}
```

### 9.4 Ordem do update (normativa)

1. **Spawning por avanço:** enquanto `sectionStartY(nextSection) <= cameraTop + SPAWN_AHEAD` (onde `cameraTop = player.y + PLAYER_SCREEN_Y`), empurra `DS.River.spawns(nextSection)` em `pending` e `nextSection++`. Depois, instancia todo record de `pending` com `y <= cameraTop + SPAWN_AHEAD` (bridges viram/reusam `bridges[b]`; demais viram enemies).
2. **Player:** `bank = sign(steer)` com histerese simples (|steer| < 0.3 ⇒ 0); `x += steer * PLAYER_STEER_SPEED * dt`, clamp `[PLAYER_MIN_X, PLAYER_MAX_X]`; `speed += throttle * PLAYER_ACCEL * dt`, clamp `[SPEED_MIN, SPEED_MAX]`; `y += speed * dt`.
3. **Tiro:** `fireCooldown -= dt`; se `input.fire && fireCooldown <= 0 && missiles.length < MISSILE_MAX_ONSCREEN`: cria míssil em `(player.x, player.y + h/2)`, `fireCooldown = FIRE_COOLDOWN`, `DS.Audio.play('shot')`.
4. **Mísseis:** `y += MISSILE_SPEED * dt`. Remove se `screenY < -8` OU se o centro `x` não está dentro de nenhum intervalo de `channelAt(y)` **e** também não sobrepõe ponte (míssil morre na margem — degraus bloqueiam tiro, fiel ao original).
5. **Inimigos:** `ship`/`heli` com `moving=true` andam `x += dir * SPEED_tipo * dt`; ao encostar na borda do seu intervalo navegável (`x - w/2 < xl` ou `x + w/2 > xr`), inverte `dir` (clamp na borda). `heli` alterna frame a cada `DS.C.HELI_ANIM_TIME` `[VS]`. `jet` cruza a tela ignorando o rio; removido ao sair (`x < -8 || x > 168`). `fuel` é estático.
6. **Culling:** enemy com `y < cameraBottom - CULL_BEHIND` (onde `cameraBottom = cameraTop - 161`) é removido e NÃO re-armado.
7. **Colisões** (§9.6/9.7): mísseis × (enemies, bridges); player × (banks, enemies, bridges, fuel).
8. **Explosões:** `t += dt`; frame = `floor(t / EXPLOSION_FRAME_TIME)`; remove quando frame ≥ `frameCount('explosion')`.

### 9.5 Determinismo

Nenhum `Math.random()` em entities. Variantes vêm de `rec.v`. Comportamentos dependem só do estado + input ⇒ replay com mesma seed + mesmos inputs é idêntico.

### 9.6 Colisões AABB

- Caixa de colisão = sprite `{w,h}` reduzido: `cw = w - 2*HITBOX_SHRINK`, `ch = h - 2*HITBOX_SHRINK` (game-design pode especializar por tipo com `DS.C.HITBOX.<tipo>`; na ausência, usa `HITBOX_SHRINK` global).
- Teste: `DS.U.aabb(...)` com centros.
- Míssil = ponto (1×2 px) contra caixa do alvo.
- Resultado míssil×enemy: remove ambos, cria explosion no enemy, `DS.Audio.play('explosionEnemy')`, `hooks.onScore(SCORE_tipo, tipo)`.
- Míssil×bridge (só se `!destroyed`): `hp--`; se `hp <= 0`: `destroyed = true`, explosion no centro da ponte, `DS.Audio.play('explosionBridge')`, `hooks.onScore(SCORE_BRIDGE,'bridge')`, `hooks.onBridgeDestroyed(b)`.
- Player×enemy (ship/heli/jet): `killPlayer('enemy')` (o inimigo também explode).
- Player×bridge não destruída: `killPlayer('bridge')`.
- Player×fuel vivo: NÃO mata; dispara `hooks.onRefuel()` neste tick (§9.8). Míssil×fuel destrói o depósito (explosion + `onScore(SCORE_FUEL,'fuel')`) — fiel ao original: dá para pontuar estourando o depósito, inclusive enquanto abastece.

### 9.7 Colisão player × margens (normativa)

Amostragem em 2 linhas de mundo: `yTop = player.y + ch/2` e `yBot = player.y - ch/2`. Para cada linha: obtenha `ivs = channelAt(linha)`; o player está seguro nesta linha se **existe um intervalo** com `xl <= player.x - cw/2` e `player.x + cw/2 <= xr`. Se qualquer linha falhar ⇒ `killPlayer('bank')`. (Duas amostras bastam porque `RIVER_STEP > ch`; game-design garante isso.)

### 9.8 Reabastecimento (protocolo com game)

- Entities chama `hooks.onRefuel()` a cada tick de sobreposição.
- Game: soma `REFUEL_PER_S * DT` ao fuel (clamp em `FUEL_MAX`) e marca `refuelingThisTick = true`. Ao final do tick, compara com o tick anterior: transição false→true ⇒ `DS.Audio.startLoop('refuel')`; true→false ⇒ `DS.Audio.stopLoop('refuel')`.

---

## 10. `js/game.js` — `DS.Game`

### 10.1 API pública

```js
DS.Game.init()
//   Ponto de entrada único, chamado no 'load' pelo index.html:
//   1. seed = parseSeed(location.search)  (§14.2)
//   2. canvas visível = document.getElementById('screen');
//      vctx = canvas.getContext('2d', { alpha: false });
//      off = document.createElement('canvas'); off.width=160; off.height=210;
//      octx = off.getContext('2d', { alpha: false });
//   3. DS.Sprites.init(); DS.Audio.init(); DS.River.init(seed);
//      DS.Entities.init(hooks);
//   4. Input.init(canvas)  (§11)
//   5. resize(); window 'resize' + 'orientationchange' → resize()
//   6. document 'visibilitychange' → auto-pause (§4.3)
//   7. enterTitle(); requestAnimationFrame(frame)
//   Envolver o corpo em try/catch com console.error(e) e re-throw.

// Propriedades de leitura (para debug/teste; atualizadas a cada tick):
DS.Game.state      // string do estado corrente
DS.Game.score      // int
DS.Game.lives      // int
DS.Game.fuel       // float 0..FUEL_MAX
DS.Game.cameraY    // float
DS.Game.seed       // uint32 em uso
DS.Game.tick       // int, contador de updates
DS.Game.cheat      // { invincible: false }  — se true, killPlayer é ignorado
                   // (checado pelo game no hook onPlayerDeath; dev only, sem UI)
```

Implementação das propriedades: atribuição direta (`DS.Game.score = score;`) ao final de cada `update()` — simples e suficiente.

### 10.2 Hooks passados a Entities

```js
{
  onScore: function (points, source) {
    var before = score; score += points;
    if (Math.floor(before / DS.C.EXTRA_LIFE_SCORE) <
        Math.floor(score  / DS.C.EXTRA_LIFE_SCORE)) {
      lives++; DS.Audio.play('extraLife');
    }
  },
  onPlayerDeath: function (cause) {
    if (DS.Game.cheat.invincible && cause !== 'fuel') { /* revive: player.alive=true */ return; }
    enterDying(cause);
  },
  onBridgeDestroyed: function (b) { /* métrica; checkpoint é derivado de sectionAt */ },
  onRefuel: function () { fuel = Math.min(DS.C.FUEL_MAX, fuel + DS.C.REFUEL_PER_S * DS.C.DT);
                          refuelingThisTick = true; }
}
```

### 10.3 Update de `playing` (ordem normativa)

```
1. input = Input.poll()            // snapshot do tick
2. edges: pausePressed → togglePause(); mutePressed → Audio.setMuted(!)
3. DS.Entities.update(DT, input)
4. cameraY = Entities.getPlayer().y + DS.C.PLAYER_SCREEN_Y
5. fuel -= DS.C.FUEL_DRAIN_PER_S * DT          // [GD] pode escalar com speed
6. se fuel <= 0: fuel = 0; DS.Entities.killPlayer('fuel')   // → onPlayerDeath → enterDying
7. Áudio: Audio.setEngine(throttle01); bordas de fuelLow e refuel (§7.1, §9.8)
8. tick++; espelha propriedades públicas; refuelingThisTick = false
```

### 10.4 Render (ordem normativa, sempre no octx 160×210)

```
playing/paused/dying/respawn/gameover:
  1. DS.River.render(octx, cameraY)
  2. DS.Entities.render(octx, cameraY)
  3. renderHUD(octx)
  4. overlay do estado (PAUSE / GAME OVER + score final), textos centrados
     via Sprites.drawText + textWidth
title:
  1. DS.River.render(octx, DS.C.TITLE_CAMERA_Y)
  2. Sprites.draw(octx,'logo',0, (160-logoW)>>1, DS.C.TITLE_LOGO_Y [VS])
  3. blink "PRESS START" (teclado) / "TOUCH TO START" — texto único:
     'PRESS START' [ARQ], y = DS.C.TITLE_START_Y [VS]
  4. renderHUD(octx) com score da última partida (ou 0) e fuel cheio
sempre por último:
  blit: vctx.drawImage(off, 0, 0, canvas.width, canvas.height)
```

`renderHUD(octx)`: preenche `[162..209]` com `PALETTE.HUD_BG`; desenha score (drawText, zeros à esquerda suprimidos como no original `[VS]`), `fuelGauge` + `fuelPointer` (x do ponteiro = `lerp(GAUGE_E_X, GAUGE_F_X, fuel/FUEL_MAX)` `[VS]`), `lifeIcon` × lives, e a faixa decorativa colorida na base `[VS]`. Posições exatas: `DS.C.HUD.*` `[VS]`.

### 10.5 Persistência (localStorage, com try/catch)

| chave | valor | quando |
|---|---|---|
| `ds.muted` | `'1'`/`'0'` | em `Audio.setMuted` |
| `ds.hiscore` | int decimal em string | em `enterGameOver` se `score > hiscore` |

Falha de localStorage (modo privado etc.): `console.warn` e segue sem persistir. Exibição do hiscore na tela de título: linha "HI 015300" abaixo do PRESS START `[VS decide posição; GD decide se exibe]`.

---

## 11. Input (submódulo interno de `game.js`)

Não é exposto em `DS.*` (a não ser via `DS.Game` para debug: opcionalmente `DS.Game.input` espelhando o último snapshot). Vive como objeto local `Input` dentro da IIFE de game.js.

### 11.1 API interna

```js
Input.init(canvas)   // instala todos os listeners (window/document)
Input.poll()         // → { steer: float -1..1, throttle: float -1..1, fire: bool,
                     //     startPressed: bool, pausePressed: bool, mutePressed: bool }
                     // *Pressed são edge-triggered: true apenas no primeiro poll
                     // após o evento (consumidos pelo poll).
```

### 11.2 Teclado

| Tecla (`e.code`) | Ação |
|---|---|
| `ArrowLeft` / `ArrowRight` | steer = −1 / +1 (segurando) |
| `ArrowUp` / `ArrowDown` | throttle = +1 / −1 (segurando) |
| `Space` | fire = true (segurando; autofire pelo FIRE_COOLDOWN) |
| `Enter` | startPressed (edge) |
| `KeyP` | pausePressed (edge) |
| `KeyM` | mutePressed (edge) |

- `keydown`/`keyup` em `window`. `e.preventDefault()` para: as 4 setas, `Space`, `Enter` (evita scroll/da página). Ignorar `e.repeat` para os edges.
- Primeiro `keydown` de qualquer tecla mapeada → `DS.Audio.unlock()`.
- Teclados esq/dir simultâneos: última tecla pressionada vence (guardar ordem, não somar).

### 11.3 Touch (multi-touch por `identifier`)

Listeners em `window` com `{ passive: false }`; `e.preventDefault()` em touchstart/touchmove/touchend (junto com CSS `touch-action: none`, elimina scroll/zoom).

- **Zona esquerda** (`touch.clientX < window.innerWidth / 2`): joystick virtual **relativo ao ponto inicial do toque**. Guardar `{ id, x0, y0 }`. A cada move do mesmo id: `dx = x - x0`, `dy = y - y0` (px CSS);
  `steer = clamp(dz(dx) / DS.C.TOUCH_JOY_RADIUS, -1, 1)` e
  `throttle = clamp(-dz(dy) / DS.C.TOUCH_JOY_RADIUS, -1, 1)`,
  onde `dz(v) = (|v| <= DS.C.TOUCH_DEADZONE) ? 0 : v - sign(v)*TOUCH_DEADZONE`.
  Arrastar para cima acelera (dy negativo ⇒ throttle positivo). touchend/touchcancel do id ⇒ steer=throttle=0. Apenas 1 toque de direção por vez (o primeiro; toques extras na zona esquerda são ignorados).
- **Zona direita**: fire = true enquanto houver ≥1 toque ativo na zona direita (rastrear ids). Autofire resulta do FIRE_COOLDOWN em entities — cadência idêntica a segurar Espaço.
- **Start:** qualquer `touchstart` (qualquer zona) também seta `startPressed` — consumido apenas nos estados title/gameover/paused, então não interfere no jogo.
- Todo `touchstart` e `mousedown` → `DS.Audio.unlock()`.
- Mouse: `mousedown` no canvas seta `startPressed` (para desktop clicar em PRESS START). Mouse não controla o jogo.

### 11.4 Hints visuais de touch

Dois `<div class="hint">` no HTML (§15): esquerdo "DRAG TO STEER", direito "TAP TO FIRE" `[ARQ]`. Regras:

- Exibidos somente se o dispositivo tem touch (`'ontouchstart' in window || navigator.maxTouchPoints > 0`) — caso contrário `display:none` via JS na init.
- Aparecem quando o estado entra em `playing` pela primeira vez na sessão; cada um recebe a classe `hidden` (CSS `opacity:0` com `transition: opacity .5s`) quando o gesto correspondente acontece pela 1ª vez (steer ≠ 0 / fire) OU após 6 s.
- `pointer-events: none` sempre; nunca bloqueiam o jogo. Não persistem em localStorage (reaparecem por sessão).

---

## 12. Escala e apresentação

### 12.1 Algoritmo de resize (normativo)

```js
function resize() {
  var vw = window.innerWidth, vh = window.innerHeight;
  var dpr = window.devicePixelRatio || 1;
  var s = Math.floor(Math.min(vw * dpr / DS.C.LOGICAL_W, vh * dpr / DS.C.LOGICAL_H));
  if (s < 1) s = Math.min(vw * dpr / DS.C.LOGICAL_W, vh * dpr / DS.C.LOGICAL_H); // fracionária só se inteira não couber
  canvas.width  = Math.round(DS.C.LOGICAL_W * s);
  canvas.height = Math.round(DS.C.LOGICAL_H * s);
  canvas.style.width  = (canvas.width  / dpr) + 'px';
  canvas.style.height = (canvas.height / dpr) + 'px';
  vctx = canvas.getContext('2d', { alpha: false });
  vctx.imageSmoothingEnabled = false;   // resetado quando width muda — sempre re-setar
}
```

- Escala inteira **em pixels físicos** (multiplica dpr antes do floor) ⇒ nítido em telas retina.
- Centralização e letterbox: via CSS flexbox no body (§15.2), body preto.
- Blit por frame: `vctx.drawImage(off, 0, 0, canvas.width, canvas.height)` com smoothing off = nearest-neighbor.
- Orientação: funciona em qualquer uma (o algoritmo só depende de vw/vh); manifest pede portrait (§13.1).

---

## 13. PWA / Offline

### 13.1 `manifest.webmanifest` (conteúdo exato)

```json
{
  "name": "DELTA STRIKE",
  "short_name": "DELTA STRIKE",
  "description": "Retro river assault arcade game. 100% offline.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 13.2 `sw.js` (conteúdo exato)

```js
/* DELTA STRIKE — service worker */
'use strict';
var CACHE = 'delta-strike-v1';   // bump manual a cada release: -v2, -v3…
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/constants.js',
  './js/sprites.js',
  './js/audio.js',
  './js/river.js',
  './js/entities.js',
  './js/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // cache:'reload' bypasses the HTTP cache so a new release never
      // precaches stale assets (GitHub Pages serves max-age=600).
      return c.addAll(ASSETS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf('delta-strike-') === 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (r) {
      return r || fetch(e.request);
    })
  );
});
```

- **Cache-first estrito** com `ignoreSearch: true` (para `?seed=` funcionar offline).
- Estratégia de update: bump de `CACHE` + qualquer mudança de arquivo ⇒ SW novo instala em background e assume no próximo load (skipWaiting + claim).
- Revisão 2026-07-10: o precache do `install` usa `Request(u, { cache: 'reload' })`
  para ignorar o cache HTTP do navegador na instalação — sem isso, um release
  publicado dentro da janela de `max-age=600` do GitHub Pages podia precachear
  assets velhos no cache novo.

### 13.3 Registro (no `index.html`, ver §15.1)

```js
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(function (err) { console.error(err); });
}
```

`window.isSecureContext` cobre https e localhost; em `file://` o registro é pulado e o jogo roda normalmente (sem instalação/offline).

---

## 14. Ícones — `tools/make_icons.py`

Script de desenvolvimento (roda 1× para gerar `icons/icon-192.png` e `icons/icon-512.png`), **somente stdlib** (`zlib`, `struct`). Processo normativo:

1. Grid pixel-art 16×16 (abaixo), paleta de 4 cores.
2. Upscale nearest-neighbor: ×12 → 192×192; ×32 → 512×512.
3. Escrita de PNG RGBA 8-bit manual: assinatura PNG; chunk `IHDR` (width, height, bit depth 8, color type 6); `IDAT` = `zlib.compress` das scanlines, cada uma prefixada com byte de filtro `0`; `IEND`. CRC de cada chunk via `zlib.crc32(tipo + dados)`.

Grid e paleta normativos (`.`=fundo preto, `B`=água, `Y`=jato, `O`=exaustor):

```
ICON = [
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBYYBBBB...",
  "...BBBBYYBBBB...",
  "...BBBYYYYBBB...",
  "...BBBYYYYBBB...",
  "...BBYYYYYYBB...",
  "...BBYYYYYYBB...",
  "...BYYYYYYYYB...",
  "..YYYYYYYYYYYY..",
  ".YYYYYYYYYYYYYY.",
  ".YY..BYYYYB..YY.",
  "...BBBBOOBBBB...",
  "...BBBBOOBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
]
PAL = { '.': (0,0,0,255), 'B': (42,82,164,255),
        'Y': (232,210,88,255), 'O': (216,100,32,255) }
```

Os hex de `B`/`Y`/`O` devem ser sincronizados com `DS.C.PALETTE` (WATER, PLAYER_BODY, EXPLOSION) quando o visual-spec fixar os valores NTSC — atualizar `PAL` e regenerar. Fundo do ícone permanece preto puro.

Implementação de referência (normativa; o implementador pode copiá-la):

```python
#!/usr/bin/env python3
"""Generate icons/icon-192.png and icons/icon-512.png. Stdlib only."""
import struct, zlib, os

ICON = [  # 16x16, see architecture.md §14
    "...BBBBBBBBBB...", "...BBBBBBBBBB...", "...BBBBYYBBBB...",
    "...BBBBYYBBBB...", "...BBBYYYYBBB...", "...BBBYYYYBBB...",
    "...BBYYYYYYBB...", "...BBYYYYYYBB...", "...BYYYYYYYYB...",
    "..YYYYYYYYYYYY..", ".YYYYYYYYYYYYYY.", ".YY..BYYYYB..YY.",
    "...BBBBOOBBBB...", "...BBBBOOBBBB...", "...BBBBBBBBBB...",
    "...BBBBBBBBBB...",
]
PAL = {'.': (0,0,0,255), 'B': (42,82,164,255),
       'Y': (232,210,88,255), 'O': (216,100,32,255)}

def chunk(tag, data):
    return (struct.pack('>I', len(data)) + tag + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

def write_png(path, size):
    scale = size // 16
    raw = bytearray()
    for row in ICON:
        line = bytearray()
        for ch in row:
            line += bytes(PAL[ch]) * scale
        raw += (b'\x00' + bytes(line)) * scale   # filter 0 per scanline
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path)

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(out, exist_ok=True)
    write_png(os.path.join(out, 'icon-192.png'), 192)
    write_png(os.path.join(out, 'icon-512.png'), 512)
```

---

## 15. `index.html` e `style.css`

### 15.1 `index.html` (esqueleto exato)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="theme-color" content="#000000">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <title>DELTA STRIKE</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon-192.png" type="image/png">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <canvas id="screen" width="160" height="210"></canvas>
  <div id="hint-left"  class="hint">DRAG TO STEER</div>
  <div id="hint-right" class="hint">TAP TO FIRE</div>

  <script src="js/constants.js"></script>
  <script src="js/sprites.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/river.js"></script>
  <script src="js/entities.js"></script>
  <script src="js/game.js"></script>
  <script>
    window.addEventListener('load', function () {
      DS.Game.init();
      if ('serviceWorker' in navigator && window.isSecureContext) {
        navigator.serviceWorker.register('sw.js')
          .catch(function (err) { console.error(err); });
      }
    });
  </script>
</body>
</html>
```

Nada mais no HTML. Nenhum outro elemento, nenhum outro script.

### 15.2 `style.css` (esqueleto exato)

```css
/* DELTA STRIKE */
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  background: #000; overflow: hidden;
  touch-action: none; overscroll-behavior: none;
  -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
}
body {
  display: flex; align-items: center; justify-content: center;
}
#screen {
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* fallback Firefox antigo */
  background: #000;
}
.hint {
  position: fixed; bottom: 18%;
  font: 12px/1.4 monospace; letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.55);
  pointer-events: none;
  opacity: 1; transition: opacity 0.5s ease-out;
}
#hint-left  { left: 8%; }
#hint-right { right: 8%; }
.hint.hidden { opacity: 0; }
```

---

## 16. Debug e testabilidade

- `window.DS` é o namespace global — tudo inspecionável no console.
- Leituras garantidas: `DS.Game.state`, `.score`, `.lives`, `.fuel`, `.cameraY`, `.seed`, `.tick` (§10.1); `DS.Entities.getPlayer()`; `DS.River.channelAt(y)`.
- `DS.Game.cheat.invincible = true` no console para atravessar o jogo em testes (não afeta morte por fuel).
- **`?seed=`**: `parseSeed`:

```js
function parseSeed(search) {
  var v = new URLSearchParams(search).get('seed');
  if (v === null) return DS.C.DEFAULT_SEED;
  var n = Number(v);            // aceita decimal e '0x...' hex
  return (isFinite(n)) ? (n >>> 0) : DS.C.DEFAULT_SEED;
}
```

- Testes de determinismo no console:
  - `JSON.stringify(DS.River.channelAt(5000))` idêntico entre reloads com a mesma seed.
  - `DS.River.spawns(3)` idêntico entre reloads.
- Sem framework de teste: validação por checklist (§17) + smoke tests manuais. Nenhum `console.log` residual (grep antes de release).

---

## 17. Checklist de integração (ordem de trabalho e verificação)

Ordem de implementação recomendada (cada passo deixa o jogo executável):

1. `constants.js` (com valores dos outros specs) + `index.html` + `style.css` → página abre, canvas preto escalado, sem erros no console.
2. `sprites.js` → no console: `DS.Sprites.init(); DS.Sprites.size('player')` ok; desenhar um frame num canvas de teste.
3. `river.js` → `DS.River.init(1); DS.River.channelAt(0)` retorna intervalos; `DS.River.render` pinta o rio (chamável à mão no octx).
4. `audio.js` → `DS.Audio.unlock(); DS.Audio.play('shot')` audível após clique.
5. `entities.js` + `game.js` mínimo (loop + estados) → jogo jogável.
6. HUD completo, touch, hints.
7. `manifest.webmanifest`, `sw.js`, `tools/make_icons.py` (rodar e commitar PNGs).

Smoke tests obrigatórios antes de release:

- [ ] `python3 -m http.server` + desktop Chrome e Firefox: title → jogar → morrer 3× → game over → title.
- [ ] Setas + espaço com preventDefault (página não rola); P pausa; M muta e persiste após reload.
- [ ] Aba em background 30 s → volta sem "salto" (clamp de delta funcionando: jogo continua de onde estava).
- [ ] Mobile (iOS Safari + Android Chrome): multi-touch — dirigir e atirar simultaneamente; hints aparecem e somem.
- [ ] Determinismo: duas execuções com `?seed=42` têm o mesmo rio e mesmos spawns.
- [ ] Offline: carregar 1×, derrubar o servidor, recarregar — jogo abre (DevTools → Application → SW ativo, cache `delta-strike-v1` com todos os ASSETS).
- [ ] Instalação PWA: prompt de instalação disponível; app instalado abre fullscreen portrait com ícone correto.
- [ ] Escala: janelas 320×420 (2×), 800×600, iPhone portrait — sempre nítido, letterbox preto, nunca scroll.
- [ ] Zero `console.log`; zero requests de rede além dos arquivos locais (aba Network).
- [ ] Colisões: encostar na margem mata; sobrevoar FUEL abastece (som + ponteiro sobe); atirar em FUEL pontua; ponte bloqueia e explode com 1 tiro `[GD]`.

---

## 18. Apêndice A — Tabela-resumo de contratos públicos

| Símbolo | Assinatura | Definido em |
|---|---|---|
| `DS.C` | objeto congelado de constantes | constants.js |
| `DS.U.mulberry32` | `(seed:uint32) → () → float[0,1)` | constants.js |
| `DS.U.clamp` | `(v, lo, hi) → number` | constants.js |
| `DS.U.sectionSeed` | `(seed, i) → uint32` | constants.js |
| `DS.U.aabb` | `(ax,ay,aw,ah,bx,by,bw,bh) → bool` | constants.js |
| `DS.Sprites.init` | `() → undefined` | sprites.js |
| `DS.Sprites.draw` | `(ctx, name, frame, x, y) → undefined` | sprites.js |
| `DS.Sprites.size` | `(name) → {w,h}` | sprites.js |
| `DS.Sprites.frameCount` | `(name) → int` | sprites.js |
| `DS.Sprites.drawText` | `(ctx, text, x, y) → undefined` | sprites.js |
| `DS.Sprites.textWidth` | `(text) → int` | sprites.js |
| `DS.Audio.init` | `() → undefined` | audio.js |
| `DS.Audio.unlock` | `() → undefined` (em gesto) | audio.js |
| `DS.Audio.play` | `(name) → undefined` | audio.js |
| `DS.Audio.startLoop` / `stopLoop` | `(name) → undefined` | audio.js |
| `DS.Audio.setEngine` | `(throttle01:float) → undefined` | audio.js |
| `DS.Audio.setMuted` / `isMuted` | `(bool) → undefined` / `() → bool` | audio.js |
| `DS.Audio.stopAll` | `() → undefined` | audio.js |
| `DS.River.init` | `(seed:uint32) → undefined` | river.js |
| `DS.River.channelAt` | `(worldY) → [{xl,xr}]` (não mutar) | river.js |
| `DS.River.sectionAt` | `(worldY) → int` | river.js |
| `DS.River.sectionStartY` | `(i) → number` | river.js |
| `DS.River.bridgeY` | `(b) → number` | river.js |
| `DS.River.spawns` | `(i) → [SpawnRecord]` (não mutar) | river.js |
| `DS.River.render` | `(ctx, cameraY) → undefined` | river.js |
| `DS.Entities.init` | `(hooks) → undefined` | entities.js |
| `DS.Entities.startRun` | `(startY) → undefined` | entities.js |
| `DS.Entities.respawn` | `(checkpointY) → undefined` | entities.js |
| `DS.Entities.update` | `(dt, {steer,throttle,fire}) → undefined` | entities.js |
| `DS.Entities.updateExplosions` | `(dt) → undefined` | entities.js |
| `DS.Entities.render` | `(ctx, cameraY) → undefined` | entities.js |
| `DS.Entities.setPlayerVisible` | `(bool) → undefined` | entities.js |
| `DS.Entities.killPlayer` | `(cause) → undefined` | entities.js |
| `DS.Entities.getPlayer` | `() → player` | entities.js |
| `DS.Game.init` | `() → undefined` | game.js |
| `DS.Game.state/score/lives/fuel/cameraY/seed/tick` | leitura | game.js |
| `DS.Game.cheat` | `{invincible:bool}` | game.js |

## 19. Apêndice B — Fluxo de um tick de `playing` (visão integrada)

```
rAF frame
 └─ update(DT)                         [game.js]
     ├─ Input.poll() ─────────────────► snapshot {steer, throttle, fire, edges}
     ├─ DS.Entities.update(DT, input)  [entities.js]
     │    ├─ spawn/instancia records ◄─ DS.River.spawns(i)      [river.js]
     │    ├─ move player/enemies/missiles
     │    ├─ colisões ◄──────────────── DS.River.channelAt(y)   [river.js]
     │    ├─ SFX diretos ─────────────► DS.Audio.play(...)      [audio.js]
     │    └─ hooks ───────────────────► onScore/onPlayerDeath/onRefuel  [game.js]
     ├─ cameraY = player.y + 130
     ├─ fuel drain / morte por fuel
     └─ áudio de estado (engine pitch, fuelLow, refuel)
 └─ render()                           [game.js]
     ├─ DS.River.render(octx, cameraY)
     ├─ DS.Entities.render(octx, cameraY)
     ├─ renderHUD(octx)
     └─ vctx.drawImage(off, …)  ← nearest-neighbor p/ tela
```
