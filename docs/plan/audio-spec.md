# DELTA STRIKE — Especificação de Áudio (js/audio.js)

Documento de planejamento. Idioma: pt-BR. Identificadores de código: inglês.
Escopo: 100% do áudio do jogo. O implementador NÃO deve tomar nenhuma decisão de
design ao codificar este documento — todos os números estão fechados.

---

## 1. Princípios e referência sonora

O alvo estético é a sonoridade do chip **TIA do Atari 2600** conforme usada em
River Raid (Activision, 1982), reproduzida com síntese própria em **Web Audio API**.
Fatos de referência do original que moldam esta spec (absorvidos e reescritos,
nada copiado):

- O TIA tem **apenas 2 canais** de áudio, cada um com onda quadrada/"poly noise"
  (LFSR), divisor de frequência de poucos bits e volume em 16 degraus. Resultado:
  timbres ásperos, pitch "em degraus", sem suavidade analógica.
- River Raid **não tem música** — só efeitos. O motor é um **ronco grave contínuo**
  cujo pitch acompanha a velocidade (freio = mais grave, acelerado = mais agudo).
- O tiro é um "tsiu" curtíssimo com pitch caindo. **Só existe 1 míssil do jogador
  na tela por vez** (limite de hardware do original que o game design mantém);
  logo a cadência real do som de tiro é limitada pelo jogo (~4–6/s), não pelo áudio.
- Explosões são rajadas de ruído com decaimento; a da **ponte** (e a morte do
  jogador) é mais longa e mais grave que a de inimigos.
- O reabastecimento emite um **bipe repetido ("glug-glug") cujo pitch sobe**
  conforme o tanque enche, e cessa ao sair do depósito ou encher.
- **Vida extra a cada 10.000 pontos.**
- O original **não tinha alarme audível de combustível baixo** (o jogador olhava o
  medidor). O Delta Strike ADICIONA esse alarme deliberadamente, como concessão de
  usabilidade (tela pequena de celular), em volume baixo para não quebrar a estética.
  Esta é uma decisão fechada, não rediscutir na implementação.

Regras gerais de fidelidade adotadas:

1. **Somente síntese em runtime.** Zero arquivos de áudio, zero fetch, zero CDN.
2. **Ondas quadradas + ruído branco filtrado** como únicos timbres. Proibido usar
   `sine`/`triangle`/`sawtooth` exceto onde esta spec mandar explicitamente
   (nenhum som usa; o LFO do alarme e do motor é `square` também).
3. **Sem reverb, sem delay, sem stereo panning.** TIA era mono e seco. Todo o
   grafo é mono até o destino.
4. Envelopes curtos e "duros" (ataques de 3–8 ms), decaimentos exponenciais.

---

## 2. Arquitetura geral

### 2.1 Contexto e desbloqueio (obrigatório para mobile)

- **Um único `AudioContext`** para todo o jogo, criado com
  `new AudioContext({ latencyHint: 'interactive' })` (com fallback
  `webkitAudioContext` para Safari antigo).
- O contexto **não** é criado no load. `DS.Audio.init()` (chamada única, no boot,
  a partir de `game.js`) apenas registra listeners de desbloqueio em `window`,
  com `capture: true`: eventos `pointerdown`, `touchend` e `keydown`.
- No **primeiro gesto** do usuário: criar o contexto, montar a cadeia master
  (§2.2), gerar o buffer de ruído (§2.3), chamar `ctx.resume()` se
  `ctx.state === 'suspended'`, marcar `_ready = true` e remover os três listeners.
- **Toda função pública de som é no-op silencioso enquanto `_ready === false`**
  (retorna sem erro). Como iniciar a partida exige Enter/toque, o motor sempre
  encontrará o contexto pronto.
- Listener adicional permanente em `document.visibilitychange`: ao voltar a ficar
  visível e o jogo NÃO estiver pausado, chamar `ctx.resume()`.

### 2.2 Cadeia master

