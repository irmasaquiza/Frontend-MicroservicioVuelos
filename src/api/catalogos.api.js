import apiClient from './axios'

function limpiarParams(params = {}) {
  const limpios = {}

  Object.entries(params).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return

    if ((clave === 'id_pais' || clave === 'id_ciudad') && Number(valor) <= 0) return

    limpios[clave] = valor
  })

  const page = Number(limpios.page ?? 1)
  const pageSize = Number(limpios.page_size ?? 200)

  limpios.page = Number.isFinite(page) && page > 0 ? page : 1
  limpios.page_size = Number.isFinite(pageSize)
    ? Math.min(Math.max(pageSize, 1), 200)
    : 200

  return limpios
}

// GET /paises — AllowAnonymous
export const getPaisesApi = (params = {}) =>
  apiClient.get('/paises', { params: limpiarParams(params) })

// GET /ciudades — AllowAnonymous. Filtrar por id_pais para cargar por país.
export const getCiudadesApi = (params = {}) =>
  apiClient.get('/ciudades', { params: limpiarParams(params) })

// GET /aeropuertos — AllowAnonymous
export const getAeropuertosApi = (params = {}) =>
  apiClient.get('/aeropuertos', { params: limpiarParams(params) })
