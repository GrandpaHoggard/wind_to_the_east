import { normalizeDegrees, formatWindDirection } from './windVane.js';

export const AGL_TIERS_METERS = [
  0, 50, 75, 100, 120, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 4000, 5000,
];

/**
 * Formats AGL altitude in meters to human-readable Ukrainian label:
 * 0 -> "Земля"
 * 500 -> "500 м"
 * 1500 -> "1 500 м"
 * 5000 -> "5 000 м"
 */
export function formatAglLabel(aglMeters) {
  if (aglMeters === 0) return 'Земля';
  if (aglMeters >= 1000) {
    const thousands = Math.floor(aglMeters / 1000);
    const remainder = aglMeters % 1000;
    if (remainder === 0) return `${thousands} 000 м`;
    return `${thousands} ${String(remainder).padStart(3, '0')} м`;
  }
  return `${aglMeters} м`;
}

/**
 * Shortest-arc circular angle interpolation across North boundary (360° / 0°).
 */
export function interpolateCircularDegrees(degA, degB, t) {
  const normA = normalizeDegrees(degA);
  const normB = normalizeDegrees(degB);
  // Shortest angular distance between -180 and +180
  const delta = ((normB - normA + 540) % 360) - 180;
  return normalizeDegrees(normA + delta * t);
}

function lerp(a, b, t) {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return a + (b - a) * t;
}

function round1OrNull(val) {
  return val == null ? null : Math.round(val * 10) / 10;
}

function roundIntOrNull(val) {
  return val == null ? null : Math.round(val);
}

/**
 * Computes the 15-tier vertical atmospheric profile from raw surface + isobaric inputs.
 * Enforces:
 * - Exclusion of subterranean pressure levels (where geopotentialHeightMsl <= elevationMeters)
 * - Circular vector wind direction interpolation across North
 * - Aviation Wind Shear + surface turbulence decay gust calculation
 */
