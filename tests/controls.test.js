import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LocationControls from '../src/components/LocationControls.vue';
import TimeAltitudeFilters from '../src/components/TimeAltitudeFilters.vue';
import CurrentConditionsCard from '../src/components/CurrentConditionsCard.vue';
import ForecastTable from '../src/components/ForecastTable.vue';

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

  it('renders all 15 AGL altitude tiers inside CurrentConditionsCard in place of static altitude text and emits selected tier', async () => {
    const wrapper = mount(CurrentConditionsCard, {
      props: {
        record: {
          dateStr: '29\\10\\2026',
          hourStr: '15:00',
          precipMm: 0,
          precipProbPct: 0,
          tiers: {
            0: { windSpeedMs: 3.0, windGustMs: 7.0, windDirectionLabel: '→ 86°', tempC: 13.9, cloudCoverPct: 0, humidityPct: 41 },
          },
        },
        selectedAgl: 0,
        timezone: 'Europe/Kyiv',
      },
    });

    expect(wrapper.text()).toContain('Поточний стан на висоті:');
    expect(wrapper.text()).toContain('AGL');
    expect(wrapper.text()).toContain('Вологість');
    expect(wrapper.text()).toContain('41%');
    expect(wrapper.text()).not.toContain('Рельєф');
    expect(wrapper.text()).not.toContain('AMSL');

    const select = wrapper.find('[data-testid="agl-select"]');
    expect(select.exists()).toBe(true);
    const options = select.findAll('option');
    expect(options.map((o) => o.text())).toEqual([
      'Земля',
      '50 м',
      '75 м',
      '100 м',
      '120 м',
      '150 м',
      '200 м',
      '300 м',
      '500 м',
      '1 000 м',
      '1 500 м',
      '2 000 м',
      '3 000 м',
      '4 000 м',
      '5 000 м',
    ]);

    await select.setValue('4000');
    expect(wrapper.emitted('update:selectedAgl')?.[0]).toEqual([4000]);
  });

  it('sizes the altitude selector box dynamically to the selected tier text for both mobile and desktop', async () => {
    const wrapper = mount(CurrentConditionsCard, {
      props: {
        record: {
          dateStr: '29\\10\\2026',
          hourStr: '17:00',
          precipMm: 0,
          precipProbPct: 0,
          tiers: {
            0: { windSpeedMs: 2.8, windGustMs: 5.4, windDirectionLabel: '← 288°', tempC: 9.3, cloudCoverPct: 100, humidityPct: 80 },
            50: { windSpeedMs: 3.4, windGustMs: 6.0, windDirectionLabel: '← 288°', tempC: 9.0, cloudCoverPct: 100, humidityPct: 79 },
            1500: { windSpeedMs: 9.1, windGustMs: 12.2, windDirectionLabel: '← 275°', tempC: 2.1, cloudCoverPct: 90, humidityPct: 70 },
          },
        },
        selectedAgl: 0,
        timezone: 'Europe/Warsaw',
      },
    });

    const sizer = wrapper.find('[data-testid="agl-select-sizer"]');
    expect(sizer.exists()).toBe(true);
    expect(sizer.text()).toBe('Земля');

    const select = wrapper.find('[data-testid="agl-select"]');
    expect(select.classes()).toEqual(
      expect.arrayContaining(['absolute', 'inset-0', 'w-full', 'h-full', 'opacity-0'])
    );

    await wrapper.setProps({ selectedAgl: 50 });
    expect(sizer.text()).toBe('50 м');

    await wrapper.setProps({ selectedAgl: 1500 });
    expect(sizer.text()).toBe('1 500 м');
  });

  it('places the altitude selector row centered between the title line and date/time on mobile while keeping inline desktop classes', () => {
    const wrapper = mount(CurrentConditionsCard, {
      props: {
        record: {
          dateStr: '29\\10\\2026',
          hourStr: '17:00',
          precipMm: 0,
          precipProbPct: 8,
          tiers: {
            75: { windSpeedMs: 4.3, windGustMs: 10, windDirectionLabel: '↑ 16°', tempC: 9, cloudCoverPct: 20, humidityPct: 80 },
          },
        },
        selectedAgl: 75,
        timezone: 'Europe/Kyiv',
      },
    });

    const headerBlock = wrapper.find('[data-testid="current-header-block"]');
    expect(headerBlock.classes()).toEqual(expect.arrayContaining(['w-full', 'lg:w-auto']));

    const heading = wrapper.find('h2');
    expect(heading.classes()).toEqual(expect.arrayContaining(['w-full', 'sm:w-auto', 'flex', 'flex-col', 'sm:flex-row', 'items-center']));

    const selectorRow = wrapper.find('[data-testid="agl-selector-row"]');
    expect(selectorRow.exists()).toBe(true);
    expect(selectorRow.classes()).toEqual(
      expect.arrayContaining(['w-full', 'sm:w-auto', 'flex', 'justify-center', 'sm:justify-start'])
    );
    expect(selectorRow.find('[data-testid="agl-select-box"]').exists()).toBe(true);
    expect(selectorRow.text()).toContain('75 м');
    expect(selectorRow.text()).toContain('AGL');

    const timeRow = wrapper.find('[data-testid="current-time-row"]');
    expect(timeRow.exists()).toBe(true);
    expect(timeRow.classes()).toEqual(expect.arrayContaining(['text-center', 'sm:text-left']));
    expect(timeRow.text()).toContain('29\\10\\2026 17:00');
    expect(timeRow.text()).toContain('Europe/Kyiv');

    // Verify vertical order: title -> selector row -> date/time
    const html = wrapper.html();
    const titleIdx = html.indexOf('Поточний стан на висоті:');
    const selectorIdx = html.indexOf('data-testid="agl-selector-row"');
    const dateIdx = html.indexOf('29\\10\\2026 17:00');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(selectorIdx).toBeGreaterThan(titleIdx);
    expect(dateIdx).toBeGreaterThan(selectorIdx);
  });

  it('duplicates nearest settlement label next to date/time in CurrentConditionsCard instead of raw timezone string', () => {
    const wrapper = mount(CurrentConditionsCard, {
      props: {
        record: {
          dateStr: '29\\10\\2026',
          hourStr: '18:00',
          precipMm: 0,
          precipProbPct: 0,
          tiers: {
            0: { windSpeedMs: 5.0, windGustMs: 10.7, windDirectionLabel: '→ 88°', tempC: 16.3, cloudCoverPct: 100, humidityPct: 44 },
          },
        },
        selectedAgl: 0,
        timezone: 'Europe/Moscow',
        settlement: 'Новопокровська, Краснодарський край, Росія',
      },
    });

    const timeRow = wrapper.find('[data-testid="current-time-row"]');
    expect(timeRow.text()).toContain('29\\10\\2026 18:00');
    expect(timeRow.text()).toContain('Новопокровська, Краснодарський край, Росія');
    expect(timeRow.text()).not.toContain('Europe/Moscow');
  });

  it('opens CalendarDatePicker dropdown on clicking forecast date input in ForecastTable header and emits selected date', async () => {
    const wrapper = mount(ForecastTable, {
      props: {
        hours: [
          {
            timeIso: '2026-10-29T12:00',
            dateStr: '29\\10\\2026',
            hourStr: '12:00',
            precipMm: 0,
            precipProbPct: 10,
            tiers: {
              0: { windSpeedMs: 4.2, windGustMs: 6.5, windDirectionLabel: '↗ 45°', tempC: 13, cloudCoverPct: 60, humidityPct: 72 },
            },
          },
        ],
        selectedAgl: 200,
        selectedDate: '29\\10\\2026',
        activeHourIso: '2026-10-29T12:00',
      },
      attachTo: document.body,
    });

    const dateInput = wrapper.find('[data-testid="forecast-date-input"]');
    expect(dateInput.exists()).toBe(true);
    expect(dateInput.element.value).toBe('29\\10\\2026');
    expect(wrapper.find('[data-testid="calendar-date-picker"]').exists()).toBe(false);

    // Click date input in ForecastTable header
    await dateInput.trigger('click');
    expect(wrapper.find('[data-testid="calendar-date-picker"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('жовтень 2026 р.');

    // Select 30\10\2026
    await wrapper.find('[data-testid="cal-day-2026-10-30"]').trigger('click');
    expect(wrapper.emitted('update:selectedDate')?.[0]).toEqual(['30\\10\\2026']);
    expect(wrapper.find('[data-testid="calendar-date-picker"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('places "Карта" toggle next to WGS 84 / MGRS in LocationControls and emits toggle-map', async () => {
    const wrapper = mount(LocationControls, {
      props: { lat: 50.4501, lon: 30.5234, locationLabel: 'Київ', mapOpen: false },
    });

    const mapBtn = wrapper.find('[data-testid="tab-map"]');
    expect(mapBtn.exists()).toBe(true);
    expect(mapBtn.text()).toContain('Карта');

    await mapBtn.trigger('click');
    expect(wrapper.emitted('toggle-map')).toHaveLength(1);
  });

  it('removes "Часовий відрізок" and altitude selector from TimeAltitudeFilters, keeping only "Поточна погода" and "Профіль вітру"', async () => {
    const wrapper = mount(TimeAltitudeFilters, {
      props: { mode: 'current' },
    });

    expect(wrapper.find('[data-testid="mode-range"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="agl-select"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Часовий відрізок');

    const modeGroup = wrapper.find('[data-testid="mode-group"]');
    expect(modeGroup.exists()).toBe(true);
    const buttons = modeGroup.findAll('button');
    expect(buttons.map((b) => b.text())).toEqual([
      expect.stringContaining('Поточна погода'),
      expect.stringContaining('Профіль вітру'),
    ]);

    await wrapper.find('[data-testid="tab-wind-profile"]').trigger('click');
    expect(wrapper.emitted('update:mode')?.[0]).toEqual(['profile']);
  });

  it('displays settlement name in both input language and destination country language in search dropdown', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn(async (rawUrl) => {
      const u = new URL(rawUrl);
      const lang = u.searchParams.get('language');
      if (u.pathname === '/v1/search' && lang === 'uk') {
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
      if (u.pathname === '/v1/get' && lang === 'pl') {
        return {
          ok: true,
          json: async () => ({
            id: 756135,
            name: 'Warszawa',
            country: 'Polska',
            country_code: 'PL',
          }),
        };
      }
      return { ok: true, json: async () => ({ results: [] }) };
    });

    const wrapper = mount(LocationControls, {
      props: { lat: 50.4501, lon: 30.5234, locationLabel: 'Київ', fetchImpl: mockFetch },
    });

    await wrapper.find('[data-testid="city-search-input"]').setValue('Варшава');
    vi.advanceTimersByTime(350);
    await flushPromises();

    expect(wrapper.text()).toContain('Варшава');
    expect(wrapper.text()).toContain('Warszawa');
    expect(wrapper.text()).toContain('Польща');

    vi.useRealTimers();
  });

  it('closes city search dropdown on Escape or outside click and selects top result on Enter', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 702550,
            name: 'Львів',
            admin1: 'Львівська область',
            country: 'Україна',
            country_code: 'UA',
            population: 717000,
            latitude: 49.8397,
            longitude: 24.0297,
          },
        ],
      }),
    });

    const wrapper = mount(LocationControls, {
      props: { lat: 50.4501, lon: 30.5234, locationLabel: 'Київ', fetchImpl: mockFetch },
      attachTo: document.body,
    });

    const searchInput = wrapper.find('[data-testid="city-search-input"]');
    await searchInput.setValue('Львів');
    vi.advanceTimersByTime(350);
    await flushPromises();

    expect(wrapper.text()).toContain('Львівська область');

    // Escape closes dropdown
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('Львівська область');

    // Re-open on focus, then outside click closes dropdown
    await searchInput.trigger('focus');
    expect(wrapper.text()).toContain('Львівська область');
    document.body.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('Львівська область');

    // Focus and press Enter selects top search result
    await searchInput.trigger('focus');
    await searchInput.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('select-location')?.[0]?.[0]).toMatchObject({
      lat: 49.8397,
      lon: 24.0297,
      fromSearch: true,
    });

    wrapper.unmount();
    vi.useRealTimers();
  });
});
