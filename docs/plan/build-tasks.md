# DELTA STRIKE — build-tasks.md (plano para 6 agentes paralelos)

Seis agentes implementam o jogo em paralelo, **sem comunicação entre si**. Cada
agente é DONO EXCLUSIVO dos arquivos da sua tarefa e não toca em nenhum outro.
A integração funciona porque todos aderem 100% a
`docs/plan/interfaces.md` — o contrato final, que **vence** qualquer divergência
com os demais docs de plano.

---

## REGRAS GLOBAIS (valem para todas as tarefas)

1. **Não tocar em arquivo de outra tarefa.** Nem "só um ajustinho". Se algo
   parecer errado no contrato, implemente o contrato mesmo assim (a
   inconsistência se resolve na fase de integração, não na sua tarefa).
2. **interfaces.md é lei.** Ordem de leitura obrigatória: (a)
   `docs/plan/interfaces.md` INTEIRO; (b) as seções da spec de origem listadas
   na sua tarefa. Onde a spec de origem divergir do interfaces.md, o
   interfaces.md vence (a §0 dele lista as resoluções R1–R33).
3. **Código e strings do jogo em inglês.** Comentários em inglês. Nomes de API,
   sprites e sons EXATAMENTE como no interfaces.md — não renomear, não
   "melhorar".
4. **Sem dependências externas.** Zero fetch/CDN/fonte externa/imagem externa/
   biblioteca. Zero build step. Scripts clássicos (IIFE), não ES modules.
5. **Proibido:** `console.log` (permitidos `console.error`/`console.warn` para
   falhas reais), `Math.random()`, `setInterval`, `setTimeout` para lógica de
   jogo, `alert`, qualquer global além de `window.DS`.
6. Esqueleto de todo `js/*.js`:
   ```js
   /* DELTA STRIKE — <module>.js */
   (function () {
     'use strict';
     window.DS = window.DS || {};
     // ...
     DS.ModuleName = { /* API pública */ };
   })();
   ```
7. **Definir só o próprio namespace.** Nenhum efeito colateral no load além de
   definir `DS.X` (exceções explícitas: nenhuma — até `DS.Audio.init` só roda
   quando o game chamar).
8. Coordenadas, unidades e fórmula de desenho: interfaces.md §1 (mundo com
   worldY crescendo PARA CIMA; `sx = round(x) − (w>>1)`,
   `sy = (camInt − round(y)) − (h>>1) + 1`).
9. Para testar seu módulo isolado antes da integração: crie um HTML/console de
   teste FORA do repositório (ou em pasta temporária não commitada), colando o
   `constants.js` literal do interfaces.md §2. **Não commite arquivos de
   teste.**
10. Critério de pronto de toda tarefa: arquivo(s) da tarefa completos, zero
    erros de sintaxe (`node --check js/arquivo.js` passa), critérios de aceite
    da tarefa verificados.

---

## T1 — Shell (página, PWA, ícones)

**Arquivos (donos exclusivos):** `index.html`, `style.css`,
`manifest.webmanifest`, `sw.js`, `tools/make_icons.py`, `icons/icon-192.png`,
`icons/icon-512.png` (gerados pelo script).

**Ler:** interfaces.md §8 (e §3 para entender o boot); architecture.md §13, §15;
visual-spec.md §2 e §12.

**Fazer:**
1. `index.html`: esqueleto EXATO do interfaces.md §8.1 (head da architecture
   §15.1 + os 3 divs de hint + os 6 scripts na ordem + script inline de
   load/SW). Nada além disso.
2. `style.css`: architecture §15.2 + a regra `#hint-keys` do interfaces §8.2.
3. `manifest.webmanifest`: verbatim architecture §13.1.
4. `sw.js`: verbatim architecture §13.2 (cache `delta-strike-v1`; a lista
   ASSETS não inclui `sw.js`, `tools/`, `docs/`).
5. `tools/make_icons.py`: transcrever o código abaixo (normativo) e RODAR
   `python3 tools/make_icons.py` para gerar e commitar os 2 PNGs.

