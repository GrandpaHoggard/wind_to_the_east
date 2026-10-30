<template>
  <div class="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
    <!-- Header -->
    <header class="bg-[#0f172a] border-b border-slate-800/80 sticky top-0 z-[1100] shadow-md">
      <div class="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-base shadow">
            🧭
          </div>
          <div>
            <h1 class="text-base font-bold text-white tracking-tight">
              Wind to the East
            </h1>
            <div class="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
              <span>WGS 84: <span class="text-slate-200">{{ wgs84Formatted }}</span></span>
              <span class="text-slate-600">•</span>
              <span>MGRS: <span class="text-emerald-400 font-bold">{{ mgrsFormatted }}</span></span>
              <template v-if="nearestSettlement">
                <span class="text-slate-600">•</span>
                <span
                  data-testid="nearest-settlement"
                  class="font-sans text-slate-200 font-medium flex items-center gap-1"
                >
                  <span class="text-emerald-400">📍</span>
                  <span>{{ nearestSettlement }}</span>
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Error banner (non-destructive: preserves previous forecast) -->
    <div
      v-if="errorMessage"
      data-testid="error-banner"
      class="bg-rose-950/80 border-b border-rose-800/80 px-4 py-2.5 text-xs text-rose-200 flex justify-between items-center"
    >
      <div class="flex items-center gap-2">
        <span>⚠️</span>
        <span>{{ errorMessage }}</span>
      </div>
      <button
        type="button"
        class="bg-rose-900/80 hover:bg-rose-800 text-white px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer"
        @click="loadForecast"
      >
        Повторити
      </button>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 py-4 flex-1 flex flex-col gap-4">
      <!-- Location Controls (Search, Coordinates & Map Toggle) -->
      <LocationControls
        :lat="currentLat"
        :lon="currentLon"
        :location-label="currentLocationLabel"
        :map-open="isMapOpen"
        :fetch-impl="fetchImpl"
        @select-location="handleLocationSelect"
        @toggle-map="isMapOpen = !isMapOpen"
      />

      <!-- Collapsible Interactive Leaflet Map Picker (right under coordinates) -->
      <div v-show="isMapOpen" data-testid="map-panel-wrapper">
        <WorldMapPicker
          :lat="currentLat"
          :lon="currentLon"
          :visible="isMapOpen"
          @pick-coordinates="handleMapPick"
          @close="isMapOpen = false"
        />
      </div>

      <!-- Mode Switcher (Current Weather vs Wind Profile) -->
      <TimeAltitudeFilters
        v-model:mode="filterMode"
      />

      <!-- Express Current Conditions Card (with inline Altitude Selector) -->
      <CurrentConditionsCard
        :record="currentHourRecord"
        v-model:selected-agl="selectedAgl"
        :timezone="forecastTimezone"
        :settlement="nearestSettlement"
      />

      <!-- Single-Day Hourly Forecast Table (active in 'current' mode) -->
      <div v-show="filterMode !== 'profile'" data-testid="forecast-section">
        <ForecastTable
          :hours="displayedHours"
          :selected-agl="selectedAgl"
          :selected-date="selectedForecastDate"
          :active-hour-iso="activeHourIso"
          @update:selected-date="handleForecastDateChange"
          @select-hour="handleSelectHour"
        />
      </div>

      <!-- Wind Profile Table (0-5000m vertical, active in 'profile' mode) -->
      <div v-show="filterMode === 'profile'" data-testid="profile-section">
        <WindProfileTable
          :hours="allHours"
          :active-hour-iso="activeHourIso"
          :selected-agl="selectedAgl"
          @update:active-hour-iso="handleUpdateActiveHour"
        />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-[#0f172a] border-t border-slate-800/80 text-[11px] text-slate-500 px-4 py-3 text-center">
      Wind to the East • Погодний моніторинг та вітер до 5000м AGL • Дані: Open-Meteo & OpenStreetMap • Швидкість вітру: м/с (флюгер)
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { formatWgs84, wgs84ToMgrs } from './domain/coordinates.js';
import { formatDateSlashes, parseDateSlashes, findCurrentHourRecord } from './domain/datetime.js';
import { fetchWeatherForecast, fetchNearestSettlement } from './services/openMeteo.js';
import LocationControls from './components/LocationControls.vue';
import TimeAltitudeFilters from './components/TimeAltitudeFilters.vue';
import CurrentConditionsCard from './components/CurrentConditionsCard.vue';
import ForecastTable from './components/ForecastTable.vue';
import WindProfileTable from './components/WindProfileTable.vue';
import WorldMapPicker from './components/WorldMapPicker.vue';

const props = defineProps({
  fetchImpl: { type: Function, default: undefined },
});

// Location state (default Kyiv)
const currentLat = ref(50.4501);
const currentLon = ref(30.5234);
const currentLocationLabel = ref('Київ, Україна');
const nearestSettlement = ref('Київ, Україна');
let settlementReqSeq = 0;
let forecastReqSeq = 0;

// Navigation & map state
const isMapOpen = ref(false);
const activeHourIso = ref('');
const hasCustomActiveHour = ref(false);

// Mode & altitude state ('current' | 'profile')
const filterMode = ref('current');
const selectedAgl = ref(0);

// Single-day forecast date (default: today in DD\MM\YYYY)
const today = new Date();
const initialTodayDate = formatDateSlashes({ day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() });
const selectedForecastDate = ref(initialTodayDate);
const hasCustomForecastDate = ref(false);

// Forecast data state
const allHours = ref([]);
const forecastTimezone = ref('Europe/Kyiv');
const isLoading = ref(false);
const errorMessage = ref('');

const wgs84Formatted = computed(() => formatWgs84(currentLat.value, currentLon.value, 4));
const mgrsFormatted = computed(() => {
  const res = wgs84ToMgrs(currentLat.value, currentLon.value, 5);
  return res.ok ? res.mgrs : '—';
});

const currentHourRecord = computed(() =>
  findCurrentHourRecord(allHours.value, undefined, forecastTimezone.value)
);

const displayedHours = computed(() => {
  if (allHours.value.length === 0) return [];
  const parsed = parseDateSlashes(selectedForecastDate.value);
  const targetDate = parsed.ok ? parsed.normalized : String(selectedForecastDate.value || '').trim();
  return allHours.value.filter((h) => h.dateStr === targetDate);
});

async function loadForecast() {
  const seq = ++forecastReqSeq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const res = await fetchWeatherForecast(currentLat.value, currentLon.value, props.fetchImpl);
    if (seq !== forecastReqSeq) return;
    allHours.value = res.hours;
    forecastTimezone.value = res.timezone;
    if (res.hours.length > 0) {
      const nowRecord = findCurrentHourRecord(res.hours, undefined, res.timezone);
      const hasMatchingHour =
        Boolean(activeHourIso.value) && res.hours.some((h) => h.timeIso === activeHourIso.value);
      if (!hasCustomActiveHour.value || !hasMatchingHour) {
        activeHourIso.value = (nowRecord || res.hours[0]).timeIso;
      }
      const parsedSel = parseDateSlashes(selectedForecastDate.value);
      const normSel = parsedSel.ok ? parsedSel.normalized : String(selectedForecastDate.value || '').trim();
      const hasMatchingDay = res.hours.some((h) => h.dateStr === normSel);
      if (!hasCustomForecastDate.value || !hasMatchingDay) {
        selectedForecastDate.value = (nowRecord || res.hours[0]).dateStr;
      }
    }
  } catch (err) {
    if (seq !== forecastReqSeq) return;
    errorMessage.value = err.message || 'Не вдалося завантажити погодні дані';
  } finally {
    if (seq === forecastReqSeq) {
      isLoading.value = false;
    }
  }
}

