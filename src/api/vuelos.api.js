import apiClient from './axios'

export const getVuelosApi = (params = {}) =>
  apiClient.get('/vuelos', {
    params: {
      page_size: 50,
      ...params,
    },
  })

export const getVueloDetalleApi = (idVuelo) => apiClient.get(`/vuelos/${idVuelo}`)

export const createVueloApi = (payload) => apiClient.post('/vuelos', payload)

export const updateVueloApi = (idVuelo, payload) => apiClient.put(`/vuelos/${idVuelo}`, payload)

export const cambiarEstadoVueloApi = (idVuelo, payload) =>
  apiClient.patch(`/vuelos/${idVuelo}/estado`, payload)

export const deleteVueloApi = (idVuelo) => apiClient.delete(`/vuelos/${idVuelo}`)

export const getEscalasVueloApi = (idVuelo) => apiClient.get(`/vuelos/${idVuelo}/escalas`)

export const getEscalaVueloDetalleApi = (idVuelo, idEscala) =>
  apiClient.get(`/vuelos/${idVuelo}/escalas/${idEscala}`)

export const createEscalaVueloApi = (idVuelo, payload) =>
  apiClient.post(`/vuelos/${idVuelo}/escalas`, payload)

export const deleteEscalaVueloApi = (idVuelo, idEscala) =>
  apiClient.delete(`/vuelos/${idVuelo}/escalas/${idEscala}`)

export const getAsientosVueloApi = (idVuelo, params = {}) =>
  apiClient.get(`/vuelos/${idVuelo}/asientos`, {
    params,
  })

export const getAsientoVueloDetalleApi = (idVuelo, idAsiento) =>
  apiClient.get(`/vuelos/${idVuelo}/asientos/${idAsiento}`)

export const createAsientoVueloApi = (idVuelo, payload) =>
  apiClient.post(`/vuelos/${idVuelo}/asientos`, payload)

export const updateAsientoVueloApi = (idVuelo, idAsiento, payload) =>
  apiClient.patch(`/vuelos/${idVuelo}/asientos/${idAsiento}`, payload)

export const deleteAsientoVueloApi = (idVuelo, idAsiento) =>
  apiClient.delete(`/vuelos/${idVuelo}/asientos/${idAsiento}`)
