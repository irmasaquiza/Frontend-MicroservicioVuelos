import apiClient from './axios'

export const getPasajerosApi = (params = {}) =>
  apiClient.get('/pasajeros', { params })

export const getPasajeroApi = (idPasajero) =>
  apiClient.get(`/pasajeros/${idPasajero}`)

export const createPasajeroApi = (payload) =>
  apiClient.post('/pasajeros', payload)

export const updatePasajeroApi = (idPasajero, payload) =>
  apiClient.put(`/pasajeros/${idPasajero}`, payload)

export const deletePasajeroApi = (idPasajero) =>
  apiClient.delete(`/pasajeros/${idPasajero}`)