export function computeAltitudeProfile(rawHour) {
  const elevation = rawHour?.elevationMeters || 0;
  const s = rawHour?.surface || {};

  // 1. Build sorted vertical anchor knots in AGL coordinates
  const knots = [];

  // Surface knot (agl = 0)
  knots.push({
    agl: 0,
    windSpeedMs: s.windSpeed10m ?? 0,
    windDirDeg: s.windDir10m ?? 0,
    tempC: s.tempC ?? null,
    humidityPct: s.humidityPct ?? null,
    cloudCoverPct: s.cloudCoverPct ?? s.cloudLowPct ?? 0,
  });

  // Fixed near-surface model levels if provided
  if (s.windSpeed80m != null) {
    knots.push({
      agl: 80,
      windSpeedMs: s.windSpeed80m,
      windDirDeg: s.windDir80m ?? s.windDir10m ?? 0,
      tempC: s.temp80m ?? s.tempC ?? null,
      humidityPct: s.humidityPct ?? null,
      cloudCoverPct: s.cloudLowPct ?? s.cloudCoverPct ?? 0,
    });
  }
  if (s.windSpeed120m != null) {
    knots.push({
      agl: 120,
      windSpeedMs: s.windSpeed120m,
      windDirDeg: s.windDir120m ?? s.windDir10m ?? 0,
      tempC: s.temp120m ?? s.tempC ?? null,
      humidityPct: s.humidityPct ?? null,
      cloudCoverPct: s.cloudLowPct ?? s.cloudCoverPct ?? 0,
    });
  }
  if (s.windSpeed180m != null) {
    knots.push({
      agl: 180,
      windSpeedMs: s.windSpeed180m,
      windDirDeg: s.windDir180m ?? s.windDir10m ?? 0,
      tempC: s.temp180m ?? s.tempC ?? null,
      humidityPct: s.humidityPct ?? null,
      cloudCoverPct: s.cloudLowPct ?? s.cloudCoverPct ?? 0,
    });
  }

  const maxNearSurfaceAgl = knots[knots.length - 1].agl;
  const minIsobaricAgl = Math.max(180, maxNearSurfaceAgl);

  // Isobaric level knots (filtered to exclude subterranean, near-ground, or windless incomplete levels)
  if (Array.isArray(rawHour?.pressureLevels)) {
    for (const pl of rawHour.pressureLevels) {
      if (pl.geopotentialHeightMsl == null || pl.windSpeedMs == null) continue;
      const agl = pl.geopotentialHeightMsl - elevation;
      // Discard subterranean levels and levels below 180m / near-surface knots
      if (agl <= minIsobaricAgl) continue;

      let fallbackCloud = s.cloudCoverPct ?? 0;
      if (agl >= 4000 && s.cloudHighPct != null) {
        fallbackCloud = s.cloudHighPct;
      } else if (agl >= 2000 && s.cloudMidPct != null) {
        fallbackCloud = s.cloudMidPct;
      } else if (agl < 2000 && s.cloudLowPct != null) {
        fallbackCloud = s.cloudLowPct;
      }

      knots.push({
        agl,
        windSpeedMs: pl.windSpeedMs,
        windDirDeg: pl.windDirDeg ?? 0,
        tempC: pl.tempC ?? null,
        humidityPct: pl.humidityPct ?? null,
        cloudCoverPct: pl.cloudCoverPct ?? fallbackCloud,
      });
    }
  }

  // Sort anchors strictly by agl
  knots.sort((a, b) => a.agl - b.agl);

  // 2. Interpolate base scalar & directional values for all 15 AGL tiers
  const interpolated = [];

  for (const z of AGL_TIERS_METERS) {
    if (z <= knots[0].agl) {
      const k = knots[0];
      interpolated.push({
        aglMeters: z,
        windSpeedMs: k.windSpeedMs,
        windDirDeg: k.windDirDeg,
        tempC: k.tempC,
        humidityPct: k.humidityPct,
        cloudCoverPct: k.cloudCoverPct,
      });
      continue;
    }

    if (z >= knots[knots.length - 1].agl) {
      const k = knots[knots.length - 1];
      interpolated.push({
        aglMeters: z,
        windSpeedMs: k.windSpeedMs,
        windDirDeg: k.windDirDeg,
        tempC: k.tempC,
        humidityPct: k.humidityPct,
        cloudCoverPct: k.cloudCoverPct,
      });
      continue;
    }

    // Find bounding anchors
    let lower = knots[0];
    let upper = knots[knots.length - 1];
    for (let i = 0; i < knots.length - 1; i++) {
      if (knots[i].agl <= z && knots[i + 1].agl >= z) {
        lower = knots[i];
        upper = knots[i + 1];
        break;
      }
    }

    const span = upper.agl - lower.agl;
    const t = span > 0 ? (z - lower.agl) / span : 0;

    interpolated.push({
      aglMeters: z,
      windSpeedMs: round1OrNull(lerp(lower.windSpeedMs, upper.windSpeedMs, t)),
      windDirDeg: interpolateCircularDegrees(lower.windDirDeg, upper.windDirDeg, t),
      tempC: round1OrNull(lerp(lower.tempC, upper.tempC, t)),
      humidityPct: roundIntOrNull(lerp(lower.humidityPct, upper.humidityPct, t)),
      cloudCoverPct: roundIntOrNull(lerp(lower.cloudCoverPct, upper.cloudCoverPct, t)),
    });
  }

  // 3. Aviation Wind Shear & Turbulence Gust Calculation
  const result = {};
  const s0 = s.windSpeed10m ?? interpolated[0].windSpeedMs ?? 0;
  const g0 = s.windGusts10m ?? s0;
  const surfaceExcess = Math.max(0, g0 - s0);

  for (let i = 0; i < interpolated.length; i++) {
    const item = interpolated[i];
    const z = item.aglMeters;
    const speed = item.windSpeedMs ?? 0;

    if (z === 0) {
      const dirObj = formatWindDirection(item.windDirDeg);
      result[0] = {
        aglMeters: 0,
        aglLabel: formatAglLabel(0),
        windSpeedMs: speed,
        windGustMs: Math.round(Math.max(speed, g0) * 10) / 10,
        windDirDeg: item.windDirDeg,
        windDirectionLabel: dirObj.label,
        windArrow: dirObj.arrow,
        tempC: item.tempC,
        humidityPct: item.humidityPct,
        cloudCoverPct: item.cloudCoverPct,
      };
      continue;
    }

    // Exponential boundary-layer turbulence decay from ground obstacles
    let blAdd = surfaceExcess * Math.exp(-z / 350);
    if (blAdd < 0.15) blAdd = 0;

    // Vector wind-shear rate between neighboring tiers
    const prev = i > 0 ? interpolated[i - 1] : item;
    const next = i < interpolated.length - 1 ? interpolated[i + 1] : item;
    const dz = Math.max(1, next.aglMeters - prev.aglMeters);

    const radPrev = ((prev.windDirDeg ?? 0) * Math.PI) / 180;
    const radNext = ((next.windDirDeg ?? 0) * Math.PI) / 180;
    const u1 = (prev.windSpeedMs ?? 0) * Math.sin(radPrev);
    const v1 = (prev.windSpeedMs ?? 0) * Math.cos(radPrev);
    const u2 = (next.windSpeedMs ?? 0) * Math.sin(radNext);
    const v2 = (next.windSpeedMs ?? 0) * Math.cos(radNext);

    const shearRatePer100m = (Math.hypot(u2 - u1, v2 - v1) / dz) * 100;
    const shearAdd = shearRatePer100m > 0.35 ? Math.min(speed * 0.65, shearRatePer100m * 1.8) : 0;

    const gust = Math.round(Math.max(speed, speed + blAdd + shearAdd) * 10) / 10;
    const dirObj = formatWindDirection(item.windDirDeg);

    result[z] = {
      aglMeters: z,
      aglLabel: formatAglLabel(z),
      windSpeedMs: speed,
      windGustMs: gust,
      windDirDeg: item.windDirDeg,
      windDirectionLabel: dirObj.label,
      windArrow: dirObj.arrow,
      tempC: item.tempC,
      humidityPct: item.humidityPct,
      cloudCoverPct: item.cloudCoverPct,
    };
  }

  return result;
}
