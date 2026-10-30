<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl shadow-xl">
    <div class="px-4 py-3 bg-slate-900/80 border-b border-slate-800 rounded-t-xl flex justify-between items-center flex-wrap gap-3">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="text-sm">📊</span>
          <h3 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Погодинний прогноз на висоті:
            <span class="text-emerald-400 normal-case font-bold">{{ formatAglLabel(selectedAgl) }} AGL</span>
          </h3>
        </div>

        <!-- Single-day Forecast Date Selector with Calendar Dropdown -->
        <div class="relative flex items-center gap-1.5">
          <span class="text-slate-400 text-[11px]">📅</span>
          <input
            data-testid="forecast-date-input"
            type="text"
            :value="selectedDate"
            placeholder="ДД\ММ\РРРР"
            aria-label="Дата прогнозу"
            class="w-28 bg-slate-950/90 border border-slate-700 hover:border-emerald-500/70 rounded-md px-2.5 py-1 text-center font-mono text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer transition"
            @input="$emit('update:selectedDate', $event.target.value)"
            @click="isDatePickerOpen = !isDatePickerOpen"
          />

          <CalendarDatePicker
            v-if="isDatePickerOpen"
            :selected-date="selectedDate"
            @select="handleSelectDate"
            @close="isDatePickerOpen = false"
          />
        </div>
      </div>

      <div class="text-[11px] text-slate-400">
        Показано годин: {{ hours.length }} • Клікніть на рядок для детального висотного зрізу
      </div>
    </div>

    <div class="overflow-x-auto rounded-b-xl">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-950/80 text-slate-400 text-[11px] border-b border-slate-800 uppercase tracking-wider">
            <th class="py-2.5 px-3">Дата / Час</th>
            <th class="py-2.5 px-3">Вітер</th>
            <th class="py-2.5 px-3">Пориви</th>
            <th class="py-2.5 px-3">Напрямок</th>
            <th class="py-2.5 px-3">Темп.</th>
            <th class="py-2.5 px-3">Опади</th>
            <th class="py-2.5 px-3">Ймов.</th>
            <th class="py-2.5 px-3">Хмарн.</th>
            <th class="py-2.5 px-3">Волог.</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
          <tr
            v-if="hours.length === 0"
            data-testid="forecast-empty-row"
          >
            <td colspan="9" class="py-6 px-4 text-center font-sans text-xs text-slate-400">
              Немає даних прогнозу на обрану дату (прогноз доступний на 14 діб). Оберіть інший день у календарі.
            </td>
          </tr>
          <tr
            v-for="h in hours"
            :key="h.timeIso"
            data-testid="forecast-row"
            class="hover:bg-slate-800/60 transition cursor-pointer"
            :class="h.timeIso === activeHourIso ? 'bg-emerald-950/30 border-l-2 border-emerald-500' : ''"
            @click="$emit('select-hour', h.timeIso)"
          >
            <!-- Date & Time -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span class="text-slate-400 font-sans text-[11px] mr-1.5">{{ h.dateStr }}</span>
              <span class="font-bold text-slate-100">{{ h.hourStr }}</span>
            </td>

            <!-- Wind Speed -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span
                class="font-semibold"
                :class="getWindColorClass(getTier(h)?.windSpeedMs)"
              >
                {{ getTier(h)?.windSpeedMs != null ? getTier(h).windSpeedMs + ' м/с' : '—' }}
              </span>
            </td>

            <!-- Wind Gusts -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span
                :class="getGustColorClass(getTier(h)?.windGustMs)"
              >
                {{ getTier(h)?.windGustMs != null ? getTier(h).windGustMs + ' м/с' : '—' }}
              </span>
            </td>

            <!-- Wind Vane Arrow & Degrees -->
            <td class="py-2.5 px-3 whitespace-nowrap text-emerald-400 font-medium">
              {{ getTier(h)?.windDirectionLabel || '—' }}
            </td>

            <!-- Temperature -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              {{ getTier(h)?.tempC != null ? getTier(h).tempC + '°C' : '—' }}
            </td>

            <!-- Precip amount -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span :class="h.precipMm > 0 ? 'text-sky-400 font-medium' : 'text-slate-400'">
                {{ h.precipMm }} мм
              </span>
            </td>

            <!-- Precip probability -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span :class="h.precipProbPct >= 40 ? 'text-amber-400 font-medium' : 'text-slate-400'">
                {{ h.precipProbPct }}%
              </span>
            </td>

            <!-- Cloud cover -->
            <td class="py-2.5 px-3 whitespace-nowrap text-slate-300">
              <span class="font-medium">{{ h.surfaceCloudCoverPct != null ? h.surfaceCloudCoverPct + '%' : '—' }}</span>
              <span
                v-if="selectedAgl > 0 && getTier(h)?.cloudCoverPct != null && getTier(h).cloudCoverPct !== h.surfaceCloudCoverPct"
                class="text-[10px] text-slate-400 block font-sans"
              >
                шар: {{ getTier(h).cloudCoverPct }}%
              </span>
            </td>

            <!-- Humidity -->
            <td class="py-2.5 px-3 whitespace-nowrap text-slate-400">
              <span>{{ h.surfaceHumidityPct != null ? h.surfaceHumidityPct + '%' : '—' }}</span>
              <span
                v-if="selectedAgl > 0 && getTier(h)?.humidityPct != null && getTier(h).humidityPct !== h.surfaceHumidityPct"
                class="text-[10px] text-slate-500 block font-sans"
              >
                на вис: {{ getTier(h).humidityPct }}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { formatAglLabel } from '../domain/atmosphere.js';
import CalendarDatePicker from './CalendarDatePicker.vue';

const props = defineProps({
  hours: { type: Array, required: true },
  selectedAgl: { type: Number, default: 0 },
  selectedDate: { type: String, default: '' },
  activeHourIso: { type: String, default: '' },
});

const emit = defineEmits(['select-hour', 'update:selectedDate']);

const isDatePickerOpen = ref(false);

function handleSelectDate(dateVal) {
  emit('update:selectedDate', dateVal);
  isDatePickerOpen.value = false;
}

function getTier(h) {
  if (!h || !h.tiers) return null;
  return h.tiers[props.selectedAgl] || h.tiers[0] || null;
}

function getWindColorClass(speed) {
  if (speed == null) return 'text-slate-400';
  if (speed < 7) return 'text-emerald-400';
  if (speed < 12) return 'text-amber-300';
  return 'text-rose-400 font-bold';
}

function getGustColorClass(gust) {
  if (gust == null) return 'text-slate-400';
  if (gust < 9) return 'text-slate-300';
  if (gust < 15) return 'text-amber-400';
  return 'text-rose-400 font-bold';
}
</script>
