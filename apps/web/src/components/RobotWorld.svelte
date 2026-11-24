<script lang="ts">
  // The Robot tab (M4 spec step 2, FR-1–FR-7): a 2D world from above, driven by the robot calls
  // of the program running on the on-screen micro:bit. The world answers the robot's sensors.
  import { onDestroy, tick } from 'svelte';
  import type { RobotCall } from '../../../../packages/robots/src/index';
  import type { World } from '../../../../packages/sim/src/index';
  import { drawWorld } from '../code/world-draw';
  import {
    GRAPH_SAMPLES,
    graphRange,
    gridFor,
    MONITOR_EVERY_MS,
    MONITOR_VALUES,
    type MonitorValue,
    MAZE_NUMBER_MAX,
    missionList,
    monitorSample,
    type Pushes,
    saveReport,
    pickerGroups,
    type SeasonEntry,
    squareAt,
    withMaze,
    WorldLink
  } from '../code/world-link';
  import { saDate, seasonState } from '../../../../packages/sim/src/season';

  interface Props {
    worlds: World[];
    /** Seasons (FR-20), newest first, each with its badge. */
    seasons: SeasonEntry[];
    /** Each world's spec by id, so a maze course can be rebuilt with another maze number. */
    specs: Record<string, unknown>;
    labels: Record<string, string>;
    /** Shown or hidden; the world keeps running either way. */
    visible: boolean;
    /** Sends the world's sensor answers into the on-screen micro:bit. */
    push: (pushes: Pushes) => void;
  }
  let { worlds, seasons, specs, labels, visible, push }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const key = (id: string) => id.replaceAll('-', '_');

  let worldId = $state(worlds[0]?.id ?? '');
  const baseWorld = $derived(worlds.find((w) => w.id === worldId) ?? worlds[0]);

  // Seasons (FR-20): their courses are grouped in the picker; a season course shows its badge.
  const groups = $derived(pickerGroups(worlds, seasons));
  const season = $derived(seasons.find((e) => Object.values(e.season.courses).includes(worldId)));
  const seasonNow = $derived(season ? seasonState(season.season, saDate(new Date())) : null);

  // Maze courses (FR-18): a maze number and size give one exact maze, the same on every device.
  let mazeNumber = $state(1);
  let mazeSize = $state(4);
  const world = $derived(
    baseWorld?.maze ? withMaze(specs[baseWorld.id], mazeNumber, mazeSize) : baseWorld
  );

  /** The mission checklist (FR-17), updated with the Monitor. */
  let missions = $state<{ id: string; points: number; done: boolean }[]>([]);
  let link: WorldLink | null = null;
  let status = $state<'idle' | 'running' | 'done' | 'failed'>('idle');
  let reason = $state<string | null>(null);
  let timeMs = $state(0);
  let score = $state<number | null>(null);
  let showTrail = $state(true);
  let announce = $state('');
  let width = $state(320);
  let canvas: HTMLCanvasElement | undefined = $state();
  let trail: { x: number; y: number }[] = [];
  let frame = 0;
  let last = 0;

  // Monitor (FR-11) and location readout (FR-12): sampled 5 times a second.
  let showGrid = $state(false);
  let sample = $state<Record<MonitorValue, number> | null>(null);
  let history = $state<Record<MonitorValue, number>[]>([]);
  let graphValue = $state<MonitorValue>('light');
  let lastGesture = $state<string | null>(null);
  let readout = $state<{ x: number; y: number; heading: number; square: string } | null>(null);
  let sinceSample = 0;

  const scale = $derived(world ? width / world.width : 1);
  const height = $derived(world ? Math.round(world.height * scale) : 200);

  /** Starts the world with the program that is starting on the micro:bit. */
  export function start(mainPy: string): void {
    if (!world) return;
    stopLoop();
    link = new WorldLink(world, mainPy);
    trail = [{ x: world.start.x, y: world.start.y }];
    status = 'running';
    reason = null;
    timeMs = 0;
    score = null;
    history = [];
    lastGesture = null;
    missions = missionList(link.sim);
    sinceSample = MONITOR_EVERY_MS;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }

  /** The learner pressed Stop: keep the run report (status "running"). */
  export function stop(): void {
    if (link && status === 'running') {
      takeSample();
      link.sim.stop();
      saveReport(safeStorage(), link.report());
    }
    stopLoop();
    if (status === 'running') status = 'idle';
  }

  export function call(c: RobotCall): void {
    link?.call(c);
  }

  function safeStorage(): Storage | undefined {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }

  function stopLoop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function loop(now: number) {
    if (!link) return;
    const pushes = link.tick(now - last);
    sinceSample += now - last;
    last = now;
    push(pushes);
    if (pushes.shake) lastGesture = t('gesture_shake');
    if (sinceSample >= MONITOR_EVERY_MS) takeSample();
    const sim = link.sim;
    timeMs = sim.timeMs;
    const p = sim.pose;
    const end = trail[trail.length - 1];
    if (!end || Math.hypot(end.x - p.x, end.y - p.y) > 10) trail.push({ x: p.x, y: p.y });
    if (sim.status !== 'running') finish();
    if (visible) draw();
    if (status === 'running') frame = requestAnimationFrame(loop);
  }

  function takeSample() {
    if (!link || !world) return;
    sinceSample = 0;
    sample = monitorSample(link.sim);
    missions = missionList(link.sim);
    history = [...history, sample].slice(-GRAPH_SAMPLES);
    const p = link.sim.pose;
    readout = {
      x: Math.round(p.x),
      y: Math.round(p.y),
      heading: Math.round(p.heading) % 360,
      square: squareAt(world, p.x, p.y)
    };
  }

  /** The graph line for the chosen value, in a 300 × 80 box (oldest on the left). */
  const graphPoints = $derived.by(() => {
    const [lo, hi] = graphRange(graphValue);
    return history
      .map((h, i) => {
        const x = (i / (GRAPH_SAMPLES - 1)) * 300;
        const y = 78 - ((h[graphValue] - lo) / (hi - lo)) * 76;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  /** A value as the Monitor shows it: speeds in %, sensors as yes/no. */
  function shown(v: MonitorValue, n: number): string {
    if (v === 'motor_left' || v === 'motor_right') return `${n}%`;
    if (v === 'light') return String(n);
    if (v === 'pen') return t(n ? 'block_pen_down' : 'block_pen_up');
    return t(n ? 'sim_yes' : 'sim_no');
  }

  function finish() {
    if (!link) return;
    // The loop stops here, so take a last sample: the Monitor must show how the run ended.
    takeSample();
    const report = link.report();
    saveReport(safeStorage(), report);
    status = report.status === 'done' ? 'done' : 'failed';
    reason = report.reason ?? null;
    score = report.score ?? null;
    announce = message();
  }

  function message(): string {
    if (status === 'done') return `${t('sim_challenge_done')} ${seconds(timeMs)}`;
    if (status === 'failed') {
      return reason === 'bumped' ? t('sim_challenge_bumped') : t('sim_challenge_time_up');
    }
    return '';
  }

  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} ${t('sim_seconds')}`;

  function draw() {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !world) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Worlds differ in shape, so check the height too (a new world can have the same width).
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const grid = showGrid ? gridFor(world) : null;
    if (link)
      drawWorld(ctx, link.sim, { scale: scale * dpr, trail: showTrail ? trail : null, grid, dpr });
    else drawIdle(ctx, dpr, grid);
  }

  /** Before the first Run: the world with the robot at its start. */
  function drawIdle(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    grid: ReturnType<typeof gridFor> | null
  ) {
    if (!world) return;
    const preview = new WorldLink(world, '');
    drawWorld(ctx, preview.sim, { scale: scale * dpr, trail: null, grid, dpr });
  }

  function where() {
    if (!link) {
      announce = t('sim_run_first');
      return;
    }
    const p = link.sim.pose;
    announce =
      `${t('sim_position')}: x ${Math.round(p.x)} mm, y ${Math.round(p.y)} mm, ` +
      `${t('sim_heading')} ${Math.round(p.heading) % 360}°, ${t('sim_square')} ` +
      `${world ? squareAt(world, p.x, p.y) : ''}, ${t('sim_light_level')} ${link.sim.lightLevel()}`;
  }

  /** A new maze number or size: a different maze, so any run on the old one ends. */
  function setMaze(n: number, size: number) {
    stop();
    link = null;
    status = 'idle';
    readout = null;
    mazeNumber = Number.isFinite(n) ? Math.max(0, Math.min(MAZE_NUMBER_MAX, Math.floor(n))) : 0;
    mazeSize = size;
    requestAnimationFrame(draw);
  }

  /** Chooses a world from outside, e.g. a lesson's world (FR-8). */
  export function select(id: string): void {
    chooseWorld(id);
  }

  // Print course (FR-19): the page code is loaded only when a learner taps Print (spec §5).
  let printPages = $state<string[]>([]);
  let printing = $state(false);

  async function printCourse() {
    if (!world || printing) return;
    printing = true;
    try {
      const { coursePages } = await import('../../../../packages/sim/src/print');
      const name = t(`world_${key(world.id)}_name`);
      const title = world.maze ? `${name} ${mazeNumber} (${mazeSize} × ${mazeSize})` : name;
      printPages = coursePages(world, {
        title,
        printAt100: t('sim_print_actual_size'),
        calibration: t('sim_print_calibration'),
        size: t('sim_print_size'),
        assembly: t('sim_print_assembly'),
        tile: t('sim_print_tile'),
        tiles: t('sim_print_tiles'),
        buildSheet: t('sim_print_build_sheet'),
        pieces: {
          wall: t('sim_print_piece_wall'),
          target: t('sim_print_piece_target'),
          tunnel: t('sim_print_piece_tunnel')
        },
        edges: {
          N: t('sim_print_edge_north'),
          E: t('sim_print_edge_east'),
          S: t('sim_print_edge_south'),
          W: t('sim_print_edge_west')
        },
        noPrinter: t('sim_print_no_printer')
      });
      await tick();
      document.documentElement.classList.add('printing-course');
      window.print();
    } finally {
      document.documentElement.classList.remove('printing-course');
      printing = false;
    }
  }

  function chooseWorld(id: string) {
    stop();
    link = null;
    status = 'idle';
    sample = null;
    history = [];
    readout = null;
    worldId = id;
    requestAnimationFrame(draw);
  }

  $effect(() => {
    // Redraw when shown, resized or the world changes.
    void [visible, width, worldId, showTrail, showGrid, mazeNumber, mazeSize];
    if (visible) requestAnimationFrame(draw);
  });

  onDestroy(stopLoop);
</script>

<div class="robot-world">
  <div class="pick">
    <label for="robot-world-pick">{t('sim_world')}</label>
    <select
      id="robot-world-pick"
      value={worldId}
      onchange={(e) => chooseWorld(e.currentTarget.value)}
    >
      {#each groups as g (g.season?.id ?? '')}
        <optgroup label={g.season ? t(g.season.name) : t('sim_worlds_group')}>
          {#each g.worlds as w (w.id)}
            <option value={w.id}>{t(`world_${key(w.id)}_name`)}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </div>
  {#if season && seasonNow}
    <div class="season">
      <img src={season.badge} alt="" width="48" height="48" />
      <p>
        <strong>{t(season.season.name)}</strong>
        <span class="season-state">{t(`sim_season_${seasonNow}`)}</span>
        <span>{t(season.season.about)}</span>
      </p>
    </div>
  {/if}
  {#if world?.challenge}
    <p class="challenge">{t(world.challenge)}</p>
  {/if}

  {#if baseWorld?.maze}
    <div class="maze">
      <label for="robot-maze-number">{t('sim_maze_number')}</label>
      <input
        id="robot-maze-number"
        type="number"
        inputmode="numeric"
        min="0"
        max={MAZE_NUMBER_MAX}
        value={mazeNumber}
        onchange={(e) => setMaze(Number(e.currentTarget.value), mazeSize)}
      />
      <label for="robot-maze-size">{t('sim_maze_size')}</label>
      <select
        id="robot-maze-size"
        value={mazeSize}
        onchange={(e) => setMaze(mazeNumber, Number(e.currentTarget.value))}
      >
        {#each [3, 4, 5, 6] as n (n)}
          <option value={n}>{n} × {n}</option>
        {/each}
      </select>
      <button
        type="button"
        class="plain"
        onclick={() => setMaze(Math.floor(Math.random() * (MAZE_NUMBER_MAX + 1)), mazeSize)}
      >
        {t('sim_maze_new')}
      </button>
    </div>
  {/if}

  <div class="stage" bind:clientWidth={width}>
    <canvas
      bind:this={canvas}
      style:width="{width}px"
      style:height="{height}px"
      role="img"
      aria-label={t('sim_robot_canvas')}
    ></canvas>
  </div>

  {#if readout}
    <p class="readout">
      x {readout.x} mm · y {readout.y} mm · {readout.heading}° ·
      {t('sim_square')} <strong>{readout.square}</strong>
    </p>
  {/if}

  {#if world && world.missions.length > 0}
    <div class="missions">
      <p class="missions-title">{t('sim_missions')}</p>
      <ul>
        {#each world.missions as m (m.id)}
          {@const done = missions.find((x) => x.id === m.id)?.done ?? false}
          <li data-mission={m.id} data-done={done}>
            <span aria-hidden="true">{done ? '✓' : '○'}</span>
            <span>{t(`mission_${key(world.id)}_${key(m.id)}`)}</span>
            <span class="points">{m.points}</span>
            <span class="visually-hidden">{t(done ? 'sim_done' : 'sim_not_yet')}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <p class="run-status" data-status={status}>
    {#if status === 'idle'}
      {t('sim_run_first')}
    {:else}
      <span class="time">{seconds(timeMs)}</span>
      {#if status !== 'running'}<strong class="result">{message()}</strong>{/if}
      {#if score !== null}<span class="score">{t('sim_score')}: {score}</span>{/if}
    {/if}
  </p>

  <div class="world-controls">
    <label class="check">
      <input type="checkbox" bind:checked={showTrail} />
      <span>{t('sim_trail')}</span>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={showGrid} />
      <span>{t('sim_grid')}</span>
    </label>
    <button type="button" class="plain" onclick={where}>{t('sim_where')}</button>
    <button type="button" class="plain print-course" onclick={printCourse} disabled={printing}>
      {t('sim_print_course')}
    </button>
  </div>

  <!-- Course pages for the printer only: true A4 size, 1 unit = 1 mm. -->
  <div class="print-pages" aria-hidden="true">
    {#each printPages as svg, i (i)}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own SVG; all text is escaped -->
      {@html svg}
    {/each}
  </div>

  <details class="monitor">
    <summary>{t('sim_monitor')}</summary>
    <table>
      <caption class="visually-hidden">{t('sim_monitor')}</caption>
      <tbody>
        {#each MONITOR_VALUES as v (v)}
          <tr data-value={v}>
            <th scope="row">{t(`sim_value_${v}`)}</th>
            <td>{sample ? shown(v, sample[v]) : '–'}</td>
          </tr>
        {/each}
        <tr>
          <th scope="row">{t('sim_value_gesture')}</th>
          <td>{lastGesture ?? '–'}</td>
        </tr>
      </tbody>
    </table>
    <div class="graph">
      <label for="robot-graph-pick">{t('sim_graph')}</label>
      <select id="robot-graph-pick" bind:value={graphValue}>
        {#each MONITOR_VALUES as v (v)}
          <option value={v}>{t(`sim_value_${v}`)}</option>
        {/each}
      </select>
      <!-- The table above says the same for screen readers. -->
      <svg viewBox="0 0 300 80" aria-hidden="true" preserveAspectRatio="none">
        <rect x="0" y="0" width="300" height="80" fill="#ffffff" stroke="#8a8a8a" />
        <polyline points={graphPoints} fill="none" stroke="#0b5394" stroke-width="2" />
      </svg>
      <p class="graph-note">{t('sim_graph_last')}</p>
    </div>
  </details>
  <p class="visually-hidden" aria-live="polite">{announce}</p>
</div>

<style>
  .robot-world {
    display: grid;
    gap: 0.5rem;
  }
  .pick {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .pick select {
    min-height: 2.75rem;
  }
  .challenge {
    margin: 0;
    font-size: 0.9rem;
  }
  .season {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.4rem 0.6rem;
    border: 1px solid #2c7a3f;
    border-radius: 6px;
    background: #f4efe3;
    color: #1f1a14;
    font-size: 0.85rem;
  }
  .season img {
    flex: none;
  }
  .season p {
    display: flex;
    flex-direction: column;
    margin: 0;
  }
  .season-state {
    font-weight: 600;
    color: #1d5a2c;
  }
  .stage {
    width: 100%;
    min-width: 0;
  }
  canvas {
    display: block;
    border: 1px solid #8a8a8a;
    border-radius: 4px;
    background: #fbfaf5;
  }
  .run-status {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    min-height: 1.5rem;
  }
  .run-status[data-status='done'] .result {
    color: #1b5e20;
  }
  .run-status[data-status='failed'] .result {
    color: #8b1a1a;
  }
  .world-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .maze {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.25rem 0.5rem;
    align-items: center;
    font-size: 0.9rem;
  }
  .maze input,
  .maze select,
  .maze button {
    min-height: 2.75rem;
  }
  .maze button {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .missions-title {
    margin: 0;
    font-weight: 600;
  }
  .missions ul {
    margin: 0.25rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.25rem;
  }
  .missions li {
    display: grid;
    grid-template-columns: 1.25rem minmax(0, 1fr) auto;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .missions li[data-done='true'] {
    color: #1b5e20;
    font-weight: 600;
  }
  .points {
    font-variant-numeric: tabular-nums;
    color: #555555;
  }
  .print-pages {
    display: none;
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }
    :global(html.printing-course body *) {
      visibility: hidden;
    }
    :global(html.printing-course) .print-pages,
    :global(html.printing-course) .print-pages :global(*) {
      visibility: visible;
    }
    :global(html.printing-course) .print-pages {
      display: block;
      position: absolute;
      left: 0;
      top: 0;
    }
    .print-pages :global(svg) {
      display: block;
      width: 210mm;
      height: 297mm;
      break-after: page;
    }
  }
  .readout {
    margin: 0;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }
  .monitor summary {
    min-height: 2.75rem;
    display: flex;
    align-items: center;
    font-weight: 600;
    cursor: pointer;
  }
  .monitor table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .monitor th,
  .monitor td {
    text-align: left;
    padding: 0.2rem 0.25rem;
    border-bottom: 1px solid #e0e0e0;
    font-weight: normal;
  }
  .monitor td {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .graph {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.25rem 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }
  .graph select {
    min-height: 2.75rem;
  }
  .graph svg {
    grid-column: 1 / -1;
    width: 100%;
    height: 5rem;
  }
  .graph-note {
    grid-column: 1 / -1;
    margin: 0;
    color: #555555;
  }
  .world-controls button {
    min-height: 2.75rem; /* touch target */
  }
  .check {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    min-height: 2.75rem;
  }
</style>
