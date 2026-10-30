<template>
  <div class="bg-gradient-to-r from-slate-900 to-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg">
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <!-- Title, Altitude Selector & Time -->
      <div data-testid="current-header-block" class="w-full lg:w-auto">
        <h2 class="w-full sm:w-auto text-xs uppercase tracking-wider font-semibold text-slate-400 flex flex-col sm:flex-row items-center gap-1.5 sm:flex-wrap">
          <span class="inline-flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 shrink-0 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Поточний стан на висоті:</span>
          </span>
          <span
            data-testid="agl-selector-row"
            class="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1.5"
          >
            <span
              data-testid="agl-select-box"
              class="relative inline-flex items-center justify-center bg-slate-950/90 border border-emerald-500/40 hover:border-emerald-400 focus-within:border-emerald-400 text-emerald-400 rounded-md px-2 py-0.5 text-sm font-bold normal-case transition"
            >
              <span data-testid="agl-select-sizer" aria-hidden="true" class="whitespace-nowrap">{{ formatAglLabel(selectedAgl) }}</span>
              <select
                data-testid="agl-select"
                aria-label="Висота AGL"
                :value="selectedAgl"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none text-base bg-slate-900 text-slate-100 [color-scheme:dark]"
                @change="$emit('update:selectedAgl', Number($event.target.value))"
              >
                <option
                  v-for="tier in AGL_TIERS_METERS"
                  :key="tier"
                  :value="tier"
                  class="bg-slate-900 text-slate-100 font-medium"
                >
                  {{ formatAglLabel(tier) }}
                </option>
              </select>
            </span>
            <span class="text-emerald-400 normal-case text-sm font-bold">AGL</span>
          </span>
        </h2>
        <div
          data-testid="current-time-row"
          class="text-sm font-medium text-slate-200 mt-1.5 sm:mt-1 text-center sm:text-left flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5"
        >
          <span>{{ record ? record.dateStr + ' ' + record.hourStr : 'Завантаження...' }}</span>
          <span
            v-if="settlement"
            data-testid="current-card-settlement"
            class="text-xs text-slate-300 font-normal inline-flex items-center gap-1"
          >
            <span class="text-emerald-400">📍</span>
            <span>{{ settlement }}</span>
          </span>
          <span v-else-if="timezone" class="text-xs text-slate-500">({{ timezone }})</span>
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
            {{ displayCloudCover != null ? displayCloudCover + '%' : '—' }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">
            {{ selectedAgl === 0 ? 'Загальна неба' : `Шар (небо: ${record.surfaceCloudCoverPct ?? displayCloudCover ?? 0}%)` }}
          </div>
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

        <!-- Humidity -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          <div class="text-[10px] uppercase text-slate-400">Вологість</div>
          <div class="text-base font-bold text-slate-100 mt-0.5">
            {{ displayHumidity != null ? displayHumidity + '%' : '—' }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">
            {{ selectedAgl === 0 ? 'Відносна приземна' : `На висоті (земля: ${record.surfaceHumidityPct ?? displayHumidity ?? 0}%)` }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { AGL_TIERS_METERS, formatAglLabel } from '../domain/atmosphere.js';

const props = defineProps({
  record: { type: Object, default: null },
  selectedAgl: { type: Number, default: 0 },
  timezone: { type: String, default: 'UTC' },
  settlement: { type: String, default: '' },
});

defineEmits(['update:selectedAgl']);

const tierData = computed(() => {
  if (!props.record || !props.record.tiers) return null;
  return props.record.tiers[props.selectedAgl] || props.record.tiers[0] || null;
});

const displayCloudCover = computed(() => {
  if (props.selectedAgl === 0) {
    return props.record?.surfaceCloudCoverPct ?? tierData.value?.cloudCoverPct ?? null;
  }
  return tierData.value?.cloudCoverPct ?? props.record?.surfaceCloudCoverPct ?? null;
});

const displayHumidity = computed(() => {
  if (props.selectedAgl === 0) {
    return props.record?.surfaceHumidityPct ?? tierData.value?.humidityPct ?? null;
  }
  return tierData.value?.humidityPct ?? props.record?.surfaceHumidityPct ?? null;
});
</script>
