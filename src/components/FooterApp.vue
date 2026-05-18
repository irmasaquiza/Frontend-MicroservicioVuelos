<script setup>
const enlacesCorporativos = [
  { etiqueta: 'Inicio', to: '/' },
  { etiqueta: 'Vuelos', to: '/vuelos' },
  { etiqueta: 'Iniciar sesión', to: '/login' },
  { etiqueta: 'Registro', to: '/registro' },
]

const redes = [
  { etiqueta: 'Facebook', href: 'https://facebook.com' },
  { etiqueta: 'Instagram', href: 'https://instagram.com' },
  { etiqueta: 'LinkedIn', href: 'https://linkedin.com' },
]
</script>

<template>
  <footer class="bg-navy pb-6 pt-12 text-white">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div class="mb-4 inline-flex items-center gap-2 text-2xl font-extrabold">
            <span class="rounded-xl bg-white px-3 py-1 text-[#d71920]">Nacho</span>
            <span>Flights</span>
          </div>
          <p class="max-w-sm text-sm leading-6 text-white/70">
            NachoFlights conecta destinos con una experiencia rápida, clara y segura. De una, a volar.
          </p>
        </div>

        <div>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-gold">Corporativo</h3>
          <div class="space-y-3 text-sm">
            <RouterLink
              v-for="enlace in enlacesCorporativos"
              :key="enlace.to"
              :to="enlace.to"
              class="block text-white/70 transition-colors hover:text-white"
            >
              {{ enlace.etiqueta }}
            </RouterLink>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-gold">Redes</h3>
          <div class="space-y-3 text-sm">
            <a
              v-for="red in redes"
              :key="red.etiqueta"
              :href="red.href"
              target="_blank"
              rel="noreferrer"
              class="block text-white/70 transition-colors hover:text-white"
            >
              {{ red.etiqueta }}
            </a>
          </div>
        </div>
      </div>

      <div class="mt-10 border-t border-white/10 pt-5 text-center text-xs text-white/45">
        © {{ new Date().getFullYear() }} NachoFlights. Todos los derechos reservados.
      </div>
    </div>
  </footer>
</template>
