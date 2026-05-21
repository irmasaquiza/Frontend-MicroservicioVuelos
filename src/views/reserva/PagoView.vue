<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { registerClienteApi } from '@/api/autenticacion.api'
import { getClienteApi } from '@/api/clientes.api'
import { createPasajeroApi } from '@/api/pasajeros.api'
import { createReservaApi, pagarReservaApi } from '@/api/reservas.api'
import InputApp from '@/components/base/InputApp.vue'
import SelectApp from '@/components/base/SelectApp.vue'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import { useAutenticacionStore } from '@/stores/autenticacion.store'
import { useCatalogosStore } from '@/stores/catalogos.store'
import { useReservaStore } from '@/stores/reserva.store'
import { guardarPortalReserva } from '@/utils/portalCliente'
import {
  esTipoDocumentoSoloDigitos,
  limiteDocumento,
  normalizarDocumento,
  normalizarTelefono,
  validarDocumentoPorTipo,
  validarTelefono,
} from '@/utils/validacionesCampos'

const router = useRouter()
const auth = useAutenticacionStore()
const catalogos = useCatalogosStore()
const reserva = useReservaStore()

const COSTO_BODEGA = 45
const CARGO_SERVICIO = 0
const IVA = 0.15
const FECHA_HOY = new Date().toISOString().split('T')[0]
const KEY_CONFIRMACION = 'mpas_confirmacion'

const mostrarModalAuth = ref(false)
const tabAuth = ref('login')
const errorPago = ref('')
const errorAuth = ref('')
const procesandoPago = ref(false)
const cargandoCiudades = ref(false)
const estadoProceso = ref('')
const ciudades = ref([])
const idClienteRecienRegistrado = ref(null)

const loginForm = ref({
  username: '',
  password: '',
})

const registerForm = ref({
  tipo_identificacion: 'CEDULA',
  numero_identificacion: '',
  nombres: '',
  apellidos: '',
  correo: '',
  telefono: '',
  direccion: '',
  id_pais_nacionalidad: '',
  id_pais_residencia: '',
  id_ciudad_residencia: '',
  fecha_nacimiento: '',
  genero: 'MASCULINO',
  username: '',
  password: '',
  confirmar_password: '',
})

const erroresRegistro = ref({})

const vuelo = computed(() => reserva.vuelo)
const pasajeros = computed(() => reserva.pasajeros || [])
const asientos = computed(() => reserva.asientos || [])
const equipaje = computed(() => reserva.equipaje || [])

const opcionesPaises = computed(() =>
  catalogos.paises.map((pais) => ({
    valor: String(pais.idPais ?? pais.id_pais ?? pais.id),
    etiqueta: String(pais.nombre ?? pais.nombre_pais ?? '').replace(/\d{6,}$/u, '').trim(),
  })),
)

const opcionesCiudades = computed(() =>
  ciudades.value.map((ciudad) => ({
    valor: String(ciudad.idCiudad ?? ciudad.id_ciudad ?? ciudad.id),
    etiqueta: String(ciudad.nombre ?? '').replace(/\d{6,}$/u, '').trim(),
  })),
)

