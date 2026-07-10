# DELTA STRIKE — Game Design Document

**Versão:** 1.0 · **Idioma do doc:** pt-BR · **Código/identificadores:** inglês
**Referência de design:** River Raid (Atari 2600, Activision, 1982, Carol Shaw) — *apenas como referência*. Nenhum asset, sprite, som ou dado é extraído do original. Todos os assets do Delta Strike são 100% originais, criados para evocar a mesma estética.

Este documento é a fonte única de verdade de gameplay. **Todos os números estão decididos** — o implementador não deve tomar nenhuma decisão de design. Valores marcados **[VERIFICADO]** vêm do manual/documentação pública do original; valores marcados **[DERIVADO]** foram calibrados por nós para reproduzir a mesma sensação na resolução lógica 160×210.

Fatos verificados em: manual da Activision (AtariAge), Wikipedia, guias de estratégia da Activision e wikis de retrogaming.

---

## 1. Visão geral

O jogador pilota um jato de ataque subindo um rio infinito visto de cima, com scroll vertical (o mundo desce na tela). Deve destruir alvos (navios, helicópteros, jatos, depósitos de combustível e pontes), administrar combustível reabastecendo ao sobrevoar depósitos, e não colidir com margens, ilhas, inimigos ou pontes. Pontes dividem o rio em **seções** e funcionam como **checkpoints**. A dificuldade cresce por seção. O jogo não tem fim: aos 1.000.000 de pontos o placar vira `!!!!!!` e congela — este é o "final" (easter egg fiel ao original) **[VERIFICADO]**.

Critério de sucesso: quem jogou River Raid reconhece o Delta Strike imediatamente ao ver, ouvir e jogar.

---

## 2. Tela, resolução e escala

- Resolução lógica: **160×210 px** (canvas offscreen), escalada para a tela com nearest-neighbor (`image-rendering: pixelated`), escala inteira quando couber, letterbox preto no restante. Portrait no celular.
- **Playfield:** y = 0 a 161 (162 px de altura). O scroll acontece só aqui.
- **HUD:** y = 162 a 209 (48 px de faixa inferior), estático. Layout na seção 13.
- Loop lógico: timestep fixo **60 Hz** (`TICK_HZ = 60`); render via `requestAnimationFrame` com acumulador. Todas as velocidades abaixo estão em px/s da resolução lógica; a 60 Hz, 60 px/s = 1 px/frame.

---

## 3. Estados de jogo (máquina de estados em DS.Game)

| Estado | Entrada | Saída | Comportamento |
|---|---|---|---|
| `BOOT` | carga da página | assets prontos (imediato, tudo é gerado por código) | → `TITLE` |
| `TITLE` | — | Enter / tap em qualquer lugar | Tela título (ver 3.1). Áudio destravado no primeiro gesto. |
| `PLAYING` | start ou fim de `RESPAWN` | morte, pausa | Gameplay normal. |
| `PAUSED` | tecla P, botão de pause touch, ou `visibilitychange` (aba oculta) | P / botão / tap no overlay | Congela lógica e render do playfield; overlay "PAUSE"; `AudioContext.suspend()`. |
| `DYING` | colisão ou fuel = 0 | timer 1,0 s | Scroll parado, animação de explosão do player (seção 12.3), som de explosão. |
| `RESPAWN` | fim de `DYING` com vidas > 0 | timer 1,2 s | Player reposicionado no checkpoint (seção 12.4), texto "GET READY" piscando no centro do playfield, scroll parado. → `PLAYING`. |
| `GAME_OVER` | fim de `DYING` com vidas = 0 | Enter / tap (aceito após 1,0 s) | Playfield congelado e escurecido 50%, texto "GAME OVER" + score final centralizados. Atualiza hi-score. → `TITLE`. |

**Sem modo demo/attract** (decisão de escopo: o original também não tem demo; a tela título já cumpre o papel).

### 3.1 Tela título
Fundo preto. Conteúdo (fonte pixel própria, seção 13.5):
- Logo **"DELTA STRIKE"** em letras pixel amarelas (`COLOR_SCORE`), 2 linhas se necessário, centrado, topo a y=48.
- `HI-SCORE 000000` (valor do localStorage, seção 16) a y=100, branco.
- `PRESS ENTER` (desktop) **e** `TAP TO START` (sempre exibir as duas linhas), y=130/140, piscando a 1 Hz (500 ms on / 500 ms off).
- Rodapé y=196: `P PAUSE · M MUTE`, cinza.
- Ao iniciar: som `start` (seção 15), mundo resetado com a **mesma seed fixa** — toda partida é idêntica, como no original **[VERIFICADO: o original usa LFSR com seed hard-coded; o mundo é o mesmo em toda execução]**.

---

## 4. Controles

