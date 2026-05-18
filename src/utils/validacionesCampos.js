const LIMITES_DOCUMENTO = {
  CEDULA: 10,
  RUC: 13,
  PASAPORTE: 20,
  OTRO: 20,
}

export const MAX_TELEFONO = 10

export function limiteDocumento(tipo) {
  return LIMITES_DOCUMENTO[String(tipo || '').trim().toUpperCase()] || LIMITES_DOCUMENTO.OTRO
}

export function soloDigitos(valor, max = Infinity) {
  return String(valor || '')
    .replace(/\D/g, '')
    .slice(0, max)
}

export function normalizarDocumento(tipo, valor) {
  const tipoNormalizado = String(tipo || '').trim().toUpperCase()
  const max = limiteDocumento(tipoNormalizado)

  if (['CEDULA', 'RUC'].includes(tipoNormalizado)) {
    return soloDigitos(valor, max)
  }

  return String(valor || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, max)
}

export function normalizarTelefono(valor) {
  return soloDigitos(valor, MAX_TELEFONO)
}

/** Cédula y RUC: solo dígitos al escribir. Pasaporte/otros permiten alfanumérico. */
export function esTipoDocumentoSoloDigitos(tipo) {
  const tipoNormalizado = String(tipo || '').trim().toUpperCase()
  return tipoNormalizado === 'CEDULA' || tipoNormalizado === 'RUC'
}

/**
 * Impide caracteres que no sean dígitos (keydown).
 * Respeta navegación, borrado y atajos Ctrl/Meta.
 */
export function impedirSiNoEsDigito(ev) {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return
  const k = ev.key
  const permitidas = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (permitidas.includes(k)) return
  if (k === ' ') {
    ev.preventDefault()
    return
  }
  if (k.length === 1 && !/\d/.test(k)) ev.preventDefault()
}

export function validarDocumentoPorTipo(tipo, valor, etiqueta = 'documento') {
  const tipoNormalizado = String(tipo || '').trim().toUpperCase()
  const limpio = String(valor || '').trim()

  if (!limpio) return `Ingresa el numero de ${etiqueta}.`
  if (tipoNormalizado === 'CEDULA' && limpio.length !== LIMITES_DOCUMENTO.CEDULA) {
    return 'La cedula debe tener 10 digitos.'
  }
  if (tipoNormalizado === 'RUC' && limpio.length !== LIMITES_DOCUMENTO.RUC) {
    return 'El RUC debe tener 13 digitos.'
  }

  return ''
}

export function validarTelefono(valor) {
  const limpio = normalizarTelefono(valor)
  if (!limpio) return 'Ingresa el telefono.'
  if (!/^\d+$/.test(limpio)) return 'El telefono solo puede contener numeros.'
  if (limpio.length !== MAX_TELEFONO)
    return `El telefono debe tener ${MAX_TELEFONO} digitos.`
  return ''
}
