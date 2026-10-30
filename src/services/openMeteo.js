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
        cloudHighPct: h.cloud_cover_high?.[i] ?? null,
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

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Помилка формату даних: некоректна JSON-відповідь метеосервісу');
  }
  return normalizeForecastResponse(json);
}

const COUNTRY_TO_LANG = {
  UA: 'uk', RU: 'ru', BY: 'be', PL: 'pl', DE: 'de', AT: 'de', CH: 'de', LI: 'de', LU: 'fr',
  FR: 'fr', MC: 'fr', IT: 'it', SM: 'it', VA: 'it', ES: 'es', PT: 'pt', BR: 'pt',
  GB: 'en', US: 'en', CA: 'en', AU: 'en', NZ: 'en', IE: 'en', ZA: 'en',
  CZ: 'cs', SK: 'sk', HU: 'hu', RO: 'ro', MD: 'ro', BG: 'bg',
  RS: 'sr', HR: 'hr', SI: 'sl', BA: 'bs', ME: 'sr', MK: 'mk', AL: 'sq',
  LT: 'lt', LV: 'lv', EE: 'et', FI: 'fi', SE: 'sv', NO: 'no', DK: 'da', IS: 'is',
  NL: 'nl', BE: 'nl', GR: 'el', CY: 'el', TR: 'tr', GE: 'ka', AM: 'hy', AZ: 'az',
  KZ: 'kk', UZ: 'uz', KG: 'ky', TJ: 'tg', TM: 'tk', MN: 'mn',
  IL: 'he', IR: 'fa', IQ: 'ar', SA: 'ar', AE: 'ar', EG: 'ar', JO: 'ar', LB: 'ar',
  SY: 'ar', QA: 'ar', KW: 'ar', OM: 'ar', BH: 'ar', YE: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar',
  JP: 'ja', CN: 'zh', TW: 'zh', HK: 'zh', KR: 'ko', KP: 'ko',
  TH: 'th', VN: 'vi', ID: 'id', MY: 'ms', IN: 'hi', PK: 'ur', BD: 'bn',
  MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', UY: 'es', PY: 'es', BO: 'es',
  CR: 'es', PA: 'es', DO: 'es', GT: 'es', HN: 'es', SV: 'es', NI: 'es', CU: 'es',
};

const nativePlaceCache = new Map();

function detectSearchLanguages(q) {
  if (/\p{Script=Cyrillic}/u.test(q)) {
    if (/[іїєґ]/i.test(q)) return ['uk', 'ru'];
    if (/[ыъэё]/i.test(q)) return ['ru', 'uk'];
    if (/ў/i.test(q)) return ['be', 'uk', 'ru'];
    if (/[ђјљњћџ]/i.test(q)) return ['sr', 'uk', 'ru'];
    return ['uk', 'ru', 'bg', 'be', 'sr'];
  }
  if (/\p{Script=Greek}/u.test(q)) return ['el', 'en'];
  if (/\p{Script=Arabic}/u.test(q)) return ['ar', 'fa', 'en'];
  if (/\p{Script=Hebrew}/u.test(q)) return ['he', 'en'];
  if (/\p{Script=Georgian}/u.test(q)) return ['ka', 'en'];
  if (/\p{Script=Armenian}/u.test(q)) return ['hy', 'en'];
  if (/\p{Script=Hangul}/u.test(q)) return ['ko', 'en'];
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(q)) return ['ja', 'en'];
  if (/\p{Script=Han}/u.test(q)) return ['zh', 'ja', 'en'];
  if (/\p{Script=Thai}/u.test(q)) return ['th', 'en'];

  const langs = new Set(['en']);
  if (/[ąćęłńóśźż]/i.test(q)) langs.add('pl');
  if (/[äöüß]/i.test(q)) langs.add('de');
  if (/[čďěňřšťůž]/i.test(q)) {
    langs.add('cs');
    langs.add('sk');
  }
  if (/[ğış]/i.test(q)) langs.add('tr');
  if (/[ăâîșț]/i.test(q)) langs.add('ro');
  if (/[åæø]/i.test(q)) {
    langs.add('sv');
    langs.add('no');
    langs.add('da');
  }
  for (const l of ['de', 'pl', 'fr', 'es', 'it', 'cs']) {
    langs.add(l);
  }
  return [...langs].slice(0, 7);
}