### 4.1 Desktop (teclado)
| Tecla | Ação |
|---|---|
| ← / → | Direção lateral (velocidade constante enquanto pressionada) |
| ↑ | Throttle rápido (`SPEED_FAST`) enquanto pressionada |
| ↓ | Throttle lento (`SPEED_SLOW`) enquanto pressionada |
| (nenhuma ↑/↓) | Cruzeiro (`SPEED_CRUISE`) |
| Espaço | Atirar (segurar = autofire, seção 7) |
| Enter | Start (TITLE/GAME_OVER) |
| P | Pausa/despausa |
| M | Mudo liga/desliga (funciona em qualquer estado) |

↑ e ↓ simultâneos: ↓ vence. ← e → simultâneos: nenhum movimento lateral.

### 4.2 Touch (multi-touch obrigatório)
Zonas em coordenadas CSS da área visível do canvas:
- **Zona de direção:** 60% esquerdos da tela. O primeiro toque que começa aqui vira o "joystick": guarda-se o ponto de origem; o deslocamento do dedo em relação à origem controla:
  - dx ≤ −10 px CSS → esquerda; dx ≥ +10 → direita; entre −10 e +10 → sem lateral (deadzone).
  - dy ≤ −24 px CSS → `SPEED_FAST`; dy ≥ +24 → `SPEED_SLOW`; senão cruzeiro.
  - Controle é digital (3 estados por eixo), como o joystick original — sem analógico.
- **Zona de fogo:** 40% direitos. Qualquer toque iniciado aqui = botão de fogo pressionado (autofire enquanto segurar). Multi-touch: direção e fogo simultâneos obrigatórios.
- **Botões de canto** (desenhados no HUD do canvas, área de toque 24×24 px lógicos): pause no canto superior direito do playfield (ícone ▐▐), mute no canto superior esquerdo (ícone alto-falante). Toques iniciados nesses retângulos NÃO contam como direção/fogo.
- `TITLE`/`GAME_OVER`: tap em qualquer lugar = start/voltar.
- `touch-action: none` no canvas; prevenir scroll/zoom.

---

## 5. Jogador (movimento e física)

- Sprite: **13×12 px** (L×A), 3 frames: nivelado, inclinado-esquerda, inclinado-direita (frame de banking exibido enquanto houver input lateral — fiel à animação de "bank" do original).
- Posição vertical **fixa**: topo do sprite em y = **128** (ocupa 128–139). O plano nunca sobe/desce na tela; ↑/↓ mudam a velocidade de **scroll**.
- Velocidades de scroll (mundo) **[DERIVADO** para reproduzir as 3 marchas do original; travessia do playfield em 5,4 s / 2,7 s / 1,08 s**]**:
  - `SPEED_SLOW` = **30 px/s** (freio; velocidade mínima — **não existe parar**, fiel ao original)
  - `SPEED_CRUISE` = **60 px/s** (padrão)
  - `SPEED_FAST` = **150 px/s**
- Transição de throttle em rampa rápida (quase instantânea, como no original): aceleração **240 px/s²**, desaceleração **300 px/s²**.
- Velocidade lateral: **72 px/s** constante, independente do throttle. Sem inércia: solta a tecla, para na hora.
- Borda de tela: x do player clampado em [**2**, **145**] (160 − 13 − 2). O clamp NÃO protege da margem do rio: se a margem invadir esse espaço, é colisão (morte).
- O scroll nunca para durante `PLAYING` (nem sobre depósito). Para apenas em `DYING`, `RESPAWN`, `PAUSED`, `GAME_OVER`.

---

## 6. Combustível

- Capacidade: **100 unidades** = tanque cheio (F). HUD mostra E→F com ponteiro (seção 13.2).
- Consumo: **1,3 u/s**, **constante no tempo, independente do throttle** **[VERIFICADO: o manual diz que o consumo independe da velocidade — voar rápido rende mais distância por tanque]**. Tanque cheio dura **≈ 77 s** (dentro da janela de 60–90 s do original) **[DERIVADO]**.
- Reabastecimento: enquanto a AABB do player sobrepõe a AABB de um depósito: **+30 u/s** (e o consumo continua; líquido +28,7 u/s). Passar devagar reabastece mais — mesma lógica do original **[VERIFICADO]**.
  - Sobreposição vertical = altura do depósito (26 px) + altura do player (12 px) = janela de 38 px: a `SPEED_SLOW` ≈ 1,27 s ≈ +38 u; a `SPEED_FAST` ≈ 0,25 s ≈ +7,6 u.
  - Som de "ticks" subindo enquanto reabastece; "ding" duplo ao atingir 100 (seção 15).
