import apiClient from './axios'

export const getReservasApi = (params = {}) =>
  apiClient.get('/reservas', { params })

export const getReservaApi = (idReserva) =>
  apiClient.get(`/reservas/${idReserva}`)

export const createReservaApi = (payload) =>
  apiClient.post('/reservas', payload)

export const getClienteReservasApi = () =>
  apiClient.get('/cliente/reservas')

export const getClienteReservaApi = (idReserva) =>
  apiClient.get(`/cliente/reservas/${idReserva}`)

export const getClienteReservaDetalleApi = (idReserva) =>
  apiClient.get(`/cliente/reservas/${idReserva}/detalle`)

export const pagarReservaApi = (idReserva, payload) =>
  apiClient.patch(`/reservas/${idReserva}/pagar`, payload)

export const cambiarEstadoReservaApi = (idReserva, payload) =>
  apiClient.patch(`/reservas/${idReserva}/estado`, payload)

export const deleteReservaApi = (idReserva) =>
  apiClient.delete(`/reservas/${idReserva}`)
