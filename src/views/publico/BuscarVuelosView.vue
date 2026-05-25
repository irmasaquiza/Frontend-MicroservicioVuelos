<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buscarVuelosBookingApi } from '@/api/vuelos.api'
import { useCatalogosStore } from '@/stores/catalogos.store'
import { useReservaStore } from '@/stores/reserva.store'
import { extractItems } from '@/utils/portalCliente'
import TarjetaVueloBusqueda from '@/views/publico/TarjetaVueloBusqueda.vue'

const route = useRoute()
const router = useRouter()
const catalogos = useCatalogosStore()
const reserva = useReservaStore()

const cargando = ref(false)
const cargandoDestacados = ref(false)
const errorGeneral = ref('')
const resultados = ref([])
const resultadosRegreso = ref([])
const destacados = ref([])
const vueloExpandido = ref(null)
const vueloExpandidoRegreso = ref(null)
/** SOLO_IDA · IDA_VUELTA — ida y vuelta: dos columnas y dos búsquedas */
const tipoViaje = ref(route.query.tipo || 'SOLO_IDA')

const seleccionIda = ref(null)
const seleccionRegreso = ref(null)
const form = ref({
  origen: route.query.origen || '',
  destino: route.query.destino || '',
  salida: route.query.salida || '',
  regreso: route.query.regreso || '',
  pasajeros: route.query.pasajeros || '1',
  clase: route.query.clase || 'ECONOMICA',
})

const opcionesAeropuertos = computed(() => catalogos.opcionesAeropuertos)
const puedeBuscar = computed(() => {
  if (!form.value.origen || !form.value.destino || !form.value.salida) return false
  if (tipoViaje.value === 'IDA_VUELTA' && !form.value.regreso) return false
  return true
})

const ESTADOS_VISIBLES_PUBLICO = new Set(['PROGRAMADO'])

function normalizarLista(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.resultados)) return data.resultados
  if (Array.isArray(data?.records)) return data.records
  return []
}

function obtenerCampo(obj, claves, fallback = null) {
  for (const clave of claves) {
    if (obj?.[clave] !== undefined && obj?.[clave] !== null) return obj[clave]
  }
  return fallback
}

function limpiarNombreCatalogo(nombre = '') {
  return String(nombre).replace(/\d{6,}$/u, '').trim()
}

function moneda(valor) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(valor || 0))
}

function horaLegible(valor) {
  if (!valor) return '--:--'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha)
}

