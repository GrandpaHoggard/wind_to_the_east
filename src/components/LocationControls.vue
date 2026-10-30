<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg">
    <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
      <!-- Search city/settlement -->
      <div ref="searchContainerRef" class="relative w-full md:w-80">
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
            @keydown.enter.prevent="onSearchEnter"
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
            class="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex justify-between items-center gap-2 border-b border-slate-800 last:border-b-0 cursor-pointer"
            @click="selectSearchResult(item)"
          >
            <div class="flex items-baseline gap-1.5 min-w-0">
              <span class="font-medium text-slate-100 truncate">{{ item.name }}</span>
              <span
                v-if="item.nativeName && item.nativeName.toLowerCase() !== item.name.toLowerCase()"
                class="text-emerald-400 text-[11px] truncate"
              >
                ({{ item.nativeName }})
              </span>
            </div>
            <span class="text-slate-400 text-[11px] truncate max-w-[160px] shrink-0">
              {{ item.admin1 && item.admin1.toLowerCase() !== item.name.toLowerCase() ? item.admin1 + ', ' : '' }}{{ formatCountryLabel(item) }}
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
          <div class="flex items-center justify-between mb-1 gap-2 flex-wrap">
            <label class="text-xs font-medium text-slate-400">Введіть координати</label>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="tab-map"
                class="px-2.5 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                :class="
                  mapOpen
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                "
                @click="$emit('toggle-map')"
              >
                <span>🗺️</span>
                <span>Карта</span>
              </button>

              <div class="flex rounded-md bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                <button
                  type="button"
                  data-testid="coord-mode-wgs84"
                  class="px-2 py-0.5 rounded transition cursor-pointer"
                  :class="mode === 'wgs84' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'"
                  @click="setMode('wgs84')"
                >
                  WGS 84
                </button>
                <button
                  type="button"
                  data-testid="coord-mode-mgrs"
                  class="px-2 py-0.5 rounded transition cursor-pointer"
                  :class="mode === 'mgrs' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'"
                  @click="setMode('mgrs')"
                >
                  MGRS
                </button>
              </div>
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
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { parseWgs84, formatWgs84, wgs84ToMgrs, parseMgrs } from '../domain/coordinates.js';
import { searchLocations } from '../services/openMeteo.js';

const props = defineProps({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  locationLabel: { type: String, default: '' },
  mapOpen: { type: Boolean, default: false },
  fetchImpl: { type: Function, default: undefined },
});

const emit = defineEmits(['select-location', 'toggle-map']);

const mode = ref('wgs84'); // 'wgs84' | 'mgrs'
const inputValue = ref('');
const errorMessage = ref('');

const searchContainerRef = ref(null);
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const showDropdown = ref(false);
let searchDebounceTimer = null;
let searchRequestSeq = 0;

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
    searchRequestSeq += 1;
    isSearching.value = false;
    searchResults.value = [];
    showDropdown.value = false;
    return;
  }
  const seq = ++searchRequestSeq;
  isSearching.value = true;
  searchDebounceTimer = setTimeout(async () => {
    const results = await searchLocations(searchQuery.value, props.fetchImpl);
    if (seq !== searchRequestSeq) return;
    searchResults.value = results;
    isSearching.value = false;
    showDropdown.value = searchResults.value.length > 0;
  }, 300);
}

function formatCountryLabel(item) {
  const c = item.country || '';
  const nc = item.nativeCountry || '';
  if (
    (!item.nativeName || item.nativeName.toLowerCase() === item.name.toLowerCase()) &&
    nc &&
    nc.toLowerCase() !== c.toLowerCase()
  ) {
    return `${c} (${nc})`;
  }
  return c;
}

async function onSearchEnter() {
  if (searchResults.value.length > 0 && showDropdown.value) {
    selectSearchResult(searchResults.value[0]);
    return;
  }
  const q = searchQuery.value.trim();
  if (q.length < 2) return;
  clearTimeout(searchDebounceTimer);
  const seq = ++searchRequestSeq;
  isSearching.value = true;
  const results = await searchLocations(q, props.fetchImpl);
  if (seq !== searchRequestSeq) return;
  searchResults.value = results;
  isSearching.value = false;
  if (results.length > 0) {
    selectSearchResult(results[0]);
  }
}

function handleDocClick(e) {
  if (searchContainerRef.value && !searchContainerRef.value.contains(e.target)) {
    showDropdown.value = false;
  }
}

function handleDocKeyDown(e) {
  if (e.key === 'Escape') {
    showDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocClick);
  document.addEventListener('keydown', handleDocKeyDown);
});

onBeforeUnmount(() => {
  clearTimeout(searchDebounceTimer);
  document.removeEventListener('click', handleDocClick);
  document.removeEventListener('keydown', handleDocKeyDown);
});

function selectSearchResult(item) {
  const title = item.displayName || item.name;
  const countryLabel = formatCountryLabel(item);
  searchQuery.value = countryLabel ? `${title}, ${countryLabel}` : title;
  showDropdown.value = false;
  emit('select-location', {
    lat: item.lat,
    lon: item.lon,
    label: countryLabel ? `${title}, ${countryLabel}` : title,
    fromSearch: true,
  });
}
</script>