```python
#!/usr/bin/env python3
"""Generate icons/icon-192.png and icons/icon-512.png. Stdlib only.
Recipe: docs/plan/interfaces.md §8.4 (water background, grass columns, player)."""
import struct, zlib, os

PLAYER = [
    "......YY......",
    "......YY......",
    ".....YYYY.....",
    ".....YYYY.....",
    "....YYYYYY....",
    ".YYYYYYYYYYYY.",
    "YYYYYYYYYYYYYY",
    "YYY..YYYY..YYY",
    ".....YYYY.....",
    "..Y..YYYY..Y..",
    ".YYYYYYYYYYYY.",
    ".YYY..YY..YYY.",
]
WATER  = (0x58, 0x4F, 0xDA, 255)   # DS.C.PALETTE.WATER
GRASS  = (0x64, 0x92, 0x28, 255)   # DS.C.PALETTE.GRASS_A
YELLOW = (0xFF, 0xF4, 0x56, 255)   # DS.C.PALETTE.YELLOW

def chunk(tag, data):
    return (struct.pack('>I', len(data)) + tag + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

def build(size, scale):
    col = size // 5
    px = [[WATER] * size for _ in range(size)]
    for y in range(size):
        for x in range(col):
            px[y][x] = GRASS
            px[y][size - 1 - x] = GRASS
    pw, ph = 14 * scale, 12 * scale
    ox, oy = (size - pw) // 2, (size - ph) // 2
    for ry, row in enumerate(PLAYER):
        for rx, ch in enumerate(row):
            if ch != 'Y':
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[oy + ry * scale + dy][ox + rx * scale + dx] = YELLOW
    raw = bytearray()
    for row in px:
        raw += b'\x00'
        for p in row:
            raw += bytes(p)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))

def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
    os.makedirs(out, exist_ok=True)
    for size, scale in ((192, 8), (512, 24)):
        path = os.path.join(out, 'icon-%d.png' % size)
        with open(path, 'wb') as f:
            f.write(build(size, scale))
        print('wrote', path)

if __name__ == '__main__':
    main()
```

**Critérios de aceite:**
- [ ] `python3 tools/make_icons.py` gera os 2 PNGs; ambos abrem em visualizador
      (assinatura PNG válida) com fundo azul-rio, colunas verdes e jato amarelo.
- [ ] `index.html` referencia exatamente os 6 js na ordem
      constants→sprites→audio→river→entities→game.
- [ ] `manifest.webmanifest` é JSON válido (`python3 -m json.tool`).
- [ ] `node --check sw.js` passa; ASSETS lista os 12 caminhos da architecture
      §13.2 e nada mais.
- [ ] Servindo a pasta (`python3 -m http.server`), a página abre sem 404 de
      css/manifest/ícones (os js dos outros agentes podem 404 durante o
      desenvolvimento paralelo — ok).
- [ ] Canvas centralizado em fundo preto; página não rola nem dá zoom no mobile
      (`touch-action:none`, `user-scalable=no`).

**Armadilhas de integração:**
- NÃO adicionar elementos extras ao HTML (o game.js procura por `#screen`,
  `#hint-left`, `#hint-right`, `#hint-keys` — ids exatos).
- NÃO esconder os hints via CSS por conta própria além do especificado: quem
  controla exibição é o game.js. O CSS só define aparência e a classe `hidden`.
- `sw.js` na raiz (escopo `./`); registro só via o script inline especificado.
- Não cachear `sw.js` dentro do próprio cache.

---

## T2 — Sprites (`js/sprites.js`)

**Ler:** interfaces.md §1, §2 (PALETTE), §4; visual-spec.md §0, §1, §3.2, §5.3
(matriz da ponte), §5.4, §7 (todas as matrizes), §8 (fontes).

**Fazer:**
1. Dados privados: pixel-maps VERBATIM do visual-spec para os 15 sprites da
   tabela interfaces §4.2 (`player`, `playerBoom`, `missile`, `heli`, `ship`,
   `jet`, `fuel`, `bridge`, `bridgeFire`, `explosion`, `debris`, `lifeIcon`,
   `house`, `tree`, `half`) + minifonte 3×5 (A–Z, 0–9 do VS §8.2 **mais** o
   glifo `!` do interfaces §4.3) + fonte grande 8×10 (dígitos 0–9 e `!` do VS
   §8.1).
2. `bridge`: linhas 0 e 15 = padrão `SSSS....` do VS §5.3; linhas 1..14 = cores
   sólidas da tabela do VS §5.3. `bridgeFire` = mesma matriz com trocas
   `C→Y`, `D→G`, `G→P`.
3. Cores APENAS via legenda letra→chave do interfaces §4.3 e `DS.C.PALETTE`.
   Nenhum hex literal no arquivo.
