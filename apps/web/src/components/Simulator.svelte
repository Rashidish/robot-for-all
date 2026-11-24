<script lang="ts">
  // The on-screen micro:bit (M3 spec step 4, ADR-0006): the micro:bit Foundation's MicroPython
  // simulator, built from source and served from our own site, in a same-origin iframe. It runs
  // the same MicroPython as a real micro:bit V2, for blocks and typed Python alike.
  // Around it we add what MakeCode shows: sensor controls, pin and motor state and NeoPixels.
  // Motors and the pen come from robot calls (ADR-0008, simulator patch 0005), never from pins.
  import {
    parseRobotCall,
    SENSOR_NAMES,
    type SensorName
  } from '../../../../packages/robots/src/simulator';
  import RobotWorld from './RobotWorld.svelte';
  import { loadSeasons, loadWorlds, type Pushes, specsById } from '../code/world-link';
  import { featureOn } from '../site';
  import { hidden } from '../withdrawn';
  import { worldReview } from '../../../../packages/sim/src/world';

  // Worlds and courses from content/worlds, checked when the page is built (M4 spec FR-4).
  const worldFiles = import.meta.glob('../../../../content/worlds/*.json', {
    eager: true,
    import: 'default'
  });
  // Withdrawn worlds and seasons are left out of production (more content spec §2.4).
  const allWorlds = loadWorlds(worldFiles);
  const worldSpecs = specsById(worldFiles);
  // Production shows published worlds only, and none that are withdrawn (more content spec).
  const worlds = allWorlds.filter(
    (w) =>
      !hidden('world', w.id) &&
      (__RFA_SHOW_DRAFTS__ || worldReview(worldSpecs[w.id]).status === 'published')
  );
  // Seasons (FR-20): each with its badge, served from our own site.
  // Site settings can switch the Robot tab and the seasons off (back-office spec §6.7).
  const robotOn = featureOn('robot_world');
  const seasons = !featureOn('seasons')
    ? []
    : loadSeasons(
        import.meta.glob('../../../../content/seasons/*.json', { eager: true, import: 'default' }),
        import.meta.glob<string>('../../../../content/seasons/*.svg', {
          eager: true,
          query: '?url',
          import: 'default'
        }),
        // Checked against every world; a withdrawn course simply drops out of its group.
        allWorlds
      ).filter((e) => !hidden('season', e.season.id));

  interface Props {
    src: string;
    labels: Record<string, string>;
    /** The program to run, as MicroPython files; null if the blocks can't be used yet. */
    files: () => Record<string, string> | null;
  }
  let { src, labels, files }: Props = $props();

  /** micro:bit or Robot (M4 spec FR-1). The micro:bit keeps running behind the Robot view. */
  let view = $state<'microbit' | 'robot'>('microbit');
  let robotWorld: RobotWorld | undefined = $state();

  /** While the Robot view is open, the world answers the robot's sensors (spec §6.2). */
  function worldPush(p: Pushes) {
    if (view !== 'robot') return;
    if (p.sensors) post({ kind: 'robot_sensors', values: p.sensors });
    if (p.light !== undefined) post({ kind: 'set_value', id: 'lightLevel', value: p.light });
    if (p.shake) gesture('shake');
  }
  const t = (key: string) => labels[key] ?? key;

  interface RangeSensor {
    id: string;
    type: 'range';
    min: number;
    max: number;
    value: number;
    unit?: string;
  }
  interface EnumSensor {
    id: string;
    type: 'enum';
    choices: string[];
    value: string;
  }
  type Sensor = RangeSensor | EnumSensor;

  /** Sensors we offer controls for, in MakeCode's order, with their label keys. */
  const SENSORS: [string, string][] = [
    ['lightLevel', 'sim_light'],
    ['temperature', 'sim_temperature'],
    ['soundLevel', 'sim_sound'],
    ['accelerometerX', 'sim_tilt_x'],
    ['accelerometerY', 'sim_tilt_y'],
    ['accelerometerZ', 'sim_tilt_z'],
    ['compassHeading', 'sim_compass']
  ];

  let frame: HTMLIFrameElement;
  let sensors = $state<Sensor[]>([]);
  let running = $state(false);
  let pins = $state<Record<number, number>>({});
  let pixels = $state<string[]>([]);
  let serial = $state('');
  let announce = $state('');

  /** Which pins last got an analog (PWM) value; their numbers are percentages. */
  let analog = $state<Record<number, boolean>>({});

  /** The robot's state from its robot calls: motor speeds (−100…100) and the pen. */
  let robot = $state({ left: 0, right: 0, usesRight: false, pen: null as boolean | null });

  /** Sensor answers pushed into the on-screen micro:bit; set here until the Robot tab exists. */
  let robotSensors = $state<Record<SensorName, number>>({
    line_left: 0,
    line_right: 0,
    whisker_left: 0,
    whisker_right: 0
  });
  const SENSOR_LABELS: Record<SensorName, string> = {
    line_left: 'sim_line_left',
    line_right: 'sim_line_right',
    whisker_left: 'sim_whisker_left',
    whisker_right: 'sim_whisker_right'
  };

  function motorState(speed: number): { dir: string; speed: number } {
    if (speed > 0) return { dir: t('block_motor_forward'), speed };
    if (speed < 0) return { dir: t('block_motor_reverse'), speed: -speed };
    return { dir: t('block_motor_stop'), speed: 0 };
  }

  const motorA = $derived(motorState(robot.left));
  const motorB = $derived(motorState(robot.right));
  const motor = $derived(motorA.dir);
  /** The right motor is shown once a program uses it. */
  const hasMotorB = $derived(robot.usesRight);

  function pushSensors() {
    post({ kind: 'robot_sensors', values: { ...robotSensors } });
  }

  function setRobotSensor(name: SensorName, on: boolean) {
    robotSensors = { ...robotSensors, [name]: on ? 1 : 0 };
    pushSensors();
  }

  function post(message: Record<string, unknown>) {
    frame?.contentWindow?.postMessage(message, window.location.origin);
  }

  let editorAudio: AudioContext | undefined;

  /**
   * Sends the current program to the simulator and (re)starts it. When called from a tap on
   * Run or Restart, also switches the sound on (patch 0004): we make the AudioContext here,
   * inside the tap, and hand it to the simulator.
   */
  export function flash(fromTap = false): void {
    const current = files();
    if (!current) return;
    try {
      let context: AudioContext | undefined;
      if (fromTap) {
        editorAudio ??= new AudioContext({ sampleRate: 44100 });
        void editorAudio.resume();
        context = editorAudio;
      }
      const sim = frame?.contentWindow as unknown as {
        rfaStartAudio?: (context?: AudioContext) => void;
      } | null;
      sim?.rfaStartAudio?.(context);
    } catch {
      // No sound on this browser, or the simulator page isn't ready yet; it still runs.
    }
    if (fromTap) setTimeout(checkSound, 800);
    const encoder = new TextEncoder();
    const filesystem = Object.fromEntries(
      Object.entries(current).map(([name, text]) => [name, encoder.encode(text)])
    );
    pins = {};
    analog = {};
    robot = { left: 0, right: 0, usesRight: false, pen: null };
    pixels = [];
    serial = '';
    pushSensors();
    post({ kind: 'flash', filesystem });
    running = true;
    robotWorld?.start(current['main.py'] ?? '');
  }

  /** Restarts with the latest code, but only once the learner has started the simulator. */
  export function update(): void {
    if (running) flash();
  }

  /** 'off' when the browser kept the on-screen micro:bit's sound switched off. */
  let sound = $state<'unknown' | 'on' | 'off'>('unknown');

  function checkSound() {
    try {
      const sim = frame?.contentWindow as unknown as { rfaAudioState?: () => string } | null;
      const state = sim?.rfaAudioState?.();
      if (state) sound = state === 'running' ? 'on' : 'off';
    } catch {
      // Simulator not ready; leave as it is.
    }
  }

  /**
   * Plays a short beep straight from this page and switches the micro:bit's sound on, so a
   * learner can tell "my speakers are off" apart from "the micro:bit is silent".
   */
  function testSound() {
    try {
      editorAudio ??= new AudioContext({ sampleRate: 44100 });
      void editorAudio.resume();
      const beep = editorAudio.createOscillator();
      const volume = editorAudio.createGain();
      volume.gain.value = 0.2;
      beep.frequency.value = 880;
      beep.connect(volume).connect(editorAudio.destination);
      beep.start();
      beep.stop(editorAudio.currentTime + 0.25);
      const sim = frame?.contentWindow as unknown as {
        rfaStartAudio?: (context?: AudioContext) => void;
      } | null;
      sim?.rfaStartAudio?.(editorAudio);
      announce = t('sim_sound_tested');
    } catch {
      announce = t('sim_sound_unsupported');
    }
    setTimeout(checkSound, 500);
  }

  /** Shows the Robot view with this world, e.g. when a lesson opens its starter program. */
  export function showWorld(id: string): void {
    if (!robotOn || !worlds.some((w) => w.id === id)) return;
    view = 'robot';
    robotWorld?.select(id);
  }

  export function stop(): void {
    post({ kind: 'stop' });
    running = false;
    robotWorld?.stop();
  }

  /** Gesture buttons, like MakeCode's SHAKE button: the gesture happens, then ends. */
  const GESTURES: [string, string][] = [
    ['shake', 'gesture_shake'],
    ['up', 'gesture_logo_up'],
    ['down', 'gesture_logo_down'],
    ['face up', 'gesture_face_up'],
    ['face down', 'gesture_face_down'],
    ['left', 'gesture_tilt_left'],
    ['right', 'gesture_tilt_right'],
    ['freefall', 'gesture_free_fall']
  ];
  let gestureTimer: ReturnType<typeof setTimeout> | undefined;

  function gesture(name: string) {
    clearTimeout(gestureTimer);
    post({ kind: 'set_value', id: 'gesture', value: name });
    announce = `${t('sim_gesture')}: ${t(GESTURES.find(([g]) => g === name)?.[1] ?? name)}`;
    gestureTimer = setTimeout(() => post({ kind: 'set_value', id: 'gesture', value: 'none' }), 600);
  }

  function setValue(id: string, value: number | string) {
    post({ kind: 'set_value', id, value });
    sensors = sensors.map((s) => (s.id === id ? ({ ...s, value } as Sensor) : s));
  }

  function onMessage(event: MessageEvent) {
    if (event.source !== frame?.contentWindow || event.origin !== window.location.origin) return;
    const data = event.data as Record<string, unknown>;
    switch (data['kind']) {
      case 'ready': {
        const state = data['state'] as Record<string, Sensor>;
        sensors = SENSORS.map(([id]) => state[id]).filter((s): s is Sensor => Boolean(s));
        break;
      }
      case 'request_flash':
        flash();
        break;
      case 'pin_output': {
        const pin = Number(data['pin']);
        const value = Number(data['value']);
        if ([0, 1, 2].includes(pin)) {
          analog = { ...analog, [pin]: Boolean(data['analog']) };
          pins = { ...pins, [pin]: data['analog'] ? Math.round(value / 10.23) : value };
          announce = `${t('sim_pin')} P${pin}: ${pins[pin]}`;
        }
        break;
      }
      case 'robot_call': {
        const call = parseRobotCall(data);
        if (!call) break;
        robotWorld?.call(call);
        if (call.call === 'motor_left') robot.left = call.value;
        else if (call.call === 'motor_right')
          robot = { ...robot, right: call.value, usesRight: true };
        else if (call.call === 'stop') robot = { ...robot, left: 0, right: 0 };
        else robot.pen = call.value === 1;
        announce =
          call.call === 'pen'
            ? `${t('sim_pen')} ${t(robot.pen ? 'block_pen_down' : 'block_pen_up')}`
            : `${t(hasMotorB ? 'sim_motor_left' : 'sim_motor')} ${motorA.dir}` +
              (hasMotorB ? `, ${t('sim_motor_right')} ${motorB.dir}` : '');
        break;
      }
      case 'neopixel': {
        const bytes = (data['data'] as number[]) ?? [];
        // NeoPixels take green, red, blue for each light.
        const next: string[] = [];
        for (let i = 0; i + 2 < bytes.length; i += 3) {
          next.push(`rgb(${bytes[i + 1]}, ${bytes[i]}, ${bytes[i + 2]})`);
        }
        pixels = next.slice(0, 64);
        break;
      }
      case 'serial_output':
        serial = (serial + String(data['data'] ?? '')).slice(-2000);
        break;
      case 'internal_error':
        running = false;
        break;
    }
  }

  const label = (key: string) => t(SENSORS.find(([id]) => id === key)?.[1] ?? key);
