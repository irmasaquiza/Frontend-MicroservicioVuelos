import apiClient from './axios'

export const getPaisesApi = (params = {}) =>
  apiClient.get('/paises', { params })

export const getPaisApi = (idPais) =>
  apiClient.get(`/paises/${idPais}`)

export const createPaisApi = (payload) =>
  apiClient.post('/paises', payload)

export const updatePaisApi = (idPais, payload) =>
  apiClient.put(`/paises/${idPais}`, payload)

export const deletePaisApi = (idPais) =>
  apiClient.delete(`/paises/${idPais}`)
