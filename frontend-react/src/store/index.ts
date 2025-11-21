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
  },
  // 说明：
  // - Home 与 File-Analyzing 页面都会把浏览器的 File 对象放入 Redux（selectedFile），
  //   这是非序列化数据，默认的 serializableCheck 会报警告。
  // - 这里显式忽略该 action 与该路径，避免控制台噪声；此做法安全可控。
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略把 File 放入 action 的类型
        ignoredActions: ['pointCloud/setSelectedFile'],
        // 忽略 state 中保存 File 的路径
        ignoredPaths: ['pointCloud.selectedFile']
      }
    })
})

// 推导出全局 RootState 类型（用于 useSelector）
export type RootState = ReturnType<typeof store.getState>

// 推导出全局 AppDispatch 类型（用于 useDispatch）
export type AppDispatch = typeof store.dispatch