</script>

<svelte:window onmessage={onMessage} />

<div class="simulator">
  {#if robotOn}
    <div class="views" role="group" aria-label={t('sim_title')}>
      <button
        type="button"
        class="view"
        aria-pressed={view === 'microbit'}
        onclick={() => {
          view = 'microbit';
          pushSensors();
        }}
      >
        {t('sim_tab_microbit')}
      </button>
      <button
        type="button"
        class="view"
        aria-pressed={view === 'robot'}
        onclick={() => (view = 'robot')}
      >
        {t('sim_tab_robot')}
      </button>
    </div>
    <div class="robot-view" hidden={view !== 'robot'}>
      <RobotWorld
        bind:this={robotWorld}
        {worlds}
        {seasons}
        specs={worldSpecs}
        {labels}
        visible={view === 'robot'}
        push={worldPush}
      />
    </div>
  {/if}
  <iframe
    bind:this={frame}
    {src}
    title={t('sim_title')}
    allow="autoplay"
    class:behind={view === 'robot'}
  ></iframe>
  <div class="controls">
    {#if running}
      <button type="button" class="plain" onclick={stop}>{t('sim_stop')}</button>
      <button type="button" class="plain" onclick={() => flash(true)}>{t('sim_restart')}</button>
    {:else}
      <button type="button" class="secondary" onclick={() => flash(true)}>{t('code_run')}</button>
    {/if}
  </div>

  <p class="sound">
    <button type="button" class="plain" onclick={testSound}>🔊 {t('sim_sound_test')}</button>
    {#if sound === 'off'}
      <span class="sound-off" role="status">{t('sim_sound_off')}</span>
    {/if}
  </p>

  <div class="gestures" role="group" aria-label={t('sim_gesture')}>
    <button type="button" class="shake" onclick={() => gesture('shake')}>
      {t('gesture_shake')}
    </button>
    <select
      aria-label={t('sim_more_gestures')}
      onchange={(e) => {
        if (e.currentTarget.value) gesture(e.currentTarget.value);
        e.currentTarget.value = '';
      }}
    >
      <option value="">{t('sim_more_gestures')}</option>
      {#each GESTURES.slice(1) as [value, key] (value)}
        <option {value}>{t(key)}</option>
      {/each}
    </select>
  </div>

  <details class="sensors">
    <summary>{t('sim_sensors')}</summary>
    {#each sensors as sensor (sensor.id)}
      <label>
        <span>{label(sensor.id)}</span>
        {#if sensor.type === 'range'}
          <input
            type="range"
            min={sensor.min}
            max={sensor.max}
            value={sensor.value}
            oninput={(e) => setValue(sensor.id, Number(e.currentTarget.value))}
          />
          <output>{sensor.value}{sensor.unit ? ` ${sensor.unit}` : ''}</output>
        {:else}
          <select value={sensor.value} onchange={(e) => setValue(sensor.id, e.currentTarget.value)}>
            {#each sensor.choices as choice (choice)}
              <option value={choice}>{choice}</option>
            {/each}
          </select>
        {/if}
      </label>
    {/each}
  </details>

  <details class="sensors robot-sensors" hidden={view === 'robot'}>
    <summary>{t('sim_robot_sensors')}</summary>
    {#each SENSOR_NAMES as name (name)}
      <label class="check">
        <input
          type="checkbox"
          checked={robotSensors[name] === 1}
          onchange={(e) => setRobotSensor(name, e.currentTarget.checked)}
        />
        <span>{t(SENSOR_LABELS[name])}</span>
      </label>
    {/each}
  </details>

  <div class="outputs" aria-label={t('sim_outputs')}>
    <p>
      <span class="tag">{hasMotorB ? t('sim_motor_left') : t('sim_motor')}</span>
      <strong class="motor" data-motor={motor}>{motor}</strong>
      {#if motorA.speed > 0 && motorA.speed < 100}<span class="speed">{motorA.speed}%</span>{/if}
      {#if hasMotorB}
        <span class="tag">{t('sim_motor_right')}</span>
        <strong class="motor-b">{motorB.dir}</strong>
        {#if motorB.speed > 0 && motorB.speed < 100}<span class="speed">{motorB.speed}%</span>{/if}
      {/if}
      <span class="pins">
        {#each [0, 1, 2] as pin (pin)}
          <span class="pin" class:on={(pins[pin] ?? 0) > 0}>P{pin} {pins[pin] ?? 0}</span>
        {/each}
      </span>
    </p>
    {#if robot.pen !== null}
      <p>
        <span class="tag">{t('sim_pen')}</span>
        <strong class="pen">{t(robot.pen ? 'block_pen_down' : 'block_pen_up')}</strong>
      </p>
    {/if}
    {#if pixels.length}
      <div class="pixels" role="img" aria-label={`${t('sim_neopixels')}: ${pixels.length}`}>
        {#each pixels as colour, i (i)}
          <svg viewBox="0 0 10 10" width="18" height="18" aria-hidden="true">
            <circle cx="5" cy="5" r="4.5" fill={colour} stroke="#555" stroke-width="0.5" />
          </svg>
        {/each}
      </div>
    {/if}
    {#if serial}
      <pre class="serial" aria-label={t('sim_serial')}>{serial}</pre>
    {/if}
  </div>
  <p class="visually-hidden" aria-live="polite">{announce}</p>
</div>

<style>
  .simulator {
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .views {
    display: flex;
    gap: 0.25rem;
  }
  .view {
    flex: 1;
    min-height: 2.75rem;
    border: 1px solid #5a5a5a;
    background: #ffffff;
    color: #1a1a1a;
    border-radius: 4px;
    font: inherit;
  }
  .view[aria-pressed='true'] {
    background: #0b5394;
    color: #ffffff;
    font-weight: 600;
  }
  /* The micro:bit keeps running behind the Robot view: moved off screen, not removed. */
  iframe.behind {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
  }
  iframe {
    inline-size: 100%;
    aspect-ratio: 1 / 0.8;
    max-block-size: 15rem;
    border: none;
    background: #fdfdff;
  }
  .controls {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }
  .controls button {
    min-block-size: 40px;
    padding-inline: 1rem;
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .secondary {
    border: none;
    background: #3454d1;
    color: #fff;
  }
  .plain {
    border: 1px solid #3454d1;
    background: #fff;
    color: #3454d1;
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 3px solid #000;
    outline-offset: 2px;
  }
  .sound {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0;
  }

  .sound-off {
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .gestures {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }
  .gestures button,
  .gestures select {
    min-block-size: 40px;
    border-radius: 6px;
    font: inherit;
    font-size: 0.875rem;
  }
  .shake {
    padding-inline: 1rem;
    border: none;
    background: #cf00cf;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
  .gestures select {
    border: 1px solid #8a8a8a;
    background: #fff;
    padding-inline: 0.25rem;
  }
  .sensors summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    min-block-size: 32px;
  }
  .sensors label {
    display: grid;
    grid-template-columns: minmax(0, 7rem) minmax(0, 1fr) 4.5rem;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
  }
  .sensors label.check {
    grid-template-columns: auto minmax(0, 1fr);
    min-height: 2.75rem; /* touch target */
  }
  .outputs p {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: center;
    margin: 0;
    font-size: 0.8rem;
  }
  .tag {
    color: #555;
  }
  .pin {
    padding: 0 0.25rem;
    border: 1px solid #999;
    border-radius: 4px;
  }
  .pin.on {
    background: #b22222;
    border-color: #b22222;
    color: #fff;
  }
  .pixels {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-block-start: 0.25rem;
  }
  .serial {
    max-block-size: 6rem;
    overflow: auto;
    margin: 0.25rem 0 0;
    padding: 0.25rem;
    background: #222;
    color: #eee;
    font-size: 0.75rem;
  }
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
