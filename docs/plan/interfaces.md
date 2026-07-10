# DELTA STRIKE — interfaces.md (CONTRATO FINAL DE INTEGRAÇÃO)

> **Este documento tem autoridade FINAL.** Onde ele divergir de `game-design.md`,
> `visual-spec.md`, `audio-spec.md` ou `architecture.md`, **este documento vence**.
> Cada implementador lê: (1) este arquivo inteiro; (2) as seções da sua spec de
> origem indicadas em `build-tasks.md`. Nenhuma decisão de design é tomada na
> implementação.
>
> Idioma do doc: pt-BR. Código, identificadores, nomes de arquivo e TODOS os
> textos exibidos no jogo: **inglês**.

---

## 0. Resoluções de conflito (normativas — substituem os docs de origem)

| # | Tema | Decisão final |
|---|------|---------------|
| R1 | Sprite do player | **14×12, 1 único frame de voo** (visual-spec §7.1 vence o game-design "3 frames"). Sem animação de bank. Explosão do player = sprite `playerBoom` (2 frames, 14×12). |
| R2 | Linha do player na tela | `PLAYER_SCREEN_Y = 134` = screen-y do **CENTRO** do sprite (linhas de tela 129..140). Substitui GD y=128(topo), VS âncora y=140 e ARQ 130. |
| R3 | Ponte | **64×16 px**, canal forçado `x ∈ [48,112)` na faixa da ponte (visual-spec vence GD 104×24). Estrada = faixa de 16 linhas alinhada à ponte. |
| R4 | Míssil × terreno | O míssil **ignora terreno** (passa sobre margens/ilhas); só morre ao acertar entidade/ponte ou sair pelo topo. (Verificado: no original o tiro "hits a target or flies off the top of the screen".) A regra da architecture ("míssil morre na margem") está **revogada**. |
| R5 | Míssil — referencial | Vive em coordenadas de MUNDO com `vy = MISSILE_SPEED + player.speed` (⇒ exatamente 420 px/s **na tela**, como o GD pede). Guiado: herda `steer * PLAYER_STEER_SPEED` em x enquanto voa. |
| R6 | PRNG | **mulberry32 + seed por seção** (architecture) vence o LFSR do GD. `DEFAULT_SEED = 0x0D517A`. `?seed=` na URL é recurso de DEV/debug (sem UI); partida normal usa sempre a seed fixa ⇒ todo jogo é idêntico (fidelidade). Modo "random seed" NÃO entra no MVP. |
| R7 | API de áudio | A API do **audio-spec** vence a da architecture (`play/startLoop` está revogada). Assinaturas na §5 abaixo. Síntese (frequências, envelopes, mix, compressor, master 0.5) = audio-spec, que vence o GD §15. |
| R8 | Chave de mute | `localStorage['ds.muted']` (o `ds_muted` do audio-spec está revogado). |
| R9 | HUD | Layout do **visual-spec §9** vence o GD §13 (score 8×10 alinhado à direita em x=104; medidor 48×14 com E ½ F; dígito de vidas + mini-avião; faixa arco-íris 112×6; indicador M). |
| R10 | Fontes | Fonte grande 8×10 (dígitos + `!`) e minifonte 3×5 (visual-spec §8) vencem a 5×7 do GD. Minifonte ganha o glifo `!` (definido na §4.3). |
| R11 | Rotor do heli | Troca a cada **8 ticks** (visual-spec) — revoga os 6 ticks do GD. |
| R12 | Explosões | Explosão genérica 16×16 / 3 frames / 8 ticks cada + destroços 8×6 / 2 frames / 60 ticks (visual-spec) vence GD 16×12 2 frames. |
| R13 | Morte/respawn | Sequência do visual-spec §10.2: boom do player 48 ticks (frames A/B a cada 4) + 30 ticks invisível ⇒ `DYING = 78 ticks`. Respawn = corte seco, **sem** "GET READY", **sem** piscar, **sem** invulnerabilidade; `RESPAWN = 45 ticks` de mundo parado. `DS.Entities.setPlayerVisible` foi REMOVIDA da API. |
| R14 | Game over | **Sem texto "GAME OVER"** (visual-spec §11.3 vence GD/ARQ): tela congelada, dígito de vidas = 0, score piscando 30/30. Start aceito após 60 ticks; **sem** timeout automático de volta ao título. |
| R15 | Textos do jogo | Inglês: `PRESS ENTER`, `TAP TO START`, `START`, `PAUSE`, `HI`. (Revoga "APERTE ENTER"/"TOQUE PARA JOGAR"/"PAUSA" do visual-spec.) Título mostra UMA chamada: `TAP TO START` se dispositivo touch, senão `PRESS ENTER`. |
| R16 | Touch | Zonas 60% esquerda (direção) / 40% direita (fogo) do GD vencem o 50/50 da ARQ. Controle **digital** (steer/throttle ∈ {−1,0,1}) do GD vence o analógico da ARQ. Sem botões desenhados durante o jogo (visual-spec): pause/mute viram **hotspots invisíveis** de 24×24 px lógicos nos cantos superiores (mute à esquerda, pause à direita), ativos só em `playing`/`paused`. |
| R17 | Geometria quantizada | Bordas do rio SEMPRE múltiplas de 4 px; largura do canal SEMPRE múltipla de 8; passo por chunk: borda muda 0/±4 (±8 só no lado livre de um WIDEN bloqueado). `SHIFT_STEP=3` do GD revogado (vira 4). `W_MIN` da seção 8+ vira **32** (36 não é múltiplo de 8). |
| R18 | Colisão com margem | **3 linhas de amostragem** (topo/centro/base do hitbox) — necessário porque `RIVER_STEP (8) < altura do hitbox (10)`. |
| R19 | Paleta | Paleta canônica de 24 cores do visual-spec §13 (alinhada à leitura Stella/z26). GD §14 revogado. Depósito FUEL = **magenta `#EA51EB`** (ratificado). **Sem** `ENEMY_TINTS`/ciclo de cor de inimigos (inimigos têm cores fixas multi-linha do VS; a variedade por seção vem da alternância verde-oliva/verde-floresta das margens). |
| R20 | Ícones PWA | Receita do visual-spec §12 (rio + margens + player) com o gerador PNG da architecture §14; cores sincronizadas à paleta final. Gerados por T1 rodando `tools/make_icons.py` uma vez e commitando os PNGs. |
| R21 | Vidas | Reservas: começa **3** (exibe "3"; total 4 aviões). Fim de `dying`: `if (lives > 0) { lives--; enterRespawn(); } else { enterGameOver(); }`. Vida extra: `lives = min(9, lives+1)`. |
| R22 | Dificuldade | Tabela do GD §10 com índice **0-based**: `DIFFICULTY[min(sectionIndex, 7)]`. Ratificado: helis móveis a partir da seção índice 1, jatos a partir da índice 2, navios móveis a partir da índice 3. |
| R23 | Gatilho de jato | `JET_TRIGGER_DISTANCE` revogado; jatos usam o mecanismo único de spawn (`SPAWN_AHEAD`), nascendo fora da tela em x = −8 ou 168. |
| R24 | Decoração | Densidade: 1 decoração a cada 8–15 chunks (64–120 px), lados alternados (síntese entre GD e VS). Regra exata na §6.5. |
| R25 | Checkpoint | `checkpointY = sectionStartY(sectionAt(deathY))`; player renasce em `checkpointY + RESPAWN_OFFSET (27)`. (Equivalente ao "após a última ponte destruída" do GD, pois só se entra numa seção destruindo a ponte dela.) |
| R26 | Fuel | Dreno **constante** 1.3 u/s (independe do throttle) — ratificado [manual]. F→E ≈ 77 s. Alarme < 25% e jingle de vida extra: **ratificados** como adições deliberadas (usabilidade; volume baixo; documentado no audio-spec §1). Fonte da verdade dos gatilhos: `FUEL_LOW_FRAC = 0.25` e `REFUEL_TICK_PERIOD = 6 ticks` (100 ms) em `DS.C`. |
| R27 | Hi-score | **Exibido** na tela de título (`HI <valor>`, ou `HI !!!!!!` se 1.000.000) — desvio consciente do original, ratificado. Persistência `ds.hiscore`. |
| R28 | Tiro | `MISSILE_MAX_ONSCREEN = 1` e `FIRE_COOLDOWN = 0.18 s` — ratificados (original: 1 tiro na tela). |
| R29 | Teclas ←+→ simultâneas | Neutro (steer 0), GD vence ARQ ("última vence" revogado). ↑+↓ simultâneas: ↓ vence. |
| R30 | Dica de teclado | A linha de dica do visual-spec §2 ENTRA no index.html (em inglês), some em dispositivos touch. (Revoga o "nada mais no HTML" da ARQ.) |
| R31 | Sequência de morte (áudio) | `lowFuelAlarm(false)` → `stopEngine()` → `explosionBig()` no mesmo frame, nesta ordem (audio-spec ratificado). Pausa NÃO tem som (lista de sons é fechada) — logo não existe o problema "blip antes do suspend". |
| R32 | Sprites do medidor | `fuelGauge`/`fuelPointer` NÃO são sprites: o game desenha o medidor com `fillRect` + glifos (§7.6). Sprite `logo` também não existe: título é `drawText` escala 3. |
| R33 | Jato inimigo | 1 frame + espelhamento horizontal via parâmetro `flip` de `DS.Sprites.draw` (vale para heli/ship/jet). |

