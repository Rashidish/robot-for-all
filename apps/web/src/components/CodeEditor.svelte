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

  // MakeCode-like workspace colours.
  const theme = Blockly.Theme.defineTheme('robot-for-all', {
    name: 'robot-for-all',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#ecf0f1',
      toolboxBackgroundColour: '#ffffff',
      flyoutBackgroundColour: '#dde3e5',
      flyoutOpacity: 1,
      scrollbarColour: '#c2c9cc',
      insertionMarkerColour: '#000000'
    }
  });

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
      theme,
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

<div class="editor">
  <div class="workspace" bind:this={host} role="application" aria-label={labels.workspace}></div>
  <div class="side">
    <div class="actions">
      <button type="button" class="primary" onclick={download}>{labels.download}</button>
      {#if hasUsb}
        <button type="button" class="secondary" onclick={send}>{labels.send}</button>
      {:else}
        <p class="note">{labels.noUsb}</p>
      {/if}
    </div>
    <p class="status" role="status">{status}</p>
  </div>
</div>

<style>
  /* Layout and colours follow MakeCode for micro:bit: grey workspace, purple Download button,
     actions under the (future) on-screen micro:bit on the left on wide screens, and in a bar
     under the blocks on phones. */
  .editor {
    display: grid;
    grid-template-areas: 'ws' 'side';
    grid-template-rows: minmax(22rem, 1fr) auto;
    block-size: calc(100dvh - 7.5rem);
    min-block-size: 30rem;
    background: #fdfdff;
    color: #000;
    color-scheme: light;
  }
  .workspace {
    grid-area: ws;
    position: relative;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
    background: #ecf0f1;
  }
  .side {
    grid-area: side;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border-block-start: 1px solid #e1e1e1;
  }
  @media (min-width: 48rem) {
    .editor {
      grid-template-areas: 'side ws';
      grid-template-columns: 16rem 1fr;
      grid-template-rows: 1fr;
    }
    .side {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      border-block-start: none;
      border-inline-end: 1px solid #e1e1e1;
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 0.5rem);
  }
  .actions button {
    min-block-size: 44px;
    padding-inline: var(--space-4, 1rem);
    border: none;
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
  }
  .primary {
    flex: 1 1 auto;
    background: #6633cc;
  }
  .primary:hover {
    background: #5c2eb8;
  }
  .secondary {
    background: #3454d1;
  }
  .secondary:hover {
    background: #2742ab;
  }
  .actions button:focus-visible {
    outline: 3px solid #000;
    outline-offset: 2px;
  }
  .note,
  .status {
    margin: var(--space-2, 0.5rem) 0 0;
    font-size: 0.875rem;
  }
  .status:empty {
    display: none;
  }
</style>
