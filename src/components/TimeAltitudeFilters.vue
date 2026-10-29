<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
    <!-- Mode switch: Current vs Range -->
    <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div class="flex rounded-lg bg-slate-900 p-1 border border-slate-800">
        <button
          type="button"
          data-testid="mode-current"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer"
          :class="mode === 'current' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
          @click="$emit('update:mode', 'current')"
        >
          ⏱️ Поточна погода
        </button>
        <button
          type="button"
          data-testid="mode-range"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer"
          :class="mode === 'range' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
          @click="$emit('update:mode', 'range')"
        >
          📅 Часовий відрізок
        </button>
      </div>

      <!-- Altitude tier selector (AGL) -->
      <div class="flex items-center gap-2">
        <label class="text-xs text-slate-400 whitespace-nowrap">Висота AGL:</label>
        <select
          data-testid="agl-select"
          :value="selectedAgl"
          class="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
          @change="$emit('update:selectedAgl', Number($event.target.value))"
        >
          <option v-for="tier in AGL_TIERS_METERS" :key="tier" :value="tier">
            {{ formatAglLabel(tier) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Date/Hour range controls (active in 'range' mode) -->
    <div v-if="mode === 'range'" class="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
      <!-- Start Date & Hour -->
      <div class="flex items-center gap-1.5">
        <span class="text-slate-400 text-[11px]">З:</span>
        <input
          data-testid="start-date-input"
          type="text"
          :value="startDate"
          placeholder="ДД\ММ\РРРР"
          class="w-24 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-center font-mono text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          @input="$emit('update:startDate', $event.target.value)"
        />
        <select
          :value="startHour"
          class="bg-slate-900 border border-slate-700 rounded-md px-1.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          @change="$emit('update:startHour', Number($event.target.value))"
        >
          <option v-for="h in 24" :key="h - 1" :value="h - 1">
            {{ String(h - 1).padStart(2, '0') }}:00
          </option>
        </select>
      </div>

      <span class="hidden sm:inline text-slate-600">—</span>

      <!-- End Date & Hour -->
      <div class="flex items-center gap-1.5">
        <span class="text-slate-400 text-[11px]">По:</span>
        <input
          data-testid="end-date-input"
          type="text"
          :value="endDate"
          placeholder="ДД\ММ\РРРР"
          class="w-24 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-center font-mono text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          @input="$emit('update:endDate', $event.target.value)"
        />
        <select
          :value="endHour"
          class="bg-slate-900 border border-slate-700 rounded-md px-1.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          @change="$emit('update:endHour', Number($event.target.value))"
        >
          <option v-for="h in 24" :key="h - 1" :value="h - 1">
            {{ String(h - 1).padStart(2, '0') }}:00
          </option>
        </select>
      </div>

      <button
        type="button"
        class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer"
        @click="$emit('apply-range')"
      >
        Застосувати
      </button>
    </div>

    <!-- Error message if date range is invalid -->
    <div v-if="rangeError" class="w-full text-xs text-rose-400 mt-1">
      ⚠️ {{ rangeError }}
    </div>
  </div>
</template>

<script setup>
import { AGL_TIERS_METERS, formatAglLabel } from '../domain/atmosphere.js';

defineProps({
  mode: { type: String, default: 'current' }, // 'current' | 'range'
  startDate: { type: String, default: '' },
  startHour: { type: Number, default: 0 },
  endDate: { type: String, default: '' },
  endHour: { type: Number, default: 23 },
  selectedAgl: { type: Number, default: 0 },
  rangeError: { type: String, default: '' },
});

defineEmits([
  'update:mode',
  'update:startDate',
  'update:startHour',
  'update:endDate',
  'update:endHour',
  'update:selectedAgl',
  'apply-range',
]);
</script>