- Alarme de combustível: fuel < **25** u → som de sirene em loop (klaxon, seção 15) até subir de 25, morrer ou pausar **[VERIFICADO: alarme a 1/4 de tanque]**.
- Fuel = 0 → morte imediata (estado `DYING`), mesmo sem colisão **[VERIFICADO]**. Se estiver sobre um depósito no instante em que chegaria a 0, o refuel vence (não morre).
- Todo respawn e todo início de partida: tanque cheio (100) **[VERIFICADO]**.
- Depósito destruído a tiro = **80 pts** e some (não reabastece mais). É permitido reabastecer sobrevoando e destruí-lo em seguida (truque clássico do original — manter possível).

---

## 7. Tiro

- Míssil: retângulo **2×6 px** branco (`COLOR_MISSILE`), nasce no nariz do player (x = centro do player − 1, y = topo do player − 6).
- Velocidade: **420 px/s** para cima **[DERIVADO: cruza o playfield em ~0,3 s, como o tiro rápido do original]**. O míssil viaja em coordenadas de TELA (o scroll não o afeta).
- **Máximo 1 míssil na tela** **[VERIFICADO: o original permite essencialmente um tiro por vez]**. Novo tiro só quando o anterior sair do playfield (y < −6) ou acertar algo.
- Cooldown mínimo entre tiros: **180 ms** (mesmo que o míssil anterior tenha morrido antes).
- Autofire: com o botão segurado, atira automaticamente sempre que permitido pelas duas regras acima.
- **Míssil guiado** (fiel à chave de dificuldade B do original, a posição "novice" padrão): enquanto o míssil está em voo, ele herda o movimento lateral do player (soma ±72 px/s em x quando o player está se movendo lateralmente). Sem chave A — só existe o modo guiado.
- O míssil ignora terreno (passa por cima de margens/ilhas, como no original). Colide apenas com entidades (seção 8) e pontes.
- Cada alvo morre com **1 acerto** (incluindo a ponte).

---

## 8. Inimigos e objetos

Todas as entidades vivem em coordenadas de MUNDO e descem na tela com o scroll. AABB de colisão = sprite encolhido 1 px em cada lado.

| Entidade | Sprite (L×A px) | Pontos | Movimento próprio | Notas |
|---|---|---|---|---|
| Navio (ship) | 28×9 | **30** [VERIFICADO] | Horizontal, **15 px/s** × mult. da seção; só em seções onde "% navio móvel" sorteia móvel; senão parado | Só spawna em canal com largura ≥ 48 px. Ricocheteia nas margens (inverte direção a 2 px da margem/ilha). |
| Helicóptero (heli) | 16×12 | **60** [VERIFICADO] | Horizontal, **20 px/s** × mult.; móvel conforme "% heli móvel" da seção; senão parado | Hélice animada: 2 frames alternando a cada 6 ticks (10 Hz). Ricocheteia nas margens. |
| Depósito (fuel depot) | 14×26 | **80** [VERIFICADO] | Estático | Reabastece se sobrevoado (seção 6). Colidir com ele NÃO mata — só reabastece **[VERIFICADO: fuel depots são a única colisão inofensiva]**. Rótulo vertical "F-U-E-L" em pixels no corpo do sprite (arte própria). |
| Jato inimigo (enemy jet) | 16×6 | **100** [VERIFICADO] | Horizontal, **120 px/s** × mult., cruza a tela INTEIRA (inclusive sobre terra), não ricocheteia | Aparece a partir da **seção 3** **[DERIVADO: "após as primeiras pontes"]**. Spawn: gatilho posicionado no mundo; quando o gatilho entra a 130 px acima do player, o jato entra pela lateral sorteada (x = −16 ou 160) na altura do gatilho e cruza. Some ao sair da tela (sem pontos se escapar). |
| Ponte (bridge) | canal 104 px × 24 px de altura | **500** [VERIFICADO] | Estática, ocupa TODO o canal | Fim de seção / checkpoint. Impossível passar sem destruir (colidir = morte). 1 tiro destrói (explosão grande + som próprio). Ponte destruída permanece destruída para sempre (inclusive após respawn). |

- Inimigos **não atiram** (fiel ao 2600).
- Inimigos móveis que ricocheteiam: ao alcançar 2 px da margem (ou da ilha), invertem a direção horizontal.
- Cores dos inimigos (navio, heli, jato) trocam por seção, ciclando a tabela `ENEMY_TINTS` (seção 14) — eco da variação de cor do original.
- Explosão de inimigo: sprite 16×12, 2 frames, 0,4 s total; a entidade morre no frame do acerto (pontos creditados imediatamente).
- Decoração de margem (sem colisão, sem pontos): casas (16×10, paredes brancas, telhado vermelho-tijolo) e árvores (8×8, verde-escuro), posicionadas pelo gerador (seção 9.5).

---

## 9. Rio — geração procedural determinística

