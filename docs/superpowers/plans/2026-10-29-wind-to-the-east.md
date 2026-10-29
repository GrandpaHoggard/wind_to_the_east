# Wind to the East Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-install, dark-themed tactical weather monitoring SPA (`Wind to the East`) providing hourly wind speed/gusts (`м/с`), meteorological vane direction (`стрілка + градуси`), temperature (`°C`), cloud cover (`%`), humidity (`%`), and precipitation (`мм` / `%`) from surface up to `5000 м AGL` for any global point via `WGS 84`, `MGRS`, city search, or interactive map.

**Architecture:** Client-side Vue 3 Single Page Application styled with Tailwind CSS v4 and backed by pure, unit-tested ES domain modules (`coordinates`, `windVane`, `datetime`, `atmosphere`) and a stateless Open-Meteo API client (`openMeteo`). All vertical AGL interpolation (`0–5000 м`), aviation wind-shear gust modeling, and `WGS 84 ↔ MGRS` conversions execute directly in the browser, producing a static `dist/` bundle deployable via Nginx or Docker.

**Tech Stack:** Vue 3, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Leaflet (`leaflet` + OpenStreetMap tiles), `mgrs`, Vitest + `@vue/test-utils` + `jsdom`, Nginx / Docker.

**Spec:** `docs/superpowers/specs/2026-10-29-wind-to-the-east-design.md`

## Global Constraints

- **Wind speed & gusts units:** strictly meters per second (`м/с`), Open-Meteo `wind_speed_unit=ms`.
- **Temperature units:** strictly degrees Celsius (`°C`), Open-Meteo `temperature_unit=celsius`.
- **Cloud cover, humidity, precipitation probability units:** percent (`%`).
- **Precipitation amount units:** millimeters (`мм`), Open-Meteo `precipitation_unit=mm`.
- **Wind direction convention:** classical meteorological wind vane ("звідки дме вітер") showing arrow + degrees `0°–359°` (e.g., `↑ 0°` for North wind, `↗ 45°` for North-East wind).
- **Date format:** strictly `ДД\ММ\РРРР` with backslash separator (e.g., `29\10\2026`) paired with hour `00`–`23`.
- **Altitude datum & tiers:** strictly Above Ground Level (`AGL`) across 15 tiers: `0` (`Земля`), `25`, `50`, `75`, `100`, `120`, `150`, `200`, `300`, `500`, `1000`, `1500`, `2000`, `3000`, `5000` meters.
- **Zero-install browser delivery:** static SPA bundle served over HTTP/HTTPS via Nginx or Docker with no client downloads, logins, or paid API keys.
- **Language:** all UI labels, headers, tabs, and validation messages in Ukrainian.

## Review Focus

1. **Subterranean pressure levels over elevated terrain (e.g., `elevation = 1400 м MSL` while `1000 hPa` is at `110 м MSL`):** Any isobaric level with `geopotentialHeightMsl - elevationMeters <= 180` must be excluded before vertical interpolation so underground pressure levels never corrupt low-AGL wind, temperature, or cloud cover. *(Pinned in Task 3)*
2. **North-wrap wind direction interpolation (`350°` to `10°`):** Vertical interpolation and shear calculation across North must follow shortest-arc circular vector math (`350°` and `10°` midpoint = `0°`, angular delta = `20°`), never naive linear averaging (`180°`). *(Pinned in Task 3)*
3. **Flexible vs. invalid `MGRS` and `WGS 84` inputs:** Lowercase/spaced MGRS (`"36u ua 65200 04800"`) and comma/space WGS 84 (`"50.4501, 30.5234"`) must parse cleanly, whereas out-of-range coordinates (`lat > 90`, polar MGRS `lat > 84` or `lat < -80`, malformed strings) must return `{ ok: false, error }` without throwing or setting `[NaN, NaN]`. *(Pinned in Task 1)*
4. **Calendar rollover & inverted `ДД\ММ\РРРР` intervals:** Impossible dates like `"31\\02\\2026"` must be rejected instead of silently rolling over to March, and `end < start` intervals must fail validation with a Ukrainian error message. *(Pinned in Task 2)*
5. **Partial `null` metrics & API/network failures:** `null` values in Open-Meteo hourly arrays must degrade to `"—"` without rendering `NaN`, and failed fetches must show a Ukrainian retry banner while preserving the last loaded forecast. *(Pinned in Task 4 & Task 6)*

