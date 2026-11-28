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
    runJunior,
    cardBlocks,
    cardsLeft,
    chooseAnswer,
    parsonsLeft,
    predictAnswer
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
  // The learner's program. In a "complete" mission it is made from the given program, with each
  // gap filled from `fills` (FR-12); in other kinds it is edited freely (fix and shorten start
  // from the given program). Predict and choose missions have no row to edit.
  let free = $state<Block[]>([]);
  let fills = $state<(Block[] | null)[]>([]);
  /** The gap filled last (a repeat number goes under its card). */
  let lastGap = $state<number | null>(null);
  const editable = $derived(mission.kind !== 'predict' && mission.kind !== 'choose');
  const program = $derived.by((): Block[] => {
    if (mission.kind !== 'complete') return mission.kind === 'predict' ? given() : free;
    let g = 0;
    return (mission.given ?? []).flatMap((b) => (b === null ? (fills[g++] ?? []) : [b]));
  });
  const given = () => (mission.given ?? []).filter((b): b is Block => b !== null);
  const gapsLeft = $derived(
    mission.kind === 'complete' ? fills.filter((f) => f === null).length : 0
  );
  /** Predict: the square the learner tapped. Choose: the way they picked. */
  let guess = $state<{ col: number; row: number } | null>(null);
  let picked = $state<number | null>(null);
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
    const m = missions[i] as Mission;
    free = m.kind === 'fix' || m.kind === 'shorten' ? [...((m.given ?? []) as Block[])] : [];
    fills = (m.given ?? []).filter((b) => b === null).map(() => null);
    lastGap = null;
    guess = null;
    picked = null;
    result = null;
    place();
    say(taskText(m));
  };
  const taskText = (m: Mission) =>
    [
      t(`junior_task_${m.kind}`),
      m.cards ? t('junior_task_pack') : '',
      m.max_cards !== undefined ? t('junior_task_max').replace('{n}', String(m.max_cards)) : ''
    ]
      .filter(Boolean)
      .join(' ');

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
    action: Action | null;
    times: Block | null;
    /** The program indexes this card covers (its repeat number and itself). */
    from: number;
    to: number;
    /** "complete": the gap this card fills (null when it is still empty), or kept (given). */
    gap?: number;
    kept?: boolean;
  }
  function toCards(list: readonly Block[], at = 0): Card[] {
    const out: Card[] = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as Block;
      if (isRepeat(b)) {
        const next = list[i + 1];
        if (next !== undefined && !isRepeat(next)) {
          out.push({ action: next as Action, times: b, from: at + i, to: at + i + 1 });
          i++;
        }
        continue;
      }
      out.push({ action: b as Action, times: null, from: at + i, to: at + i });
    }
    return out;
  }
  const cards = $derived.by((): Card[] => {
    if (mission.kind !== 'complete') return toCards(program);
    // Given cards stay; each gap is an empty box until it is filled.
    const out: Card[] = [];
    const gv = mission.given ?? [];
    let at = 0;
    let g = 0;
    for (let i = 0; i < gv.length; i++) {
      const b = gv[i];
      if (b === undefined) continue;
      if (b === null) {
        const f = fills[g];
        if (f) {
          for (const c of toCards(f, at)) out.push({ ...c, gap: g });
          at += f.length;
        } else out.push({ action: null, times: null, from: -1, to: -1, gap: g });
        g++;
        continue;
      }
      const pair: Block[] = isRepeat(b) ? [b, gv[i + 1] as Block] : [b];
      for (const c of toCards(pair, at)) out.push({ ...c, kept: true });
      at += pair.length;
      if (isRepeat(b)) i++;
    }
    return out;
  });
  const cardName = (c: Card) =>
    c.action === null
      ? t('junior_gap')
      : c.times
        ? `${blockName(c.action)}, ${blockName(c.times)}`
        : blockName(c.action);
  // Card limits (FR-14): how many of each card are left, or how many cards in all.
  const left = $derived(parsonsLeft(mission, program));
  const allLeft = $derived(cardsLeft(mission, program));
  /** The palette: the mission's cards (a Parsons set shows each card once, with its count). */
  const palette = $derived(
    mission.cards ? [...new Set(mission.cards)].map(cardBlocks) : mission.blocks.map((b) => [b])
  );
  const fitsLimits = (next: Block[]) => {
    const l = parsonsLeft(mission, next);
    if (l && [...l.values()].some((n) => n < 0)) return 'junior_none_left';
    const a = cardsLeft(mission, next);
    if (a !== null && a < 0) return 'junior_full';
    return null;
  };

  function addCard(blocks: Block[]) {
    if (blocks.length === 1) {
      add(blocks[0] as Block);
      return;
    }
    // A Parsons card with its repeat number: added as one card.
    if (running || !editable) return;
    result = null;
    place();
    const next = [...free, ...blocks];
    const no = fitsLimits(next);
    if (no) {
      say(t(no));
      return;
    }
    free = next;
    say(cardName(toCards(blocks)[0] as Card));
  }
  function fillGap(b: Block) {
    if (isRepeat(b)) {
      const g = lastGap;
      const f = g === null ? null : fills[g];
      const action = f?.at(-1);
      if (g === null || !f || !action || !MOVES.includes(action as Action)) {
        say(t('junior_repeat_first'));
        return;
      }
      fills = fills.map((x, k) => (k === g ? [b, action] : x));
      say(`${blockName(action)}, ${blockName(b)}`);
      return;
    }
    const g = fills.findIndex((f) => f === null);
    if (g < 0) {
      say(t('junior_full'));
      return;
    }
    fills = fills.map((x, k) => (k === g ? [b] : x));
    lastGap = g;
    say(blockName(b));
  }
  function add(b: Block) {
    if (running || !editable) return;
    result = null;
    place();
    if (mission.kind === 'complete') {
      fillGap(b);
      return;
    }
    if (isRepeat(b)) {
      // The number goes under the last card, if that card moves or turns the robot.
      const last = cards.at(-1);
      if (!last || last.action === null || !MOVES.includes(last.action)) {
        say(t('junior_repeat_first'));
        return;
      }
      const next: Block[] = [...free.slice(0, last.from), b, last.action];
      const no = fitsLimits(next);
      if (no) {
        say(t(no));
        return;
      }
      free = next;
      say(cardName({ ...last, times: b }));
      return;
    }
    if (cardCount(free) >= MAX_BLOCKS) {
      say(t('junior_full'));
      return;
    }
    const next = [...free, b];
    const no = fitsLimits(next);
    if (no) {
      say(t(no));
      return;
    }
    free = next;
    say(blockName(b));
  }
  function removeCard(c: Card) {
    if (running || !editable) return;
    result = null;
    place();
    if (c.kept) {
      say(t('junior_kept'));
      return;
    }
    if (c.gap !== undefined) {
      if (c.action === null) return;
      fills = fills.map((x, k) => (k === c.gap ? null : x));
      lastGap = null;
      say(cardName(c));
      return;
    }
    free = free.filter((_, k) => k < c.from || k > c.to);
    say(cardName(c));
  }
  const undo = () => {
    const last = [...cards].reverse().find((c) => !c.kept && c.action !== null);
    if (last) removeCard(last);
  };
  const clear = () => {
    if (running) return;
    free = [];
    fills = fills.map(() => null);
    lastGap = null;
    result = null;
    place();
  };
  /** Back to the program the mission started with (fix and shorten). */
  const reset = () => {
    if (running) return;
    free = [...((mission.given ?? []) as Block[])];
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
  async function run(prog: readonly Block[] = program) {
    if (running) return;
    if (gapsLeft > 0) {
      say(t('junior_fill_first'));
      return;
    }
    place();
    result = null;
    const r = runJunior(mission, prog);
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
    // Predict and choose are right or not (FR-12); shorten needs fewer cards than it started with.
    if (mission.kind === 'predict' || mission.kind === 'choose') {
      const right =
        mission.kind === 'predict'
          ? (() => {
              const end = predictAnswer(mission);
              return !!guess && !!end && guess.col === end.col && guess.row === end.row;
            })()
          : picked === chooseAnswer(mission);
      finish({ ...r, stars: right ? 2 : 0 }, right ? t('junior_right') : t('junior_wrong'));
      return;
    }
    if (
      mission.kind === 'shorten' &&
      r.outcome === 'reached' &&
      cardCount(prog) >= cardCount(given())
    ) {
      finish({ ...r, stars: 0 }, t('junior_not_shorter'));
      return;
    }
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
    finish(r, message);
  }
  function finish(r: Run, message: string) {
    result = r;
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

  // Predict: tap the square where it will stop, then watch.
  function predict(col: number, row: number) {
    if (running || result) return;
    guess = { col, row };
    void run(given());
  }
  // Choose: tap the way you think works best, then watch it.
  function pick(i: number) {
    if (running) return;
    picked = i;
    void run(mission.options?.[i] ?? []);
  }
  const showGoal = $derived(mission.kind !== 'predict' || result !== null);

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
  <p class="task">{taskText(mission)}</p>

  <div class="boardwrap">
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
      {#if showGoal}
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
      {/if}
      {#if guess}
        <rect
          class="guess"
          x={guess.col * SIZE + 6}
          y={guess.row * SIZE + 6}
          width={SIZE - 12}
          height={SIZE - 12}
          rx="6"
        />
      {/if}
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
    {#if mission.kind === 'predict'}
      <!-- Tap a square: see-through buttons over the board's squares (FR-12 predict). -->
      <div
        class="squares"
        style={`--cols:${mission.grid.cols};--rows:${mission.grid.rows}`}
        role="group"
        aria-label={t('junior_task_predict')}
      >
        {#each Array.from({ length: mission.grid.rows }, (_, r) => r) as r (r)}
          {#each Array.from({ length: mission.grid.cols }, (_, c) => c) as c (c)}
            <button
              type="button"
              class="square"
              class:chosen={guess?.col === c && guess?.row === r}
              aria-label={t('junior_square').replace('{cell}', cellName({ col: c, row: r }))}
              disabled={running || result !== null}
              onclick={() => predict(c, r)}
            ></button>
          {/each}
        {/each}
      </div>
    {/if}
  </div>

  {#if mission.kind === 'choose'}
    <div class="options" role="group" aria-label={t('junior_task_choose')}>
      {#each mission.options ?? [] as option, i (i)}
        {@const label = toCards(option)
          .map((c) => cardName(c))
          .join(', ')}
        <button
          type="button"
          class="option"
          class:picked={picked === i}
          aria-label={`${t('junior_option').replace('{n}', String(i + 1))}: ${label}`}
          disabled={running}
          onclick={() => pick(i)}
        >
          <span class="way" aria-hidden="true">{i + 1}</span>
          {#each toCards(option) as c (c.from)}
            <span
              class="block small"
              class:lit={picked === i && lit !== null && lit >= c.from && lit <= c.to}
              style={`--c:${colourOf(c.action ?? 'start')}`}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24">
                <path d={BLOCK_ICON[c.action as keyof typeof BLOCK_ICON]} />
              </svg>
              {#if c.times}<span class="under">{c.times.slice(1)}</span>{/if}
            </span>
          {/each}
        </button>
      {/each}
    </div>
  {/if}

  {#if mission.kind !== 'choose'}
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
      {#each cards as c, k (`${k}-${c.from}`)}
        <li>
          {#if c.action === null}
            <span class="block gap" role="img" aria-label={t('junior_gap')}></span>
          {:else}
            <button
              type="button"
              class="block"
              class:kept={c.kept}
              class:lit={lit !== null && lit >= c.from && lit <= c.to}
              style={`--c:${colourOf(c.action)}`}
              aria-label={`${cardName(c)}. ${c.kept ? t('junior_kept') : editable ? t('junior_take_out') : ''}`}
              disabled={running || !editable}
              onclick={() => removeCard(c)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={BLOCK_ICON[c.action as keyof typeof BLOCK_ICON]} />
              </svg>
              {#if c.times}
                <span class="under" aria-hidden="true">{c.times.slice(1)}</span>
              {/if}
            </button>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  {#if editable}
    {#if allLeft !== null}
      <p class="left" aria-live="polite">
        {t('junior_left').replace('{n}', String(Math.max(0, allLeft)))}
      </p>
    {/if}
    <div class="palette" aria-label={t('junior_blocks')} role="group">
      {#each palette as bs (bs.join(' '))}
        {@const b = bs.at(-1) as Block}
        {@const count = left?.get(bs.join(' '))}
        {@const name =
          bs.length === 2 ? `${blockName(b)}, ${blockName(bs[0] as Block)}` : blockName(b)}
        <button
          type="button"
          class="block big"
          style={`--c:${colourOf(b)}`}
          aria-label={count === undefined
            ? name
            : `${name}, ${t('junior_left').replace('{n}', String(count))}`}
          disabled={running || count === 0}
          onclick={() => addCard(bs)}
        >
          {#if b.startsWith('x')}
            <span class="times" aria-hidden="true">×{b.slice(1)}</span>
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={BLOCK_ICON[b as keyof typeof BLOCK_ICON]} />
            </svg>
          {/if}
          {#if bs.length === 2}
            <span class="under" aria-hidden="true">{(bs[0] as string).slice(1)}</span>
          {/if}
          {#if count !== undefined}
            <span class="count" aria-hidden="true">{count}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <div class="controls">
    {#if mission.kind === 'fix' || mission.kind === 'shorten'}
      <button
        type="button"
        class="tool"
        aria-label={t('junior_reset')}
        disabled={running}
        onclick={reset}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={START_ICON} /></svg>
      </button>
    {/if}
    {#if editable}
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
    {/if}
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
    {#if editable}
      <button
        type="button"
        class="play"
        aria-label={t('junior_run')}
        disabled={running}
        onclick={() => run()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PLAY_ICON} /></svg>
      </button>
    {/if}
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
    /* Full screen shows only this element: let it scroll when there are many missions. */
    overflow-y: auto;
    max-height: 100vh;
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
  .junior.big .boardwrap {
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
    display: block;
    width: 100%;
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
  .boardwrap {
    position: relative;
    width: min(100%, 22rem);
    margin-inline: auto;
  }
  .squares {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
  }
  .square {
    background: transparent;
    border: 0;
    margin: 0;
    padding: 0;
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
  }
  .square:focus-visible,
  .square.chosen {
    outline: 4px solid #1c5fb8;
    outline-offset: -6px;
    border-radius: 8px;
  }
  .guess {
    fill: none;
    stroke: #1c5fb8;
    stroke-width: 5;
    stroke-dasharray: 8 5;
  }
  .task {
    margin: 0;
    text-align: center;
    font-weight: 600;
  }
  .left {
    margin: 0;
    text-align: center;
    font-weight: 700;
  }
  .block.gap {
    border: 3px dashed #5d6b75;
    background: #fff;
  }
  .block.kept {
    outline: 3px solid #333;
    outline-offset: 1px;
  }
  .count {
    position: absolute;
    top: 2px;
    right: 4px;
    min-width: 1.4em;
    border-radius: 999px;
    background: #fff;
    color: #111;
    font-weight: 800;
    font-size: 0.9rem;
    line-height: 1.4em;
    text-align: center;
  }
  .options {
    display: grid;
    gap: var(--space-3);
  }
  .option {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 56px;
    padding: 6px 8px;
    border: 3px solid #c9bfae;
    border-radius: 12px;
    background: #fff;
    cursor: pointer;
  }
  .option.picked {
    border-color: #1c5fb8;
  }
  .way {
    font-weight: 800;
    font-size: 1.4rem;
    min-width: 1.5em;
  }
  .block.small {
    width: 40px;
    height: 40px;
  }
  .block.small svg {
    width: 26px;
    height: 26px;
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
