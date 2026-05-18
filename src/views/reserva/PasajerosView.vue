<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import { useCatalogosStore } from '@/stores/catalogos.store'
import { useReservaStore } from '@/stores/reserva.store'
import {
  esTipoDocumentoSoloDigitos,
  impedirSiNoEsDigito,
  limiteDocumento,
  normalizarDocumento,
  normalizarTelefono,
  validarDocumentoPorTipo,
  validarTelefono,
} from '@/utils/validacionesCampos'

const router = useRouter()
const catalogos = useCatalogosStore()
const reserva = useReservaStore()

const errores = ref({})
const pasajeros = ref([])

const vuelo = computed(() => reserva.vuelo)
const opcionesPaises = computed(() =>
  catalogos.paises.map((pais) => ({
    valor: String(pais.idPais ?? pais.id_pais ?? pais.id),
    etiqueta: String(pais.nombre ?? pais.nombre_pais ?? ''),
  })),
)

function obtenerEtiquetaPais(idPais) {
  const idNormalizado = String(idPais || '')
  return opcionesPaises.value.find((pais) => pais.valor === idNormalizado)?.etiqueta || ''
}

function crearPasajeroVacio(indice = 0) {
  return {
    id: `${Date.now()}-${indice}-${Math.random().toString(16).slice(2, 8)}`,
    nombre_pasajero: '',
    apellido_pasajero: '',
    tipo_documento_pasajero: 'CEDULA',
    numero_documento_pasajero: '',
    fecha_nacimiento_pasajero: '',
    id_pais_nacionalidad: '',
    nacionalidad_pasajero: '',
    email_contacto_pasajero: '',
    telefono_contacto_pasajero: '',
    genero_pasajero: 'MASCULINO',
    requiere_asistencia: false,
    observaciones_pasajero: '',
    id_cliente: null,
  }
}

function clonarPasajero(pasajero, indice) {
  const idPaisNacionalidad = String(
    pasajero.id_pais_nacionalidad || pasajero.idPaisNacionalidad || '',
  )
  const tipoDoc = pasajero.tipo_documento_pasajero || pasajero.tipoDocumentoPasajero || 'CEDULA'

  const base = {
    ...crearPasajeroVacio(indice),
    ...pasajero,
    tipo_documento_pasajero: String(tipoDoc).trim().toUpperCase() || 'CEDULA',
    id_pais_nacionalidad: idPaisNacionalidad,
    nacionalidad_pasajero:
      pasajero.nacionalidad_pasajero ||
      pasajero.nacionalidadPasajero ||
      obtenerEtiquetaPais(idPaisNacionalidad),
    id: pasajero.id || `${Date.now()}-${indice}-${Math.random().toString(16).slice(2, 8)}`,
  }

  base.numero_documento_pasajero = normalizarDocumento(base.tipo_documento_pasajero, base.numero_documento_pasajero)
  base.telefono_contacto_pasajero = normalizarTelefono(base.telefono_contacto_pasajero)

  return base
}

function cantidadObjetivo() {
  return Number(vuelo.value?.pasajeros || 1)
}

function actualizarCantidadReserva(cantidad) {
  if (!vuelo.value) return
  reserva.setVuelo({
    ...vuelo.value,
    pasajeros: cantidad,
  })
}

function inicializarPasajeros() {
  const guardados = Array.isArray(reserva.pasajeros) ? reserva.pasajeros : []
  const base = guardados.length
    ? guardados.map((pasajero, indice) => clonarPasajero(pasajero, indice))
    : Array.from({ length: cantidadObjetivo() }, (_, indice) => crearPasajeroVacio(indice))

  while (base.length < cantidadObjetivo()) {
    base.push(crearPasajeroVacio(base.length))
  }

  pasajeros.value = base
  actualizarCantidadReserva(base.length)
}