const opcionesTipoIdentificacion = [
  { valor: 'CEDULA', etiqueta: 'Cedula' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
  { valor: 'RUC', etiqueta: 'RUC' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const opcionesGenero = [
  { valor: 'MASCULINO', etiqueta: 'Masculino' },
  { valor: 'FEMENINO', etiqueta: 'Femenino' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const totalBodega = computed(() =>
  equipaje.value.reduce((acc, item) => acc + (item.equipajeBodega ? COSTO_BODEGA : 0), 0),
)

const subtotalVuelo = computed(() =>
  asientos.value.reduce((acc, asiento) => {
    const base = Number(vuelo.value?.precioBase || 0)
    const extra = Number(asiento?.precioExtra || 0)
    return acc + base + extra
  }, 0),
)

const subtotalGeneral = computed(() => subtotalVuelo.value + totalBodega.value)
const ivaGeneral = computed(() => Number((subtotalGeneral.value * IVA).toFixed(2)))
const totalPagar = computed(() => Number((subtotalGeneral.value + ivaGeneral.value + CARGO_SERVICIO).toFixed(2)))

const itemsPago = computed(() =>
  pasajeros.value.map((pasajero, indice) => {
    const asiento = asientos.value[indice] || null
    const bag = equipaje.value[indice] || null
    const subtotalLinea = Number(vuelo.value?.precioBase || 0) + Number(asiento?.precioExtra || 0)

    return {
      indice,
      nombre: [pasajero.nombre_pasajero, pasajero.apellido_pasajero].filter(Boolean).join(' ') || `Pasajero ${indice + 1}`,
      pasajero,
      asiento,
      equipaje: bag,
      subtotalLinea,
      ivaLinea: Number((subtotalLinea * IVA).toFixed(2)),
      totalLinea: Number((subtotalLinea * (1 + IVA)).toFixed(2)),
    }
  }),
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

function horaLegible(valor) {
  if (!valor) return '--:--'
  return new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(valor))
}

function duracionLegible(minutos) {
  const total = Number(minutos || 0)
  const horas = Math.floor(total / 60)
  const mins = total % 60
  if (!horas) return `${mins}m`
  if (!mins) return `${horas}h`
  return `${horas}h ${mins}m`
}

function limpiarModal() {
  errorAuth.value = ''
  erroresRegistro.value = {}
}

function persistirPasajeroBackend(indice, idPasajero) {
  const actualizados = pasajeros.value.map((pasajero, idx) =>
    idx === indice
      ? {
          ...pasajero,
          id_pasajero_backend: idPasajero,
        }
      : pasajero,
  )

  reserva.setPasajeros(actualizados)
}

function parseJwtPayload(token) {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

watch(
  () => registerForm.value.id_pais_residencia,
  async (idPais) => {
    registerForm.value.id_ciudad_residencia = ''
    ciudades.value = []
    if (!idPais) return
    cargandoCiudades.value = true
    try {
      ciudades.value = await catalogos.cargarCiudadesPorPais(idPais, true)
    } catch {
      ciudades.value = []
    } finally {
      cargandoCiudades.value = false
    }
  },
)

watch(
  [() => registerForm.value.tipo_identificacion, () => registerForm.value.numero_identificacion],
  () => {
    const normalizado = normalizarDocumento(registerForm.value.tipo_identificacion, registerForm.value.numero_identificacion)
    if (registerForm.value.numero_identificacion !== normalizado) registerForm.value.numero_identificacion = normalizado
  },
)

watch(
  () => registerForm.value.telefono,
  (valor) => {
    const normalizado = normalizarTelefono(valor)
    if (registerForm.value.telefono !== normalizado) registerForm.value.telefono = normalizado
  },
)

function abrirAutenticacion(tab = 'login') {
  tabAuth.value = tab
  mostrarModalAuth.value = true
  limpiarModal()
}

function cerrarAutenticacion() {
  if (procesandoPago.value) return
  mostrarModalAuth.value = false
  limpiarModal()
}

function obtenerValorProfundo(obj, claves) {
  for (const clave of claves) {
    if (obj?.[clave] !== undefined && obj?.[clave] !== null) return obj[clave]
  }

  for (const valor of Object.values(obj || {})) {
    if (valor && typeof valor === 'object') {
      const encontrado = obtenerValorProfundo(valor, claves)
      if (encontrado !== undefined && encontrado !== null) return encontrado
    }
  }

  return null
}

function obtenerIdClienteAutenticado() {
  return Number(
    obtenerValorProfundo(auth.usuario, [
      'idCliente',
      'id_cliente',
      'clienteId',
      'cliente_id',
      'id',
    ]) || 0,
  )
}

async function resolverIdClienteAutenticado() {
  const directos = [
    idClienteRecienRegistrado.value,
    obtenerIdClienteAutenticado(),
  ]

  const payload = parseJwtPayload(auth.token || '')
  const candidatosPayload = [
    payload?.idCliente,
    payload?.id_cliente,
    payload?.clienteId,
    payload?.cliente_id,
    payload?.sub,
    payload?.nameid,
    payload?.sid,
    payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
  ]

  const candidatos = [...directos, ...candidatosPayload]
    .map((valor) => Number(valor || 0))
    .filter((valor, index, arr) => Number.isFinite(valor) && valor > 0 && arr.indexOf(valor) === index)

  for (const candidato of candidatos) {
    try {
      const { data } = await getClienteApi(candidato)
      const cliente = data?.data || {}
      const idCliente = Number(cliente.idCliente ?? cliente.id_cliente ?? cliente.id ?? candidato)
      if (idCliente > 0) return idCliente
    } catch {
      // Seguimos probando candidatos posibles del token o del usuario autenticado.
    }
  }

  return 0
}

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

function validarRegistro() {
  const e = {}
  const correo = registerForm.value.correo.trim()
  const errorDocumento = validarDocumentoPorTipo(
    registerForm.value.tipo_identificacion,
    registerForm.value.numero_identificacion,
    'identificacion',
  )
  const errorTelefono = validarTelefono(registerForm.value.telefono)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (!registerForm.value.tipo_identificacion) e.tipo_identificacion = 'Selecciona el tipo.'
  if (errorDocumento) e.numero_identificacion = errorDocumento
  if (!registerForm.value.nombres.trim()) e.nombres = 'Requerido.'
  if (!registerForm.value.apellidos.trim()) e.apellidos = 'Requerido.'
  if (!correo) e.correo = 'Requerido.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) e.correo = 'Correo invalido.'
  if (errorTelefono) e.telefono = errorTelefono
  if (!registerForm.value.direccion.trim()) e.direccion = 'Requerido.'
  if (!registerForm.value.id_pais_nacionalidad) e.id_pais_nacionalidad = 'Selecciona la nacionalidad.'
  if (!registerForm.value.id_pais_residencia) e.id_pais_residencia = 'Selecciona el pais.'
  if (!registerForm.value.id_ciudad_residencia) e.id_ciudad_residencia = 'Selecciona la ciudad.'
  if (!registerForm.value.fecha_nacimiento) {
    e.fecha_nacimiento = 'Selecciona la fecha.'
  } else {
    const fechaNacimiento = new Date(`${registerForm.value.fecha_nacimiento}T00:00:00`)
    if (fechaNacimiento > hoy) e.fecha_nacimiento = 'La fecha no puede ser futura.'
  }
  if (!registerForm.value.genero) e.genero = 'Selecciona el genero.'
  if (!registerForm.value.username.trim()) e.username = 'Requerido.'
  if (!registerForm.value.password) e.password = 'Requerido.'
  else if (registerForm.value.password.length < 8) e.password = 'Minimo 8 caracteres.'
  if (!registerForm.value.confirmar_password) e.confirmar_password = 'Requerido.'
  else if (registerForm.value.password !== registerForm.value.confirmar_password) e.confirmar_password = 'Las contrasenas no coinciden.'

  erroresRegistro.value = e
  return !Object.keys(e).length
}

async function autenticarYProcesar() {
  if (procesandoPago.value) return
  procesandoPago.value = true
  errorAuth.value = ''
  errorPago.value = ''

  try {
    estadoProceso.value = 'Autenticando...'
    await auth.login(
      {
        username: loginForm.value.username.trim(),
        password: loginForm.value.password,
      },
      true,
    )
  } catch (error) {
    errorAuth.value = error.response?.data?.message || 'No se pudo iniciar sesion.'
    estadoProceso.value = ''
    procesandoPago.value = false
    return
  }

  mostrarModalAuth.value = false

  try {
    await ejecutarCompraReal()
  } finally {
    procesandoPago.value = false
  }
}

async function registrarYProcesar() {
  if (procesandoPago.value || !validarRegistro()) return
  procesandoPago.value = true
  errorAuth.value = ''
  errorPago.value = ''

  try {
    estadoProceso.value = 'Creando cuenta...'
    const registroResp = await registerClienteApi({
      tipoIdentificacion: registerForm.value.tipo_identificacion,
      numeroIdentificacion: registerForm.value.numero_identificacion.trim(),
      nombres: registerForm.value.nombres.trim(),
      apellidos: registerForm.value.apellidos.trim(),
      correo: registerForm.value.correo.trim(),
      telefono: registerForm.value.telefono.trim(),
      direccion: registerForm.value.direccion.trim(),
      idCiudadResidencia: Number(registerForm.value.id_ciudad_residencia),
      idPaisNacionalidad: Number(registerForm.value.id_pais_nacionalidad),
      fechaNacimiento: registerForm.value.fecha_nacimiento,
      genero: registerForm.value.genero,
      username: registerForm.value.username.trim(),
      password: registerForm.value.password,
    })
    const registroData = registroResp.data?.data || {}
    idClienteRecienRegistrado.value = Number(
      registroData.idCliente ?? registroData.id_cliente ?? registroData.id ?? 0,
    ) || null
  } catch (error) {
    errorAuth.value = error.response?.data?.message || 'No se pudo crear la cuenta.'
    estadoProceso.value = ''
    procesandoPago.value = false
    return
  }

  try {
    estadoProceso.value = 'Autenticando...'
    await auth.login(
      {
        username: registerForm.value.username.trim(),
        password: registerForm.value.password,
      },
      true,
    )
  } catch (error) {
    errorAuth.value = error.response?.data?.message || 'La cuenta fue creada, pero no se pudo iniciar sesion.'
    estadoProceso.value = ''
    procesandoPago.value = false
    return
  }

  mostrarModalAuth.value = false

  try {
    await ejecutarCompraReal()
  } finally {
    procesandoPago.value = false
  }
}

async function ejecutarCompraReal() {
  const idCliente = await resolverIdClienteAutenticado()
  if (!idCliente) {
    estadoProceso.value = ''
    errorPago.value = 'No se pudo identificar el cliente autenticado para crear la reserva.'
    return
  }

  try {
    estadoProceso.value = 'Creando pasajeros...'
    const pasajerosCreados = []

    for (const item of itemsPago.value) {
      let idPasajero = Number(item.pasajero.id_pasajero_backend || 0)

      if (!idPasajero) {
        const payloadPasajero = {
          idCliente,
          nombrePasajero: item.pasajero.nombre_pasajero.trim(),
          apellidoPasajero: item.pasajero.apellido_pasajero.trim(),
          tipoDocumentoPasajero: item.pasajero.tipo_documento_pasajero,
          numeroDocumentoPasajero: item.pasajero.numero_documento_pasajero.trim(),
          fechaNacimientoPasajero: item.pasajero.fecha_nacimiento_pasajero,
          idPaisNacionalidad: Number(item.pasajero.id_pais_nacionalidad || 0),
          emailContactoPasajero: item.pasajero.email_contacto_pasajero.trim(),
          telefonoContactoPasajero: item.pasajero.telefono_contacto_pasajero.trim(),
          generoPasajero: item.pasajero.genero_pasajero,
          requiereAsistencia: Boolean(item.pasajero.requiere_asistencia),
          observacionesPasajero: item.pasajero.observaciones_pasajero?.trim() || null,
        }

        const { data } = await createPasajeroApi(payloadPasajero)
        const pasajeroReal = data?.data || {}
        idPasajero = pasajeroReal.idPasajero ?? pasajeroReal.id_pasajero ?? pasajeroReal.id

        if (idPasajero) {
          persistirPasajeroBackend(item.indice, idPasajero)
        }
      }

      if (!idPasajero) throw new Error('No se pudo obtener el id del pasajero creado.')

      pasajerosCreados.push({
        tempIndex: item.indice,
        idPasajero,
        idAsiento: item.asiento?.idAsiento,
        subtotalLinea: item.subtotalLinea,
        ivaLinea: item.ivaLinea,
        totalLinea: item.totalLinea,
      })
    }

    estadoProceso.value = 'Generando reserva...'
    const idVueloReserva = Number(vuelo.value?.idVuelo ?? vuelo.value?.id_vuelo ?? vuelo.value?.id ?? 0)
    const payload = {
      idCliente,
      idVuelo: idVueloReserva,
      fechaInicio: vuelo.value.fechaHoraSalida,
      fechaFin: vuelo.value.fechaHoraLlegada,
      subtotalReserva: subtotalVuelo.value,
      valorIva: Number((subtotalVuelo.value * IVA).toFixed(2)),
      totalReserva: Number((subtotalVuelo.value * (1 + IVA)).toFixed(2)),
      origenCanalReserva: 'BOOKING',
      contactoEmail: pasajeros.value[0]?.email_contacto_pasajero || registerForm.value.correo || auth.usuario?.correo,
      contactoTelefono: pasajeros.value[0]?.telefono_contacto_pasajero || registerForm.value.telefono,
      observaciones: 'Reserva web',
      detalles: pasajerosCreados.map((item) => ({
        idPasajero: item.idPasajero,
        idAsiento: item.idAsiento,
        subtotalLinea: item.subtotalLinea,
        valorIvaLinea: item.ivaLinea,
        totalLinea: item.totalLinea,
      })),
    }

    console.log('PAYLOAD RESERVA:', JSON.stringify(payload))

    const reservaResp = await createReservaApi(payload)
    const reservaReal = reservaResp.data?.data || {}
    const idReserva = reservaReal.idReserva ?? reservaReal.id_reserva ?? reservaReal.id

    if (!idReserva) throw new Error('No se pudo obtener el id_reserva de la reserva creada.')

    const detalles = normalizarDetallesReserva(reservaResp.data?.data || reservaResp.data)

    estadoProceso.value = 'Procesando pago...'
    const equipajePayload = []

    for (const item of itemsPago.value) {
      const pasajeroCreado = pasajerosCreados[item.indice]
      const detalle =
        detalles.find(
          (d) =>
            String(d.idPasajero) === String(pasajeroCreado?.idPasajero) &&
            String(d.idAsiento) === String(item.asiento?.idAsiento),
        ) || detalles[item.indice]

      if (!detalle?.idDetalle) throw new Error('No se pudo asociar el id_detalle para el equipaje.')

      if (item.equipaje?.equipajeBodega) {
        equipajePayload.push({
          idDetalle: detalle.idDetalle,
          tipo: 'BODEGA',
          pesoKg: 23,
          descripcionEquipaje: 'Maleta de bodega',
        })
      }
    }

    await pagarReservaApi(idReserva, {
      cargoServicio: CARGO_SERVICIO,
      equipaje: equipajePayload,
    })

    const payloadConfirmacion = {
      idReserva,
      numeroVuelo: vuelo.value.numeroVuelo,
      codigoReserva: vuelo.value.numeroVuelo,
      fecha: vuelo.value.fechaHoraSalida,
      horario: `${horaLegible(vuelo.value.fechaHoraSalida)} - ${horaLegible(vuelo.value.fechaHoraLlegada)}`,
      ruta: `${vuelo.value.codigoOrigen || ''} - ${vuelo.value.codigoDestino || ''}`.trim(),
      tarifaVuelo: subtotalVuelo.value,
      equipajeBodegaTotal: totalBodega.value,
      subtotalGeneral: subtotalGeneral.value,
      ivaGeneral: ivaGeneral.value,
      cargoServicio: CARGO_SERVICIO,
      totalPagado: totalPagar.value,
      pasajeros: itemsPago.value.map((item) => ({
        nombre: item.nombre,
        documento: item.pasajero.numero_documento_pasajero,
        asiento: item.asiento?.numeroAsiento || '',
        email: item.pasajero.email_contacto_pasajero || '',
        telefono: item.pasajero.telefono_contacto_pasajero || '',
        equipajeBodega: Boolean(item.equipaje?.equipajeBodega),
      })),
    }

    sessionStorage.setItem(KEY_CONFIRMACION, JSON.stringify(payloadConfirmacion))
    guardarPortalReserva(payloadConfirmacion)

    idClienteRecienRegistrado.value = null
    estadoProceso.value = ''
    reserva.limpiar()
    router.push({ name: 'confirmacion-reserva' })
  } catch (error) {
    estadoProceso.value = ''
    errorPago.value = error.response?.data?.message || error.message || 'No se pudo completar el pago.'
  }
}

async function handlePagar() {
  errorPago.value = ''

  if (!auth.estaAutenticado) {
    abrirAutenticacion('login')
    return
  }

  if (procesandoPago.value) return
  procesandoPago.value = true

  try {
    await ejecutarCompraReal()
  } finally {
    procesandoPago.value = false
  }
}

onMounted(async () => {
  if (!vuelo.value) {
    router.replace({ name: 'buscar-vuelos' })
    return
  }

  if (!pasajeros.value.length) {
    router.replace({ name: 'datos-pasajeros' })
    return
  }

  if (!asientos.value.length) {
    router.replace({ name: 'seleccion-asientos' })
    return
  }

  await catalogos.cargarPaises(true).catch(() => {})
})
</script>

<template>
  <div>
    <CheckoutStepper :paso-actual="5" />

    <section class="min-h-[calc(100vh-64px)] bg-background py-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#d71920] via-[#c5161d] to-[#8f1116] p-6 text-white shadow-xl shadow-red-200/50 sm:p-8">
          <div class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.32em] text-white/70">Pasarela NachoFlights</p>
              <h1 class="mt-3 text-4xl font-extrabold sm:text-5xl">Ya casi despegas, ñaño</h1>
              <p class="mt-4 max-w-2xl text-lg leading-8 text-white/85">
                Revisa tu ruta, confirma tus pasajeros y paga de una. Todo clarito, sin vueltas y con sabor ecuatoriano.
              </p>
            </div>

            <div class="rounded-[28px] border border-white/20 bg-white p-6 text-navy shadow-2xl">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Total listo para pagar</p>
              <p class="mt-3 text-5xl font-extrabold text-[#d71920]">{{ moneda(totalPagar) }}</p>
              <p class="mt-2 text-sm text-text-muted">Incluye tarifa, extras e IVA Ecuador 15%.</p>
            </div>
          </div>
        </div>

        <div v-if="errorPago" class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ errorPago }}
        </div>

        <div v-if="estadoProceso" class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-blue-accent">
          {{ estadoProceso }}
        </div>

        <div class="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.25fr]">
          <aside class="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <section class="overflow-hidden rounded-[30px] bg-white shadow-sm">
              <div class="bg-[#d71920] px-6 py-5 text-white">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Tu ruta chulla</p>
                <h2 class="mt-2 text-3xl font-extrabold">{{ vuelo.codigoOrigen || 'Origen' }} → {{ vuelo.codigoDestino || 'Destino' }}</h2>
              </div>
              <div class="space-y-5 p-6">
                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-2xl bg-red-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-[0.16em] text-text-muted">Salida</p>
                    <p class="mt-1 text-xl font-bold text-navy">{{ horaLegible(vuelo.fechaHoraSalida) }}</p>
                  </div>
                  <div class="rounded-2xl bg-red-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-[0.16em] text-text-muted">Llegada</p>
                    <p class="mt-1 text-xl font-bold text-navy">{{ horaLegible(vuelo.fechaHoraLlegada) }}</p>
                  </div>
                </div>
                <div class="rounded-2xl border border-red-100 px-4 py-3">
                  <p class="text-sm text-text-muted">Vuelo</p>
                  <p class="mt-1 font-semibold text-navy">{{ vuelo.numeroVuelo }} · {{ fechaLegible(vuelo.fechaHoraSalida) }}</p>
                  <p class="mt-1 text-sm text-text-muted">Duracion: {{ duracionLegible(vuelo.duracionMin) }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-text-muted">
                  Pilas: revisa nombres, documentos y asientos antes de confirmar. Despues de pagar ya generamos la reserva real.
                </div>
              </div>
            </section>

            <section class="rounded-[30px] bg-white p-6 shadow-sm">
              <h2 class="text-2xl font-extrabold text-navy">Cuenta clarita</h2>
              <div class="mt-5 space-y-3 text-sm text-text-muted">
                <div class="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3">
                  <span>Tarifa del vuelo</span>
                  <span class="font-semibold text-navy">{{ moneda(subtotalVuelo) }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3">
                  <span>Equipaje de bodega</span>
                  <span class="font-semibold text-navy">{{ moneda(totalBodega) }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-red-100">
                  <span>IVA Ecuador (15%)</span>
                  <span class="font-semibold text-navy">{{ moneda(ivaGeneral) }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-red-100">
                  <span>Cargo por servicio</span>
                  <span class="font-semibold text-navy">{{ moneda(CARGO_SERVICIO) }}</span>
                </div>
              </div>

              <div class="mt-5 rounded-[26px] bg-[#111827] px-5 py-5 text-white">
                <div class="flex items-end justify-between gap-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.18em] text-white/60">Total final</p>
                    <p class="mt-2 text-4xl font-extrabold">{{ moneda(totalPagar) }}</p>
                  </div>
                  <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">De una</span>
                </div>
              </div>

              <button
                type="button"
                class="mt-6 w-full rounded-2xl bg-gold px-6 py-4 font-bold text-white shadow-lg shadow-red-100 transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:bg-gold/50"
                :disabled="procesandoPago"
                @click="handlePagar"
              >
                {{ procesandoPago ? 'Procesando...' : 'Confirmar reserva y despegar' }}
              </button>
            </section>
          </aside>

          <div class="space-y-6">
            <section class="rounded-[30px] bg-white p-6 shadow-sm sm:p-8">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p class="text-sm font-semibold uppercase tracking-[0.26em] text-gold-dark">Pases de abordaje</p>
                  <h2 class="mt-2 text-3xl font-extrabold text-navy">Pasajeros listos</h2>
                </div>
                <p class="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-[#d71920]">
                  {{ pasajeros.length }} viajero{{ pasajeros.length === 1 ? '' : 's' }}
                </p>
              </div>

              <div class="mt-6 grid gap-4 xl:grid-cols-2">
                <article
                  v-for="item in itemsPago"
                  :key="`pasajero-pago-${item.indice}`"
                  class="overflow-hidden rounded-[26px] border border-red-100 bg-white shadow-sm"
                >
                  <div class="flex items-center justify-between gap-4 bg-red-50 px-5 py-4">
                    <div>
                      <p class="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Pasajero {{ item.indice + 1 }}</p>
                      <h3 class="mt-1 text-xl font-extrabold text-navy">{{ item.nombre }}</h3>
                    </div>
                    <div class="rounded-2xl bg-[#d71920] px-4 py-3 text-center text-white">
                      <p class="text-xs text-white/70">Asiento</p>
                      <p class="text-2xl font-extrabold">{{ item.asiento?.numeroAsiento || '--' }}</p>
                    </div>
                  </div>
                  <div class="grid gap-3 p-5 text-sm text-text-muted sm:grid-cols-2">
                    <div>
                      <p class="text-xs uppercase tracking-[0.16em]">Documento</p>
                      <p class="mt-1 font-semibold text-navy">{{ item.pasajero.tipo_documento_pasajero }} {{ item.pasajero.numero_documento_pasajero }}</p>
                    </div>
                    <div>
                      <p class="text-xs uppercase tracking-[0.16em]">Contacto</p>
                      <p class="mt-1 truncate font-semibold text-navy">{{ item.pasajero.email_contacto_pasajero }}</p>
                    </div>
                    <div>
                      <p class="text-xs uppercase tracking-[0.16em]">Tarifa + asiento</p>
                      <p class="mt-1 font-semibold text-navy">{{ moneda(item.subtotalLinea) }}</p>
                    </div>
                    <div>
                      <p class="text-xs uppercase tracking-[0.16em]">Bodega</p>
                      <p class="mt-1 font-semibold text-navy">
                        {{ item.equipaje?.equipajeBodega ? moneda(COSTO_BODEGA) : 'No agregada' }}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section class="grid gap-5 md:grid-cols-3">
              <div class="rounded-[28px] bg-white p-6 shadow-sm">
                <p class="text-sm font-semibold uppercase tracking-[0.22em] text-gold-dark">Equipaje</p>
                <p class="mt-3 text-2xl font-extrabold text-navy">Mano incluido</p>
                <p class="mt-2 text-sm text-text-muted">10kg por pasajero. Para ir ligerito y sin relajo.</p>
              </div>
              <div class="rounded-[28px] bg-white p-6 shadow-sm">
                <p class="text-sm font-semibold uppercase tracking-[0.22em] text-gold-dark">Bodega</p>
                <p class="mt-3 text-2xl font-extrabold text-navy">{{ moneda(totalBodega) }}</p>
                <p class="mt-2 text-sm text-text-muted">23kg adicional si lo escogiste en el paso anterior.</p>
              </div>
              <div class="rounded-[28px] bg-[#d71920] p-6 text-white shadow-sm">
                <p class="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">Encanto Ecuador</p>
                <p class="mt-3 text-2xl font-extrabold">Pilas, todo listo</p>
                <p class="mt-2 text-sm text-white/80">Confirmas y tu reserva queda generada al instante.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="mostrarModalAuth"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8"
      @click.self="cerrarAutenticacion"
    >
      <div class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 bg-[#d71920] px-6 py-6 text-white sm:px-8">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Ultimo paso</p>
            <h2 class="mt-2 text-2xl font-bold">Identificate y dejamos tu reserva lista</h2>
            <p class="mt-2 text-white/80">
              Ingresa o crea tu cuenta para emitir la reserva. Pilas, toma menos de un minuto.
            </p>
          </div>
          <button type="button" class="rounded-xl p-2 text-white/80 hover:bg-white/10" @click="cerrarAutenticacion">
            ×
          </button>
        </div>

        <div class="px-6 pb-6 sm:px-8">
        <div class="mt-6 flex gap-3">
          <button
            type="button"
            class="rounded-2xl px-4 py-2 font-semibold transition-colors"
            :class="tabAuth === 'login' ? 'bg-gold text-white' : 'bg-red-50 text-navy'"
            @click="tabAuth = 'login'; limpiarModal()"
          >
            Iniciar sesion
          </button>
          <button
            type="button"
            class="rounded-2xl px-4 py-2 font-semibold transition-colors"
            :class="tabAuth === 'registro' ? 'bg-gold text-white' : 'bg-red-50 text-navy'"
            @click="tabAuth = 'registro'; limpiarModal()"
          >
            Crear cuenta
          </button>
        </div>

        <div v-if="errorAuth" class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ errorAuth }}
        </div>

        <form v-if="tabAuth === 'login'" class="mt-6 space-y-4" @submit.prevent="autenticarYProcesar">
          <InputApp v-model="loginForm.username" label="Usuario" requerido />
          <InputApp v-model="loginForm.password" label="Contrasena" tipo="password" requerido />
          <button
            type="submit"
            class="w-full rounded-2xl bg-gold px-6 py-4 font-semibold text-navy transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:bg-gold/50"
            :disabled="procesandoPago"
          >
            Ingresar y pagar
          </button>
        </form>

        <form v-else class="mt-6 grid gap-4 sm:grid-cols-2" @submit.prevent="registrarYProcesar">
          <SelectApp
            v-model="registerForm.tipo_identificacion"
            label="Tipo identificacion"
            :opciones="opcionesTipoIdentificacion"
            :error="erroresRegistro.tipo_identificacion"
            requerido
          />
          <InputApp
            v-model="registerForm.numero_identificacion"
            label="Numero identificacion"
            inputmode="numeric"
            :maxlength="limiteDocumento(registerForm.tipo_identificacion)"
            :filtro-solo-digitos="esTipoDocumentoSoloDigitos(registerForm.tipo_identificacion)"
            :error="erroresRegistro.numero_identificacion"
            requerido
          />
          <InputApp v-model="registerForm.nombres" label="Nombres" :error="erroresRegistro.nombres" requerido />
          <InputApp v-model="registerForm.apellidos" label="Apellidos" :error="erroresRegistro.apellidos" requerido />
          <InputApp v-model="registerForm.correo" label="Correo" tipo="email" :error="erroresRegistro.correo" requerido />
          <InputApp
            v-model="registerForm.telefono"
            label="Telefono"
            tipo="tel"
            inputmode="numeric"
            maxlength="10"
            filtro-solo-digitos
            :error="erroresRegistro.telefono"
            requerido
          />
          <div class="sm:col-span-2">
            <InputApp v-model="registerForm.direccion" label="Direccion" :error="erroresRegistro.direccion" requerido />
          </div>
          <SelectApp
            v-model="registerForm.id_pais_residencia"
            label="Pais"
            :opciones="opcionesPaises"
            placeholder="Seleccionar..."
            :error="erroresRegistro.id_pais_residencia"
            :cargando="catalogos.cargandoPaises"
            requerido
          />
          <SelectApp
            v-model="registerForm.id_ciudad_residencia"
            label="Ciudad"
            :opciones="opcionesCiudades"
            placeholder="Seleccionar..."
            :error="erroresRegistro.id_ciudad_residencia"
            :cargando="cargandoCiudades"
            :deshabilitado="!registerForm.id_pais_residencia"
            requerido
          />
          <SelectApp
            v-model="registerForm.id_pais_nacionalidad"
            label="Nacionalidad"
            :opciones="opcionesPaises"
            placeholder="Seleccionar..."
            :error="erroresRegistro.id_pais_nacionalidad"
            :cargando="catalogos.cargandoPaises"
            requerido
          />
          <InputApp v-model="registerForm.fecha_nacimiento" label="Fecha nacimiento" tipo="date" :error="erroresRegistro.fecha_nacimiento" requerido />
          <SelectApp
            v-model="registerForm.genero"
            label="Genero"
            :opciones="opcionesGenero"
            :error="erroresRegistro.genero"
            requerido
          />
          <InputApp v-model="registerForm.username" label="Username" :error="erroresRegistro.username" requerido />
          <InputApp v-model="registerForm.password" label="Password" tipo="password" :error="erroresRegistro.password" requerido />
          <div class="sm:col-span-2">
            <InputApp v-model="registerForm.confirmar_password" label="Confirmar password" tipo="password" :error="erroresRegistro.confirmar_password" requerido />
          </div>

          <p class="sm:col-span-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-text-muted">
            Los datos registrados se usaran para generar la factura de esta reserva. Todo legalito, como debe ser.
          </p>

          <button
            type="submit"
            class="sm:col-span-2 w-full rounded-2xl bg-gold px-6 py-4 font-semibold text-white transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:bg-gold/50"
            :disabled="procesandoPago"
          >
            Crear cuenta y pagar
          </button>
        </form>
        </div>
      </div>
    </div>
  </div>
</template>
