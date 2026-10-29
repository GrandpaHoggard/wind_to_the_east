import { computeAltitudeProfile } from '../domain/atmosphere.js';
import { isoHourToDisplay } from '../domain/datetime.js';

export const PRESSURE_LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400];

const SURFACE_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'wind_speed_80m',
  'wind_direction_80m',
  'wind_speed_120m',
  'wind_direction_120m',
  'wind_speed_180m',
  'wind_direction_180m',
  'temperature_80m',
  'temperature_120m',
  'temperature_180m',
];

/**
 * Builds deterministic Open-Meteo API URL for 14-day hourly forecast.
 */
export function buildForecastUrl(lat, lon, forecastDays = 14) {
  const isobaricVars = PRESSURE_LEVELS_HPA.flatMap((p) => [
    `wind_speed_${p}hPa`,
    `wind_direction_${p}hPa`,
    `temperature_${p}hPa`,
    `relative_humidity_${p}hPa`,
    `cloud_cover_${p}hPa`,
    `geopotential_height_${p}hPa`,
  ]);

  const allVars = [...SURFACE_VARS, ...isobaricVars].join(',');

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    wind_speed_unit: 'ms',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
    timezone: 'auto',
    forecast_days: String(forecastDays),
    hourly: allVars,
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/**
 * Normalizes Open-Meteo JSON payload into structured HourlyForecastRecord[]
 * computing 15-tier AGL profiles for each hour.
 */
export function normalizeForecastResponse(json) {
  if (!json || typeof json !== 'object' || !json.hourly || !Array.isArray(json.hourly.time)) {
    throw new Error('Некоректний формат відповіді метеосервісу');
  }

  const elevationMeters = Number(json.elevation) || 0;
  const timezone = json.timezone || 'UTC';
  const h = json.hourly;
  const count = h.time.length;
  const hours = [];

  for (let i = 0; i < count; i++) {
    const timeIso = h.time[i];
    const { dateStr, hourStr } = isoHourToDisplay(timeIso);

    const pressureLevels = PRESSURE_LEVELS_HPA.map((p) => ({
      hPa: p,
      geopotentialHeightMsl: h[`geopotential_height_${p}hPa`]?.[i] ?? null,
      windSpeedMs: h[`wind_speed_${p}hPa`]?.[i] ?? null,
      windDirDeg: h[`wind_direction_${p}hPa`]?.[i] ?? null,
      tempC: h[`temperature_${p}hPa`]?.[i] ?? null,
      humidityPct: h[`relative_humidity_${p}hPa`]?.[i] ?? null,
      cloudCoverPct: h[`cloud_cover_${p}hPa`]?.[i] ?? null,
    }));

    const rawHour = {
      elevationMeters,
      surface: {
        tempC: h.temperature_2m?.[i] ?? null,
        humidityPct: h.relative_humidity_2m?.[i] ?? null,
        precipMm: h.precipitation?.[i] ?? null,
        precipProbPct: h.precipitation_probability?.[i] ?? null,
        cloudCoverPct: h.cloud_cover?.[i] ?? null,
        cloudLowPct: h.cloud_cover_low?.[i] ?? null,
        cloudMidPct: h.cloud_cover_mid?.[i] ?? null,
        windSpeed10m: h.wind_speed_10m?.[i] ?? null,
        windDir10m: h.wind_direction_10m?.[i] ?? null,
        windGusts10m: h.wind_gusts_10m?.[i] ?? null,
        windSpeed80m: h.wind_speed_80m?.[i] ?? null,
        windDir80m: h.wind_direction_80m?.[i] ?? null,
        temp80m: h.temperature_80m?.[i] ?? null,
        windSpeed120m: h.wind_speed_120m?.[i] ?? null,
        windDir120m: h.wind_direction_120m?.[i] ?? null,
        temp120m: h.temperature_120m?.[i] ?? null,
        windSpeed180m: h.wind_speed_180m?.[i] ?? null,
        windDir180m: h.wind_direction_180m?.[i] ?? null,
        temp180m: h.temperature_180m?.[i] ?? null,
      },
      pressureLevels,
    };

    const tiers = computeAltitudeProfile(rawHour);

    hours.push({
      timeIso,
      dateStr,
      hourStr,
      precipMm: h.precipitation?.[i] != null ? Math.round(h.precipitation[i] * 10) / 10 : 0,
      precipProbPct: h.precipitation_probability?.[i] != null ? Math.round(h.precipitation_probability[i]) : 0,
      surfaceHumidityPct: h.relative_humidity_2m?.[i] != null ? Math.round(h.relative_humidity_2m[i]) : null,
      surfaceCloudCoverPct: h.cloud_cover?.[i] != null ? Math.round(h.cloud_cover[i]) : null,
      tiers,
    });
  }

  return {
    elevationMeters,
    timezone,
    hours,
  };
}

/**
 * Fetches 14-day weather forecast with upper-air levels from Open-Meteo.
 */
export async function fetchWeatherForecast(lat, lon, fetchImpl = fetch) {
  const url = buildForecastUrl(lat, lon);
  let res;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    throw new Error(`Мережева помилка при підключенні до метеосервісу: ${err?.message || err}`);
  }

  if (!res || !res.ok) {
    const status = res?.status || 'невідомий';
    throw new Error(`Помилка сервера погоди: не вдалося завантажити метеодані (HTTP ${status})`);
  }

  const json = await res.json();
  return normalizeForecastResponse(json);
}

/**
 * Searches worldwide populated places using Open-Meteo Geocoding API.
 * Supports Ukrainian, English, and native localized spellings across all countries.
 */
export async function searchLocations(query, fetchImpl = fetch) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return [];
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=10&format=json`;
  let res;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    return [];
  }

  if (!res || !res.ok) return [];

  try {
    const json = await res.json();
    if (!Array.isArray(json?.results)) return [];

    return json.results.map((item) => ({
      id: item.id,
      name: item.name,
      admin1: item.admin1 || '',
      country: item.country || '',
      countryCode: item.country_code || '',
      lat: item.latitude,
      lon: item.longitude,
      elevation: item.elevation ?? null,
    }));
  } catch (err) {
    return [];
  }
}
