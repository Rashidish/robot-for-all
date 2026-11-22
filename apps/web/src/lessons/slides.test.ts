import { describe, expect, it } from 'vitest';
import { headingText, resolveImages, splitSections } from './slides';

describe('splitting a lesson into slides', () => {
  const html =
    '<!-- note --><p>intro</p>' +
    '<h2 id="predict">Predict</h2><p>What will happen?</p>' +
    '<h2 id="run">Run</h2><ul><li>Turn it</li></ul>' +
    '<h2 id="teacher-notes">Teacher notes &amp; tips</h2><p>Allow 10 minutes.</p>';

  it('makes one section per h2, with its content', () => {
    expect(splitSections(html)).toEqual([
      { heading: 'Predict', html: '<p>What will happen?</p>' },
      { heading: 'Run', html: '<ul><li>Turn it</li></ul>' },
      { heading: 'Teacher notes & tips', html: '<p>Allow 10 minutes.</p>' }
    ]);
  });

  it('returns nothing when there are no headings', () => {
    expect(splitSections('<p>just text</p>')).toEqual([]);
  });
});

describe('heading text is always safe plain text', () => {
  it.each([
    ['<em>Run</em>', 'Run'],
    ['&lt;script&gt;alert(1)&lt;/script&gt;', 'scriptalert(1)/script'],
    ['<scr<script>ipt>x', 'x'],
    ['Fish &amp;amp; chips', 'Fish &amp; chips']
  ])('%s → %s', (input, expected) => {
    expect(headingText(input)).toBe(expected);
    expect(headingText(input)).not.toMatch(/[<>]/);
  });
});

describe('lesson images in slides', () => {
  const placeholder =
    '<p><img __ASTRO_IMAGE_="{&quot;src&quot;:&quot;./images/cart.svg&quot;,&quot;alt&quot;:&quot;A cart &amp; its \\&quot;wheels\\&quot;&quot;,&quot;index&quot;:0}"></p>';

  it('turns placeholders into real images with their descriptions', () => {
    const html = resolveImages(placeholder, (src) =>
      src === './images/cart.svg' ? '/_astro/cart.abc.svg' : undefined
    );
    expect(html).toBe(
      '<p><img src="/_astro/cart.abc.svg" alt="A cart &amp; its &quot;wheels&quot;" loading="lazy"></p>'
    );
  });

  it('fails the build when an image is missing', () => {
    expect(() => resolveImages(placeholder, () => undefined)).toThrow(/no built image/);
  });
});