async function resolveNearestSettlement(lat, lon) {
  const seq = ++settlementReqSeq;
  const resolved = await fetchNearestSettlement(lat, lon, props.fetchImpl);
  if (seq !== settlementReqSeq) return;
  if (resolved) {
    nearestSettlement.value = resolved;
    currentLocationLabel.value = resolved;
  }
}

function handleLocationSelect(loc) {
  currentLat.value = loc.lat;
  currentLon.value = loc.lon;
  if (loc.fromSearch && loc.label) {
    settlementReqSeq += 1;
    nearestSettlement.value = loc.label;
    currentLocationLabel.value = loc.label;
  } else {
    nearestSettlement.value = '';
    currentLocationLabel.value = loc.label || formatWgs84(loc.lat, loc.lon, 4);
    resolveNearestSettlement(loc.lat, loc.lon);
  }
  loadForecast();
}

function handleMapPick({ lat, lon }) {
  currentLat.value = lat;
  currentLon.value = lon;
  nearestSettlement.value = '';
  currentLocationLabel.value = formatWgs84(lat, lon, 4);
  resolveNearestSettlement(lat, lon);
  loadForecast();
}

function handleForecastDateChange(val) {
  selectedForecastDate.value = val;
  hasCustomForecastDate.value = true;
}

function handleUpdateActiveHour(timeIso) {
  activeHourIso.value = timeIso;
  hasCustomActiveHour.value = true;
}

function handleSelectHour(timeIso) {
  activeHourIso.value = timeIso;
  hasCustomActiveHour.value = true;
  filterMode.value = 'profile';
}

onMounted(() => {
  loadForecast();
  resolveNearestSettlement(currentLat.value, currentLon.value);
});
</script>
