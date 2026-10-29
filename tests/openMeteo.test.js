import { describe, it, expect, vi } from 'vitest';
import {
  buildForecastUrl,
  normalizeForecastResponse,
  fetchWeatherForecast,
  searchLocations,
} from '../src/services/openMeteo.js';

describe('Open-Meteo forecast & geocoding service', () => {
  it('builds forecast URL with wind_speed_unit=ms, celsius, mm, and all pressure levels', () => {
    const url = new URL(buildForecastUrl(50.4501, 30.5234));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('temperature_unit')).toBe('celsius');
    expect(url.searchParams.get('precipitation_unit')).toBe('mm');
    expect(url.searchParams.get('hourly')).toContain('wind_speed_500hPa');
    expect(url.searchParams.get('hourly')).toContain('cloud_cover_700hPa');
    expect(url.searchParams.get('hourly')).toContain('geopotential_height_400hPa');
  });

  it('normalizes hourly arrays and safely tolerates partial null values without NaN', () => {
    const payload = {
      elevation: 180,
      timezone: 'Europe/Kyiv',
      hourly: {
        time: ['2026-10-29T12:00'],
        temperature_2m: [14.2],
        relative_humidity_2m: [65],
        precipitation_probability: [20],
        precipitation: [0.0],
        cloud_cover: [45],
        cloud_cover_low: [30],
        cloud_cover_mid: [40],
        wind_speed_10m: [4.5],
        wind_direction_10m: [45],
        wind_gusts_10m: [7.2],
        geopotential_height_1000hPa: [null],
        wind_speed_1000hPa: [null],
        geopotential_height_500hPa: [5580],
        wind_speed_500hPa: [16.4],
        wind_direction_500hPa: [270],
        temperature_500hPa: [-19.5],
        relative_humidity_500hPa: [55],
        cloud_cover_500hPa: [75],
      },
    };

    const result = normalizeForecastResponse(payload);
    expect(result.elevationMeters).toBe(180);
    expect(result.hours).toHaveLength(1);
    expect(result.hours[0].dateStr).toBe('29\\10\\2026');
    expect(result.hours[0].tiers[0].windSpeedMs).toBe(4.5);
    expect(result.hours[0].tiers[0].windDirectionLabel).toBe('↗ 45°');
    expect(Number.isNaN(result.hours[0].tiers[5000].windSpeedMs)).toBe(false);
  });

  it('throws a descriptive Ukrainian error when Open-Meteo returns non-200 HTTP status', async () => {
    const failingFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchWeatherForecast(50.45, 30.52, failingFetch)).rejects.toThrow(/метеодані|сервер/i);
  });

  it('parses geocoding search results with worldwide language support', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 703448, name: 'Київ', admin1: 'Київ', country: 'Україна', latitude: 50.45, longitude: 30.52 }],
      }),
    });
    const cities = await searchLocations('Київ', mockFetch);
    expect(cities[0]).toMatchObject({ name: 'Київ', lat: 50.45, lon: 30.52 });
  });
});