function agregarPasajero() {
  if (pasajeros.value.length >= 9) return
  pasajeros.value.push(crearPasajeroVacio(pasajeros.value.length))
  actualizarCantidadReserva(pasajeros.value.length)
  sincronizarStore()
}

function eliminarPasajero(indice) {
  if (pasajeros.value.length <= 1) return
  pasajeros.value.splice(indice, 1)
  actualizarCantidadReserva(pasajeros.value.length)
  sincronizarStore()
}

function sincronizarStore() {
  reserva.setPasajeros(
    pasajeros.value.map(({ id, ...pasajero }) => {
      const idPaisNacionalidad = String(pasajero.id_pais_nacionalidad || '')
      return {
        ...pasajero,
        id_pais_nacionalidad: idPaisNacionalidad,
        nacionalidad_pasajero: obtenerEtiquetaPais(idPaisNacionalidad),
      }
    }),
  )
}

function actualizarDocumentoPasajero(pasajero, inputEl) {
  const siguiente = normalizarDocumento(pasajero.tipo_documento_pasajero, inputEl?.value ?? '')
  pasajero.numero_documento_pasajero = siguiente
  if (inputEl && inputEl.value !== siguiente) inputEl.value = siguiente
}

function actualizarTelefonoPasajero(pasajero, inputEl) {
  const siguiente = normalizarTelefono(inputEl?.value ?? '')
  pasajero.telefono_contacto_pasajero = siguiente
  if (inputEl && inputEl.value !== siguiente) inputEl.value = siguiente
}

function teclaDocumentoPasajero(ev, tipo) {
  if (esTipoDocumentoSoloDigitos(tipo)) impedirSiNoEsDigito(ev)
}

function recortarDocumentoPorTipo(pasajero) {
  pasajero.numero_documento_pasajero = normalizarDocumento(
    pasajero.tipo_documento_pasajero,
    pasajero.numero_documento_pasajero,
  )
}

function validar() {
  const nuevosErrores = {}
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  pasajeros.value.forEach((pasajero, indice) => {
    if (!pasajero.nombre_pasajero.trim()) nuevosErrores[`nombre-${indice}`] = 'Ingresa el nombre.'
    if (!pasajero.apellido_pasajero.trim()) nuevosErrores[`apellido-${indice}`] = 'Ingresa el apellido.'
    if (!pasajero.tipo_documento_pasajero) nuevosErrores[`tipo-documento-${indice}`] = 'Selecciona el tipo de documento.'
    {
      const errorDocumento = validarDocumentoPorTipo(
        pasajero.tipo_documento_pasajero,
        pasajero.numero_documento_pasajero,
      )
      if (errorDocumento) nuevosErrores[`documento-${indice}`] = errorDocumento
    }
    if (!pasajero.fecha_nacimiento_pasajero) {
      nuevosErrores[`fecha-${indice}`] = 'Selecciona la fecha de nacimiento.'
    } else {
      const fechaNacimiento = new Date(`${pasajero.fecha_nacimiento_pasajero}T00:00:00`)
      if (fechaNacimiento > hoy) {
        nuevosErrores[`fecha-${indice}`] = 'La fecha de nacimiento no puede ser futura.'
      }
    }
    if (!pasajero.id_pais_nacionalidad) nuevosErrores[`nacionalidad-${indice}`] = 'Selecciona la nacionalidad.'
    if (!pasajero.email_contacto_pasajero.trim()) {
      nuevosErrores[`email-${indice}`] = 'Ingresa el email de contacto.'
    } else if (!emailRegex.test(pasajero.email_contacto_pasajero.trim())) {
      nuevosErrores[`email-${indice}`] = 'Ingresa un correo valido.'
    }
    {
      const errorTelefono = validarTelefono(pasajero.telefono_contacto_pasajero)
      if (errorTelefono) nuevosErrores[`telefono-${indice}`] = errorTelefono
    }
    if (!pasajero.genero_pasajero) nuevosErrores[`genero-${indice}`] = 'Selecciona el genero.'
  })

  errores.value = nuevosErrores
  return Object.keys(nuevosErrores).length === 0
}

