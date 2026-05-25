<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import { useReservaStore } from '@/stores/reserva.store'

const router = useRouter()
const reserva = useReservaStore()

const COSTO_BODEGA = 45
const equipajeLocal = ref([])

const vuelo = computed(() => reserva.vuelo)
const pasajeros = computed(() => reserva.pasajeros || [])
const asientos = computed(() => reserva.asientos || [])
const asientosRegreso = computed(() => reserva.asientosRegreso || [])
const esComboIdaVuelta = computed(() => reserva.esIdaYVuelta)

function moneda(valor) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(valor || 0))
}

function nombrePasajero(pasajero, indice) {
  return [pasajero?.nombre_pasajero, pasajero?.apellido_pasajero].filter(Boolean).join(' ') || `Pasajero ${indice + 1}`
}

const itemsEquipaje = computed(() =>
  pasajeros.value.map((pasajero, indice) => {
    const guardado = equipajeLocal.value[indice] || null
    const aIda = asientos.value[indice] || null
    const aReg = esComboIdaVuelta.value ? asientosRegreso.value[indice] || null : null

    return {
      pasajeroIndex: indice,
      nombre: nombrePasajero(pasajero, indice),
      numeroAsientoIda: aIda?.numeroAsiento || 'Pendiente',
      numeroAsientoRegreso: aReg?.numeroAsiento || '',
      equipajeMano: true,
      equipajeBodegaIda: Boolean(guardado?.equipajeBodegaIda),
      equipajeBodegaRegreso: Boolean(guardado?.equipajeBodegaRegreso),
      pesoManoKg: 10,
    }
  }),
)

const totalExtra = computed(() =>
  itemsEquipaje.value.reduce(
    (total, item) =>
      total +
      (item.equipajeBodegaIda ? COSTO_BODEGA : 0) +
      (esComboIdaVuelta.value && item.equipajeBodegaRegreso ? COSTO_BODEGA : 0),
    0,
  ),
)

function sincronizarStore() {
  const detalleIda = pasajeros.value.map((pasajero, indice) => {
    const a = asientos.value[indice]
    const local = equipajeLocal.value[indice] || {}
    return {
      pasajeroIndex: indice,
      nombre: nombrePasajero(pasajero, indice),
      idAsiento: a?.idAsiento || null,
      numeroAsiento: a?.numeroAsiento || 'Pendiente',
      equipajeMano: true,
      equipajeBodega: Boolean(local.equipajeBodegaIda),
      pesoManoKg: 10,
      pesoBodegaKg: local.equipajeBodegaIda ? 23 : null,
    }
  })

  reserva.setEquipaje(detalleIda)

  const detalleRegreso = pasajeros.value.map((pasajero, indice) => {
    const a = asientosRegreso.value[indice]
    const local = equipajeLocal.value[indice] || {}
    return {
      pasajeroIndex: indice,
      nombre: nombrePasajero(pasajero, indice),
      idAsiento: a?.idAsiento || null,
      numeroAsiento: a?.numeroAsiento || 'Pendiente',
      equipajeMano: true,
      equipajeBodega: Boolean(local.equipajeBodegaRegreso),
      pesoManoKg: 10,
      pesoBodegaKg: local.equipajeBodegaRegreso ? 23 : null,
    }
  })

  reserva.setEquipajeRegreso(esComboIdaVuelta.value ? detalleRegreso : [])
}

function inicializarEquipaje() {
  equipajeLocal.value = pasajeros.value.map((_, indice) => ({
    pasajeroIndex: indice,
    equipajeBodegaIda: Boolean(reserva.equipaje?.[indice]?.equipajeBodega),
    equipajeBodegaRegreso: Boolean(reserva.equipajeRegreso?.[indice]?.equipajeBodega),
  }))
  sincronizarStore()
}

function setBodega(indice, tramo, valor) {
  const actual = equipajeLocal.value[indice] || { pasajeroIndex: indice }
  equipajeLocal.value[indice] = {
    pasajeroIndex: indice,
    equipajeBodegaIda: tramo === 'ida' ? valor : Boolean(actual.equipajeBodegaIda),
    equipajeBodegaRegreso:
      tramo === 'regreso' ? valor : Boolean(actual.equipajeBodegaRegreso),
  }
  sincronizarStore()
}

