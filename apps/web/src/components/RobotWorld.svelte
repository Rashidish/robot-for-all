<script lang="ts">
  // The Robot tab (M4 spec step 2, FR-1–FR-7): a 2D world from above, driven by the robot calls
  // of the program running on the on-screen micro:bit. The world answers the robot's sensors.
  import { onDestroy } from 'svelte';
  import type { RobotCall } from '../../../../packages/robots/src/index';
  import type { World } from '../../../../packages/sim/src/index';
  import { drawWorld } from '../code/world-draw';
  import { type Pushes, saveReport, WorldLink } from '../code/world-link';

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
    last = now;
    push(pushes);
    const sim = link.sim;
    timeMs = sim.timeMs;
    const p = sim.pose;
    const end = trail[trail.length - 1];
    if (!end || Math.hypot(end.x - p.x, end.y - p.y) > 10) trail.push({ x: p.x, y: p.y });
    if (sim.status !== 'running') finish();
    if (visible) draw();
    if (status === 'running') frame = requestAnimationFrame(loop);
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
    if (link) drawWorld(ctx, link.sim, { scale: scale * dpr, trail: showTrail ? trail : null });
    else drawIdle(ctx, dpr);
  }

  /** Before the first Run: the world with the robot at its start. */
  function drawIdle(ctx: CanvasRenderingContext2D, dpr: number) {
    if (!world) return;
    const preview = new WorldLink(world, '');
    drawWorld(ctx, preview.sim, { scale: scale * dpr, trail: null });
  }

  function where() {
    if (!link) {
      announce = t('sim_run_first');
      return;
    }
    const p = link.sim.pose;
    announce =
      `${t('sim_position')}: x ${Math.round(p.x)} mm, y ${Math.round(p.y)} mm, ` +
      `${t('sim_heading')} ${Math.round(p.heading)}°, ${t('sim_light_level')} ${link.sim.lightLevel()}`;
  }

  function chooseWorld(id: string) {
    stop();
    link = null;
    status = 'idle';
    worldId = id;
    requestAnimationFrame(draw);
  }

  $effect(() => {
    // Redraw when shown, resized or the world changes.
    void [visible, width, worldId, showTrail];
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
    <button type="button" class="plain" onclick={where}>{t('sim_where')}</button>
  </div>
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
