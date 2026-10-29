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
