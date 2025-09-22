// 点云模块的切片（Slice）
// 说明：
// - 统一管理 Home 页的文件选择、上传、渲染状态
// - 提供异步 Thunk，用于调用后端 API（上传/获取点云数据）
// - 尽量详细的中文注释，便于后续维护

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { fetchPointCloud, uploadPointCloud, type UploadResponse } from '@/apis/pointCloud'

// 定义点云渲染所需的数据结构
export interface ViewerData {
  points: number[][]
  colors?: number[][]
}

// 定义模块的状态结构
export interface PointCloudState {
  // 当前选择的文件对象（未上传前）
  selectedFile: File | null
  // 上传成功后，后端返回的文件元信息
  uploaded: UploadResponse | null
  // 上传加载中状态
  uploading: boolean
  // 渲染加载中状态
  rendering: boolean
  // 用于 Three.js 渲染的数据
  viewerData?: ViewerData
}

const initialState: PointCloudState = {
  selectedFile: null,
  uploaded: null,
  uploading: false,
  rendering: false,
  viewerData: undefined
}

// 异步：上传点云文件
export const uploadPointCloudThunk = createAsyncThunk(
  'pointCloud/upload',
  async (file: File) => {
    // 直接调用已封装的 API
    const res = await uploadPointCloud(file)
    return res
  }
)

// 异步：根据文件名获取点云数据
export const fetchPointCloudThunk = createAsyncThunk(
  'pointCloud/fetch',
  async (filename: string) => {
    const data = await fetchPointCloud(filename)
    return data
  }
)

const pointCloudSlice = createSlice({
  name: 'pointCloud',
  initialState,
  reducers: {
    // 选择文件（仅前端本地状态）
    setSelectedFile(state, action: PayloadAction<File | null>) {
      state.selectedFile = action.payload // payload 是 File | null 类型
      // 选择新文件时，清空之前上传和渲染的数据
      if (action.payload) {
        state.uploaded = null
        state.viewerData = undefined
      }
    }
  },

  // 每个异步 thunk（如 uploadPointCloudThunk）都有三种状态
  // extraReducers处理异步操作的各种状态
  extraReducers: (builder) => {
    // pending：异步操作进行中
    builder.addCase(uploadPointCloudThunk.pending, (state) => {
      state.uploading = true // 设置加载状态为 true
    })
    // fulfilled：异步操作成功
    builder.addCase(uploadPointCloudThunk.fulfilled, (state, action) => {
      state.uploading = false // 关闭加载状态
      state.uploaded = action.payload // 设置上传成功后的数据
    })
    // rejected：异步操作失败
    builder.addCase(uploadPointCloudThunk.rejected, (state) => {
      state.uploading = false // 关闭加载状态
    })

    // 获取点云数据
    builder.addCase(fetchPointCloudThunk.pending, (state) => {
      state.rendering = true
    })
    builder.addCase(fetchPointCloudThunk.fulfilled, (state, action) => {
      state.rendering = false
      state.viewerData = { points: action.payload.points, colors: action.payload.colors }
    })
    builder.addCase(fetchPointCloudThunk.rejected, (state) => {
      state.rendering = false
    })
  }
})

export const { setSelectedFile } = pointCloudSlice.actions
export default pointCloudSlice.reducer