---

## 1. Convenções globais

### 1.1 Unidades
- Distâncias: **px lógicos** (canvas 160×210). Tempo de física: **segundos** (`dt = DS.C.DT = 1/60`). Tempo de animação/estado: **ticks** (1 tick = 1 update a 60 Hz).
- Ângulos/curvas: não existem. Tudo é retangular e chapado.

### 1.2 Sistema de coordenadas (normativo)
- **Mundo:** `worldX ∈ [0,160)` (≡ screenX; sem scroll horizontal). **`worldY` cresce PARA CIMA** (o player sobe o rio ⇒ `player.y` só aumenta em voo).
- **Tela:** `screenY` cresce para baixo, playfield `screenY ∈ [0,161]`.
- **Câmera:** `cameraY` (float) = worldY da linha de tela 0. Em `playing`: `cameraY = player.y + DS.C.PLAYER_SCREEN_Y` (recalculada após `Entities.update`). Congelada em `title/paused/dying/respawn/gameover` (em `respawn` já reposicionada no checkpoint).
- **Inteiro de render:** todo render usa `camInt = Math.round(cameraY)`, calculado 1× por frame em `game.render()` e passado a `River.render` e `Entities.render`. Ninguém mais arredonda a câmera.
- Conversões: `screenY = camInt − worldY` · `worldY = camInt − screenY` · `screenX = worldX`.

### 1.3 Âncoras e desenho de entidades (normativo)
- Entidades guardam posição pelo **CENTRO** `(x, y)` em floats de mundo.
- Toda entidade tem dimensões **pares**. Ela cobre as linhas de mundo `[y − h/2, y + h/2 − 1]` e as colunas `[x − w/2, x + w/2 − 1]`.
- Fórmula única de desenho (top-left de tela):
  ```
  sx = Math.round(x) - (w >> 1)
  sy = (camInt - Math.round(y)) - (h >> 1) + 1
  ```
  (o `+1` garante alinhamento pixel-perfeito ponte↔estrada; usar SEMPRE, para tudo).
- Ex.: player (14×12, centro na linha de tela 134) ⇒ desenhado nas linhas 129..140.

### 1.4 Frames de animação
Todos os períodos em **ticks**: heli 8; explosão genérica 8/frame (3 frames = 24); destroços alternam a cada 8, vivem 60; boom do player alterna a cada 4, dura 48; flicker da ponte alterna a cada 4, dura 32; blink de textos 30 on / 30 off (`visible = ((tick / 30) | 0) % 2 === 0`).

### 1.5 Regras de código
- Esqueleto IIFE por arquivo (architecture §1.2), `'use strict'`, namespace único `window.DS`.
- Ordem de carga/dependência: `constants → sprites → audio → river → entities → game`.
- Proibido: `Math.random()`, `console.log`, `setInterval`, `setTimeout` para lógica de jogo, fetch/CDN/rede, ES modules, frameworks.
- Números mágicos: proibidos em `river.js`, `entities.js`, `game.js` (usar `DS.C`). Exceções documentadas: parâmetros de síntese em `audio.js` (seguem o audio-spec literal) e pixel-maps em `sprites.js` (seguem o visual-spec literal).

---

## 2. `js/constants.js` — CONTEÚDO LITERAL (transcrever verbatim)

O dono de `constants.js` (T6) transcreve o bloco abaixo **byte a byte** (pode
ajustar apenas espaçamento em branco no fim das linhas).

