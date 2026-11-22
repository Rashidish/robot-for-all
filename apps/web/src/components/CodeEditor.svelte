<script lang="ts">
  // The block editor (M3 spec FR-1–FR-12), laid out like MakeCode for micro:bit (spec §5).
  // Blocks are stored as Blockly workspace JSON for editing, and turned into our program JSON
  // for Python, the .hex file and (step 4) the virtual micro:bit.
  import { onMount, tick } from 'svelte';
  import * as Blockly from 'blockly/core';
  import * as BlocklyEnglish from 'blockly/msg/en';
  import {
    BLOCK_DEFINITIONS,
    NEW_PROGRAM,
    ProgramError,
    TOOLBOX,
    fromBlockly,
    parseProgram,
    toBlockly,
    toPython,
    variableBlocks,
    type Program
  } from '../../../../packages/blocks/src/index';
  import { buildHex, fetchFirmware } from '../code/hex';
  import { FILE_EXTENSION, fileName, fromFile, toFile } from '../code/files';
  import {
    listPrograms,
    loadStore,
    newId,
    saveStore,
    type ProgramStore,
    type SavedProgram
  } from '../code/storage';

  interface Props {
    labels: Record<string, string>;
  }
  let { labels }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  let host: HTMLDivElement;
  let dialog: HTMLDialogElement;
  let fileInput: HTMLInputElement;
  let workspace: Blockly.WorkspaceSvg | undefined;

  let tab = $state<'blocks' | 'python'>('blocks');
  let status = $state('');
  let hasUsb = $state(false);
  let name = $state('');
  let python = $state('');
  let programs = $state<SavedProgram[]>([]);
  let store: ProgramStore = { current: null, programs: {} };
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const storage = (): Storage | undefined => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  };

  // MakeCode-like workspace colours.
  const theme = Blockly.Theme.defineTheme('robot-for-all', {
    name: 'robot-for-all',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#ecf0f1',
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#000000',
      flyoutBackgroundColour: '#dde3e5',
      flyoutOpacity: 1,
      scrollbarColour: '#c2c9cc',
      insertionMarkerColour: '#000000'
    }
  });

  const VARIABLE_NAME = /^[\p{L}\p{N}_ ]{1,30}$/u;

  function setUpBlockly() {
    // Blockly's own interface text (menus, screen-reader labels), then our block text on top.
    // Other languages will load Blockly's matching message file here.
    Blockly.setLocale(BlocklyEnglish as unknown as Record<string, string>);
    for (const [key, value] of Object.entries(labels)) {
      if (key.startsWith('block_') || key.startsWith('category_'))
        Blockly.Msg[key.toUpperCase()] = value;
    }
    Blockly.common.defineBlocksWithJsonArray(BLOCK_DEFINITIONS as unknown as object[]);
  }

  /** Reads the blocks into a program; returns null (with a message) if they can't be used. */
  function currentProgram(): Program | null {
    if (!workspace) return null;
    try {
      return parseProgram(fromBlockly(Blockly.serialization.workspaces.save(workspace)));
    } catch (err) {
      status = err instanceof ProgramError ? err.message : t('code_failed');
      return null;
    }
  }

  function refresh() {
    const next = currentProgram();
    if (next) python = toPython(next);
  }

  function save() {
    if (!workspace) return;
    const id = store.current ?? newId();
    store.current = id;
    store.programs[id] = {
      id,
      name: name.trim() || t('code_default_name'),
      updated: Date.now(),
      workspace: Blockly.serialization.workspaces.save(workspace)
    };
    saveStore(storage(), store);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function load(saved: SavedProgram | undefined, fallback: Program = NEW_PROGRAM) {
    if (!workspace) return;
    workspace.clear();
    try {
      Blockly.serialization.workspaces.load(
        (saved?.workspace ?? toBlockly(fallback)) as unknown as Record<string, unknown>,
        workspace
      );
    } catch {
      Blockly.serialization.workspaces.load(
        toBlockly(NEW_PROGRAM) as unknown as Record<string, unknown>,
        workspace
      );
    }
    name = saved?.name ?? t('code_default_name');
    refresh();
  }

  function newProgram(from: Program = NEW_PROGRAM, programName = t('code_default_name')) {
    save();
    store.current = newId();
    load(undefined, from);
    name = programName;
    save();
    closeDialog();
  }

  onMount(() => {
    setUpBlockly();
    hasUsb = 'usb' in navigator;
    workspace = Blockly.inject(host, {
      toolbox: TOOLBOX as unknown as Blockly.utils.toolbox.ToolboxDefinition,
      renderer: 'zelos',
      theme,
      media: '/blockly-media/',
      sounds: false,
      comments: false,
      trashcan: true,
      zoom: { controls: true, startScale: 0.75 },
      move: { scrollbars: true, drag: true, wheel: false }
    });
    const ws = workspace;
    ws.registerButtonCallback('RFA_CREATE_VAR', () => {
      Blockly.dialog.prompt(t('code_variable_prompt'), '', (text) => {
        const varName = text?.trim();
        if (!varName) return;
        if (!VARIABLE_NAME.test(varName)) {
          Blockly.dialog.alert(t('code_variable_invalid'));
          return;
        }
        if (!ws.getVariableMap().getVariable(varName)) ws.getVariableMap().createVariable(varName);
        ws.refreshToolboxSelection();
      });
    });
    ws.registerToolboxCategoryCallback(
      'RFA_VARIABLES',
      (target) =>
        [
          { kind: 'button', text: t('code_make_variable'), callbackkey: 'RFA_CREATE_VAR' },
          ...target
            .getVariableMap()
            .getAllVariables()
            .flatMap((v) => variableBlocks({ name: v.getName(), id: v.getId() }))
        ] as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray
    );

    store = loadStore(storage());
    load(store.current ? store.programs[store.current] : undefined);
    if (!store.current) save();
    ws.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      refresh();
      scheduleSave();
    });
    return () => {
      clearTimeout(saveTimer);
      save();
      ws.dispose();
    };
  });

  async function showTab(next: 'blocks' | 'python') {
    tab = next;
    await tick();
    if (next === 'blocks' && workspace) Blockly.svgResize(workspace);
  }

  function rename() {
    scheduleSave();
  }

  function downloadText(text: string, file: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.click();
    // Revoking straight away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function makeHex(): Promise<string | null> {
    const current = currentProgram();
    if (!current) return null;
    return buildHex(toPython(current), await fetchFirmware());
  }

  async function download() {
    status = t('code_working');
    try {
      const hex = await makeHex();
      if (!hex) return;
      downloadText(hex, `${fileName(name)}.hex`, 'application/octet-stream');
      status = t('code_done');
    } catch {
      status = t('code_failed');
    }
  }

  async function send() {
    status = t('code_working');
    try {
      const hex = await makeHex();
      if (!hex) return;
      const { createUSBConnection } = await import('@microbit/microbit-connection/usb');
      const { createUniversalHexFlashDataSource } =
        await import('@microbit/microbit-connection/universal-hex');
      const usb = createUSBConnection();
      await usb.connect();
      await usb.flash(createUniversalHexFlashDataSource(hex), { partial: true });
      await usb.disconnect();
      status = t('code_done');
    } catch {
      status = t('code_failed');
    }
  }

  async function copyPython() {
    try {
      await navigator.clipboard.writeText(python);
      status = t('code_copied');
    } catch {
      status = t('code_failed');
    }
  }

  function openDialog() {
    save();
    programs = listPrograms(store);
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog?.open) dialog.close();
  }

  function openProgram(id: string) {
    save();
    store.current = id;
    load(store.programs[id]);
    saveStore(storage(), store);
    closeDialog();
  }

  function deleteProgram(id: string) {
    store.programs = Object.fromEntries(
      Object.entries(store.programs).filter(([key]) => key !== id)
    );
    if (store.current === id) {
      store.current = null;
      const next = listPrograms(store)[0];
      if (next) {
        store.current = next.id;
        load(next);
      } else {
        newProgram();
      }
    }
    saveStore(storage(), store);
    programs = listPrograms(store);
  }

  function exportFile() {
    const current = currentProgram();
    if (!current) return;
    downloadText(toFile(name, current), `${fileName(name)}${FILE_EXTENSION}`, 'application/json');
  }

  async function importFile() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const { name: fileProgramName, program: imported } = fromFile(await file.text());
      newProgram(imported, fileProgramName || file.name.replace(/\.rfa\.json$|\.json$/, ''));
      status = '';
    } catch {
      status = t('code_import_failed');
      closeDialog();
    }
  }
