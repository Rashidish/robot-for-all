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
    EXTENSIONS,
    allToolboxBlocks,
    toolbox,
    type Extension,
    filesFor,
    fromBlockly,
    parseProgram,
    toBlockly,
    toPython,
    variableBlocks,
    type Program
  } from '../../../../packages/blocks/src/index';
  import { modulesFor } from '../code/robot';
  import Simulator from './Simulator.svelte';
  import { featureOn } from '../site';
  import simulatorBuild from '../../simulator.json';
  import '../code/toolbox.css';
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
  // Junior in the same language as this page (/zu/code/ → /zu/code/junior/).
  const juniorHref = `${typeof location === 'undefined' ? '' : (/^\/[a-z]{2,3}(?=\/code\/)/.exec(location.pathname)?.[0] ?? '')}/code/junior/`;
  /** 'python' once the learner chooses to type Python instead of using blocks. */
  let mode = $state<'blocks' | 'python'>('blocks');
  let typed = $state('');
  let sim: Simulator | undefined = $state();
  let simTimer: ReturnType<typeof setTimeout> | undefined;
  let escapePressed = false;
  let extensions = $state<Extension[]>([]);
  let search = $state('');
  let progress = $state<number | null>(null);
  const simulatorSrc = `/simulator/${simulatorBuild.upstream}-${simulatorBuild.build}/simulator.html?color=%233454D1`;
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
    for (const [key, value] of Object.entries(labels)) Blockly.Msg[key.toUpperCase()] = value;
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

  /** The MicroPython to run: typed Python, or the Python made from the blocks. */
  function currentCode(): string | null {
    if (mode === 'python') return typed;
    const next = currentProgram();
    return next ? toPython(next) : null;
  }

  function simulatorFiles(): Record<string, string> | null {
    const code = currentCode();
    return code === null ? null : filesFor(code, modulesFor('screen'));
  }

  /** Like MakeCode: once running, the on-screen micro:bit restarts with each change. */
  function scheduleSimulator() {
    clearTimeout(simTimer);
    simTimer = setTimeout(() => sim?.update(), 800);
  }

  function save() {
    if (!workspace) return;
    const id = store.current ?? newId();
    store.current = id;
    store.programs[id] = {
      id,
      name: name.trim() || t('code_default_name'),
      updated: Date.now(),
      workspace: Blockly.serialization.workspaces.save(workspace),
      ...(mode === 'python' ? { python: typed } : {}),
      ...(extensions.length ? { extensions: [...extensions] } : {})
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
    // Extensions this program uses: saved ones, plus any whose blocks are in the program.
    const used = JSON.stringify(saved?.workspace ?? toBlockly(fallback));
    extensions = EXTENSIONS.filter(
      (x) =>
        (saved?.extensions ?? []).includes(x) ||
        (x === 'neopixel' && /rfa_x_(strip|colour|rgb)/.test(used)) ||
        (x === 'motordriver' && /rfa_x_drive/.test(used))
    );
    workspace.updateToolbox(
      toolbox(extensions) as unknown as Blockly.utils.toolbox.ToolboxDefinition
    );
    mode = saved?.python === undefined ? 'blocks' : 'python';
    typed = saved?.python ?? '';
    refresh();
    scheduleSimulator();
  }

  /** "New" asks for a name first, so My programs isn't full of "My program". */
  function startNew() {
    const chosen = askName(t('code_new_name'));
    if (chosen) newProgram(NEW_PROGRAM, chosen);
  }

  function newProgram(
    from: Program = NEW_PROGRAM,
    programName = t('code_default_name'),
    pythonText?: string
  ) {
    save();
    store.current = newId();
    load(undefined, from);
    name = programName;
    if (pythonText !== undefined) {
      mode = 'python';
      typed = pythonText;
      tab = 'python';
    }
    save();
    closeDialog();
  }

  /**
   * Starting the editor is split into steps with a pause between them, so a cheap phone stays
   * responsive while Blockly starts (one long block of work hurt Lighthouse on /code/).
   */
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  onMount(() => {
    let stopped = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      await pause();
      if (stopped) return;
      cleanup = await start();
    })();
    return () => {
      stopped = true;
      cleanup?.();
    };
  });

  async function start(): Promise<() => void> {
    setUpBlockly();
    hasUsb = 'usb' in navigator;
    workspace = Blockly.inject(host, {
      toolbox: toolbox() as unknown as Blockly.utils.toolbox.ToolboxDefinition,
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

    ws.registerToolboxCategoryCallback(
      'RFA_EXTENSIONS',
      () =>
        [
          { kind: 'label', text: t('code_extensions_intro') },
          ...EXTENSIONS.map((x) => ({
            kind: 'button',
            text: extensions.includes(x)
              ? `✓ ${t(`code_extension_${x}`)} (${t('code_extension_added')})`
              : `+ ${t(`code_extension_${x}`)}`,
            callbackkey: `RFA_ADD_${x}`
          }))
        ] as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray
    );
    for (const x of EXTENSIONS) {
      ws.registerButtonCallback(`RFA_ADD_${x}`, () => {
        if (!extensions.includes(x)) extensions = [...extensions, x];
        ws.updateToolbox(toolbox(extensions) as unknown as Blockly.utils.toolbox.ToolboxDefinition);
        save();
      });
    }

    await pause();
    store = loadStore(storage());
    load(store.current ? store.programs[store.current] : undefined);
    if (!store.current) save();
    openFromLink();
    ws.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      refresh();
      scheduleSave();
      if (mode === 'blocks') scheduleSimulator();
    });
    // Save straight away when the learner leaves or reloads the page, not 0.4 s later.
    const saveNow = () => {
      clearTimeout(saveTimer);
      save();
    };
    window.addEventListener('pagehide', saveNow);
    return () => {
      window.removeEventListener('pagehide', saveNow);
      clearTimeout(saveTimer);
      clearTimeout(simTimer);
      save();
      ws.dispose();
    };
  }

  /** Searches every block's words, like MakeCode's toolbox search. */
  const searchable = allToolboxBlocks().map((item) => {
    const def = BLOCK_DEFINITIONS.find((d) => (d as { type: string }).type === item.type) as
      Record<string, unknown> | undefined;
    const keys = [...JSON.stringify(def ?? {}).matchAll(/%\{BKY_([A-Z0-9_]+)\}/g)].map((m) => m[1]);
    const words = keys.map((k) => labels[(k ?? '').toLowerCase()] ?? '').join(' ');
    return { item, words: words.replace(/%\d/g, ' ').toLowerCase() };
  });

  function onSearch() {
    if (!workspace) return;
    const query = search.trim().toLowerCase();
    const box = workspace.getToolbox() as Blockly.Toolbox | null;
    if (!query) {
      box?.clearSelection();
      box?.getFlyout()?.hide();
      return;
    }
    const found = searchable.filter((s) => s.words.includes(query)).map((s) => s.item);
    const contents = found.length ? found : [{ kind: 'label', text: t('code_search_none') }];
    box?.getFlyout()?.show(contents as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray);
  }

  async function showTab(next: 'blocks' | 'python') {
    // The Blocks tab means "use my blocks": leave Python mode first (keeping a copy).
    if (next === 'blocks' && mode === 'python' && !backToBlocks()) return;
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
    const code = currentCode();
    if (code === null) return null;
    // The .hex builder and firmware load only when a program is downloaded or sent, so the
    // editor itself starts faster on cheap phones.
    const { buildHex, fetchFirmware } = await import('../code/hex');
    return buildHex(filesFor(code, modulesFor('board')), await fetchFirmware());
  }

  async function download() {
    status = t('code_working');
    try {
      const hex = await makeHex();
      if (!hex) return;
      downloadText(hex, `${fileName(name)}.hex`, 'application/octet-stream');
      status = t('code_downloaded');
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
      status = t('code_sending');
      progress = 0;
      await usb.flash(createUniversalHexFlashDataSource(hex), {
        partial: true,
        progress: (_stage: unknown, percentage?: number) => {
          if (typeof percentage === 'number')
            progress = Math.round(percentage * (percentage <= 1 ? 100 : 1));
        }
      });
      await usb.disconnect();
      progress = null;
      status = t('code_sent');
    } catch {
      progress = null;
      status = t('code_failed');
    }
  }

  function editAsPython() {
    if (!window.confirm(t('code_edit_python_confirm'))) return;
    typed = python;
    mode = 'python';
    save();
  }

  /**
   * Asks for a program name until the learner gives one that isn't already used.
   * Returns null if they cancel.
   */
  function askName(message: string, suggestion = ''): string | null {
    let question = message;
    for (;;) {
      const answer = window.prompt(question, suggestion);
      if (answer === null) return null;
      const chosen = answer.trim().slice(0, 60);
      const taken = Object.values(store.programs).some(
        (p) => p.name.toLowerCase() === chosen.toLowerCase()
      );
      if (chosen && !taken) return chosen;
      question = chosen ? t('code_name_taken') : t('code_name_needed');
      suggestion = chosen;
    }
  }

  /**
   * Switches back to the blocks. The typed Python is never thrown away: it is kept as its own
   * program in My programs ("… (Python)"). Returns false if the learner cancels.
   */
  function backToBlocks(): boolean {
    if (!window.confirm(t('code_back_to_blocks_confirm'))) return false;
    if (typed.trim() && workspace) {
      // The Python copy needs its own name, so My programs doesn't fill up with look-alikes.
      const copyName = askName(t('code_python_copy_name'));
      if (copyName === null) return false;
      const id = newId();
      store.programs[id] = {
        id,
        name: copyName,
        updated: Date.now() - 1,
        workspace: Blockly.serialization.workspaces.save(workspace),
        python: typed
      };
    }
    mode = 'blocks';
    typed = '';
    save();
    // Run the blocks straight away if the on-screen micro:bit is running.
    sim?.update();
    return true;
  }

  /** Empties the typed program, like starting a new Python file. */
  function clearPython() {
    if (!window.confirm(t('code_clear_python_confirm'))) return;
    typed = 'from microbit import *\n\n';
    onTyping();
  }

  function onTyping() {
    scheduleSave();
    scheduleSimulator();
  }

  /** Tab indents, as in other code editors; Esc then Tab leaves the editor (WCAG 2.1.2). */
  function onCodeKey(event: KeyboardEvent) {
    const area = event.currentTarget as HTMLTextAreaElement;
    if (event.key === 'Escape') {
      escapePressed = true;
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !escapePressed) {
      event.preventDefault();
      area.setRangeText('    ', area.selectionStart, area.selectionEnd, 'end');
      typed = area.value;
      onTyping();
    }
    escapePressed = false;
  }

  async function copyPython() {
    try {
      await navigator.clipboard.writeText(mode === 'python' ? typed : python);
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
    downloadText(
      toFile(name, current, mode === 'python' ? typed : undefined),
      `${fileName(name)}${FILE_EXTENSION}`,
      'application/json'
    );
  }

  /** A unique name: "Blink a heart", then "Blink a heart 2", "Blink a heart 3"... */
  function uniqueName(wanted: string): string {
    const taken = new Set(Object.values(store.programs).map((p) => p.name.toLowerCase()));
    if (!taken.has(wanted.toLowerCase())) return wanted;
    for (let n = 2; ; n++) {
      const candidate = `${wanted} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  /**
   * "Open in code editor" on a lesson links here with the starter program in the link
   * (#open=<base64url file>), so it works offline. It opens as a new program in My programs,
   * checked like any imported file.
   */
  function openFromLink() {
    const match = /^#open=([A-Za-z0-9_-]+)(?:&world=([a-z]+(?:-[a-z]+)*))?$/.exec(
      window.location.hash
    );
    if (!match?.[1]) return;
    // A lesson with a robot world opens it in the Robot view (M4 spec FR-8).
    if (match[2]) void tick().then(() => sim?.showWorld(match[2] ?? ''));
    history.replaceState(null, '', window.location.pathname);
    try {
      const b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const opened = fromFile(new TextDecoder().decode(bytes));
      newProgram(opened.program, uniqueName(opened.name || t('code_default_name')), opened.python);
      status = '';
    } catch {
      status = t('code_import_failed');
    }
  }

  async function importFile() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const opened = fromFile(await file.text());
      newProgram(
        opened.program,
        opened.name || file.name.replace(/\.rfa\.json$|\.json$/, ''),
        opened.python
      );
      status = '';
    } catch {
      status = t('code_import_failed');
      closeDialog();
    }
  }
</script>

<div class="editor">
  <div class="tabs">
    <label class="search" hidden={tab !== 'blocks'}>
      <span class="visually-hidden">{t('code_search')}</span>
      <input
        type="search"
        placeholder={`${t('code_search')}…`}
        bind:value={search}
        oninput={onSearch}
      />
    </label>
    <div class="tablist" role="tablist" aria-label={t('code_title')}>
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
    <!-- Junior (Grades R–2) is its own page, so this is a link, not a tab (ADR-0019). -->
    <a class="junior-link" href={juniorHref}>{t('code_tab_junior')}</a>
  </div>

  <div class="main">
    <div
      id="panel-blocks"
      class="workspace"
      role="tabpanel"
      aria-labelledby="tab-blocks"
      hidden={tab !== 'blocks'}
    >
      {#if mode === 'python'}
        <p class="notice">
          {t('code_python_mode_note')}
          <button type="button" class="plain" onclick={() => showTab('blocks')}>
            {t('code_back_to_blocks')}
          </button>
        </p>
      {/if}
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
      {#if mode === 'python'}
        <label class="code-label" for="python-code">{t('code_python_typing')}</label>
        <textarea
          id="python-code"
          class="code"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          bind:value={typed}
          oninput={onTyping}
          onkeydown={onCodeKey}
          aria-describedby="python-keys"></textarea>
        <p id="python-keys" class="note">{t('code_python_keys')}</p>
        <div class="actions">
          <button type="button" class="secondary" onclick={copyPython}>{t('code_copy')}</button>
          <button type="button" class="plain" onclick={clearPython}>
            {t('code_clear_python')}
          </button>
          <button type="button" class="plain" onclick={() => showTab('blocks')}>
            {t('code_back_to_blocks')}
          </button>
        </div>
      {:else}
        <p>{t('code_python_intro')}</p>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <pre tabindex="0"><code>{python}</code></pre>
        <div class="actions">
          <button type="button" class="secondary" onclick={copyPython}>{t('code_copy')}</button>
          <button type="button" class="plain" onclick={editAsPython}>
            {t('code_edit_python')}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="side">
    <p class="running-what" aria-live="polite">
      {mode === 'python' ? t('code_runs_python') : t('code_runs_blocks')}
    </p>
    <Simulator bind:this={sim} src={simulatorSrc} {labels} files={simulatorFiles} />
    <label class="name">
      <span>{t('code_program_name')}</span>
      <input type="text" bind:value={name} oninput={rename} maxlength="60" />
    </label>
    <div class="actions">
      <button type="button" class="primary" onclick={download}>{t('code_download_hex')}</button>
      {#if hasUsb && featureOn('send_to_microbit')}
        <button type="button" class="secondary" onclick={send}>{t('code_send')}</button>
      {/if}
      <button type="button" class="plain" onclick={openDialog}>{t('code_programs')}</button>
    </div>
    {#if !hasUsb}
      <p class="note">{t('code_no_usb')}</p>
    {/if}
    {#if progress !== null}
      <progress max="100" value={progress} aria-label={t('code_progress')}>{progress}%</progress>
    {/if}
    <p class="status" role="status">{status}{progress !== null ? ` ${progress}%` : ''}</p>
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
    <button type="button" class="primary" onclick={startNew}>{t('code_new')}</button>
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
    /* Grows on phones so the buttons under the blocks never spill over the page footer. */
    min-block-size: max(32rem, calc(100dvh - 7.5rem));
    background: #fdfdff;
    color: #000;
    color-scheme: light;
  }
  @media (min-width: 48rem) {
    .editor {
      grid-template-areas: 'side tabs' 'side main';
      grid-template-columns: 19rem 1fr;
      grid-template-rows: auto 1fr;
      block-size: max(32rem, calc(100dvh - 7.5rem));
    }
    .side {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      border-block-start: none !important;
      border-inline-end: 1px solid #e1e1e1;
    }
  }
  .tabs {
    grid-area: tabs;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.375rem 0.75rem;
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
  .workspace {
    display: flex;
    flex-direction: column;
  }
  .blockly {
    flex: 1;
    min-block-size: 0;
    inline-size: 100%;
    background: #ecf0f1;
  }
  /* Search sits in the top bar, beside the Blocks / Python switch, so the blocks can never
     cover it (it used to float over the toolbox). */
  .search {
    flex: 0 1 11rem;
    min-inline-size: 8rem;
  }
  .tablist {
    display: flex;
  }
  .junior-link {
    display: inline-flex;
    align-items: center;
    min-block-size: 44px;
    padding-inline: 0.75rem;
    font-weight: 700;
    color: #fff;
    background: #2e7d32;
    border-radius: 6px;
    text-decoration: none;
  }
  .search[hidden] {
    display: none;
  }
  .search input {
    inline-size: 100%;
    min-block-size: 36px;
    padding-inline: 0.5rem;
    border: 1px solid #8a8a8a;
    border-radius: 6px;
    font: inherit;
    font-size: 0.875rem;
  }
  .search input:focus-visible {
    outline: 3px solid #000;
    outline-offset: 1px;
  }
  progress {
    inline-size: 100%;
    block-size: 0.75rem;
    margin-block-start: 0.5rem;
    accent-color: #6633cc;
  }
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  /* MakeCode-style toolbox: white, a coloured bar, an icon and a coloured name per category. */
  :global(.blocklyToolbox) {
    background: #fff;
  }
  :global(.rfaCategory) {
    min-block-size: 2.5rem;
  }
  :global(.rfaIcon) {
    display: inline-block;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin-inline: 0.25rem 0.5rem;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
    vertical-align: middle;
  }
  :global(.rfaLabel) {
    font-weight: 600;
  }
  .running-what {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    text-align: center;
  }
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0.5rem 1rem;
    background: #fff8d6;
    font-size: 0.875rem;
  }
  .code-label {
    display: block;
    margin-block-end: 0.25rem;
    font-weight: 600;
  }
  .code {
    inline-size: 100%;
    min-block-size: 18rem;
    padding: 0.75rem;
    border: 1px solid #8a8a8a;
    border-radius: 6px;
    font-family: ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    tab-size: 4;
    white-space: pre;
  }
  .code:focus-visible {
    outline: 3px solid #000;
    outline-offset: 2px;
  }
  .python .actions {
    margin-block-start: 0.5rem;
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
    /* Never wider than the screen on small phones. */
    min-inline-size: 0;
    max-inline-size: 100vw;
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