```js
/* DELTA STRIKE — constants.js
 * Single source of truth: every tunable number + the canonical palette.
 * Transcribed verbatim from docs/plan/interfaces.md — edit there first.
 */
(function () {
  'use strict';
  window.DS = window.DS || {};

  var C = {

    // --- Presentation -------------------------------------------------
    LOGICAL_W: 160,
    LOGICAL_H: 210,
    PLAYFIELD_H: 162,            // playfield = screen rows 0..161
    HUD_Y: 162,                  // HUD = rows 162..209
    HUD_H: 48,
    PLAYER_SCREEN_Y: 134,        // screen y of the player sprite CENTER
    TITLE_CAMERA_Y: 161,         // camera for the static title backdrop

    // --- Fixed-timestep loop -------------------------------------------
    DT: 1 / 60,                  // s per update
    MAX_FRAME_DELTA: 0.25,       // s; larger rAF deltas are discarded
    MAX_STEPS: 5,                // max updates per rAF frame
    BLINK_TICKS: 30,             // half-period of blinking texts (0.5 s)

    // --- RNG ------------------------------------------------------------
    DEFAULT_SEED: 0x0D517A,      // official seed; every normal run is identical

    // --- State timers (ticks) -------------------------------------------
    DYING_BOOM_TICKS: 48,        // playerBoom A/B alternating every 4 ticks
    DYING_BLANK_TICKS: 30,       // player invisible, world still frozen
    DYING_TICKS: 78,             // = BOOM + BLANK
    RESPAWN_TICKS: 45,           // frozen at checkpoint, then playing
    GAMEOVER_INPUT_DELAY_TICKS: 60,

    // --- Player -----------------------------------------------------------
    PLAYER_START_Y: 27,          // worldY of player center at new run
    RESPAWN_OFFSET: 27,          // player worldY = sectionStartY + this
    PLAYER_SPEED_MIN: 30,        // px/s  (brake; can never stop)
    PLAYER_SPEED_CRUISE: 60,     // px/s  (no throttle input)
    PLAYER_SPEED_MAX: 150,       // px/s  (full throttle)
    PLAYER_ACCEL: 240,           // px/s^2 toward a higher speed target
    PLAYER_DECEL: 300,           // px/s^2 toward a lower speed target
    PLAYER_STEER_SPEED: 72,      // px/s lateral, constant, no inertia
    PLAYER_MIN_X: 9,             // clamp of player CENTER x
    PLAYER_MAX_X: 151,

    // --- Missile ----------------------------------------------------------
    MISSILE_SPEED: 420,          // px/s relative to the SCREEN
                                 // (world vy = MISSILE_SPEED + player.speed)
    MISSILE_MAX_ONSCREEN: 1,
    FIRE_COOLDOWN: 0.18,         // s between shots (autofire cadence)

    // --- Fuel ---------------------------------------------------------------
    FUEL_MAX: 100,               // units (full tank ~77 s)
    FUEL_DRAIN_PER_S: 1.3,       // constant, independent of speed
    REFUEL_PER_S: 30,            // while overlapping a live depot
    FUEL_LOW_FRAC: 0.25,         // alarm strictly below this fraction
    REFUEL_TICK_PERIOD: 6,       // game ticks between Audio.refuelTick (100 ms)

    // --- Lives / score --------------------------------------------------------
    LIVES_START: 3,              // reserve jets shown in HUD (total 4 planes)
    LIVES_MAX: 9,
    EXTRA_LIFE_SCORE: 10000,
    SCORE_SHIP: 30,
    SCORE_HELI: 60,
    SCORE_FUEL: 80,
    SCORE_JET: 100,
    SCORE_BRIDGE: 500,
    SCORE_MAX: 1000000,          // freezes here; display becomes SCORE_BANG
    SCORE_BANG: '!!!!!!',

    // --- River layout (px world / chunks of 8 px) -------------------------------
    SECTION_LEN: 1200,           // px per section (150 chunks)
    RIVER_STEP: 8,               // chunk height; channel constant inside a chunk
    SECTION_CHUNKS: 150,
    BRIDGE_XL: 48,               // forced channel at bridge chunks (0 and 149)
    BRIDGE_XR: 112,              // xr exclusive -> water spans x 48..111
    SAFE_CHUNKS: 12,             // chunks 0..11: entity-free respawn zone
    SAFE_WIDEN_TARGET: 104,      // safe zone widens 64 -> 104 then holds
    GEOM_FIRST_CHUNK: 12,        // random segments in chunks 12..130
    GEOM_LAST_CHUNK: 130,
    CONVERGE_FIRST_CHUNK: 131,   // 131..148: converge to 64 px centered
    RIVER_MARGIN: 8,             // channel always inside x in [8, 152]
    EDGE_QUANT: 4,               // bank edges are multiples of 4
    SEG_LEN_BASE: 8,             // segment length = 8 + rngInt(8)  (8..15)
    SEG_LEN_RAND: 8,
    ISLAND_LEN_BASE: 20,         // island length = 20 + rngInt(16) (20..35)
    ISLAND_LEN_RAND: 16,
    ISLAND_MIN_RIVER_W: 88,      // island only if channel width >= this
    ISLAND_START_W: 8,           // island appears at 8 px, grows +8/chunk
    ISLAND_MAX_W_CAP: 48,        // plateau width = min(w - 56, 48)
    SEG_W_STRAIGHT: 6,           // fixed segment weights
    SEG_W_NARROW: 3,
    SEG_W_WIDEN: 2,

    // --- Spawning (chunks) ---------------------------------------------------
    SPAWN_AHEAD: 16,             // px beyond camera top to arm spawns
    CULL_BEHIND: 16,             // px below camera bottom to cull
    ENTITY_MIN_GAP_CHUNKS: 5,    // min chunk distance between fuel/enemy records
    SPAWN_JITTER: 8,             // +- chunks for fuel/enemy targets
    JET_CHUNK_MIN: 20,
    JET_CHUNK_MAX: 120,
    JET_JITTER: 5,
    FUEL_CLEARANCE: 10,          // px of water required on each side of a depot
    DECOR_CHUNK_MIN: 3,
    DECOR_CHUNK_MAX: 144,
    DECOR_STEP_MIN: 8,           // next decor at + 8 + rngInt(8) chunks
    DECOR_STEP_RAND: 8,
    DECOR_CLEARANCE: 8,          // px of land between decor and water

    // --- Enemies -----------------------------------------------------------------
    SHIP_SPEED: 15,              // px/s, scaled by section speedMult
    HELI_SPEED: 20,
    JET_SPEED: 120,
    SHIP_MIN_CHANNEL_W: 48,      // ship spawns only in intervals this wide
    ENEMY_BOUNCE_MARGIN: 2,      // px from bank edge where dir flips
    HELI_ANIM_TICKS: 8,
    HITBOX_SHRINK: 1,            // px removed from each side of every AABB

    // --- Explosions / debris (ticks) ------------------------------------------------
    EXPLOSION_FRAME_TICKS: 8,    // generic explosion: 3 frames -> 24 ticks
    DEBRIS_LIFE_TICKS: 60,
    DEBRIS_FRAME_TICKS: 8,
    PLAYER_BOOM_FRAME_TICKS: 4,
    BRIDGE_FLICKER_TICKS: 32,
    BRIDGE_FLICKER_PERIOD_TICKS: 4,

    // --- Difficulty per section (index 0 = first; index >= 7 repeats row 7) -----------
    // wMin/wMax: channel width bounds (multiples of 8). pIsland/pShift: segment weights.
    // nEnemy/nFuel/nJet: records per section. heliMove/shipMove: probability of moving.
    // speedMult: multiplies SHIP/HELI/JET speed.
    DIFFICULTY: [
      { wMin: 64, wMax: 120, pIsland: 0, pShift: 1, nEnemy: 10, nFuel: 6, heliMove: 0.00, shipMove: 0.00, nJet: 0, speedMult: 1.0 },
      { wMin: 56, wMax: 120, pIsland: 1, pShift: 1, nEnemy: 13, nFuel: 5, heliMove: 0.25, shipMove: 0.00, nJet: 0, speedMult: 1.0 },
      { wMin: 56, wMax: 112, pIsland: 2, pShift: 2, nEnemy: 16, nFuel: 5, heliMove: 0.50, shipMove: 0.00, nJet: 2, speedMult: 1.1 },
      { wMin: 48, wMax: 112, pIsland: 2, pShift: 2, nEnemy: 19, nFuel: 4, heliMove: 0.75, shipMove: 0.25, nJet: 3, speedMult: 1.2 },
      { wMin: 48, wMax: 104, pIsland: 3, pShift: 3, nEnemy: 22, nFuel: 4, heliMove: 1.00, shipMove: 0.50, nJet: 4, speedMult: 1.3 },
      { wMin: 40, wMax: 104, pIsland: 3, pShift: 3, nEnemy: 25, nFuel: 3, heliMove: 1.00, shipMove: 0.75, nJet: 5, speedMult: 1.4 },
      { wMin: 40, wMax:  96, pIsland: 4, pShift: 4, nEnemy: 28, nFuel: 3, heliMove: 1.00, shipMove: 1.00, nJet: 6, speedMult: 1.5 },
      { wMin: 32, wMax:  96, pIsland: 4, pShift: 4, nEnemy: 30, nFuel: 2, heliMove: 1.00, shipMove: 1.00, nJet: 7, speedMult: 1.6 }
    ],

    // --- Touch input -----------------------------------------------------------------
    TOUCH_STEER_ZONE: 0.6,       // left fraction of the viewport = steering zone
    TOUCH_DEADZONE_X: 10,        // px CSS; |dx| >= 10 -> steer -1/+1
    TOUCH_THROTTLE_DY: 24,       // px CSS; dy <= -24 fast, dy >= +24 slow
    CORNER_BTN: 24,              // logical px; invisible mute (TL) / pause (TR) hotspots

    // --- HUD layout (from visual-spec §9; screen px) -----------------------------------
    HUD: {
      SEP_Y: 162, SEP_H: 2,          // black separator rows 162..163
      BG_Y: 164,                     // gray rows 164..209
      SCORE_RIGHT_X: 104,            // units digit occupies x 96..103
      SCORE_Y: 166,                  // digits rows 166..175
      GAUGE_X: 56, GAUGE_Y: 178,     // gauge box 48x14 (x 56..103, y 178..191)
      GAUGE_W: 48, GAUGE_H: 14,
      NOTCH_L_X: 58, NOTCH_R_X: 100, NOTCH_Y: 180,   // 2x2 black notches
      E_X: 61, E_Y: 182,             // 'E' minifont x1
      HALF_X: 75, HALF_Y: 180,       // 'half' glyph 9x9
      F_X: 96, F_Y: 182,             // 'F' minifont x1
      PTR_X0: 58, PTR_RANGE: 42,     // pointer x = 58 + round(fuel01 * 42)
      PTR_Y: 180, PTR_W: 2, PTR_H: 10,
      LIVES_DIGIT_X: 8, LIVES_DIGIT_Y: 180,
      LIVES_ICON_X: 20, LIVES_ICON_Y: 182,
      RAINBOW_X: 24, RAINBOW_Y: 198, RAINBOW_W: 112, // 6 rows y 198..203
      MUTE_X: 148, MUTE_Y: 182       // black 'M' when muted
    },
    RAINBOW: ['RED', 'ORANGE', 'GOLD', 'YELLOW', 'LIGHT_GREEN', 'VIOLET'],

    // --- Title / overlay layout (screen px) -----------------------------------------------
    TITLE_LOGO_X: 10, TITLE_LOGO_Y: 20,     // 'DELTA STRIKE' minifont x3 (141 px wide)
    TITLE_CALL_Y: 100,                      // blinking PRESS ENTER / TAP TO START
    TITLE_HI_Y: 112,                        // 'HI <score>' white
    TITLE_BTN_X: 56, TITLE_BTN_Y: 126,      // touch-only START button 48x16
    TITLE_BTN_W: 48, TITLE_BTN_H: 16,
    TITLE_BTN_TXT_X: 61, TITLE_BTN_TXT_Y: 129,
    PAUSE_TXT_X: 61, PAUSE_TXT_Y: 76,       // 'PAUSE' minifont x2, blinking

    // --- Canonical palette (visual-spec §13; the hex is normative) --------------------------
    PALETTE: {
      BLACK:       '#000000',
      WHITE:       '#F2F2F2',
      HUD_GRAY:    '#ABABAB',
      ROAD_LIGHT:  '#CDCDCD',
      ROAD_DARK:   '#797979',
      YELLOW:      '#FFF456',
      PALE_YELLOW: '#FFFF98',
      GOLD:        '#FFC545',
      MAGENTA:     '#EA51EB',
      RED:         '#B21D17',
      ORANGE:      '#C85F24',
      BROWN:       '#833008',
      DARK_BROWN:  '#451904',
      TRUNK:       '#391701',
      NAVY:        '#0C048B',
      HELI_GREEN:  '#0A4108',
      CYAN:        '#73CFEF',
      SKY:         '#73B6EF',
      VIOLET:      '#7382F7',
      WATER:       '#584FDA',
      GRASS_A:     '#649228',   // banks of even-index sections (0, 2, ...)
      GRASS_B:     '#0C4A1C',   // banks of odd-index sections
      LIGHT_GREEN: '#61D070',
      LIME:        '#B2D241'
    },

    // --- Persistence ------------------------------------------------------------------------
    HISCORE_KEY: 'ds.hiscore',
    MUTED_KEY: 'ds.muted'
  };

  Object.freeze(C.PALETTE);
  Object.freeze(C.HUD);
  Object.freeze(C.RAINBOW);
  for (var i = 0; i < C.DIFFICULTY.length; i++) Object.freeze(C.DIFFICULTY[i]);
  Object.freeze(C.DIFFICULTY);
  Object.freeze(C);
  DS.C = C;

  // --- DS.U: pure utilities -------------------------------------------------
  var U = {};

  U.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.sectionSeed = function (seed, i) {
    return (seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
  };

  U.clamp = function (v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  };

  U.rngInt = function (rng, n) {          // int in [0, n)
    return Math.floor(rng() * n);
  };

  // AABB with CENTER coords + full dims (shrink is applied by the caller)
  U.aabb = function (ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) * 2 < (aw + bw) &&
           Math.abs(ay - by) * 2 < (ah + bh);
  };

  Object.freeze(U);
  DS.U = U;
})();
```

