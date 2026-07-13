# CLAUDE.md — Delta Strike

Jogo browser estilo Atari 2600 (shooter de rio com rolagem vertical, homenagem
original ao clássico do gênero de 1982), em vanilla JS + Canvas 2D, PWA 100%
offline. Sem build, sem dependências, sem frameworks. No ar em
https://eldermoraes.github.io/Delta-Strike/ (GitHub Pages; o repo pode ficar
privado — conta Pro).

## Processo deste projeto (pedido do Elder — manter sempre)

- **Fable planeja e monitora; Opus implementa.** Toda mudança de design ou de
  valor passa primeiro pelas specs em `docs/plan/` (os docs são LEI), depois um
  agente Opus transcreve/implementa, e o resultado é validado no browser antes
  do commit.
- `docs/plan/interfaces.md` é o contrato final — vence qualquer outro doc.
  `js/constants.js` é transcrição VERBATIM do bloco §2 desse doc: edite o doc
  primeiro, nunca o arquivo direto.
- Specs de origem: `game-design.md`, `visual-spec.md`, `audio-spec.md`,
  `architecture.md`. Registre revisões nos docs com nota datada (padrão já
  usado: "> Revisão AAAA-MM-DD: ...").

## Regras de código

- Scripts clássicos em IIFE com `'use strict'`; namespace único `window.DS`.
- Ordem de carga: `constants → sprites → audio → river → entities → game`.
- Proibido: `Math.random()` (usar `DS.U.mulberry32`), `console.log`,
  `setTimeout`/`setInterval` para lógica de jogo, fetch/CDN/rede, ES modules.
- Rio determinístico: seed fixa `DS.C.DEFAULT_SEED`; `?seed=N` é só debug.
- Sprites: pixel-maps seguem o `visual-spec.md` §7 verbatim; cores apenas via
  `DS.C.PALETTE`; as dimensões da tabela `interfaces.md` §4.2 são contrato
  (hitboxes dependem delas).
- Assets 100% originais — nunca extrair nada de ROMs nem usar a marca do jogo
  de 1982; o nome do produto é DELTA STRIKE.

## Release (IMPORTANTE — fácil de esquecer)

1. **Bump do cache** no `sw.js` (`delta-strike-vN` → `vN+1`) em todo release
   que altera arquivo cacheado. O precache usa `cache: 'reload'` (imune ao
   `max-age=600` do Pages).
2. Commit + push na `main` → o Pages builda sozinho (~30 s).
3. Verifique em produção pelo CONTEÚDO servido (`curl` no arquivo alterado) —
   o status da API de builds pode responder pelo build anterior.
4. O jogador recebe a atualização na 2ª recarga (cache-first + skipWaiting);
   no PWA instalado: fechar e abrir o app duas vezes.

## Rodar e testar

- Local: `python3 -m http.server 8321` na raiz (o SW exige localhost/https).
- Sintaxe: `node --check js/*.js`. Harnesses de teste ficam FORA do repo.
- QA no Chrome desta máquina: com a tela bloqueada o rAF congela e timers são
  throttled — os truques que funcionam (pump via AudioContext, eventos
  sintéticos, medição de áudio com OfflineAudioContext) estão na memória
  persistente do Claude (`delta-strike-browser-qa-tricks`).

## Calibrações validadas com o Elder (não regredir sem pedido)

- **Touch** (playtest 2026-07-10, aprovado): `TOUCH_DEADZONE_X 28`,
  `TOUCH_STEER_RELEASE_X 14` (histerese), `TOUCH_THROTTLE_DY 36`.
- **Explosões** (2026-07-11, calibrado por medição): small com lowpass
  4500→400 Hz e pico 0.62; big com ruído 2400→200 Hz e pico 0.65 (camada de
  corpo 60 Hz intacta). Critério de aceite no `audio-spec.md` §6/§7: RMS da
  janela de 120 ms, após highpass duplo de 700 Hz (proxy de alto-falante de
  celular), ≥ 1.0× (small) / 1.2× (big) o RMS do tiro.
