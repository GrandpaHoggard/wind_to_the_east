import * as mgrsPkg from 'mgrs';

const { forward, toPoint } = mgrsPkg.forward ? mgrsPkg : Reflect.get(mgrsPkg, 'default');

const DECIMAL_COORD_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Normalizes potentially unwrapped map coordinates (e.g. from Leaflet panning across ±180°)
 * into canonical WGS 84 bounds: lat in [-90, 90], lon in [-180, 180].
 */
export function normalizeMapCoordinates(lat, lon) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  const clampedLat = Math.max(-90, Math.min(90, Number.isFinite(numLat) ? numLat : 0));
  let wrappedLon = Number.isFinite(numLon)
    ? ((((numLon + 180) % 360) + 360) % 360) - 180
    : 0;
  if (wrappedLon === -180 && numLon > 0) {
    wrappedLon = 180;
  }
  return {
    lat: clampedLat === 0 ? 0 : clampedLat,
    lon: wrappedLon === 0 ? 0 : wrappedLon,
  };
}

/**
 * Parses user input into WGS 84 latitude and longitude.
 * Accepts formats: "50.4501, 30.5234", "50.4501 30.5234", "-33.8688, 151.2093", "50.4501°; 30.5234°".
 */
export function parseWgs84(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Вхідне значення повинно бути текстом' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Введіть координати' };
  }

  // Match: latitude, longitude separated by comma, semicolon, and/or whitespace
  const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
  if (parts.length !== 2) {
    return { ok: false, error: 'Формат повинен містити два числа: широту та довготу' };
  }

  const rawLat = parts[0].replace(/°$/, '');
  const rawLon = parts[1].replace(/°$/, '');

  if (!DECIMAL_COORD_RE.test(rawLat) || !DECIMAL_COORD_RE.test(rawLon)) {
    return { ok: false, error: 'Широта та довгота повинні бути дійсними числами' };
  }

  const lat = Number(rawLat);
  const lon = Number(rawLon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Широта та довгота повинні бути дійсними числами' };
  }

  if (lat < -90 || lat > 90) {
    return { ok: false, error: 'Широта повинна бути в межах від -90 до 90 градусів' };
  }

  if (lon < -180 || lon > 180) {
    return { ok: false, error: 'Довгота повинна бути в межах від -180 до 180 градусів' };
  }

  return {
    ok: true,
    lat: lat === 0 ? 0 : lat,
    lon: lon === 0 ? 0 : lon,
  };
}

/**
 * Formats latitude and longitude to fixed decimal representation.
 */
export function formatWgs84(lat, lon, decimals = 5) {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '—';
  }
  const threshold = 0.5 * Math.pow(10, -decimals);
  const cleanLat = Math.abs(lat) < threshold ? 0 : lat;
  const cleanLon = Math.abs(lon) < threshold ? 0 : lon;
  return `${cleanLat.toFixed(decimals)}, ${cleanLon.toFixed(decimals)}`;
}

/**
 * Converts WGS 84 coordinates to formatted MGRS string.
 * MGRS valid latitude range is -80° to 84°.
 */
export function wgs84ToMgrs(lat, lon, accuracy = 5) {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Недійсні координати' };
  }
  if (lat < -80 || lat > 84) {
    return { ok: false, error: 'MGRS підтримує широту лише від -80° до 84°' };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, error: 'Довгота поза межами (-180°..180°)' };
  }

  try {
    const raw = forward([lon, lat], accuracy);
    // Format into standard readable MGRS spacing: e.g. "36U UA 24193 90589"
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

  // Strict MGRS validation: zone 1..60, band C..X (except I, O), 100km square, even 0..10 digits
  const match = cleaned.match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z][A-HJ-NP-V])(\d*)$/);
  if (!match) {
    return { ok: false, error: 'Некоректний формат MGRS координат' };
  }

  const zone = Number(match[1]);
  const band = match[2];
  const digits = match[4];

  if (zone < 1 || zone > 60) {
    return { ok: false, error: 'Номер зони MGRS повинен бути від 1 до 60' };
  }
  // Svalbard special MGRS rule: zones 32X, 34X, 36X do not exist
  if (band === 'X' && (zone === 32 || zone === 34 || zone === 36)) {
    return { ok: false, error: `Зона ${zone}${band} не існує в системі MGRS` };
  }
  if (digits.length % 2 !== 0 || digits.length > 10) {
    return { ok: false, error: 'Кількість цифр MGRS повинна бути парною (до 10 цифр)' };
  }

  try {
    const point = toPoint(cleaned);
    const lon = point[0];
    const lat = point[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { ok: false, error: 'Неможливо отримати дійсні координати з MGRS' };
    }
    // Re-format canonical MGRS string
    const formatted = wgs84ToMgrs(lat, lon, 5);
    return {
      ok: true,
      lat,
      lon,
      mgrs: formatted.ok ? formatted.mgrs : cleaned,
    };
  } catch {
    return { ok: false, error: 'Недійсні координати MGRS' };
  }
}
