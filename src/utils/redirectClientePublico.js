/**
 * Redirect post-login/registro: solo rutas relativas internas (`/foo?bar=baz`).
 */
export function redirectClientePublicoSeguro(valor) {
  if (!valor || typeof valor !== 'string') return ''
  let t = String(valor).trim()
  if (!t.startsWith('/') || t.startsWith('//')) return ''
  if (/%[0-9A-Fa-f]{2}/.test(t)) {
    try {
      t = decodeURIComponent(t.replace(/\+/g, '%20'))
    } catch {
      return ''
    }
  }
  if (!t.startsWith('/') || t.startsWith('//')) return ''
  return t.split('#')[0] || t
}
