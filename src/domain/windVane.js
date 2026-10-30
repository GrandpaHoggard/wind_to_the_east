function isValidDegreeInput(deg) {
  if (deg == null || typeof deg === 'boolean') return false;
  if (typeof deg === 'string' && deg.trim() === '') return false;
  return Number.isFinite(Number(deg));
}

/**
 * Normalizes degrees to integer in [0, 359].
 */
export function normalizeDegrees(deg) {
  if (!isValidDegreeInput(deg)) {
    return 0;
  }
  const rounded = Math.round(Number(deg));
  return ((rounded % 360) + 360) % 360;
}

const VANE_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

/**
 * Maps meteorological origin direction (0°-359°) to vane arrow character.
 * 0° = North = ↑ (wind blowing from North)
 * 45° = North-East = ↗
 * 90° = East = →
 * 180° = South = ↓
 * 270° = West = ←
 */
export function degreesToVaneArrow(deg) {
  if (!isValidDegreeInput(deg)) {
    return '—';
  }
  const normalized = normalizeDegrees(deg);
  const octant = Math.round(normalized / 45) % 8;
  return VANE_ARROWS[octant];
}

/**
 * Formats wind direction to object with arrow, degrees, and full string label.
 * Example: 45 -> { arrow: '↗', degrees: 45, label: '↗ 45°' }
 */
export function formatWindDirection(deg) {
  if (!isValidDegreeInput(deg)) {
    return { arrow: '—', degrees: null, label: '—' };
  }
  const degrees = normalizeDegrees(deg);
  const arrow = degreesToVaneArrow(degrees);
  return {
    arrow,
    degrees,
    label: `${arrow} ${degrees}°`,
  };
}
