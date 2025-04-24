<template>
  <div class="scene-viewer">
    <!-- 3D场景容器 -->
    <div id="scene-container"></div>
    
    <!-- 控制面板 -->
    <div class="controls-panel">
      <h3>CUHK_UPPER_ds 点云</h3>
      <div class="stats">
        <div>已加载点数: {{ loadedPoints.toLocaleString() }}</div>
        <div>总点数: {{ totalPoints.toLocaleString() }}</div>
      </div>
      <div class="quality-control">
        <label>渲染质量: </label>
        <select v-model="quality" @change="changeQuality">
          <option value="100000">低 (10万点)</option>
          <option value="300000">中 (30万点)</option>
          <option value="500000">高 (50万点)</option>
          <option value="1000000">超高 (100万点)</option>
        </select>
      </div>
      <div class="render-controls">
        <div class="control-item">
          <label>点大小: </label>
          <input type="range" v-model="pointSize" min="0.01" max="0.2" step="0.01" @input="updatePointSize" />
          <span>{{ pointSize }}</span>
        </div>
        <div class="color-options">
          <label>颜色模式: </label>
          <select v-model="colorMode" @change="updateColorMode">
            <option value="original">原始颜色</option>
            <option value="height">高度渐变</option>
            <option value="rgb">RGB着色</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- 性能监视器 -->
    <div class="performance-monitor" v-if="showPerformance">
      FPS: {{ fps }}
    </div>
    
    <!-- 加载状态提示 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loader"></div>
      <div class="loading-text">加载 CUHK_UPPER_ds 点云中...</div>
      <div class="loading-progress" v-if="showProgress">{{ progressText }}</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'