```
[todas as vozes] → sfxBus (GainNode, gain = 1.0)
                 → compressor (DynamicsCompressorNode)
                 → muteGain (GainNode, gain = 1.0 | 0.0)
                 → masterGain (GainNode, gain = 0.5)
                 → ctx.destination
```

| Nó           | Parâmetro   | Valor fixo |
|--------------|-------------|-----------|
| `sfxBus`     | gain        | 1.0 (nunca automatizado) |
| `compressor` | threshold   | −12 dB |
| `compressor` | knee        | 20 |
| `compressor` | ratio       | 6 |
| `compressor` | attack      | 0.003 s |
| `compressor` | release     | 0.25 s |
| `muteGain`   | gain        | 1.0 (unmuted) / 0.0 (muted) |
| `masterGain` | gain        | **0.5** (teto do mix; nunca automatizado) |

O compressor existe para o pior caso (motor + alarme + explosão grande + jingle
simultâneos) não clipar. Não é efeito estético; com os ganhos desta spec ele age
raramente.

### 2.3 Buffer de ruído (gerado uma vez, reutilizado sempre)

- Criado logo após o contexto, em `init`/unlock:
  `ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate)` — **1 segundo, mono**.
- Preenchido com `data[i] = Math.random() * 2 - 1` para todo `i`.
- Guardado em variável privada `noiseBuffer` e **reutilizado por todos** os sons
  de ruído. Cada disparo cria um novo `AudioBufferSourceNode` apontando para o
  mesmo buffer, sempre com `loop = true` e `start(t0)` (offset 0). O fim do som é
  sempre por `stop()` explícito, nunca pelo fim do buffer.

### 2.4 Política de vozes

| Grupo | Sons | Política |
|-------|------|----------|
| Motor | ENGINE | **Singleton.** Um único conjunto de nós, criado em `startEngine()` e destruído em `stopEngine()`. Chamar `startEngine()` com motor já ligado é no-op. |
| Singletons retrigáveis | REFUEL (blip), FUEL BAIXO (alarme) | Uma voz por tipo. Novo trigger **corta** a voz anterior (cancel + gain 0 + stop) antes de criar a nova. O alarme é ligado/desligado, não retrigado por blip. |
| Polifônicos (one-shots) | SHOT, EXPLOSION_SMALL, EXPLOSION_BIG, EXTRA_LIFE, UI_START | Cada trigger cria vozes novas independentes. **Teto de 8 vozes one-shot simultâneas**: mantidas em um array; ao estourar o teto, a voz mais antiga é morta imediatamente (`cancelScheduledValues(now)`, `gain.setValueAtTime(0, now)`, `stop(now + 0.001)`). |

Higiene obrigatória de toda voz one-shot: registrar `source.onended` (ou o
`onended` do oscilador principal) para `disconnect()` de todos os nós da voz e
removê-la do array de vozes ativas. Nenhum nó pode vazar.

### 2.5 Regras de agendamento (valem para TODOS os sons)

- Todo agendamento usa `t0 = ctx.currentTime` capturado uma única vez no início
  do trigger; os tempos abaixo são **relativos a t0** (em segundos).
- Envelopes **nunca** usam `setTimeout`; só a API de automação
  (`setValueAtTime` / `linearRampToValueAtTime` / `exponentialRampToValueAtTime`
  / `setTargetAtTime`). `setTimeout` é permitido apenas para limpeza redundante.
- `exponentialRampToValueAtTime` não aceita 0: decaimentos exponenciais terminam
  em **0.001** seguido de `setValueAtTime(0, mesmoInstante)`.
- Todo ganho de voz começa com `gain.setValueAtTime(0, t0)` antes do ataque
  (evita clique).
- Todo oscilador/fonte é finalizado com `stop(t0 + duraçãoTotal)` explícito.

### 2.6 Ganhos relativos do mix (pico de cada voz, antes do master 0.5)

