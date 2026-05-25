<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAsientosVueloBookingApi } from '@/api/vuelos.api'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import { useReservaStore } from '@/stores/reserva.store'
import { deepValue, extractItems } from '@/utils/portalCliente'

const router = useRouter()
const reserva = useReservaStore()

const columnas = ['A', 'B', 'C', 'D', 'E', 'F']
const filasBase = Array.from({ length: 28 }, (_, index) => index + 1)

const cargando = ref(false)
const errorGeneral = ref('')
const asientosApi = ref([])
const pasajeroActivo = ref(0)
const esIdaYVuelta = computed(() => reserva.esIdaYVuelta)
const tramoActual = ref('ida')
const seleccionIda = ref([])
const seleccionRegreso = ref([])

const vuelo = computed(() => reserva.vuelo)
const vueloRegreso = computed(() => reserva.vueloRegreso)
const pasajeros = computed(() => reserva.pasajeros || [])

function seleccionActivaRef() {
  return tramoActual.value === 'ida' ? seleccionIda : seleccionRegreso
}

function tramoTieneTodosAsientos(sel) {
  const arr = sel || []
  return pasajeros.value.length > 0 && pasajeros.value.every((_, i) => Boolean(arr[i]?.idAsiento))
}

const vueloActivo = computed(() =>
  esIdaYVuelta.value && tramoActual.value === 'vuelta' ? vueloRegreso.value : vuelo.value,
)

function moneda(valor) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(valor || 0))
}

function fechaLegible(valor) {
  if (!valor) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(valor))
}

function obtenerCampo(obj, claves, fallback = null) {
  for (const clave of claves) {
    if (obj?.[clave] !== undefined && obj?.[clave] !== null) return obj[clave]
  }
  return deepValue(obj, claves) ?? fallback
}

function toBool(valor, fallback = false) {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'number') return valor === 1
  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase()
    if (['true', '1', 'si', 'sí', 'activo', 'activa', 'disponible', 'libre'].includes(normalizado)) return true
    if (['false', '0', 'no', 'bloqueado', 'reservado', 'ocupado', 'inactivo', 'inactiva'].includes(normalizado)) return false
  }
  return fallback
}

function normalizarDisponibilidad(asiento) {
  const disponible = obtenerCampo(asiento, ['disponible', 'available', 'isAvailable', 'activo'])
  if (disponible !== null) return toBool(disponible)

  const estado = String(obtenerCampo(asiento, ['estado', 'estadoAsiento', 'estado_asiento'], 'ACTIVO'))
    .trim()
    .toUpperCase()

  return ['ACTIVO', 'DISPONIBLE', 'LIBRE'].includes(estado)
}

function descomponerAsiento(numeroAsiento) {
  const valor = String(numeroAsiento || '').trim().toUpperCase()
  const formatoLetraNumero = valor.match(/^([A-F])(\d{1,2})$/)
  if (formatoLetraNumero) {
    return {
      columna: formatoLetraNumero[1],
      fila: Number(formatoLetraNumero[2]),
    }
  }

  const formatoNumeroLetra = valor.match(/^(\d{1,2})([A-F])$/)
  if (formatoNumeroLetra) {
    return {
      fila: Number(formatoNumeroLetra[1]),
      columna: formatoNumeroLetra[2],
    }
  }

  return null
}

function normalizarAsiento(asiento) {
  const numeroAsiento = obtenerCampo(asiento, ['numeroAsiento', 'numero_asiento'], '')
  const posicion = descomponerAsiento(numeroAsiento)

  return {
    idAsiento: obtenerCampo(asiento, ['idAsiento', 'id_asiento', 'id']),
    numeroAsiento,
    disponible: normalizarDisponibilidad(asiento),
    clase: obtenerCampo(asiento, ['clase'], 'ECONOMICA'),
    posicion: obtenerCampo(asiento, ['posicion'], ''),
    precioExtra: Number(obtenerCampo(asiento, ['precioExtra', 'precio_extra'], 0)),
    fila: posicion?.fila ?? null,
    columna: posicion?.columna ?? null,
  }
}

const mapaAsientos = computed(() => {
  const mapa = new Map()
  asientosApi.value.forEach((asiento) => {
    if (!asiento.fila || !asiento.columna) return
    mapa.set(`${asiento.fila}-${asiento.columna}`, asiento)
  })
  return mapa
})

