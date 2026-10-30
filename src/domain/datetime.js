/**
 * Formats a day, month, year object into strict DD\MM\YYYY string.
 */
export function formatDateSlashes({ day, month, year }) {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  const y = String(year).padStart(4, '0');
  return `${d}\\${m}\\${y}`;
}

/**
 * Parses and strictly validates a date string in DD\MM\YYYY or DD/MM/YYYY format.
 * Prevents calendar rollover (e.g. 31\02\2026 or 29\02\2026 in non-leap year).
 */
export function parseDateSlashes(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Дата повинна бути текстовим рядком' };
  }
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2})[\\/](\d{1,2})[\\/](\d{4})$/);
  if (!match) {
    return { ok: false, error: 'Некоректний формат дати. Використовуйте день\\місяць\\рік (наприклад, 29\\10\\2026)' };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12) {
    return { ok: false, error: 'Місяць повинен бути від 1 до 12' };
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return { ok: false, error: `Дата ${trimmed} не існує в календарі` };
  }

  return {
    ok: true,
    day,
    month,
    year,
    normalized: formatDateSlashes({ day, month, year }),
  };
}

/**
 * Validates a start and end date-hour interval.
 * Returns ISO hour boundaries ("YYYY-MM-DDTHH:00") and ensures end >= start.
 */
export function validateTimeRange({ startDate, startHour, endDate, endHour }) {
  const parsedStart = parseDateSlashes(startDate);
  if (!parsedStart.ok) {
    return { ok: false, error: `Помилка дати початку: ${parsedStart.error}` };
  }

  const parsedEnd = parseDateSlashes(endDate);
  if (!parsedEnd.ok) {
    return { ok: false, error: `Помилка дати завершення: ${parsedEnd.error}` };
  }

  const sHour = Number(startHour);
  const eHour = Number(endHour);
  if (!Number.isInteger(sHour) || sHour < 0 || sHour > 23) {
    return { ok: false, error: 'Година початку повинна бути від 0 до 23' };
  }
  if (!Number.isInteger(eHour) || eHour < 0 || eHour > 23) {
    return { ok: false, error: 'Година завершення повинна бути від 0 до 23' };
  }

  const sIso = `${String(parsedStart.year).padStart(4, '0')}-${String(parsedStart.month).padStart(2, '0')}-${String(parsedStart.day).padStart(2, '0')}T${String(sHour).padStart(2, '0')}:00`;
  const eIso = `${String(parsedEnd.year).padStart(4, '0')}-${String(parsedEnd.month).padStart(2, '0')}-${String(parsedEnd.day).padStart(2, '0')}T${String(eHour).padStart(2, '0')}:00`;

  if (eIso < sIso) {
    return { ok: false, error: 'Дата та час завершення не можуть бути ранішими за початок' };
  }

  return {
    ok: true,
    startIsoHour: sIso,
    endIsoHour: eIso,
  };
}

/**
 * Filters an array of hourly records inclusively between startIsoHour and endIsoHour.
 */
export function filterHoursByRange(records, { startIsoHour, endIsoHour }) {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => r.timeIso >= startIsoHour && r.timeIso <= endIsoHour);
}

/**
 * Converts ISO hour string ("2026-10-29T14:00") to user display labels:
 * { dateStr: "29\10\2026", hourStr: "14:00", fullLabel: "29\10\2026 14:00" }
 */
export function isoHourToDisplay(timeIso) {
  if (!timeIso || typeof timeIso !== 'string') {
    return { dateStr: '—', hourStr: '—', fullLabel: '—' };
  }
  const match = timeIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  if (!match) {
    return { dateStr: timeIso, hourStr: '', fullLabel: timeIso };
  }
  const [, y, m, d, hhmm] = match;
  const dateStr = `${d}\\${m}\\${y}`;
  return {
    dateStr,
    hourStr: hhmm,
    fullLabel: `${dateStr} ${hhmm}`,
  };
}

function formatIsoHourInTimeZone(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    const hh = parts.hour === '24' ? '00' : parts.hour;
    if (parts.year && parts.month && parts.day && hh) {
      return `${parts.year}-${parts.month}-${parts.day}T${hh}:00`;
    }
  } catch {
    // Ignore invalid IANA timezone and fall back to browser clock
  }
  return null;
}

/**
 * Finds current hour record in an array of hourly records.
 * Prioritizes explicit nowIsoHour, then target location IANA timezone, then browser local clock.
 */
export function findCurrentHourRecord(records, nowIsoHour, timezone) {
  if (!Array.isArray(records) || records.length === 0) return null;
  if (nowIsoHour) {
    const found = records.find((r) => r.timeIso === nowIsoHour);
    if (found) return found;
  }
  const now = new Date();
  if (timezone) {
    const tzIso = formatIsoHourInTimeZone(now, timezone);
    if (tzIso) {
      const tzMatch = records.find((r) => r.timeIso === tzIso);
      if (tzMatch) return tzMatch;
    }
  }
  // Fallback to record matching current wall clock time in browser timezone
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
  const match = records.find((r) => r.timeIso === currentIso);
  return match || records[0];
}