/**
 * Searches worldwide populated places using Open-Meteo Geocoding API.
 * Queries candidate input languages so Cyrillic/local spellings (e.g. "Москва", "Варшава", "Warszawa")
 * are always matched, and enriches each result with the official name in the destination country's language.
 */
export async function searchLocations(query, fetchImpl = fetch) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return [];
  }

  const q = query.trim();
  const qLower = q.toLowerCase();
  const langs = detectSearchLanguages(q);
  const useCache = fetchImpl === fetch;

  const responses = await Promise.all(
    langs.map(async (lang) => {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&format=json&language=${lang}`;
      try {
        const res = await fetchImpl(url);
        if (!res || !res.ok) return { lang, results: [] };
        const json = await res.json();
        return { lang, results: Array.isArray(json?.results) ? json.results : [] };
      } catch {
        return { lang, results: [] };
      }
    })
  );

  // Index all fetched items by (id, lang) so we can reuse already-fetched native names without extra HTTP calls
  const byIdAndLang = new Map();
  const bestById = new Map();

  for (const { lang, results } of responses) {
    for (const item of results) {
      if (item?.id == null) continue;
      byIdAndLang.set(`${item.id}:${lang}`, item);

      const nameLower = String(item.name || '').toLowerCase();
      const matchScore = nameLower === qLower ? 2 : nameLower.startsWith(qLower) ? 1 : 0;
      const existing = bestById.get(item.id);
      if (!existing || matchScore > existing.matchScore) {
        bestById.set(item.id, { item, matchedLang: lang, matchScore });
      }
    }
  }

  if (bestById.size === 0) return [];

  // Sort by query match quality first, then population descending so major cities always appear first
  const sorted = [...bestById.values()].sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return (b.item.population || 0) - (a.item.population || 0);
  });

  // Deduplicate near-identical administrative/city twin records (same name & country within ~8 km)
  const deduped = [];
  for (const entry of sorted) {
    const it = entry.item;
    const isDuplicateTwin = deduped.some(
      (d) =>
        String(d.item.name || '').toLowerCase() === String(it.name || '').toLowerCase() &&
        (d.item.country_code || '') === (it.country_code || '') &&
        Math.abs((d.item.latitude || 0) - (it.latitude || 0)) < 0.08 &&
        Math.abs((d.item.longitude || 0) - (it.longitude || 0)) < 0.08
    );
    if (!isDuplicateTwin) {
      deduped.push(entry);
    }
    if (deduped.length >= 8) break;
  }

  // Enrich each result with the name in the official language of the country where it is located
  const enriched = await Promise.all(
    deduped.map(async ({ item, matchedLang }) => {
      const cc = String(item.country_code || '').toUpperCase();
      const nativeLang = COUNTRY_TO_LANG[cc];
      let nativeName = item.name || '';
      let nativeCountry = item.country || '';

      if (nativeLang && nativeLang !== matchedLang) {
        const alreadyFetched = byIdAndLang.get(`${item.id}:${nativeLang}`);
        if (alreadyFetched) {
          nativeName = alreadyFetched.name || nativeName;
          nativeCountry = alreadyFetched.country || nativeCountry;
        } else {
          const cacheKey = `${item.id}:${nativeLang}`;
          if (useCache && nativePlaceCache.has(cacheKey)) {
            const cached = nativePlaceCache.get(cacheKey);
            nativeName = cached.name || nativeName;
            nativeCountry = cached.country || nativeCountry;
          } else {
            try {
              const gRes = await fetchImpl(
                `https://geocoding-api.open-meteo.com/v1/get?id=${encodeURIComponent(item.id)}&language=${nativeLang}`
              );
              if (gRes && gRes.ok) {
                const gJson = await gRes.json();
                if (gJson?.name) nativeName = gJson.name;
                if (gJson?.country) nativeCountry = gJson.country;
                if (useCache && gJson?.name) {
                  nativePlaceCache.set(cacheKey, { name: nativeName, country: nativeCountry });
                }
              }
            } catch {
              // Keep input-language name on transient network error
            }
          }
        }
      }

      const inputName = item.name || '';
      const hasDistinctNative =
        Boolean(nativeName) && nativeName.toLowerCase() !== inputName.toLowerCase();

      return {
        id: item.id,
        name: inputName,
        nativeName,
        displayName: hasDistinctNative ? `${inputName} (${nativeName})` : inputName,
        admin1: item.admin1 || '',
        country: item.country || '',
        nativeCountry,
        countryCode: cc,
        lat: item.latitude,
        lon: item.longitude,
        elevation: item.elevation ?? null,
      };
    })
  );

  return enriched;
}

