<script lang="ts">
  // The on-screen micro:bit (M3 spec step 4, ADR-0006): the micro:bit Foundation's MicroPython
  // simulator, built from source and served from our own site, in a same-origin iframe. It runs
  // the same MicroPython as a real micro:bit V2, for blocks and typed Python alike.
  // Around it we add what MakeCode shows: sensor controls, pin and motor state and NeoPixels.
  interface Props {
    src: string;
    labels: Record<string, string>;
    /** The program to run, as MicroPython files; null if the blocks can't be used yet. */
    files: () => Record<string, string> | null;
  }
  let { src, labels, files }: Props = $props();
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

  const motor = $derived(
    pins[0] === 1 && !pins[1]
      ? t('block_motor_forward')
      : pins[1] === 1 && !pins[0]
        ? t('block_motor_reverse')
        : t('block_motor_stop')
  );

  function post(message: Record<string, unknown>) {
    frame?.contentWindow?.postMessage(message, window.location.origin);
  }

  /** Sends the current program to the simulator and (re)starts it. */
  export function flash(): void {
    const current = files();
    if (!current) return;
    // Called during a tap on our Run button: let the simulator switch its sound on now, while
    // the browser still counts this as the learner's tap (same-origin frame, patch 0004).
    try {
      (frame?.contentWindow as unknown as { rfaStartAudio?: () => void } | null)?.rfaStartAudio?.();
    } catch {
      // The simulator page isn't ready yet; it will ask for the program itself.
    }
    const encoder = new TextEncoder();
    const filesystem = Object.fromEntries(
      Object.entries(current).map(([name, text]) => [name, encoder.encode(text)])
    );
    pins = {};
    pixels = [];
    serial = '';
    post({ kind: 'flash', filesystem });
    running = true;
  }

  /** Restarts with the latest code, but only once the learner has started the simulator. */
  export function update(): void {
    if (running) flash();
  }

  export function stop(): void {
    post({ kind: 'stop' });
    running = false;
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
        if (pin >= 0 && pin <= 2) {
          pins = { ...pins, [pin]: data['analog'] ? Math.round(value / 10.23) : value };
          announce = `${t('sim_pin')} P${pin}: ${pins[pin]}`;
        }
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
  <iframe bind:this={frame} {src} title={t('sim_title')} allow="autoplay"></iframe>
  <div class="controls">
    {#if running}
      <button type="button" class="plain" onclick={stop}>{t('sim_stop')}</button>
      <button type="button" class="plain" onclick={flash}>{t('sim_restart')}</button>
    {:else}
      <button type="button" class="secondary" onclick={flash}>{t('code_run')}</button>
    {/if}
  </div>

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

  <div class="outputs" aria-label={t('sim_outputs')}>
    <p>
      <span class="tag">{t('sim_motor')}</span>
      <strong class="motor" data-motor={motor}>{motor}</strong>
      <span class="pins">
        {#each [0, 1, 2] as pin (pin)}
          <span class="pin" class:on={(pins[pin] ?? 0) > 0}>P{pin} {pins[pin] ?? 0}</span>
        {/each}
      </span>
    </p>
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
