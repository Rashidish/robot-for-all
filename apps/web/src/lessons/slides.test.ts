import { describe, expect, it } from 'vitest';
import { splitSections } from './slides';

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
