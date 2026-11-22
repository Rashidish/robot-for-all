<script lang="ts">
  // M3 step 1 spike: Blockly under our strict CSP, a .hex built in the browser, and WebUSB.
  // The real editor (toolbox, program JSON, virtual micro:bit) replaces this in steps 3–5.
  import { onMount } from 'svelte';
  import * as Blockly from 'blockly/core';
  import 'blockly/blocks';
  import * as En from 'blockly/msg/en';
  import { buildHex, fetchFirmware } from '../code/hex';

  interface Props {
    labels: {
      workspace: string;
      download: string;
      send: string;
      working: string;
      done: string;
      failed: string;
      noUsb: string;
    };
  }
  let { labels }: Props = $props();

  let host: HTMLDivElement;
  let status = $state('');
  let hasUsb = $state(false);

  // Fixed demo program until the generator exists (step 2).
  const demo =
    'from microbit import *\n\nwhile True:\n    display.show(Image.HEART)\n    sleep(500)\n    display.clear()\n    sleep(500)\n';

  const toolbox = {
    kind: 'flyoutToolbox',
    contents: [
      { kind: 'block', type: 'controls_repeat_ext' },
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'logic_compare' },
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'math_arithmetic' }
    ]
  };

  onMount(() => {
    Blockly.setLocale(En as unknown as Record<string, string>);
    hasUsb = 'usb' in navigator;
    const workspace = Blockly.inject(host, {
      toolbox,
      renderer: 'zelos',
      media: '/blockly-media/',
      sounds: false,
      comments: false,
      trashcan: true,
      zoom: { controls: true, startScale: 0.8 },
      move: { scrollbars: true, drag: true, wheel: false }
    });
    return () => workspace.dispose();
  });

  async function makeHex(): Promise<string> {
    return buildHex(demo, await fetchFirmware());
  }

  async function download() {
    status = labels.working;
    try {
      const hex = await makeHex();
      const url = URL.createObjectURL(new Blob([hex], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'robot-for-all.hex';
      a.click();
      // Revoking straight away can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      status = labels.done;
    } catch {
      status = labels.failed;
    }
  }

  async function send() {
    status = labels.working;
    try {
      const { createUSBConnection } = await import('@microbit/microbit-connection/usb');
      const { createUniversalHexFlashDataSource } =
        await import('@microbit/microbit-connection/universal-hex');
      const usb = createUSBConnection();
      await usb.connect();
      await usb.flash(createUniversalHexFlashDataSource(await makeHex()), { partial: true });
      await usb.disconnect();
      status = labels.done;
    } catch {
      status = labels.failed;
    }
  }
</script>

<div class="workspace" bind:this={host} role="application" aria-label={labels.workspace}></div>

<div class="actions">
  <button type="button" onclick={download}>{labels.download}</button>
  {#if hasUsb}
    <button type="button" onclick={send}>{labels.send}</button>
  {:else}
    <p>{labels.noUsb}</p>
  {/if}
</div>
<p class="status" role="status">{status}</p>

<style>
  .workspace {
    block-size: min(70vh, 32rem);
    inline-size: 100%;
    border: 1px solid var(--color-border, #8a7f72);
    border-radius: var(--radius, 8px);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 0.5rem);
    margin-block-start: var(--space-3, 0.75rem);
  }
  .actions button {
    min-block-size: 44px;
    padding-inline: var(--space-4, 1rem);
  }
</style>
