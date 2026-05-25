import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const KEY = 'mpas_reserva'

function _cargar() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
function _guardar(d) {
  sessionStorage.setItem(KEY, JSON.stringify(d))
}

export const useReservaStore = defineStore('reserva', () => {
  const _init = _cargar()

  const vuelo = ref(_init?.vuelo || null)
  /** Vuelo de regreso cuando tipoViaje es IDA_VUELTA */
  const vueloRegreso = ref(_init?.vueloRegreso ?? null)
  const tipoViaje = ref(_init?.tipoViaje || 'SOLO_IDA')

  const pasajeros = ref(_init?.pasajeros || [])
  const asientos = ref(_init?.asientos || [])
  /** Asientos del tramo de vuelta (misma cantidad que pasajeros) */
  const asientosRegreso = ref(_init?.asientosRegreso || [])
  const equipaje = ref(_init?.equipaje || [])
  const equipajeRegreso = ref(_init?.equipajeRegreso || [])

  const esIdaYVuelta = computed(() => tipoViaje.value === 'IDA_VUELTA' && !!vueloRegreso.value?.idVuelo)

  const tienePendiente = computed(() => !!vuelo.value)

  /** Subtotal tramo ida por suma líneas (precio base + extra asiento por pasajero) */
  const subtotalTramoIda = computed(() =>
    asientos.value.reduce((acc, a) => {
      if (!a?.idAsiento) return acc
      const base = vuelo.value?.precioBase || 0
      const extra = a?.precioExtra || 0
      return acc + base + extra
    }, 0),
  )

  const subtotalTramoVuelta = computed(() => {
    if (!esIdaYVuelta.value) return 0
    return asientosRegreso.value.reduce((acc, a) => {
      if (!a?.idAsiento) return acc
      const base = vueloRegreso.value?.precioBase || 0
      const extra = a?.precioExtra || 0
      return acc + base + extra
    }, 0)
  })

  const subtotal = computed(() => subtotalTramoIda.value + subtotalTramoVuelta.value)

  const iva = computed(() => Number((subtotal.value * 0.15).toFixed(2)))
  const total = computed(() => Number((subtotal.value + iva.value).toFixed(2)))

  function setVuelo(v) {
    vuelo.value = v
    _sync()
  }
  function setVueloRegreso(v) {
    vueloRegreso.value = v
    _sync()
  }
  function setTipoViaje(t) {
    tipoViaje.value = t || 'SOLO_IDA'
    if (tipoViaje.value === 'SOLO_IDA') {
      vueloRegreso.value = null
      asientosRegreso.value = []
      equipajeRegreso.value = []
    }
    _sync()
  }
  function setPasajeros(p) {
    pasajeros.value = p
    _sync()
  }
  function setAsientos(a) {
    asientos.value = a
    _sync()
  }
  function setAsientosRegreso(a) {
    asientosRegreso.value = a
    _sync()
  }
  function setEquipaje(e) {
    equipaje.value = e
    _sync()
  }
  function setEquipajeRegreso(e) {
    equipajeRegreso.value = e
    _sync()
  }

  function limpiar() {
    vuelo.value = null
    vueloRegreso.value = null
    tipoViaje.value = 'SOLO_IDA'
    pasajeros.value = []
    asientos.value = []
    asientosRegreso.value = []
    equipaje.value = []
    equipajeRegreso.value = []
    sessionStorage.removeItem(KEY)
  }

  function _sync() {
    _guardar({
      vuelo: vuelo.value,
      vueloRegreso: vueloRegreso.value,
      tipoViaje: tipoViaje.value,
      pasajeros: pasajeros.value,
      asientos: asientos.value,
      asientosRegreso: asientosRegreso.value,
      equipaje: equipaje.value,
      equipajeRegreso: equipajeRegreso.value,
    })
  }

  return {
    vuelo,
    vueloRegreso,
    tipoViaje,
    esIdaYVuelta,
    pasajeros,
    asientos,
    asientosRegreso,
    equipaje,
    equipajeRegreso,
    tienePendiente,
    subtotal,
    subtotalTramoIda,
    subtotalTramoVuelta,
    iva,
    total,
    setVuelo,
    setVueloRegreso,
    setTipoViaje,
    setPasajeros,
    setAsientos,
    setAsientosRegreso,
    setEquipaje,
    setEquipajeRegreso,
    limpiar,
  }
})
