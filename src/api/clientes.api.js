import apiClient from './axios'

export const getClientesApi = (params = {}) =>
  apiClient.get('/clientes', { params })

// GET /clientes/{id} — ADMINISTRADOR, AEROLINEA, CLIENTE (solo propio)
export const getClienteApi = (id) =>
  apiClient.get(`/clientes/${id}`)

export const createClienteApi = (datos) =>
  apiClient.post('/clientes', datos)

// PUT /clientes/{id} — ADMINISTRADOR, CLIENTE (solo propio)
export const updateClienteApi = (id, datos) =>
  apiClient.put(`/clientes/${id}`, datos)

export const deleteClienteApi = (id) =>
  apiClient.delete(`/clientes/${id}`)
