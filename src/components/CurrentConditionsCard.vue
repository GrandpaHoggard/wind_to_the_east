<template>
  <div class="bg-gradient-to-r from-slate-900 to-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg">
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <!-- Title & Time -->
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 class="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Поточний стан на висоті: <span class="text-emerald-400 normal-case text-sm">{{ formatAglLabel(selectedAgl) }} AGL</span>
          </h2>
        </div>
        <div class="text-sm font-medium text-slate-200 mt-1">
          {{ record ? record.dateStr + ' ' + record.hourStr : 'Завантаження...' }}
          <span class="text-xs text-slate-500 ml-1">({{ timezone }})</span>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div v-if="record && tierData" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 w-full lg:w-auto">
        <!-- Wind Speed -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Вітер</div>
          <div class="text-base font-bold text-slate-100 flex items-center gap-1 mt-0.5">
            <span>{{ tierData.windSpeedMs != null ? tierData.windSpeedMs : '—' }}</span>
            <span class="text-xs font-normal text-slate-400">м/с</span>
          </div>
          <div class="text-[11px] text-emerald-400 font-mono mt-0.5">
            {{ tierData.windDirectionLabel }}
          </div>
        </div>

        <!-- Wind Gusts -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Пориви</div>
          <div class="text-base font-bold text-amber-400 flex items-center gap-1 mt-0.5">
            <span>{{ tierData.windGustMs != null ? tierData.windGustMs : '—' }}</span>
            <span class="text-xs font-normal text-slate-400">м/с</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">
            {{ selectedAgl === 0 ? 'Приземні' : 'Wind Shear' }}
          </div>
        </div>

        <!-- Temperature -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Температура</div>
          <div class="text-base font-bold text-slate-100 mt-0.5">
            {{ tierData.tempC != null ? tierData.tempC + '°C' : '—' }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Висотна</div>
        </div>

        <!-- Cloud Cover -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Хмарність</div>
          <div class="text-base font-bold text-slate-100 mt-0.5">
            {{ tierData.cloudCoverPct != null ? tierData.cloudCoverPct + '%' : '—' }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Покриття шару</div>
        </div>

        <!-- Precipitation -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Опади</div>
          <div class="text-base font-bold text-sky-400 mt-0.5">
            {{ record.precipMm }} <span class="text-xs font-normal text-slate-400">мм</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">
            Ймов: {{ record.precipProbPct }}%
          </div>
        </div>

        <!-- Humidity & Elevation -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Вологість / Рельєф</div>
          <div class="text-sm font-bold text-slate-200 mt-0.5">
            {{ tierData.humidityPct != null ? tierData.humidityPct + '%' : '—' }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">
            Рельєф: {{ elevationMeters }} м AMSL
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatAglLabel } from '../domain/atmosphere.js';

const props = defineProps({
  record: { type: Object, default: null },
  selectedAgl: { type: Number, default: 0 },
  elevationMeters: { type: Number, default: 0 },
  timezone: { type: String, default: 'UTC' },
});

const tierData = computed(() => {
  if (!props.record || !props.record.tiers) return null;
  return props.record.tiers[props.selectedAgl] || props.record.tiers[0] || null;
});
</script>