const ADMIN_CONTAINER_RE =
  /(?:^|[\s,.\-«"'(])(район|округ|громада|ґміна|область|воєводство|край|рада|сільрада|міськрада|повіт|district|subdistrict|county|province|municipality|borough|arrondissement|prefecture|voivodeship|powiat|gmina|landkreis|kreis|canton|department|département|parish|township|oblast|raion|rayon|hromada)(?:$|[\s,.\-»"')])|район$/iu;

const SETTLEMENT_DESC_START_RE =
  /^(?:невелике\s+|мале\s+|велике\s+|старовинне\s+)?(село|селище|місто|містечко|хутір|присілок|слобода|станиця|аул|кишлак|населений пункт|міське поселення|смт|village|town|city|hamlet|human settlement)(?:$|[\s,.;:()—-])/iu;

const FORMER_SETTLEMENT_RE =
  /^(?:колишн|зникл|неіснуюч|ліквідован|затоплен|виселен|abandoned|former)/iu;

const SETTLEMENT_TITLE_PAREN_RE =
  /\((?:село|селище|місто|містечко|хутір|смт|присілок|слобода)\)\s*$/iu;

function isAdminContainer(label) {
  if (!label) return true;
  return ADMIN_CONTAINER_RE.test(String(label).trim());
}

function approxDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * 111.32;
  const dLon = (lon2 - lon1) * 111.32 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

async function fetchArcgisLocality(lat, lon, region, country, fetchImpl) {
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${encodeURIComponent(`${lon},${lat}`)}&featureTypes=Locality&langCode=uk&f=json`;
  try {
    const res = await fetchImpl(url);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const addr = json?.address;
    if (!addr || typeof addr !== 'object') return null;

    const candidates = [addr.City, addr.PlaceName]
      .map((s) => String(s || '').trim())
      .filter(Boolean);

    const arcRegion = String(addr.Region || '').trim();
    const arcCountry = String(addr.CntryName || '').trim();
    const cmpRegion = (region || arcRegion).toLowerCase();
    const cmpCountry = (country || arcCountry).toLowerCase();

    for (const cand of candidates) {
      if (
        !isAdminContainer(cand) &&
        cand.toLowerCase() !== cmpCountry &&
        cand.toLowerCase() !== cmpRegion
      ) {
        return { name: cand, region: arcRegion, country: arcCountry };
      }
    }
    return { name: '', region: arcRegion, country: arcCountry };
  } catch {
    return null;
  }
}

async function fetchWikiNearestSettlement(lat, lon, fetchImpl) {
  const url = `https://uk.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${encodeURIComponent(`${lat}|${lon}`)}&ggsradius=10000&ggslimit=15&prop=description|coordinates&format=json&origin=*`;
  try {
    const res = await fetchImpl(url);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const pagesObj = json?.query?.pages;
    if (!pagesObj || typeof pagesObj !== 'object') return null;

    const matches = [];
    for (const pg of Object.values(pagesObj)) {
      const rawTitle = String(pg?.title || '').trim();
      if (!rawTitle) continue;
      const desc = String(pg?.description || '').trim();
      if (desc && FORMER_SETTLEMENT_RE.test(desc)) continue;

      const isSettlement =
        (desc && SETTLEMENT_DESC_START_RE.test(desc)) ||
        (!desc && SETTLEMENT_TITLE_PAREN_RE.test(rawTitle));
      if (!isSettlement) continue;

      const cleanName = rawTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (!cleanName || isAdminContainer(cleanName)) continue;

      const coord = Array.isArray(pg?.coordinates) ? pg.coordinates[0] : null;
      const distKm =
        coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lon)
          ? approxDistanceKm(lat, lon, coord.lat, coord.lon)
          : 999;

      matches.push({ name: cleanName, distKm });
    }

    if (matches.length === 0) return null;
    matches.sort((a, b) => a.distKm - b.distKm);
    return matches[0];
  } catch {
    return null;
  }
}

/**
 * Reverse-geocodes coordinates (lat, lon) into the nearest populated settlement name in Ukrainian.
 * Uses BigDataCloud first for cities/towns and administrative hierarchy, and falls back to
 * ArcGIS Locality + Ukrainian Wikipedia GeoSearch for small villages, hamlets, and khutirs.
 */
export async function fetchNearestSettlement(lat, lon, fetchImpl = fetch) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';

  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=uk`;
  let city = '';
  let locality = '';
  let region = '';
  let country = '';
  let settlement = '';

  try {
    const res = await fetchImpl(url);
    if (res && res.ok) {
      const json = await res.json();
      if (json && typeof json === 'object') {
        city = String(json.city || '').trim();
        locality = String(json.locality || '').trim();
        region = String(json.principalSubdivision || '').trim();
        country = String(json.countryName || '').trim();

        if (city && !isAdminContainer(city)) {
          settlement = city;
        } else if (locality && !isAdminContainer(locality)) {
          settlement = locality;
        } else if (Array.isArray(json.localityInfo?.administrative)) {
          const adminSorted = [...json.localityInfo.administrative].sort(
            (a, b) => (b?.order ?? b?.adminLevel ?? 0) - (a?.order ?? a?.adminLevel ?? 0)
          );
          for (const entry of adminSorted) {
            const candidate = String(entry?.name || '').trim();
            if (
              candidate &&
              !isAdminContainer(candidate) &&
              candidate.toLowerCase() !== country.toLowerCase() &&
              candidate.toLowerCase() !== region.toLowerCase()
            ) {
              settlement = candidate;
              break;
            }
          }
        }
      }
    }
  } catch {
    // Proceed to small-settlement fallback providers
  }

  // When BigDataCloud only knows the hromada/rayon (typical for small villages/hamlets),
  // query ArcGIS Locality and Ukrainian Wikipedia GeoSearch in parallel.
  if (!settlement) {
    const [arcgis, wiki] = await Promise.all([
      fetchArcgisLocality(lat, lon, region, country, fetchImpl),
      fetchWikiNearestSettlement(lat, lon, fetchImpl),
    ]);

    if (!region && arcgis?.region) region = arcgis.region;
    if (!country && arcgis?.country) country = arcgis.country;

    if (wiki?.name && wiki.distKm <= 1.5) {
      settlement = wiki.name;
    } else if (arcgis?.name) {
      settlement = arcgis.name;
    } else if (wiki?.name) {
      settlement = wiki.name;
    }
  }

  if (!settlement) {
    settlement = locality || city || region;
  }

  if (!settlement && !country) return '';

  const parts = [];
  if (settlement) parts.push(settlement);
  if (region && region.toLowerCase() !== settlement.toLowerCase()) {
    parts.push(region);
  }
  if (
    country &&
    country.toLowerCase() !== settlement.toLowerCase() &&
    country.toLowerCase() !== region.toLowerCase()
  ) {
    parts.push(country);
  }

  return parts.join(', ');
}