### 9.1 PRNG
- **LFSR Galois de 16 bits**: `state = (state >> 1) ^ (-(state & 1) & 0xB400)`; bit de saída = `state & 1` antes do shift. Helpers: `nextBits(n)` (n bits, MSB primeiro), `nextInt(max)` = `nextBits(16) % max`, `chance(p)` = `nextBits(16) < p * 65536`.
- Seed **fixa e hard-coded**: `RNG_SEED = 0xACE1`. Sem seed por partida: toda partida gera o MESMO rio — fidelidade ao original **[VERIFICADO: o original usa LFSR com vetor inicial hard-coded]**.
- Toda aleatoriedade do jogo (geometria, decoração, entidades) sai EXCLUSIVAMENTE deste stream, consumido na ordem definida em 9.6. Nada de `Math.random()`.

### 9.2 Estrutura
- O mundo é uma sequência infinita de **seções**, geradas sob demanda (gerar a seção k+1 quando a câmera se aproximar a 400 px do fim da seção k; nunca descartar seções já geradas até o checkpoint, para respawn determinístico — pode-se regenerá-las pois a geração é determinística por índice: cachear o estado do LFSR no início de cada seção).
- Cada seção = **150 chunks** de **8 px** de altura = **1200 px** de mundo (≈ 20 s a cruzeiro). A **ponte** ocupa os últimos 3 chunks (24 px) da seção.
- Chunk armazena: `leftX`, `rightX` (bordas do canal), e opcionalmente `islandLeftX`, `islandRightX` (ilha central). Água = entre left e right, menos a ilha. Terra = resto.
- Margem mínima de terra em cada lado: 8 px (canal sempre dentro de x ∈ [8, 152]).

### 9.3 Geometria por segmentos
Estado corrente: `leftX`, `rightX` (começa: canal centrado, cx=80, largura 104). Para cada seção, repetir até preencher os chunks 12..130 (ver zonas fixas em 9.4): sortear um **segmento** com os pesos da tabela da seção 10:

| Segmento | Duração (chunks) | Efeito por chunk |
|---|---|---|
| `STRAIGHT` | 8 + nextBits(3) → 8–15 | mantém left/right |
| `SHIFT` | 8 + nextBits(3) | move cx ±3 px/chunk (direção = 1 bit; mantém largura; clampa nas margens mín.) |
| `NARROW` | 8 + nextBits(3) | largura −4 px/chunk (−2 por lado) até `W_MIN` da seção |
| `WIDEN` | 8 + nextBits(3) | largura +4 px/chunk até `W_MAX` da seção |
| `ISLAND` | 20 + nextBits(4) → 20–35 | requer largura ≥ 88 (senão vira `WIDEN`). Ilha centrada em cx; largura da ilha cresce +4 px/chunk desde 0 até `w − 56` (mín. 16; cada canal lateral fica com ≥ 28 px), platô, e decresce −4 px/chunk nos chunks finais (formato losango). |

Restrições invariantes (garantem navegabilidade a `SPEED_FAST`): variação máxima de qualquer borda = **4 px por chunk**; largura de canal única ∈ [`W_MIN(seção)`, `W_MAX(seção)`]; canais duplos (ilha) ≥ **24 px** cada.

### 9.4 Zonas fixas de cada seção
- Chunks 0–11 (96 px pós-ponte): reta, largura forçada transicionando para 104 px centrada em cx=80 (máx. 4 px/chunk de ajuste), **livre de entidades** — é a zona de respawn.
- Chunks 12–130: segmentos aleatórios (9.3).
- Chunks 131–146: aproximação da ponte — transição de volta para canal reto 104 px centrado (respeitando 4 px/chunk), sem entidades.
- Chunks 147–149: a **ponte** (colisão em todo o canal, 104×24 px).

### 9.5 Entidades e decoração (por seção, valores da tabela 10)
1. **Depósitos** (`N_FUEL`): posições-alvo igualmente espaçadas nos chunks 12–130, jitter ±8 chunks (`nextInt(17) − 8`). x = centro do canal ± `nextInt(desvio)` mantendo 10 px livres até margem/ilha; se houver ilha no chunk, sortear 1 bit para escolher o canal.
2. **Inimigos** (`N_ENEMY`): mesmo esquema de espaçamento com jitter; distância mínima entre entidades quaisquer = 5 chunks (40 px) — se violar, empurrar para o próximo chunk livre. Tipo: 1 bit → navio/heli (se largura < 48, força heli). Flag móvel: `chance(%tipo móvel da seção)`. Direção inicial: 1 bit.
3. **Jatos** (`N_JET`): gatilhos igualmente espaçados nos chunks 20–120, jitter ±5; lado de entrada: 1 bit.
4. **Decoração**: a cada 40 chunks (jitter ±16) uma casa no lado sorteado (1 bit), 4–20 px da borda externa do rio; a cada 24 chunks (jitter ±8) uma árvore idem. Sem colisão.