---

## File Structure

```text
wind_to_the_east/
├── index.html                          # Entry HTML (lang="uk", Leaflet CSS, root #app)
├── package.json                        # Dependencies & scripts (dev, build, preview, test)
├── vite.config.js                      # Vite + Vue + Tailwind v4 + Vitest (jsdom) config
├── .gitignore                          # Ignores node_modules/, dist/, .tmp/, .env, .superpowers/
├── Dockerfile                          # Multi-stage static SPA build (node:22-alpine -> nginx:1.27-alpine)
├── nginx.conf                          # Gzip + SPA fallback Nginx config
├── DEPLOY.md                           # Step-by-step server deployment guide (Nginx & Docker)
├── src/
│   ├── main.js                         # Mounts App.vue + imports style.css & leaflet/dist/leaflet.css
│   ├── style.css                       # Tailwind v4 entry + dark aviation theme & table styles
│   ├── App.vue                         # Root state, tabs («Прогноз», «Профіль вітру», «Карта»), error banner
│   ├── domain/
│   │   ├── coordinates.js              # WGS 84 <-> MGRS parsing, validation, formatting
│   │   ├── windVane.js                 # Meteorological wind vane arrow & degree formatting
│   │   ├── datetime.js                 # Strict ДД\ММ\РРРР + hour parsing, formatting, interval filtering
│   │   └── atmosphere.js               # 15 AGL tiers, circular interpolation, Wind Shear gust & cloud profile
│   ├── services/
│   │   └── openMeteo.js                # Open-Meteo Forecast (14d + isobaric) & Geocoding client + normalizer
│   └── components/
│       ├── LocationControls.vue        # City search autocomplete + WGS 84 / MGRS mode toggle & input
│       ├── TimeAltitudeFilters.vue     # «Тут і зараз» vs custom ДД\ММ\РРРР + hour interval + AGL tier selector
│       ├── CurrentConditionsCard.vue   # Express current-hour summary card at active AGL tier
│       ├── ForecastTable.vue           # Tab «Прогноз»: hourly table for selected AGL tier & time window
│       ├── WindProfileTable.vue        # Tab «Профіль вітру»: 15-tier vertical table (0–5000 м AGL) for active hour
│       └── WorldMapPicker.vue          # Tab «Карта»: interactive Leaflet map with click/drag marker sync
└── tests/
    ├── coordinates.test.js             # Unit tests for coordinates.js & windVane.js
    ├── datetime.test.js                # Unit tests for datetime.js
    ├── atmosphere.test.js              # Unit tests for atmosphere.js
    ├── openMeteo.test.js               # Unit tests for openMeteo.js
    ├── controls.test.js                # Component tests for LocationControls & TimeAltitudeFilters
    └── dashboard.test.js               # Integration tests for App, ForecastTable, WindProfileTable
```

---

### Task 1: Toolchain Scaffold, Coordinate Engine (`WGS 84 ↔ MGRS`) & Wind Vane

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `vite.config.js`
- Create: `src/domain/coordinates.js`
- Create: `src/domain/windVane.js`
- Test: `tests/coordinates.test.js`

**Interfaces:**
- Consumes: `mgrs` npm package (`forward([lon, lat], accuracy)`, `toPoint(mgrsStr)`).
- Produces:
  - `src/domain/coordinates.js`:
    - `parseWgs84(input: string): { ok: true, lat: number, lon: number } | { ok: false, error: string }`
    - `formatWgs84(lat: number, lon: number, decimals?: number): string`
    - `wgs84ToMgrs(lat: number, lon: number, accuracy?: number): { ok: true, mgrs: string } | { ok: false, error: string }`
    - `parseMgrs(input: string): { ok: true, lat: number, lon: number, mgrs: string } | { ok: false, error: string }`
  - `src/domain/windVane.js`:
    - `normalizeDegrees(deg: number): number`
    - `degreesToVaneArrow(deg: number): string`
    - `formatWindDirection(deg: number | null | undefined): { arrow: string, degrees: number | null, label: string }`

- [ ] **Step 1: Ensure Git & Node.js LTS exist, initialize repository, and install project dependencies**

