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