---

## 3. Boot e primeiro gesto (sequência exata)

1. Browser carrega `index.html`; scripts na ordem `constants → sprites → audio → river → entities → game` (cada um só define seu namespace, **nenhum efeito colateral de DOM/áudio no load**).
2. Evento `load` (script inline do index.html): chama `DS.Game.init()` e depois registra `sw.js` (se `serviceWorker in navigator && window.isSecureContext`).
3. `DS.Game.init()` (envolvido em try/catch com `console.error(e); throw e;`):
   1. `seed = parseSeed(location.search)` (§7.2).
   2. Canvas visível `#screen` (`getContext('2d', { alpha: false })`); canvas offscreen 160×210 (`octx`, alpha false, `imageSmoothingEnabled = false`).
   3. `DS.Sprites.init();`
   4. `DS.Audio.init();` — apenas registra listeners de unlock e lê `ds.muted`. **Não cria AudioContext.**
   5. `DS.River.init(seed);`
   6. `DS.Entities.init(hooks);` (hooks §7.3)
   7. `Input.init(canvas);` (submódulo interno do game)
   8. `resize();` + listeners `resize`/`orientationchange` → `resize()`.
   9. Listener `visibilitychange`: se `document.hidden && state === 'playing'` → `togglePause()`.
   10. Configura hints touch (§8.4), `enterTitle()`, `requestAnimationFrame(frame)`.
4. **Primeiro gesto do usuário** (`pointerdown` | `touchend` | `keydown`, listeners do próprio audio.js com `capture: true`): audio.js cria o `AudioContext`, monta a cadeia master, gera o buffer de ruído, `resume()`, marca pronto e remove os 3 listeners. Toda função de som é no-op silencioso antes disso.
5. Start (Enter / clique / touchstart em `title`): `startRun()` → `DS.Audio.uiStart(); DS.Audio.startEngine();` `state = 'playing'`. Como o start em si é um gesto, o áudio sempre está destravado aqui.

---

## 4. `js/sprites.js` — `DS.Sprites` (dono: T2)

### 4.1 API pública (assinaturas exatas)

```js
DS.Sprites.init()
//  Pré-renderiza cada frame de cada sprite (e sua versão espelhada) em canvas
//  offscreen próprios. Chamada 1x por DS.Game.init() antes de qualquer draw.

DS.Sprites.draw(ctx, name, frame, sx, sy, flip)
//  ctx: contexto 2D do offscreen 160x210. name: string da tabela 4.2.
//  frame: int (usar frame % frameCount internamente). sx, sy: TOP-LEFT em px
//  de tela, inteiros (o caller já converteu/arredondou — §1.3).
//  flip: bool opcional (default false) = espelha horizontalmente.

DS.Sprites.size(name)        // -> { w:int, h:int } (frame 0)
DS.Sprites.frameCount(name)  // -> int

DS.Sprites.drawText(ctx, text, x, y, colorKey, scale)
//  Minifonte 3x5. text: string; charset 'A'-'Z','0'-'9',' ','!'.
//  Char fora do charset avança sem desenhar. colorKey: chave de DS.C.PALETTE
//  (default 'YELLOW'). scale: int >= 1 (default 1). Avanço = 4*scale px.
//  x,y = top-left do primeiro glifo.

DS.Sprites.textWidth(text, scale)
//  -> int: (text.length * 4 - 1) * scale   (0 se string vazia)
//  Centralizar: x = (160 - textWidth(t, s)) >> 1.

DS.Sprites.drawBig(ctx, text, x, y)
//  Fonte 8x10 amarela (YELLOW). Charset: '0'-'9' e '!'. Avanço fixo 10 px.
//  Usada só para score e dígito de vidas. Alinhamento à direita é feito pelo
//  caller: x = rightX - text.length * 10.
```

### 4.2 Tabela canônica de sprites (nomes, tamanhos, frames)

Pixels: matrizes **verbatim** do visual-spec (§ indicada). `flip` disponível para todos (pré-renderizar espelho).

| nome | L×A | frames | fonte dos pixels | uso |
|---|---|---|---|---|
| `player` | 14×12 | 1 | VS §7.1 (voo) | jato do jogador (nunca espelha) |
| `playerBoom` | 14×12 | 2 | VS §7.1 (frames A e B) | morte do player |
| `missile` | 2×6 | 1 | VS §7.2 | míssil |
| `heli` | 16×10 | 2 | VS §7.3 | helicóptero (flip quando dir = −1) |
| `ship` | 24×8 | 1 | VS §7.4 | navio (flip quando dir = −1) |
| `jet` | 16×8 | 1 | VS §7.5 | jato inimigo (flip quando dir = −1) |
| `fuel` | 12×24 | 1 | VS §7.6 | depósito (letras vazadas = transparente) |
| `bridge` | 64×16 | 1 | VS §5.3 (linhas 0..15) | ponte intacta |
| `bridgeFire` | 64×16 | 1 | VS §5.3 com trocas C→Y, D→G, G→P | flicker de explosão |
| `explosion` | 16×16 | 3 | VS §7.7 | explosão genérica |
| `debris` | 8×6 | 2 | VS §7.8 | destroços |
| `lifeIcon` | 8×6 | 1 | VS §7.9 | mini-avião do HUD |
| `house` | 20×9 | 1 | VS §5.4 | decoração |
| `tree` | 12×9 | 1 | VS §5.4 | decoração |
| `half` | 9×9 | 1 | VS §8.3 | glifo "½" do medidor |

### 4.3 Legenda letra → chave da paleta (única em todo o arquivo)

`K→BLACK · W→WHITE · H→HUD_GRAY · I→ROAD_LIGHT · J→ROAD_DARK · Y→YELLOW · P→PALE_YELLOW · G→GOLD · M→MAGENTA · R→RED · C→ORANGE · D→BROWN · S→DARK_BROWN · T→TRUNK · N→NAVY · E→HELI_GREEN · A→CYAN · B→SKY · Z→VIOLET · O→WATER · Q→GRASS_A · X→GRASS_B · V→LIGHT_GREEN · L→LIME · '.'→transparente`

**Nunca** usar hex literal em sprites.js: cores só via `DS.C.PALETTE[chave]`.

Adição normativa ao charset da minifonte (não está no VS): glifo `!` =
```
.X.
.X.
.X.
...
.X.
```

### 4.4 Invariantes
- Todos os frames de um sprite têm dimensões idênticas; todas as dimensões da tabela 4.2 são exatas (o resto do jogo depende delas via `size()`).
- `draw` nunca lança para frame fora do range (aplica módulo) nem para coordenadas fora da tela (o clipping do canvas resolve).
- Nenhum desenho com alpha parcial, gradiente ou suavização.
- `drawText`/`drawBig` desenham com `fillRect` por pixel OU canvas pré-renderizado por cor — o resultado por pixel deve ser idêntico.

---

## 5. `js/audio.js` — `DS.Audio` (dono: T3)

Síntese, grafos, envelopes, ganhos e política de vozes: **audio-spec.md na íntegra** (normativo), com os overrides: chave de mute = `DS.C.MUTED_KEY` (`'ds.muted'`), e a API abaixo (que é a do audio-spec §3, ratificada).

### 5.1 API pública (assinaturas exatas)

