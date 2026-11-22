// Loads and starts the editor. Imported on demand by /code/ after the page has loaded, so the
// heading and instructions appear straight away on slow phones while Blockly loads.
import { mount } from 'svelte';
import CodeEditor from '../components/CodeEditor.svelte';

export function start(target: HTMLElement, labels: Record<string, string>): void {
  target.replaceChildren();
  mount(CodeEditor, { target, props: { labels: labels as never } });
}