### 9.6 Ordem de consumo do LFSR (obrigatória, para determinismo)
Por seção: (1) geometria segmento a segmento; (2) decoração; (3) depósitos; (4) inimigos; (5) jatos. Cachear `lfsrState` no início de cada seção para regeneração idêntica no respawn.

---

## 10. Dificuldade por seção

Seções 1–8; da seção 9 em diante usa a linha 8 para sempre (dificuldade máxima cíclica), apenas continuando o ciclo de cores dos inimigos.

| Seção | W_MIN (px) | W_MAX (px) | Peso ISLAND | Peso SHIFT | Pesos STRAIGHT/NARROW/WIDEN | N_ENEMY | N_FUEL | % heli móvel | % navio móvel | N_JET | Mult. velocidade inimigo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 64 | 120 | 0 | 1 | 6/3/2 | 10 | 6 | 0% | 0% | 0 | 1,0 |
| 2 | 56 | 120 | 1 | 1 | 6/3/2 | 13 | 5 | 25% | 0% | 0 | 1,0 |
| 3 | 56 | 112 | 2 | 2 | 6/3/2 | 16 | 5 | 50% | 0% | 2 | 1,1 |
| 4 | 48 | 112 | 2 | 2 | 6/3/2 | 19 | 4 | 75% | 25% | 3 | 1,2 |
| 5 | 48 | 104 | 3 | 3 | 6/3/2 | 22 | 4 | 100% | 50% | 4 | 1,3 |
| 6 | 40 | 104 | 3 | 3 | 6/3/2 | 25 | 3 | 100% | 75% | 5 | 1,4 |
| 7 | 40 | 96 | 4 | 4 | 6/3/2 | 28 | 3 | 100% | 100% | 6 | 1,5 |
| 8+ | 36 | 96 | 4 | 4 | 6/3/2 | 30 | 2 | 100% | 100% | 7 | 1,6 |

Racional **[DERIVADO, calibrado sobre fatos verificados]**: no original, canal estreita, depósitos rareiam ("fewer fuel depots deeper in the river" **[VERIFICADO]**), inimigos parados passam a se mover com a dificuldade **[VERIFICADO]**, jatos surgem após as primeiras pontes.

---

## 11. Pontuação e vidas

- Tabela de pontos **[VERIFICADO — manual Activision]**: navio 30 · helicóptero 60 · depósito 80 · jato 100 · ponte 500. Todos múltiplos de 10 (o dígito final do placar é sempre 0, como no original).
- Escapar (jato sair da tela / entidade sair por baixo) = 0 pontos.
- **Vidas**: começa com **3 jatos de reserva** (+1 em jogo = 4 no total) **[VERIFICADO]**. HUD mostra o número de reservas (começa em "3").
- **Vida extra**: +1 reserva a cada **10.000 pontos** (em cada múltiplo cruzado), máximo de **9 reservas** simultâneas **[VERIFICADO]**. Jingle de vida extra (seção 15). Se já tem 9, o prêmio é perdido (sem acúmulo retroativo).
- **Placar máximo / easter egg [VERIFICADO]**: quando o score atingir ≥ 1.000.000 (i.e., passar de 999.990), o placar exibe **`!!!!!!`** (seis exclamações) permanentemente, o score interno trava em 1.000.000, **nunca mais aumenta e não gera mais vidas extras**; o jogo continua normalmente até perder todas as vidas. O hi-score gravado é 1.000.000 e a tela título o exibe como `!!!!!!`.
- Exibição: 6 dígitos, **sem zeros à esquerda** (começa mostrando `0`), centrado no HUD.

---

## 12. Colisões, morte e respawn

### 12.1 Detecção
- Player × margens/ilha: amostrar os chunks nas linhas do topo, meio e base do sprite; se `player.left+1 < leftX` ou `player.right−1 > rightX` ou sobrepõe a faixa da ilha em qualquer linha amostrada → morte.
- Player × entidade (AABB −1 px): navio, heli, jato, ponte → morte. Depósito → apenas refuel.
- Míssil × entidade/ponte (AABB) → destrói alvo, remove míssil, credita pontos.
- Fuel = 0 → morte.

### 12.2 Morte
Estado `DYING` (1,0 s): scroll para; player vira animação de explosão **16×14, 3 frames a 8 fps** precedidos de flash branco de 100 ms; som `playerExplosion`; alarme de fuel silencia.

### 12.3 Vidas
Ao fim de `DYING`: reservas > 0 → decrementa e vai a `RESPAWN`; reservas = 0 → `GAME_OVER`.

