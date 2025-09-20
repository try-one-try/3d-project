// Redux Store 全局入口
// 说明：
// - 使用 Redux Toolkit 简化 store 配置
// - 导出通用的 RootState、AppDispatch 类型，便于全局使用

import { configureStore } from '@reduxjs/toolkit'
import pointCloudReducer from './pointCloudSlice.ts'

export const store = configureStore({
  reducer: {
    // 点云相关的状态管理切片
    pointCloud: pointCloudReducer
  }
})

// 推导出全局 RootState 类型（用于 useSelector）
export type RootState = ReturnType<typeof store.getState>

// 推导出全局 AppDispatch 类型（用于 useDispatch）
export type AppDispatch = typeof store.dispatch