| Som | Pico de ganho |
|-----|---------------|
| ENGINE (bus composto) | 0.22 (±0.03 do LFO) |
| SHOT | 0.30 |
| EXPLOSION_SMALL | 0.50 |
| EXPLOSION_BIG (ruído) | 0.60 |
| EXPLOSION_BIG (corpo 60 Hz) | 0.35 |
| REFUEL (blip) | 0.22 |
| FUEL BAIXO (alarme) | 0.18 |
| EXTRA_LIFE (cada nota) | 0.25 |
| UI_START | 0.20 |

---

## 3. API pública (contrato de `DS.Audio`)

Objeto global `DS.Audio` (namespace `DS` já criado em `constants.js`).
Todas as funções são seguras de chamar a qualquer momento (no-op se `!_ready`).

| Função | Assinatura | Semântica |
|--------|-----------|-----------|
| `init` | `init()` | Idempotente. Registra listeners de desbloqueio (§2.1) e lê o estado de mute persistido (§3.1). Chamada uma vez no boot por `game.js`. |
| `startEngine` | `startEngine()` | Liga o loop do motor (§4). No-op se já ligado. |
| `setEngineSpeed` | `setEngineSpeed(v)` | `v` ∈ [0..2] (0 = freio, 1 = cruzeiro, 2 = máximo). Clampa e atualiza o pitch do motor (§4.3). No-op se motor desligado. |
| `stopEngine` | `stopEngine()` | Desliga o motor com fade de 80 ms (§4.4). |
| `shoot` | `shoot()` | One-shot do tiro (§5). |
| `explosionSmall` | `explosionSmall()` | One-shot da explosão pequena (§6). |
| `explosionBig` | `explosionBig()` | One-shot da explosão grande (§7). |
| `refuelTick` | `refuelTick(level01)` | `level01` ∈ [0..1] = nível atual do tanque. Emite um blip (§8). Chamada pelo jogo a cada 100 ms enquanto reabastece. |
| `lowFuelAlarm` | `lowFuelAlarm(on)` | `true` liga o alarme intermitente (singleton), `false` desliga (§9). Chamadas redundantes são no-op. |
| `extraLife` | `extraLife()` | Jingle de 3 notas (§10). |
| `uiStart` | `uiStart()` | Blip de confirmação do start (§11). |
| `setMuted` | `setMuted(bool)` | Alterna `muteGain` 1↔0 com rampa linear de 15 ms; persiste (§3.1). |
| `setPaused` | `setPaused(bool)` | `true` → `ctx.suspend()`; `false` → `ctx.resume()`. Congela TUDO (motor, alarme, agendamentos) sem perder estado — é o mecanismo oficial da pausa (tecla P). |

Estado interno mínimo: `_ready`, `_muted`, `_engine` (objeto com os nós ou
`null`), `_refuelVoice`, `_alarm` (nós ou `null`), `_voices` (array de one-shots).

### 3.1 Persistência de mute

- Chave `localStorage`: `"ds_muted"`, valores `"1"` / `"0"`.
- Lida em `init()`; aplicada ao criar `muteGain` no unlock.
- Gravada em toda chamada de `setMuted`. Falha de `localStorage` (modo privado)
  é engolida com try/catch — o mute funciona só em memória.

### 3.2 Matriz evento-do-jogo → chamada de áudio (contrato com `game.js`)