</script>

<div class="editor">
  <div class="tabs" role="tablist" aria-label={t('code_title')}>
    <button
      type="button"
      role="tab"
      id="tab-blocks"
      aria-selected={tab === 'blocks'}
      aria-controls="panel-blocks"
      onclick={() => showTab('blocks')}
    >
      {t('code_tab_blocks')}
    </button>
    <button
      type="button"
      role="tab"
      id="tab-python"
      aria-selected={tab === 'python'}
      aria-controls="panel-python"
      onclick={() => showTab('python')}
    >
      {t('code_tab_python')}
    </button>
  </div>

  <div class="main">
    <div
      id="panel-blocks"
      class="workspace"
      role="tabpanel"
      aria-labelledby="tab-blocks"
      hidden={tab !== 'blocks'}
    >
      <div
        class="blockly"
        bind:this={host}
        role="application"
        aria-label={t('code_workspace')}
      ></div>
    </div>
    <div
      id="panel-python"
      class="python"
      role="tabpanel"
      aria-labelledby="tab-python"
      hidden={tab !== 'python'}
    >
      <p>{t('code_python_intro')}</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <pre tabindex="0"><code>{python}</code></pre>
      <button type="button" class="secondary" onclick={copyPython}>{t('code_copy')}</button>
    </div>
  </div>

  <div class="side">
    <label class="name">
      <span>{t('code_program_name')}</span>
      <input type="text" bind:value={name} oninput={rename} maxlength="60" />
    </label>
    <div class="actions">
      <button type="button" class="primary" onclick={download}>{t('code_download_hex')}</button>
      {#if hasUsb}
        <button type="button" class="secondary" onclick={send}>{t('code_send')}</button>
      {/if}
      <button type="button" class="plain" onclick={openDialog}>{t('code_programs')}</button>
    </div>
    {#if !hasUsb}
      <p class="note">{t('code_no_usb')}</p>
    {/if}
    <p class="status" role="status">{status}</p>
  </div>
</div>

<dialog bind:this={dialog} aria-labelledby="programs-title">
  <h2 id="programs-title">{t('code_programs')}</h2>
  <p class="note">{t('code_saved_here')}</p>
  <ul class="list">
    {#each programs as saved (saved.id)}
      <li>
        <span>{saved.name}</span>
        <button type="button" class="plain" onclick={() => openProgram(saved.id)}>
          {t('code_open')}
        </button>
        <button type="button" class="plain" onclick={() => deleteProgram(saved.id)}>
          {t('code_delete')}
        </button>
      </li>
    {/each}
  </ul>
  <div class="actions">
    <button type="button" class="primary" onclick={() => newProgram()}>{t('code_new')}</button>
    <button type="button" class="secondary" onclick={exportFile}>{t('code_export')}</button>
    <label class="file plain">
      {t('code_import')}
      <input
        type="file"
        accept=".json,application/json"
        bind:this={fileInput}
        onchange={importFile}
      />
    </label>
    <button type="button" class="plain" onclick={closeDialog}>{t('code_close')}</button>
  </div>
</dialog>

<style>
  /* Layout and colours follow MakeCode for micro:bit (spec §5): grey workspace, Blocks/Python
     switch at the top, purple Download button on the left on wide screens and under the blocks
     on phones. */
  .editor {
    display: grid;
    grid-template-areas: 'tabs' 'main' 'side';
    grid-template-rows: auto minmax(22rem, 1fr) auto;
    block-size: calc(100dvh - 7.5rem);
    min-block-size: 32rem;
    background: #fdfdff;
    color: #000;
    color-scheme: light;
  }
  @media (min-width: 48rem) {
    .editor {
      grid-template-areas: 'side tabs' 'side main';
      grid-template-columns: 16rem 1fr;
      grid-template-rows: auto 1fr;
    }
    .side {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      border-block-start: none !important;
      border-inline-end: 1px solid #e1e1e1;
    }
  }
  .tabs {
    grid-area: tabs;
    display: flex;
    justify-content: center;
    gap: 0;
    padding: 0.375rem;
    background: #ecf0f1;
    border-block-end: 1px solid #d5dbdc;
  }
  .tabs button {
    min-block-size: 36px;
    padding-inline: 1.25rem;
    border: 1px solid #3454d1;
    background: #fff;
    color: #3454d1;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .tabs button:first-child {
    border-radius: 18px 0 0 18px;
  }
  .tabs button:last-child {
    border-radius: 0 18px 18px 0;
  }
  .tabs button[aria-selected='true'] {
    background: #3454d1;
    color: #fff;
  }
  .main {
    grid-area: main;
    position: relative;
    min-inline-size: 0;
    min-block-size: 0;
  }
  .workspace,
  .python {
    position: absolute;
    inset: 0;
  }
  .workspace[hidden],
  .python[hidden] {
    display: none;
  }
  .blockly {
    inline-size: 100%;
    block-size: 100%;
    background: #ecf0f1;
  }
  .python {
    overflow: auto;
    padding: var(--space-4, 1rem);
    background: #fff;
  }
  .python pre {
    margin: 0 0 var(--space-4, 1rem);
    padding: var(--space-4, 1rem);
    border-radius: 6px;
    background: #f5f5f5;
    overflow: auto;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .side {
    grid-area: side;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border-block-start: 1px solid #e1e1e1;
  }
  .name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-block-end: var(--space-2, 0.5rem);
    font-size: 0.875rem;
  }
  .name input {
    min-block-size: 40px;
    padding-inline: 0.5rem;
    border: 1px solid #8a8a8a;
    border-radius: 6px;
    font: inherit;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 0.5rem);
  }
  button.primary,
  button.secondary,
  button.plain,
  .file {
    min-block-size: 44px;
    padding-inline: var(--space-4, 1rem);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .primary,
  .secondary {
    border: none;
    color: #fff;
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
  .plain,
  .file {
    display: inline-flex;
    align-items: center;
    border: 1px solid #3454d1;
    background: #fff;
    color: #3454d1;
  }
  .file input {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    opacity: 0;
  }
  .file:focus-within {
    outline: 3px solid #000;
    outline-offset: 2px;
  }
  button:focus-visible,
  .name input:focus-visible {
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
  dialog {
    inline-size: min(32rem, calc(100vw - 2rem));
    padding: var(--space-4, 1rem);
    border: none;
    border-radius: 8px;
    background: #fff;
    color: #000;
    color-scheme: light;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  dialog h2 {
    margin-block-start: 0;
  }
  .list {
    margin: var(--space-4, 1rem) 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding-block: 0.25rem;
    border-block-end: 1px solid #eee;
  }
  .list li span {
    flex: 1;
    overflow-wrap: anywhere;
  }
</style>