```js
DS.Audio.init()            // registra listeners de unlock (pointerdown/touchend/keydown,
                           // capture:true) + visibilitychange; lê ds.muted. Idempotente.
DS.Audio.unlock()          // idempotente; cria/resume o AudioContext (chamada pelos
                           // próprios listeners; pode ser chamada por fora sem dano)
DS.Audio.startEngine()     // liga o ronco do motor (singleton; no-op se ligado)
DS.Audio.setEngineSpeed(v) // v float 0..2 (0=freio, 1=cruzeiro, 2=máx); clamp; no-op se desligado
DS.Audio.stopEngine()      // fade 80 ms; no-op se desligado
DS.Audio.shoot()           // tiro (guarda interna de retrigger 50 ms)
DS.Audio.explosionSmall()  // inimigo/depósito destruído
DS.Audio.explosionBig()    // ponte destruída E morte do player
DS.Audio.refuelTick(level01) // 1 blip; level01 = fuel/FUEL_MAX no momento
DS.Audio.lowFuelAlarm(on)  // liga/desliga alarme (singleton; redundância = no-op)
DS.Audio.extraLife()       // jingle 3 notas
DS.Audio.uiStart()         // blip de start
DS.Audio.setMuted(m)       // bool; rampa 15 ms; persiste em DS.C.MUTED_KEY
DS.Audio.isMuted()         // -> bool
DS.Audio.setPaused(p)      // true -> ctx.suspend(); false -> ctx.resume()
```

### 5.2 Invariantes
- **Nenhum** AudioContext antes do primeiro gesto; toda função é no-op silencioso antes do unlock.
- Zero arquivos de áudio, zero rede. Só `square` + ruído branco (buffer 1 s reutilizado).
- Nós nunca vazam (disconnect no `onended`; teto de 8 vozes one-shot).
- `visibilitychange` → visível e não pausado ⇒ `ctx.resume()` (interno).
- audio.js NÃO lê estado do jogo: é 100% dirigido pelas chamadas acima.

### 5.3 Matriz evento → chamada (contrato; quem chama)

| Evento | Chamador | Chamada(s), na ordem |
|---|---|---|
| start no título / game over → run | game | `uiStart()`; `startEngine()` |
| todo tick de `playing` | game | `setEngineSpeed(v)`; `v = speed<=60 ? (speed-30)/30 : 1+(speed-60)/90` |
| míssil efetivamente disparado | entities | `shoot()` |
| navio/heli/jato/depósito destruído por tiro | entities | `explosionSmall()` |
| ponte destruída | entities | `explosionBig()` |
| morte do player (enterDying) | game | `lowFuelAlarm(false)`; `stopEngine()`; `explosionBig()` |
| fim de `respawn` → `playing` | game | `startEngine()` |
| reabastecendo, a cada 6 ticks, se fuel < FUEL_MAX | game | `refuelTick(fuel / FUEL_MAX)` |
| `fuel/FUEL_MAX` cruzou p/ `< 0.25` | game | `lowFuelAlarm(true)` |
| cruzou p/ `>= 0.25` | game | `lowFuelAlarm(false)` |
| score cruzou múltiplo de 10.000 (e < 1.000.000) | game | `extraLife()` |
| P / visibilitychange (pausar) | game | `setPaused(true)` / `setPaused(false)` |
| M | game | `setMuted(!isMuted())` |
| game over (última vida, fim de dying) | game | nada extra (a morte já silenciou tudo) |

---

## 6. `js/river.js` — `DS.River` (dono: T4)

### 6.1 API pública (assinaturas exatas)

```js
DS.River.init(seed)        // uint32; limpa cache, guarda seed. 1x no boot; nunca em startRun.
DS.River.channelAt(worldY) // float ok; clamp p/ >= 0. -> Array de 1 ou 2 intervalos
                           // { xl:int, xr:int } (xl inclusivo, xr exclusivo), ordenados
                           // por xl. ARRAY CACHEADO: o caller NÃO muta nem retém entre ticks.
DS.River.sectionAt(worldY)   // -> int = Math.max(0, Math.floor(worldY / DS.C.SECTION_LEN))
DS.River.sectionStartY(i)    // -> i * DS.C.SECTION_LEN
DS.River.bridgeY(b)          // -> b * DS.C.SECTION_LEN   (b >= 1)
DS.River.spawns(i)           // -> Array de SpawnRecord (cacheado, não mutar), ordenado
                             //    por y crescente; para i >= 1 o primeiro é o 'bridge'.
DS.River.render(ctx, camInt) // desenha playfield completo (linhas 0..161): água, margens,
                             // estrada e decoração. camInt: INTEIRO (game arredondou).
```

### 6.2 Geração determinística (normativa)

- Por seção `i`: `rng = DS.U.mulberry32(DS.U.sectionSeed(seed, i))`, gerada sob demanda e cacheada (`sections[i] = { chunks, spawns, decor }`). Função pura de `(seed, i)` — a ordem de visita não importa.
- `chunks`: array de 150 entradas; cada entrada é `[{xl,xr}]` ou `[{xl,xr},{xl,xr}]` (ilha). `channelAt(worldY)`: `i = sectionAt(y)`, `c = floor((y − i*1200) / 8)`, retorna `sections[i].chunks[c]`.
- **Ordem FIXA de consumo do rng por seção** (qualquer desvio quebra o determinismo): (1) geometria; (2) decoração; (3) depósitos; (4) inimigos; (5) jatos.

#### 6.2.1 Geometria (chunks 0..149)

Invariantes permanentes: `xl`,`xr` múltiplos de 4; largura `xr−xl` múltipla de 8, ∈ `[wMin, wMax]` da seção (exceto zonas forçadas: 64 e rampas); canal dentro de `[8, 152]`; por chunk, cada borda muda 0 ou ±4 px (±8 apenas no caso WIDEN bloqueado abaixo).

- **Chunk 0 e chunk 149:** forçados `{ xl: 48, xr: 112 }` (faixa da ponte). Isso garante continuidade entre seções.
- **Chunks 1..5:** WIDEN centrado +8/chunk: larguras 72, 80, 88, 96, 104 (cx = 80).
- **Chunks 6..11:** reto 104 centrado. (Chunks 0..11 = zona segura sem entidades.)
- **Chunks 12..130:** repetir segmentos até preencher; estado corrente `(cx, w)`:
  1. `r = rngInt(rng, 6 + 3 + 2 + pShift + pIsland)`; tipo por faixas acumuladas na ordem STRAIGHT(6), NARROW(3), WIDEN(2), SHIFT(pShift), ISLAND(pIsland).
  2. Comprimento: `len = 8 + rngInt(rng, 8)`; para ISLAND, `len = 20 + rngInt(rng, 16)`. Truncar para não passar do chunk 130.
  3. SHIFT consome mais 1 roll: `dir = rngInt(rng, 2) ? 1 : −1`.
  4. Efeito por chunk:
     - `STRAIGHT`: nada.
     - `NARROW`: se `w > wMin`: `xl += 4; xr −= 4` (w −8).
     - `WIDEN`: se `w < wMax`: tentar `xl −= 4; xr += 4`; se `xl−4 < 8`, então só `xr += 8` (se `xr+8 ≤ 152`, senão nada); espelhado se `xr+4 > 152`.
     - `SHIFT`: `cx += 4*dir` se ambas as bordas novas couberem em `[8,152]`; senão nada (para o resto do segmento).
     - `ISLAND`: só se `w ≥ 88` no início do segmento (senão o segmento inteiro vira WIDEN). Congela `(cx, w)`. `wiMax = min(w − 56, 48)` (múltiplo de 8; `w−56` já é). Ilha centrada em cx: largura `wi` = 8 no 1º chunk, +8/chunk até `wiMax`, platô, −8/chunk até 8, some. Rampa de descida dimensionada para terminar dentro do `len` (e nunca depois do chunk 130 — truncar platô). Chunk com ilha ⇒ 2 intervalos: `[{xl, cx−wi/2}, {cx+wi/2, xr}]`.
- **Chunks 131..148 (convergência):** por chunk: `cx += 4*sign(80−cx)` se `cx ≠ 80`; `w += 8*sign(64−w)` se `w ≠ 64` (mesmas regras de borda). Por construção converge até o chunk 145 no pior caso; chunks restantes ficam retos 64@80.

#### 6.2.2 Decoração (consumo fixo)

