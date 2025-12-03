// 点云渲染组件（基于 Three.js）
// 设计目标：
// 1) 接收点位与可选颜色数组，进行归一化后以 Points 渲染
// 2) 支持鼠标拖拽旋转、滚轮缩放
// 3) 暴露四方向的旋转控制（上/下/左/右），用于外部按钮控制
// 4) 兼容 React.StrictMode：避免重复初始化或多重动画循环
//
// three.js 快速心智模型（非常简化）：
// - Scene(场景)：装东西的“世界”。把物体(Points/Mesh/Light)放进去。
// - Camera(相机)：决定“从哪里看”。常用透视相机(PerspectiveCamera)。
// - Renderer(渲染器)：把场景+相机“拍成”一张 WebGL 画面(Canvas)。
// - Geometry + Material -> Mesh/Points：数据(几何) + 外观(材质) = 可渲染物体。
// 在本组件中：我们把点云数据变成 BufferGeometry，再用 PointsMaterial 画成“很多小点”。

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface PointCloudData {
  points: number[][]
  colors?: number[][]
}

// 组件入参：仅传入数据
interface Props {
  data?: PointCloudData
  style?: React.CSSProperties
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

const PointCloudViewer = forwardRef<PointCloudViewerHandle, Props>(({ data, style }, ref) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const pointsRef = useRef<any>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const animationRef = useRef<number | null>(null)

  // 初始化三要素与交互、循环渲染：
  // 思路：组件挂载时创建 scene/camera/renderer，并注册鼠标事件与 resize 监听；
  //       每一帧根据 rotationRef(旋转) 与 distanceRef(距离) 计算相机位置，再渲染。
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
    // StrictMode 下 effect 可能执行两遍，先清容器
    if (mountRef.current.firstChild) {
      mountRef.current.innerHTML = ''
    }
    mountRef.current.appendChild(renderer.domElement)

    // 使用 OrbitControls 替代手写交互：支持旋转/缩放/平移，带阻尼更自然
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.update()
    controlsRef.current = controls

    // resize：容器大小变化时，更新渲染尺寸与相机纵横比
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

    // 渲染循环：OrbitControls 需要每帧 update() 来应用阻尼等效果
    const animate = () => {
      controls.update()
      renderer.render(scene, camera) // 每帧都重新渲染场景和相机
      // animationRef 不是“动画对象”，它只是用来存放 requestAnimationFrame 的返回值（一个数字 ID）的 ref，方便后续取消动画循环和避免重复启动
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    // 清理函数，组件卸载时清理资源
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      ro.disconnect()
      if (controlsRef.current) {
        controlsRef.current.dispose()
        controlsRef.current = null
      }
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

  // 当传入的新点云数据(data)变化时，重新构建点云几何与材质并添加到场景
  // 注意：这里会先清理旧的几何与材质，避免显存泄漏。
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
    // 步骤概览：
    // 将不同尺寸/位置的点云“标准化”到一个统一盒子里，便于稳定查看：
    // 1) 统计点云包围盒(最小/最大 x,y,z)
    // 2) 计算点云中心(cx, cy, cz) 与每个方向长度(sx, sy, sz)
    // 3) 选择最长边，计算统一缩放系数 scale = 1 / max(sx, sy, sz)
    // 4) 每个点先“平移到以中心为原点”，再按 scale “等比缩放”，
    //    使整体落入单位立方体[-0.5, 0.5]^3（居中展示，大小适中）。
    const numPoints = data.points.length
    // 使用 TypedArray 存三维坐标：每个点占 3 个连续浮点（x,y,z）
    const positions = new Float32Array(numPoints * 3)
    // 若颜色数组长度与点数一致，则为每个点准备 RGB（范围将转为 [0,1]）
    const hasColors = Array.isArray(data.colors) && data.colors.length === numPoints
    const colors = hasColors ? new Float32Array(numPoints * 3) : undefined

    // 1) 统计包围盒：依次更新最小值与最大值
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

    // 2) 计算每个方向的跨度；为防止除以 0，最小用 1 兜底
    const sx = maxX - minX || 1
    const sy = maxY - minY || 1
    const sz = maxZ - minZ || 1
    // 3) 取最长边来决定统一缩放比例，使最长边缩放到 1（其他边 < 1）
    const scale = 1 / Math.max(sx, sy, sz)
    // 计算几何中心点，用于平移到原点
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2

    // 4) 对所有点执行：先减中心(平移)，再乘 scale(缩放)
    //    这样点云被标准化到以(0,0,0)为中心、最长边为 1 的单位立方体
    //    举例：若原始坐标范围是 x∈[0,200]，则中心 cx≈100，缩放后最长边≈1，
    //          点 (150, y, z) 会先变成 (50, y-cy, z-cz)，再乘以 scale≈1/200。
    for (let i = 0; i < numPoints; i++) {
      const [x, y, z] = data.points[i]
      positions[i * 3] = (x - cx) * scale
      positions[i * 3 + 1] = (y - cy) * scale
      positions[i * 3 + 2] = (z - cz) * scale
      // 若包含颜色：将 0~255 的 RGB 转为 three.js 常用的 0~1 浮点
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

    // 点材质：默认白色；若存在颜色属性则使用顶点颜色（每个点都可以有不同颜色）
    const material = new THREE.PointsMaterial({ size: 0.01, vertexColors: !!colors, color: 0xffffff })
    const cloud = new THREE.Points(geometry, material)
    pointsRef.current = cloud
    scene.add(cloud)
  }, [data])

  // 程序化旋转（当 OrbitControls 类型不暴露 rotateLeft/rotateUp 时的兜底实现）
  const rotateBy = (deltaTheta: number, deltaPhi: number) => {
    const c = controlsRef.current
    const cam = cameraRef.current as any
    if (!c || !cam) return
    const offset = new THREE.Vector3().copy(cam.position).sub(c.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.theta += deltaTheta
    spherical.phi += deltaPhi
    const EPS = 1e-6
    const minPhi = (c as any).minPolarAngle ?? 0
    const maxPhi = (c as any).maxPolarAngle ?? Math.PI
    spherical.phi = Math.max(minPhi + EPS, Math.min(maxPhi - EPS, spherical.phi))
    spherical.makeSafe()
    offset.setFromSpherical(spherical)
    cam.position.copy(c.target).add(offset)
    cam.lookAt(c.target)
    c.update()
  }

  // 将四向旋转方法暴露给父组件调用
  // 注意：这里使用“弧度”作为角度单位（rad）。默认每次调用旋转约 0.3rad ≈ 17.2°。
  useImperativeHandle(ref, () => ({
    rotateLeft: (stepRad = 0.3) => {
      rotateBy(stepRad, 0)
    },
    rotateRight: (stepRad = 0.3) => {
      rotateBy(-stepRad, 0)
    },
    rotateUp: (stepRad = 0.3) => {
      rotateBy(0, stepRad)
    },
    rotateDown: (stepRad = 0.3) => {
      rotateBy(0, -stepRad)
    }
  }), [])

  // 渲染容器：仅负责承载 WebGL 画布
  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '70vh',
        border: '1px solid #333',
        borderRadius: 8,
        ...style
      }}
    />
  )
})

export default PointCloudViewer