Check `git --version` and `node --version`. If missing on Windows, install via `winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements` and `winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements` (refreshing `$env:Path`). Initialize `git init` if `.git` is absent, create `.gitignore` (`node_modules/`, `dist/`, `.tmp/`, `.env`, `.superpowers/`), create `package.json` (`"type": "module"`, scripts `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`, `"test": "vitest run"`), create `vite.config.js` with `@vitejs/plugin-vue`, `@tailwindcss/vite`, and `test: { environment: 'jsdom' }`, then install:
`vue`, `leaflet`, `mgrs` and devDependencies `vite`, `@vitejs/plugin-vue`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `@vue/test-utils`, `jsdom`.

- [ ] **Step 2: Write the failing tests in `tests/coordinates.test.js`**

```js
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
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest run tests/coordinates.test.js`
Expected: FAIL with module resolution error for `../src/domain/coordinates.js`.

- [ ] **Step 4: Implement `src/domain/coordinates.js` and `src/domain/windVane.js`**

- In `src/domain/coordinates.js`, validate `-90 <= lat <= 90` and `-180 <= lon <= 180` in `parseWgs84`; validate `-80 <= lat <= 84` before calling `mgrs.forward([lon, lat], accuracy)` and format readable spacing (`"36U UA 24193 90589"`); in `parseMgrs`, strip whitespace, uppercase, wrap `mgrs.toPoint` in `try/catch`, and return Ukrainian error messages on invalid input.
- In `src/domain/windVane.js`, normalize degrees into `0..359` via `((Math.round(deg) % 360) + 360) % 360` and index `['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']` by `Math.round(normalized / 45) % 8`.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run tests/coordinates.test.js`
Expected: PASS (all assertions green).

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json vite.config.js src/domain/coordinates.js src/domain/windVane.js tests/coordinates.test.js
git commit -m "feat: scaffold Vite project and add WGS84/MGRS & wind vane domain modules"
```

---

### Task 2: Strict `ДД\ММ\РРРР` Date-Hour Parser & Time-Window Filter

**Files:**
- Create: `src/domain/datetime.js`
- Test: `tests/datetime.test.js`

**Interfaces:**
- Consumes: none.
- Produces (`src/domain/datetime.js`):
  - `formatDateSlashes(parts: { day: number, month: number, year: number }): string`
  - `parseDateSlashes(input: string): { ok: true, day: number, month: number, year: number, normalized: string } | { ok: false, error: string }`
  - `validateTimeRange(range: { startDate: string, startHour: number, endDate: string, endHour: number }): { ok: true, startIsoHour: string, endIsoHour: string } | { ok: false, error: string }`
  - `filterHoursByRange<T extends { timeIso: string }>(records: T[], range: { startIsoHour: string, endIsoHour: string }): T[]`
  - `isoHourToDisplay(timeIso: string): { dateStr: string, hourStr: string, fullLabel: string }`
  - `findCurrentHourRecord<T extends { timeIso: string }>(records: T[], nowIsoHour?: string): T | null`