`side = rngInt(rng,2)`; `cursor = 3`. Loop enquanto `cursor ≤ 144`:
1. `t = rngInt(rng, 3)` → 0 árvore, 1 casa, 2 casa+árvore.
2. Colocação no chunk `c = cursor`, lado `side` (0 = esquerda). Largura de referência `w` = 12 (árvore) ou 20 (casa/combo). Bordas d'água conservadoras nos 2 chunks cobertos: esquerda: `L = min(xl(c), xl(c+1))` (do PRIMEIRO intervalo); direita: `R = max(xr(c), xr(c+1))` (do ÚLTIMO intervalo).
   - Esquerda: `ax = L − 8 − w`; válido se `ax ≥ 0`.
   - Direita: `ax = R + 8`; válido se `ax + w ≤ 160`.
   - Inválido ⇒ pula (sem consumir rng extra).
3. Registro `decor`: casa/árvore com **top-left de mundo** `{ sprite:'house'|'tree', x: ax, yTop: c*8 + 8 }` (ocupa linhas de mundo `yTop .. yTop−8`). Combo: casa em `(ax, yTop)` + árvore em `(ax+10, yTop−10)`.
4. `cursor += 8 + rngInt(rng, 8)`; `side ^= 1`.

#### 6.2.3 Depósitos (nFuel; consumo fixo de 3 rolls por k)

Para `k = 0 .. nFuel−1`: alvo base `c0 = 12 + round((k + 0.5) * 119 / nFuel)`.
1. `jit = rngInt(rng,17) − 8`; `c = clamp(c0 + jit, 12, 130)`.
2. `branch = rngInt(rng, 2)` (sempre consumido; usado só se houver 2 intervalos).
3. `roll = rng()` (sempre consumido).
4. Colocação: y = `i*1200 + c*8 + 4`. Intervalo = interseção dos intervalos navegáveis (mesmo ramo, escolhido por `branch`: 0 = primeiro, 1 = último) dos chunks `c−1, c, c+1`. Se `interW = ixr − ixl < 12 + 2*10` → tenta o outro ramo; se também falhar → **pula** este depósito.
5. `maxDev = floor((interW − 12 − 20) / 2)`; `dev = floor(roll * (2*maxDev + 1)) − maxDev`; `x = round((ixl + ixr)/2) + dev`, ajustado ao px.

#### 6.2.4 Inimigos (nEnemy; consumo fixo de 6 rolls por k)

Para `k = 0 .. nEnemy−1`: alvo `c0 = 12 + round((k + 0.5) * 119 / nEnemy)`.
1. `jit = rngInt(rng,17) − 8` → `c = clamp(c0 + jit, 12, 130)`.
2. Gap: enquanto existir registro (fuel ou enemy) com `|chunk − c| < 5`, `c++`; se `c > 130`, marcar como pulado (mas consumir os rolls restantes).
3. `typeBit = rngInt(rng,2)` (0 ship, 1 heli); `moveRoll = rng()`; `dirBit = rngInt(rng,2)`; `branch = rngInt(rng,2)`; `posRoll = rng()`.
4. Intervalo (interseção dos chunks `c−1, c, c+1`, ramo por `branch`, fallback outro ramo). Se tipo ship e `interW < 48` → vira heli. Largura do sprite `sw` (24 ou 16); se `interW < sw + 4` → pula.
5. `maxDev = floor((interW − sw − 4) / 2)`; `dev = floor(posRoll * (2*maxDev+1)) − maxDev`; `x = round((ixl+ixr)/2) + dev`; `y = i*1200 + c*8 + 4`.
6. `moving = moveRoll < (tipo==='heli' ? heliMove : shipMove)`; `dir = dirBit ? 1 : −1`.

#### 6.2.5 Jatos (nJet; 2 rolls por k)

`c0 = 20 + round((k + 0.5) * 100 / nJet)`; `jit = rngInt(rng,11) − 5`; `c = clamp(c0+jit, 20, 120)`; `sideBit = rngInt(rng,2)`; `x = sideBit ? 168 : −8`; `dir = sideBit ? −1 : 1`; `y = i*1200 + c*8 + 4`; `moving = true`.

#### 6.2.6 SpawnRecord (contrato River → Entities)

```js
{
  id:     'sNN-KK',    // NN = índice da seção, KK = índice no array final
  type:   'bridge' | 'ship' | 'heli' | 'jet' | 'fuel',
  x:      int,         // CENTRO em px de mundo (jet: -8 ou 168)
  y:      int,         // CENTRO worldY (bridge: exatamente sectionStartY(i))
  dir:    -1 | 1,      // 1 para fuel/bridge
  moving: bool         // false para fuel/bridge
}
```
Seção `i ≥ 1` tem exatamente 1 `bridge` `{x: 80, y: sectionStartY(i)}`. Array final = ordenado por `y` crescente (bridge naturalmente primeiro); ids atribuídos após ordenar.

### 6.3 `DS.River.render(ctx, camInt)` — algoritmo normativo

```
para sy de 0 a 161:
  w   = camInt - sy                    // linha de mundo (int)
  ivs = channelAt(w)
  cor da terra = (sectionAt(w) % 2 === 0) ? GRASS_A : GRASS_B
  pinta a linha inteira (x 0..159) com a cor da terra
  pinta cada intervalo [xl, xr) com WATER
depois, para cada ponte b >= 1 com faixa visível:
  syTop = camInt - b*SECTION_LEN - 8 + 1        // +1 = regra §1.3 (banda alinha à ponte); linhas syTop .. syTop+15
  para r de 0 a 15 (sy = syTop + r, se 0 <= sy <= 161):
    cor: r==0 ou r==15 -> ROAD_DARK; r==7 -> YELLOW; senão ROAD_LIGHT
    pinta APENAS as partes de terra da linha (x fora dos intervalos de
    channelAt(camInt - sy))
por fim, decoração visível: para cada registro decor com linhas na janela,
  DS.Sprites.draw(ctx, sprite, 0, x, camInt - yTop)
```
Otimização permitida (agrupar linhas do mesmo chunk em fillRects maiores) desde que o resultado por pixel seja idêntico.

### 6.4 Invariantes de River
- `channelAt` SEMPRE retorna ≥1 intervalo; largura de canal único ∈ [32, 120] (nas zonas forçadas, 64..104); cada canal de ilha ≥ 28 px; bordas múltiplas de 4.
- `channelAt(y)` para um mesmo `y` retorna sempre o MESMO conteúdo (cache), em qualquer ordem de chamada, para a mesma seed.
- Chunks 0..11 e 131..149 de toda seção: sem registros de spawn de entidade (exceto o `bridge` no chunk 0 — linha `sectionStartY`).
- Depósitos: o span x `[x−6, x+6)` está em água em TODAS as linhas cobertas (garantido pela interseção de 3 chunks) — invariante exigido pelas letras vazadas do sprite.
- Ships só em intervalos com largura ≥ 48.
- Zero `Math.random()`.

---

## 7. `js/entities.js` — `DS.Entities` (dono: T5) e `js/game.js` — `DS.Game` (dono: T6)

### 7.1 API pública de Entities (assinaturas exatas)

```js
DS.Entities.init(hooks)          // hooks §7.3; guarda referência. 1x no boot.
DS.Entities.startRun(startY)     // zera tudo (enemies, missiles, explosions, debris,
                                 // bridges, pending), nextSection=0, player em
                                 // (80, startY), speed=CRUISE, alive=true.
DS.Entities.respawn(playerY)     // limpa enemies/missiles/explosions/debris e pending;
                                 // bridges (mapa) É PRESERVADO; nextSection =
                                 // sectionAt(playerY); player em (80, playerY),
                                 // speed=CRUISE, alive=true.
DS.Entities.update(dt, input)    // dt = DS.C.DT; input = { steer:-1|0|1,
                                 // throttle:-1|0|1, fire:bool }. Ordem §7.4.
DS.Entities.updateExplosions(dt) // usado em 'dying': avança SÓ animações
                                 // (playerBoom, explosions, debris, flicker de ponte).
DS.Entities.render(ctx, camInt)  // ordem: bridges -> fuel -> ship/heli -> jet ->
                                 // debris -> missiles -> player -> explosions.
                                 // No-op se startRun nunca foi chamada.
DS.Entities.killPlayer(cause)    // 'bank'|'enemy'|'bridge'|'fuel'. Se alive:
                                 // alive=false, boomT=0, remove míssil,
                                 // hooks.onPlayerDeath(cause). Idempotente no tick.
DS.Entities.getPlayer()          // -> { x, y, speed, alive } (referência, leitura)
```

### 7.2 API pública de Game

```js
DS.Game.init()   // §3 (boot). Único ponto de entrada.
// Propriedades de leitura (espelhadas ao fim de cada update):
DS.Game.state    // 'title'|'playing'|'paused'|'dying'|'respawn'|'gameover'
DS.Game.score    // int (congela em 1000000)
DS.Game.lives    // int 0..9 (reservas)
DS.Game.fuel     // float 0..100
DS.Game.cameraY  // float
DS.Game.seed     // uint32
DS.Game.tick     // int
DS.Game.cheat    // { invincible: false } — onPlayerDeath ignora mortes != 'fuel'
```

