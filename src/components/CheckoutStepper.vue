<script setup>
const props = defineProps({
  pasoActual: { type: Number, default: 1 },
})

const pasos = [
  { numero: 1, etiqueta: 'Vuelos' },
  { numero: 2, etiqueta: 'Pasajeros' },
  { numero: 3, etiqueta: 'Asientos' },
  { numero: 4, etiqueta: 'Equipaje' },
  { numero: 5, etiqueta: 'Pago' },
  { numero: 6, etiqueta: 'Confirmacion' },
]

function estadoPaso(numero) {
  if (numero < props.pasoActual) return 'completado'
  if (numero === props.pasoActual) return 'actual'
  return 'pendiente'
}
</script>

<template>
  <section class="bg-gradient-to-r from-[#d71920] via-[#c5161d] to-[#8f1116] text-white shadow-lg shadow-red-100">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">Reserva NachoFlights</p>
          <h2 class="mt-1 text-2xl font-extrabold">Tu viaje va tomando forma</h2>
        </div>
        <p class="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white/85">
          Paso {{ pasoActual }} de {{ pasos.length }}
        </p>
      </div>

      <div class="mb-6 h-2 overflow-hidden rounded-full bg-white/18">
        <div
          class="h-full rounded-full bg-white transition-all duration-500"
          :style="{ width: `${((pasoActual - 1) / (pasos.length - 1)) * 100}%` }"
        />
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <template v-for="paso in pasos" :key="paso.numero">
          <div
            :class="[
              'rounded-[22px] border px-3 py-3 transition-all',
              estadoPaso(paso.numero) === 'actual'
                ? 'border-white bg-white text-[#d71920] shadow-xl shadow-red-950/10'
                : estadoPaso(paso.numero) === 'completado'
                  ? 'border-white/35 bg-white/16 text-white'
                  : 'border-white/12 bg-white/8 text-white/65',
            ]"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-extrabold transition-colors"
                :class="{
                  'border-white bg-white text-[#d71920]': estadoPaso(paso.numero) === 'completado',
                  'border-[#d71920] bg-[#d71920] text-white': estadoPaso(paso.numero) === 'actual',
                  'border-white/20 bg-white/10 text-white/70': estadoPaso(paso.numero) === 'pendiente',
                }"
              >
                <svg
                  v-if="estadoPaso(paso.numero) === 'completado'"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" d="M5 13l4 4L19 7" />
                </svg>
                <span v-else>{{ paso.numero }}</span>
              </div>

              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                  {{ estadoPaso(paso.numero) === 'actual' ? 'Ahora' : estadoPaso(paso.numero) === 'completado' ? 'Listo' : 'Luego' }}
                </p>
                <p class="mt-0.5 text-sm font-extrabold">{{ paso.etiqueta }}</p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