- [ ] **Step 1: Write the failing tests in `tests/datetime.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  formatDateSlashes,
  parseDateSlashes,
  validateTimeRange,
  filterHoursByRange,
  isoHourToDisplay,
  findCurrentHourRecord,
} from '../src/domain/datetime.js';

describe('ДД\\ММ\\РРРР date formatting and validation', () => {
  it('formats and parses strict backslash dates', () => {
    expect(formatDateSlashes({ day: 5, month: 11, year: 2026 })).toBe('05\\11\\2026');
    expect(parseDateSlashes('29\\10\\2026')).toEqual({
      ok: true,
      day: 29,
      month: 10,
      year: 2026,
      normalized: '29\\10\\2026',
    });
  });

  it('rejects calendar rollovers such as 31\\02\\2026 and malformed dates', () => {
    expect(parseDateSlashes('31\\02\\2026').ok).toBe(false);
    expect(parseDateSlashes('29\\02\\2026').ok).toBe(false); // 2026 is not leap year
    expect(parseDateSlashes('2026-10-29').ok).toBe(false);
  });

  it('validates single-hour and multi-day intervals and rejects end < start', () => {
    const singleHour = validateTimeRange({
      startDate: '29\\10\\2026',
      startHour: 14,
      endDate: '29\\10\\2026',
      endHour: 14,
    });
    expect(singleHour).toEqual({
      ok: true,
      startIsoHour: '2026-10-29T14:00',
      endIsoHour: '2026-10-29T14:00',
    });

    const inverted = validateTimeRange({
      startDate: '30\\10\\2026',
      startHour: 10,
      endDate: '29\\10\\2026',
      endHour: 18,
    });
    expect(inverted.ok).toBe(false);
  });

  it('filters hourly records inclusively and formats ISO strings to ДД\\ММ\\РРРР HH:00', () => {
    const sample = [
      { timeIso: '2026-10-29T13:00', v: 1 },
      { timeIso: '2026-10-29T14:00', v: 2 },
      { timeIso: '2026-10-29T15:00', v: 3 },
      { timeIso: '2026-10-29T16:00', v: 4 },
    ];
    const filtered = filterHoursByRange(sample, {
      startIsoHour: '2026-10-29T14:00',
      endIsoHour: '2026-10-29T15:00',
    });
    expect(filtered.map((x) => x.v)).toEqual([2, 3]);
    expect(isoHourToDisplay('2026-10-29T09:00')).toEqual({
      dateStr: '29\\10\\2026',
      hourStr: '09:00',
      fullLabel: '29\\10\\2026 09:00',
    });
    expect(findCurrentHourRecord(sample, '2026-10-29T14:00')?.v).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/datetime.test.js`
Expected: FAIL with missing `../src/domain/datetime.js`.

- [ ] **Step 3: Implement `src/domain/datetime.js`**

Match `/^(\d{1,2})[\\/](\d{1,2})[\\/](\d{4})$/` in `parseDateSlashes`, verify `Date.UTC(year, month - 1, day)` produces identical UTC year/month/day without rollover, check `Number.isInteger(hour) && hour >= 0 && hour <= 23` in `validateTimeRange`, and return Ukrainian validation errors when invalid or `endIsoHour < startIsoHour`. In `findCurrentHourRecord`, return exact `timeIso` match or fallback to the closest record (`records[0] ?? null`).

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/datetime.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/datetime.js tests/datetime.test.js
git commit -m "feat: add strict DD\\MM\\YYYY date-hour parser and interval filter"
```

---

### Task 3: AGL Vertical Atmospheric Interpolation & Wind Shear Gust Model (`0–5000 м AGL`)

**Files:**
- Create: `src/domain/atmosphere.js`
- Test: `tests/atmosphere.test.js`

**Interfaces:**
- Consumes: `normalizeDegrees`, `formatWindDirection` from `src/domain/windVane.js`.
- Produces (`src/domain/atmosphere.js`):
  - `AGL_TIERS_METERS: number[]` (`[0, 25, 50, 75, 100, 120, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000]`)
  - `formatAglLabel(aglMeters: number): string`
  - `interpolateCircularDegrees(degA: number, degB: number, t: number): number`
  - `computeAltitudeProfile(rawHour: RawHourInput): Record<number, AltitudeTierMetrics>`
    where `AltitudeTierMetrics` is `{ aglMeters: number, aglLabel: string, windSpeedMs: number | null, windGustMs: number | null, windDirDeg: number | null, windDirectionLabel: string, windArrow: string, tempC: number | null, humidityPct: number | null, cloudCoverPct: number | null }`.

- [ ] **Step 1: Write the failing tests in `tests/atmosphere.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  AGL_TIERS_METERS,
  formatAglLabel,
  interpolateCircularDegrees,
  computeAltitudeProfile,
} from '../src/domain/atmosphere.js';

