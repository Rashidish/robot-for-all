<script lang="ts">
  // The Robot tab (M4 spec step 2, FR-1–FR-7): a 2D world from above, driven by the robot calls
  // of the program running on the on-screen micro:bit. The world answers the robot's sensors.
  import { onDestroy } from 'svelte';
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
    monitorSample,
    type Pushes,
    saveReport,
    squareAt,
    WorldLink
  } from '../code/world-link';

  interface Props {
    worlds: World[];
    labels: Record<string, string>;
    /** Shown or hidden; the world keeps running either way. */
    visible: boolean;
    /** Sends the world's sensor answers into the on-screen micro:bit. */
    push: (pushes: Pushes) => void;
  }
  let { worlds, labels, visible, push }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const key = (id: string) => id.replaceAll('-', '_');

  let worldId = $state(worlds[0]?.id ?? '');
  const world = $derived(worlds.find((w) => w.id === worldId) ?? worlds[0]);
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
    sinceSample = MONITOR_EVERY_MS;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }

  /** The learner pressed Stop: keep the run report (status "running"). */
  export function stop(): void {
    if (link && status === 'running') {
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
    if (canvas.width !== Math.round(width * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
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
    void [visible, width, worldId, showTrail, showGrid];
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
      {#each worlds as w (w.id)}
        <option value={w.id}>{t(`world_${key(w.id)}_name`)}</option>
      {/each}
    </select>
  </div>
  {#if world?.challenge}
    <p class="challenge">{t(world.challenge)}</p>
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
