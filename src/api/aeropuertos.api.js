import apiClient from './axios'

export const getAeropuertosAdminApi = (params = {}) =>
  apiClient.get('/aeropuertos', { params })

export const getAeropuertoAdminApi = (idAeropuerto) =>
  apiClient.get(`/aeropuertos/${idAeropuerto}`)

export const createAeropuertoAdminApi = (payload) =>
  apiClient.post('/aeropuertos', payload)

export const updateAeropuertoAdminApi = (idAeropuerto, payload) =>
  apiClient.put(`/aeropuertos/${idAeropuerto}`, payload)

export const deleteAeropuertoAdminApi = (idAeropuerto) =>
  apiClient.delete(`/aeropuertos/${idAeropuerto}`)
