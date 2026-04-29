import apiClient from './axios'

export const getCiudadesApi = (params = {}) =>
  apiClient.get('/ciudades', { params })

export const getCiudadApi = (idCiudad) =>
  apiClient.get(`/ciudades/${idCiudad}`)

export const createCiudadApi = (payload) =>
  apiClient.post('/ciudades', payload)

export const updateCiudadApi = (idCiudad, payload) =>
  apiClient.put(`/ciudades/${idCiudad}`, payload)

export const deleteCiudadApi = (idCiudad) =>
  apiClient.delete(`/ciudades/${idCiudad}`)
