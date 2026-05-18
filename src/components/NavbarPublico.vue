<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAutenticacionStore } from '@/stores/autenticacion.store'

const auth = useAutenticacionStore()
const router = useRouter()

const menuAbierto = ref(false)
const cerrandoSesion = ref(false)
const cerrar = () => (menuAbierto.value = false)

async function irMiCuenta() {
  cerrar()
  if (auth.esCliente) router.push('/cliente')
  else router.push('/panel')
}

async function cerrarSesion() {
  cerrandoSesion.value = true
  try {
    await auth.logout()
    cerrar()
    router.push('/')
  } finally {
    cerrandoSesion.value = false
  }
}
</script>

<template>
  <nav class="sticky top-0 z-40 bg-navy shadow-lg">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2 text-xl font-extrabold tracking-tight" @click="cerrar">
          <span class="rounded-xl bg-white px-3 py-1 text-[#d71920]">Nacho</span>
          <span class="text-white">Flights</span>
        </RouterLink>

        <div class="hidden items-center gap-10 md:flex">
          <RouterLink
            to="/"
            class="text-sm font-medium text-white/85 transition-colors hover:text-white"
            active-class="!text-white"
            exact-active-class="!text-white"
          >
            Inicio
          </RouterLink>
          <RouterLink
            to="/vuelos"
            class="text-sm font-medium text-white/85 transition-colors hover:text-white"
            active-class="!text-white"
          >
            Vuelos
          </RouterLink>
        </div>

        <div class="hidden items-center gap-3 md:flex">
          <template v-if="auth.estaAutenticado">
            <button
              class="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              @click="cerrarSesion"
            >
              <span
                v-if="cerrandoSesion"
                class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              <span v-else>Cerrar sesión</span>
            </button>
            <button
              type="button"
              class="rounded-2xl border-2 border-white bg-white px-7 py-3 text-sm font-bold text-[#d71920] shadow-md shadow-black/15 transition-colors hover:bg-red-50"
              @click="irMiCuenta"
            >
              Mi cuenta
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="rounded-2xl border-2 border-white bg-white px-7 py-3 text-sm font-bold text-[#d71920] shadow-md shadow-black/15 transition-colors hover:bg-red-50"
            >
              Iniciar Sesión
            </RouterLink>
          </template>
        </div>

        <button
          class="-mr-2 p-2 text-white md:hidden"
          :aria-expanded="menuAbierto"
          aria-label="Menú"
          @click="menuAbierto = !menuAbierto"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="menuAbierto ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'"
            />
          </svg>
        </button>
      </div>
    </div>

    <Transition name="slide">
      <div v-if="menuAbierto" class="space-y-1 border-t border-white/10 bg-navy-light px-4 py-3 md:hidden">
        <RouterLink to="/" class="block py-2.5 text-sm font-medium text-white/80 hover:text-white" @click="cerrar">
          Inicio
        </RouterLink>
        <RouterLink
          to="/vuelos"
          class="block py-2.5 text-sm font-medium text-white/80 hover:text-white"
          @click="cerrar"
        >
          Vuelos
        </RouterLink>
        <div class="space-y-2 border-t border-white/10 pt-2">
          <template v-if="auth.estaAutenticado">
            <button
              class="w-full rounded-xl border border-white/20 py-2.5 text-center text-sm font-semibold text-white"
              @click="cerrarSesion"
            >
              <span
                v-if="cerrandoSesion"
                class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              <span v-else>Cerrar sesión</span>
            </button>
            <button
              type="button"
              class="w-full rounded-xl border-2 border-white bg-white py-2.5 text-center text-sm font-bold text-[#d71920] shadow-sm transition-colors hover:bg-red-50"
              @click="irMiCuenta"
            >
              Mi cuenta
            </button>
          </template>
          <RouterLink
            v-else
            to="/login"
            class="block rounded-xl border-2 border-white bg-white py-2.5 text-center text-sm font-bold text-[#d71920] transition-colors hover:bg-red-50"
            @click="cerrar"
          >
            Iniciar Sesión
          </RouterLink>
        </div>
      </div>
    </Transition>
  </nav>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
