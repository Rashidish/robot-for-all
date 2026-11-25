// Wrangler bundles the certificate fonts as binary data (wrangler.jsonc "rules").
declare module '*.ttf' {
  const data: ArrayBuffer;
  export default data;
}
