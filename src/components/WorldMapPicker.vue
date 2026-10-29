<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-base">🗺️</span>
        <h3 class="text-sm font-semibold text-slate-200">
          Інтерактивна карта світу
        </h3>
      </div>
      <div class="text-xs text-slate-400">
        Клікніть по карті або перетягніть маркер для зміни точки
      </div>
    </div>

    <!-- Map container -->
    <div
      ref="mapContainer"
      data-testid="leaflet-map-container"
      class="w-full h-80 sm:h-96 md:h-[420px] rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900"
    ></div>

    <div class="flex justify-between items-center text-[11px] text-slate-500 font-mono">
      <span>Координати маркера: {{ lat.toFixed(5) }}, {{ lon.toFixed(5) }}</span>
      <span>Джерело карт: OpenStreetMap</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';

const props = defineProps({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  visible: { type: Boolean, default: true },
});

const emit = defineEmits(['pick-coordinates']);

const mapContainer = ref(null);
let map = null;
let marker = null;

function initMap() {
  if (!mapContainer.value || map) return;

  try {
    map = L.map(mapContainer.value, {
      center: [props.lat, props.lon],
      zoom: 7,
      zoomControl: true,
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
      emit('pick-coordinates', { lat: pos.lat, lon: pos.lng });
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      emit('pick-coordinates', { lat: e.latlng.lat, lon: e.latlng.lng });
    });
  } catch (err) {
    // Graceful fallback for non-browser/test environments
  }
}

watch(
  () => [props.lat, props.lon],
  ([newLat, newLon]) => {
    if (map && marker) {
      marker.setLatLng([newLat, newLon]);
      map.panTo([newLat, newLon]);
    }
  }
);

watch(
  () => props.visible,
  (val) => {
    if (val && map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }
);

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