### 12.4 Checkpoint e respawn **[VERIFICADO: recomeça na mesma seção; se a ponte da seção foi destruída, recomeça na seguinte]**
- **Checkpoint** = posição de mundo imediatamente após a última ponte DESTRUÍDA (ou o início do mundo, se nenhuma).
- Respawn: câmera reposicionada com o checkpoint na base do playfield; player no centro do canal, x = cx do chunk, throttle = cruzeiro, fuel = 100, míssil removido.
- Todas as entidades do checkpoint em diante voltam ao estado inicial gerado (destruídas reaparecem — regeneração determinística pela seed/cache da seção), EXCETO pontes já destruídas, que permanecem destruídas.
- Os 96 px pós-ponte são livres de entidades por construção (9.4) — não há morte injusta no respawn. Sem invulnerabilidade temporária.

### 12.5 Bordas
O player nunca sai dos limites do canvas (clamp da seção 5). O scroll nunca para em `PLAYING`.

---

## 13. HUD (y = 162–209)

Separador: linha preta 1 px em y=162. Fundo do HUD: cinza `COLOR_HUD_BG` de y=163 a 202.

### 13.1 Score — y 165–175
Dígitos 7 px de altura (fonte 5×7, 1 px de espaçamento), cor `COLOR_SCORE` (amarelo), centrado horizontalmente. Sem zeros à esquerda. Aos 1.000.000: `!!!!!!`.

### 13.2 Medidor de combustível — y 179–191
- Barra: x = 24 a 136 (112 px), fundo `COLOR_GAUGE_BG` (creme), borda 1 px preta.
- Letras `E` (x=14) e `F` (x=140), fonte 5×7, preto.
- Ticks pretos verticais (1×4 px, no topo interno da barra) em 0%, 25%, 50%, 75%, 100% (o de 50% com 6 px, mais alto — como o marcador central do original).
- Ponteiro: barra vertical branca 3×11 px com contorno preto 1 px, x = 24 + fuel/100 × 109, deslizando continuamente.

### 13.3 Vidas — y 195–202 (sobre o fundo cinza)
Ícone de avião 10×8 px (`COLOR_PLAYER`) em x=8, seguido de `×N` (fonte 5×7, preto), N = reservas (0–9).

### 13.4 Faixa decorativa — y 203–209
Fundo preto com 6 faixas horizontais de 1 px (y 203–208): vermelho, laranja, amarelo, verde, azul, roxo (valores na seção 14) — eco do arco-íris da faixa do original, arte própria. Centrado sobre a faixa, `DELTA STRIKE` em fonte 3×5 preta vazada (recorte). 

### 13.5 Fontes pixel (originais, definidas em js/sprites.js)
- 5×7: dígitos 0–9, A–Z, `×`, `!`, `·`. Usada em score, HUD e telas.
- 3×5: versão mini para a faixa decorativa e rodapés.

---

## 14. Paleta de cores

Cores escolhidas dentro do espírito da paleta NTSC do TIA (tons aproximados, hex próprios — arte original). Tudo chapado, sem gradientes, sem anti-alias.

| Constante | Hex | Uso |
|---|---|---|
| `COLOR_WATER` | `#2E63C8` | água do rio |
| `COLOR_LAND` | `#4E9C30` | margens e ilhas |
| `COLOR_PLAYER` | `#E8E060` | jato do player, ícone de vidas |
| `COLOR_MISSILE` | `#F4F4F4` | míssil |
| `COLOR_FUEL_BODY` | `#D8D8D8` | corpo do depósito |
| `COLOR_FUEL_TEXT` | `#C03020` | letras F-U-E-L e topo do depósito |
| `COLOR_BRIDGE` | `#909090` | estrutura da ponte |
| `COLOR_BRIDGE_ROAD` | `#303030` | pista sobre a ponte (faixa central 4 px) |
| `COLOR_HUD_BG` | `#9C9C9C` | fundo do HUD |
| `COLOR_SCORE` | `#E8D850` | dígitos do score, logo título |
| `COLOR_GAUGE_BG` | `#C8B858` | fundo do medidor E–F |
| `COLOR_EXPLOSION_A` | `#E87820` | explosão frame claro |
| `COLOR_EXPLOSION_B` | `#B02818` | explosão frame escuro |
| `COLOR_HOUSE_WALL` | `#E0E0E0` | decoração casa |
| `COLOR_HOUSE_ROOF` | `#B04010` | decoração telhado |
| `COLOR_TREE` | `#1E6A14` | decoração árvore |
| `ENEMY_TINTS` (ciclo por seção) | `#DADADA`, `#E07820`, `#50B8DE`, `#D060C8` | cor de navio/heli/jato na seção k = `ENEMY_TINTS[(k−1) % 4]` |
| Faixa arco-íris (13.4) | `#C03020`, `#E07820`, `#E8D850`, `#4E9C30`, `#2E63C8`, `#7040A0` | 6 linhas de 1 px |
| `COLOR_BLACK` / `COLOR_WHITE` | `#000000` / `#F4F4F4` | letterbox, textos, contornos |