| Evento no jogo | Chamada(s), nesta ordem |
|----------------|------------------------|
| Tela de título → start (Enter/botão touch) | `uiStart()`; `startEngine()` |
| Velocidade do jogador mudou (a cada frame, só se mudou) | `setEngineSpeed(v)` |
| Tiro efetivamente disparado (respeitando 1 míssil na tela) | `shoot()` |
| Inimigo (navio/heli/jato) ou depósito destruído por tiro | `explosionSmall()` |
| Ponte destruída | `explosionBig()` |
| Morte do jogador (colisão ou fuel 0) | `lowFuelAlarm(false)`; `stopEngine()`; `explosionBig()` |
| Respawn após morte (com vidas restantes) | `startEngine()` (o jogo reavalia e religa o alarme se ainda `fuel01 < 0.25`) |
| Sobre depósito, tanque enchendo — a cada **100 ms** | `refuelTick(fuel01)` |
| `fuel01` cruzou para **< 0.25** | `lowFuelAlarm(true)` |
| `fuel01` cruzou para **≥ 0.25** (reabasteceu) | `lowFuelAlarm(false)` |
| Score cruzou múltiplo de 10.000 (vida extra) | `extraLife()` |
| Tecla P / perda de foco com jogo ativo | `setPaused(true)` / `setPaused(false)` |
| Tecla M / botão mute | `setMuted(!muted)` |
| Game over (última vida) | `lowFuelAlarm(false)`; `stopEngine()`; `explosionBig()` |

Nota: quando a ponte explode e ao mesmo tempo o score cruza 10.000,
`explosionBig()` e `extraLife()` tocam sobrepostos — comportamento desejado
(vozes polifônicas).

---

## 4. ENGINE — ronco contínuo do motor

Singleton em loop. Liga no start, morre na morte; congela na pausa via
`setPaused`. É a "cama" sonora permanente do jogo.

### 4.1 Grafo de nós

```
oscA (square, f)      → gA (1.0)  ─┐
oscB (square, 2·f)    → gB (0.5)  ─┼→ engineBus (0.22) → sfxBus
noise (buffer, loop)  → bp → gN (0.25) ─┘        ↑
lfo (square, 27 Hz) → lfoDepth (0.03) ───────────┘ (conectado a engineBus.gain)
```

### 4.2 Parâmetros

| Nó | Tipo | Parâmetro | Valor |
|----|------|-----------|-------|
| `oscA` | OscillatorNode | type | `'square'` |
| `oscA` | | frequency | `f(v)` — ver §4.3; inicial `f(1) = 65 Hz` |
| `oscB` | OscillatorNode | type | `'square'` |
| `oscB` | | frequency | sempre `2·f(v)`; inicial 130 Hz (garante audibilidade do ronco em alto-falante de celular, que não reproduz 40 Hz) |
| `gA` | GainNode | gain | 1.0 fixo |
| `gB` | GainNode | gain | 0.5 fixo |
| `noise` | AudioBufferSourceNode | buffer / loop | `noiseBuffer` / `true` |
| `bp` | BiquadFilterNode | type / frequency / Q | `'bandpass'` / 400 Hz / 0.5 (fixos) |
| `gN` | GainNode | gain | 0.25 fixo |
| `engineBus` | GainNode | gain | alvo 0.22 (com fade-in/out, §4.4) |
| `lfo` | OscillatorNode | type / frequency | `'square'` / 27 Hz (fixo — "granulado" TIA por modulação de amplitude) |
| `lfoDepth` | GainNode | gain | 0.03 fixo (`lfo → lfoDepth → engineBus.gain`; o ganho do bus oscila 0.19–0.25) |

### 4.3 Mapa velocidade → frequência

`f(v) = 40 + 25 · clamp(v, 0, 2)` Hz, com o alvo **arredondado para inteiro**
(quantização que imita os degraus de pitch do TIA):

| v | Estado | `oscA` | `oscB` |
|---|--------|--------|--------|
| 0.0 | freando | 40 Hz | 80 Hz |
| 1.0 | cruzeiro | 65 Hz | 130 Hz |
| 2.0 | acelerado | 90 Hz | 180 Hz |

Aplicação em `setEngineSpeed(v)` — glide curto, sem clique e sem portamento
"analógico" longo:

```
oscA.frequency.setTargetAtTime(round(f), now, 0.06)
oscB.frequency.setTargetAtTime(round(f) * 2, now, 0.06)
```

`v` intermediário é permitido (o jogo pode interpolar aceleração); a fórmula é
contínua.

### 4.4 Ciclo de vida

