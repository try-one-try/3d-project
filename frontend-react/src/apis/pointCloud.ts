// 点云相关的 API 封装
// 说明：
// - 与后端的接口约定：
//   1) POST /api/upload  上传 .ply 文件，返回文件名/点数/是否含颜色
//   2) GET  /api/pointcloud/:filename  根据文件名获取点与可选颜色
// - 所有请求通过统一封装的 axios 实例（见 src/request.ts）发送
// - 此处仅处理数据的类型与入参，错误提示由拦截器负责

import http from '@/request'

export interface UploadResponse {
  success: boolean
  filename: string
  total_points: number
  has_colors: boolean
}

export interface PointCloudResponse {
  points: number[][]
  colors?: number[][]
  total_points: number
}

// 降采样下载：后端返回二进制（PLY 文件），这里以 Blob 返回
export async function downsamplePointCloud(file: File, keepRatio: number): Promise<Blob> {
  const form = new FormData()
  form.append('file', file)
  form.append('keep_ratio', String(keepRatio))
  // 这里需要以 arraybuffer 方式拿响应，然后转 Blob
  const arrayBuffer = (await http.post('/api/downsample', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'arraybuffer'
  })) as unknown as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/octet-stream' })
}

// 上传 .ply 文件
export async function uploadPointCloud(file: File): Promise<UploadResponse> {
  // 使用 FormData 包装文件，字段名需与后端读取的一致（此处为 'file'）
  const form = new FormData()
  form.append('file', file)
  // 通过统一的 http 实例发送请求；拦截器会直接返回 data
  return http.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 根据文件名拉取点云数据（包含点位与可选颜色）
export async function fetchPointCloud(filename: string): Promise<PointCloudResponse> {
  return http.get(`/api/pointcloud/${encodeURIComponent(filename)}`)
}


