<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
    <div class="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <span class="text-sm">📊</span>
        <h3 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Погодинний прогноз на висоті:
          <span class="text-emerald-400 normal-case font-bold">{{ formatAglLabel(selectedAgl) }} AGL</span>
        </h3>
      </div>
      <div class="text-[11px] text-slate-400">
        Показано годин: {{ hours.length }} • Клікніть на рядок для детального висотного зрізу
      </div>
    </div>

    <div class="overflow-x-auto">
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
            v-for="h in hours"
            :key="h.timeIso"
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
              {{ getTier(h)?.cloudCoverPct != null ? getTier(h).cloudCoverPct + '%' : '—' }}
            </td>

            <!-- Humidity -->
            <td class="py-2.5 px-3 whitespace-nowrap text-slate-400">
              {{ getTier(h)?.humidityPct != null ? getTier(h).humidityPct + '%' : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { formatAglLabel } from '../domain/atmosphere.js';

const props = defineProps({
  hours: { type: Array, required: true },
  selectedAgl: { type: Number, default: 0 },
  activeHourIso: { type: String, default: '' },
});

defineEmits(['select-hour']);

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