- **`startEngine()`**: se `_engine != null`, retorna. Cria todos os nós, chama
  `start(now)` em `oscA`, `oscB`, `noise`, `lfo`; envelope de entrada:
  `engineBus.gain.setValueAtTime(0, now)` →
  `linearRampToValueAtTime(0.22, now + 0.12)`.
- **`stopEngine()`**: se `_engine == null`, retorna. Envelope de saída:
  `cancelScheduledValues(now)` → `setValueAtTime(valor atual, now)` →
  `linearRampToValueAtTime(0, now + 0.08)`; `stop(now + 0.1)` nas quatro fontes;
  `disconnect()` de tudo no `onended` de `oscA`; `_engine = null`.
- **Pausa**: nada específico do motor — `setPaused(true)` suspende o contexto.
- Duração: infinita (até `stopEngine`). O ruído usa `loop = true`, então o
  buffer de 1 s nunca acaba.

---

## 5. SHOT — tiro ("tsiu")

One-shot polifônico (na prática quase mono, pois o jogo só permite 1 míssil na
tela; o áudio ainda assim impõe um guarda de retrigger mínimo de **50 ms**:
chamadas de `shoot()` com menos de 50 ms desde a anterior são ignoradas).

### 5.1 Grafo

```
osc (square) → g → sfxBus
```

### 5.2 Parâmetros e automação (t0 = ctx.currentTime)

| Nó | Parâmetro | Valor inicial |
|----|-----------|---------------|
| `osc` | type | `'square'` |
| `osc` | frequency | 1400 Hz em t0 |
| `g` | gain | 0 em t0 |

| Tempo (rel. t0) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | osc.frequency | setValueAtTime | 1400 |
| +0.090 | osc.frequency | exponentialRampToValueAtTime | 400 |
| 0 | g.gain | setValueAtTime | 0 |
| +0.005 | g.gain | linearRampToValueAtTime | 0.30 |
| +0.090 | g.gain | exponentialRampToValueAtTime | 0.001 |
| +0.090 | g.gain | setValueAtTime | 0 |

- `osc.start(t0)`, `osc.stop(t0 + 0.10)`.
- **Duração total: 100 ms.**

---

## 6. EXPLOSION_SMALL — inimigo/depósito destruído

One-shot polifônico. Rajada de ruído com o filtro fechando (o "puff" TIA).

### 6.1 Grafo

```
noiseSrc (buffer, loop) → lp (lowpass) → g → sfxBus
```

### 6.2 Parâmetros e automação

| Nó | Parâmetro | Valor inicial |
|----|-----------|---------------|
| `noiseSrc` | buffer / loop | `noiseBuffer` / `true` |
| `lp` | type / Q | `'lowpass'` / 0.7 |
| `lp` | frequency | 800 Hz em t0 |
| `g` | gain | 0 em t0 |

| Tempo (rel. t0) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | lp.frequency | setValueAtTime | 800 |
| +0.350 | lp.frequency | exponentialRampToValueAtTime | 200 |
| 0 | g.gain | setValueAtTime | 0 |
| +0.005 | g.gain | linearRampToValueAtTime | 0.50 |
| +0.350 | g.gain | exponentialRampToValueAtTime | 0.001 |
| +0.350 | g.gain | setValueAtTime | 0 |

- `noiseSrc.start(t0)`, `noiseSrc.stop(t0 + 0.40)`.
- **Duração total: 400 ms** (decay audível de 350 ms).

---

## 7. EXPLOSION_BIG — ponte destruída e morte do jogador

One-shot polifônico. Duas camadas somadas: ruído longo e grave + "corpo" de onda
quadrada subgrave com pitch caindo (dá o peso que o ruído sozinho não tem).

### 7.1 Grafo

```
noiseSrc (buffer, loop) → lp (lowpass) → gNoise ─┐
body (square)           → gBody         ─┼→ sfxBus
```

### 7.2 Camada de ruído