const filasVisibles = computed(() => {
  const filasConAsientos = asientosApi.value.map((asiento) => asiento.fila).filter(Boolean)
  if (!filasConAsientos.length) return filasBase

  const maxFila = Math.max(...filasConAsientos)
  return Array.from({ length: maxFila }, (_, index) => index + 1)
})

const pasajerosConSeleccion = computed(() =>
  pasajeros.value.map((pasajero, indice) => ({
    indice,
    nombre: [pasajero.nombre_pasajero, pasajero.apellido_pasajero].filter(Boolean).join(' ') || `Pasajero ${indice + 1}`,
    asiento: seleccionActivaRef().value[indice] || null,
    asientoIda: seleccionIda.value[indice] || null,
    asientoRegreso: esIdaYVuelta.value ? seleccionRegreso.value[indice] || null : null,
  })),
)

const pasajeroActivoData = computed(() => pasajerosConSeleccion.value[pasajeroActivo.value] || null)

const pasajerosCompletos = computed(() => {
  if (!pasajeros.value.length) return false
  if (!tramoTieneTodosAsientos(seleccionIda.value)) return false
  if (esIdaYVuelta.value && !tramoTieneTodosAsientos(seleccionRegreso.value)) return false
  return true
})

const asientosSeleccionadosIds = computed(() =>
  seleccionActivaRef().value.map((item) => item?.idAsiento).filter(Boolean),
)

const resumenAsientos = computed(() => {
  const disponibles = asientosApi.value.filter((asiento) => asiento.disponible).length
  const total = asientosApi.value.length

  return {
    total,
    disponibles,
    ocupados: Math.max(total - disponibles, 0),
    seleccionados: asientosSeleccionadosIds.value.length,
  }
})

const recargoAsientos = computed(() => {
  const sumExtras = (arr) => (arr || []).reduce((t, a) => t + Number(a?.precioExtra || 0), 0)
  return sumExtras(seleccionIda.value) + (esIdaYVuelta.value ? sumExtras(seleccionRegreso.value) : 0)
})

const totalConAsientos = computed(() => Number(reserva.total || 0))

function asientoPorPosicion(fila, columna) {
  return mapaAsientos.value.get(`${fila}-${columna}`) || null
}

function claseLegible(clase) {
  if (clase === 'PRIMERA') return 'Primera'
  if (clase === 'EJECUTIVA') return 'Ejecutiva'
  return 'Economica'
}

function posicionLegible(posicion) {
  if (posicion === 'VENTANA') return 'Ventana'
  if (posicion === 'PASILLO') return 'Pasillo'
  if (posicion === 'CENTRO') return 'Centro'
  return posicion || '-'
}

function estadoAsiento(asiento, fila, columna) {
  if (!asiento) return 'ocupado'

  const activa = seleccionActivaRef().value

  const seleccionadoActual = activa[pasajeroActivo.value]?.idAsiento === asiento.idAsiento
  if (seleccionadoActual) return 'seleccionado'

  const seleccionadoPorOtro = asientosSeleccionadosIds.value.includes(asiento.idAsiento)
  if (seleccionadoPorOtro) return 'bloqueado'

  if (!asiento.disponible) return 'ocupado'

  return 'disponible'
}

function persistirSeleccionesEnTienda() {
  const padIda = () => pasajeros.value.map((_, i) => seleccionIda.value[i] ?? null)
  const padRet = () => pasajeros.value.map((_, i) => seleccionRegreso.value[i] ?? null)
  reserva.setAsientos(padIda())
  if (esIdaYVuelta.value) reserva.setAsientosRegreso(padRet())
  else reserva.setAsientosRegreso([])
}

async function cambiarTramoAsientos(siguiente) {
  if (siguiente === tramoActual.value) return
  tramoActual.value = siguiente
  const bucket = seleccionActivaRef()
  pasajeroActivo.value = Math.max(bucket.value.findIndex((item) => !item?.idAsiento), 0)
  await cargarAsientos()
}

