<script setup>
/**
 * Checkout aerolínea (?token=id_vuelo+url_retorno en JWT).
 * Pasos: asiento · pasajero · resumen/equipaje · pago. Cliente autenticado obligatorio (guard router).
 * Tras pago OK redirige al inicio del mismo dominio; progreso en localStorage hasta entonces.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getClienteApi } from '@/api/clientes.api'
import { createPasajeroApi } from '@/api/pasajeros.api'
import { createReservaApi, pagarReservaApi } from '@/api/reservas.api'
import { getAsientosVueloBookingApi, getVueloBookingDetalleApi } from '@/api/vuelos.api'
import InputApp from '@/components/base/InputApp.vue'
import SelectApp from '@/components/base/SelectApp.vue'
import { useAutenticacionStore } from '@/stores/autenticacion.store'
import { useCatalogosStore } from '@/stores/catalogos.store'
import { claimsCheckoutAerolinea, jwtExpirado, MSJ_SESION_EXPIRADA } from '@/utils/jwtBooking'
import { extractItems, parseJwtPayload } from '@/utils/portalCliente'
import {
  esTipoDocumentoSoloDigitos,
  limiteDocumento,
  normalizarDocumento,
  normalizarTelefono,
  validarDocumentoPorTipo,
  validarTelefono,
} from '@/utils/validacionesCampos'

const SKIP_GLOBAL_AUTH_REDIRECT = { skipAuthRedirect: true }
const CLAVE_LS_AEROLINEA = 'aerolinea_progreso'

/** Flujo público sin paso aparte solo para “cuenta”: 1 asiento · 2 pasajero · 3 resumen · 4 pagar */
const PASO_ASIENTO = 1
const PASO_PASAJERO = 2
const PASO_RESUMEN = 3
const PASO_PAGO = 4
const PASO_MAX = 4

const route = useRoute()
const router = useRouter()
const auth = useAutenticacionStore()
const catalogos = useCatalogosStore()

const IVA = 0.15
const CARGO_SERVICIO = 0

const columnasCabina = ['A', 'B', 'C', 'D', 'E', 'F']
const filasBase = Array.from({ length: 28 }, (_, i) => i + 1)

const cargandoInicial = ref(true)
const procesandoPasajero = ref(false)
const procesandoPago = ref(false)
const errorFatal = ref('')
const errorOperacion = ref('')
/** Banner grande tras crear reserva y pagar (antes de ir al inicio del sitio) */
const mostrarBannerExitoReserva = ref(false)

/** Tiempo mínimo para leer el mensaje de éxito antes del salto externo */
const MS_ANTES_REDIRECCION_EXITO = 2600

const modalAuthVisible = ref(false)
/** Cuando viene true y el usuario ya inició sesión, abrimos el paso de pago (modal “al pagar”) */
const pendienteIrAlPasoPago = ref(false)
/** 'pasajero' | 'pago' — texto del modal */
const modalAuthMotivo = ref('pago')

const pasoActual = ref(PASO_ASIENTO)