| Nó | Parâmetro | Valor inicial |
|----|-----------|---------------|
| `noiseSrc` | buffer / loop | `noiseBuffer` / `true` |
| `lp` | type / Q | `'lowpass'` / 0.7 |
| `lp` | frequency | 600 Hz em t0 |
| `gNoise` | gain | 0 em t0 |

| Tempo (rel. t0) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | lp.frequency | setValueAtTime | 600 |
| +0.700 | lp.frequency | exponentialRampToValueAtTime | 100 |
| 0 | gNoise.gain | setValueAtTime | 0 |
| +0.008 | gNoise.gain | linearRampToValueAtTime | 0.60 |
| +0.700 | gNoise.gain | exponentialRampToValueAtTime | 0.001 |
| +0.700 | gNoise.gain | setValueAtTime | 0 |

- `noiseSrc.start(t0)`, `noiseSrc.stop(t0 + 0.75)`.

### 7.3 Camada de corpo

| Nó | Parâmetro | Valor inicial |
|----|-----------|---------------|
| `body` | type | `'square'` |
| `body` | frequency | 60 Hz em t0 |
| `gBody` | gain | 0 em t0 |

| Tempo (rel. t0) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | body.frequency | setValueAtTime | 60 |
| +0.400 | body.frequency | exponentialRampToValueAtTime | 40 |
| 0 | gBody.gain | setValueAtTime | 0 |
| +0.008 | gBody.gain | linearRampToValueAtTime | 0.35 |
| +0.450 | gBody.gain | exponentialRampToValueAtTime | 0.001 |
| +0.450 | gBody.gain | setValueAtTime | 0 |

- `body.start(t0)`, `body.stop(t0 + 0.50)`.
- **Duração total do som: 750 ms.**
- Na morte do jogador a ordem é `stopEngine()` (fade 80 ms) e em seguida
  `explosionBig()` no mesmo frame — a sobreposição é intencional.

---

## 8. REFUEL — "glug-glug" de reabastecimento

Singleton retrigável. O **jogo** chama `refuelTick(fuel01)` a cada **100 ms**
enquanto o avião está sobre o depósito e `fuel01 < 1`. Cada chamada emite UM
blip; o pitch sobe com o nível do tanque, produzindo a subida característica.
Ao sair do depósito ou encher, o jogo simplesmente para de chamar — não há
função de stop.

### 8.1 Grafo (por blip)

```
osc (square) → g → sfxBus
```

### 8.2 Parâmetros e automação (por blip)

Frequência do blip: `fBlip = 200 + 500 · clamp(level01, 0, 1)` Hz
(tanque vazio 200 Hz → cheio 700 Hz; valor usado sem quantização).

| Tempo (rel. t0) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | osc.frequency | setValueAtTime | `fBlip` |
| 0 | g.gain | setValueAtTime | 0 |
| +0.004 | g.gain | linearRampToValueAtTime | 0.22 |
| +0.040 | g.gain | setValueAtTime | 0.22 |
| +0.060 | g.gain | linearRampToValueAtTime | 0 |

- `osc.start(t0)`, `osc.stop(t0 + 0.07)`. **Duração do blip: 70 ms**
  (60 ms audíveis + margem), cabendo folgado no período de 100 ms.
- **Retrigger**: se `_refuelVoice` ainda existe ao chegar novo tick
  (jogo chamando mais rápido que 70 ms), matar a voz anterior:
  `g.gain.cancelScheduledValues(now)`, `g.gain.setValueAtTime(0, now)`,
  `osc.stop(now + 0.001)`; então criar o novo blip. `_refuelVoice = null` no
  `onended`.

---

## 9. FUEL BAIXO — alarme intermitente

Singleton ligado/desligado por `lowFuelAlarm(on)`. Gatilho definido pelo jogo:
liga quando `fuel01 < 0.25`, desliga quando `fuel01 ≥ 0.25`, na morte e no game
over. Totalmente construído com nós (o gate on/off é um LFO quadrado — nenhum
timer JS envolvido, então a pausa via `ctx.suspend()` congela o alarme de graça).

### 9.1 Grafo

