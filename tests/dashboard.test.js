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