---

## 15. Áudio (Web Audio API, 100% sintetizado, estética TIA)

- Apenas ondas quadradas e ruído branco (buffer de ruído gerado uma vez). Lowpass global a 4 kHz + leve bitcrush opcional NÃO — manter simples: apenas osciladores `square` e ruído, ganho mestre 0,8.
- **2 canais lógicos** (como o TIA): `CH0` = motor (contínuo); `CH1` = eventos, um por vez, por prioridade (maior vence e corta o atual): playerExplosion(10) > bridgeExplosion(9) > extraLife(8) > klaxon(6) > refuel(5) > enemyExplosion(4) > missile(3) > start(2).
- Desbloqueio: criar/`resume()` o `AudioContext` no primeiro `keydown`/`pointerdown`/`touchstart`. Mute (M/botão): ganho mestre 0; estado persiste em `localStorage`.

| Som | Síntese (valores exatos) |
|---|---|
| `engine` (contínuo em PLAYING) | square, freq = 54 + 0,56 × v (v = scroll px/s) → 71/88/138 Hz nas 3 marchas, ganho 0,18; transição de freq segue a rampa do throttle. |
| `missile` | square, sweep linear 950→320 Hz em 90 ms, ganho 0,4, decay linear até 0. |
| `enemyExplosion` | ruído, 350 ms, decay exponencial (τ=120 ms), ganho 0,7. |
| `playerExplosion` | ruído 1,0 s (τ=300 ms) + square 110→40 Hz em 400 ms, ganho 0,9. Motor silencia. |
| `bridgeExplosion` | ruído 800 ms (τ=250 ms) + square 60 Hz por 300 ms, ganho 0,9. |
| `klaxon` (loop, fuel<25) | square alternando 620 Hz e 460 Hz a cada 250 ms, ganho 0,5. |
| `refuel` (loop enquanto sobrepõe depósito) | square em escada: 10 passos/s subindo 320→920 Hz (ciclo de 1 s, reinicia), ganho 0,35. Ao completar 100: 2 blips 990 Hz de 120 ms (gap 60 ms). |
| `extraLife` | square, arpejo C5-E5-G5 (523,25 / 659,25 / 783,99 Hz) tocado 2×, 70 ms por nota, ganho 0,6. |
| `start` | square 392 / 523,25 / 659,25 Hz, 80 ms cada, ganho 0,5. |

---

## 16. Persistência

- `localStorage["ds.hiscore"]`: inteiro. Atualizado no `GAME_OVER` (e imediatamente ao atingir 1.000.000). Exibido na tela título (1.000.000 → `!!!!!!`).
- `localStorage["ds.muted"]`: `"1"`/`"0"`.
- Nada mais é persistido. Sem rede, sem telemetria.

---

## 17. CONSTANTES CANÔNICAS

Tabela pronta para virar `js/constants.js` (objeto global `DS.C`). Cores na seção 14 entram como estão.

