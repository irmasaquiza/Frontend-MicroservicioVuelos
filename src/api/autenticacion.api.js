import apiClient from './axios'

export const loginApi = (datos) =>
  apiClient.post('/auth/login', datos)

export const logoutApi = () =>
  apiClient.post('/auth/logout')

export const registerClienteApi = (datos) =>
  apiClient.post('/auth/register-cliente', datos)
