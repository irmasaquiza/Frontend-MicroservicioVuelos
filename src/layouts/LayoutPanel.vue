<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePanelPermisos } from '@/composables/usePanelPermisos'

const { auth, tituloPanel } = usePanelPermisos()
const router = useRouter()

const panelLabel = computed(() => (auth.rol === 'ADMINISTRADOR' ? 'Admin' : 'Aero'))
const panelRole = computed(() => auth.rol || 'USUARIO')

function iconoPath(icono) {
  const mapas = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z',
    globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm0 0c2.2 2.1 3.5 5.4 3.5 9S14.2 18.9 12 21m0-18C9.8 5.1 8.5 8.4 8.5 12s1.3 6.9 3.5 9m-8-9h16M4.9 7.5h14.2M4.9 16.5h14.2',
    map: 'm3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z M9 4v14 M15 6v14',
    plane: 'm2 16 20-5-8 8-2.5-5.5L6 11l-4-1 20-5-5 20-3.5-7L2 16Z',
    seat: 'M7 4a2 2 0 0 1 2 2v4h6V7a2 2 0 1 1 2 0v6H7V6a2 2 0 0 1 2-2Z M5 13h14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3Z M7 18v2 M17 18v2',
    luggage: 'M8 7V6a4 4 0 0 1 8 0v1m-9 0h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z M9 11v4 M15 11v4',
    ticket: 'M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4V7Z M10 9v6',
    receipt: 'M7 3h10a2 2 0 0 1 2 2v15l-2.5-1.5L14 20l-2.5-1.5L9 20l-2.5-1.5L4 20V5a2 2 0 0 1 2-2h1Zm2 5h6m-6 4h6m-6 4h4',
    users: 'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 9a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Zm7 12v-2a4 4 0 0 0-3-3.87 M14.5 2.2a3.5 3.5 0 0 1 0 6.6',
    user: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
    airport: 'm3 16 7.5-2 5-9 2 2-3 7 6.5-1.5 1.5 1.5-7.5 3-2 3.5-2-2 1-2.5L4.5 18 3 16Z',
    logout: 'M10 17l5-5-5-5 M15 12H7 M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6',
  }

  return mapas[icono] || mapas.home
}

const menuItems = computed(() => {
  const comunes = [{ label: 'Inicio', ruta: { name: 'panel-inicio' }, icono: 'home' }]

  if (auth.rol === 'ADMINISTRADOR') {
    comunes.push(
      { label: 'Paises', ruta: { name: 'panel-paises' }, icono: 'globe' },
      { label: 'Ciudades', ruta: { name: 'panel-ciudades' }, icono: 'map' },
      { label: 'Aeropuertos', ruta: { name: 'panel-aeropuertos' }, icono: 'airport' },
      { label: 'Vuelos', ruta: { name: 'panel-vuelos' }, icono: 'plane' },
      { label: 'Asientos', ruta: { name: 'panel-asientos' }, icono: 'seat' },
      { label: 'Equipaje', ruta: { name: 'panel-equipaje' }, icono: 'luggage' },
      { label: 'Reservas', ruta: { name: 'panel-reservas' }, icono: 'receipt' },
      { label: 'Boletos', ruta: { name: 'panel-boletos' }, icono: 'ticket' },
      { label: 'Facturas', ruta: { name: 'panel-facturas' }, icono: 'receipt' },
      { label: 'Clientes', ruta: { name: 'panel-clientes' }, icono: 'users' },
      { label: 'Pasajeros', ruta: { name: 'panel-pasajeros' }, icono: 'user' },
    )
  } else if (auth.rol === 'AEROLINEA') {
    comunes.push(
      { label: 'Aeropuertos', ruta: { name: 'panel-aeropuertos' }, icono: 'airport' },
      { label: 'Vuelos', ruta: { name: 'panel-vuelos' }, icono: 'plane' },
      { label: 'Asientos', ruta: { name: 'panel-asientos' }, icono: 'seat' },
      { label: 'Equipaje', ruta: { name: 'panel-equipaje' }, icono: 'luggage' },
      { label: 'Reservas', ruta: { name: 'panel-reservas' }, icono: 'receipt' },
      { label: 'Boletos', ruta: { name: 'panel-boletos' }, icono: 'ticket' },
      { label: 'Facturas', ruta: { name: 'panel-facturas' }, icono: 'receipt' },
      { label: 'Clientes', ruta: { name: 'panel-clientes' }, icono: 'users' },
      { label: 'Pasajeros', ruta: { name: 'panel-pasajeros' }, icono: 'user' },
    )
  }

  return comunes
})

function itemActivo(ruta) {
  return router.currentRoute.value.name === ruta.name
}

async function cerrarSesion() {
  await auth.logout()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-background text-navy">
    <div class="mx-auto min-h-screen max-w-[1600px] px-5 py-5 lg:px-8">
      <header class="overflow-hidden rounded-[30px] bg-gradient-to-r from-[#d71920] via-[#c5161d] to-[#9f1117] p-6 text-white shadow-xl shadow-red-200/50">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">Panel NachoFlights</p>
            <h1 class="mt-2 text-4xl font-extrabold">Administracion por cubitos</h1>
            <p class="mt-2 max-w-2xl text-white/82">
              Todo a la vista, sin barra lateral. A gestionar rapidito, ñaño.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <div class="rounded-2xl bg-white/12 px-4 py-3">
              <p class="text-xs uppercase tracking-[0.16em] text-white/60">Rol</p>
              <p class="mt-1 font-semibold">{{ panelRole }}</p>
            </div>
            <RouterLink to="/" class="rounded-2xl border border-white/25 px-4 py-3 text-sm font-semibold hover:bg-white/10">
              Ir al Inicio
            </RouterLink>
            <button
              type="button"
              class="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#d71920] hover:bg-red-50"
              @click="cerrarSesion"
            >
              Cerrar Sesion
            </button>
          </div>
        </div>
      </header>

      <nav class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <RouterLink
          v-for="item in menuItems"
          :key="item.label"
          :to="item.ruta"
          :class="[
            'group rounded-[24px] border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
            itemActivo(item.ruta)
              ? 'border-[#d71920] bg-[#d71920] text-white shadow-red-100'
              : 'border-red-100 bg-white text-navy hover:border-[#d71920]',
          ]"
        >
          <span
            :class="[
              'flex h-12 w-12 items-center justify-center rounded-2xl transition-colors',
              itemActivo(item.ruta) ? 'bg-white/18 text-white' : 'bg-red-50 text-[#d71920] group-hover:bg-red-100',
            ]"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="iconoPath(item.icono)" />
            </svg>
          </span>
          <p class="mt-4 text-lg font-bold">{{ item.label }}</p>
          <p class="mt-1 text-xs opacity-70">Abrir gestion</p>
        </RouterLink>
      </nav>

      <main class="mt-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
