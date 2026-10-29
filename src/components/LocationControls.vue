<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg">
    <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
      <!-- Search city/settlement -->
      <div class="relative w-full md:w-80">
        <label class="block text-xs font-medium text-slate-400 mb-1">
          Пошук населеного пункту (світ)
        </label>
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            data-testid="city-search-input"
            placeholder="Введіть місто (Київ, Berlin, Tokyo...)"
            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            @input="onSearchInput"
            @focus="showDropdown = searchResults.length > 0"
          />
          <div v-if="isSearching" class="absolute right-3 top-2 text-xs text-slate-400">
            ⏳
          </div>
        </div>

        <!-- Search autocomplete dropdown -->
        <div
          v-if="showDropdown && searchResults.length > 0"
          class="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          <button
            v-for="item in searchResults"
            :key="item.id"
            type="button"
            class="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex justify-between items-center border-b border-slate-800 last:border-b-0"
            @click="selectSearchResult(item)"
          >
            <span class="font-medium text-slate-200">{{ item.name }}</span>
            <span class="text-slate-400 text-[11px] truncate max-w-[140px]">
              {{ item.admin1 ? item.admin1 + ', ' : '' }}{{ item.country }}
            </span>
          </button>
        </div>
      </div>

      <!-- Direct coordinate input form with WGS 84 / MGRS toggle -->
      <form
        data-testid="coord-submit"
        class="w-full md:w-auto flex-1 flex flex-col sm:flex-row items-stretch sm:items-end gap-2"
        @submit.prevent="handleSubmit"
      >
        <div class="flex-1">
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium text-slate-400">Введіть координати</label>
            <div class="flex rounded-md bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
              <button
                type="button"
                data-testid="coord-mode-wgs84"
                class="px-2 py-0.5 rounded transition"
                :class="mode === 'wgs84' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'"
                @click="setMode('wgs84')"
              >
                WGS 84
              </button>
              <button
                type="button"
                data-testid="coord-mode-mgrs"
                class="px-2 py-0.5 rounded transition"
                :class="mode === 'mgrs' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'"
                @click="setMode('mgrs')"
              >
                MGRS
              </button>
            </div>
          </div>

          <input
            v-model="inputValue"
            type="text"
            data-testid="coord-input"
            :placeholder="mode === 'wgs84' ? '50.4501, 30.5234' : '36U UA 24193 90589'"
            class="w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
            :class="errorMessage ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'"
          />
        </div>

        <button
          type="submit"
          class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer shrink-0"
        >
          Застосувати
        </button>
      </form>
    </div>

    <!-- Error message banner if any -->
    <div v-if="errorMessage" class="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
      <span>⚠️</span>
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { parseWgs84, formatWgs84, wgs84ToMgrs, parseMgrs } from '../domain/coordinates.js';
import { searchLocations } from '../services/openMeteo.js';

const props = defineProps({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  locationLabel: { type: String, default: '' },
});

const emit = defineEmits(['select-location']);

const mode = ref('wgs84'); // 'wgs84' | 'mgrs'
const inputValue = ref('');
const errorMessage = ref('');

const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const showDropdown = ref(false);
let searchDebounceTimer = null;

function syncInputFromProps() {
  if (mode.value === 'wgs84') {
    inputValue.value = formatWgs84(props.lat, props.lon, 5);
  } else {
    const res = wgs84ToMgrs(props.lat, props.lon, 5);
    inputValue.value = res.ok ? res.mgrs : '';
  }
}

watch(
  () => [props.lat, props.lon],
  () => {
    syncInputFromProps();
  },
  { immediate: true }
);

function setMode(newMode) {
  if (mode.value === newMode) return;
  errorMessage.value = '';
  mode.value = newMode;
  syncInputFromProps();
}

function handleSubmit() {
  errorMessage.value = '';
  if (mode.value === 'wgs84') {
    const res = parseWgs84(inputValue.value);
    if (!res.ok) {
      errorMessage.value = res.error;
      return;
    }
    emit('select-location', {
      lat: res.lat,
      lon: res.lon,
      label: formatWgs84(res.lat, res.lon, 4),
    });
  } else {
    const res = parseMgrs(inputValue.value);
    if (!res.ok) {
      errorMessage.value = res.error;
      return;
    }
    emit('select-location', {
      lat: res.lat,
      lon: res.lon,
      label: res.mgrs,
    });
  }
}

function onSearchInput() {
  clearTimeout(searchDebounceTimer);
  if (searchQuery.value.trim().length < 2) {
    searchResults.value = [];
    showDropdown.value = false;
    return;
  }
  isSearching.value = true;
  searchDebounceTimer = setTimeout(async () => {
    searchResults.value = await searchLocations(searchQuery.value);
    isSearching.value = false;
    showDropdown.value = searchResults.value.length > 0;
  }, 300);
}

function selectSearchResult(item) {
  searchQuery.value = `${item.name}, ${item.country}`;
  showDropdown.value = false;
  emit('select-location', {
    lat: item.lat,
    lon: item.lon,
    label: `${item.name}, ${item.country}`,
  });
}
</script>