4. `init()` pré-renderiza cada frame (e a versão espelhada) em canvas
   offscreen; API exata: `draw(ctx,name,frame,sx,sy,flip)`, `size`,
   `frameCount`, `drawText(ctx,text,x,y,colorKey,scale)`,
   `textWidth(text,scale)`, `drawBig(ctx,text,x,y)` (interfaces §4.1).

**Critérios de aceite** (com constants.js de teste colado do interfaces §2):
- [ ] `DS.Sprites.init()` roda sem erro; `size('player')` → `{w:14,h:12}`;
      `size('bridge')` → `{w:64,h:16}`; `frameCount('explosion')` → 3;
      `frameCount('heli')` → 2.
- [ ] Desenho de teste de cada sprite num canvas 160×210 escalado: silhuetas
      conferem com as matrizes; letras F-U-E-L do depósito são VAZADAS (fundo
      aparece); `flip=true` espelha heli/ship/jet.
- [ ] `drawText(ctx,'DELTA STRIKE',10,20,'YELLOW',3)` ocupa 141 px de largura
      (`textWidth('DELTA STRIKE',3) === 141`).
- [ ] `drawBig` com `'0123456789!'` desenha 11 glifos com avanço 10.
- [ ] Nenhuma cor fora de `DS.C.PALETTE`; nenhum alpha parcial.

**Armadilhas de integração:**
- Dimensões da tabela §4.2 são contrato: entities/game usam `size()` para
  hitbox e centralização. Um pixel a mais numa matriz quebra colisão.
- `draw` recebe TOP-LEFT já arredondado — não recentralizar nem arredondar de
  novo dentro do sprites.js.
- Player tem 1 frame só (a decisão "3 frames de bank" foi descartada — R1).
- `drawText` precisa aceitar `colorKey`/`scale` omitidos (defaults YELLOW / 1).

---

## T3 — Áudio (`js/audio.js`)

**Ler:** interfaces.md §1.5, §3 (passo 4), §5; audio-spec.md INTEIRO (é a spec
normativa da síntese).

**Fazer:** implementar o audio-spec por completo com estes overrides do
interfaces.md:
- Chave de persistência do mute: `DS.C.MUTED_KEY` (`'ds.muted'`) — NÃO
  `'ds_muted'`.
- API pública exatamente a do interfaces §5.1 (inclui `unlock()` público e
  idempotente; os listeners internos de gesto chamam-no).
- Constantes de jogo (`FUEL_LOW_FRAC`, cadência do refuelTick) NÃO vivem aqui:
  audio.js não lê estado do jogo, só executa chamadas.

**Critérios de aceite** (página de teste local com constants.js colado):
- [ ] Antes de qualquer gesto: todas as funções são no-op sem erro e NENHUM
      AudioContext existe.
- [ ] Após 1 clique/tecla: `startEngine()` produz ronco grave contínuo;
      `setEngineSpeed(0/1/2)` muda o pitch (40/65/90 Hz + harmônico 2f);
      `stopEngine()` faz fade ~80 ms.
- [ ] `shoot()` = "tsiu" 100 ms (1400→400 Hz); chamadas com <50 ms de intervalo
      são ignoradas; `explosionSmall()` ~400 ms; `explosionBig()` ~750 ms com
      subgrave; `refuelTick(0)`→`refuelTick(1)` sobe de ~200 a ~700 Hz;
      `lowFuelAlarm(true)` bipa 800 Hz em 180/180 ms e `(false)` para;
      `extraLife()` arpejo 523/659/784; `uiStart()` blip 880 Hz.
- [ ] `setPaused(true)` congela TUDO (motor e alarme inclusive);
      `setPaused(false)` retoma do ponto.
- [ ] `setMuted(true)` silencia em <20 ms sem clique; sobrevive a reload
      (localStorage `ds.muted`); try/catch em localStorage.
- [ ] 200 disparos seguidos: contagem de AudioNodes estável (teto de 8 vozes,
      disconnect em `onended`) — sem vazamento.

**Armadilhas de integração:**
- Os nomes ARQ `play('shot')`/`startLoop('engine')` estão REVOGADOS (R7) — se
  você implementá-los, o entities/game não vai chamá-los.
- Listeners de unlock: `pointerdown`, `touchend`, `keydown` com
  `capture:true`, removidos após o unlock; `visibilitychange` permanece.
- Nunca usar `setTimeout` para envelope; só automação de AudioParam.
- `exponentialRampToValueAtTime` não aceita 0 → terminar em 0.001 e cravar 0.
- Ganho de toda voz começa em 0 (`setValueAtTime(0, t0)`) para não estalar.

