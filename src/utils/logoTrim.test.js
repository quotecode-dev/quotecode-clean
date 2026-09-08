import { describe, it, expect } from 'vitest';
import { computeTransparentTrimBounds } from './logoTrim';

// בונה ImageData מדומה (Uint8ClampedArray שטוח) מגריד טקסטואלי: '.' =
// שקוף לגמרי (alpha 0), כל תו אחר = אטום (alpha 255). מדמה בדיוק את מבנה
// ה-ImageData.data האמיתי (RGBA רציף) בלי צורך ב-canvas/jsdom אמיתי.
function gridToImageData(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const opaque = row[x] !== '.';
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = opaque ? 255 : 0;
    }
  });
  return { data, width, height };
}

describe('computeTransparentTrimBounds', () => {
  it('trims a real transparent border on all four sides', () => {
    const { data, width, height } = gridToImageData([
      '.....',
      '.XXX.',
      '.XXX.',
      '.....',
    ]);
    const bounds = computeTransparentTrimBounds(data, width, height);
    expect(bounds).toEqual({ x: 1, y: 1, width: 3, height: 2, trimmed: true });
  });

  it('never trims a logo with no transparent padding (fully opaque, e.g. a solid white-background PNG)', () => {
    const { data, width, height } = gridToImageData([
      'XXXX',
      'XXXX',
      'XXXX',
    ]);
    const bounds = computeTransparentTrimBounds(data, width, height);
    expect(bounds).toEqual({ x: 0, y: 0, width: 4, height: 3, trimmed: false });
  });

  it('trims asymmetric padding correctly (more whitespace on one side than another)', () => {
    const { data, width, height } = gridToImageData([
      '..........',
      '..........',
      '..........',
      '...XX.....',
      '...XX.....',
      '..........',
    ]);
    const bounds = computeTransparentTrimBounds(data, width, height);
    expect(bounds).toEqual({ x: 3, y: 3, width: 2, height: 2, trimmed: true });
  });

  it('falls back to the full untrimmed bounds for a completely empty (fully transparent) image, never an empty crop', () => {
    const { data, width, height } = gridToImageData([
      '...',
      '...',
      '...',
    ]);
    const bounds = computeTransparentTrimBounds(data, width, height);
    expect(bounds.trimmed).toBe(false);
    expect(bounds.width).toBe(3);
    expect(bounds.height).toBe(3);
  });

  it('handles missing/zero-size input safely without throwing', () => {
    expect(computeTransparentTrimBounds(null, 0, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0, trimmed: false });
  });
});