/** Token efectivo = query ? primero si no existe guardado en LS */
function leerLsAerolinea() {
  try {
    const raw = localStorage.getItem(CLAVE_LS_AEROLINEA)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const inicialLs = typeof localStorage !== 'undefined' ? leerLsAerolinea() : null
const tokenJwtPersistidoRef = ref(typeof inicialLs?.token === 'string' ? inicialLs.token : '')

const jwtTokenEfectivo = computed(() => {
  const q = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  if (q) return q
  return String(tokenJwtPersistidoRef.value || '').trim()
})

const claims = computed(() => claimsCheckoutAerolinea(jwtTokenEfectivo.value))

watch(
  () => route.query.token,
  (t) => {
    if (typeof t === 'string' && t.trim()) tokenJwtPersistidoRef.value = t.trim()
  },
  { immediate: true },
)

const vueloRaw = ref(null)
const asientosMapaSource = ref([])
const asientoSeleccionado = ref(null)

const equipajeDraft = ref({ equipajeBodega: false })
const COSTO_BODEGA = 45

const form = ref({
  tipo_identificacion: 'CEDULA',
  numero_identificacion: '',
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  id_pais_nacionalidad: '',
  correo: '',
  telefono: '',
})

const erroresForm = ref({})

const idPasajeroBackend = ref(0)

const textoTituloModalAuth = computed(() =>
  modalAuthMotivo.value === 'pago' ? 'Inicia sesión para pagar' : 'Inicia sesión para el pasajero',
)
const textoCuerpoModalAuth = computed(() =>
  modalAuthMotivo.value === 'pago'
    ? 'Para crear la reserva y ejecutar el pago necesitas una cuenta cliente. Ya guardamos asiento y formulario en este equipo; al entrar continuamos en la pantalla de pago.'
    : 'Ya guardamos asiento y lo que llevabas del pasajero. Para registrar al pasajero necesitas iniciar sesión o registrarte.',
)

const opcionesTipoDocumento = [
  { valor: 'CEDULA', etiqueta: 'Cédula' },
  { valor: 'RUC', etiqueta: 'RUC' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const opcionesPaises = computed(() =>
  catalogos.paises.map((pais) => ({
    valor: String(pais.idPais ?? pais.id_pais ?? pais.id),
    etiqueta: limpiarNombreCatalogo(String(pais.nombre ?? pais.nombre_pais ?? '')),
  })),
)

function limpiarNombreCatalogo(nombre = '') {
  return String(nombre).replace(/\d{6,}$/u, '').trim()
}

function obtenerCampo(obj, claves, fallback = null) {
  for (const clave of claves) {
    if (obj?.[clave] !== undefined && obj?.[clave] !== null) return obj[clave]
  }
  return fallback
}

function limpiarProgresoAerolinea() {
  localStorage.removeItem(CLAVE_LS_AEROLINEA)
}

/**
 * Guardado mínimo que pide backend + campos extras para recuperar estado.
 * `idVuelo` / `urlRetorno`: mismos valores que lleva el JWT (snake en payload).
 */
function construirPersistenciaLs() {
  const c = claims.value
  const a = asientoSeleccionado.value
  if (!c?.idVuelo || !a) return null

  const payload = c.payload || {}
  return {
    idVuelo: payload.id_vuelo != null ? payload.id_vuelo : c.idVuelo,
    idAsiento: a.idAsiento,
    precioAsiento: Number(a.precioExtra ?? 0),
    urlRetorno: payload.url_retorno != null ? payload.url_retorno : c.urlRetorno,
    token: jwtTokenEfectivo.value,
    pasoActual: pasoActual.value,
    form: JSON.parse(JSON.stringify(form.value)),
    equipajeBodega: equipajeDraft.value.equipajeBodega,
    idPasajero: idPasajeroBackend.value > 0 ? idPasajeroBackend.value : null,
    numeroAsiento: a.numeroAsiento,
    asientoClase: a.clase,
    asientoPosicion: a.posicion,
    pendientePagoTrasSesion: pendienteIrAlPasoPago.value,
  }
}

function persistirProgresoAerolinea() {
  const obj = construirPersistenciaLs()
  try {
    if (!obj?.token?.trim()) return
    localStorage.setItem(CLAVE_LS_AEROLINEA, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

/** Guardado explícito antes de login/registro (incluye estructura mínima solicitada). */
function guardarProgresoAntesDeIrAAuth(pasoOpcional) {
  const c = claims.value
  const a = asientoSeleccionado.value
  if (!c?.idVuelo || !a) return
  const payload = c.payload || {}
  const base = {
    idVuelo: payload.id_vuelo != null ? payload.id_vuelo : c.idVuelo,
    idAsiento: a.idAsiento,
    precioAsiento: Number(a.precioExtra ?? 0),
    urlRetorno: payload.url_retorno != null ? payload.url_retorno : c.urlRetorno,
    token: jwtTokenEfectivo.value,
  }
  if (pasoOpcional !== undefined && pasoOpcional !== null) {
    const p = Number(pasoOpcional)
    if (Number.isFinite(p))
      pasoActual.value = Math.min(Math.max(Math.floor(p), PASO_ASIENTO), PASO_MAX)
  }
  const merged = {
    ...base,
    pasoActual: pasoActual.value,
    form: JSON.parse(JSON.stringify(form.value)),
    equipajeBodega: equipajeDraft.value.equipajeBodega,
    idPasajero: idPasajeroBackend.value > 0 ? idPasajeroBackend.value : null,
    numeroAsiento: a.numeroAsiento,
    asientoClase: a.clase,
    asientoPosicion: a.posicion,
    pendientePagoTrasSesion: pendienteIrAlPasoPago.value,
  }
  try {
    localStorage.setItem(CLAVE_LS_AEROLINEA, JSON.stringify(merged))
  } catch {
    /* ignore */
  }
}

function rutaVueltaAerolinea() {
  const t = String(jwtTokenEfectivo.value || '').trim()
  if (!t)
    return typeof route.fullPath === 'string' && route.fullPath ? route.fullPath : '/aerolinea'
  return router.resolve({ name: 'aerolinea-checkout', query: { token: t } }).fullPath
}

function toBool(valor, fallback = false) {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'number') return valor === 1
  if (typeof valor === 'string') {
    const n = valor.trim().toLowerCase()
    if (['true', '1', 'si', 'sí', 'activo', 'activa', 'disponible', 'libre'].includes(n)) return true
    if (['false', '0', 'no', 'bloqueado', 'reservado', 'ocupado', 'inactivo', 'inactiva'].includes(n))
      return false
  }
  return fallback
}

function normalizarDisponibilidadAsiento(raw) {
  const disp = obtenerCampo(raw, ['disponible', 'available', 'isAvailable', 'activo'])
  if (disp !== null && disp !== undefined) return toBool(disp)

  const estado = String(obtenerCampo(raw, ['estado', 'estadoAsiento', 'estado_asiento'], 'ACTIVO'))
    .trim()
    .toUpperCase()
  return ['ACTIVO', 'DISPONIBLE', 'LIBRE'].includes(estado)
}

function descomponerAsientoEtiqueta(numeroAsiento) {
  const valor = String(numeroAsiento || '').trim().toUpperCase()
  const formatoLetraNumero = valor.match(/^([A-F])(\d{1,2})$/)
  if (formatoLetraNumero)
    return { columna: formatoLetraNumero[1], fila: Number(formatoLetraNumero[2]) }
  const formatoNumeroLetra = valor.match(/^(\d{1,2})([A-F])$/)
  if (formatoNumeroLetra)
    return { fila: Number(formatoNumeroLetra[1]), columna: formatoNumeroLetra[2] }
  return null
}

function normalizarAsientoBooking(raw) {
  const numeroAsiento = obtenerCampo(raw, ['numeroAsiento', 'numero_asiento'], '')
  const pos = descomponerAsientoEtiqueta(numeroAsiento)
  return {
    idAsiento: obtenerCampo(raw, ['idAsiento', 'id_asiento', 'id']),
    numeroAsiento,
    disponible: normalizarDisponibilidadAsiento(raw),
    clase: obtenerCampo(raw, ['clase'], 'ECONOMICA'),
    posicion: obtenerCampo(raw, ['posicion'], ''),
    precioExtra: Number(obtenerCampo(raw, ['precioExtra', 'precio_extra', 'recargo'], 0)),
    fila: pos?.fila ?? null,
    columna: pos?.columna ?? null,
    raw,
  }
}

function aplicarSnapshotAsiento(snap) {
  if (!snap?.idAsiento && !snap?.numeroAsiento) return
  const encontrado =
    asientosMapaSource.value.find((as) => {
      if (snap?.idAsiento && String(as.idAsiento) === String(snap.idAsiento)) return true
      if (
        snap?.numeroAsiento &&
        String(as.numeroAsiento).trim() === String(snap.numeroAsiento).trim()
      )
        return true
      return false
    }) || null
  if (encontrado?.disponible) asientoSeleccionado.value = { ...encontrado }
}

/** Antes era 5 pasos (paso “cuenta” entre asiento y pasajero). Convierte a esquema 1–4. */
function migrarPasoLegacyDesdeLs(pasoRaw) {
  const p = Number(pasoRaw)
  if (!Number.isFinite(p) || p < 1) return PASO_ASIENTO
  if (p >= 5) return PASO_PAGO
  if (p === 4) return PASO_RESUMEN
  if (p === 3) return PASO_PASAJERO
  if (p === 2) return PASO_PASAJERO
  return Math.min(Math.max(Math.floor(p), PASO_ASIENTO), PASO_MAX)
}

function fusionarPersistenciaLsTrasAsientos() {
  const g = leerLsAerolinea()
  if (!g || !claims.value?.idVuelo) return

  const idVueloJwt = String(claims.value.payload?.id_vuelo ?? claims.value.idVuelo ?? '')
  if (!idVueloJwt || String(g.idVuelo ?? '') !== idVueloJwt) {
    limpiarProgresoAerolinea()
    return
  }

  if (typeof g.token === 'string' && g.token.trim())
    tokenJwtPersistidoRef.value = g.token.trim()

  aplicarSnapshotAsiento({
    idAsiento: g.idAsiento,
    numeroAsiento: g.numeroAsiento ?? '',
  })
  const found = Boolean(asientoSeleccionado.value)
  const precAlmacenado = Number(g.precioAsiento)
  if (found && Number.isFinite(precAlmacenado) && Number(asientoSeleccionado.value.precioExtra) !== precAlmacenado) {
    asientoSeleccionado.value = {
      ...asientoSeleccionado.value,
      precioExtra: precAlmacenado,
    }
  }

  if (g.form && typeof g.form === 'object') {
    for (const key of Object.keys(form.value)) {
      if (!(key in g.form)) continue
      const val = g.form[key]
      form.value[key] = val === undefined || val === null ? form.value[key] : String(val)
    }
  }
  equipajeDraft.value.equipajeBodega = Boolean(g.equipajeBodega)

  idPasajeroBackend.value =
    typeof g.idPasajero === 'number'
      ? g.idPasajero
      : Number(g.idPasajero || 0) > 0
        ? Number(g.idPasajero)
        : 0

  const pasoMigrado = migrarPasoLegacyDesdeLs(g.pasoActual)
  if (!Number.isNaN(pasoMigrado) && pasoMigrado >= PASO_ASIENTO && pasoMigrado <= PASO_MAX)
    pasoActual.value = pasoMigrado

  pendienteIrAlPasoPago.value = Boolean(g.pendientePagoTrasSesion)

  if (!found) {
    pasoActual.value = PASO_ASIENTO
    pendienteIrAlPasoPago.value = false
  }

  reaccionarSesionClienteTrasLogin()
}

function abrirModalAuthPagoYSerializar() {
  modalAuthMotivo.value = 'pago'
  pendienteIrAlPasoPago.value = true
  modalAuthVisible.value = true
  guardarProgresoAntesDeIrAAuth()
}

function abrirModalAuthPasajeroYSerializar() {
  modalAuthMotivo.value = 'pasajero'
  pendienteIrAlPasoPago.value = false
  modalAuthVisible.value = true
  guardarProgresoAntesDeIrAAuth()
}

/** Si había marcado “seguir al pago” tras sesión y ya tiene cuenta, lleva al paso 4. */
function reaccionarSesionClienteTrasLogin() {
  if (!auth.estaAutenticado || !pendienteIrAlPasoPago.value) return
  if (!asientoSeleccionado.value || !claims.value?.idVuelo) {
    pendienteIrAlPasoPago.value = false
    modalAuthVisible.value = false
    persistirProgresoAerolinea()
    return
  }

  pendienteIrAlPasoPago.value = false
  modalAuthVisible.value = false

  if (!idPasajeroBackend.value) {
    pasoActual.value = PASO_PASAJERO
    errorOperacion.value = 'Completa los datos del pasajero antes de pagar.'
    persistirProgresoAerolinea()
    return
  }

  pasoActual.value = PASO_PAGO
  persistirProgresoAerolinea()
}

function normalizarVuelo(v) {
  if (!v) return null
  const origenId = obtenerCampo(v, ['idAeropuertoOrigen', 'id_aeropuerto_origen'])
  const destinoId = obtenerCampo(v, ['idAeropuertoDestino', 'id_aeropuerto_destino'])

  const aeropuertoPorId = (id) =>
    catalogos.aeropuertos.find((a) => String(a.idAeropuerto ?? a.id_aeropuerto ?? a.id) === String(id))

  function codigoAeropuerto(id) {
    const ap = aeropuertoPorId(id)
    return obtenerCampo(ap, ['codigoIata', 'codigo_iata'], '---')
  }

  function nombreAeropuerto(id) {
    const ap = aeropuertoPorId(id)
    const nombre = obtenerCampo(ap, ['nombre', 'nombreAeropuerto'], '')
    return String(nombre).replace(/\d{6,}$/u, '').trim() || 'Aeropuerto'
  }

  return {
    idVuelo: obtenerCampo(v, ['idVuelo', 'id_vuelo', 'id']),
    numeroVuelo: obtenerCampo(v, ['numeroVuelo', 'numero_vuelo'], ''),
    fechaHoraSalida: obtenerCampo(v, ['fechaHoraSalida', 'fecha_hora_salida']),
    fechaHoraLlegada: obtenerCampo(v, ['fechaHoraLlegada', 'fecha_hora_llegada']),
    precioBase: Number(obtenerCampo(v, ['precioBase', 'precio_base'], 0)),
    codigoOrigen: codigoAeropuerto(origenId),
    codigoDestino: codigoAeropuerto(destinoId),
    nombreOrigen: nombreAeropuerto(origenId),
    nombreDestino: nombreAeropuerto(destinoId),
    claseVuelo: obtenerCampo(v, ['clase', 'claseVuelo', 'clase_vuelo'], ''),
  }
}

const vuelo = computed(() => normalizarVuelo(vueloRaw.value))

function moneda(valor) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(valor || 0))
}

function fechaHoraLegible(valor) {
  if (!valor) return '—'
  try {
    const d = new Date(valor)
    return new Intl.DateTimeFormat('es-EC', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return '—'
  }
}

function claseLegible(valor) {
  const c = String(valor || '').trim()
  return c.replace(/_/g, ' ') || '—'
}

function posicionLegible(posicion) {
  if (posicion === 'VENTANA') return 'Ventana'
  if (posicion === 'PASILLO') return 'Pasillo'
  if (posicion === 'CENTRO') return 'Centro'
  return posicion || '—'
}

const mapaAsientos = computed(() => {
  const mapa = new Map()
  asientosMapaSource.value.forEach((asiento) => {
    if (!asiento.fila || !asiento.columna) return
    mapa.set(`${asiento.fila}-${asiento.columna}`, asiento)
  })
  return mapa
})

const filasVisibles = computed(() => {
  const filasConAsientos = asientosMapaSource.value.map((a) => a.fila).filter(Boolean)
  if (!filasConAsientos.length) return filasBase
  const max = Math.max(...filasConAsientos)
  return Array.from({ length: max }, (_, i) => i + 1)
})

const resumenMapaFijo = computed(() => {
  const total = asientosMapaSource.value.length
  const disponibles = asientosMapaSource.value.filter((a) => a.disponible).length
  return {
    total,
    disponibles,
    ocupados: Math.max(total - disponibles, 0),
    seleccionado: Boolean(asientoSeleccionado.value),
  }
})

const precioExtraAsiento = computed(() =>
  Number(asientoSeleccionado.value?.precioExtra ?? 0),
)
const precioBaseNum = computed(() => Number(vuelo.value?.precioBase || 0))

const subtotalEquipajeBodega = computed(() =>
  equipajeDraft.value.equipajeBodega ? COSTO_BODEGA : 0,
)

/** precio vuelo + precio asiento + equipaje (sin IVA) */
const subtotalLineaSinIva = computed(() =>
  Number((precioBaseNum.value + precioExtraAsiento.value + subtotalEquipajeBodega.value).toFixed(2)),
)
const ivaLinea = computed(() => Number((subtotalLineaSinIva.value * IVA).toFixed(2)))
const totalLinea = computed(() => Number((subtotalLineaSinIva.value + ivaLinea.value).toFixed(2)))

function asientoPorPosicion(fila, columna) {
  return mapaAsientos.value.get(`${fila}-${columna}`) || null
}

function estadoAsientoVisual(asiento) {
  if (!asiento) return 'ocupado'
  if (String(asientoSeleccionado.value?.idAsiento) === String(asiento.idAsiento)) return 'seleccionado'
  if (!asiento.disponible) return 'ocupado'
  return 'disponible'
}

function seleccionarAsiento(asiento) {
  if (!asiento?.disponible) return
  asientoSeleccionado.value = { ...asiento }
  idPasajeroBackend.value = 0
  persistirProgresoAerolinea()
}

watch(
  () => [form.value.tipo_identificacion, form.value.numero_identificacion],
  () => {
    form.value.numero_identificacion = normalizarDocumento(
      form.value.tipo_identificacion,
      form.value.numero_identificacion,
    )
  },
)

watch(
  () => form.value.telefono,
  (valor) => {
    form.value.telefono = normalizarTelefono(valor)
  },
)

watch([pasoActual, equipajeDraft], () => persistirProgresoAerolinea(), { deep: true })

watch(() => form.value, () => persistirProgresoAerolinea(), { deep: true })

watch(() => auth.estaAutenticado, (logueado) => {
  if (logueado) reaccionarSesionClienteTrasLogin()
  else {
    pendienteIrAlPasoPago.value = false
    persistirProgresoAerolinea()
  }
})

watch(jwtTokenEfectivo, (t) => {
  if (t) tokenJwtPersistidoRef.value = t
})

function recolectarArreglos(valor, listas = []) {
  if (Array.isArray(valor)) {
    listas.push(valor)
    valor.forEach((item) => recolectarArreglos(item, listas))
    return listas
  }
  if (valor && typeof valor === 'object') {
    Object.values(valor).forEach((item) => recolectarArreglos(item, listas))
  }
  return listas
}

function normalizarDetallesReserva(data) {
  const listas = recolectarArreglos(data)
  const detalles = listas.flat().filter((item) => {
    if (!item || typeof item !== 'object') return false
    const tienePasajero = item.idPasajero ?? item.id_pasajero
    const tieneAsiento = item.idAsiento ?? item.id_asiento
    const tieneDetalle = item.idDetalle ?? item.id_detalle ?? item.id
    return tienePasajero && tieneAsiento && tieneDetalle
  })

  return detalles.map((detalle) => ({
    idDetalle: detalle.idDetalle ?? detalle.id_detalle ?? detalle.id ?? null,
    idPasajero: detalle.idPasajero ?? detalle.id_pasajero ?? null,
    idAsiento: detalle.idAsiento ?? detalle.id_asiento ?? null,
  }))
}

function validarFormularioPasajero() {
  const e = {}
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const errDoc = validarDocumentoPorTipo(
    form.value.tipo_identificacion,
    form.value.numero_identificacion,
    'identificación',
  )

  if (!form.value.tipo_identificacion) e.tipo_identificacion = 'Selecciona el tipo.'
  if (errDoc) e.numero_identificacion = errDoc
  if (!form.value.nombres.trim()) e.nombres = 'Ingresa el nombre.'
  if (!form.value.apellidos.trim()) e.apellidos = 'Ingresa el apellido.'

  if (!form.value.fecha_nacimiento) {
    e.fecha_nacimiento = 'Selecciona la fecha de nacimiento.'
  } else {
    const fn = new Date(`${form.value.fecha_nacimiento}T00:00:00`)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (fn > hoy) e.fecha_nacimiento = 'La fecha no puede ser futura.'
  }

  if (!form.value.id_pais_nacionalidad) e.id_pais_nacionalidad = 'Selecciona el país.'
  if (!form.value.correo.trim()) e.correo = 'Ingresa el correo.'
  else if (!emailRegex.test(form.value.correo.trim())) e.correo = 'Ingresa un correo válido.'

  const errTel = validarTelefono(form.value.telefono)
  if (errTel) e.telefono = errTel

  erroresForm.value = e
  return Object.keys(e).length === 0
}

function obtenerIdClienteDesdeUsuario() {
  return Number(
    obtenerCampo(auth.usuario, ['idCliente', 'id_cliente', 'clienteId', 'cliente_id', 'id']) || 0,
  )
}

async function resolverIdCliente() {
  const directos = [obtenerIdClienteDesdeUsuario()]
  const payloadAuth = parseJwtPayload(auth.token || '')
  const desdeJwt = [
    payloadAuth?.idCliente,
    payloadAuth?.id_cliente,
    payloadAuth?.clienteId,
    payloadAuth?.cliente_id,
    payloadAuth?.sub,
  ]

  const candidatos = [...directos, ...desdeJwt]
    .map((v) => Number(v || 0))
    .filter((v, i, arr) => Number.isFinite(v) && v > 0 && arr.indexOf(v) === i)

  for (const id of candidatos) {
    try {
      const { data } = await getClienteApi(id, SKIP_GLOBAL_AUTH_REDIRECT)
      const cliente = data?.data || {}
      const ok = Number(cliente.idCliente ?? cliente.id_cliente ?? cliente.id ?? id)
      if (ok > 0) return ok
    } catch {
      /* siguiente */
    }
  }

  return 0
}

async function cargarDatosIniciales() {
  cargandoInicial.value = true
  errorFatal.value = ''
  errorOperacion.value = ''

  if (!jwtTokenEfectivo.value.trim()) {
    errorFatal.value = 'Enlace inválido: falta el token (?token=…) o no hay sesión guardada.'
    cargandoInicial.value = false
    return
  }

  const datosClaims = claimsCheckoutAerolinea(jwtTokenEfectivo.value)
  if (!datosClaims?.payload) {
    errorFatal.value = 'No se pudo leer el token. Verifica el enlace.'
    cargandoInicial.value = false
    return
  }

  if (jwtExpirado(datosClaims.payload)) {
    errorFatal.value = MSJ_SESION_EXPIRADA
    limpiarProgresoAerolinea()
    cargandoInicial.value = false
    return
  }

  if (!datosClaims.idVuelo) {
    errorFatal.value = 'El token no incluye el vuelo (id_vuelo).'
    cargandoInicial.value = false
    return
  }

  try {
    await catalogos.cargarAeropuertos(true).catch(() => {})
    await catalogos.cargarPaises(true).catch(() => {})

    const [respVuelo, respAsientos] = await Promise.all([
      getVueloBookingDetalleApi(datosClaims.idVuelo),
      getAsientosVueloBookingApi(datosClaims.idVuelo),
    ])

    vueloRaw.value = respVuelo.data?.data ?? respVuelo.data ?? null

    const norm = extractItems(respAsientos.data ?? respAsientos)
      .map(normalizarAsientoBooking)
      .sort(
        (a, b) =>
          (a.fila || 0) - (b.fila || 0) || String(a.columna || '').localeCompare(String(b.columna || '')),
      )
    asientosMapaSource.value = norm

    if (norm.length === 0) {
      errorFatal.value = 'No hay asientos publicados para este vuelo.'
      cargandoInicial.value = false
      return
    }

    asientoSeleccionado.value = null
    fusionarPersistenciaLsTrasAsientos()

    if (!asientoSeleccionado.value && datosClaims.idAsiento) {
      aplicarSnapshotAsiento({
        idAsiento: datosClaims.idAsiento,
        numeroAsiento: '',
      })
    }

    if (pasoActual.value > PASO_ASIENTO && !asientoSeleccionado.value) pasoActual.value = PASO_ASIENTO
    reaccionarSesionClienteTrasLogin()
  } catch (err) {
    errorFatal.value =
      err.response?.data?.message || err.message || 'No se pudieron cargar los datos del vuelo.'
  } finally {
    cargandoInicial.value = false
  }
}

function irAPaso(paso) {
  errorOperacion.value = ''
  pasoActual.value = Math.min(PASO_MAX, Math.max(PASO_ASIENTO, paso))
  persistirProgresoAerolinea()
}

function continuarSeleccionAHaciaSesion() {
  errorOperacion.value = ''
  if (!asientoSeleccionado.value) {
    errorOperacion.value = 'Selecciona un asiento disponible.'
    return
  }
  pasoActual.value = PASO_PASAJERO
  modalAuthVisible.value = false
  persistirProgresoAerolinea()
}

function cerrarModalAuth() {
  modalAuthVisible.value = false
  pendienteIrAlPasoPago.value = false
  modalAuthMotivo.value = 'pago'
  persistirProgresoAerolinea()
}

function irLoginConProgreso() {
  guardarProgresoAntesDeIrAAuth()
  modalAuthVisible.value = false
  router.push({ name: 'login', query: { redirect: rutaVueltaAerolinea() } })
}

function irRegistroConProgreso() {
  guardarProgresoAntesDeIrAAuth()
  modalAuthVisible.value = false
  router.push({ name: 'registro', query: { redirect: rutaVueltaAerolinea() } })
}

async function enviarPasajeroYIrAResumen() {
  errorOperacion.value = ''
  if (!validarFormularioPasajero()) return
  if (!claims.value?.idVuelo || !asientoSeleccionado.value || !vuelo.value) {
    errorOperacion.value = 'Faltan datos del vuelo o asiento.'
    return
  }
  procesandoPasajero.value = true
  try {
    const idCliente = await resolverIdCliente()
    if (!idCliente) {
      abrirModalAuthPasajeroYSerializar()
      errorOperacion.value = 'Inicia sesión o regístrate para guardar los datos del pasajero.'
      return
    }

    const payloadPasajero = {
      nombrePasajero: form.value.nombres.trim(),
      apellidoPasajero: form.value.apellidos.trim(),
      tipoDocumentoPasajero: form.value.tipo_identificacion,
      numeroDocumentoPasajero: form.value.numero_identificacion.trim(),
      fechaNacimientoPasajero: `${String(form.value.fecha_nacimiento).slice(0, 10)}T00:00:00`,
      idPaisNacionalidad: Number(form.value.id_pais_nacionalidad),
      emailContactoPasajero: form.value.correo.trim().toLowerCase(),
      telefonoContactoPasajero: form.value.telefono.trim(),
      generoPasajero: 'MASCULINO',
      idCliente,
    }

    const { data: datosPasajero } = await createPasajeroApi(payloadPasajero, SKIP_GLOBAL_AUTH_REDIRECT)
    const creado = datosPasajero?.data || {}
    const idP =
      Number(creado.idPasajero ?? creado.id_pasajero ?? creado.id ?? creado.IdPasajero ?? 0)

    if (!idP) throw new Error('No se obtuvo el id del pasajero creado.')

    idPasajeroBackend.value = idP
    pasoActual.value = PASO_RESUMEN
    persistirProgresoAerolinea()
  } catch (err) {
    errorOperacion.value =
      err.response?.data?.message ||
      err.response?.data?.errors?.join?.(' ') ||
      err.message ||
      'No se pudo registrar el pasajero.'
  } finally {
    procesandoPasajero.value = false
  }
}

function irDeResumenAHaciaPagar() {
  errorOperacion.value = ''
  if (!idPasajeroBackend.value) {
    pasoActual.value = PASO_PASAJERO
    errorOperacion.value = 'Completa primero los datos del pasajero.'
    return
  }
  if (!auth.estaAutenticado) {
    abrirModalAuthPagoYSerializar()
    errorOperacion.value = 'Para pagar necesitas iniciar sesión o registrarte.'
    return
  }
  pasoActual.value = PASO_PAGO
  persistirProgresoAerolinea()
}

function correccionPasajeroDesdeResumen() {
  idPasajeroBackend.value = 0
  errorOperacion.value = ''
  pasoActual.value = PASO_PASAJERO
  persistirProgresoAerolinea()
}

async function crearReservaYPagar() {
  if (!claims.value || !vuelo.value || !asientoSeleccionado.value) {
    errorOperacion.value = 'Faltan datos.'
    return
  }
  if (!idPasajeroBackend.value) {
    pasoActual.value = PASO_PASAJERO
    return
  }

  if (!auth.estaAutenticado) {
    abrirModalAuthPagoYSerializar()
    errorOperacion.value = 'Debes iniciar sesión como cliente para pagar.'
    return
  }

  procesandoPago.value = true
  errorOperacion.value = ''
  mostrarBannerExitoReserva.value = false

  try {
    const idClienteReserva = await resolverIdCliente()
    if (!idClienteReserva) {
      abrirModalAuthPagoYSerializar()
      errorOperacion.value = 'Sesión cliente requerida para la reserva.'
      procesandoPago.value = false
      return
    }

    const precioVueloVal = precioBaseNum.value
    const precioAsientoExtra = precioExtraAsiento.value
    const equipajeCargo = equipajeDraft.value.equipajeBodega ? COSTO_BODEGA : 0
    const subtotalSinIva = Number((precioVueloVal + precioAsientoExtra + equipajeCargo).toFixed(2))
    const valorIvaCalc = Number((subtotalSinIva * IVA).toFixed(2))
    const totalConIva = Number((subtotalSinIva + valorIvaCalc).toFixed(2))

    const idVueloNum = Number(vuelo.value.idVuelo ?? claims.value.idVuelo ?? 0)
    const idAsientoNum = Number(asientoSeleccionado.value.idAsiento ?? 0)
    const idPasajeroNum = idPasajeroBackend.value

    const payloadReserva = {
      idCliente: idClienteReserva,
      idVuelo: idVueloNum,
      fechaInicio: vuelo.value.fechaHoraSalida,
      fechaFin: vuelo.value.fechaHoraLlegada,
      subtotalReserva: subtotalSinIva,
      valorIva: valorIvaCalc,
      totalReserva: totalConIva,
      origenCanalReserva: 'BOOKING',
      contactoEmail: form.value.correo.trim(),
      contactoTelefono: form.value.telefono.trim(),
      detalles: [
        {
          idPasajero: idPasajeroNum,
          idAsiento: idAsientoNum,
          subtotalLinea: subtotalSinIva,
          valorIvaLinea: valorIvaCalc,
          totalLinea: totalConIva,
        },
      ],
    }

    const reservaResp = await createReservaApi(payloadReserva, SKIP_GLOBAL_AUTH_REDIRECT)
    const reservaData = reservaResp.data?.data || {}
    const idReserva = Number(reservaData.idReserva ?? reservaData.id_reserva ?? reservaData.id ?? 0)

    if (!idReserva) throw new Error('No se obtuvo el id de la reserva.')

    const detallesNorm = normalizarDetallesReserva(reservaResp.data?.data || reservaResp.data)
    const detalle =
      detallesNorm.find(
        (d) =>
          String(d.idPasajero) === String(idPasajeroNum) && String(d.idAsiento) === String(idAsientoNum),
      ) || detallesNorm[0]

    if (!detalle?.idDetalle)
      throw new Error('No se pudo obtener el detalle de la reserva para el pago.')

    const equipajeParaPagar = equipajeDraft.value.equipajeBodega
      ? [
          {
            idDetalle: detalle.idDetalle,
            tipo: 'BODEGA',
            pesoKg: 23,
            descripcionEquipaje: 'Maleta de bodega',
          },
        ]
      : []

    await pagarReservaApi(
      idReserva,
      {
        cargoServicio: CARGO_SERVICIO,
        equipaje: equipajeParaPagar,
      },
      SKIP_GLOBAL_AUTH_REDIRECT,
    )

    limpiarProgresoAerolinea()

    mostrarBannerExitoReserva.value = true
    const inicioSitio = `${window.location.origin}/`
    window.setTimeout(() => {
      window.location.href = inicioSitio
    }, MS_ANTES_REDIRECCION_EXITO)
  } catch (err) {
    errorOperacion.value =
      err.response?.data?.message ||
      err.response?.data?.errors?.join?.(' ') ||
      err.message ||
      'No se pudo completar el pago.'
  } finally {
    procesandoPago.value = false
  }
}

onMounted(() => {
  cargarDatosIniciales()
})
</script>

<template>
  <div class="relative min-h-[calc(100vh-4rem)] bg-background py-10">
    <div
      v-if="mostrarBannerExitoReserva"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
    >
      <div
        class="max-w-[min(94vw,36rem)] rounded-[32px] border-4 border-emerald-400 bg-emerald-50 px-8 py-14 text-center shadow-2xl sm:px-14 sm:py-16"
      >
        <p class="text-4xl font-black leading-tight tracking-tight text-emerald-950 sm:text-5xl md:text-6xl">
          ¡Reserva creada con éxito!
        </p>
        <p class="mt-8 text-xl font-semibold text-emerald-900 sm:text-2xl md:text-3xl">
          Te llevamos al inicio…
        </p>
      </div>
    </div>
    <!-- Modal autenticación -->
    <div
      v-if="modalAuthVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-auth-aerolinea"
    >
      <div class="max-w-md rounded-[28px] border border-red-100 bg-white p-6 shadow-2xl">
        <h2 id="titulo-auth-aerolinea" class="text-xl font-extrabold text-text-main">{{ textoTituloModalAuth }}</h2>
        <p class="mt-3 text-sm text-text-muted">{{ textoCuerpoModalAuth }}</p>
        <div class="mt-6 grid gap-3">
          <button
            type="button"
            class="w-full rounded-2xl bg-[#d71920] px-4 py-3 text-sm font-bold text-white hover:bg-[#b9151b]"
            @click="irLoginConProgreso"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            class="w-full rounded-2xl border-2 border-red-100 px-4 py-3 text-sm font-semibold text-[#d71920] hover:bg-red-50"
            @click="irRegistroConProgreso"
          >
            Crear cuenta (registro)
          </button>
          <button
            type="button"
            class="w-full rounded-2xl py-3 text-sm text-text-muted hover:bg-slate-50"
            @click="cerrarModalAuth"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <header class="mb-8 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-[#d71920]/80">NachoFlights · Aerolinea</p>
        <h1 class="mt-2 text-3xl font-extrabold text-text-main">Completa tu reserva</h1>
        <p class="mt-2 text-sm text-text-muted">
          El progreso (asiento, formulario y token) queda guardado localmente hasta el pago. Si inicias sesión o te
          registras seguimos desde aquí mismo.
        </p>
      </header>

      <div
        v-if="errorFatal"
        class="rounded-[24px] border border-red-200 bg-red-50 px-6 py-5 text-center text-sm font-medium text-[#b9151b]"
      >
        {{ errorFatal }}
      </div>

      <template v-else>
        <div v-if="cargandoInicial" class="flex justify-center py-20">
          <div class="h-12 w-12 animate-spin rounded-full border-4 border-red-100 border-t-[#d71920]" />
        </div>

        <template v-else-if="claims?.idVuelo && vuelo">
          <nav class="mb-8 flex flex-wrap justify-center gap-2">
            <div
              v-for="n in PASO_MAX"
              :key="n"
              class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors"
              :class="
                pasoActual === n
                  ? 'bg-[#d71920] text-white shadow-lg shadow-red-200'
                  : pasoActual > n
                    ? 'bg-red-100 text-[#d71920]'
                    : 'bg-red-50 text-text-muted'
              "
              :title="`Paso ${n}`"
            >
              {{ n }}
            </div>
          </nav>

          <p class="mb-6 text-center text-xs text-text-muted">Asiento · Pasajero · Resumen/equipaje · Pago</p>

          <div
            v-if="errorOperacion"
            class="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b9151b]"
          >
            {{ errorOperacion }}
          </div>

          <!-- Mini resumen vuelo (visible durante el flujo) -->
          <div
            class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm shadow-sm"
          >
            <div>
              <span class="font-bold text-text-main">{{ vuelo.codigoOrigen }} → {{ vuelo.codigoDestino }}</span>
              <span class="text-text-muted"> · {{ vuelo.numeroVuelo || '—' }} · {{ fechaHoraLegible(vuelo.fechaHoraSalida) }}</span>
            </div>
            <span class="font-semibold text-[#d71920]">{{ moneda(vuelo.precioBase) }} base</span>
          </div>

          <!-- Paso 1: Asiento -->
          <section v-show="pasoActual === PASO_ASIENTO" class="overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-xl">
            <div class="bg-gradient-to-r from-[#d71920] to-[#9f1117] px-6 py-6 text-white lg:px-8">
              <h2 class="text-xl font-extrabold">1 · Selecciona tu asiento</h2>
              <p class="mt-1 text-sm text-white/82">Opciones ocupadas están bloqueadas.</p>
            </div>

            <div class="mx-4 mt-4 mb-4 grid gap-3 text-center text-sm sm:mx-8 sm:grid-cols-3">
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p class="text-xs uppercase text-text-muted">Total cabinas</p>
                <p class="mt-1 text-xl font-bold">{{ resumenMapaFijo.total }}</p>
              </div>
              <div class="rounded-2xl bg-emerald-50 px-4 py-3">
                <p class="text-xs uppercase text-text-muted">Disponibles</p>
                <p class="mt-1 text-xl font-bold text-emerald-700">{{ resumenMapaFijo.disponibles }}</p>
              </div>
              <div class="rounded-2xl bg-red-50/60 px-4 py-3">
                <p class="text-xs uppercase text-text-muted">Tu asiento</p>
                <p class="mt-1 font-semibold text-[#d71920]">
                  {{ asientoSeleccionado ? asientoSeleccionado.numeroAsiento : '—' }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-5 px-6 pb-4 text-sm">
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

            <div class="flex justify-center px-4 pb-4">
              <div class="rounded-t-[48px] bg-[#d71920] px-10 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-red-200">
                Cabina · {{ vuelo.numeroVuelo }}
              </div>
            </div>

            <div class="overflow-x-auto px-4 pb-6 sm:px-8">
              <div class="mx-auto min-w-[430px] max-w-[560px] rounded-b-[52px] border-x-8 border-b-8 border-slate-200 bg-white px-5 pb-8 pt-4 shadow-inner">
                <div
                  class="mb-3 grid grid-cols-[32px_repeat(3,40px)_28px_repeat(3,40px)] items-center gap-3 text-center text-xs font-semibold text-text-muted"
                >
                  <span />
                  <span
                    v-for="columna in columnasCabina"
                    :key="`h-${columna}`"
                    :class="{ 'col-start-6': columna === 'D' }"
                  >
                    {{ columna }}
                  </span>
                </div>

                <div
                  v-for="fila in filasVisibles"
                  :key="fila"
                  class="grid grid-cols-[32px_repeat(3,40px)_28px_repeat(3,40px)] items-center gap-3 py-1"
                >
                  <span class="text-right text-sm text-text-muted">{{ fila }}</span>
                  <template v-for="columna in columnasCabina" :key="`${fila}-${columna}`">
                    <div v-if="columna === 'D'" class="w-4" />
                    <button
                      type="button"
                      :disabled="['ocupado'].includes(estadoAsientoVisual(asientoPorPosicion(fila, columna)))"
                      class="group relative flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition"
                      :class="{
                        'cursor-pointer border-emerald-200 bg-emerald-50 text-navy hover:bg-emerald-100':
                          estadoAsientoVisual(asientoPorPosicion(fila, columna)) === 'disponible',
                        'cursor-pointer border-[#d71920] bg-[#d71920] text-white shadow-md':
                          estadoAsientoVisual(asientoPorPosicion(fila, columna)) === 'seleccionado',
                        'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400':
                          estadoAsientoVisual(asientoPorPosicion(fila, columna)) === 'ocupado',
                      }"
                      @click="seleccionarAsiento(asientoPorPosicion(fila, columna))"
                    >
                      <span
                        v-if="estadoAsientoVisual(asientoPorPosicion(fila, columna)) === 'seleccionado'"
                        class="text-base"
                      >
                        ✓
                      </span>
                      <span v-else>{{ columna }}</span>
                      <span
                        v-if="estadoAsientoVisual(asientoPorPosicion(fila, columna)) === 'ocupado'"
                        class="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-md bg-slate-300/85 text-base text-slate-500 group-hover:flex"
                      >
                        ⃠
                      </span>
                    </button>
                  </template>
                </div>
              </div>
            </div>

            <div class="flex justify-end border-t border-red-50 px-6 py-6">
              <button
                type="button"
                class="rounded-2xl bg-[#d71920] px-8 py-3 text-sm font-bold text-white shadow-md hover:bg-[#b9151b]"
                @click="continuarSeleccionAHaciaSesion"
              >
                Continuar →
              </button>
            </div>
          </section>

          <!-- Paso 2: Pasajero -->
          <section v-show="pasoActual === PASO_PASAJERO" class="overflow-hidden rounded-[28px] border border-red-100 bg-white p-6 shadow-xl sm:p-8">
            <h2 class="text-xl font-extrabold text-text-main">2 · Datos del pasajero</h2>
            <p class="mt-1 text-sm text-text-muted">Al continuar guardamos los datos del pasajero asociados a tu cuenta.</p>

            <div class="mt-6 grid gap-5 md:grid-cols-2">
              <InputApp v-model="form.nombres" label="Nombres" :error="erroresForm.nombres" requerido />
              <InputApp v-model="form.apellidos" label="Apellidos" :error="erroresForm.apellidos" requerido />
              <SelectApp
                v-model="form.tipo_identificacion"
                label="Tipo de documento"
                :opciones="opcionesTipoDocumento"
                :error="erroresForm.tipo_identificacion"
                requerido
              />
              <InputApp
                v-model="form.numero_identificacion"
                label="Número de documento"
                :inputmode="esTipoDocumentoSoloDigitos(form.tipo_identificacion) ? 'numeric' : 'text'"
                :maxlength="limiteDocumento(form.tipo_identificacion)"
                :filtro-solo-digitos="esTipoDocumentoSoloDigitos(form.tipo_identificacion)"
                :error="erroresForm.numero_identificacion"
                requerido
              />
              <InputApp
                v-model="form.fecha_nacimiento"
                label="Fecha de nacimiento"
                tipo="date"
                :max="new Date().toISOString().split('T')[0]"
                :error="erroresForm.fecha_nacimiento"
                requerido
              />
              <SelectApp
                v-model="form.id_pais_nacionalidad"
                label="País"
                placeholder="Seleccionar país..."
                :opciones="opcionesPaises"
                :error="erroresForm.id_pais_nacionalidad"
                :cargando="catalogos.cargandoPaises"
                requerido
              />
              <InputApp v-model="form.correo" label="Email" tipo="email" :error="erroresForm.correo" requerido />
              <InputApp
                v-model="form.telefono"
                label="Teléfono"
                tipo="tel"
                inputmode="numeric"
                maxlength="10"
                filtro-solo-digitos
                :error="erroresForm.telefono"
                requerido
              />
            </div>

            <div class="mt-8 flex flex-wrap gap-3">
              <button type="button" class="rounded-2xl border border-red-100 px-6 py-3 font-semibold text-[#d71920]" @click="irAPaso(PASO_ASIENTO)">
                ← Volver
              </button>
              <button
                type="button"
                class="rounded-2xl bg-[#d71920] px-8 py-3 text-sm font-bold text-white disabled:opacity-50"
                :disabled="procesandoPasajero"
                @click="enviarPasajeroYIrAResumen"
              >
                {{ procesandoPasajero ? 'Guardando…' : 'Guardar pasajero y ver resumen →' }}
              </button>
            </div>
          </section>

          <!-- Paso 3: Resumen equipaje -->
          <section v-show="pasoActual === PASO_RESUMEN" class="overflow-hidden rounded-[28px] border border-red-100 bg-white p-6 shadow-xl sm:p-8">
            <h2 class="text-xl font-extrabold text-text-main">3 · Resumen y equipaje</h2>

            <div class="mt-6 space-y-4 rounded-2xl bg-red-50/70 px-5 py-4 text-sm">
              <div>
                <p class="font-semibold">{{ vuelo.codigoOrigen }} → {{ vuelo.codigoDestino }}</p>
                <p class="text-text-muted">{{ fechaHoraLegible(vuelo.fechaHoraSalida) }}</p>
              </div>
              <p>
                <span class="text-text-muted">Asiento:</span>
                {{ asientoSeleccionado?.numeroAsiento }} · {{ claseLegible(asientoSeleccionado?.clase) }}
              </p>
              <p>
                <span class="text-text-muted">Pasajero:</span>
                {{ [form.nombres, form.apellidos].filter(Boolean).join(' ') }} · {{ form.correo }}
              </p>
              <hr class="border-red-100" />

              <ul class="space-y-1 text-text-muted">
                <li>Precio vuelo: {{ moneda(precioBaseNum) }}</li>
                <li>Precio asiento: {{ moneda(precioExtraAsiento) }}</li>
                <li v-if="equipajeDraft.equipajeBodega">Maleta bodega: {{ moneda(COSTO_BODEGA) }}</li>
              </ul>
              <div class="border-t border-red-100 pt-2">
                <p>Subtotal: {{ moneda(subtotalLineaSinIva) }}</p>
                <p class="text-xs">IVA 15%: {{ moneda(ivaLinea) }}</p>
              </div>
              <p class="text-lg font-semibold text-[#d71920]">Total: {{ moneda(totalLinea) }}</p>
            </div>

            <label class="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3">
              <input
                v-model="equipajeDraft.equipajeBodega"
                type="checkbox"
                class="mt-1 h-4 w-4 rounded border-red-200 text-[#d71920] focus:ring-[#d71920]"
              />
              <span class="text-sm">Equipaje de bodega (23&nbsp;kg) — {{ moneda(COSTO_BODEGA) }}</span>
            </label>

            <div class="mt-8 flex flex-wrap gap-3">
              <button type="button" class="rounded-2xl border border-red-100 px-6 py-3 font-semibold text-[#d71920]" @click="correccionPasajeroDesdeResumen">
                ← Corregir pasajero
              </button>
              <button
                type="button"
                class="rounded-2xl bg-[#d71920] px-8 py-3 text-sm font-bold text-white"
                @click="irDeResumenAHaciaPagar"
              >
                Siguiente: crear reserva / pago →
              </button>
            </div>
          </section>

          <!-- Paso 4: crear + pagar -->
          <section v-show="pasoActual === PASO_PAGO" class="overflow-hidden rounded-[28px] border border-red-100 bg-white p-6 shadow-xl sm:p-8">
            <h2 class="text-xl font-extrabold text-text-main">4 · Crear y pagar</h2>
            <p class="mt-2 text-sm text-text-muted">
              Confirmamos la reserva con los mismos montos del resumen y procesamos el pago. Si no marcaste maleta de bodega,
              no se añade equipaje extra.
            </p>

            <div class="mt-6 rounded-2xl border border-red-100 bg-white p-5 text-center">
              <p class="text-sm text-text-muted">Total confirmado</p>
              <p class="mt-2 text-3xl font-extrabold text-[#d71920]">{{ moneda(totalLinea) }}</p>
            </div>

            <div class="mt-8 flex flex-wrap gap-3">
              <button type="button" class="rounded-2xl border border-red-100 px-6 py-3 font-semibold text-[#d71920]" @click="irAPaso(PASO_RESUMEN)">
                ← Volver al resumen
              </button>
              <button
                type="button"
                class="rounded-2xl bg-[#d71920] px-8 py-4 text-sm font-bold text-white disabled:opacity-50"
                :disabled="procesandoPago"
                @click="crearReservaYPagar"
              >
                {{ procesandoPago ? 'Procesando…' : 'Pagar reserva' }}
              </button>
            </div>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>