---

## T4 — Rio (`js/river.js`)

**Ler:** interfaces.md §1, §2 (constantes GEN/DIFFICULTY), §6; game-design.md §9
e §10 (contexto; onde divergir, interfaces vence — ver R3, R6, R17, R22, R23,
R24); visual-spec.md §5.1, §5.2 (estrada).

**Fazer:**
1. Geração por seção com `DS.U.mulberry32(DS.U.sectionSeed(seed, i))`, cache,
   ordem de consumo EXATA do interfaces §6.2 (geometria → decoração →
   depósitos → inimigos → jatos, com as contagens fixas de rolls por item).
2. Geometria quantizada (§6.2.1): chunks 0/149 forçados `{48,112}`; zona segura
   0..11; segmentos 12..130; convergência 131..148.
3. Spawns (§6.2.3–6.2.6) e decoração (§6.2.2) com os invariantes de §6.4.
4. `render(ctx, camInt)` conforme §6.3 (linhas de terra/água, faixa de estrada
   de 16 linhas por ponte, decoração via `DS.Sprites.draw`).
5. API exata do §6.1.

**Critérios de aceite** (console, com constants.js de teste):
- [ ] `DS.River.init(DS.C.DEFAULT_SEED)`; `channelAt(0)` → `[{xl:48,xr:112}]`;
      `channelAt(60)` → canal 104 centrado; `channelAt(1200)` → `[{48,112}]`.
- [ ] Varredura `for y in 0..12000`: todo intervalo tem `xl<xr`, bordas
      múltiplas de 4, largura múltipla de 8, dentro de `[8,152]`; entre chunks
      consecutivos nenhuma borda muda mais que 8 px (e só muda 8 no caso WIDEN
      bloqueado); canais de ilha ≥ 28 px cada; ilhas só onde rio ≥ 88.
- [ ] `JSON.stringify(DS.River.spawns(3))` idêntico entre dois reloads (mesma
      seed) e diferente com `init(42)`.
- [ ] `spawns(i≥1)[0].type === 'bridge'` com `y === i*1200`; nenhum spawn de
      entidade nos chunks 0..11 nem 131..149; depósitos: span x ±6 é água em
      TODOS os chunks cobertos; ships só em intervalos ≥ 48 px.
- [ ] Contagens por seção batem com `DIFFICULTY[min(i,7)]` (menos os pulados
      por falta de espaço, que devem ser raros nas seções 0–3).
- [ ] `render` num canvas de teste com camInt=161: rio azul, margens
      escadinha, sem estrada visível; com camInt=1210: faixa de estrada
      cinza/amarela alinhada e canal 64 px.
- [ ] `channelAt` chamado 2× para o mesmo y retorna o MESMO array (===).

**Armadilhas de integração:**
- O PRNG é mulberry32 por seção (R6) — NÃO o LFSR do game-design.
- QUALQUER consumo extra/condicional de rng fora da receita quebra o
  determinismo do respawn. Rolls "sempre consumidos" são sempre consumidos,
  mesmo quando o item é pulado.
- Arrays retornados são cacheados: nunca retornar cópias novas por chamada
  (custo) nem deixar o caller mutar (documentado; não precisa congelar).
- Cor da margem por seção: `sectionAt(worldY) % 2` (par = GRASS_A) — avaliada
  POR LINHA de mundo, não por câmera.
- A estrada usa `camInt` inteiro: nunca desenhar a estrada a partir de
  `cameraY` float (desalinharia da ponte do entities).
- `sectionAt` de y negativo → 0 (clamp); `channelAt` de y negativo → linha 0.

---

## T5 — Entidades (`js/entities.js`)

**Ler:** interfaces.md §1, §2, §6.1/6.2.6 (contrato com River), §7.1, §7.3–7.5,
§7.9; game-design.md §5–§8, §12 (contexto; interfaces vence — ver R1–R5, R11,
R12, R21, R23, R28); visual-spec.md §7.7 (âncoras de explosão).

**Fazer:**
1. Estado interno: `player`, `enemies[]`, `missiles[]`, `bridges{}`,
   `explosions[]`, `debris[]`, `pending[]`, `nextSection`, `hooks`.
2. API exata do interfaces §7.1 (SEM `setPlayerVisible` — foi removida).
3. Update na ordem normativa §7.4 (spawning → player → tiro → mísseis →
   inimigos → culling → colisões → animações).
