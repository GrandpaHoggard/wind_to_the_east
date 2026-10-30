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

    // Header displays WGS 84 and MGRS without "0–5000м AGL" badge
    expect(wrapper.find('header').text()).not.toContain('0–5000м AGL');
    expect(wrapper.text()).toContain('50.4501');
    expect(wrapper.text()).toContain('36U');

    // Forecast table displays m/s, vane arrow + degrees, precip, humidity, clouds
    expect(wrapper.text()).toContain('4.2 м/с');
    expect(wrapper.text()).toContain('6.5 м/с');
    expect(wrapper.text()).toContain('↗ 45°');
    expect(wrapper.text()).toContain('29\\10\\2026');

    // Switch to Wind Profile tab («Профіль вітру») and verify all 15 tiers from Земля to 5 000 м (with 4 000 м, without 25 м)
    await wrapper.find('[data-testid="tab-wind-profile"]').trigger('click');
    const rows = wrapper.findAll('[data-testid="profile-tier-row"]');
    expect(rows).toHaveLength(15);
    expect(rows[0].text()).toContain('5 000 м'); // Top-down like UAV Forecast (5000m at top, Земля at bottom)
    expect(rows[1].text()).toContain('4 000 м');
    expect(rows[13].text()).toContain('50 м');
    expect(rows[14].text()).toContain('Земля');
    expect(rows[0].text()).toContain('%'); // Cloud cover at 5000m
  });

  it('keeps previous forecast visible and shows Ukrainian retry banner when subsequent fetch fails, while updating nearest settlement in header', async () => {
    let forecastCallCount = 0;
    const mockFetch = vi.fn(async (rawUrl) => {
      const urlStr = String(rawUrl);
      if (urlStr.includes('reverse-geocode-client')) {
        if (urlStr.includes('48.9226')) {
          return {
            ok: true,
            json: async () => ({
              city: 'Івано-Франківськ',
              principalSubdivision: 'Івано-Франківська область',
              countryName: 'Україна',
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            city: 'Київ',
            principalSubdivision: 'Київ',
            countryName: 'Україна',
          }),
        };
      }
      forecastCallCount += 1;
      if (forecastCallCount === 1) {
        return { ok: true, json: async () => sampleApiPayload };
      }
      return { ok: false, status: 502 };
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();
    expect(wrapper.text()).toContain('4.2 м/с');
    expect(wrapper.find('[data-testid="nearest-settlement"]').text()).toContain('Київ, Україна');
    expect(wrapper.find('[data-testid="current-card-settlement"]').text()).toContain('Київ, Україна');

    await wrapper.find('[data-testid="coord-input"]').setValue('48.9226, 24.7111');
    await wrapper.find('[data-testid="coord-submit"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="nearest-settlement"]').text()).toContain(
      'Івано-Франківськ, Івано-Франківська область, Україна'
    );
    expect(wrapper.find('[data-testid="current-card-settlement"]').text()).toContain(
      'Івано-Франківськ, Івано-Франківська область, Україна'
    );
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('4.2 м/с'); // Previous forecast preserved
  });

  it('synchronizes activeHourIso to current wall-clock hour, shows only 1 day in ForecastTable, and decouples CurrentConditionsCard from row selection', async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const currentHH = now.getHours();
    const otherHH = currentHH === 0 ? 1 : 0;

    const currentIso = `${yyyy}-${mm}-${dd}T${String(currentHH).padStart(2, '0')}:00`;
    const otherTodayIso = `${yyyy}-${mm}-${dd}T${String(otherHH).padStart(2, '0')}:00`;
    const pastIso = '2020-01-01T00:00';

    const multiHourPayload = {
      elevation: 100,
      timezone: 'Europe/Kyiv',
      hourly: {
        time: [pastIso, otherTodayIso, currentIso],
        temperature_2m: [-15.0, 5.0, 18.5],
        relative_humidity_2m: [90, 80, 45],
        precipitation_probability: [0, 10, 0],
        precipitation: [0, 0, 0],
        cloud_cover: [100, 50, 15],
        cloud_cover_low: [100, 40, 10],
        cloud_cover_mid: [80, 20, 5],
        wind_speed_10m: [12.0, 6.0, 3.5],
        wind_direction_10m: [0, 90, 180],
        wind_gusts_10m: [15.0, 8.0, 5.0],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => multiHourPayload,
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();

    const currentCard = wrapper.findComponent({ name: 'CurrentConditionsCard' });
    expect(currentCard.exists()).toBe(true);
    // Current card should show current hour temperature (18.5°C), NOT past day (-15°C) or other hour (5°C)
    expect(currentCard.text()).toContain('18.5°C');

    // ForecastTable must display ONLY the 2 hours belonging to today's single day (excluding 2020-01-01)
    const rows = wrapper.findAll('[data-testid="forecast-row"]');
    expect(rows).toHaveLength(2);
    expect(wrapper.find('[data-testid="forecast-section"]').text()).not.toContain('01\\01\\2020');

    // Clicking the other hour row in the table must NOT hijack CurrentConditionsCard
    await rows[0].trigger('click');
    await flushPromises();

    // Current conditions card must still retain current conditions (18.5°C)
    expect(currentCard.text()).toContain('18.5°C');
  });

  it('places altitude selector in CurrentConditionsCard, removes "Часовий відрізок", and switches single-day ForecastTable via header date picker', async () => {
    const twoDayPayload = {
      elevation: 179,
      timezone: 'Europe/Kyiv',
      hourly: {
        time: ['2026-10-29T12:00', '2026-10-29T13:00', '2026-10-30T08:00', '2026-10-30T09:00'],
        temperature_2m: [13.0, 14.0, 7.5, 8.2],
        relative_humidity_2m: [72, 68, 85, 82],
        precipitation_probability: [15, 40, 60, 50],
        precipitation: [0.0, 0.4, 1.2, 0.8],
        cloud_cover: [60, 85, 95, 90],
        cloud_cover_low: [25, 50, 80, 75],
        cloud_cover_mid: [70, 80, 60, 55],
        wind_speed_10m: [4.2, 5.8, 9.1, 8.7],
        wind_direction_10m: [45, 90, 270, 280],
        wind_gusts_10m: [6.5, 9.1, 14.2, 13.5],
        geopotential_height_500hPa: [5179, 5179, 5179, 5179],
        wind_speed_500hPa: [21.4, 23.0, 26.5, 27.1],
        wind_direction_500hPa: [270, 275, 285, 290],
        temperature_500hPa: [-21.0, -20.5, -22.0, -21.8],
        relative_humidity_500hPa: [50, 55, 65, 60],
        cloud_cover_500hPa: [83, 88, 92, 90],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => twoDayPayload,
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch }, attachTo: document.body });
    await flushPromises();

    // 1. "Часовий відрізок" is completely gone
    expect(wrapper.find('[data-testid="mode-range"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Часовий відрізок');

    // 2. Altitude selector is inside CurrentConditionsCard (NOT TimeAltitudeFilters)
    const filters = wrapper.findComponent({ name: 'TimeAltitudeFilters' });
    const currentCard = wrapper.findComponent({ name: 'CurrentConditionsCard' });
    expect(filters.find('[data-testid="agl-select"]').exists()).toBe(false);
    const aglSelect = currentCard.find('[data-testid="agl-select"]');
    expect(aglSelect.exists()).toBe(true);

    // Changing altitude in CurrentConditionsCard updates both CurrentConditionsCard and ForecastTable
    await aglSelect.setValue('5000');
    expect(wrapper.find('[data-testid="forecast-section"]').text()).toContain('5 000 м AGL');
    expect(wrapper.find('[data-testid="forecast-section"]').text()).toContain('21.4 м/с');

    // 3. Initially shows only 1 day (29\10\2026 -> 2 rows, NOT 30\10\2026)
    let rows = wrapper.findAll('[data-testid="forecast-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('29\\10\\2026');
    expect(wrapper.find('[data-testid="forecast-section"]').text()).not.toContain('30\\10\\2026');

    // Open calendar date picker in ForecastTable header and pick 30\10\2026
    const forecastDateInput = wrapper.find('[data-testid="forecast-date-input"]');
    expect(forecastDateInput.exists()).toBe(true);
    await forecastDateInput.trigger('click');
    expect(wrapper.find('[data-testid="calendar-date-picker"]').exists()).toBe(true);

    await wrapper.find('[data-testid="cal-day-2026-10-30"]').trigger('click');
    await flushPromises();

    rows = wrapper.findAll('[data-testid="forecast-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('30\\10\\2026');
    expect(rows[0].text()).toContain('26.5 м/с');
    expect(wrapper.find('[data-testid="forecast-section"]').text()).not.toContain('29\\10\\2026');

    wrapper.unmount();
  });

  it('relocates "Карта" to LocationControls (toggling map inline) and "Профіль вітру" to TimeAltitudeFilters without header nav', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleApiPayload,
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();

    // Header should not contain old navigation tabs
    expect(wrapper.find('header nav').exists()).toBe(false);

    // "Карта" lives inside LocationControls and toggles WorldMapPicker inline while preserving ForecastTable
    const locControls = wrapper.findComponent({ name: 'LocationControls' });
    const mapBtn = locControls.find('[data-testid="tab-map"]');
    expect(mapBtn.exists()).toBe(true);

    const mapWrapper = wrapper.find('[data-testid="map-panel-wrapper"]');
    expect(mapWrapper.attributes('style')).toContain('display: none');

    await mapBtn.trigger('click');
    expect(mapWrapper.attributes('style') || '').not.toContain('display: none');
    // Forecast table remains visible underneath expanded map
    expect(wrapper.find('[data-testid="forecast-section"]').attributes('style') || '').not.toContain('display: none');

    // "Профіль вітру" lives inside TimeAltitudeFilters and switches forecast <-> profile
    const filters = wrapper.findComponent({ name: 'TimeAltitudeFilters' });
    const profileBtn = filters.find('[data-testid="tab-wind-profile"]');
    expect(profileBtn.exists()).toBe(true);

    await profileBtn.trigger('click');
    expect(wrapper.find('[data-testid="forecast-section"]').attributes('style')).toContain('display: none');
    expect(wrapper.find('[data-testid="profile-section"]').attributes('style') || '').not.toContain('display: none');

    // Clicking "Поточна погода" returns to ForecastTable
    await filters.find('[data-testid="mode-current"]').trigger('click');
    expect(wrapper.find('[data-testid="forecast-section"]').attributes('style') || '').not.toContain('display: none');
    expect(wrapper.find('[data-testid="profile-section"]').attributes('style')).toContain('display: none');
  });

  it('keeps sticky header stacking priority above Leaflet map panes when map is open and page scrolls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleApiPayload,
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();

    // Open interactive map
    await wrapper.find('[data-testid="tab-map"]').trigger('click');

    // Sticky header must sit above Leaflet's z-index 400..1000 controls
    const headerClasses = wrapper.find('header').classes();
    expect(headerClasses).toContain('sticky');
    expect(headerClasses).toContain('top-0');
    expect(headerClasses).toContain('z-[1100]');

    // Leaflet map container must isolate its internal pane stacking context
    const mapContainerClasses = wrapper.find('[data-testid="leaflet-map-container"]').classes();
    expect(mapContainerClasses).toContain('isolate');
    expect(mapContainerClasses).toContain('z-0');
  });

  it('clears stale settlement when moving to uninhabited ocean coordinates, resets dangling activeHourIso across dates, and ignores stale out-of-order forecast responses', async () => {
    let resolveSlowForecast;
    let callIdx = 0;

    const mockFetch = vi.fn((rawUrl) => {
      const urlStr = String(rawUrl);
      if (urlStr.includes('reverse-geocode-client')) {
        if (urlStr.includes('latitude=0')) {
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ city: 'Київ', principalSubdivision: 'Київ', countryName: 'Україна' }),
        });
      }
      if (urlStr.includes('arcgis.com') || urlStr.includes('wikipedia.org')) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      callIdx += 1;
      if (callIdx === 1) {
        return Promise.resolve({ ok: true, json: async () => sampleApiPayload });
      }
      if (callIdx === 2) {
        // Slow request for intermediate point
        return new Promise((resolve) => {
          resolveSlowForecast = resolve;
        });
      }
      // Fast 3rd request for Tokyo on next date (2026-10-30) where 2026-10-29T12:00 does NOT exist
      return Promise.resolve({
        ok: true,
        json: async () => ({
          elevation: 40,
          timezone: 'Etc/GMT',
          hourly: {
            time: ['2026-10-30T00:00', '2026-10-30T01:00'],
            temperature_2m: [22.0, 21.5],
            relative_humidity_2m: [80, 82],
            precipitation_probability: [0, 0],
            precipitation: [0, 0],
            cloud_cover: [10, 15],
            wind_speed_10m: [7.5, 8.0],
            wind_direction_10m: [180, 185],
            wind_gusts_10m: [9.0, 9.5],
          },
        }),
      });
    });

    const wrapper = mount(App, { props: { fetchImpl: mockFetch } });
    await flushPromises();
    expect(wrapper.find('[data-testid="nearest-settlement"]').exists()).toBe(true);

    // Trigger 2nd (slow) location request
    await wrapper.find('[data-testid="coord-input"]').setValue('10.0000, 10.0000');
    await wrapper.find('[data-testid="coord-submit"]').trigger('submit');

    // Immediately trigger 3rd (fast) ocean location request (0, 0)
    await wrapper.find('[data-testid="coord-input"]').setValue('0.0000, 0.0000');
    await wrapper.find('[data-testid="coord-submit"]').trigger('submit');
    await flushPromises();

    // Stale "Київ, Україна" must NOT be shown at (0, 0) in Atlantic Ocean!
    expect(wrapper.find('[data-testid="nearest-settlement"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('7.5 м/с');

    // Now resolve the slow 2nd request with bogus 99.9 m/s wind — must be ignored!
    resolveSlowForecast({
      ok: true,
      json: async () => ({
        ...sampleApiPayload,
        hourly: { ...sampleApiPayload.hourly, wind_speed_10m: [99.9, 99.9] },
      }),
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('99.9 м/с');

    // Switch to Wind Profile and verify the hour <select> value matches an existing option (not blank!)
    await wrapper.find('[data-testid="tab-wind-profile"]').trigger('click');
    const hourSelect = wrapper.find('[data-testid="profile-section"] select');
    expect(['2026-10-30T00:00', '2026-10-30T01:00']).toContain(hourSelect.element.value);
  });

  it('shows empty state message in WindProfileTable when no forecast data is loaded', async () => {
    const failingFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const wrapper = mount(App, { props: { fetchImpl: failingFetch } });
    await flushPromises();

    await wrapper.find('[data-testid="tab-wind-profile"]').trigger('click');
    expect(wrapper.find('[data-testid="profile-empty-row"]').exists()).toBe(true);
  });
});