| Constante | Valor | Unidade |
|---|---|---|
| `LOGICAL_W` | 160 | px |
| `LOGICAL_H` | 210 | px |
| `PLAYFIELD_H` | 162 | px |
| `HUD_Y` | 162 | px |
| `TICK_HZ` | 60 | Hz |
| `PLAYER_W` | 13 | px |
| `PLAYER_H` | 12 | px |
| `PLAYER_TOP_Y` | 128 | px |
| `PLAYER_MIN_X` | 2 | px |
| `PLAYER_MAX_X` | 145 | px |
| `PLAYER_LATERAL_SPEED` | 72 | px/s |
| `SPEED_SLOW` | 30 | px/s |
| `SPEED_CRUISE` | 60 | px/s |
| `SPEED_FAST` | 150 | px/s |
| `THROTTLE_ACCEL` | 240 | px/s² |
| `THROTTLE_DECEL` | 300 | px/s² |
| `MISSILE_W` | 2 | px |
| `MISSILE_H` | 6 | px |
| `MISSILE_SPEED` | 420 | px/s |
| `MISSILE_MAX_ONSCREEN` | 1 | un |
| `MISSILE_COOLDOWN_MS` | 180 | ms |
| `FUEL_MAX` | 100 | u |
| `FUEL_CONSUMPTION` | 1.3 | u/s |
| `FUEL_REFUEL_RATE` | 30 | u/s |
| `FUEL_LOW_THRESHOLD` | 25 | u |
| `SCORE_SHIP` | 30 | pts |
| `SCORE_HELI` | 60 | pts |
| `SCORE_FUEL` | 80 | pts |
| `SCORE_JET` | 100 | pts |
| `SCORE_BRIDGE` | 500 | pts |
| `SCORE_MAX` | 1000000 | pts |
| `SCORE_BANG_DISPLAY` | `"!!!!!!"` | string |
| `EXTRA_LIFE_EVERY` | 10000 | pts |
| `LIVES_RESERVE_START` | 3 | un |
| `LIVES_RESERVE_MAX` | 9 | un |
| `SHIP_W` / `SHIP_H` | 28 / 9 | px |
| `SHIP_SPEED` | 15 | px/s |
| `SHIP_MIN_CHANNEL_W` | 48 | px |
| `HELI_W` / `HELI_H` | 16 / 12 | px |
| `HELI_SPEED` | 20 | px/s |
| `HELI_ROTOR_PERIOD_TICKS` | 6 | ticks |
| `JET_W` / `JET_H` | 16 / 6 | px |
| `JET_SPEED` | 120 | px/s |
| `JET_FIRST_SECTION` | 3 | seção |
| `JET_TRIGGER_DISTANCE` | 130 | px |
| `FUELDEPOT_W` / `FUELDEPOT_H` | 14 / 26 | px |
| `BRIDGE_CHANNEL_W` | 104 | px |
| `BRIDGE_H` | 24 | px |
| `ENTITY_MIN_GAP` | 40 | px |
| `ENEMY_BANK_MARGIN` | 2 | px |
| `CHUNK_H` | 8 | px |
| `SECTION_CHUNKS` | 150 | chunks |
| `SECTION_SPAWN_SAFE_CHUNKS` | 12 | chunks |
| `SECTION_BRIDGE_APPROACH_CHUNKS` | 16 | chunks |
| `RIVER_MARGIN_MIN` | 8 | px |
| `BANK_MAX_STEP` | 4 | px/chunk |
| `SHIFT_STEP` | 3 | px/chunk |
| `ISLAND_MIN_RIVER_W` | 88 | px |
| `ISLAND_CHANNEL_MIN_W` | 24 | px |
| `ISLAND_MIN_W` | 16 | px |
| `RNG_SEED` | 0xACE1 | — |
| `LFSR_TAPS` | 0xB400 | — |
| `GEN_LOOKAHEAD` | 400 | px |
| `DIFFICULTY` (tabela seção 10, linhas 1–8) | ver seção 10 | — |
| `ENEMY_SPEED_MULT` (por seção) | 1.0,1.0,1.1,1.2,1.3,1.4,1.5,1.6 | × |
| `DYING_DURATION_MS` | 1000 | ms |
| `RESPAWN_DURATION_MS` | 1200 | ms |
| `GAMEOVER_INPUT_DELAY_MS` | 1000 | ms |
| `EXPLOSION_PLAYER_FPS` | 8 | fps |
| `EXPLOSION_ENEMY_MS` | 400 | ms |
| `TITLE_BLINK_MS` | 500 | ms |
| `TOUCH_DEADZONE_X` | 10 | px CSS |
| `TOUCH_THROTTLE_DY` | 24 | px CSS |
| `TOUCH_STEER_ZONE` | 0.6 | fração da largura |
| `CORNER_BUTTON_SIZE` | 24 | px lógicos |
| `MASTER_GAIN` | 0.8 | — |
| `ENGINE_GAIN` | 0.18 | — |
| `ENGINE_FREQ_BASE` | 54 | Hz |
| `ENGINE_FREQ_PER_PXS` | 0.56 | Hz/(px/s) |
| `KLAXON_FREQS` | 620 / 460 | Hz |
| `KLAXON_PERIOD_MS` | 250 | ms |
| `HISCORE_KEY` | `"ds.hiscore"` | — |
| `MUTED_KEY` | `"ds.muted"` | — |

---

## 18. Checklist de fidelidade (critérios de aceite)

1. Pontuação exata 30/60/80/100/500; dígito final do placar sempre 0.
2. Vida extra a cada 10.000; máx. 9 reservas; começa com 3 reservas.
3. `!!!!!!` a 1.000.000, score congelado, jogo continua.
4. Fuel: F→E ≈ 77 s a qualquer marcha; sirene abaixo de 1/4; morte a 0; reabastecer devagar rende mais.
5. Não é possível parar (mínimo 30 px/s); 3 marchas com resposta quase instantânea.
6. 1 míssil por vez, guiado lateralmente (estilo chave B).
7. Ponte bloqueia o canal, vale 500, é checkpoint; respawn após a última ponte destruída, com tanque cheio e inimigos restaurados.
8. Inimigos parados nas primeiras seções passam a se mover nas seguintes; jatos surgem na seção 3; móveis ricocheteiam nas margens (exceto jatos, que cruzam tudo).
9. Mesmo rio em toda partida (seed fixa).
10. Visual: 160×210 pixelado, verde/azul chapados, HUD cinza com score amarelo, medidor E–F com ponteiro, faixa arco-íris na base.
11. Som: só quadrada + ruído, motor contínuo variando com o throttle, klaxon de fuel, explosões de ruído.
