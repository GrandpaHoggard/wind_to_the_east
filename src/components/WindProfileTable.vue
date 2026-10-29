<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
    <!-- Header with Hour Selector -->
    <div class="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center flex-wrap gap-3">
      <div class="flex items-center gap-2">
        <span class="text-sm">🌪️</span>
        <h3 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Профіль вітру та атмосфери по висотах (0–5000 м AGL)
        </h3>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-xs text-slate-400">Година зрізу:</label>
        <select
          :value="activeHourIso"
          class="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
          @change="$emit('update:activeHourIso', $event.target.value)"
        >
          <option v-for="h in hours" :key="h.timeIso" :value="h.timeIso">
            {{ h.dateStr }} {{ h.hourStr }}
          </option>
        </select>
      </div>
    </div>

    <!-- 15-tier vertical table: 5000m at top down to Земля at bottom -->
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-950/80 text-slate-400 text-[11px] border-b border-slate-800 uppercase tracking-wider">
            <th class="py-2.5 px-3">Висота AGL</th>
            <th class="py-2.5 px-3">Вітер</th>
            <th class="py-2.5 px-3">Пориви (Wind Shear)</th>
            <th class="py-2.5 px-3">Напрямок (флюгер)</th>
            <th class="py-2.5 px-3">Температура</th>
            <th class="py-2.5 px-3">Хмарність</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
          <tr
            v-for="tier in tiersReversed"
            :key="tier.aglMeters"
            data-testid="profile-tier-row"
            class="hover:bg-slate-800/60 transition"
            :class="tier.aglMeters === selectedAgl ? 'bg-emerald-950/20 font-semibold' : ''"
          >
            <!-- AGL Altitude -->
            <td class="py-2.5 px-3 font-sans font-medium whitespace-nowrap">
              <span :class="tier.aglMeters === 0 ? 'text-amber-400' : 'text-slate-100'">
                {{ tier.aglLabel }}
              </span>
            </td>

            <!-- Wind Speed -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span :class="getWindColorClass(tier.windSpeedMs)">
                {{ tier.windSpeedMs != null ? tier.windSpeedMs + ' м/с' : '—' }}
              </span>
            </td>

            <!-- Wind Gusts -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span :class="tier.windGustMs > tier.windSpeedMs ? 'text-amber-400 font-bold' : 'text-slate-300'">
                {{ tier.windGustMs != null ? tier.windGustMs + ' м/с' : '—' }}
              </span>
            </td>

            <!-- Wind Direction (vane arrow + degrees) -->
            <td class="py-2.5 px-3 whitespace-nowrap text-emerald-400 font-medium">
              {{ tier.windDirectionLabel }}
            </td>

            <!-- Temperature -->
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span :class="tier.tempC < 0 ? 'text-sky-300' : 'text-slate-200'">
                {{ tier.tempC != null ? tier.tempC + '°C' : '—' }}
              </span>
            </td>

            <!-- Cloud cover -->
            <td class="py-2.5 px-3 whitespace-nowrap text-slate-300">
              {{ tier.cloudCoverPct != null ? tier.cloudCoverPct + '%' : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { AGL_TIERS_METERS } from '../domain/atmosphere.js';

const props = defineProps({
  hours: { type: Array, required: true },
  activeHourIso: { type: String, default: '' },
  selectedAgl: { type: Number, default: 0 },
});

defineEmits(['update:activeHourIso']);

const currentRecord = computed(() => {
  if (!props.hours || props.hours.length === 0) return null;
  const match = props.hours.find((h) => h.timeIso === props.activeHourIso);
  return match || props.hours[0];
});

// Render from 5000m at top down to 0m (Земля) at bottom
const tiersReversed = computed(() => {
  if (!currentRecord.value || !currentRecord.value.tiers) return [];
  const reversedTiers = [...AGL_TIERS_METERS].reverse();
  return reversedTiers.map((agl) => currentRecord.value.tiers[agl]).filter(Boolean);
});

function getWindColorClass(speed) {
  if (speed == null) return 'text-slate-400';
  if (speed < 7) return 'text-emerald-400';
  if (speed < 12) return 'text-amber-300';
  return 'text-rose-400 font-bold';
}
</script>