describe('AGL vertical interpolation and Wind Shear gust model', () => {
  it('exposes all 15 spec AGL tiers from surface (0) to 5000 m', () => {
    expect(AGL_TIERS_METERS).toEqual([
      0, 25, 50, 75, 100, 120, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000,
    ]);
    expect(formatAglLabel(0)).toBe('Земля');
    expect(formatAglLabel(5000)).toBe('5 000 м');
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
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/atmosphere.test.js`
Expected: FAIL with missing `../src/domain/atmosphere.js`.

- [ ] **Step 3: Implement `src/domain/atmosphere.js`**

Use this exact vertical anchor & Aviation Gust Shear algorithm:

```js
// 1. Build sorted AGL anchor knots:
//    - agl = 0 from surface (10m wind/dir, 2m temp/humidity, cloudLowPct ?? cloudCoverPct)
//    - agl = 80, 120, 180 from near-surface model fields when non-null
//    - isobaric levels filtered to (geopotentialHeightMsl - elevationMeters) > maxNearSurfaceAgl
// 2. Interpolate windSpeedMs, tempC, humidityPct, cloudCoverPct linearly and windDirDeg via
//    shortest-arc delta: ((degB - degA + 540) % 360) - 180 for each z in AGL_TIERS_METERS.
// 3. Compute windGustMs at tier index i (height z):
//    - Boundary layer decay: blAdd = Math.max(0, (windGusts10m ?? s0) - s0) * Math.exp(-z / 350)
//      (if blAdd < 0.15, treat as 0 so upper altitudes are unaffected by surface friction).
//    - Vector wind shear between neighboring tiers i-1 and i+1:
//      u = speed * sin(rad), v = speed * cos(rad);
//      shearPer100m = (Math.hypot(uNext - uPrev, vNext - vPrev) / (zNext - zPrev)) * 100;
//      shearAdd = shearPer100m > 0.35 ? Math.min(speed * 0.65, shearPer100m * 1.8) : 0;
//    - At z === 0, use exact windGusts10m (or speed if null); otherwise round to 1 decimal:
//      Math.round(Math.max(speed, speed + blAdd + shearAdd) * 10) / 10.
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/atmosphere.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/atmosphere.js tests/atmosphere.test.js
git commit -m "feat: add 0-5000m AGL atmospheric interpolation and Wind Shear gust model"
```

---

### Task 4: Open-Meteo Forecast & Geocoding API Client

**Files:**
- Create: `src/services/openMeteo.js`
- Test: `tests/openMeteo.test.js`

**Interfaces:**
- Consumes: `computeAltitudeProfile` from `src/domain/atmosphere.js`, `isoHourToDisplay` from `src/domain/datetime.js`.
- Produces (`src/services/openMeteo.js`):
  - `PRESSURE_LEVELS_HPA: number[]` (`[1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400]`)
  - `buildForecastUrl(lat: number, lon: number, forecastDays?: number): string`
  - `normalizeForecastResponse(json: object): { elevationMeters: number, timezone: string, hours: HourlyForecastRecord[] }`
  - `fetchWeatherForecast(lat: number, lon: number, fetchImpl?: typeof fetch): Promise<{ elevationMeters: number, timezone: string, hours: HourlyForecastRecord[] }>`
  - `searchLocations(query: string, fetchImpl?: typeof fetch): Promise<Array<{ id: string | number, name: string, admin1: string, country: string, lat: number, lon: number }>>`

- [ ] **Step 1: Write the failing tests in `tests/openMeteo.test.js`**

```js
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

  it('parses geocoding search results with Ukrainian language parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 703448, name: 'Київ', admin1: 'Київ', country: 'Україна', latitude: 50.45, longitude: 30.52 }],
      }),
    });
    const cities = await searchLocations('Київ', mockFetch);
    expect(mockFetch.mock.calls[0][0]).toContain('language=uk');
    expect(cities[0]).toMatchObject({ name: 'Київ', lat: 50.45, lon: 30.52 });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/openMeteo.test.js`
Expected: FAIL with missing `../src/services/openMeteo.js`.

- [ ] **Step 3: Implement `src/services/openMeteo.js`**

Request `forecast_days=14`, `timezone=auto`, surface + `80m/120m/180m` + all `PRESSURE_LEVELS_HPA` (`wind_speed_{p}hPa`, `wind_direction_{p}hPa`, `temperature_{p}hPa`, `relative_humidity_{p}hPa`, `cloud_cover_{p}hPa`, `geopotential_height_{p}hPa`). Normalize each hourly index into `{ timeIso, dateStr, hourStr, precipMm, precipProbPct, surfaceHumidityPct, surfaceCloudCoverPct, tiers }` via `computeAltitudeProfile`. In `searchLocations`, return `[]` if `query.trim().length < 2`, else query `https://geocoding-api.open-meteo.com/v1/search?name=...&count=8&language=uk&format=json`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/openMeteo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/openMeteo.js tests/openMeteo.test.js
git commit -m "feat: add Open-Meteo 14-day pressure-level forecast and geocoding client"
```

---

### Task 5: Location Controls, Time/Altitude Filters, Summary Card & Leaflet Map Picker

**Files:**
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/components/LocationControls.vue`
- Create: `src/components/TimeAltitudeFilters.vue`
- Create: `src/components/CurrentConditionsCard.vue`
- Create: `src/components/WorldMapPicker.vue`
- Test: `tests/controls.test.js`

**Interfaces:**
- Consumes: `coordinates.js`, `datetime.js`, `atmosphere.js`, `openMeteo.js` (`searchLocations`), `leaflet`.
- Produces:
  - `LocationControls.vue`:
    - Props: `{ lat: number, lon: number, locationLabel: string }`
    - Emits: `select-location({ lat: number, lon: number, label: string })`
  - `TimeAltitudeFilters.vue`:
    - Props: `{ mode: 'current' | 'range', startDate: string, startHour: number, endDate: string, endHour: number, selectedAgl: number, rangeError: string }`
    - Emits: `update:mode`, `update:startDate`, `update:startHour`, `update:endDate`, `update:endHour`, `update:selectedAgl`, `apply-range`
  - `CurrentConditionsCard.vue`:
    - Props: `{ record: HourlyForecastRecord | null, selectedAgl: number, elevationMeters: number, timezone: string }`
  - `WorldMapPicker.vue`:
    - Props: `{ lat: number, lon: number, visible: boolean }`
    - Emits: `pick-coordinates({ lat: number, lon: number })`

- [ ] **Step 1: Write the failing component tests in `tests/controls.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LocationControls from '../src/components/LocationControls.vue';
import TimeAltitudeFilters from '../src/components/TimeAltitudeFilters.vue';

describe('LocationControls & TimeAltitudeFilters', () => {
  it('switches between WGS 84 and MGRS coordinate modes and emits parsed coordinates', async () => {
    const wrapper = mount(LocationControls, {
      props: { lat: 50.4501, lon: 30.5234, locationLabel: 'Київ' },
    });

    await wrapper.find('[data-testid="coord-mode-mgrs"]').trigger('click');
    const input = wrapper.find('[data-testid="coord-input"]');
    expect(input.element.value).toMatch(/^36U/);

    await wrapper.find('[data-testid="coord-mode-wgs84"]').trigger('click');
    await input.setValue('49.8397, 24.0297');
    await wrapper.find('[data-testid="coord-submit"]').trigger('submit');

    expect(wrapper.emitted('select-location')?.[0]?.[0]).toMatchObject({
      lat: 49.8397,
      lon: 24.0297,
    });
  });

  it('displays validation error on invalid MGRS input without emitting select-location', async () => {
    const wrapper = mount(LocationControls, {
      props: { lat: 50.4501, lon: 30.5234, locationLabel: 'Київ' },
    });
    await wrapper.find('[data-testid="coord-mode-mgrs"]').trigger('click');
    await wrapper.find('[data-testid="coord-input"]').setValue('BAD_GRID');
    await wrapper.find('[data-testid="coord-submit"]').trigger('submit');

    expect(wrapper.emitted('select-location')).toBeUndefined();
    expect(wrapper.text()).toMatch(/координат|MGRS/i);
  });

  it('renders all 15 AGL altitude tiers up to 5 000 м and ДД\\ММ\\РРРР range inputs', async () => {
    const wrapper = mount(TimeAltitudeFilters, {
      props: {
        mode: 'range',
        startDate: '29\\10\\2026',
        startHour: 8,
        endDate: '29\\10\\2026',
        endHour: 20,
        selectedAgl: 500,
        rangeError: '',
      },
    });

    const options = wrapper.find('[data-testid="agl-select"]').findAll('option');
    expect(options).toHaveLength(15);
    expect(options[14].text()).toContain('5 000 м');
    expect(wrapper.find('[data-testid="start-date-input"]').element.value).toBe('29\\10\\2026');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/controls.test.js`
Expected: FAIL with missing Vue component files.

- [ ] **Step 3: Implement `index.html`, `src/style.css`, and the 4 UI components**

- `index.html` & `src/style.css`: `@import "tailwindcss";` with dark slate/emerald/red aviation palette (`#0b0f17` canvas, `#111827` panels, crisp tabular numerals `font-variant-numeric: tabular-nums`).
- `LocationControls.vue`: toggle buttons `WGS 84` / `MGRS` (`data-testid="coord-mode-wgs84"`, `data-testid="coord-mode-mgrs"`), coordinate form (`data-testid="coord-submit"` with `data-testid="coord-input"`), plus debounced city search input using `searchLocations`.
- `TimeAltitudeFilters.vue`: mode switch (`Поточна погода` vs `Часовий відрізок`), `ДД\ММ\РРРР` start/end date inputs (`data-testid="start-date-input"`, `data-testid="end-date-input"`), `00:00`–`23:00` hour selects, and `AGL_TIERS_METERS` selector (`data-testid="agl-select"`).
- `CurrentConditionsCard.vue`: compact tactical bar showing current hour's wind speed (`м/с`), gusts (`м/с`), vane arrow + degrees, temp (`°C`), humidity (`%`), cloud cover (`%`), precip (`мм` / `%`), and ground elevation (`м AMSL`).
- `WorldMapPicker.vue`: Leaflet map initialized on mount, calling `map.invalidateSize()` when `props.visible` turns `true`, placing a draggable/clickable marker synced with `lat`/`lon`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/controls.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css src/components/LocationControls.vue src/components/TimeAltitudeFilters.vue src/components/CurrentConditionsCard.vue src/components/WorldMapPicker.vue tests/controls.test.js
git commit -m "feat: add location controls, DD\\MM\\YYYY filters, current card, and Leaflet map"
```

---

### Task 6: Forecast Table, Wind Profile Table, Root Dashboard & Nginx/Docker Deployment

**Files:**
- Create: `src/components/ForecastTable.vue`
- Create: `src/components/WindProfileTable.vue`
- Create: `src/App.vue`
- Create: `src/main.js`
- Create: `Dockerfile`
- Create: `nginx.conf`
- Create: `DEPLOY.md`
- Test: `tests/dashboard.test.js`

**Interfaces:**
- Consumes: all modules and components from Tasks 1–5.
- Produces:
  - `ForecastTable.vue`:
    - Props: `{ hours: HourlyForecastRecord[], selectedAgl: number, activeHourIso: string }`
    - Emits: `select-hour(timeIso: string)` (clicking a row jumps or sets the hour inspected in «Профіль вітру»)
  - `WindProfileTable.vue`:
    - Props: `{ hours: HourlyForecastRecord[], activeHourIso: string, selectedAgl: number }`
    - Emits: `update:activeHourIso(timeIso: string)`
  - `App.vue`: root state coordinator with sidebar/top navigation tabs (`Прогноз`, `Профіль вітру`, `Карта`), header showing active WGS 84 + MGRS strings, default startup point Kyiv (`50.4501, 30.5234`), and error banner preserving last valid forecast on network failure.

- [ ] **Step 1: Write the failing integration tests in `tests/dashboard.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import App from '../src/App.vue';

const sampleApiPayload = {
  elevation: 179,
  timezone: 'Europe/Kyiv',
  hourly: {
    time: ['2026-10-29T12:00', '2026-10-29T13:00'],
    temperature_2m: [13.0, 14.0],
    relative_humidity_2m: [72, 68],
    precipitation_probability: [15, 40],
    precipitation: [0.0, 0.4],
    cloud_cover: [60, 85],
    cloud_cover_low: [25, 50],
    cloud_cover_mid: [70, 80],
    wind_speed_10m: [4.2, 5.8],
    wind_direction_10m: [45, 90],
    wind_gusts_10m: [6.5, 9.1],
    geopotential_height_900hPa: [1000, 1000],
    wind_speed_900hPa: [11.0, 12.5],
    wind_direction_900hPa: [60, 100],
    temperature_900hPa: [6.0, 6.5],
    relative_humidity_900hPa: [75, 78],
    cloud_cover_900hPa: [65, 80],
    geopotential_height_500hPa: [5550, 5550],
    wind_speed_500hPa: [21.4, 23.0],
    wind_direction_500hPa: [270, 275],
    temperature_500hPa: [-21.0, -20.5],
    relative_humidity_500hPa: [50, 55],
    cloud_cover_500hPa: [83, 88],
  },
};

describe('Wind to the East full dashboard', () => {
  it('renders hourly forecast in м/с with vane arrows + degrees and switches to 0-5000m Wind Profile', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleApiPayload,
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();

    // Header displays both WGS 84 and MGRS
    expect(wrapper.text()).toContain('50.4501');
    expect(wrapper.text()).toContain('36U');

    // Forecast table displays m/s, vane arrow + degrees, precip, humidity, clouds
    expect(wrapper.text()).toContain('4.2 м/с');
    expect(wrapper.text()).toContain('6.5 м/с');
    expect(wrapper.text()).toContain('↗ 45°');
    expect(wrapper.text()).toContain('29\\10\\2026');

    // Switch to Wind Profile tab («Профіль вітру») and verify all 15 tiers from Земля to 5 000 м
    await wrapper.find('[data-testid="tab-wind-profile"]').trigger('click');
    const rows = wrapper.findAll('[data-testid="profile-tier-row"]');
    expect(rows).toHaveLength(15);
    expect(rows[0].text()).toContain('5 000 м'); // Top-down like UAV Forecast (5000m at top, Земля at bottom)
    expect(rows[14].text()).toContain('Земля');
    expect(rows[0].text()).toContain('%'); // Cloud cover at 5000m
  });

  it('keeps previous forecast visible and shows Ukrainian retry banner when subsequent fetch fails', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => sampleApiPayload })
      .mockResolvedValueOnce({ ok: false, status: 502 });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();
    expect(wrapper.text()).toContain('4.2 м/с');

    await wrapper.find('[data-testid="coord-input"]').setValue('48.9226, 24.7111');
    await wrapper.find('[data-testid="coord-submit"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('4.2 м/с'); // Previous forecast preserved
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/dashboard.test.js`
Expected: FAIL with missing `../src/App.vue`.

- [ ] **Step 3: Implement `ForecastTable.vue`, `WindProfileTable.vue`, `App.vue`, `main.js`, and deployment files**

- `ForecastTable.vue`: UAV-Forecast-inspired dark table with color-coded subtle cell accents (emerald for calm `< 8 м/с`, amber for `8–14 м/с`, rose for `>= 15 м/с` or high precip), columns: `Дата / Час` (`ДД\ММ\РРРР HH:00`), `Вітер (м/с)`, `Пориви (м/с)`, `Напрямок (флюгер)`, `Температура (°C)`, `Ймовірність опадів (%)`, `Опади (мм)`, `Хмарність (%)`, `Вологість (%)`.
- `WindProfileTable.vue`: ordered top-to-bottom from `5 000 м` down to `Земля` (`data-testid="profile-tier-row"`), hour selector dropdown (`ДД\ММ\РРРР HH:00`), columns: `Висота AGL`, `Вітер (м/с)`, `Пориви (м/с)`, `Напрямок`, `Температура (°C)`, `Хмарність (%)`, highlighting the row matching `selectedAgl`.
- `App.vue`: accepts optional `fetchImpl` prop (defaulting to global `fetch`) for clean testing, manages active coordinates (default Kyiv `50.4501, 30.5234`), active tab (`forecast` | `profile` | `map` with `data-testid="tab-forecast"`, `data-testid="tab-wind-profile"`, `data-testid="tab-map"`), default 24-hour range starting from current hour, and non-destructive `data-testid="error-banner"` with retry button.
- `Dockerfile` (`FROM node:22-alpine AS build` -> `npm ci && npm run build` -> `FROM nginx:1.27-alpine` copying `dist/` and `nginx.conf`), `nginx.conf` (port `80`, `try_files $uri $uri/ /index.html;`, `gzip on;`), and `DEPLOY.md` (concise Ukrainian 3-command instructions for both plain Nginx VPS and Docker).

- [ ] **Step 4: Run full test suite and production build to verify everything passes**

Run: `npm test && npm run build`
Expected: PASS (all 6 test files green) and `dist/index.html` + hashed assets emitted cleanly with exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ForecastTable.vue src/components/WindProfileTable.vue src/App.vue src/main.js Dockerfile nginx.conf DEPLOY.md tests/dashboard.test.js
git commit -m "feat: complete Wind to the East dashboard, wind profile table, and Nginx/Docker config"
```
