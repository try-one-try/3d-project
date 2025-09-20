// 自定义的类型化 Hooks，避免在组件内重复书写类型
import { useDispatch, useSelector } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'
import type { AppDispatch, RootState } from './index.ts'

// 类型化的 useDispatch
export const useAppDispatch = () => useDispatch<AppDispatch>()

// 类型化的 useSelector
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector


