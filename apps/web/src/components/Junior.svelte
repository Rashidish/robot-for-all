<script lang="ts">
  // Junior (Grades R–2; spec docs/specs/junior.md, ADR-0019): a tap-to-add row of picture cards
  // that drives a robot on a grid. Tap a picture to add it; tap a card in the row to take it out.
  // A repeat number goes under the last card, as CAPS shows it (FR-11): tap the arrow, then "×3".
  // No dragging and no reading: every block has a picture, a colour and a spoken name. The program
  // runs one step at a time with the current block lit up (FR-3). Stars are kept on this phone.
  import { onMount } from 'svelte';
  import {
    type Action,
    type Block,
    cardCount,
    cellName,
    isRepeat,
    MAX_BLOCKS,
    type Mission,
    MOVES,
    parseCell,
    type Run,
    runJunior
  } from '../../../../packages/sim/src/junior';
  import {
    BLOCK_ICON,
    CLEAR_ICON,
    colourOf,
    PLAY_ICON,
    ROCK_ICON,
    SPEAK_ICON,
    START_ICON,
    STAR_ICON,
    THEME,
    UNDO_ICON,
    BIG_ICON
  } from '../junior/icons';

  interface Props {
    labels: Record<string, string>;
    missions: Mission[];
    language: string;
  }
  let { labels, missions, language }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const STARS_KEY = 'rfa-junior-stars';
  const STEP_MS = 600;
  const REPEAT_WORD: Record<string, string> = { x2: 'two', x3: 'three', x4: 'four', x5: 'five' };
  const blockName = (b: Block) =>
    t(b.startsWith('x') ? `junior_block_${REPEAT_WORD[b] ?? 'two'}` : `junior_block_${b}`);
  const missionName = (m: Mission) => t(`junior_mission_${m.id.replace(/-/g, '_')}`);

  let index = $state(0);
  const mission = $derived(missions[index] as Mission);
  let program = $state<Block[]>([]);
  let running = $state(false);
  let lit = $state<number | null>(null);
  let robot = $state({ col: 0, row: 0, heading: 'E' as Mission['start']['heading'] });
  let flash = $state<'light' | 'bump' | null>(null);
  let result = $state<Run | null>(null);
  let stars = $state<Record<string, number>>({});
  let speak = $state(false);
  let announce = $state('');
  // Projector layout (FR-8): a big board and blocks, full screen where the browser allows it.
  let big = $state(false);
  let root: HTMLDivElement | undefined = $state();
  async function toggleBig() {
    big = !big;
    try {
      if (big && root?.requestFullscreen && !document.fullscreenElement)
        await root.requestFullscreen();
      else if (!big && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Full screen not allowed here: the big layout is enough.
    }
  }
  // Links for adults, in this page's language (/zu/code/junior/ → /zu/code/junior/cards/).
  const base = `${typeof location === 'undefined' ? '' : (/^\/[a-z]{2,3}(?=\/code\/)/.exec(location.pathname)?.[0] ?? '')}/code/junior/`;

  const place = () => {
    const c = parseCell(mission.start.cell) ?? { col: 0, row: 0 };
    robot = { ...c, heading: mission.start.heading };
    lit = null;
    flash = null;
  };
  const choose = (i: number) => {
    if (running) return;
    index = i;
    program = [];
    result = null;
    place();
  };

  onMount(() => {
    try {
      stars = JSON.parse(localStorage.getItem(STARS_KEY) ?? '{}') as Record<string, number>;
    } catch {
      stars = {};
    }
    const fromHash = missions.findIndex((m) => `#${m.id}` === location.hash);
    choose(fromHash >= 0 ? fromHash : 0);
  });

  function say(text: string) {
    announce = text;
    if (!speak || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === 'zu' ? 'zu-ZA' : 'en-ZA';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      // No voice on this phone: the picture is enough.
    }
  }

  // The row as cards: a repeat number belongs to the move card after it (stored just before it).
  interface Card {
    action: Action;
    times: Block | null;
    /** The program indexes this card covers (its repeat number and itself). */
    from: number;
    to: number;
  }
  const cards = $derived.by(() => {
    const out: Card[] = [];
    for (let i = 0; i < program.length; i++) {
      const b = program[i] as Block;
      if (isRepeat(b)) {
        const next = program[i + 1];
        if (next !== undefined && !isRepeat(next)) {
          out.push({ action: next as Action, times: b, from: i, to: i + 1 });
          i++;
        }
        continue;
      }
      out.push({ action: b as Action, times: null, from: i, to: i });
    }
    return out;
  });
  const cardName = (c: Card) =>
    c.times ? `${blockName(c.action)}, ${blockName(c.times)}` : blockName(c.action);

  function add(b: Block) {
    if (running) return;
    result = null;
    place();
    if (isRepeat(b)) {
      // The number goes under the last card, if that card moves or turns the robot.
      const last = cards.at(-1);
      if (!last || !MOVES.includes(last.action)) {
        say(t('junior_repeat_first'));
        return;
      }
      program = [...program.slice(0, last.from), b, last.action];
      say(cardName({ ...last, times: b }));
      return;
    }
    if (cardCount(program) >= MAX_BLOCKS) {
      say(t('junior_full'));
      return;
    }
    program = [...program, b];
    say(blockName(b));
  }
  function removeCard(c: Card) {
    if (running) return;
    result = null;
    place();
    program = program.filter((_, k) => k < c.from || k > c.to);
    say(cardName(c));
  }
  const undo = () => {
    const last = cards.at(-1);
    if (last) removeCard(last);
  };
  const clear = () => {
    if (running) return;
    program = [];
    result = null;
    place();
  };

  let audio: AudioContext | null = null;
  function beep() {
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 660;
      g.gain.value = 0.15;
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.25);
    } catch {
      // No sound on this phone.
    }
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function run() {
    if (running) return;
    place();
    result = null;
    const r = runJunior(mission, program);
    running = true;
    for (const step of r.steps) {
      lit = step.block;
      robot = { ...step.cell, heading: step.heading };
      flash = step.blocked ? 'bump' : step.action === 'light' ? 'light' : null;
      if (step.action === 'beep') beep();
      await wait(STEP_MS);
    }
    lit = null;
    flash = r.outcome === 'bumped' || r.outcome === 'off' ? 'bump' : null;
    running = false;
    result = r;
    const message =
      r.outcome === 'reached'
        ? r.stars === 2
          ? t('junior_best')
          : t('junior_reached')
        : r.outcome === 'bumped'
          ? t('junior_bumped')
          : r.outcome === 'off'
            ? t('junior_off')
            : t('junior_not_there');
    say(message);
    if (r.stars > (stars[mission.id] ?? 0)) {
      stars = { ...stars, [mission.id]: r.stars };
      try {
        localStorage.setItem(STARS_KEY, JSON.stringify(stars));
      } catch {
        // Private browsing: stars last for this visit only.
      }
    }
  }

  const SIZE = 64;
  const target = $derived(parseCell(mission.target) ?? { col: 0, row: 0 });
  const theme = $derived(THEME[mission.theme]);
  const angle = { N: 0, E: 90, S: 180, W: 270 } as const;