export default {
  name: 'SceneViewer',
  
  setup() {
    // 响应式状态
    const loading = ref(true)            // 加载状态
    const loadedPoints = ref(0)          // 已加载点数
    const totalPoints = ref(0)           // 总点数
    const quality = ref('300000')        // 默认质量 - 30万点
    const pointSize = ref(0.03)          // 点大小
    const colorMode = ref('original')    // 颜色模式
    const fps = ref(0)                   // 帧率
    const showPerformance = ref(true)    // 是否显示性能监视器
    const showProgress = ref(false)      // 是否显示进度
    const progressText = ref('')         // 进度文本
    
    // Three.js 相关变量
    let scene = null                    // 场景对象
    let camera = null                   // 相机对象
    let renderer = null                 // 渲染器对象
    let controls = null                 // 控制器对象
    let pointCloud = null               // 点云对象
    let pointsMaterial = null           // 点云材质
    let stats = null                    // 性能监视器
    let clock = null                    // 时钟对象
    let axesHelper = null               // 坐标轴辅助
    
    // 最后一次获取的数据
    let lastPointsData = null           // 上次获取的点数据
    let lastColors = null               // 上次获取的颜色数据
    
    /**
     * 初始化3D场景
     * 创建Three.js场景、相机、渲染器和控制器
     */
    const initScene = () => {
      // 创建时钟对象用于计时
      clock = new THREE.Clock()
      
      // 创建场景
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0x111111)  // 深色背景更适合显示点云
      
      // 创建透视相机 - 模拟人眼视角
      camera = new THREE.PerspectiveCamera(
        60,  // 视场角(FOV) - 60度
        window.innerWidth / window.innerHeight,  // 宽高比 - 匹配容器
        0.1,  // 近平面 - 距离相机多近的物体会被渲染
        1000  // 远平面 - 距离相机多远的物体会被渲染
      )
      // 设置相机初始位置
      camera.position.z = 10
      
      // 创建WebGL渲染器
      renderer = new THREE.WebGLRenderer({ 
        antialias: true,  // 抗锯齿
        powerPreference: 'high-performance'  // 性能优先
      })
      // 设置渲染器尺寸为容器大小
      renderer.setSize(window.innerWidth, window.innerHeight)
      // 支持高DPI设备(如Retina显示屏)
      renderer.setPixelRatio(window.devicePixelRatio)
      
      // 获取容器元素并添加渲染器的Canvas元素
      const container = document.getElementById('scene-container')
      if (container) {
        container.appendChild(renderer.domElement)
      }
      
      // 添加轨道控制器 - 允许用鼠标旋转、平移和缩放场景
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true  // 添加阻尼效果使控制更平滑
      controls.dampingFactor = 0.05  // 阻尼系数
      controls.screenSpacePanning = true  // 平移模式
      controls.maxDistance = 500  // 最大缩放距离
      controls.addEventListener('change', () => {
        // 控制器变化时更新FPS显示
        updateFPS()
      })
      
      // 添加坐标轴辅助 - 帮助了解场景的方向
      axesHelper = new THREE.AxesHelper(2)
      scene.add(axesHelper)
      
      // 设置性能监视器
      stats = new Stats()
      stats.dom.style.position = 'absolute'
      stats.dom.style.top = '60px'
      stats.dom.style.left = '20px'
      container.appendChild(stats.dom)
      
      // 开始动画循环
      animate()
    }

    /**
     * 动画循环函数
     * 连续渲染场景并更新控制器
     */
    const animate = () => {
      // 请求下一帧动画
      requestAnimationFrame(animate)
      
      // 更新控制器状态
      if (controls) controls.update()
      
      // 更新性能统计
      if (stats) stats.update()
      
      // 渲染场景
      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
      
      // 更新FPS显示
      updateFPS()
    }
    
    /**
     * 更新FPS显示
     * 计算当前帧率并更新状态
     */
    const updateFPS = () => {
      if (!clock) return
      
      // 每秒更新一次FPS显示
      const delta = clock.getDelta()
      const currentFps = Math.round(1 / delta)
      
      // 平滑FPS显示，避免数值跳动过大
      fps.value = Math.round((fps.value * 9 + currentFps) / 10)
    }

    /**
     * 加载CUHK_UPPER_ds点云数据
     * 从后端API获取点云数据并处理
     */
    const loadCUHKPointCloud = async () => {
      loading.value = true
      showProgress.value = true
      progressText.value = "请求数据中..."
      
      try {
        // 根据选择的质量级别确定请求的点数
        const maxPoints = parseInt(quality.value)
        
        // 创建URL，指向后端API - 使用相对URL
        // Vue代理会自动将/api开头的请求转发到localhost:8085
        const url = `/api/cuhk-upper?max_points=${maxPoints}`
        
        // 发送请求
        progressText.value = "连接服务器..."
        const response = await fetch(url)
        
        // 检查响应状态
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        // 解析JSON响应
        progressText.value = "处理数据中..."
        const data = await response.json()
        
        // 如果成功接收到点数据
        if (data.points) {
          // 保存数据以便稍后使用
          lastPointsData = data.points
          lastColors = data.colors
          
          // 显示点云
          progressText.value = "渲染点云..."
          displayPointCloud(data.points, data.colors)
          
          // 更新点数信息
          loadedPoints.value = data.loaded_points
          totalPoints.value = data.total_points
        }
        
        // 完成加载
        loading.value = false
        showProgress.value = false
      } catch (error) {
        console.error('加载点云数据时出错:', error)
        loading.value = false
        showProgress.value = false
        
        // 显示错误提示
        progressText.value = "加载失败，请刷新页面重试"
        setTimeout(() => {
          alert('加载点云数据失败，请检查后端服务是否启动。\n错误详情: ' + error.message)
        }, 100)
      }
    }

    /**
     * 显示点云
     * 将点数据转换为Three.js点云对象并添加到场景
     * @param {Array} points - 点坐标数组 [[x,y,z], ...]
     * @param {Array} colors - 点颜色数组 [[r,g,b], ...] (可选)
     */
    const displayPointCloud = (points, colors) => {
      // 先移除现有点云
      if (pointCloud) {
        scene.remove(pointCloud)
        pointCloud.geometry.dispose()
        if (pointsMaterial) pointsMaterial.dispose()
      }
      
      // 创建点云几何体
      const geometry = new THREE.BufferGeometry()
      
      // 创建顶点位置缓冲区
      const positions = new Float32Array(points.length * 3)
      points.forEach((point, i) => {
        positions[i * 3] = point[0]     // X坐标
        positions[i * 3 + 1] = point[1]  // Y坐标
        positions[i * 3 + 2] = point[2]  // Z坐标
      })
      
      // 将位置添加为几何体属性
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      // 处理颜色
      let colorAttribute = null
      
      if (colorMode.value === 'original' && colors) {
        // 使用原始颜色
        colorAttribute = new Float32Array(points.length * 3)
        colors.forEach((color, i) => {
          // 将0-255的RGB值转换为0-1范围
          colorAttribute[i * 3] = color[0] / 255
          colorAttribute[i * 3 + 1] = color[1] / 255
          colorAttribute[i * 3 + 2] = color[2] / 255
        })
      } else if (colorMode.value === 'height') {
        // 基于高度的渐变色
        colorAttribute = new Float32Array(points.length * 3)
        
        // 找出所有点的Y坐标(高度)的最小值和最大值
        const yValues = points.map(p => p[1])
        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)
        const yRange = maxY - minY
        
        // 为每个点基于其高度分配颜色
        points.forEach((point, i) => {
          // 计算归一化高度 (0-1范围)
          const normalizedHeight = yRange !== 0 ? (point[1] - minY) / yRange : 0.5
          
          // 应用蓝色到红色的渐变 (蓝色低处，红色高处)
          colorAttribute[i * 3] = normalizedHeight                       // R
          colorAttribute[i * 3 + 1] = normalizedHeight < 0.5 ? normalizedHeight * 2 : (1 - normalizedHeight) * 2  // G
          colorAttribute[i * 3 + 2] = 1 - normalizedHeight               // B
        })
      } else if (colorMode.value === 'rgb') {
        // RGB模式：根据XYZ坐标着色
        colorAttribute = new Float32Array(points.length * 3)
        
        // 找出XYZ的范围
        const xValues = points.map(p => p[0])
        const yValues = points.map(p => p[1])
        const zValues = points.map(p => p[2])
        
        const minX = Math.min(...xValues)
        const maxX = Math.max(...xValues)
        const xRange = maxX - minX
        
        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)
        const yRange = maxY - minY
        
        const minZ = Math.min(...zValues)
        const maxZ = Math.max(...zValues)
        const zRange = maxZ - minZ
        
        // 为每个点基于其坐标分配RGB颜色
        points.forEach((point, i) => {
          const normalizedX = xRange !== 0 ? (point[0] - minX) / xRange : 0.5
          const normalizedY = yRange !== 0 ? (point[1] - minY) / yRange : 0.5
          const normalizedZ = zRange !== 0 ? (point[2] - minZ) / zRange : 0.5
          
          colorAttribute[i * 3] = normalizedX       // R - 基于X
          colorAttribute[i * 3 + 1] = normalizedY   // G - 基于Y
          colorAttribute[i * 3 + 2] = normalizedZ   // B - 基于Z
        })
      }
      
      // 如果生成了颜色属性，添加到几何体
      if (colorAttribute) {
        geometry.setAttribute('color', new THREE.BufferAttribute(colorAttribute, 3))
      }
      
      // 创建点云材质
      pointsMaterial = new THREE.PointsMaterial({
        size: parseFloat(pointSize.value),
        sizeAttenuation: true,    // 点大小随距离变化
        vertexColors: colorAttribute ? true : false,  // 使用顶点颜色
        transparent: true,
        opacity: 0.8,
        // 如果没有颜色属性，使用默认颜色
        color: colorAttribute ? undefined : new THREE.Color(0xff3300)
      })
      
      // 创建点云对象
      pointCloud = new THREE.Points(geometry, pointsMaterial)
      
      // 计算点云的包围盒以便调整视图
      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      
      // 获取点云中心
      const center = new THREE.Vector3()
      boundingBox.getCenter(center)
      
      // 居中点云
      pointCloud.position.set(-center.x, -center.y, -center.z)
      
      // 添加到场景
      scene.add(pointCloud)
      
      // 调整相机位置以适应点云
      const size = new THREE.Vector3()
      boundingBox.getSize(size)
      
      // 计算点云的最大尺寸
      const maxDim = Math.max(size.x, size.y, size.z)
      
      // 根据相机视角计算适当的距离
      const fov = camera.fov * (Math.PI / 180)
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2))
      
      // 设置相机位置在点云前方
      camera.position.set(0, 0, cameraDistance * 1.5)
      
      // 设置控制器中心点
      controls.target.set(0, 0, 0)
      
      // 更新相机参数
      camera.near = cameraDistance / 100
      camera.far = cameraDistance * 100
      camera.updateProjectionMatrix()
      
      // 更新控制器
      controls.update()
    }

    /**
     * 改变点云渲染质量
     * 根据用户选择的质量级别重新加载点云
     */
    const changeQuality = () => {
      loadCUHKPointCloud()
    }
    
    /**
     * 更新点大小
     * 调整点云材质中的点大小参数
     */
    const updatePointSize = () => {
      if (pointsMaterial) {
        pointsMaterial.size = parseFloat(pointSize.value)
      }
    }
    
    /**
     * 更新颜色模式
     * 根据选择的颜色模式重新应用颜色
     */
    const updateColorMode = () => {
      if (lastPointsData) {
        displayPointCloud(lastPointsData, lastColors)
      }
    }

    /**
     * 处理窗口大小变化
     * 调整相机和渲染器适应新窗口大小
     */
    const onWindowResize = () => {
      if (camera && renderer) {
        // 更新相机宽高比
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        
        // 更新渲染器大小
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
    }

    // 组件挂载时执行
    onMounted(() => {
      // 初始化3D场景
      initScene()
      
      // 加载点云数据
      loadCUHKPointCloud()
      
      // 添加窗口大小变化监听器
      window.addEventListener('resize', onWindowResize)
    })

    // 组件卸载前执行
    onBeforeUnmount(() => {
      // 移除事件监听器
      window.removeEventListener('resize', onWindowResize)
      
      // 清理Three.js资源
      if (renderer) {
        const container = document.getElementById('scene-container')
        if (container && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
        
        // 移除性能监视器
        if (stats && container.contains(stats.dom)) {
          container.removeChild(stats.dom)
        }
        
        // 释放资源
        if (pointCloud) {
          scene.remove(pointCloud)
          pointCloud.geometry.dispose()
        }
        
        if (pointsMaterial) {
          pointsMaterial.dispose()
        }
        
        if (axesHelper) {
          scene.remove(axesHelper)
        }
        
        // 释放渲染器资源
        renderer.dispose()
      }
    })

    // 返回模板需要的响应式状态和方法
    return {
      loading,
      loadedPoints,
      totalPoints,
      quality,
      pointSize,
      colorMode,
      fps,
      showPerformance,
      showProgress,
      progressText,
      changeQuality,
      updatePointSize,
      updateColorMode
    }
  }
}
</script>

<style scoped>
.scene-viewer {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

#scene-container {
  width: 100%;
  height: 100%;
}

.controls-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 5px;
  z-index: 10;
  min-width: 220px;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.controls-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  text-align: center;
  font-size: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  padding-bottom: 5px;
}

.stats {
  font-size: 12px;
  margin-bottom: 15px;
  background-color: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 3px;
}

.quality-control, .render-controls {
  margin-top: 15px;
}

.quality-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quality-control select, .render-controls select {
  background-color: #333;
  color: white;
  border: 1px solid #555;
  padding: 5px;
  border-radius: 3px;
  width: 120px;
  cursor: pointer;
}

.control-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.control-item label {
  width: 70px;
}

.control-item input[type="range"] {
  flex: 1;
  margin: 0 10px;
  background-color: #333;
}

.control-item span {
  width: 40px;
  text-align: right;
}

.color-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.performance-monitor {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  font-size: 14px;
  font-family: monospace;
  z-index: 10;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loader {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-text {
  color: white;
  font-size: 18px;
  margin-bottom: 10px;
}

.loading-progress {
  color: #3498db;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 