4. Explosões/destroços/flicker de ponte conforme §7.5; render na ordem
   `bridges → fuel → ship/heli → jet → debris → missiles → player →
   explosions`, usando a fórmula única de desenho (§1.3) e `flip` para
   `dir === -1`.
5. Chamadas de áudio DIRETAS apenas: `DS.Audio.shoot()`,
   `DS.Audio.explosionSmall()`, `DS.Audio.explosionBig()` (esta só para ponte).

**Critérios de aceite** (harness de console com constants.js + stubs simples de
Sprites/Audio/River conforme contratos — ou os módulos reais se prontos):
- [ ] `startRun(27)`: player em (80, 27), speed 60, alive.
- [ ] 600 updates com `{steer:0,throttle:0,fire:false}`: `player.y ≈ 27+600·1`
      (60 px/s), nenhum erro; com `throttle:1` a speed rampa a 150 sem
      ultrapassar; com `throttle:-1` cai a 30 e nunca abaixo.
- [ ] `fire:true` contínuo: 1º míssil no tick do input; nunca 2 mísseis
      simultâneos; novo tiro só após o anterior sumir E cooldown 0.18 s;
      míssil anda `(420+speed)` px/s em worldY e herda steer em x.
- [ ] Colisões: mover o player contra `channelAt` estreitado → morre 'bank'
      (3 linhas de amostragem); sobrepor depósito → `onRefuel` a cada tick e
      NÃO morre; míssil sobre inimigo → some, explosão criada, `onScore(30/60/
      80/100)`, `explosionSmall`; míssil na ponte → `onScore(500)`,
      `onBridgeDestroyed(b)`, `explosionBig`, flicker 32 ticks e depois some.
- [ ] Ship/heli móvel ricocheteia a 2 px da borda do intervalo; jet cruza a
      tela sobre a terra e é removido fora de x∈[−10,170].
- [ ] `respawn(1227)`: limpa inimigos/mísseis; ponte 1 destruída NÃO volta;
      entidades da seção 1 re-instanciam à frente conforme o scroll.
- [ ] `killPlayer` duas vezes no mesmo tick → 1 chamada de `onPlayerDeath`.

**Armadilhas de integração:**
- **worldY cresce PARA CIMA**: "à frente do player" = y MAIOR. Culling é
  `y < cameraBottom − 16`.
- Usar `sy = (camInt − round(y)) − (h>>1) + 1` — o `+1` é obrigatório (alinha
  a ponte com a estrada do river.js).
- Míssil NÃO morre em terra (R4). Não portar a regra da architecture.
- Player tem hitbox 12×10 (14×12 − 1 px por lado) e o sprite não inclina (R1).
- Inimigo que mata o player por contato explode SEM pontos.
- `bridges` NÃO é limpo em `respawn` — é a memória de checkpoint do jogo.
- Depósito destruído continua contando explosão/debris mas não reabastece.
- Nenhuma chamada a `DS.Audio` além das 3 listadas (motor/alarme/refuel/morte
  são do game — R31, §5.3).
- speedMult usa a seção DA ENTIDADE (`sectionAt(e.y)`), não a do player.

---

## T6 — Game + Constants (`js/game.js`, `js/constants.js`)

**Ler:** interfaces.md INTEIRO (você é o integrador); architecture.md §3, §4,
§10–§12, §16 (contexto; interfaces vence — ver R2, R13, R14, R15, R16, R21,
R25, R27, R29); game-design.md §3, §4, §6, §11 (contexto); visual-spec.md §9,
§10, §11 (HUD e telas).

**Fazer:**
1. `js/constants.js`: **transcrever VERBATIM** o bloco do interfaces.md §2
   (DS.C + DS.U). Nenhuma alteração de valor/nome.
