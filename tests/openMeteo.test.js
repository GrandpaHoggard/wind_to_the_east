import { describe, it, expect, vi } from 'vitest';
import {
  buildForecastUrl,
  normalizeForecastResponse,
  fetchWeatherForecast,
  searchLocations,
  fetchNearestSettlement,
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
        results: [{ id: 703448, name: 'Київ', admin1: 'Київ', country: 'Україна', country_code: 'UA', latitude: 50.45, longitude: 30.52 }],
      }),
    });
    const cities = await searchLocations('Київ', mockFetch);
    expect(cities[0]).toMatchObject({ name: 'Київ', lat: 50.45, lon: 30.52 });
  });

  it('searches Cyrillic queries like "Москва" and "Варшава" with explicit language params and enriches native destination language name', async () => {
    const mockFetch = vi.fn(async (rawUrl) => {
      const u = new URL(rawUrl);
      const lang = u.searchParams.get('language');
      // Reproduce real Open-Meteo behavior: missing language (defaults to en) returns empty for Cyrillic!
      if (u.pathname === '/v1/search') {
        const name = u.searchParams.get('name');
        if (!lang || lang === 'en') {
          if (name === 'Moscow') {
            return {
              ok: true,
              json: async () => ({
                results: [
                  { id: 524901, name: 'Moscow', admin1: 'Moscow', country: 'Russia', country_code: 'RU', population: 10381222, latitude: 55.7522, longitude: 37.6156 },
                ],
              }),
            };
          }
          return { ok: true, json: async () => ({ results: [] }) };
        }
        if (name === 'Москва' && (lang === 'uk' || lang === 'ru')) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  id: 524901,
                  name: 'Москва',
                  admin1: 'Москва',
                  country: lang === 'uk' ? 'Росія' : 'Россия',
                  country_code: 'RU',
                  population: 10381222,
                  latitude: 55.7522,
                  longitude: 37.6156,
                },
              ],
            }),
          };
        }
        if (name === 'Варшава' && lang === 'uk') {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  id: 756135,
                  name: 'Варшава',
                  admin1: 'Мазовецьке воєводство',
                  country: 'Польща',
                  country_code: 'PL',
                  population: 1790658,
                  latitude: 52.2298,
                  longitude: 21.0118,
                },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ results: [] }) };
      }

      if (u.pathname === '/v1/get') {
        const id = Number(u.searchParams.get('id'));
        if (id === 756135 && lang === 'pl') {
          return {
            ok: true,
            json: async () => ({
              id: 756135,
              name: 'Warszawa',
              admin1: 'Województwo mazowieckie',
              country: 'Polska',
              country_code: 'PL',
            }),
          };
        }
        if (id === 524901 && lang === 'ru') {
          return {
            ok: true,
            json: async () => ({
              id: 524901,
              name: 'Москва',
              admin1: 'Москва',
              country: 'Россия',
              country_code: 'RU',
            }),
          };
        }
      }

      return { ok: false, status: 404 };
    });

    // 1. "Москва" must be found (previously returned [] because language was omitted!)
    const moscowCyr = await searchLocations('Москва', mockFetch);
    expect(moscowCyr).toHaveLength(1);
    expect(moscowCyr[0]).toMatchObject({
      id: 524901,
      name: 'Москва',
      nativeName: 'Москва',
      country: 'Росія',
      nativeCountry: 'Россия',
      lat: 55.7522,
      lon: 37.6156,
    });

    // 2. "Варшава" (typed in Ukrainian) returns both "Варшава" and native Polish "Warszawa"
    const warsawUk = await searchLocations('Варшава', mockFetch);
    expect(warsawUk).toHaveLength(1);
    expect(warsawUk[0]).toMatchObject({
      id: 756135,
      name: 'Варшава',
      nativeName: 'Warszawa',
      displayName: 'Варшава (Warszawa)',
    });

    // 3. "Moscow" (typed in English) returns both "Moscow" and native Russian "Москва"
    const moscowEn = await searchLocations('Moscow', mockFetch);
    expect(moscowEn[0]).toMatchObject({
      id: 524901,
      name: 'Moscow',
      nativeName: 'Москва',
      displayName: 'Moscow (Москва)',
    });
  });

  it('reverse-geocodes coordinates into nearest settlement name in Ukrainian, prioritizing settlement over rayon', async () => {
    const mockFetch = vi.fn(async (rawUrl) => {
      const u = new URL(rawUrl);
      expect(u.origin + u.pathname).toBe('https://api.bigdatacloud.net/data/reverse-geocode-client');
      expect(u.searchParams.get('localityLanguage')).toBe('uk');
      const lat = Number(u.searchParams.get('latitude'));
      if (Math.abs(lat - 55.752) < 0.01) {
        return {
          ok: true,
          json: async () => ({
            city: 'Москва',
            locality: 'Тверський район Москви',
            principalSubdivision: 'Москва',
            countryName: 'Росія',
          }),
        };
      }
      if (Math.abs(lat - 50.9065) < 0.01) {
        // Real BigDataCloud payload for Sumy (50.90650, 34.79507)
        return {
          ok: true,
          json: async () => ({
            city: 'Сумський район',
            locality: 'Суми',
            principalSubdivision: 'Сумська область',
            countryName: 'Україна',
          }),
        };
      }
      if (Math.abs(lat - 50.941) < 0.01) {
        // Real BigDataCloud payload for Stepanivka near Sumy
        return {
          ok: true,
          json: async () => ({
            city: 'Сумський район',
            locality: 'Степанівка',
            principalSubdivision: 'Сумська область',
            countryName: 'Україна',
          }),
        };
      }
      if (Math.abs(lat - 50.88) < 0.01) {
        // Edge case where both city and locality are admin containers, but localityInfo has settlement
        return {
          ok: true,
          json: async () => ({
            city: 'Сумський район',
            locality: 'Сумська міська громада',
            principalSubdivision: 'Сумська область',
            countryName: 'Україна',
            localityInfo: {
              administrative: [
                { name: 'Україна', order: 2, adminLevel: 2 },
                { name: 'Сумська область', order: 4, adminLevel: 4 },
                { name: 'Сумський район', order: 6, adminLevel: 6 },
                { name: 'Сумська міська громада', order: 7, adminLevel: 7 },
                { name: 'Суми', order: 8, adminLevel: 8 },
              ],
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          city: 'Бровари',
          locality: 'Бровари',
          principalSubdivision: 'Київська область',
          countryName: 'Україна',
        }),
      };
    });

    await expect(fetchNearestSettlement(55.752, 37.6178, mockFetch)).resolves.toBe('Москва, Росія');
    await expect(fetchNearestSettlement(50.9065, 34.79507, mockFetch)).resolves.toBe(
      'Суми, Сумська область, Україна'
    );
    await expect(fetchNearestSettlement(50.941, 34.622, mockFetch)).resolves.toBe(
      'Степанівка, Сумська область, Україна'
    );
    await expect(fetchNearestSettlement(50.88, 34.8, mockFetch)).resolves.toBe(
      'Суми, Сумська область, Україна'
    );
    await expect(fetchNearestSettlement(50.511, 30.79, mockFetch)).resolves.toBe(
      'Бровари, Київська область, Україна'
    );
  });

  it('resolves small villages like "Бірочок Другий" and "Глибока Долина" when BigDataCloud only returns hromada/rayon', async () => {
    const mockFetch = vi.fn(async (rawUrl) => {
      const u = new URL(rawUrl);

      // 1. BigDataCloud only knows Chuhuiv Raion + Zmiivska Hromada for both small villages
      if (u.hostname === 'api.bigdatacloud.net') {
        return {
          ok: true,
          json: async () => ({
            city: 'Чугуївський район',
            locality: 'Зміївська міська громада',
            principalSubdivision: 'Харківська область',
            countryName: 'Україна',
            localityInfo: {
              administrative: [
                { name: 'Україна', order: 2, adminLevel: 2 },
                { name: 'Харківська область', order: 5, adminLevel: 4 },
                { name: 'Чугуївський район', order: 6, adminLevel: 6 },
                { name: 'Зміївська міська громада', order: 8, adminLevel: 7 },
              ],
            },
          }),
        };
      }

      // 2. ArcGIS Locality reverseGeocode knows "Бірочок Другий" at 49.70533, 36.12562,
      //    but only returns "Зміївська міська громада" at 49.7178, 36.1206
      if (u.hostname === 'geocode.arcgis.com') {
        const loc = u.searchParams.get('location') || '';
        if (loc.includes('49.70533')) {
          return {
            ok: true,
            json: async () => ({
              address: {
                City: 'Бірочок Другий',
                PlaceName: 'Бірочок Другий',
                Region: 'Харківська область',
                CntryName: 'Україна',
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            address: {
              City: 'Зміївська міська громада',
              PlaceName: 'Зміївська міська громада',
              Region: 'Харківська область',
              CntryName: 'Україна',
            },
          }),
        };
      }

      // 3. Ukrainian Wikipedia GeoSearch knows every small village/hamlet with coordinates & descriptions
      if (u.hostname === 'uk.wikipedia.org') {
        const coordParam = u.searchParams.get('ggscoord') || '';
        if (coordParam.includes('49.7178')) {
          return {
            ok: true,
            json: async () => ({
              query: {
                pages: {
                  1: {
                    title: 'Храм Христа Спасителя (Бірки)',
                    description: 'колишній храм і каплиця у Бірках',
                    coordinates: [{ lat: 49.7178, lon: 36.1206 }],
                  },
                  2: {
                    title: 'Старе Селище',
                    description: 'колишнє село в Україні',
                    coordinates: [{ lat: 49.7179, lon: 36.1207 }],
                  },
                  3: {
                    title: 'Глибока Долина (Чугуївський район)',
                    description: 'село в Харківській області, Україна',
                    coordinates: [{ lat: 49.71778, lon: 36.12056 }],
                  },
                },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ query: { pages: {} } }) };
      }

      return { ok: false, status: 404 };
    });

    await expect(fetchNearestSettlement(49.70533, 36.12562, mockFetch)).resolves.toBe(
      'Бірочок Другий, Харківська область, Україна'
    );
    await expect(fetchNearestSettlement(49.7178, 36.1206, mockFetch)).resolves.toBe(
      'Глибока Долина, Харківська область, Україна'
    );
  });

  it('avoids duplicate country when region equals country and throws clean Ukrainian error on non-JSON forecast payload', async () => {
    const monacoFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        city: 'Монако-Вілль',
        principalSubdivision: 'Монако',
        countryName: 'Монако',
      }),
    });
    await expect(fetchNearestSettlement(43.73, 7.42, monacoFetch)).resolves.toBe('Монако-Вілль, Монако');

    const htmlFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });
    await expect(fetchWeatherForecast(50.45, 30.52, htmlFetch)).rejects.toThrow(/відповідь|JSON|метеосервіс/i);
  });
});
