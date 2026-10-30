<template>
  <div class="bg-[#111827] border border-slate-800 rounded-xl p-3.5 shadow-lg flex flex-wrap gap-3 justify-between items-center">
    <!-- Mode switch: Current Weather (Forecast Table) vs Wind Profile -->
    <div
      data-testid="mode-group"
      class="flex flex-wrap rounded-lg bg-slate-900 p-1 border border-slate-800 gap-0.5"
    >
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
        data-testid="tab-wind-profile"
        class="px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer"
        :class="mode === 'profile' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
        @click="$emit('update:mode', 'profile')"
      >
        🌪️ Профіль вітру
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  mode: { type: String, default: 'current' }, // 'current' | 'profile'
});

defineEmits(['update:mode']);
</script>