```
osc (square, 800 Hz) → g (base 0.09) → sfxBus
lfo (square, 2.7778 Hz) → lfoDepth (0.09) → g.gain
```

### 9.2 Parâmetros

| Nó | Parâmetro | Valor |
|----|-----------|-------|
| `osc` | type / frequency | `'square'` / 800 Hz fixo |
| `g` | gain (base) | 0.09 |
| `lfo` | type / frequency | `'square'` / **2.7778 Hz** (período 360 ms; onda quadrada = 50% duty ⇒ **180 ms ligado / 180 ms desligado**) |
| `lfoDepth` | gain | 0.09 |

Soma no `g.gain`: base 0.09 + LFO(±1)·0.09 ⇒ alterna exatamente entre
**0.18 (on)** e **0 (off)**. Como `OscillatorNode` quadrado inicia a fase no
semiciclo positivo, o alarme começa SOANDO no instante do trigger — determinístico.

### 9.3 Ciclo de vida

- **Ligar** (`lowFuelAlarm(true)` com `_alarm == null`): criar nós,
  `g.gain.setValueAtTime(0.09, now)`, `osc.start(now)`, `lfo.start(now)`.
  Se `_alarm != null`, no-op.
- **Desligar** (`lowFuelAlarm(false)` com `_alarm != null`): desconectar
  `lfoDepth` de `g.gain`, `g.gain.cancelScheduledValues(now)`,
  `g.gain.setValueAtTime(g.gain.value, now)`,
  `g.gain.linearRampToValueAtTime(0, now + 0.03)`, `osc.stop(now + 0.05)`,
  `lfo.stop(now + 0.05)`, disconnect no `onended`, `_alarm = null`.
  Se `_alarm == null`, no-op.
- Duração: indefinida enquanto ligado.

---

## 10. EXTRA_LIFE — jingle de vida extra (a cada 10.000 pts)

One-shot polifônico: arpejo maior ascendente de 3 notas quadradas, curtíssimo.

### 10.1 Grafo

Uma voz por nota (3 pares `osc → g → sfxBus` criados no mesmo trigger, todos
agendados a partir do mesmo `t0`).

### 10.2 Notas

| Nota | Frequência | Início (rel. t0) | Fim do envelope | `stop()` |
|------|-----------|-------------------|-----------------|----------|
| 1 | 523 Hz | 0.000 | +0.070 | +0.080 |
| 2 | 659 Hz | 0.080 | +0.150 | +0.160 |
| 3 | 784 Hz | 0.160 | +0.230 | +0.240 |

Envelope idêntico por nota (tempos relativos ao início `tn` da nota):

| Tempo (rel. tn) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | osc.frequency | setValueAtTime | (freq da nota) |
| 0 | g.gain | setValueAtTime | 0 |
| +0.004 | g.gain | linearRampToValueAtTime | 0.25 |
| +0.070 | g.gain | linearRampToValueAtTime | 0 |

- Cada `osc.start(tn)`, `osc.stop(tn + 0.08)`. Todos type `'square'`.
- **Duração total: 240 ms.**

---

## 11. UI_START — blip de confirmação do start

One-shot polifônico simples, tocado ao iniciar partida (antes de `startEngine`).

### 11.1 Grafo

```
osc (square, 880 Hz) → g → sfxBus
```

### 11.2 Automação

| Tempo (rel. t0) | Alvo | Método | Valor |
|------------------|------|--------|-------|
| 0 | osc.frequency | setValueAtTime | 880 |
| 0 | g.gain | setValueAtTime | 0 |
| +0.003 | g.gain | linearRampToValueAtTime | 0.20 |
| +0.060 | g.gain | linearRampToValueAtTime | 0 |

- `osc.start(t0)`, `osc.stop(t0 + 0.07)`. **Duração: 70 ms.**

---

## 12. Resumo executável (tabela mestre)

