import { parseJwtPayload } from '@/utils/portalCliente'

/** Mensaje cuando el JWT tiene `exp` en el pasado */
export const MSJ_SESION_EXPIRADA = 'Sesión expirada. Por favor vuelve a seleccionar tu vuelo.'

/**
 * Extrae datos del JWT para el checkout aerolinea (?token=).
 * Contrato nuevo: solo `id_vuelo` e `url_retorno` (acepta camelCase también).
 * `id_asiento` es opcional (tokens legacy con asiento prefijado).
 */
export function claimsCheckoutAerolinea(token) {
  const payload = parseJwtPayload(token || '')
  if (!payload) return null

  const idVuelo = payload.id_vuelo ?? payload.idVuelo
  const idAsientoLegacy = payload.id_asiento ?? payload.idAsiento
  const urlRetorno = payload.url_retorno ?? payload.urlRetorno ?? ''

  return {
    payload,
    idVuelo: idVuelo != null ? String(idVuelo).trim() : '',
    idAsiento: idAsientoLegacy != null ? String(idAsientoLegacy).trim() : '',
    urlRetorno: String(urlRetorno || '').trim(),
  }
}

/** Considera expirado solo si existe `exp` numerico valido y ya paso */
export function jwtExpirado(payload) {
  const exp = payload?.exp
  if (exp == null || exp === '') return false
  const ts = Number(exp)
  if (!Number.isFinite(ts)) return false
  return Date.now() >= ts * 1000
}

/** Solo http/https permitidos para redireccion post-pago */
export function urlRetornoSegura(valor) {
  try {
    const u = new URL(valor)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    /* ignorar */
  }
  return ''
}
