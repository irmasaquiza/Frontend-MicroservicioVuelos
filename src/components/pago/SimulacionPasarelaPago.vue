<script setup>
import { computed, ref, watch } from 'vue'
import InputApp from '@/components/base/InputApp.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  titulo: { type: String, default: 'Pago con tarjeta (simulación)' },
  montoTexto: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'confirmar', 'cancelar'])

const numeroDigitos = ref('')
const titular = ref('')
const vencimiento = ref('')
const cvv = ref('')

const errores = ref({
  numero: '',
  titular: '',
  vencimiento: '',
  cvv: '',
})

const numeroVisual = computed({
  get() {
    const d = numeroDigitos.value
    const partes = d.match(/.{1,4}/g)
    return partes ? partes.join(' ') : ''
  },
  set(valor) {
    const solo = String(valor).replace(/\D/g, '').slice(0, 19)
    numeroDigitos.value = solo
  },
})

watch(
  () => props.modelValue,
  (abierto) => {
    if (!abierto) return
    numeroDigitos.value = ''
    titular.value = ''
    vencimiento.value = ''
    cvv.value = ''
    errores.value = { numero: '', titular: '', vencimiento: '', cvv: '' }
  },
)

function alEscribirVencimiento(e) {
  let v = String(e.target.value).replace(/\D/g, '').slice(0, 4)
  if (v.length >= 2) v = `${v.slice(0, 2)} / ${v.slice(2)}`
  vencimiento.value = v
  e.target.value = v
}

function vencimientoEsValido() {
  const limpio = vencimiento.value.replace(/\s/g, '')
  const m = limpio.match(/^(\d{2})\/(\d{2})$/)
  if (!m) return false
  const mes = Number(m[1])
  const anio = Number(m[2])
  if (mes < 1 || mes > 12) return false
  const finMes = new Date(2000 + anio, mes, 0, 23, 59, 59, 999)
  return finMes.getTime() >= Date.now()
}

function validar() {
  const e = {}
  const nLen = numeroDigitos.value.length
  if (nLen < 13 || nLen > 19) e.numero = 'Ingresa un número de tarjeta válido (13–19 dígitos).'
  const nomb = titular.value.trim()
  if (nomb.length < 3) e.titular = 'Escribe el nombre como aparece en la tarjeta.'
  else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'.-]+$/.test(nomb)) {
    e.titular = 'Solo letras y espacios.'
  }
  if (!vencimientoEsValido()) e.vencimiento = 'Fecha MM / AA válida y no vencida.'
  const cd = cvv.value.replace(/\D/g, '')
  if (cd.length < 3 || cd.length > 4) e.cvv = 'Código de seguridad de 3 o 4 dígitos.'

  errores.value = e
  return Object.keys(e).length === 0
}

function confirmar() {
  if (!validar()) return
  emit('confirmar')
  emit('update:modelValue', false)
}

function cerrar() {
  emit('update:modelValue', false)
  emit('cancelar')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-pasarela"
    >
      <div class="relative max-h-[min(94vh,52rem)] w-full max-w-md overflow-y-auto rounded-[28px] border border-red-100 bg-white shadow-2xl">
        <div class="sticky top-0 bg-gradient-to-r from-[#d71920] to-[#9f1117] px-6 py-5 text-white">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Pasarela simulada</p>
          <h2 id="titulo-pasarela" class="mt-1 text-xl font-extrabold">{{ titulo }}</h2>
          <p v-if="montoTexto" class="mt-2 text-lg font-bold text-white/95">Total: {{ montoTexto }}</p>
          <p class="mt-2 text-xs leading-relaxed text-white/85">
            Demostración: los datos de tarjeta no se envían ni guardan en ningún servidor. Solo continuamos tu reserva
            después de esta pantalla.
          </p>
        </div>

        <div class="space-y-4 p-6">
          <InputApp
            :model-value="numeroVisual"
            label="Número de tarjeta"
            placeholder="1234 5678 9012 3456"
            autocomplete="cc-number"
            inputmode="numeric"
            maxlength="23"
            requerido
            :error="errores.numero"
            @update:model-value="(v) => (numeroVisual = v)"
          />

          <InputApp
            v-model="titular"
            label="Nombre del titular"
            placeholder="Como aparece en la tarjeta"
            autocomplete="cc-name"
            requerido
            :error="errores.titular"
          />

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-text-main">Vencimiento <span class="text-error">*</span></label>
              <input
                type="text"
                inputmode="numeric"
                placeholder="MM / AA"
                maxlength="9"
                autocomplete="cc-exp"
                class="w-full rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-sm text-text-main placeholder-text-muted transition-all focus:border-[#d71920] focus:outline-none focus:ring-2 focus:ring-[#d71920]/25"
                :class="errores.vencimiento ? '!border-error' : ''"
                :value="vencimiento"
                @input="alEscribirVencimiento"
              />
              <p v-if="errores.vencimiento" class="text-xs text-error">{{ errores.vencimiento }}</p>
            </div>

            <InputApp
              v-model="cvv"
              label="Código seguridad"
              placeholder="CVV"
              tipo="password"
              autocomplete="cc-csc"
              requerido
              inputmode="numeric"
              maxlength="4"
              filtro-solo-digitos
              :error="errores.cvv"
            />
          </div>

          <div class="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950">
            Entorno educativo / simulado: ningún cobro real. Tras confirmar seguimos con la reserva en el backend como
            hasta ahora.
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              class="flex-1 rounded-2xl border-2 border-red-100 px-4 py-3 text-sm font-semibold text-[#d71920] hover:bg-red-50"
              @click="cerrar"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="flex-1 rounded-2xl bg-[#d71920] px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-[#b9151b]"
              @click="confirmar"
            >
              Pagar simulado
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
