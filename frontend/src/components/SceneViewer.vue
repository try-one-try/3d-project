<template>
  <div class="scene-viewer">
    <!-- 3D场景容器 -->
    <div id="scene-container"></div>
    
    <!-- 加载状态提示 -->
    <div v-if="loading" class="loading-overlay">
      加载中...
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default {
  name: 'SceneViewer',
  
  setup() {
    const loading = ref(true)
    let scene = null
    let camera = null
    let renderer = null
    let controls = null
    let pointCloud = null

    const initScene = () => {
      // 创建场景
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf0f0f0)
      
      // 创建相机
      camera = new THREE.PerspectiveCamera(
        75, // 视角
        window.innerWidth / window.innerHeight, // 宽高比
        0.1, // 近平面
        1000 // 远平面
      )
      camera.position.z = 5
      
      // 创建渲染器
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      
      // 获取容器元素并添加渲染器的DOM元素
      const container = document.getElementById('scene-container')
      if (container) {
        container.appendChild(renderer.domElement)
      }
      
      // 添加轨道控制器
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true // 添加阻尼效果
      
      // 添加坐标轴辅助
      const axesHelper = new THREE.AxesHelper(5)
      scene.add(axesHelper)
      
      // 添加网格辅助
      const gridHelper = new THREE.GridHelper(10, 10)
      scene.add(gridHelper)
      
      animate()
    }

    const animate = () => {
      requestAnimationFrame(animate)
      if (controls) controls.update()
      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
    }

    const loadSceneData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/scenes')
        const data = await response.json()
        // 默认显示立方体点云
        displayPoints(data.scenes.cube.points, data.scenes.cube.color)
        loading.value = false
      } catch (error) {
        console.error('Error loading scene data:', error)
        loading.value = false
      }
    }

    const displayPoints = (points, color) => {
      // 创建点云几何体
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(points.length * 3)
      
      points.forEach((point, i) => {
        positions[i * 3] = point[0]
        positions[i * 3 + 1] = point[1]
        positions[i * 3 + 2] = point[2]
      })
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      // 创建点云材质
      const material = new THREE.PointsMaterial({
        color: color || 0xff0000,
        size: 0.05,
        sizeAttenuation: true
      })
      
      // 如果已存在点云，则移除
      if (pointCloud) {
        scene.remove(pointCloud)
      }
      
      // 创建点云对象并添加到场景
      pointCloud = new THREE.Points(geometry, material)
      scene.add(pointCloud)
    }

    const onWindowResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
    }

    onMounted(() => {
      initScene()
      loadSceneData()
      window.addEventListener('resize', onWindowResize)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', onWindowResize)
    })

    return {
      loading
    }
  }
}
</script>

<style scoped>
.scene-viewer {
  width: 100%;
  height: 100vh;
  position: relative;
}

#scene-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 20px;
  border-radius: 5px;
}
</style>
