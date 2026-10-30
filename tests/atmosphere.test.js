import { describe, it, expect } from 'vitest';
import {
  AGL_TIERS_METERS,
  formatAglLabel,
  interpolateCircularDegrees,
  computeAltitudeProfile,
} from '../src/domain/atmosphere.js';

describe('AGL vertical interpolation and Wind Shear gust model', () => {
  it('exposes all 15 spec AGL tiers from surface (0) to 5000 m including 4000 m without 25 m', () => {
    expect(AGL_TIERS_METERS).toEqual([
      0, 50, 75, 100, 120, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 4000, 5000,
    ]);
    expect(formatAglLabel(0)).toBe('Земля');
    expect(formatAglLabel(4000)).toBe('4 000 м');
    expect(formatAglLabel(5000)).toBe('5 000 м');
  });

  it('interpolates 4000m AGL tier between bounding upper-air pressure levels and omits 25m', () => {
    const profile = computeAltitudeProfile({
      elevationMeters: 100,
      surface: {
        tempC: 12,
        humidityPct: 60,
        cloudCoverPct: 20,
        cloudLowPct: 20,
        cloudMidPct: 40,
        windSpeed10m: 4,
        windDir10m: 90,
        windGusts10m: 6,
      },
      pressureLevels: [
        // 3000m AGL (3100m MSL) -> 5000m AGL (5100m MSL): midpoint 4000m AGL should interpolate linearly
        { hPa: 700, geopotentialHeightMsl: 3100, windSpeedMs: 10, windDirDeg: 180, tempC: -4, humidityPct: 50, cloudCoverPct: 30 },
        { hPa: 500, geopotentialHeightMsl: 5100, windSpeedMs: 20, windDirDeg: 200, tempC: -16, humidityPct: 70, cloudCoverPct: 80 },
      ],
    });

    expect(profile[25]).toBeUndefined();
    expect(profile[4000]).toMatchObject({
      aglMeters: 4000,
      aglLabel: '4 000 м',
      windSpeedMs: 15,
      windDirDeg: 190,
      tempC: -10,
      humidityPct: 60,
      cloudCoverPct: 55,
    });
  });

  it('interpolates wind direction across 360°/0° North boundary via shortest arc', () => {
    expect(interpolateCircularDegrees(350, 10, 0.5)).toBe(0);
    expect(interpolateCircularDegrees(10, 350, 0.5)).toBe(0);
    expect(interpolateCircularDegrees(45, 135, 0.5)).toBe(90);
  });

  it('discards subterranean pressure levels when terrain elevation is high (1400m MSL)', () => {
    const profile = computeAltitudeProfile({
      elevationMeters: 1400,
      surface: {
        tempC: 8,
        humidityPct: 70,
        cloudCoverPct: 40,
        cloudLowPct: 30,
        cloudMidPct: 60,
        windSpeed10m: 5,
        windDir10m: 90,
        windGusts10m: 8,
        windSpeed80m: 6,
        windDir80m: 95,
        temp80m: 7.5,
      },
      pressureLevels: [
        // Subterranean level (110m MSL < 1400m terrain) with bogus 99 m/s wind — must be ignored!
        { hPa: 1000, geopotentialHeightMsl: 110, windSpeedMs: 99, windDirDeg: 270, tempC: 30, humidityPct: 10, cloudCoverPct: 0 },
        { hPa: 800, geopotentialHeightMsl: 1950, windSpeedMs: 10, windDirDeg: 100, tempC: 4, humidityPct: 75, cloudCoverPct: 50 },
        { hPa: 500, geopotentialHeightMsl: 5600, windSpeedMs: 18, windDirDeg: 110, tempC: -18, humidityPct: 60, cloudCoverPct: 80 },
        { hPa: 400, geopotentialHeightMsl: 7200, windSpeedMs: 24, windDirDeg: 120, tempC: -30, humidityPct: 40, cloudCoverPct: 85 },
      ],
    });

    expect(profile[0].windSpeedMs).toBe(5);
    expect(profile[50].windSpeedMs).toBeLessThan(10); // Not corrupted by 99 m/s subterranean 1000 hPa
    expect(profile[5000].windSpeedMs).toBeGreaterThan(18);
    expect(profile[5000].cloudCoverPct).toBeGreaterThanOrEqual(80);
  });

  it('produces gusts equal to wind speed in uniform laminar upper air and higher gusts under strong wind shear', () => {
    const laminar = computeAltitudeProfile({
      elevationMeters: 100,
      surface: {
        tempC: 10, humidityPct: 50, cloudCoverPct: 20, cloudLowPct: 20, cloudMidPct: 20,
        windSpeed10m: 10, windDir10m: 180, windGusts10m: 10,
      },
      pressureLevels: [
        { hPa: 900, geopotentialHeightMsl: 1100, windSpeedMs: 10, windDirDeg: 180, tempC: 4, humidityPct: 50, cloudCoverPct: 25 },
        { hPa: 700, geopotentialHeightMsl: 3100, windSpeedMs: 10, windDirDeg: 180, tempC: -6, humidityPct: 50, cloudCoverPct: 25 },
        { hPa: 500, geopotentialHeightMsl: 5600, windSpeedMs: 10, windDirDeg: 180, tempC: -20, humidityPct: 50, cloudCoverPct: 25 },
      ],
    });
    expect(laminar[2000].windGustMs).toBe(laminar[2000].windSpeedMs);

    const sheared = computeAltitudeProfile({
      elevationMeters: 100,
      surface: {
        tempC: 10, humidityPct: 50, cloudCoverPct: 20, cloudLowPct: 20, cloudMidPct: 20,
        windSpeed10m: 4, windDir10m: 90, windGusts10m: 7,
      },
      pressureLevels: [
        { hPa: 900, geopotentialHeightMsl: 1100, windSpeedMs: 8, windDirDeg: 90, tempC: 4, humidityPct: 50, cloudCoverPct: 40 },
        { hPa: 800, geopotentialHeightMsl: 2100, windSpeedMs: 22, windDirDeg: 210, tempC: -2, humidityPct: 65, cloudCoverPct: 70 },
        { hPa: 500, geopotentialHeightMsl: 5600, windSpeedMs: 25, windDirDeg: 220, tempC: -20, humidityPct: 50, cloudCoverPct: 80 },
      ],
    });
    expect(sheared[0].windGustMs).toBe(7);
    expect(sheared[1500].windGustMs).toBeGreaterThan(sheared[1500].windSpeedMs);
  });

  it('enforces 180m AGL minimum cutoff for isobaric pressure levels even when near-surface knots are absent', () => {
    const profile = computeAltitudeProfile({
      elevationMeters: 500,
      surface: {
        tempC: 15,
        humidityPct: 60,
        cloudCoverPct: 10,
        cloudLowPct: 10,
        cloudMidPct: 10,
        windSpeed10m: 3,
        windDir10m: 180,
        windGusts10m: 5,
        // No 80m, 120m, 180m near-surface knots provided
      },
      pressureLevels: [
        // AGL = 600 - 500 = 100m, which is <= 180m minimum isobaric cutoff. Must be ignored!
        { hPa: 950, geopotentialHeightMsl: 600, windSpeedMs: 99, windDirDeg: 0, tempC: 30, humidityPct: 10, cloudCoverPct: 0 },
        // AGL = 800 - 500 = 300m, valid isobaric knot
        { hPa: 925, geopotentialHeightMsl: 800, windSpeedMs: 7, windDirDeg: 190, tempC: 12, humidityPct: 65, cloudCoverPct: 20 },
      ],
    });

    // 100m AGL tier must NOT be 99 m/s from subterranean/near-ground isobaric level
    expect(profile[100].windSpeedMs).toBeLessThan(10);
  });

  it('preserves null for missing tempC and humidityPct across interpolated tiers instead of coercing null to 0', () => {
    const profile = computeAltitudeProfile({
      elevationMeters: 100,
      surface: {
        tempC: null,
        humidityPct: null,
        cloudCoverPct: 30,
        cloudLowPct: 30,
        windSpeed10m: 5,
        windDir10m: 90,
        windGusts10m: 7,
      },
      pressureLevels: [
        { hPa: 700, geopotentialHeightMsl: 3100, windSpeedMs: 15, windDirDeg: 180, tempC: null, humidityPct: null, cloudCoverPct: 50 },
      ],
    });

    expect(profile[0].tempC).toBeNull();
    expect(profile[500].tempC).toBeNull();
    expect(profile[1500].tempC).toBeNull();
    expect(profile[500].humidityPct).toBeNull();
    expect(profile[1500].humidityPct).toBeNull();
  });

  it('skips incomplete pressure levels where windSpeedMs is null instead of injecting a fake 0 m/s wind drop', () => {
    const profile = computeAltitudeProfile({
      elevationMeters: 100,
      surface: {
        tempC: 12,
        humidityPct: 60,
        cloudCoverPct: 20,
        windSpeed10m: 10,
        windDir10m: 180,
        windGusts10m: 10,
      },
      pressureLevels: [
        // Valid geopotential height (1600m MSL = 1500m AGL) with missing windSpeedMs
        { hPa: 850, geopotentialHeightMsl: 1600, windSpeedMs: null, windDirDeg: null, tempC: 2, humidityPct: 60, cloudCoverPct: 30 },
        { hPa: 700, geopotentialHeightMsl: 3100, windSpeedMs: 20, windDirDeg: 180, tempC: -6, humidityPct: 50, cloudCoverPct: 40 },
      ],
    });

    // Midpoint 1500m between 0m (10 m/s) and 3000m (20 m/s) should be ~15 m/s, NOT 0 m/s
    expect(profile[1500].windSpeedMs).toBeCloseTo(15, 0);
  });
});
