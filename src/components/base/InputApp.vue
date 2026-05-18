<script setup>
import { useAttrs } from 'vue'
import { impedirSiNoEsDigito, soloDigitos as filtrarSoloDigitos } from '@/utils/validacionesCampos'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  label:           { type: String, default: '' },
  modelValue:      { default: '' },
  tipo:            { type: String, default: 'text' },
  placeholder:     { type: String, default: '' },
  error:           { type: String, default: '' },
  requerido:       { type: Boolean, default: false },
  deshabilitado:   { type: Boolean, default: false },
  autocomplete:    { type: String, default: 'off' },
  /** Quita cualquier caracter que no sea digito en cada input y respeta maxlength (attrs). */
  filtroSoloDigitos:{ type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()

function alEscribir(evento) {
  let valor = evento.target.value
  if (props.filtroSoloDigitos) {
    const ml = attrs.maxlength
    const max =
      ml !== undefined && ml !== null && String(ml).trim() !== ''
        ? Number(ml)
        : Infinity
    const limite = Number.isFinite(max) ? max : Infinity
    valor = filtrarSoloDigitos(valor, limite)
    if (evento.target.value !== valor) evento.target.value = valor
  }
  emit('update:modelValue', valor)
}

function teclaNumerica(ev) {
  if (props.filtroSoloDigitos) impedirSiNoEsDigito(ev)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" class="text-sm font-semibold text-text-main">
      {{ label }}<span v-if="requerido" class="text-error ml-0.5">*</span>
    </label>
    <input
      :type="tipo"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="deshabilitado"
      :autocomplete="autocomplete"
      v-bind="attrs"
      :class="[
        'w-full px-4 py-3 rounded-xl bg-red-50/60 text-text-main placeholder-text-muted text-sm',
        'border border-red-100 focus:outline-none focus:border-blue-accent focus:ring-2 focus:ring-blue-accent/20',
        'transition-all duration-200',
        error && '!border-error focus:!ring-error/20',
        deshabilitado && 'opacity-50 cursor-not-allowed',
      ]"
      @input="alEscribir"
      @keydown="teclaNumerica"
    />
    <p v-if="error" class="text-xs text-error flex items-center gap-1">
      <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      {{ error }}
    </p>
  </div>
</template>
