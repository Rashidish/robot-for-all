<script>
  import LangSwitch from '../../../lib/LangSwitch.svelte';
  let { data } = $props();
</script>

<svelte:head><title>{data.title} · Robot For All</title></svelte:head>

<LangSwitch />
<article>
  <h1>{data.title}</h1>
  {@html data.html}
</article>
