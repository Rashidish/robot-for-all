<script>
  // Same component in both prototypes. Real strings will come from the i18n package (ADR-003).
  const tagline = {
    en: 'From Cardboard to Innovation',
    pseudo: '[Ƒřǿḿ Ƈȧřḓƀǿȧřḓ ŧǿ Īƞƞǿṽȧŧīǿƞ]'
  };
  let lang = $state('en');
</script>

<label>
  Language
  <select bind:value={lang}>
    <option value="en">English</option>
    <option value="pseudo">Pseudo-locale</option>
  </select>
</label>
<p>{tagline[lang]}</p>