`parseSeed(search)`: `new URLSearchParams(search).get('seed')`; ausente → `DS.C.DEFAULT_SEED`; `Number(v)` (aceita decimal e `0x…`); não finito → default; senão `>>> 0`.

### 7.3 Hooks (Entities → Game; síncronos, dentro de `Entities.update`)

```js
{
  onScore(points, source),   // source: 'ship'|'heli'|'jet'|'fuel'|'bridge'
  onPlayerDeath(cause),      // game decide (cheat) e chama enterDying(cause)
  onBridgeDestroyed(b),      // int índice da ponte (métrica; checkpoint é derivado)
  onRefuel()                 // chamado A CADA TICK de sobreposição player x depósito vivo
}
```

`onScore` (implementação normativa no game): se score já em `SCORE_MAX`, ignora. `before = score; score = min(SCORE_MAX, score + points);` se `floor(before/10000) < floor(score/10000)` e `score < SCORE_MAX*` (vidas extras param no cap): `lives = min(9, lives+1); DS.Audio.extraLife();`. Se `score === SCORE_MAX` pela primeira vez: persiste hi-score imediatamente. (*regra exata: prêmios são dados por múltiplos cruzados ≤ 990000.)

### 7.4 Ordem do update de Entities (normativa)

`cameraTop = player.y + DS.C.PLAYER_SCREEN_Y`; `cameraBottom = cameraTop − 161`.

1. **Spawning:** enquanto `sectionStartY(nextSection) ≤ cameraTop + SPAWN_AHEAD`: empurra `DS.River.spawns(nextSection)` em `pending` (fila ordenada por y) e `nextSection++`. Instancia todo record de `pending` com `y ≤ cameraTop + SPAWN_AHEAD`; DESCARTA (sem instanciar) records com `y < cameraBottom` ou bridges com `bridges[b].destroyed === true`. Bridge instanciada vira/reusa `bridges[b] = { b, x:80, y, destroyed:false, boomT:-1 }` com `b = y / SECTION_LEN`.
2. **Player:** `x += steer * PLAYER_STEER_SPEED * dt`, clamp `[PLAYER_MIN_X, PLAYER_MAX_X]`. Alvo de velocidade: `throttle > 0 → SPEED_MAX`, `< 0 → SPEED_MIN`, `0 → CRUISE`; aproxima com `PLAYER_ACCEL` (subindo) / `PLAYER_DECEL` (descendo), sem overshoot. `y += speed * dt`.
3. **Tiro:** `fireCooldown −= dt`. Se `input.fire && fireCooldown ≤ 0 && missiles.length < MISSILE_MAX_ONSCREEN`: cria míssil `{ x: player.x, y: player.y + 9 }`, `fireCooldown = FIRE_COOLDOWN`, `DS.Audio.shoot()`.
4. **Mísseis:** `y += (MISSILE_SPEED + player.speed) * dt; x += steer * PLAYER_STEER_SPEED * dt` (míssil guiado). Remove quando sai pelo topo: `y > cameraTop + 8`. Terreno NÃO remove míssil (R4).
5. **Inimigos:** ship/heli com `moving`: `x += dir * SPEED_tipo * speedMult * dt`; nos limites do intervalo navegável do seu y (constante!): se `x − w/2 < xl + 2` ⇒ `dir = 1`; se `x + w/2 > xr − 2` ⇒ `dir = −1` (com clamp). `speedMult = DIFFICULTY[min(sectionAt(y),7)].speedMult`. Heli avança `animT`. Jet: `x += dir * JET_SPEED * speedMult * dt`, ignora rio; remove se `x < −10 || x > 170`. Fuel: estático.
6. **Culling:** entidade com `y < cameraBottom − CULL_BEHIND` é removida (não re-arma).
7. **Colisões:**
   - Míssil (2×6 cheio) × inimigo/depósito (AABB do sprite − 1 px por lado): remove ambos, cria explosões (tabela §7.5), `DS.Audio.explosionSmall()`, `hooks.onScore(SCORE_tipo, tipo)`.
   - Míssil × ponte não destruída (64×16 − 1): `destroyed = true; boomT = 0`, `DS.Audio.explosionBig()`, `hooks.onScore(SCORE_BRIDGE,'bridge')`, `hooks.onBridgeDestroyed(b)`, remove míssil, agenda 4 explosões (§7.5).
   - Player (hitbox 12×10) × ship/heli/jet: inimigo explode (como acima, SEM pontos) e `killPlayer('enemy')`.
   - Player × ponte não destruída: `killPlayer('bridge')`.
   - Player × depósito vivo: NÃO mata; `hooks.onRefuel()` neste tick.
   - Player × margens: 3 linhas de mundo `player.y − 5`, `player.y`, `player.y + 5`; em cada uma, seguro sse EXISTE intervalo com `xl ≤ player.x − 6` e `player.x + 6 ≤ xr`; qualquer linha insegura ⇒ `killPlayer('bank')`.
8. **Animações:** explosões `t += dt` (remove após 24 ticks ⇒ vira 1 registro de debris no mesmo centro, exceto explosões de ponte, ver §7.5); debris `t += dt` (remove após 60 ticks); `boomT` da ponte avança até 32 e para.

### 7.5 Explosões e destroços (posições normativas, coords de MUNDO)

| Alvo | Explosões (centros) | Debris subsequente (centros) |
|---|---|---|
| heli / jet | 1 × no centro da entidade | 1 × no mesmo centro |
| ship | 2 × em `(x−4, y+2)` e `(x+4, y+2)` | 1 × em `(x, y)` |
| fuel | 2 × em `(x, y+4)` e `(x, y−4)` | 1 × em `(x, y)` |
| bridge | 4 × em `(56, y)`, `(72, y)`, `(88, y)`, `(104, y)` | 2 × em `(48, y)` e `(112, y)` |
| player | usa `playerBoom` (2 frames alternando a cada 4 ticks, 48 ticks) — sem debris |

Render da ponte: `!destroyed` → sprite `bridge`; `destroyed && boomT < 32` → alterna `bridge`/`bridgeFire` a cada 4 ticks; `destroyed && boomT ≥ 32` → nada (a água aparece).

### 7.6 Máquina de estados e HUD (game.js)

Estados: `'title' | 'playing' | 'paused' | 'dying' | 'respawn' | 'gameover'`.

| Estado | update | render (sempre no octx; blit no fim) |
|---|---|---|
| `title` | edges (start → `startRun()`, M) | `River.render(octx, TITLE_CAMERA_Y)`; logo `DELTA STRIKE` drawText ×3 YELLOW em (10,20); chamada blink 30/30 em y=100 (`TAP TO START` se touch, senão `PRESS ENTER`, ×1 YELLOW centrada); `HI <hiscore>` ×1 WHITE centrada y=112 (hiscore ≥ 1000000 → `HI !!!!!!`); botão START (só touch): rect preto 48×16 (56,126) + borda branca 1 px + `START` ×2 YELLOW (61,129); HUD com score 0, vidas 3, fuel cheio |
| `playing` | §7.7 | `River.render(octx, camInt)` → `Entities.render(octx, camInt)` → HUD |
| `paused` | edges (P/start → volta; M) | mesmo frame de playing (redesenha com câmera congelada) + `PAUSE` ×2 YELLOW (61,76) blink 30/30 |
| `dying` | `Entities.updateExplosions(DT)`; `stateTimer--`; ao zerar: `lives > 0 ? (lives--, enterRespawn()) : enterGameOver()` | igual playing (mundo congelado, boom anima) |
| `respawn` | `stateTimer--`; ao zerar → `playing` + `DS.Audio.startEngine()` | mundo já no checkpoint, player visível, sem texto |
| `gameover` | `stateTimer--` (delay de input); start após delay → `enterTitle()` | frame congelado; HUD com dígito de vidas 0 e SCORE PISCANDO 30/30; sem texto extra |

Transições (funções privadas): `enterTitle()`, `startRun()` (score=0, lives=3, fuel=100, `Entities.startRun(PLAYER_START_Y)`, `uiStart()`, `startEngine()`), `enterDying(cause)` (stateTimer=DYING_TICKS; `lowFuelAlarm(false)`; `stopEngine()`; `explosionBig()`), `enterRespawn()` (fuel=100; `checkpointY = sectionStartY(sectionAt(player.y))`; `Entities.respawn(checkpointY + RESPAWN_OFFSET)`; cameraY recalculada; stateTimer=RESPAWN_TICKS), `enterGameOver()` (stateTimer=GAMEOVER_INPUT_DELAY_TICKS; persiste hi-score), `togglePause()` (playing⇄paused; `Audio.setPaused(bool)`).