function fechaLegible(valor) {
  if (!valor) return 'Fecha por confirmar'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return new Intl.DateTimeFormat('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha)
}

function duracionLegible(minutos) {
  const total = Number(minutos || 0)
  const horas = Math.floor(total / 60)
  const mins = total % 60
  if (!horas) return `${mins}m`
  if (!mins) return `${horas}h`
  return `${horas}h ${mins}m`
}

function aeropuertoPorId(id) {
  return catalogos.aeropuertos.find((a) => String(a.idAeropuerto ?? a.id_aeropuerto ?? a.id) === String(id))
}

function codigoAeropuerto(id) {
  const aeropuerto = aeropuertoPorId(id)
  return obtenerCampo(aeropuerto, ['codigoIata', 'codigo_iata', 'iata'], '---')
}

function nombreCiudadAeropuerto(id) {
  const aeropuerto = aeropuertoPorId(id)
  const nombre = obtenerCampo(aeropuerto, ['nombre', 'nombreAeropuerto'], 'Aeropuerto')
  return limpiarNombreCatalogo(nombre).replace(/^Aeropuerto\s+/i, '').trim() || 'Ciudad'
}

function nombreAeropuerto(id) {
  const aeropuerto = aeropuertoPorId(id)
  if (!aeropuerto) return ''
  const codigo = obtenerCampo(aeropuerto, ['codigoIata', 'codigo_iata', 'iata'], '')
  const nombre = limpiarNombreCatalogo(obtenerCampo(aeropuerto, ['nombre', 'nombreAeropuerto'], ''))
  return [codigo, nombre].filter(Boolean).join(' - ')
}

function claseLegible(clase) {
  if (clase === 'EJECUTIVA') return 'Ejecutiva'
  if (clase === 'PRIMERA') return 'Primera'
  return 'Economica'
}

function normalizarVuelo(vuelo) {
  const idVuelo = obtenerCampo(vuelo, ['idVuelo', 'id_vuelo', 'id'])
  const origenId = obtenerCampo(vuelo, ['idAeropuertoOrigen', 'id_aeropuerto_origen'])
  const destinoId = obtenerCampo(vuelo, ['idAeropuertoDestino', 'id_aeropuerto_destino'])
  const precioBase = Number(obtenerCampo(vuelo, ['precioBase', 'precio_base'], 0))
  const escalas = obtenerCampo(vuelo, ['numeroEscalas', 'cantidadEscalas', 'escalas_count'], 0)
  const numeroVuelo = obtenerCampo(vuelo, ['numeroVuelo', 'numero_vuelo'], `AV${String(idVuelo).padStart(4, '0')}`)

  return {
    idVuelo,
    numeroVuelo,
    codigoDisplay: numeroVuelo,
    origenId,
    destinoId,
    origen: obtenerCampo(vuelo, ['origenNombre', 'origen', 'nombreOrigen'], nombreAeropuerto(origenId)),
    destino: obtenerCampo(vuelo, ['destinoNombre', 'destino', 'nombreDestino'], nombreAeropuerto(destinoId)),
    fechaHoraSalida: obtenerCampo(vuelo, ['fechaHoraSalida', 'fecha_hora_salida']),
    fechaHoraLlegada: obtenerCampo(vuelo, ['fechaHoraLlegada', 'fecha_hora_llegada']),
    duracionMin: Number(obtenerCampo(vuelo, ['duracionMin', 'duracion_min'], 0)),
    precioBase,
    escalas: Number(escalas || 0),
    estado: obtenerCampo(vuelo, ['estadoVuelo', 'estado_vuelo'], 'PROGRAMADO'),
    codigoOrigen: codigoAeropuerto(origenId),
    codigoDestino: codigoAeropuerto(destinoId),
    ciudadOrigen: nombreCiudadAeropuerto(origenId),
    ciudadDestino: nombreCiudadAeropuerto(destinoId),
    aeronave: 'Boeing 787',
  }
}

function esVueloVisiblePublico(vuelo) {
  const estado = String(vuelo?.estado || '').trim().toUpperCase()
  return ESTADOS_VISIBLES_PUBLICO.has(estado)
}

function ordenarVuelos(a, b) {
  return new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime()
}

function mapearVuelosPublicos(respuesta) {
  return extractItems(respuesta).map(normalizarVuelo).filter(esVueloVisiblePublico).sort(ordenarVuelos)
}

function extraerMetaPaginacion(respuesta) {
  const raw = respuesta?.data?.data ?? respuesta?.data ?? respuesta ?? {}
  const bloques = [raw, raw?.pagination, raw?.paginacion, raw?.meta, raw?.data].filter(Boolean)

  for (const bloque of bloques) {
    const totalPages = Number(
      obtenerCampo(bloque, ['totalPages', 'total_pages', 'paginasTotales', 'lastPage', 'last_page'], 0),
    )
    const currentPage = Number(
      obtenerCampo(bloque, ['page', 'currentPage', 'current_page', 'paginaActual', 'pageNumber'], 0),
    )

    if (totalPages > 0 || currentPage > 0) {
      return { totalPages, currentPage }
    }
  }

  return { totalPages: 0, currentPage: 0 }
}

async function cargarVuelosPaginados(params = {}) {
  const acumulados = []
  const vistos = new Set()
  const pageSize = 100
  const maxPaginas = 40
  let paginasSinNuevos = 0

  for (let page = 1; page <= maxPaginas; page += 1) {
    const respuesta = await buscarVuelosBookingApi({
      estado_vuelo: 'PROGRAMADO',
      page,
      page_size: pageSize,
      ...params,
    })

    const items = extractItems(respuesta)
    if (!items.length) break

    let nuevosEnPagina = 0
    for (const item of items) {
      const idVuelo = obtenerCampo(item, ['idVuelo', 'id_vuelo', 'id'])
      const clave = String(idVuelo ?? `${page}-${acumulados.length}`)
      if (vistos.has(clave)) continue
      vistos.add(clave)
      acumulados.push(item)
      nuevosEnPagina += 1
    }

    const { totalPages, currentPage } = extraerMetaPaginacion(respuesta)
    if (totalPages > 0 && (currentPage || page) >= totalPages) break

    if (nuevosEnPagina === 0) {
      paginasSinNuevos += 1
      if (paginasSinNuevos >= 2) break
    } else {
      paginasSinNuevos = 0
    }
  }

  return acumulados
}

async function buscar() {
  if (!puedeBuscar.value) return
  cargando.value = true
  errorGeneral.value = ''

  try {
    if (tipoViaje.value === 'IDA_VUELTA') {
      const [itemsIda, itemsVuelta] = await Promise.all([
        cargarVuelosPaginados({
          id_aeropuerto_origen: form.value.origen,
          id_aeropuerto_destino: form.value.destino,
          fecha_salida: form.value.salida,
        }),
        cargarVuelosPaginados({
          id_aeropuerto_origen: form.value.destino,
          id_aeropuerto_destino: form.value.origen,
          fecha_salida: form.value.regreso,
        }),
      ])

      resultados.value = itemsIda.map(normalizarVuelo).filter(esVueloVisiblePublico).sort(ordenarVuelos)
      resultadosRegreso.value = itemsVuelta.map(normalizarVuelo).filter(esVueloVisiblePublico).sort(ordenarVuelos)
    } else {
      resultadosRegreso.value = []
      const items = await cargarVuelosPaginados({
        id_aeropuerto_origen: form.value.origen,
        id_aeropuerto_destino: form.value.destino,
        fecha_salida: form.value.salida,
      })
      resultados.value = items.map(normalizarVuelo).filter(esVueloVisiblePublico).sort(ordenarVuelos)
    }

    seleccionIda.value = null
    seleccionRegreso.value = null
    vueloExpandido.value = null
    vueloExpandidoRegreso.value = null
  } catch (error) {
    resultados.value = []
    resultadosRegreso.value = []
    errorGeneral.value =
      error.response?.data?.message || 'No se pudieron cargar los vuelos disponibles en este momento.'
  } finally {
    cargando.value = false
  }
}

async function cargarDestacados() {
  cargandoDestacados.value = true
  try {
    const items = await cargarVuelosPaginados()

    destacados.value = items.map(normalizarVuelo).filter(esVueloVisiblePublico).sort(ordenarVuelos)
  } catch {
    destacados.value = []
  } finally {
    cargandoDestacados.value = false
  }
}

function sincronizarQuery() {
  router.replace({
    path: '/search',
    query: {
      origen: form.value.origen || undefined,
      destino: form.value.destino || undefined,
      salida: form.value.salida || undefined,
      regreso: tipoViaje.value === 'IDA_VUELTA' ? form.value.regreso || undefined : undefined,
      pasajeros: form.value.pasajeros || undefined,
      clase: form.value.clase || undefined,
      tipo: tipoViaje.value,
    },
  })
}

function cambiarTipoViajeBusqueda(nuevoTipo) {
  if (tipoViaje.value !== nuevoTipo) clearSeleccionTramosBusqueda()
  tipoViaje.value = nuevoTipo
  if (nuevoTipo === 'SOLO_IDA') form.value.regreso = ''
  sincronizarQuery()
}

function clearSeleccionTramosBusqueda() {
  seleccionIda.value = null
  seleccionRegreso.value = null
  vueloExpandido.value = null
  vueloExpandidoRegreso.value = null
}

function guardarSeleccionSoloIda(vuelo) {
  reserva.setTipoViaje('SOLO_IDA')
  reserva.setVueloRegreso(null)
  reserva.setVuelo({
    ...vuelo,
    pasajeros: Number(form.value.pasajeros),
    clase: form.value.clase,
    tipoViaje: 'SOLO_IDA',
    fechaRegreso: null,
  })
}

function toggleDetalles(vueloId) {
  vueloExpandido.value = vueloExpandido.value === vueloId ? null : vueloId
}

function toggleDetallesRegreso(vueloId) {
  vueloExpandidoRegreso.value = vueloExpandidoRegreso.value === vueloId ? null : vueloId
}

function reservar(vuelo) {
  guardarSeleccionSoloIda(vuelo)
  router.push({ name: 'detalle-vuelo', params: { id: vuelo.idVuelo }, query: route.query })
}

function elegirVueloIda(vuelo) {
  seleccionIda.value = vuelo
}

function elegirVueloRegreso(vuelo) {
  seleccionRegreso.value = vuelo
}

const roundTripListo = computed(() => Boolean(seleccionIda.value && seleccionRegreso.value))

function continuarIdaYVuelta() {
  if (!roundTripListo.value) return
  reserva.setTipoViaje('IDA_VUELTA')
  reserva.setVuelo({
    ...seleccionIda.value,
    pasajeros: Number(form.value.pasajeros),
    clase: form.value.clase,
    tipoViaje: 'IDA_VUELTA',
    fechaRegreso: form.value.regreso,
  })
  reserva.setVueloRegreso({
    ...seleccionRegreso.value,
    pasajeros: Number(form.value.pasajeros),
    clase: form.value.clase,
  })
  router.push({ name: 'datos-pasajeros' })
}

const resumenBusqueda = computed(() => ({
  origen: nombreAeropuerto(form.value.origen) || 'Origen',
  destino: nombreAeropuerto(form.value.destino) || 'Destino',
  fecha: form.value.salida ? fechaLegible(form.value.salida) : 'Fecha',
  regreso:
    tipoViaje.value === 'IDA_VUELTA' && form.value.regreso ? fechaLegible(form.value.regreso) : null,
}))

const esVistaDosColumnas = computed(() => puedeBuscar.value && tipoViaje.value === 'IDA_VUELTA')

const listaSoloViaje = computed(() => {
  if (esVistaDosColumnas.value) return []
  return puedeBuscar.value && tipoViaje.value === 'SOLO_IDA' ? resultados.value : destacados.value
})



watch(
  () => route.query,
  (query) => {
    form.value.origen = query.origen || ''
    form.value.destino = query.destino || ''
    form.value.salida = query.salida || ''
    form.value.regreso = query.regreso || ''
    form.value.pasajeros = query.pasajeros || '1'
    form.value.clase = query.clase || 'ECONOMICA'
    tipoViaje.value = query.tipo || 'SOLO_IDA'
  },
)

onMounted(async () => {
  await catalogos.cargarAeropuertos(true).catch(() => {})
  if (puedeBuscar.value) await buscar()
  else await cargarDestacados()
})
</script>

<template>
  <section class="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-red-50 to-white py-10">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="overflow-hidden rounded-[30px] border border-red-100 bg-white shadow-xl shadow-red-100/50">
        <div class="bg-[#d71920] px-6 py-5 text-white sm:px-8">
          <p class="text-sm font-semibold uppercase tracking-[0.28em] text-white/75">Vuelos</p>
          <h1 class="mt-2 text-3xl font-bold">Vuelos disponibles</h1>
        </div>
        <div class="p-6 sm:p-8">
        <div class="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-sm text-text-muted">
          <span>{{ resumenBusqueda.origen }}</span>
          <span>-</span>
          <span>{{ resumenBusqueda.destino }}</span>
          <span>-</span>
          <span>Ida: {{ resumenBusqueda.fecha }}</span>
        </div>
        <div
          v-if="resumenBusqueda.regreso"
          class="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-sm text-text-muted"
        >
          <span>{{ resumenBusqueda.destino }}</span>
          <span>-</span>
          <span>{{ resumenBusqueda.origen }}</span>
          <span>-</span>
          <span>Vuelta: {{ resumenBusqueda.regreso }}</span>
        </div>

        <div class="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              tipoViaje === 'SOLO_IDA'
                ? 'bg-[#d71920] text-white shadow-md shadow-red-200'
                : 'border border-red-200 bg-white text-text-main hover:bg-red-50'
            "
            @click="cambiarTipoViajeBusqueda('SOLO_IDA')"
          >
            Solo ida
          </button>
          <button
            type="button"
            class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              tipoViaje === 'IDA_VUELTA'
                ? 'bg-[#d71920] text-white shadow-md shadow-red-200'
                : 'border border-red-200 bg-white text-text-main hover:bg-red-50'
            "
            @click="cambiarTipoViajeBusqueda('IDA_VUELTA')"
          >
            Ida y vuelta
          </button>
        </div>

        <form
          class="mt-6 flex flex-wrap items-end gap-4"
          @submit.prevent="sincronizarQuery(); buscar()"
        >
          <select
            v-model="form.origen"
            class="min-w-[160px] flex-1 rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-text-main outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100"
          >
            <option value="">Origen</option>
            <option v-for="opcion in opcionesAeropuertos" :key="opcion.valor" :value="opcion.valor">
              {{ opcion.etiqueta }}
            </option>
          </select>

          <select
            v-model="form.destino"
            class="min-w-[160px] flex-1 rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-text-main outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100"
          >
            <option value="">Destino</option>
            <option v-for="opcion in opcionesAeropuertos" :key="opcion.valor" :value="opcion.valor">
              {{ opcion.etiqueta }}
            </option>
          </select>

          <input
            v-model="form.salida"
            type="date"
            class="min-w-[150px] flex-1 rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-text-main outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100"
          />

          <input
            v-if="tipoViaje === 'IDA_VUELTA'"
            v-model="form.regreso"
            type="date"
            required
            class="min-w-[150px] flex-1 rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-text-main outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100"
          />
          <select
            v-model="form.clase"
            class="min-w-[130px] flex-1 rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-text-main outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100 sm:max-w-[180px]"
          >
            <option value="ECONOMICA">Economica</option>
            <option value="EJECUTIVA">Ejecutiva</option>
            <option value="PRIMERA">Primera</option>
          </select>
          <input
            v-model="form.pasajeros"
            type="number"
            min="1"
            max="9"
            title="Pasajeros"
            class="min-w-[100px] w-24 rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-text-main outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100"
          />

          <button
            type="submit"
            class="min-w-[140px] flex-1 rounded-2xl bg-[#d71920] px-6 py-3 font-semibold text-white shadow-lg shadow-red-200 transition-colors hover:bg-[#b9151b] sm:flex-none"
          >
            Buscar
          </button>
        </form>
        </div>
      </div>

      <div class="mt-10">
        <div v-if="cargando" class="rounded-[28px] bg-white p-10 text-center shadow-sm">
          <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-red-100 border-t-[#d71920]" />
          <p class="mt-4 text-text-muted">Consultando vuelos disponibles...</p>
        </div>

        <div v-else-if="errorGeneral" class="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {{ errorGeneral }}
        </div>

        <div v-else-if="!puedeBuscar && cargandoDestacados" class="rounded-[28px] bg-white p-10 text-center shadow-sm">
          <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-red-100 border-t-[#d71920]" />
          <p class="mt-4 text-text-muted">Cargando vuelos destacados...</p>
        </div>

        <div v-else-if="esVistaDosColumnas" class="relative pb-32">
          <div class="grid gap-8 xl:grid-cols-2">
            <div class="min-w-0 space-y-4">
              <div
                class="rounded-2xl border border-red-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm xl:sticky xl:top-20 xl:z-10"
              >
                <p class="text-xs font-semibold uppercase tracking-wider text-[#d71920]">Vuelos de ida</p>
                <p class="text-sm text-text-muted">
                  {{ resumenBusqueda.origen }} · {{ resumenBusqueda.destino }} · {{ resumenBusqueda.fecha }}
                </p>
              </div>
              <div v-if="!resultados.length" class="rounded-[28px] bg-white p-8 text-center text-text-muted shadow-sm">
                No hay vuelos de ida programados para esta fecha y ruta.
              </div>
              <div v-else class="space-y-5">
                <TarjetaVueloBusqueda
                  v-for="vuelo in resultados"
                  :key="'ida-' + vuelo.idVuelo"
                  :vuelo="vuelo"
                  :seleccionado="seleccionIda?.idVuelo === vuelo.idVuelo"
                  :expandido="vueloExpandido === vuelo.idVuelo"
                  :etiqueta-accion="seleccionIda?.idVuelo === vuelo.idVuelo ? 'Seleccionado' : 'Elegir ida'"
                  @elegir="elegirVueloIda"
                  @toggle-detalles="toggleDetalles"
                />
              </div>
            </div>

            <div class="min-w-0 space-y-4">
              <div
                class="rounded-2xl border border-red-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm xl:sticky xl:top-20 xl:z-10"
              >
                <p class="text-xs font-semibold uppercase tracking-wider text-[#d71920]">Vuelos de vuelta</p>
                <p class="text-sm text-text-muted">
                  {{ resumenBusqueda.destino }} · {{ resumenBusqueda.origen }} · {{ resumenBusqueda.regreso }}
                </p>
              </div>
              <div v-if="!resultadosRegreso.length" class="rounded-[28px] bg-white p-8 text-center text-text-muted shadow-sm">
                No hay vuelos de vuelta programados para esta fecha y ruta.
              </div>
              <div v-else class="space-y-5">
                <TarjetaVueloBusqueda
                  v-for="vuelo in resultadosRegreso"
                  :key="'vuel-' + vuelo.idVuelo"
                  :vuelo="vuelo"
                  :seleccionado="seleccionRegreso?.idVuelo === vuelo.idVuelo"
                  :expandido="vueloExpandidoRegreso === vuelo.idVuelo"
                  :etiqueta-accion="
                    seleccionRegreso?.idVuelo === vuelo.idVuelo ? 'Seleccionado' : 'Elegir vuelta'
                  "
                  @elegir="elegirVueloRegreso"
                  @toggle-detalles="toggleDetallesRegreso"
                />
              </div>
            </div>
          </div>

          <div
            class="fixed bottom-0 left-0 right-0 z-40 border-t border-red-100 bg-white/95 px-4 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div class="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div class="min-w-0 space-y-1 text-sm text-text-muted">
                <p v-if="seleccionIda" class="text-text-main">
                  <span class="font-semibold text-[#d71920]">Ida:</span>
                  {{ seleccionIda.numeroVuelo }} · {{ horaLegible(seleccionIda.fechaHoraSalida) }} ·
                  {{ moneda(seleccionIda.precioBase) }}
                </p>
                <p v-else>Elige un vuelo de ida.</p>
                <p v-if="seleccionRegreso" class="text-text-main">
                  <span class="font-semibold text-[#d71920]">Vuelta:</span>
                  {{ seleccionRegreso.numeroVuelo }} · {{ horaLegible(seleccionRegreso.fechaHoraSalida) }} ·
                  {{ moneda(seleccionRegreso.precioBase) }}
                </p>
                <p v-else>Elige un vuelo de vuelta.</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-2xl bg-[#d71920] px-8 py-3 font-semibold text-white shadow-lg shadow-red-200 transition-colors hover:bg-[#b9151b] disabled:cursor-not-allowed disabled:opacity-45"
                :disabled="!roundTripListo"
                @click="continuarIdaYVuelta"
              >
                Continuar con ida y vuelta
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!listaSoloViaje.length" class="rounded-[28px] bg-white p-10 text-center shadow-sm">
          <p class="text-lg font-semibold text-navy">
            {{ puedeBuscar ? 'No encontramos vuelos programados para esa busqueda.' : 'Todavia no hay vuelos destacados para mostrar.' }}
          </p>
          <p class="mt-2 text-text-muted">
            {{ puedeBuscar ? 'Prueba con otra fecha o una combinacion distinta de aeropuertos.' : 'Puedes aplicar tu busqueda con origen, destino y fecha.' }}
          </p>
        </div>

        <div v-else class="space-y-5">
          <TarjetaVueloBusqueda
            v-for="vuelo in listaSoloViaje"
            :key="vuelo.idVuelo"
            :vuelo="vuelo"
            :expandido="vueloExpandido === vuelo.idVuelo"
            etiqueta-accion="Reservar"
            es-reserva-directa
            @reservar="reservar"
            @toggle-detalles="toggleDetalles"
          />
        </div>
      </div>
    </div>
  </section>
</template>