</script>

<div class="junior" class:big bind:this={root}>
  <nav class="missions" aria-label={t('junior_missions')}>
    {#each missions as m, i (m.id)}
      <button
        type="button"
        class="mission"
        aria-current={i === index ? 'true' : undefined}
        aria-label={`${i + 1}. ${missionName(m)}${stars[m.id] ? ` (${stars[m.id]} ${t('junior_stars')})` : ''}`}
        onclick={() => choose(i)}
      >
        <span aria-hidden="true">{i + 1}</span>
        <span class="earned" aria-hidden="true">
          {#each [1, 2] as s (s)}
            <svg viewBox="0 0 24 24" class:on={(stars[m.id] ?? 0) >= s}><path d={STAR_ICON} /></svg>
          {/each}
        </span>
      </button>
    {/each}
  </nav>

  <h2 class="title">{missionName(mission)}</h2>

  <svg
    class="board"
    class:bump={flash === 'bump'}
    viewBox={`0 0 ${mission.grid.cols * SIZE} ${mission.grid.rows * SIZE}`}
    role="img"
    aria-label={`${missionName(mission)}. ${t('junior_robot_at')} ${cellName(robot)}, ${t('junior_goal_at')} ${mission.target}.`}
  >
    {#each Array.from({ length: mission.grid.rows }, (_, r) => r) as r (r)}
      {#each Array.from({ length: mission.grid.cols }, (_, c) => c) as c (c)}
        <rect
          class="cell"
          x={c * SIZE + 2}
          y={r * SIZE + 2}
          width={SIZE - 4}
          height={SIZE - 4}
          rx="8"
        />
      {/each}
    {/each}
    {#each mission.obstacles as o (o)}
      {@const p = parseCell(o)}
      {#if p}
        <g transform={`translate(${p.col * SIZE + 8} ${p.row * SIZE + 8}) scale(2)`}>
          <path d={ROCK_ICON} fill="#7d6e5e" />
        </g>
      {/if}
    {/each}
    <rect
      class="goal"
      x={target.col * SIZE + 2}
      y={target.row * SIZE + 2}
      width={SIZE - 4}
      height={SIZE - 4}
      rx="8"
    />
    <g transform={`translate(${target.col * SIZE + 8} ${target.row * SIZE + 8}) scale(2)`}>
      <path d={theme.target} fill={theme.targetColour} />
    </g>
    <g class="robot" style={`transform: translate(${robot.col * SIZE}px, ${robot.row * SIZE}px)`}>
      <g transform={`rotate(${angle[robot.heading]} 32 32)`}>
        <path d="M32 1l7 9H25z" fill="#222" />
      </g>
      <circle cx="32" cy="32" r="22" fill="#fff" stroke={theme.robotColour} stroke-width="4" />
      <g transform="translate(16 16) scale(1.333)">
        <path
          d={theme.robot}
          fill={theme.robotColour}
          stroke={theme.robotColour}
          stroke-width="0.6"
        />
      </g>
      {#if flash === 'light'}
        <circle cx="32" cy="32" r="28" fill="none" stroke="#f9a825" stroke-width="6" />
      {/if}
    </g>
  </svg>

  <p class="label">{t('junior_program')}</p>
  <ol class="row" aria-label={t('junior_program')}>
    <li>
      <span
        class="block start"
        style={`--c:${colourOf('start')}`}
        role="img"
        aria-label={t('junior_start')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={START_ICON} /></svg>
      </span>
    </li>
    {#each cards as c (c.from)}
      <li>
        <button
          type="button"
          class="block"
          class:lit={lit !== null && lit >= c.from && lit <= c.to}
          style={`--c:${colourOf(c.action)}`}
          aria-label={`${cardName(c)}. ${t('junior_take_out')}`}
          disabled={running}
          onclick={() => removeCard(c)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={BLOCK_ICON[c.action]} />
          </svg>
          {#if c.times}
            <span class="under" aria-hidden="true">{c.times.slice(1)}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ol>

  <div class="palette" aria-label={t('junior_blocks')} role="group">
    {#each mission.blocks as b (b)}
      <button
        type="button"
        class="block big"
        style={`--c:${colourOf(b)}`}
        aria-label={blockName(b)}
        disabled={running}
        onclick={() => add(b)}
      >
        {#if b.startsWith('x')}
          <span class="times" aria-hidden="true">×{b.slice(1)}</span>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={BLOCK_ICON[b as keyof typeof BLOCK_ICON]} />
          </svg>
        {/if}
      </button>
    {/each}
  </div>

  <div class="controls">
    <button
      type="button"
      class="tool"
      aria-label={t('junior_undo')}
      disabled={running || !program.length}
      onclick={undo}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UNDO_ICON} fill-rule="evenodd" /></svg>
    </button>
    <button
      type="button"
      class="tool"
      aria-label={t('junior_clear')}
      disabled={running || !program.length}
      onclick={clear}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CLEAR_ICON} /></svg>
    </button>
    <button
      type="button"
      class="tool"
      aria-label={t('junior_say')}
      aria-pressed={speak}
      onclick={() => (speak = !speak)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={SPEAK_ICON} /></svg>
    </button>
    <button
      type="button"
      class="tool"
      aria-label={t('junior_big')}
      aria-pressed={big}
      onclick={toggleBig}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={BIG_ICON} /></svg>
    </button>
    <button
      type="button"
      class="play"
      aria-label={t('junior_run')}
      disabled={running}
      onclick={run}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PLAY_ICON} /></svg>
    </button>
  </div>

  <p class="result" aria-live="polite">
    {#if result}
      {#if result.stars > 0}
        <span aria-hidden="true" class="won">
          {#each Array.from({ length: result.stars }, (_, s) => s) as s (s)}
            <svg viewBox="0 0 24 24"><path d={STAR_ICON} /></svg>
          {/each}
        </span>
      {/if}
      {announce}
    {:else}
      <span class="visually-hidden">{announce}</span>
    {/if}
  </p>

  <p class="adults">
    <a href={`${base}cards/`}>{t('junior_cards_title')}</a>
    <a href={`${base}sheet/${mission.id}/`}>{t('junior_print_mission')}</a>
  </p>
</div>

<style>
  .adults {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
    justify-content: center;
    font-size: 0.9rem;
    margin: 0;
  }
  .adults a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  /* Projector layout: board beside the blocks on a wide screen, everything bigger. */
  .junior.big {
    max-width: none;
    background: #fffaf2;
    padding: var(--space-4);
  }
  .junior.big .block {
    width: 72px;
    height: 72px;
  }
  .junior.big .block svg {
    width: 48px;
    height: 48px;
  }
  .junior.big .block.big {
    width: 100%;
    height: 88px;
  }
  .junior.big .title {
    font-size: 2rem;
  }
  .junior.big .board {
    width: min(100%, 40rem);
  }
  @media (min-width: 60rem) {
    .junior.big {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
      align-content: start;
    }
    .junior.big > .missions,
    .junior.big > .title {
      grid-column: 1 / -1;
    }
    .junior.big > .board {
      grid-row: span 6;
    }
  }
  .junior {
    display: grid;
    gap: var(--space-2);
    justify-items: center;
    max-width: 30rem;
    margin-inline: auto;
    padding: var(--space-2);
  }
  .missions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: center;
  }
  .mission {
    min-width: 56px;
    min-height: 56px;
    border-radius: 14px;
    border: 3px solid #b48a5a;
    background: #fff;
    color: #3b2a1a;
    font: inherit;
    font-weight: 800;
    font-size: 1.3rem;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .mission[aria-current='true'] {
    background: #ffe9c7;
    border-color: #8b4513;
  }
  .earned {
    display: flex;
  }
  .earned svg {
    width: 16px;
    height: 16px;
    fill: #ddd;
  }
  .earned svg.on,
  .won svg {
    fill: #f2a900;
  }
  .title {
    margin: 0;
    font-size: 1.2rem;
    text-align: center;
  }
  .board {
    width: min(100%, 22rem);
    height: auto;
    background: #f3ead9;
    border-radius: 12px;
  }
  .board.bump {
    animation: shake 0.3s;
  }
  @keyframes shake {
    25% {
      transform: translateX(-6px);
    }
    75% {
      transform: translateX(6px);
    }
  }
  .cell {
    fill: #e4efd6;
  }
  .goal {
    fill: #d6ebf7;
  }
  .robot {
    transition: transform 0.45s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .robot {
      transition: none;
    }
    .board.bump {
      animation: none;
    }
  }
  .label {
    margin: 0;
    font-size: 0.9rem;
  }
  .row {
    list-style: none;
    margin: 0;
    padding: var(--space-2);
    display: flex;
    flex-wrap: wrap;
    gap: 16px 6px;
    min-height: 68px;
    width: 100%;
    box-sizing: border-box;
    border: 3px dashed #b48a5a;
    border-radius: 14px;
    background: #fff;
  }
  .block {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 0;
    background: var(--c);
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }
  .block svg {
    width: 34px;
    height: 34px;
    fill: #fff;
  }
  .block.start {
    cursor: default;
  }
  .block.lit {
    outline: 5px solid #f2a900;
    outline-offset: 2px;
    transform: scale(1.1);
  }
  .times {
    font-weight: 900;
    font-size: 1.35rem;
  }
  /* The repeat number under its card, as CAPS writes it (FR-11). */
  .block {
    position: relative;
  }
  .under {
    position: absolute;
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    min-width: 24px;
    height: 24px;
    border-radius: 12px;
    border: 2px solid #b85c00;
    background: #fff;
    color: #1f1a14;
    font-weight: 900;
    font-size: 0.95rem;
    line-height: 20px;
  }
  .palette {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
    width: 100%;
  }
  .block.big {
    width: 100%;
    height: 64px;
  }
  .block.big svg {
    width: 40px;
    height: 40px;
  }
  .controls {
    display: grid;
    grid-template-columns: 56px 56px 56px 56px 1fr;
    gap: var(--space-2);
    width: 100%;
  }
  .tool,
  .play {
    min-height: 56px;
    border-radius: 14px;
    border: 0;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .tool {
    background: #ece3d3;
  }
  .tool svg {
    width: 28px;
    height: 28px;
    fill: #3b2a1a;
    stroke: #3b2a1a;
    stroke-width: 0.5;
  }
  .tool[aria-pressed='true'] {
    background: #3b2a1a;
  }
  .tool[aria-pressed='true'] svg {
    fill: #fff;
    stroke: #fff;
  }
  .play {
    background: #2e7d32;
  }
  .play svg {
    width: 36px;
    height: 36px;
    fill: #fff;
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  button:focus-visible {
    outline: 4px solid #1c5fb8;
    outline-offset: 2px;
  }
  .result {
    min-height: 2.5rem;
    margin: 0;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .won svg {
    width: 32px;
    height: 32px;
  }
</style>