function continuarPago() {
  sincronizarStore()
  router.push({ name: 'pago-reserva' })
}

onMounted(() => {
  if (!vuelo.value) {
    router.replace({ name: 'buscar-vuelos' })
    return
  }

  if (!pasajeros.value.length) {
    router.replace({ name: 'datos-pasajeros' })
    return
  }

  const idaLista = pasajeros.value.every((_, i) => Boolean(asientos.value[i]?.idAsiento))

  const regresoLista =
    !esComboIdaVuelta.value ||
    pasajeros.value.every((_, i) => Boolean(asientosRegreso.value[i]?.idAsiento))

  if (!idaLista || !regresoLista) {
    router.replace({ name: 'seleccion-asientos' })
    return
  }

  inicializarEquipaje()
})
</script>

<template>
  <div>
    <CheckoutStepper :paso-actual="4" />

    <section class="min-h-[calc(100vh-64px)] bg-background py-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid gap-8 lg:grid-cols-[1.35fr_0.8fr]">
          <div class="space-y-6">
            <div class="overflow-hidden rounded-[32px] bg-white shadow-sm">
              <div class="bg-gradient-to-r from-[#d71920] to-[#9f1117] px-8 py-7 text-white">
                <p class="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Paso 4</p>
                <h1 class="mt-3 text-3xl font-extrabold">Equipaje a la ecuatoriana</h1>
              </div>
              <p class="px-8 py-5 text-text-muted">
                NachoFlights permite agregar 1 equipaje de bodega extra por pasajero, con un peso maximo de 23 kg y un costo fijo de $45. Pilas con la maleta.
              </p>
            </div>

            <article
              v-for="item in itemsEquipaje"
              :key="item.pasajeroIndex"
              class="overflow-hidden rounded-[30px] border border-red-100 bg-white shadow-sm"
            >
              <div class="flex flex-col gap-2 border-b border-red-100 bg-red-50/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 class="text-2xl font-semibold text-navy">{{ item.nombre }}</h2>
                  <p class="mt-1 text-sm text-text-muted">
                    Asientos · Ida {{ item.numeroAsientoIda }}
                    <span v-if="esComboIdaVuelta">
                      · Vuelta {{ item.numeroAsientoRegreso || '—' }}</span>
                  </p>
                </div>
                <span class="rounded-full bg-white px-3 py-1 text-sm font-medium text-[#d71920]">
                  Pasajero {{ item.pasajeroIndex + 1 }}
                </span>
              </div>

              <div class="space-y-4 p-6 sm:p-8">
                <div class="flex flex-col gap-4 rounded-[24px] border border-red-100 bg-red-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-xl font-semibold text-navy">Equipaje de Mano</p>
                    <p class="mt-1 text-sm text-text-muted">Maximo 10kg por pasajero.</p>
                    <p class="mt-2 text-sm font-medium text-[#d71920]">Siempre incluido en tu tarifa</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm text-text-muted">Costo</p>
                    <p class="text-lg font-semibold text-[#d71920]">Incluido</p>
                  </div>
                </div>

                <div class="rounded-[24px] border border-red-100 bg-red-50/40 p-5">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-lg font-semibold text-navy">Bodega · Tramo ida</p>
                      <p class="mt-1 text-sm text-text-muted">Maleta hasta 23kg.</p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-text-muted">Costo</p>
                      <p class="text-2xl font-light text-navy">{{ moneda(COSTO_BODEGA) }}</p>
                    </div>
                  </div>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      class="rounded-2xl border px-4 py-3 font-semibold transition-colors"
                      :class="
                        !item.equipajeBodegaIda
                          ? 'border-[#111827] bg-[#111827] text-white'
                          : 'border-slate-200 bg-slate-50 text-navy hover:bg-slate-100'
                      "
                      @click="setBodega(item.pasajeroIndex, 'ida', false)"
                    >
                      Ida · sin maleta extra
                    </button>
                    <button
                      type="button"
                      class="rounded-2xl border px-4 py-3 font-semibold transition-colors"
                      :class="
                        item.equipajeBodegaIda
                          ? 'border-gold bg-gold text-white'
                          : 'border-slate-200 bg-slate-50 text-navy hover:bg-slate-100'
                      "
                      @click="setBodega(item.pasajeroIndex, 'ida', true)"
                    >
                      Ida · maleta · {{ moneda(COSTO_BODEGA) }}
                    </button>
                  </div>
                </div>

                <div
                  v-if="esComboIdaVuelta"
                  class="rounded-[24px] border border-red-100 bg-red-50/40 p-5"
                >
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-lg font-semibold text-navy">Bodega · Tramo vuelta</p>
                      <p class="mt-1 text-sm text-text-muted">Maleta hasta 23kg por el regreso.</p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-text-muted">Costo</p>
                      <p class="text-2xl font-light text-navy">{{ moneda(COSTO_BODEGA) }}</p>
                    </div>
                  </div>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      class="rounded-2xl border px-4 py-3 font-semibold transition-colors"
                      :class="
                        !item.equipajeBodegaRegreso
                          ? 'border-[#111827] bg-[#111827] text-white'
                          : 'border-slate-200 bg-slate-50 text-navy hover:bg-slate-100'
                      "
                      @click="setBodega(item.pasajeroIndex, 'regreso', false)"
                    >
                      Vuelta · sin maleta extra
                    </button>
                    <button
                      type="button"
                      class="rounded-2xl border px-4 py-3 font-semibold transition-colors"
                      :class="
                        item.equipajeBodegaRegreso
                          ? 'border-gold bg-gold text-white'
                          : 'border-slate-200 bg-slate-50 text-navy hover:bg-slate-100'
                      "
                      @click="setBodega(item.pasajeroIndex, 'regreso', true)"
                    >
                      Vuelta · maleta · {{ moneda(COSTO_BODEGA) }}
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <section class="rounded-[28px] border border-red-100 bg-red-50/60 p-6">
              <h2 class="text-xl font-semibold text-[#d71920]">Informacion de Equipaje</h2>
              <div class="mt-4 space-y-2 text-sm text-[#d71920]">
                <p>- El equipaje de mano (10kg) esta siempre incluido.</p>
                <p>- El equipaje de bodega (23kg) tiene un costo adicional de {{ moneda(COSTO_BODEGA) }}.</p>
                <p>- Solo se permite 1 maleta de bodega extra por pasajero.</p>
                <p>- Si no deseas agregar equipaje, puedes continuar sin problema.</p>
              </div>
            </section>
          </div>

          <aside class="lg:sticky lg:top-24 lg:self-start">
            <div class="rounded-[30px] border border-red-100 bg-white p-8 shadow-sm">
              <h2 class="text-2xl font-bold text-navy">Resumen de Equipaje</h2>
              <div class="mt-6 space-y-4 text-text-muted">
                <div class="flex items-center justify-between">
                  <span>Equipaje de mano (10kg)</span>
                  <span class="font-semibold text-[#d71920]">Incluido</span>
                </div>

                <div
                  v-for="item in itemsEquipaje"
                  :key="`resumen-${item.pasajeroIndex}`"
                  class="space-y-2 border-t border-slate-100 pt-4"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="font-medium text-navy">{{ item.nombre }}</div>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-text-muted">Ida</span>
                    <span class="font-semibold text-navy">{{ item.equipajeBodegaIda ? moneda(COSTO_BODEGA) : moneda(0) }}</span>
                  </div>
                  <div v-if="esComboIdaVuelta" class="flex items-center justify-between text-sm">
                    <span class="text-text-muted">Vuelta</span>
                    <span class="font-semibold text-navy">{{
                      item.equipajeBodegaRegreso ? moneda(COSTO_BODEGA) : moneda(0)
                    }}</span>
                  </div>
                </div>
              </div>

              <div class="mt-6 border-t border-slate-200 pt-6">
                <div class="flex items-center justify-between">
                  <span class="text-2xl font-semibold text-navy">Costo adicional</span>
                  <span class="text-4xl font-extrabold text-[#d71920]">{{ moneda(totalExtra) }}</span>
                </div>
              </div>

              <button
                type="button"
                class="mt-8 w-full rounded-2xl bg-gold px-6 py-4 font-semibold text-white transition-colors hover:bg-gold-light"
                @click="continuarPago"
              >
                Continuar
              </button>

              <button
                type="button"
                class="mt-4 w-full rounded-2xl border border-slate-300 px-6 py-4 font-semibold text-navy transition-colors hover:bg-slate-50"
                @click="router.push({ name: 'seleccion-asientos' })"
              >
                Volver
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  </div>
</template>