2. `js/game.js`:
   - `DS.Game.init()` com a sequência de boot do interfaces §3 (try/catch +
     `console.error` + re-throw).
   - Loop rAF + timestep fixo (architecture §3.2: acumulador, clamp
     `MAX_FRAME_DELTA`, `MAX_STEPS`, render 1×/frame).
   - Máquina de estados e renders por estado: interfaces §7.6; update de
     playing: §7.7; hooks: §7.3.
   - `renderHUD` exato (§7.6, coords de `DS.C.HUD`).
   - Submódulo `Input` (§7.8): teclado + multi-touch digital 60/40 + hotspots
     de canto + edges consumidos no poll.
   - Resize (architecture §12.1: escala inteira em px físicos via dpr,
     fallback fracionário, `imageSmoothingEnabled=false` re-setado).
   - Matriz de áudio (§5.3) — o game é o único a chamar
     startEngine/stopEngine/setEngineSpeed/refuelTick/lowFuelAlarm/extraLife/
     uiStart/setMuted/setPaused e o `explosionBig()` da morte do player.
   - Persistência `ds.hiscore` (gameover e ao cravar 1.000.000) com try/catch.
   - Hints: touch → mostra `#hint-left/right` na 1ª entrada em playing (some
     no 1º gesto correspondente ou após 6 s = 360 ticks) e esconde
     `#hint-keys`; sem touch → esconde `#hint-left/right`, mantém
     `#hint-keys`.
   - `visibilitychange` → auto-pause em playing.
   - Propriedades públicas de leitura e `DS.Game.cheat.invincible`.

**Critérios de aceite** (com todos os módulos presentes; se algum faltar, use
stub mínimo local NÃO commitado):
- [ ] `python3 -m http.server` → título com logo (141 px), chamada piscando
      1 Hz, `HI 0`, HUD com score 0/vidas 3/ponteiro em F.
- [ ] Enter inicia: blip + motor; setas dirigem; ↑/↓ mudam pitch do motor;
      espaço atira (1 míssil, autofire segurando); P pausa (texto `PAUSE`
      piscando, áudio congelado); M muta e mostra `M` no HUD; página nunca
      rola.
- [ ] Fuel cai ~1.3/s; abaixo de 25 soa alarme; encostar na margem → boom 48
      ticks + 30 invisível → respawn no início da seção com tanque cheio, sem
      texto, sem piscar; 3 mortes extras → gameover com score piscando e vidas
      0; Enter (após 1 s) → título; hi-score atualizado e persistido.
- [ ] Destruir a ponte: +500, checkpoint avança; morrer depois → respawn na
      seção nova; a ponte destruída não reaparece.
- [ ] Vida extra exatamente ao cruzar 10.000 (jingle; dígito de vidas +1, máx
      9). Score exibido sem zeros à esquerda, alinhado à direita em x=104.
- [ ] `?seed=42`: dois reloads → rio/spawns idênticos (`DS.River.spawns(3)`).
- [ ] Touch (emulação DevTools): arrastar na esquerda dirige (deadzone 10 px)
      e acelera/freia (±24 px); tocar na direita atira; os dois simultâneos;
      cantos superiores pausam/mutam; tap inicia no título.
- [ ] Aba oculta 30 s → auto-pause; volta sem salto de tempo.
- [ ] Zero `console.log`; `DS.Game.state/score/lives/fuel/tick` visíveis no
      console.

**Armadilhas de integração:**
- constants.js é TRANSCRIÇÃO, não interpretação. Rode um diff mental contra o
  interfaces §2 antes de finalizar.
- `camInt = Math.round(cameraY)` calculado 1× no render e passado a
  `River.render` e `Entities.render` — nunca passar o float.
- Ordem no tick: `Entities.update` PRIMEIRO, depois câmera, depois dreno de
  fuel (o refuel do hook acontece dentro do update — a ordem garante que
  reabastecer no tanque vazio vence a morte).
- Decremento de vidas: UMA vez, no fim de `dying`
  (`lives > 0 ? (lives--, respawn) : gameover`) — R21.
- Morte: `lowFuelAlarm(false)` → `stopEngine()` → `explosionBig()` nesta ordem
  (R31). Ao voltar de respawn: `startEngine()`.
- Sem texto "GAME OVER" e sem "GET READY" (R13/R14).
- `Space`/setas/Enter com `preventDefault`; ignorar `e.repeat` nos edges.
- Não chamar `DS.Audio.unlock()` manualmente é ok (audio.js se destrava
  sozinho), mas chamar também não quebra (idempotente).
- Em `title`, NÃO chamar `Entities.render` (player ainda não existe).

---

## Ordem de integração sugerida (após os 6 entregarem)

1. Merge de tudo; `node --check` nos 6 js.
2. Smoke test da architecture §17 (desktop, mobile, offline/PWA, determinismo,
   escala).
3. Ajustes de calibração SOMENTE via `DS.C` (fuel, dificuldade) e ganhos do
   audio-spec §2.6 (ouvido em dispositivo real), preservando nomes/contratos.