function seleccionarAsiento(asiento) {
  if (!asiento || !asiento.disponible) return

  const bucket = seleccionActivaRef()
  const lista = bucket.value

  const yaTomadoPorOtro = lista.some(
    (seleccion, indice) => indice !== pasajeroActivo.value && seleccion?.idAsiento === asiento.idAsiento,
  )
  if (yaTomadoPorOtro) return

  lista[pasajeroActivo.value] = {
    idAsiento: asiento.idAsiento,
    numeroAsiento: asiento.numeroAsiento,
    precioExtra: asiento.precioExtra,
    clase: asiento.clase,
    posicion: asiento.posicion,
    fila: asiento.fila,
    columna: asiento.columna,
    pasajeroIndex: pasajeroActivo.value,
  }

  persistirSeleccionesEnTienda()

  const siguientePendiente = lista.findIndex((item) => !item?.idAsiento)
  if (siguientePendiente !== -1) {
    pasajeroActivo.value = siguientePendiente
    return
  }

  if (
    esIdaYVuelta.value &&
    tramoActual.value === 'ida' &&
    tramoTieneTodosAsientos(seleccionIda.value) &&
    !tramoTieneTodosAsientos(seleccionRegreso.value)
  ) {
    void cambiarTramoAsientos('vuelta')
  }
}

async function cargarAsientos() {
  const activo = vueloActivo.value
  if (!activo?.idVuelo) return

  cargando.value = true
  errorGeneral.value = ''
  try {
    const { data } = await getAsientosVueloBookingApi(activo.idVuelo)

    asientosApi.value = extractItems(data)
      .map(normalizarAsiento)
      .sort((a, b) => (a.fila || 0) - (b.fila || 0) || String(a.columna || '').localeCompare(String(b.columna || '')))
  } catch (error) {
    errorGeneral.value = error.response?.data?.message || 'No se pudieron cargar los asientos del vuelo.'
  } finally {
    cargando.value = false
  }
}

function continuarEquipaje() {
  if (!pasajerosCompletos.value) return
  persistirSeleccionesEnTienda()
  router.push({ name: 'equipaje' })
}

onMounted(async () => {
  if (!vuelo.value) {
    router.replace({ name: 'buscar-vuelos' })
    return
  }

  if (esIdaYVuelta.value && !vueloRegreso.value?.idVuelo) {
    router.replace({ name: 'buscar-vuelos' })
    return
  }

  if (!pasajeros.value.length) {
    router.replace({ name: 'datos-pasajeros' })
    return
  }

  seleccionIda.value = pasajeros.value.map((_, indice) => reserva.asientos[indice] || null)
  seleccionRegreso.value = pasajeros.value.map((_, indice) => reserva.asientosRegreso?.[indice] || null)

  if (
    esIdaYVuelta.value &&
    tramoTieneTodosAsientos(seleccionIda.value) &&
    !tramoTieneTodosAsientos(seleccionRegreso.value)
  ) {
    tramoActual.value = 'vuelta'
  }

  persistirSeleccionesEnTienda()

  const listaActiva = seleccionActivaRef().value
  pasajeroActivo.value = Math.max(listaActiva.findIndex((item) => !item?.idAsiento), 0)

  await cargarAsientos()
})
</script>

