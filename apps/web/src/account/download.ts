// Saving a certificate PDF (M5 FR-24): the file is handed straight to the phone's downloads and
// opened from there. The page never shows a preview of it, so the name is never on our screen.
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