**renderHUD(octx)** (ordem e coords de `DS.C.HUD`):
1. fillRect BLACK x0..159 y162..163; fillRect HUD_GRAY x0..159 y164..209.
2. Score: `drawBig` YELLOW, sem zeros à esquerda (score 0 exibe `0`), alinhado à direita: `x = 104 − txt.length*10`, y=166. Score ≥ 1000000 ⇒ txt = `'!!!!!!'`. No gameover, desenhar só nos semiciclos visíveis do blink.
3. Medidor: fillRect BLACK 48×14 em (56,178); fillRect HUD_GRAY 44×10 em (58,180); notches BLACK 2×2 em (58,180) e (100,180); `E` drawText BLACK (61,182); sprite `half` (75,180); `F` drawText BLACK (96,182); ponteiro fillRect YELLOW 2×10 em `(58 + Math.round(fuel/100*42), 180)`.
4. Vidas: `drawBig` do dígito (string de `lives`) em (8,180); sprite `lifeIcon` em (20,182).
5. Faixa: 6 fillRects 112×1 em x=24, y=198..203, cores `DS.C.RAINBOW` (RED, ORANGE, GOLD, YELLOW, LIGHT_GREEN, VIOLET).
6. Se `DS.Audio.isMuted()`: `M` drawText BLACK (148,182).

### 7.7 Update de `playing` (ordem normativa)

```
1. input = Input.poll()
2. edges: pausePressed -> togglePause(); mutePressed -> Audio.setMuted(!isMuted())
3. DS.Entities.update(DT, input)     // pode disparar onPlayerDeath -> enterDying
4. se state ainda 'playing': cameraY = getPlayer().y + PLAYER_SCREEN_Y
5. fuel -= FUEL_DRAIN_PER_S * DT     // dreno constante (após o refuel do passo 3)
6. se fuel <= 0: fuel = 0; DS.Entities.killPlayer('fuel')
7. áudio: setEngineSpeed(v);
   refuel: se refuelingThisTick && fuel < FUEL_MAX && (tick % REFUEL_TICK_PERIOD === 0):
     refuelTick(fuel / FUEL_MAX)
   lowFuel: bordas de (fuel/FUEL_MAX < 0.25) -> lowFuelAlarm(true/false)
8. tick++; espelha DS.Game.*; refuelingThisTick = false
```

### 7.8 Input (submódulo interno de game.js)

`Input.init(canvas)` instala listeners; `Input.poll()` → `{ steer: -1|0|1, throttle: -1|0|1, fire: bool, startPressed: bool, pausePressed: bool, mutePressed: bool }` — os `*Pressed` são edge-triggered e consumidos pelo poll.

- **Teclado** (`e.code`, listeners em window; `preventDefault()` em setas/Space/Enter; ignorar `e.repeat` nos edges): ArrowLeft/Right → steer (ambas seguradas ⇒ 0); ArrowUp/Down → throttle (+1/−1; ambas ⇒ −1); Space → fire; Enter → startPressed; KeyP → pausePressed; KeyM → mutePressed.
- **Touch** (listeners `{passive:false}` + `preventDefault()`):
  - Cantos (apenas `playing`/`paused`, testados no touchstart em coords LÓGICAS via bounding rect do canvas): top-left 24×24 ⇒ mutePressed; top-right 24×24 ⇒ pausePressed. Esses toques não viram direção/fogo.
  - Zona de direção: toque iniciado com `clientX < innerWidth * 0.6`; o primeiro vira joystick (guarda `x0,y0`); `dx = x−x0`, `dy = y−y0` px CSS; steer = −1 se `dx ≤ −10`, +1 se `dx ≥ 10`, senão 0; throttle = +1 se `dy ≤ −24`, −1 se `dy ≥ +24`, senão 0. touchend/cancel zera. Toques extras na zona são ignorados.
  - Zona de fogo: ≥1 toque ativo iniciado com `clientX ≥ innerWidth * 0.6` ⇒ fire = true.
  - Qualquer touchstart ⇒ startPressed (consumido só em title/paused/gameover).
  - `mousedown` no canvas ⇒ startPressed.
- Start* = `startPressed` (Enter, clique ou touch).

### 7.9 Invariantes de Entities/Game
- Nenhum `Math.random()`; variantes vêm dos SpawnRecords ⇒ mesma seed + mesmos inputs = partida idêntica.
- `bridges` sobrevive a `respawn` (pontes destruídas ficam destruídas); TODO o resto re-arma a partir dos spawns cacheados.
- Remoção de arrays por swap-remove; sem alocações desnecessárias por tick.
- `killPlayer` idempotente por tick; morte por fuel só no passo 6 do game.
- Zona segura (chunks 0..11) garante respawn sem morte injusta; sem invulnerabilidade.

---

## 8. Shell — `index.html`, `style.css`, `manifest.webmanifest`, `sw.js`, ícones (dono: T1)

### 8.1 `index.html` (esqueleto exato)

O da architecture §15.1, com UMA adição: a linha de dica de teclado. Corpo final:

```html
<body>
  <canvas id="screen" width="160" height="210"></canvas>
  <div id="hint-left"  class="hint">DRAG TO STEER</div>
  <div id="hint-right" class="hint">TAP TO FIRE</div>
  <div id="hint-keys">&#8592;&#8594; steer &middot; &#8593;&#8595; speed &middot; SPACE fire &middot; ENTER start &middot; P pause &middot; M mute</div>

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
```

Head: exatamente o da architecture §15.1 (charset, viewport com `viewport-fit=cover, user-scalable=no`, theme-color preto, meta PWA Apple, título `DELTA STRIKE`, manifest, ícone `icons/icon-192.png`, apple-touch-icon, stylesheet). Nada mais.

- Visibilidade dos hints: **JS do game** (não do shell): touch ⇒ mostra hint-left/right na 1ª entrada em playing (esconde no 1º gesto ou 6 s) e esconde `#hint-keys`; sem touch ⇒ hint-left/right `display:none` e `#hint-keys` visível. T1 só entrega os elementos e o CSS.

### 8.2 `style.css` — o da architecture §15.2 MAIS:

```css
#hint-keys {
  position: fixed; bottom: 4px; left: 0; width: 100%;
  text-align: center; font: 12px monospace; color: #666666;
  pointer-events: none;
}
```

### 8.3 `manifest.webmanifest` e `sw.js`

Verbatim da architecture §13.1 e §13.2 (cache `delta-strike-v1`, cache-first com `ignoreSearch: true`, skipWaiting + clients.claim). A lista `ASSETS` é exatamente a do §13.2 — **não** incluir `tools/`, `docs/`, `sw.js`.

### 8.4 `tools/make_icons.py` + `icons/*.png`

Receita visual do visual-spec §12 com o gerador PNG stdlib da architecture §14 e cores da paleta final: fundo integral `WATER #584FDA`; colunas laterais `GRASS_A #649228` de largura `size // 5` coladas às bordas; sprite do player (matriz 14×12 do VS §7.1, cor `YELLOW #FFF456`) escalado nearest-neighbor ×8 (192) / ×24 (512), centrado. Código completo em `build-tasks.md` T1. Rodar 1× e commitar `icons/icon-192.png` e `icons/icon-512.png`.

---

## 9. Tabela-resumo de contratos públicos

| Símbolo | Assinatura | Arquivo |
|---|---|---|
| `DS.C` | objeto congelado (§2) | constants.js |
| `DS.U.mulberry32 / sectionSeed / clamp / rngInt / aabb` | §2 | constants.js |
| `DS.Sprites.init / draw / size / frameCount / drawText / textWidth / drawBig` | §4.1 | sprites.js |
| `DS.Audio.init / unlock / startEngine / setEngineSpeed / stopEngine / shoot / explosionSmall / explosionBig / refuelTick / lowFuelAlarm / extraLife / uiStart / setMuted / isMuted / setPaused` | §5.1 | audio.js |
| `DS.River.init / channelAt / sectionAt / sectionStartY / bridgeY / spawns / render` | §6.1 | river.js |
| `DS.Entities.init / startRun / respawn / update / updateExplosions / render / killPlayer / getPlayer` | §7.1 | entities.js |
| `DS.Game.init` + propriedades `state/score/lives/fuel/cameraY/seed/tick/cheat` | §7.2 | game.js |

Módulo só referencia módulos ANTERIORES na ordem de carga; `game.js` conhece todos; `entities.js` usa `C, U, Sprites, Audio, River`; `river.js` usa `C, U, Sprites`; `audio.js` usa `C`; `sprites.js` usa `C`.
