<template>
  <div
    ref="pickerRef"
    data-testid="calendar-date-picker"
    class="absolute top-full mt-1.5 z-50 bg-[#0f172a] border border-slate-700/90 rounded-xl p-3 shadow-2xl w-64 text-slate-100 select-none"
    :class="offsetX === 0 ? (align === 'right' ? 'right-0' : 'left-0') : ''"
    :style="offsetX !== 0 ? { left: `${offsetX}px` } : undefined"
    @click.stop
  >
    <!-- Header: Month and Year in Ukrainian + Navigation Buttons -->
    <div class="flex items-center justify-between mb-2.5 px-1">
      <span class="text-xs font-semibold text-slate-100 tracking-wide">
        {{ monthTitle }}
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          data-testid="cal-prev-month"
          class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer text-[10px]"
          title="Попередній місяць"
          @click.stop="prevMonth"
        >
          ▲
        </button>
        <button
          type="button"
          data-testid="cal-next-month"
          class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer text-[10px]"
          title="Наступний місяць"
          @click.stop="nextMonth"
        >
          ▼
        </button>
      </div>
    </div>

    <!-- Weekday Headers (Пн, Вт, Ср, Чт, Пт, Сб, Нд) -->
    <div class="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-medium text-slate-400">
      <div v-for="w in WEEKDAYS" :key="w">
        {{ w }}
      </div>
    </div>

    <!-- 42-day Calendar Grid (6 rows of 7 days) -->
    <div class="grid grid-cols-7 gap-1 text-center text-xs font-mono">
      <button
        v-for="cell in calendarDays"
        :key="cell.key"
        type="button"
        :data-testid="'cal-day-' + cell.isoDate"
        class="w-7 h-7 flex items-center justify-center rounded-full transition cursor-pointer mx-auto text-xs"
        :class="getCellClasses(cell)"
        @click.stop="selectDay(cell)"
      >
        {{ cell.day }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { parseDateSlashes, formatDateSlashes } from '../domain/datetime.js';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const UK_MONTH_NAMES = [
  'січень',
  'лютий',
  'березень',
  'квітень',
  'травень',
  'червень',
  'липень',
  'серпень',
  'вересень',
  'жовтень',
  'листопад',
  'грудень',
];

const props = defineProps({
  selectedDate: { type: String, default: '' },
  align: { type: String, default: 'left' },
});

const emit = defineEmits(['select', 'close']);

const pickerRef = ref(null);
const offsetX = ref(0);
let docListenerTimer = null;

const now = new Date();
const parsedInitial = parseDateSlashes(props.selectedDate);
const viewYear = ref(parsedInitial.ok ? parsedInitial.year : now.getFullYear());
const viewMonth = ref(parsedInitial.ok ? parsedInitial.month : now.getMonth() + 1);

watch(
  () => props.selectedDate,
  (val) => {
    const res = parseDateSlashes(val);
    if (res.ok) {
      viewYear.value = res.year;
      viewMonth.value = res.month;
    }
  }
);

const monthTitle = computed(() => {
  const name = UK_MONTH_NAMES[viewMonth.value - 1] || '';
  return `${name} ${viewYear.value} р.`;
});

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}

const calendarDays = computed(() => {
  const y = viewYear.value;
  const m = viewMonth.value;
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
  const startOffset = (firstDayOfWeek + 6) % 7; // Mon is 0

  const parsedSelected = parseDateSlashes(props.selectedDate);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();

  const cells = [];

  // 1. Previous month filler days
  const prevDaysInMonth = new Date(y, m - 1, 0).getDate();
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevDaysInMonth - i;
    const formatted = formatDateSlashes({ day, month: prevM, year: prevY });
    const isoDate = `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = parsedSelected.ok && parsedSelected.year === prevY && parsedSelected.month === prevM && parsedSelected.day === day;
    const isToday = todayY === prevY && todayM === prevM && todayD === day;
    cells.push({
      day,
      month: prevM,
      year: prevY,
      formatted,
      isoDate,
      isOtherMonth: true,
      isSelected,
      isToday,
      key: `prev-${day}`,
    });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const formatted = formatDateSlashes({ day, month: m, year: y });
    const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = parsedSelected.ok && parsedSelected.year === y && parsedSelected.month === m && parsedSelected.day === day;
    const isToday = todayY === y && todayM === m && todayD === day;
    cells.push({
      day,
      month: m,
      year: y,
      formatted,
      isoDate,
      isOtherMonth: false,
      isSelected,
      isToday,
      key: `curr-${day}`,
    });
  }

  // 3. Next month filler days (filling out 42 cells = 6 full rows)
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const remaining = 42 - cells.length;

  for (let day = 1; day <= remaining; day++) {
    const formatted = formatDateSlashes({ day, month: nextM, year: nextY });
    const isoDate = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = parsedSelected.ok && parsedSelected.year === nextY && parsedSelected.month === nextM && parsedSelected.day === day;
    const isToday = todayY === nextY && todayM === nextM && todayD === day;
    cells.push({
      day,
      month: nextM,
      year: nextY,
      formatted,
      isoDate,
      isOtherMonth: true,
      isSelected,
      isToday,
      key: `next-${day}`,
    });
  }

  return cells;
});

function getCellClasses(cell) {
  if (cell.isSelected) {
    return 'bg-emerald-600 text-white font-bold shadow-sm hover:bg-emerald-500';
  }
  if (cell.isOtherMonth) {
    return 'text-slate-600 hover:text-slate-300 hover:bg-slate-800/50';
  }
  if (cell.isToday) {
    return 'border border-emerald-500/70 text-emerald-400 font-semibold hover:bg-slate-800';
  }
  return 'text-slate-200 hover:bg-slate-800 hover:text-emerald-300';
}

function selectDay(cell) {
  emit('select', cell.formatted);
}

function handleDocClick(e) {
  if (pickerRef.value && !pickerRef.value.contains(e.target)) {
    emit('close');
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

function adjustHorizontalPosition() {
  if (!pickerRef.value || typeof window === 'undefined') return;
  offsetX.value = 0;
  pickerRef.value.style.left = '';
  const rect = pickerRef.value.getBoundingClientRect();
  const vpWidth = Math.min(
    window.innerWidth,
    window.visualViewport?.width || window.innerWidth
  );
  const maxRight = vpWidth - 8;
  if (rect.right > maxRight) {
    offsetX.value = Math.round(Math.max(8 - rect.left, maxRight - rect.right));
  } else if (rect.left < 8) {
    offsetX.value = Math.round(8 - rect.left);
  }
}

onMounted(() => {
  adjustHorizontalPosition();
  window.addEventListener('resize', adjustHorizontalPosition);
  docListenerTimer = setTimeout(() => {
    document.addEventListener('click', handleDocClick);
    document.addEventListener('keydown', handleKeyDown);
  }, 0);
});

onBeforeUnmount(() => {
  clearTimeout(docListenerTimer);
  window.removeEventListener('resize', adjustHorizontalPosition);
  document.removeEventListener('click', handleDocClick);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>
