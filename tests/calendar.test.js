import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CalendarDatePicker from '../src/components/CalendarDatePicker.vue';

describe('CalendarDatePicker dropdown', () => {
  it('renders Ukrainian month and year header matching October 2026', () => {
    const wrapper = mount(CalendarDatePicker, {
      props: { selectedDate: '29\\10\\2026' },
    });

    expect(wrapper.text()).toContain('жовтень 2026 р.');
    expect(wrapper.text()).toContain('Пн');
    expect(wrapper.text()).toContain('Нд');
  });

  it('navigates months using previous and next buttons', async () => {
    const wrapper = mount(CalendarDatePicker, {
      props: { selectedDate: '29\\10\\2026' },
    });

    await wrapper.find('[data-testid="cal-next-month"]').trigger('click');
    expect(wrapper.text()).toContain('листопад 2026 р.');

    await wrapper.find('[data-testid="cal-prev-month"]').trigger('click');
    expect(wrapper.text()).toContain('жовтень 2026 р.');
  });

  it('highlights the selected day and emits selected date in DD\\MM\\YYYY format', async () => {
    const wrapper = mount(CalendarDatePicker, {
      props: { selectedDate: '29\\10\\2026' },
    });

    const dayBtn = wrapper.find('[data-testid="cal-day-2026-10-29"]');
    expect(dayBtn.exists()).toBe(true);
    expect(dayBtn.classes()).toContain('bg-emerald-600');

    // Click 15th of October
    const day15 = wrapper.find('[data-testid="cal-day-2026-10-15"]');
    await day15.trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual(['15\\10\\2026']);
  });

  it('shifts horizontal position left when popup would overflow viewport right edge', async () => {
    const origInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 560 });

    const origGetBCR = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.getAttribute?.('data-testid') === 'calendar-date-picker') {
        return { left: 376, right: 632, top: 400, bottom: 668, width: 256, height: 268 };
      }
      return origGetBCR.call(this);
    };

    try {
      const wrapper = mount(CalendarDatePicker, {
        props: { selectedDate: '29\\10\\2026' },
        attachTo: document.body,
      });
      await wrapper.vm.$nextTick();

      const styleAttr = wrapper.find('[data-testid="calendar-date-picker"]').attributes('style') || '';
      expect(styleAttr).toContain('left: -80px');
      wrapper.unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origGetBCR;
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: origInnerWidth });
    }
  });
});
