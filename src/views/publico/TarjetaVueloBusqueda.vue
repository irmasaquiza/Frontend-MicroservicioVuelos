<script setup>
defineProps({
  vuelo: { type: Object, required: true },
  seleccionado: { type: Boolean, default: false },
  expandido: { type: Boolean, default: false },
  /** Texto del boton principal (ida / vuelta / reservar) */
  etiquetaAccion: { type: String, required: true },
  /** Si true, el click principal emite reservar (solo ida); si false, emite elegir */
  esReservaDirecta: { type: Boolean, default: false },
})

const emit = defineEmits(['elegir', 'reservar', 'toggle-detalles'])

function horaLegible(fecha) {
  if (!fecha) return '--:--'
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function duracionLegible(min) {
  if (min == null || Number.isNaN(Number(min))) return '-'
  const m = Number(min)
  const h = Math.floor(m / 60)
  const r = m % 60
  return h ? `${h} h ${r} min` : `${r} min`
}

function moneda(val) {
  if (val == null || val === '') return '-'
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(val))
}
</script>

<template>
  <article
    class="overflow-hidden rounded-[28px] border bg-white shadow-sm shadow-red-100/50 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-100"
    :class="
      seleccionado
        ? 'border-[#d71920] ring-4 ring-[#d71920]/20 shadow-red-100/80'
        : 'border-red-100'
    "
  >
    <div class="grid gap-5 border-l-8 border-[#d71920] px-6 py-5 lg:grid-cols-[240px_1fr_210px] lg:items-center">
      <div class="space-y-6">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d71920] text-white">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 16l20-5-8 8-2.5-5.5L6 11l-4-1 20-5-5 20-3.5-7L2 16z" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-lg font-semibold leading-tight text-[#1f1f1f]">NachoFlights</p>
            <p class="mt-1 text-sm text-text-muted">{{ vuelo.numeroVuelo }} - {{ vuelo.aeronave }}</p>
          </div>
        </div>

        <div>
          <p class="text-[2.15rem] font-light leading-none text-[#1f1f1f]">{{ horaLegible(vuelo.fechaHoraSalida) }}</p>
          <p class="mt-3 text-[1.3rem] font-semibold leading-none text-[#d71920]">{{ vuelo.codigoOrigen }}</p>
          <p class="mt-2 text-sm text-text-muted">{{ vuelo.ciudadOrigen }}</p>
        </div>
      </div>

      <div class="grid items-center gap-4 md:grid-cols-[1fr_120px]">
        <div class="text-center">
          <p class="text-sm text-text-muted">{{ duracionLegible(vuelo.duracionMin) }}</p>
          <div class="mx-auto mt-4 flex max-w-[360px] items-center gap-3">
            <span class="h-px flex-1 bg-red-200" />
            <svg class="h-5 w-5 text-[#d71920]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 16l20-5-8 8-2.5-5.5L6 11l-4-1 20-5-5 20-3.5-7L2 16z" />
            </svg>
            <span class="h-px flex-1 bg-red-200" />
          </div>
          <p class="mt-4 text-sm font-medium text-emerald-600">
            {{ vuelo.escalas === 0 ? 'Directo' : `${vuelo.escalas} escalas` }}
          </p>
        </div>

        <div class="text-left md:text-right">
          <p class="text-[2.15rem] font-light leading-none text-[#1f1f1f]">{{ horaLegible(vuelo.fechaHoraLlegada) }}</p>
          <p class="mt-3 text-[1.3rem] font-semibold leading-none text-[#d71920]">{{ vuelo.codigoDestino }}</p>
          <p class="mt-2 text-sm text-text-muted">{{ vuelo.ciudadDestino }}</p>
        </div>
      </div>

      <div class="border-l border-red-100 pl-6">
        <p class="text-right text-sm text-text-muted">Desde</p>
        <p class="text-right text-[2.85rem] font-light leading-none text-[#d71920]">{{ moneda(vuelo.precioBase) }}</p>
        <p class="mt-2 text-right text-sm text-text-muted">por persona</p>
        <button
          type="button"
          class="mt-5 w-full rounded-2xl bg-[#d71920] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#b9151b]"
          @click="esReservaDirecta ? emit('reservar', vuelo) : emit('elegir', vuelo)"
        >
          {{ etiquetaAccion }}
        </button>
        <button
          type="button"
          class="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#d71920] transition-colors hover:text-[#8f1116]"
          @click="emit('toggle-detalles', vuelo.idVuelo)"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Ver detalles</span>
          <svg
            class="h-4 w-4 transition-transform"
            :class="{ 'rotate-180': expandido }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>

    <Transition name="expand">
      <div v-if="expandido" class="border-t border-red-100 bg-red-50/50 px-6 py-8 lg:px-8">
        <div class="grid gap-8 md:grid-cols-3">
          <div>
            <h3 class="text-2xl font-semibold text-navy">Servicios Incluidos</h3>
            <ul class="mt-4 space-y-3 text-text-muted">
              <li class="text-emerald-600">- Equipaje de mano (10kg)</li>
              <li class="text-amber-600">- Equipaje de bodega (opcional)</li>
              <li class="text-emerald-600">- Snack y bebida</li>
            </ul>
          </div>

          <div>
            <h3 class="text-2xl font-semibold text-navy">Informacion Adicional</h3>
            <div class="mt-4 space-y-3 text-text-muted">
              <p>Aeronave: {{ vuelo.aeronave }}</p>
            </div>
          </div>

          <div>
            <h3 class="text-2xl font-semibold text-navy">Politicas</h3>
            <div class="mt-4 space-y-3 text-text-muted">
              <p>Check-in: Online o aeropuerto</p>
              <p>3 horas antes en el aeropuerto</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </article>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.22s ease;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 360px;
  opacity: 1;
}
</style>