function monedaResumen(valor) {
  try {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(valor) || 0)
  } catch {
    return `$${Number(valor || 0).toFixed(2)}`
  }
}

function fechaResumenLegible(valor) {
  if (!valor) return 'Fecha por confirmar'
  try {
    return new Intl.DateTimeFormat('es-EC', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(valor))
  } catch {
    return 'Fecha por confirmar'
  }
}

function claseResumenEtiqueta(clase) {
  const c = String(clase || '').trim()
  return c.replace(/_/g, ' ')
}

function continuarAsientos() {
  if (!validar()) return
  sincronizarStore()
  router.push({ name: 'seleccion-asientos' })
}

onMounted(async () => {
  if (!vuelo.value) {
    router.replace({ name: 'buscar-vuelos' })
    return
  }

  await catalogos.cargarPaises(true).catch(() => {})
  inicializarPasajeros()
})
</script>

<template>
  <div>
    <CheckoutStepper :paso-actual="2" />

    <section class="reserva-form-page min-h-[calc(100vh-64px)] bg-background py-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="overflow-hidden rounded-[32px] bg-white shadow-sm">
          <div class="bg-gradient-to-r from-[#d71920] to-[#9f1117] px-6 py-7 text-white sm:px-8">
            <p class="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Paso 2</p>
            <h1 class="mt-3 text-3xl font-extrabold">Informacion de pasajeros</h1>
            <p class="mt-3 max-w-3xl text-white/82">
              Llena los datos con calma, ñaño. Luego asignaremos un asiento por cada viajero.
            </p>
          </div>
          <div class="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p class="text-sm text-text-muted">Pilas con cedula y telefono: solo numeros y sin pasarse de caracteres.</p>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d71920] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-200/55 transition-colors hover:bg-[#b9151b] hover:shadow-red-200"
              @click="agregarPasajero"
            >
              <span class="text-lg leading-none">+</span>
              <span>Agregar Pasajero</span>
            </button>
          </div>
        </div>

        <div class="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div class="space-y-6">
            <article
              v-for="(pasajero, indice) in pasajeros"
              :key="pasajero.id"
              class="overflow-hidden rounded-[30px] border border-red-100 bg-white shadow-sm sm:p-0"
            >
              <div class="flex items-center justify-between gap-4 border-b border-red-100 bg-red-50/70 px-6 py-5 sm:px-8">
                <div class="flex items-center gap-4">
                  <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d71920] text-white shadow-lg shadow-red-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 14a4 4 0 10-8 0m8 0a4 4 0 11-8 0m8 0v1a2 2 0 002 2h1m-11-3v1a2 2 0 01-2 2H5" />
                    </svg>
                  </div>
                  <h2 class="text-2xl font-semibold text-navy">Pasajero {{ indice + 1 }}</h2>
                </div>

                <button
                  v-if="pasajeros.length > 1"
                  type="button"
                  class="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50"
                  @click="eliminarPasajero(indice)"
                >
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" />
                  </svg>
                </button>
              </div>

              <div class="grid gap-6 p-6 md:grid-cols-2 sm:p-8">
                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Nombre</span>
                  <input
                    v-model="pasajero.nombre_pasajero"
                    type="text"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  />
                  <span v-if="errores[`nombre-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`nombre-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Apellido</span>
                  <input
                    v-model="pasajero.apellido_pasajero"
                    type="text"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  />
                  <span v-if="errores[`apellido-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`apellido-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Tipo de Documento</span>
                  <select
                    v-model="pasajero.tipo_documento_pasajero"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                    @change="recortarDocumentoPorTipo(pasajero)"
                  >
                    <option value="CEDULA">Cedula</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="RUC">RUC</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  <span v-if="errores[`tipo-documento-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`tipo-documento-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Numero de Documento</span>
                  <input
                    :value="pasajero.numero_documento_pasajero"
                    type="text"
                    :inputmode="esTipoDocumentoSoloDigitos(pasajero.tipo_documento_pasajero) ? 'numeric' : 'text'"
                    autocomplete="off"
                    autocorrect="off"
                    spellcheck="false"
                    :maxlength="limiteDocumento(pasajero.tipo_documento_pasajero)"
                    :pattern="esTipoDocumentoSoloDigitos(pasajero.tipo_documento_pasajero) ? '[0-9]*' : undefined"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                    @keydown="teclaDocumentoPasajero($event, pasajero.tipo_documento_pasajero)"
                    @input="actualizarDocumentoPasajero(pasajero, $event.target)"
                  />
                  <span v-if="errores[`documento-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`documento-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Fecha de Nacimiento</span>
                  <input
                    v-model="pasajero.fecha_nacimiento_pasajero"
                    type="date"
                    :max="new Date().toISOString().split('T')[0]"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  />
                  <span v-if="errores[`fecha-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`fecha-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Nacionalidad</span>
                  <select
                    v-model="pasajero.id_pais_nacionalidad"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  >
                    <option value="">Seleccionar pais...</option>
                    <option v-for="pais in opcionesPaises" :key="pais.valor" :value="pais.valor">
                      {{ pais.etiqueta }}
                    </option>
                  </select>
                  <span v-if="errores[`nacionalidad-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`nacionalidad-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Email de Contacto</span>
                  <input
                    v-model="pasajero.email_contacto_pasajero"
                    type="email"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  />
                  <span v-if="errores[`email-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`email-${indice}`] }}</span>
                </label>

                <label class="block">
                  <span class="mb-2 block font-medium text-navy">Telefono de Contacto</span>
                  <input
                    :value="pasajero.telefono_contacto_pasajero"
                    type="tel"
                    inputmode="numeric"
                    maxlength="10"
                    autocomplete="tel"
                    pattern="[0-9]{10}"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                    @keydown="impedirSiNoEsDigito"
                    @input="actualizarTelefonoPasajero(pasajero, $event.target)"
                  />
                  <span v-if="errores[`telefono-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`telefono-${indice}`] }}</span>
                </label>

                <label class="block md:col-span-2">
                  <span class="mb-2 block font-medium text-navy">Genero</span>
                  <select
                    v-model="pasajero.genero_pasajero"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  >
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMENINO">Femenino</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  <span v-if="errores[`genero-${indice}`]" class="mt-2 block text-sm text-red-500">{{ errores[`genero-${indice}`] }}</span>
                </label>

                <label class="flex items-center gap-3 md:col-span-2">
                  <input
                    v-model="pasajero.requiere_asistencia"
                    type="checkbox"
                    class="h-5 w-5 rounded border-slate-300 text-blue-accent focus:ring-blue-accent"
                  />
                  <span class="font-medium text-navy">Requiere asistencia especial</span>
                </label>

                <label class="block md:col-span-2">
                  <span class="mb-2 block font-medium text-navy">Observaciones</span>
                  <textarea
                    v-model="pasajero.observaciones_pasajero"
                    rows="4"
                    placeholder="Alergias, necesidades especiales, etc."
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-accent focus:ring-4 focus:ring-blue-accent/10"
                  />
                </label>
              </div>
            </article>
          </div>

          <aside class="lg:sticky lg:top-24 lg:self-start">
            <div class="overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-xl shadow-red-950/10">
              <div
                class="relative bg-[linear-gradient(135deg,#d71920_0%,#b9151b_48%,#7f1115_100%)] px-6 pb-10 pt-7 text-white"
              >
                <div class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div class="pointer-events-none absolute bottom-10 right-4 h-16 w-16 rounded-full bg-white/10" />
                <p class="relative text-[11px] font-semibold uppercase tracking-[0.28em] text-white/65">Tu vuelo NachoFlights</p>
                <h2 class="relative mt-2 text-2xl font-extrabold leading-tight">Resumen bien clarito</h2>
                <p class="relative mt-2 max-w-[16rem] text-sm text-white/82">
                  Revisa codigo, fecha y clase. Asi despues vas full a tus asientos, sin improvisar.
                </p>
                <div
                  class="relative mt-6 flex flex-wrap items-end justify-between gap-3 rounded-[22px] border border-white/20 bg-black/15 px-5 py-4 backdrop-blur-[2px]"
                >
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-white/65">Tarifa base</p>
                    <p class="mt-1 text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">
                      {{ monedaResumen(vuelo?.precioBase) }}
                    </p>
                    <p class="mt-1 text-xs text-white/70">por persona (sin cargos extras)</p>
                  </div>
                  <span
                    class="inline-flex items-center rounded-2xl bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#d71920] shadow-lg shadow-black/15"
                  >
                    {{ pasajeros.length }}
                    {{
                      pasajeros.length === 1 ? ' viajero' : ' viajeros'
                    }}
                  </span>
                </div>
              </div>

              <div class="space-y-0 px-5 py-4">
                <div class="flex items-start gap-3 border-b border-red-50 py-4 first:pt-0">
                  <div
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#d71920]"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 18a9 9 0 110-18 9 9 0 010 18z" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Codigo de vuelo</p>
                    <p class="mt-1 break-all font-bold text-text-main">{{ vuelo?.numeroVuelo }}</p>
                  </div>
                </div>

                <div class="flex items-start gap-3 border-b border-red-50 py-4">
                  <div
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#d71920]"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Sale el</p>
                    <p class="mt-1 capitalize font-semibold leading-snug text-text-main">
                      {{ fechaResumenLegible(vuelo?.fechaHoraSalida) }}
                    </p>
                  </div>
                </div>

                <div class="flex items-start gap-3 py-4">
                  <div
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#d71920]"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H9m12 12H9a6 6 0 01-6-6V10a6 6 0 016-6h4" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Cabina</p>
                    <p class="mt-2 flex flex-wrap gap-2">
                      <span
                        class="inline-flex rounded-full border border-red-100 bg-red-50/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#b9151b]"
                      >
                        {{ claseResumenEtiqueta(vuelo?.clase) }}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div class="border-t border-dashed border-red-100 bg-red-50/40 px-5 py-5">
                <div class="flex items-center gap-3">
                  <div class="rounded-2xl bg-white p-3 text-[#d71920] shadow-sm shadow-red-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <p class="text-sm font-medium leading-relaxed text-text-muted">
                    De una sigue cuando termines tus datos.
                    <span class="font-semibold text-[#d71920]">Pilas:</span>
                    llevas {{ pasajeros.length }} persona{{ pasajeros.length === 1 ? '' : 's' }} en este itinerario.
                  </p>
                </div>

                <button
                  type="button"
                  class="mt-5 w-full rounded-2xl bg-[#d71920] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-red-200/70 transition-colors hover:bg-[#b9151b] hover:shadow-red-200"
                  @click="continuarAsientos"
                >
                  Continuar a Asientos →
                </button>

                <button
                  type="button"
                  class="mt-3 w-full rounded-2xl border-2 border-red-100 bg-white px-6 py-3.5 text-sm font-semibold text-[#d71920] transition-colors hover:border-red-200 hover:bg-red-50/70"
                  @click="router.push({ name: 'detalle-vuelo', params: { id: vuelo?.idVuelo } })"
                >
                  Volver al vuelo
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.reserva-form-page input,
.reserva-form-page select,
.reserva-form-page textarea {
  border-color: #fecaca;
  background: rgba(254, 242, 242, 0.72);
  box-shadow: 0 1px 0 rgba(215, 25, 32, 0.04);
}

.reserva-form-page input:focus,
.reserva-form-page select:focus,
.reserva-form-page textarea:focus {
  border-color: #d71920;
  box-shadow: 0 0 0 4px rgba(215, 25, 32, 0.12);
}
</style>
