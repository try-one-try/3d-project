import axios, { AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'

export interface ApiError {
  status: number
  message: string
  details?: unknown
}

export type ApiResponse<T> = T

const baseURL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8085'

const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 600000
})

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // You can attach auth headers here if needed
  return config
})

instance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data as ApiResponse<any>
  },
  (error: AxiosError) => {
    const status = error.response?.status || 0
    const data: any = error.response?.data
    const errMsg = (data && (data.error || data.message)) || error.message || '请求出错'
    if (status >= 500) {
      message.error(`服务器错误(${status}): ${errMsg}`)
    } else if (status >= 400) {
      message.warning(`请求失败(${status}): ${errMsg}`)
    } else {
      message.error(errMsg)
    }
    return Promise.reject({ status, message: errMsg, details: data } as ApiError)
  }
)

export default instance


