<template>
  <div class="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
    <!-- Header -->
    <header class="bg-[#0f172a] border-b border-slate-800/80 sticky top-0 z-40 shadow-md">
      <div class="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-base shadow">
            🧭
          </div>
          <div>
            <h1 class="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Wind to the East
              <span class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                0–5000м AGL
              </span>
            </h1>
            <div class="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
              <span>WGS 84: <span class="text-slate-200">{{ wgs84Formatted }}</span></span>
              <span class="text-slate-600">•</span>
              <span>MGRS: <span class="text-emerald-400 font-bold">{{ mgrsFormatted }}</span></span>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs">
          <button
            type="button"
            data-testid="tab-forecast"
            class="px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5"
            :class="activeTab === 'forecast' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            @click="activeTab = 'forecast'"
          >
            <span>📊</span>
            <span>Прогноз</span>
          </button>
          <button
            type="button"
            data-testid="tab-wind-profile"
            class="px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5"
            :class="activeTab === 'profile' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            @click="activeTab = 'profile'"
          >
            <span>🌪️</span>
            <span>Профіль вітру</span>
          </button>
          <button
            type="button"
            data-testid="tab-map"
            class="px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5"
            :class="activeTab === 'map' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            @click="activeTab = 'map'"
          >
            <span>🗺️</span>
            <span>Карта</span>
          </button>
        </nav>
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
      <!-- Location Controls (Search & Coordinates) -->
      <LocationControls
        :lat="currentLat"
        :lon="currentLon"
        :location-label="currentLocationLabel"
        @select-location="handleLocationSelect"
      />

      <!-- Filter Controls (Time window & AGL tier) -->
      <TimeAltitudeFilters
        v-model:mode="filterMode"
        v-model:startDate="startDate"
        v-model:startHour="startHour"
        v-model:endDate="endDate"
        v-model:endHour="endHour"
        v-model:selectedAgl="selectedAgl"
        :range-error="rangeError"
        @apply-range="applyDateRange"
      />

      <!-- Express Current Conditions Card -->
      <CurrentConditionsCard
        :record="currentHourRecord"
        :selected-agl="selectedAgl"
        :elevation-meters="forecastElevation"
        :timezone="forecastTimezone"
      />

      <!-- Tab 1: Forecast Table -->
      <div v-show="activeTab === 'forecast'">
        <ForecastTable
          :hours="displayedHours"
          :selected-agl="selectedAgl"
          :active-hour-iso="activeHourIso"
          @select-hour="handleSelectHour"
        />
      </div>

      <!-- Tab 2: Wind Profile Table (0-5000m vertical) -->
      <div v-show="activeTab === 'profile'">
        <WindProfileTable
          :hours="allHours"
          v-model:activeHourIso="activeHourIso"
          :selected-agl="selectedAgl"
        />
      </div>

      <!-- Tab 3: Interactive Leaflet Map Picker -->
      <div v-show="activeTab === 'map'">
        <WorldMapPicker
          :lat="currentLat"
          :lon="currentLon"
          :visible="activeTab === 'map'"
          @pick-coordinates="handleMapPick"
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
import { formatDateSlashes, validateTimeRange, filterHoursByRange, findCurrentHourRecord } from './domain/datetime.js';
import { fetchWeatherForecast } from './services/openMeteo.js';
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
const currentLocationLabel = ref('Київ');

// Navigation state
const activeTab = ref('forecast'); // 'forecast' | 'profile' | 'map'
const activeHourIso = ref('');

// Filter & mode state
const filterMode = ref('current'); // 'current' | 'range'
const selectedAgl = ref(0);

// Default dates: today and tomorrow in DD\MM\YYYY
const today = new Date();
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
const startDate = ref(formatDateSlashes({ day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() }));
const startHour = ref(today.getHours());
const endDate = ref(formatDateSlashes({ day: tomorrow.getDate(), month: tomorrow.getMonth() + 1, year: tomorrow.getFullYear() }));
const endHour = ref(today.getHours());
const rangeError = ref('');

// Forecast data state
const allHours = ref([]);
const forecastElevation = ref(0);
const forecastTimezone = ref('Europe/Kyiv');
const isLoading = ref(false);
const errorMessage = ref('');

const wgs84Formatted = computed(() => formatWgs84(currentLat.value, currentLon.value, 4));
const mgrsFormatted = computed(() => {
  const res = wgs84ToMgrs(currentLat.value, currentLon.value, 5);
  return res.ok ? res.mgrs : '—';
});

const currentHourRecord = computed(() => findCurrentHourRecord(allHours.value));

const displayedHours = computed(() => {
  if (filterMode.value === 'current') {
    return allHours.value;
  }
  const range = validateTimeRange({
    startDate: startDate.value,
    startHour: startHour.value,
    endDate: endDate.value,
    endHour: endHour.value,
  });
  if (!range.ok) {
    return allHours.value;
  }
  const filtered = filterHoursByRange(allHours.value, range);
  return filtered.length > 0 ? filtered : allHours.value;
});

async function loadForecast() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const res = await fetchWeatherForecast(currentLat.value, currentLon.value, props.fetchImpl);
    allHours.value = res.hours;
    forecastElevation.value = res.elevationMeters;
    forecastTimezone.value = res.timezone;
    if (res.hours.length > 0 && !activeHourIso.value) {
      const nowRecord = findCurrentHourRecord(res.hours);
      activeHourIso.value = nowRecord ? nowRecord.timeIso : res.hours[0].timeIso;
    }
  } catch (err) {
    errorMessage.value = err.message || 'Не вдалося завантажити погодні дані';
  } finally {
    isLoading.value = false;
  }
}

function handleLocationSelect(loc) {
  currentLat.value = loc.lat;
  currentLon.value = loc.lon;
  currentLocationLabel.value = loc.label;
  loadForecast();
}

function handleMapPick({ lat, lon }) {
  currentLat.value = lat;
  currentLon.value = lon;
  currentLocationLabel.value = formatWgs84(lat, lon, 4);
  loadForecast();
}

function applyDateRange() {
  rangeError.value = '';
  const range = validateTimeRange({
    startDate: startDate.value,
    startHour: startHour.value,
    endDate: endDate.value,
    endHour: endHour.value,
  });
  if (!range.ok) {
    rangeError.value = range.error;
  }
}

function handleSelectHour(timeIso) {
  activeHourIso.value = timeIso;
  activeTab.value = 'profile';
}

onMounted(() => {
  loadForecast();
});
</script>
