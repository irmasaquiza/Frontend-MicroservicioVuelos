import apiClient from './axios'

export const getBoletosApi = (params = {}) =>
  apiClient.get('/boletos', {
    params: {
      page: 1,
      page_size: 100,
      ...params,
    },
  })

export const getClienteBoletosApi = () =>
  apiClient.get('/cliente/boletos')

export const getClienteReservaBoletosApi = (idReserva) =>
  apiClient.get(`/cliente/reservas/${idReserva}/boleto`)

export const getBoletoApi = (idBoleto) =>
  apiClient.get(`/boletos/${idBoleto}`)