| # | Som | Fontes | Filtro | Pitch | Pico | Duração | Voz |
|---|-----|--------|--------|-------|------|---------|-----|
| 1 | ENGINE | 2× square + noise loop + LFO 27 Hz | bandpass 400 Hz Q0.5 (só no ruído) | 40→90 Hz (f=40+25v), 2º osc em 2f | 0.22 ±0.03 | ∞ | singleton |
| 2 | SHOT | square | — | 1400→400 Hz exp em 90 ms | 0.30 | 100 ms | poli (guarda 50 ms) |
| 3 | EXPLOSION_SMALL | noise | lowpass 800→200 Hz Q0.7 | — | 0.50 | 400 ms | poli |
| 4 | EXPLOSION_BIG | noise + square | lowpass 600→100 Hz Q0.7 | corpo 60→40 Hz | 0.60 + 0.35 | 750 ms | poli |
| 5 | REFUEL | square | — | 200+500·nível Hz por blip | 0.22 | 70 ms/blip, tick 100 ms | singleton retrigável |
| 6 | FUEL BAIXO | square + LFO 2.7778 Hz | — | 800 Hz fixo, gate 180/180 ms | 0.18 | ∞ enquanto on | singleton on/off |
| 7 | EXTRA_LIFE | 3× square | — | 523 / 659 / 784 Hz | 0.25/nota | 240 ms | poli |
| 8 | UI_START | square | — | 880 Hz | 0.20 | 70 ms | poli |

Master: `sfxBus(1.0) → compressor(−12 dB, 6:1) → muteGain(1|0) → masterGain(0.5) → destination`.

---

## 13. Critérios de aceitação (checklist de verificação manual)

1. Nenhuma requisição de rede para áudio; DevTools → Network vazio de mídia.
2. Primeiro toque/tecla em iOS Safari e Android Chrome desbloqueia o som; o
   start do jogo já toca `uiStart` + motor sem gesto adicional.
3. Motor: ronco grave contínuo; segurar ↑ sobe o pitch de forma audível e
   percorre ~1 oitava (40→90 Hz); soltar volta ao cruzeiro; ↓ desce.
   Em alto-falante de celular o ronco continua audível (harmônico 2f).
4. Tiro: "tsiu" curto e seco; metralhar Espaço não produz cliques nem
   sobreposição caótica (guarda de 50 ms + limite de 1 míssil do jogo).
5. Explosão de inimigo claramente mais curta/aguda que a da ponte/morte;
   a grande tem "peso" de subgrave.
6. Reabastecendo: blips a 10 Hz com pitch subindo de ~200 até ~700 Hz conforme
   o medidor E→F; param imediatamente ao sair do depósito.
7. Alarme de fuel: bipes de 800 Hz, ritmo regular 180 ms on / 180 ms off;
   some ao reabastecer acima de 25% e na morte.
8. Vida extra em 10.000 pts: arpejo ascendente de 3 notas, ~¼ s.
9. Tecla P congela TODO o áudio instantaneamente (inclusive alarme e motor) e
   retoma do mesmo ponto; tecla M silencia/dessilencia em <20 ms sem clique e o
   estado sobrevive a reload (localStorage).
10. Morte: motor faz fade-out de ~80 ms sob a explosão grande; após respawn o
    motor religa sozinho.
11. Sessão longa (5+ min com muitos tiros/explosões): sem acúmulo de nós
    (verificável via `about:tracing`/heap — contagem de AudioNodes estável),
    sem distorção por clipping mesmo com motor + alarme + explosão + jingle
    simultâneos.

---

## 14. Fora de escopo (decisões fechadas por omissão)

- **Sem música** de fundo, de título ou de game over — fidelidade ao original.
- **Sem sons por inimigo** (heli/jato/navio não emitem som próprio ao se mover).
- **Sem som de colisão com margem** distinto — colisão fatal usa `explosionBig`.
- **Sem panning estéreo, reverb, delay ou pitch aleatório** por disparo.
- A lista de sons deste documento é **fechada**: qualquer som novo exige
  revisão desta spec, não improviso na implementação.
