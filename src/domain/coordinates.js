import * as mgrsModule from 'mgrs';

// Handle CommonJS / ESM default export variation
const mgrs = mgrsModule.default || mgrsModule;

/**
 * Parses user input into WGS 84 latitude and longitude.
 * Accepts formats: "50.4501, 30.5234", "50.4501 30.5234", "-33.8688, 151.2093".
 */
export function parseWgs84(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Вхідне значення повинно бути текстом' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Введіть координати' };
  }

  // Match: latitude, longitude separated by comma and/or whitespace
  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 2) {
    return { ok: false, error: 'Формат повинен містити два числа: широту та довготу' };
  }

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return { ok: false, error: 'Широта та довгота повинні бути дійсними числами' };
  }

  if (lat < -90 || lat > 90) {
    return { ok: false, error: 'Широта повинна бути в межах від -90 до 90 градусів' };
  }

  if (lon < -180 || lon > 180) {
    return { ok: false, error: 'Довгота повинна бути в межах від -180 до 180 градусів' };
  }

  return { ok: true, lat, lon };
}

/**
 * Formats latitude and longitude to fixed decimal representation.
 */
export function formatWgs84(lat, lon, decimals = 5) {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return '—';
  }
  return `${lat.toFixed(decimals)}, ${lon.toFixed(decimals)}`;
}

/**
 * Converts WGS 84 coordinates to formatted MGRS string.
 * MGRS valid latitude range is -80° to 84°.
 */
export function wgs84ToMgrs(lat, lon, accuracy = 5) {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return { ok: false, error: 'Недійсні координати' };
  }
  if (lat < -80 || lat > 84) {
    return { ok: false, error: 'MGRS підтримує широту лише від -80° до 84°' };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, error: 'Довгота поза межами (-180°..180°)' };
  }

  try {
    const raw = mgrs.forward([lon, lat], accuracy);
    // Format into standard readable MGRS spacing: e.g. "36U UA 24193 90589"
    // raw is typically like "36UUA2419390589" (gridZone: 3 chars, 100km id: 2 chars, easting: 5 chars, northing: 5 chars)
    const match = raw.match(/^(\d{1,2}[C-X])([A-Z]{2})(\d+)$/);
    if (match) {
      const gzd = match[1];
      const sq = match[2];
      const digits = match[3];
      const half = digits.length / 2;
      const easting = digits.slice(0, half);
      const northing = digits.slice(half);
      return { ok: true, mgrs: `${gzd} ${sq} ${easting} ${northing}` };
    }
    return { ok: true, mgrs: raw };
  } catch (err) {
    return { ok: false, error: `Помилка конвертації MGRS: ${err?.message || err}` };
  }
}

/**
 * Parses an MGRS string into WGS 84 latitude and longitude.
 * Accepts lowercase, spaced, or compact MGRS strings.
 */
export function parseMgrs(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Вхідне значення повинно бути текстом' };
  }
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  if (!cleaned) {
    return { ok: false, error: 'Введіть координати MGRS' };
  }

  // Basic sanity check for MGRS: 1-2 digits, 1 letter (C-X except I, O), 2 letters, even number of digits
  if (!/^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z]{2}\d*$/.test(cleaned)) {
    return { ok: false, error: 'Некоректний формат MGRS координат' };
  }

  try {
    const point = mgrs.toPoint(cleaned);
    const lon = point[0];
    const lat = point[1];
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return { ok: false, error: 'Неможливо отримати координати з MGRS' };
    }
    // Re-format canonical MGRS string
    const formatted = wgs84ToMgrs(lat, lon, 5);
    return {
      ok: true,
      lat,
      lon,
      mgrs: formatted.ok ? formatted.mgrs : cleaned,
    };
  } catch (err) {
    return { ok: false, error: 'Недійсні координати MGRS' };
  }
}