<template>
  <div>
    <CheckoutStepper :paso-actual="3" />

    <section class="min-h-[calc(100vh-64px)] bg-background py-10">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div v-if="!vuelo" class="rounded-[28px] bg-white p-10 text-center shadow-sm">
          <p class="text-lg font-semibold text-navy">Primero selecciona un vuelo.</p>
          <button
            type="button"
            class="mt-6 rounded-2xl bg-gold px-6 py-3 font-semibold text-navy"
            @click="router.push({ name: 'buscar-vuelos' })"
          >
            Ir a vuelos
          </button>
        </div>

        <div v-else class="grid gap-8 lg:grid-cols-[1.35fr_0.8fr]">
          <div class="overflow-hidden rounded-[30px] bg-white shadow-sm">
            <div class="bg-gradient-to-r from-[#d71920] to-[#9f1117] px-8 py-7 text-white">
              <p class="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Paso 3</p>
              <h1 class="mt-3 text-3xl font-extrabold">Seleccion de asientos</h1>
              <p class="mt-4 text-white/82">
                Escoge el puesto de cada pasajero. Ponte pilas: los ocupados no se pueden elegir.
              </p>
            </div>

            <div
              v-if="esIdaYVuelta"
              class="flex flex-wrap gap-2 border-b border-red-50 bg-red-50/30 px-8 py-4"
            >
              <button
                type="button"
                class="rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors"
                :class="
                  tramoActual === 'ida'
                    ? 'border-[#d71920] bg-red-50 text-[#d71920]'
                    : 'border-red-100 bg-white text-navy hover:bg-red-50/50'
                "
                @click="cambiarTramoAsientos('ida')"
              >
                Ida · {{ vuelo?.numeroVuelo }}
              </button>
              <button
                type="button"
                class="rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors"
                :class="
                  tramoActual === 'vuelta'
                    ? 'border-[#d71920] bg-red-50 text-[#d71920]'
                    : 'border-red-100 bg-white text-navy hover:bg-red-50/50'
                "
                @click="cambiarTramoAsientos('vuelta')"
              >
                Vuelta · {{ vueloRegreso?.numeroVuelo }}
              </button>
            </div>

            <div class="flex flex-wrap gap-3 px-8 py-6">
              <button
                v-for="pasajero in pasajerosConSeleccion"
                :key="pasajero.indice"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left transition-colors"
                :class="
                  pasajeroActivo === pasajero.indice
                    ? 'border-[#d71920] bg-red-50 text-[#d71920]'
                    : (esIdaYVuelta ? pasajero.asientoIda?.idAsiento && pasajero.asientoRegreso?.idAsiento : pasajero.asiento?.idAsiento)
                      ? 'border-[#111827] bg-slate-50'
                      : 'border-red-100 bg-white'
                "
                @click="pasajeroActivo = pasajero.indice"
              >
                <p class="font-semibold text-navy">{{ pasajero.nombre }}</p>
                <p v-if="esIdaYVuelta" class="mt-1 text-sm text-text-muted">
                  Ida {{ pasajero.asientoIda?.numeroAsiento || '-' }} · Vuelta
                  {{ pasajero.asientoRegreso?.numeroAsiento || '-' }}
                  <span v-if="pasajero.asiento?.numeroAsiento" class="block text-[11px] text-[#d71920]">
                    (editando {{ tramoActual === 'ida' ? 'ida' : 'vuelta' }})
                  </span>
                </p>
                <p v-else class="mt-1 text-sm text-text-muted">
                  {{ pasajero.asiento?.numeroAsiento || 'Sin asiento seleccionado' }}
                </p>
              </button>
            </div>

            <div class="mx-6 mb-8 overflow-hidden rounded-[28px] border border-red-100 bg-gradient-to-b from-white to-red-50/40 p-6 sm:mx-8">
              <div class="grid gap-3 text-sm text-navy sm:grid-cols-4">
                <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p class="text-xs uppercase tracking-[0.16em] text-text-muted">Total</p>
                  <p class="mt-1 text-2xl font-semibold text-navy">{{ resumenAsientos.total }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p class="text-xs uppercase tracking-[0.16em] text-text-muted">Disponibles</p>
                  <p class="mt-1 text-2xl font-semibold text-emerald-600">{{ resumenAsientos.disponibles }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p class="text-xs uppercase tracking-[0.16em] text-text-muted">Ocupados</p>
                  <p class="mt-1 text-2xl font-semibold text-slate-500">{{ resumenAsientos.ocupados }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p class="text-xs uppercase tracking-[0.16em] text-text-muted">Seleccionados</p>
                  <p class="mt-1 text-2xl font-semibold text-[#d71920]">{{ resumenAsientos.seleccionados }}</p>
                </div>
              </div>

              <div class="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm text-navy">
                <div class="flex items-center gap-2">
                  <span class="h-6 w-6 rounded-lg border border-emerald-200 bg-emerald-50" />
                  <span>Disponible</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="h-6 w-6 rounded-lg bg-[#d71920]" />
                  <span>Seleccionado</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="h-6 w-6 rounded-lg bg-slate-200" />
                  <span>Ocupado</span>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted">
                <span class="rounded-full bg-slate-100 px-3 py-1">Filas 1-4: Primera +$80</span>
                <span class="rounded-full bg-slate-100 px-3 py-1">Filas 5-10: Ejecutiva +$40</span>
                <span class="rounded-full bg-slate-100 px-3 py-1">Filas 11-28: Economica +$0</span>
              </div>

              <div class="mt-8 flex justify-center">
                <div class="rounded-t-[48px] bg-[#d71920] px-10 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-red-200">
                  Cabina {{ tramoActual === 'vuelta' ? 'vuelta' : 'ida' }} · {{ vueloActivo?.numeroVuelo }}
                </div>
              </div>

              <div v-if="cargando" class="py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-accent/20 border-t-blue-accent" />
                <p class="mt-4 text-text-muted">Cargando asientos...</p>
              </div>

              <div v-else-if="errorGeneral" class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                {{ errorGeneral }}
              </div>

              <div v-else class="mt-8 overflow-x-auto">
                <div class="mx-auto min-w-[430px] max-w-[560px] rounded-b-[52px] border-x-8 border-b-8 border-slate-200 bg-white px-5 pb-8 pt-4 shadow-inner">
                  <div class="mb-3 grid grid-cols-[32px_repeat(3,40px)_28px_repeat(3,40px)] items-center gap-3 text-center text-xs font-semibold text-text-muted">
                    <span />
                    <span v-for="columna in columnas" :key="`cabecera-${columna}`" :class="{ 'col-start-6': columna === 'D' }">
                      {{ columna }}
                    </span>
                  </div>
                  <div
                    v-for="fila in filasVisibles"
                    :key="fila"
                    class="grid grid-cols-[32px_repeat(3,40px)_28px_repeat(3,40px)] items-center gap-3 py-1"
                  >
                    <span class="text-right text-sm text-text-muted">{{ fila }}</span>

                    <template v-for="columna in columnas" :key="`${fila}-${columna}`">
                      <div v-if="columna === 'D'" class="w-4" />
                      <button
                        type="button"
                        :title="
                          estadoAsiento(asientoPorPosicion(fila, columna), fila, columna) === 'ocupado'
                            ? 'Asiento no disponible'
                            : `${fila}${columna}`
                        "
                        class="group relative flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition"
                        :class="{
                          'cursor-pointer border-emerald-200 bg-emerald-50 text-navy hover:bg-emerald-100': estadoAsiento(asientoPorPosicion(fila, columna), fila, columna) === 'disponible',
                          'cursor-pointer border-[#d71920] bg-[#d71920] text-white shadow-md shadow-red-200': estadoAsiento(asientoPorPosicion(fila, columna), fila, columna) === 'seleccionado',
                          'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400': ['ocupado', 'bloqueado'].includes(estadoAsiento(asientoPorPosicion(fila, columna), fila, columna)),
                        }"
                        @click="seleccionarAsiento(asientoPorPosicion(fila, columna))"
                      >
                        <span
                          v-if="estadoAsiento(asientoPorPosicion(fila, columna), fila, columna) === 'seleccionado'"
                          class="text-base"
                        >
                          ✓
                        </span>
                        <span v-else>{{ columna }}</span>
                        <span
                          v-if="['ocupado', 'bloqueado'].includes(estadoAsiento(asientoPorPosicion(fila, columna), fila, columna))"
                          class="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-md bg-slate-300/85 text-base text-slate-500 group-hover:flex"
                        >
                          ⃠
                        </span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>

              <div class="mt-8 border-t border-slate-200 pt-6">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p class="text-sm text-text-muted">Asiento seleccionado para {{ pasajeroActivoData?.nombre }}</p>
                    <p class="mt-2 text-3xl font-light text-navy">
                      {{ pasajeroActivoData?.asiento?.numeroAsiento || '--' }}
                    </p>
                    <div v-if="pasajeroActivoData?.asiento" class="mt-2 space-y-1 text-sm text-text-muted">
                      <p>Clase: {{ claseLegible(pasajeroActivoData.asiento.clase) }}</p>
                      <p>Posicion: {{ posicionLegible(pasajeroActivoData.asiento.posicion) }}</p>
                      <p>Recargo: {{ moneda(pasajeroActivoData.asiento.precioExtra || 0) }}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d71920] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-200/60 transition-colors hover:bg-[#b9151b] hover:shadow-red-200 disabled:cursor-not-allowed disabled:bg-[#d71920]/35 disabled:shadow-none"
                    :disabled="!pasajerosCompletos"
                    @click="continuarEquipaje"
                  >
                    <span>Continuar</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside class="rounded-[30px] border border-red-100 bg-white p-8 shadow-sm">
            <h2 class="text-2xl font-bold text-navy">Resumen del vuelo</h2>

            <div v-if="esIdaYVuelta" class="mt-6 space-y-4">
              <div class="rounded-2xl border border-red-100 bg-red-50/40 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-[#d71920]">Tramo · Ida</p>
                <div class="mt-3 space-y-2 text-sm text-text-muted">
                  <div class="flex items-center justify-between gap-2">
                    <span>Vuelo</span>
                    <span class="text-right font-semibold text-navy">{{ vuelo.numeroVuelo }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span>Fecha</span>
                    <span class="text-right font-semibold text-navy">{{ fechaLegible(vuelo.fechaHoraSalida) }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span>Tarifa base</span>
                    <span class="font-semibold text-navy">{{ moneda(vuelo.precioBase) }}</span>
                  </div>
                </div>
              </div>
              <div class="rounded-2xl border border-red-100 bg-red-50/40 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-[#d71920]">Tramo · Vuelta</p>
                <div class="mt-3 space-y-2 text-sm text-text-muted">
                  <div class="flex items-center justify-between gap-2">
                    <span>Vuelo</span>
                    <span class="text-right font-semibold text-navy">{{ vueloRegreso.numeroVuelo }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span>Fecha</span>
                    <span class="text-right font-semibold text-navy">{{ fechaLegible(vueloRegreso.fechaHoraSalida) }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span>Tarifa base</span>
                    <span class="font-semibold text-navy">{{ moneda(vueloRegreso.precioBase) }}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between text-sm text-text-muted">
                <span>Pasajeros</span>
                <span class="font-semibold text-navy">{{ pasajeros.length }}</span>
              </div>
            </div>

            <div v-else class="mt-6 space-y-4 text-text-muted">
              <div class="flex items-center justify-between">
                <span>Codigo</span>
                <span class="font-semibold text-navy">{{ vuelo.numeroVuelo }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Fecha</span>
                <span class="font-semibold text-navy">{{ fechaLegible(vuelo.fechaHoraSalida) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Pasajeros</span>
                <span class="font-semibold text-navy">{{ pasajeros.length }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Clase</span>
                <span class="font-semibold text-navy">{{ vuelo.clase }}</span>
              </div>
            </div>

            <div class="mt-6 border-t border-slate-200 pt-6">
              <div class="flex items-center justify-between">
                <span class="text-xl font-semibold text-navy">Tarifa base (todos los tramos)</span>
                <span class="text-3xl font-extrabold text-[#d71920]">
                  {{
                    moneda(
                      (Number(vuelo.precioBase || 0) + (esIdaYVuelta ? Number(vueloRegreso?.precioBase || 0) : 0)) *
                        pasajeros.length,
                    )
                  }}
                </span>
              </div>
            </div>

            <div class="mt-8 space-y-3">
              <div
                v-for="pasajero in pasajerosConSeleccion"
                :key="`seleccion-${pasajero.indice}`"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p class="font-semibold text-navy">{{ pasajero.nombre }}</p>
                <p v-if="esIdaYVuelta" class="mt-1 text-sm text-text-muted">
                  Ida {{ pasajero.asientoIda?.numeroAsiento || 'pendiente' }} · Vuelta
                  {{ pasajero.asientoRegreso?.numeroAsiento || 'pendiente' }}
                </p>
                <p v-else class="mt-1 text-sm text-text-muted">
                  {{ pasajero.asiento?.numeroAsiento || 'Pendiente de seleccionar' }}
                </p>
                <p v-if="!esIdaYVuelta && pasajero.asiento" class="mt-1 text-xs text-text-muted">
                  {{ claseLegible(pasajero.asiento.clase) }} · {{ moneda(pasajero.asiento.precioExtra || 0) }}
                </p>
                <div v-if="esIdaYVuelta" class="mt-2 space-y-1 text-xs text-text-muted">
                  <p v-if="pasajero.asientoIda?.idAsiento">
                    Ida — {{ claseLegible(pasajero.asientoIda.clase) }} · {{ moneda(pasajero.asientoIda.precioExtra || 0) }}
                  </p>
                  <p v-if="pasajero.asientoRegreso?.idAsiento">
                    Vuelta — {{ claseLegible(pasajero.asientoRegreso.clase) }} · {{ moneda(pasajero.asientoRegreso.precioExtra || 0) }}
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-6 border-t border-slate-200 pt-6 text-text-muted">
              <div class="flex items-center justify-between">
                <span>Recargo por asientos</span>
                <span class="font-semibold text-navy">{{ moneda(recargoAsientos) }}</span>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <span class="text-lg font-semibold text-navy">Total estimado</span>
                <span class="text-3xl font-light text-navy">{{ moneda(totalConAsientos) }}</span>
              </div>
            </div>

            <button
              type="button"
              class="mt-8 w-full rounded-2xl border border-slate-300 px-6 py-4 font-semibold text-navy transition-colors hover:bg-slate-50"
              @click="router.push({ name: 'datos-pasajeros' })"
            >
              Volver a pasajeros
            </button>
          </aside>
        </div>
      </div>
    </section>
  </div>
</template>
