<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-base">🗺️</span>
        <h3 class="text-sm font-semibold text-slate-200">
          Інтерактивна карта світу
        </h3>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-400">
          Клікніть по карті або перетягніть маркер для зміни точки
        </span>
        <button
          type="button"
          data-testid="close-map"
          class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs transition cursor-pointer"
          @click="$emit('close')"
        >
          ✕ Приховати
        </button>
      </div>
    </div>

    <!-- Map container -->
    <div
      ref="mapContainer"
      data-testid="leaflet-map-container"
      class="relative z-0 isolate w-full h-80 sm:h-96 md:h-[420px] rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900"
    ></div>

    <div class="flex justify-between items-center flex-wrap gap-2 text-[11px] text-slate-500 font-mono">
      <span>Координати маркера: {{ lat.toFixed(5) }}, {{ lon.toFixed(5) }}</span>
      <span>Джерело карт: OpenStreetMap</span>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import { normalizeMapCoordinates } from '../domain/coordinates.js';

const props = defineProps({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  visible: { type: Boolean, default: true },
});

const emit = defineEmits(['pick-coordinates', 'close']);

const mapContainer = ref(null);
let map = null;
let marker = null;
let invalidateTimer = null;

function initMap() {
  if (!mapContainer.value || map) return;

  try {
    map = L.map(mapContainer.value, {
      center: [props.lat, props.lon],
      zoom: 7,
      zoomControl: true,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Custom tactical marker icon
    const customIcon = L.divIcon({
      className: 'custom-tactical-pin',
      html: `<div style="background-color:#10b981;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px rgba(16,185,129,0.8);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    marker = L.marker([props.lat, props.lon], {
      draggable: true,
      icon: customIcon,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const norm = normalizeMapCoordinates(pos.lat, pos.lng);
      marker.setLatLng([norm.lat, norm.lon]);
      emit('pick-coordinates', norm);
    });

    map.on('click', (e) => {
      const norm = normalizeMapCoordinates(e.latlng.lat, e.latlng.lng);
      marker.setLatLng([norm.lat, norm.lon]);
      emit('pick-coordinates', norm);
    });
  } catch {
    // Graceful fallback for non-browser/test environments
  }
}

function refreshMapLayout() {
  if (!props.visible) return;
  nextTick(() => {
    initMap();
    if (map && marker) {
      map.invalidateSize();
      marker.setLatLng([props.lat, props.lon]);
      map.setView([props.lat, props.lon], map.getZoom(), { animate: false });
      clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 100);
    }
  });
}

watch(
  () => [props.lat, props.lon],
  ([newLat, newLon]) => {
    if (map && marker) {
      marker.setLatLng([newLat, newLon]);
      if (props.visible) {
        map.panTo([newLat, newLon]);
      }
    }
  }
);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      refreshMapLayout();
    }
  }
);

onMounted(() => {
  if (props.visible) {
    refreshMapLayout();
  }
});

onBeforeUnmount(() => {
  clearTimeout(invalidateTimer);
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
