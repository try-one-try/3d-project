// 点云渲染组件（基于 Three.js）
// 设计目标：
// 1) 接收点位与可选颜色数组，进行归一化后以 Points 渲染
// 2) 支持鼠标拖拽旋转、滚轮缩放
// 3) 暴露四方向的旋转控制（上/下/左/右），用于外部按钮控制
// 4) 兼容 React.StrictMode：避免重复初始化或多重动画循环

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'

export interface PointCloudData {
  points: number[][]
  colors?: number[][]
}

// 组件入参：仅传入数据
interface Props {
  data?: PointCloudData
}

// 暴露给父组件调用的控制句柄类型
export interface PointCloudViewerHandle {
  // 向左旋转（绕 Y 轴）
  rotateLeft: (stepRad?: number) => void
  // 向右旋转（绕 Y 轴）
  rotateRight: (stepRad?: number) => void
  // 向上旋转（绕 X 轴）
  rotateUp: (stepRad?: number) => void
  // 向下旋转（绕 X 轴）
  rotateDown: (stepRad?: number) => void
}

const PointCloudViewer = forwardRef<PointCloudViewerHandle, Props>(({ data }, ref) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const pointsRef = useRef<any>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const animationRef = useRef<number | null>(null)
  // 将相机“围绕目标”的旋转与距离放入 ref，便于在外部按钮中控制
  const rotationRef = useRef(new THREE.Euler(0, 0, 0, 'XYZ'))
  const distanceRef = useRef({ value: 2 })

  useEffect(() => {
    if (!mountRef.current) return

    const width = mountRef.current.clientWidth || 800
    const height = mountRef.current.clientHeight || 600

    // 创建基础三要素：场景、相机、渲染器
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0a)
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 10000)
    camera.position.set(0, 0, 2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    // In React StrictMode (dev), effects may run twice; ensure container is clean
    if (mountRef.current.firstChild) {
      mountRef.current.innerHTML = ''
    }
    mountRef.current.appendChild(renderer.domElement)

    // 基本交互控制（无需引入 OrbitControls）：
    // - 按下并拖拽：改变欧拉角 rotationRef
    // - 滚轮：改变距离 distanceRef
    let isDragging = false
    let prevX = 0
    let prevY = 0

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true
      prevX = e.clientX
      prevY = e.clientY
    }
    const onPointerUp = () => {
      isDragging = false
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return
      const dx = e.clientX - prevX
      const dy = e.clientY - prevY
      prevX = e.clientX
      prevY = e.clientY
      rotationRef.current.y += dx * 0.005
      rotationRef.current.x += dy * 0.005
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = Math.sign(e.deltaY)
      distanceRef.current.value = Math.min(1000, Math.max(0.1, distanceRef.current.value * (1 + delta * 0.1)))
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // resize
    const ro = new ResizeObserver(() => {
      if (!mountRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(mountRef.current)
    resizeObserverRef.current = ro

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer

    // 渲染循环：根据当前 rotationRef 与 distanceRef 计算相机位置与朝向
    const animate = () => {
      const target = new THREE.Vector3(0, 0, 0)
      const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotationRef.current)
      const base = new THREE.Vector3(0, 0, distanceRef.current.value)
      const pos = base.applyMatrix4(rotationMatrix)
      camera.position.copy(pos)
      camera.lookAt(target)
      renderer.render(scene, camera)
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('wheel', onWheel)
      if (pointsRef.current) {
        scene.remove(pointsRef.current)
        pointsRef.current.geometry.dispose()
          ; (pointsRef.current.material as any).dispose()
      }
      renderer.dispose()
      if (mountRef.current) {
        mountRef.current.innerHTML = ''
      }
      // 重置相关引用，避免内存泄漏
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      pointsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!data || !sceneRef.current) return
    const scene = sceneRef.current
    if (pointsRef.current) {
      scene.remove(pointsRef.current)
      pointsRef.current.geometry.dispose()
        ; (pointsRef.current.material as any).dispose()
      pointsRef.current = null
    }

    // 将原始点云数据归一化至 [-0.5, 0.5] 立方体，保证不同尺度的数据都能居中展示
    const numPoints = data.points.length
    const positions = new Float32Array(numPoints * 3)
    const hasColors = Array.isArray(data.colors) && data.colors.length === numPoints
    const colors = hasColors ? new Float32Array(numPoints * 3) : undefined

    // normalize to unit cube centered
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < numPoints; i++) {
      const [x, y, z] = data.points[i]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }
    const sx = maxX - minX || 1
    const sy = maxY - minY || 1
    const sz = maxZ - minZ || 1
    const scale = 1 / Math.max(sx, sy, sz)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2

    for (let i = 0; i < numPoints; i++) {
      const [x, y, z] = data.points[i]
      positions[i * 3] = (x - cx) * scale
      positions[i * 3 + 1] = (y - cy) * scale
      positions[i * 3 + 2] = (z - cz) * scale
      if (colors && data.colors) {
        const [r, g, b] = data.colors[i]
        colors[i * 3] = (r ?? 255) / 255
        colors[i * 3 + 1] = (g ?? 255) / 255
        colors[i * 3 + 2] = (b ?? 255) / 255
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // 点材质：默认白色；若存在颜色属性则使用顶点颜色
    const material = new THREE.PointsMaterial({ size: 0.01, vertexColors: !!colors, color: 0xffffff })
    const cloud = new THREE.Points(geometry, material)
    pointsRef.current = cloud
    scene.add(cloud)
  }, [data])

  // 将四向旋转方法暴露给父组件调用
  useImperativeHandle(ref, () => ({
    rotateLeft: (stepRad = 0.3) => {
      rotationRef.current.y -= stepRad
    },
    rotateRight: (stepRad = 0.3) => {
      rotationRef.current.y += stepRad
    },
    rotateUp: (stepRad = 0.3) => {
      rotationRef.current.x -= stepRad
    },
    rotateDown: (stepRad = 0.3) => {
      rotationRef.current.x += stepRad
    }
  }), [])

  // 渲染容器：仅负责承载 WebGL 画布
  return <div ref={mountRef} style={{ width: '100%', height: '70vh', border: '1px solid #333', borderRadius: 8 }} />
})

export default PointCloudViewer

