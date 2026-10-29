import { describe, it, expect } from 'vitest';
import { parseWgs84, formatWgs84, wgs84ToMgrs, parseMgrs } from '../src/domain/coordinates.js';
import { normalizeDegrees, degreesToVaneArrow, formatWindDirection } from '../src/domain/windVane.js';

describe('coordinates WGS 84 <-> MGRS', () => {
  it('parses comma- and space-separated WGS 84 coordinates', () => {
    expect(parseWgs84('50.4501, 30.5234')).toEqual({ ok: true, lat: 50.4501, lon: 30.5234 });
    expect(parseWgs84('  -33.8688   151.2093 ')).toEqual({ ok: true, lat: -33.8688, lon: 151.2093 });
  });

  it('rejects out-of-bounds or malformed WGS 84 strings without NaN', () => {
    expect(parseWgs84('95.1, 30.5').ok).toBe(false);
    expect(parseWgs84('50.4, 190.0').ok).toBe(false);
    expect(parseWgs84('kyiv').ok).toBe(false);
  });

  it('round-trips Kyiv coordinates between WGS 84 and MGRS including lowercase spaced input', () => {
    const converted = wgs84ToMgrs(50.4501, 30.5234, 5);
    expect(converted.ok).toBe(true);
    expect(converted.mgrs).toMatch(/^36U\s?[A-Z]{2}\s?\d{5}\s?\d{5}$/);

    const spacedLower = converted.mgrs.toLowerCase();
    const back = parseMgrs(`  ${spacedLower}  `);
    expect(back.ok).toBe(true);
    expect(back.lat).toBeCloseTo(50.4501, 3);
    expect(back.lon).toBeCloseTo(30.5234, 3);
  });

  it('rejects polar latitudes outside MGRS bounds (-80..84) and garbage MGRS strings', () => {
    expect(wgs84ToMgrs(86.0, 10.0).ok).toBe(false);
    expect(wgs84ToMgrs(-82.0, 10.0).ok).toBe(false);
    expect(parseMgrs('NOT-AN-MGRS').ok).toBe(false);
    expect(parseMgrs('').ok).toBe(false);
  });

  it('formats WGS 84 to fixed decimal precision', () => {
    expect(formatWgs84(50.4501, 30.5234, 4)).toBe('50.4501, 30.5234');
  });
});

describe('meteorological wind vane formatting', () => {
  it('maps meteorological origin degrees to vane arrows matching spec example ↗ 45°', () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-45)).toBe(315);
    expect(degreesToVaneArrow(0)).toBe('↑');
    expect(degreesToVaneArrow(45)).toBe('↗');
    expect(degreesToVaneArrow(90)).toBe('→');
    expect(degreesToVaneArrow(180)).toBe('↓');
    expect(degreesToVaneArrow(225)).toBe('↙');
    expect(formatWindDirection(45)).toEqual({ arrow: '↗', degrees: 45, label: '↗ 45°' });
    expect(formatWindDirection(null)).toEqual({ arrow: '—', degrees: null, label: '—' });
  });
});
