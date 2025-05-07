<template>
  <div class="viewer-container">
    <div class="controls">
      <button @click="rotate('up')">Up</button>
      <button @click="rotate('down')">Down</button>
      <button @click="rotate('left')">Left</button>
      <button @click="rotate('right')">Right</button>
      <button @click="zoom('in')">Zoom In</button>
      <button @click="zoom('out')">Zoom Out</button>
      <input type="number" v-model.number="zoomStep" min="0.1" step="0.1" style="width:60px; margin-left:10px;" />
      <span style="color:#fff; margin-left:4px;">Scale</span>
      <button @click="toggleDebug" style="margin-left:16px;">{{ showDebug ? 'Hide Debug' : 'Show Debug' }}</button>
      <button @click="backToUpload" style="margin-left:16px;background:#f44336;">Back to Upload Page</button>
    </div>
    <div ref="rendererContainer" class="renderer-container"></div>
    <div v-if="isLoading" class="loading-indicator">loading...</div>
    <div class="debug-panel" v-if="showDebug && debugInfo">
      <h3>debug information</h3>
      <p>point number: {{ debugInfo.totalPoints }}</p>
      <p>has color information: {{ debugInfo.hasColors ? 'yes' : 'no' }}</p>
      <p v-if="debugInfo.colorSamples && debugInfo.colorSamples.length > 0">
        color samples: 
        <span v-for="(sample, index) in debugInfo.colorSamples" :key="index" 
              :style="{backgroundColor: `rgb(${sample[0]}, ${sample[1]}, ${sample[2]})`, 
                      width: '20px', height: '20px', display: 'inline-block', margin: '0 5px'}"></span>
      </p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PointCloudViewer',
  props: {
    filename: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isLoading: true,
      debugInfo: null,
      zoomStep: 1.2, // 默认缩放比例
      showDebug: false
    }
  },
  mounted() {
    this.loadThreeJs();
  },
  beforeUnmount() {
    this.cleanup();
  },
  methods: {
    async loadThreeJs() {
      try {
        // 动态导入Three.js以避免SSR问题
        const THREE = await import('three');
        const OrbitControlsModule = await import('three/examples/jsm/controls/OrbitControls.js');
        const OrbitControls = OrbitControlsModule.OrbitControls;
        
        this.initScene(THREE, OrbitControls);
        this.loadPointCloud(THREE);
      } catch (error) {
        console.error('加载Three.js失败:', error);
      }
    },
    
    initScene(THREE, OrbitControls) {
      // 创建场景
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x111111);
      
      const container = this.$refs.rendererContainer;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // 添加相机
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      this.camera.position.z = 5;
      
      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance" 
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(this.renderer.domElement);
      
      // 添加控制器
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.25;
      
      // 添加坐标轴辅助
      const axesHelper = new THREE.AxesHelper(5);
      this.scene.add(axesHelper);
      
      // 添加环境光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(ambientLight);
      
      // 添加平行光
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(0, 1, 0);
      this.scene.add(directionalLight);
      
      // 添加窗口大小变化的监听
      this.resizeHandler = this.onWindowResize.bind(this);
      window.addEventListener('resize', this.resizeHandler);
      
      // 设置渲染和动画
      this.renderScene = this.renderScene.bind(this);
      this.renderScene();
    },
    
    async loadPointCloud(THREE) {
      try {
        console.log(`正在请求点云数据: http://localhost:8085/api/pointcloud/${this.filename}`);
        const response = await fetch(`http://localhost:8085/api/pointcloud/${this.filename}`);
        if (!response.ok) {
          throw new Error('加载点云数据失败');
        }
        
        const data = await response.json();
        
        // 调试信息
        console.log('接收到的点云数据:', data);
        
        // 收集一些调试信息
        const debugInfo = {
          totalPoints: data.points.length,
          hasColors: !!data.colors,
          colorSamples: []
        };
        
        if (data.colors && data.colors.length > 0) {
          // 获取10个颜色样本
          for (let i = 0; i < Math.min(10, data.colors.length); i++) {
            debugInfo.colorSamples.push(data.colors[i]);
          }
          console.log('颜色样本:', debugInfo.colorSamples);
        }
        
        this.debugInfo = debugInfo;
        
        // 创建点云几何体
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array(data.points.flat());
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        // 设置材质
        let material;
        
        if (data.colors && data.colors.length > 0) {
          console.log(`点云有颜色信息，颜色数量: ${data.colors.length}`);
          // 如果有颜色信息，使用颜色
          const colors = new Float32Array(data.points.length * 3);
          
          for (let i = 0; i < data.points.length; i++) {
            if (i < data.colors.length) {
              colors[i * 3] = data.colors[i][0] / 255;
              colors[i * 3 + 1] = data.colors[i][1] / 255;
              colors[i * 3 + 2] = data.colors[i][2] / 255;
            } else {
              // 如果颜色数据不够，使用默认颜色
              colors[i * 3] = 1.0;     // 红色
              colors[i * 3 + 1] = 0.0; // 绿色
              colors[i * 3 + 2] = 0.0; // 蓝色
            }
          }
          
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          material = new THREE.PointsMaterial({ 
            size: 0.01, 
            vertexColors: true 
          });
          console.log('已设置颜色材质');
        } else {
          console.log('点云没有颜色信息，使用默认颜色');
          // 没有颜色信息，使用单一颜色
          material = new THREE.PointsMaterial({ 
            size: 0.01, 
            color: 0x00ff00 
          });
        }
        
        // 创建点云对象
        this.pointCloud = new THREE.Points(geometry, material);
        
        // 计算包围盒并设置相机位置
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        
        // 计算包围盒的中心点
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // 将点云移到中心
        this.pointCloud.position.set(-center.x, -center.y, -center.z);
        
        // 计算包围盒的大小
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // 设置相机位置使整个点云可见
        this.camera.position.set(0, 0, maxDim * 1.5);
        this.camera.near = maxDim / 100;
        this.camera.far = maxDim * 100;
        this.camera.updateProjectionMatrix();
        
        // 设置控制器的目标点为中心
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        // 添加点云到场景
        this.scene.add(this.pointCloud);
        
        this.isLoading = false;
      } catch (error) {
        console.error('加载点云数据出错:', error);
      }
    },
    
    renderScene() {
      if (!this.renderer || !this.scene || !this.camera) {
        this.animationFrameId = requestAnimationFrame(this.renderScene);
        return;
      }

      this.animationFrameId = requestAnimationFrame(this.renderScene);
      
      if (this.controls) {
        this.controls.update();
      }
      
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        console.error('渲染错误:', error);
        cancelAnimationFrame(this.animationFrameId);
      }
    },
    
    onWindowResize() {
      if (!this.camera || !this.renderer || !this.$refs.rendererContainer) return;
      
      const container = this.$refs.rendererContainer;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    },
    
    cleanup() {
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }
      
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      if (this.renderer && this.$refs.rendererContainer) {
        this.renderer.dispose();
        this.$refs.rendererContainer.removeChild(this.renderer.domElement);
      }
      
      if (this.pointCloud && this.scene) {
        this.scene.remove(this.pointCloud);
        if (this.pointCloud.geometry) this.pointCloud.geometry.dispose();
        if (this.pointCloud.material) this.pointCloud.material.dispose();
      }
      
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.pointCloud = null;
    },
    rotate(direction) {
      if (!this.pointCloud) return;
      const step = Math.PI / 6; // 每次旋转30度
      switch (direction) {
        case 'up':
          this.pointCloud.rotation.x -= step;
          break;
        case 'down':
          this.pointCloud.rotation.x += step;
          break;
        case 'left':
          this.pointCloud.rotation.y -= step;
          break;
        case 'right':
          this.pointCloud.rotation.y += step;
          break;
      }
    },
    zoom(direction) {
      if (!this.pointCloud) return;
      if (direction === 'in') {
        this.pointCloud.scale.multiplyScalar(this.zoomStep);
      } else if (direction === 'out') {
        this.pointCloud.scale.multiplyScalar(1 / this.zoomStep);
      }
    },
    toggleDebug() {
      this.showDebug = !this.showDebug;
    },
    backToUpload() {
      this.$emit('back-to-upload');
    }
  }
}
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 200;
  display: flex;
  gap: 10px;
  align-items: center;
}

.controls button {
  padding: 6px 16px;
  font-size: 16px;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.controls button:hover {
  background: #1769aa;
}
.controls button[style*='background:#f44336'] {
  background: #f44336;
}
.controls button[style*='background:#f44336']:hover {
  background: #b71c1c;
}
.controls input[type="number"] {
  padding: 4px 8px;
  font-size: 16px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.renderer-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 18px;
}

.debug-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 100;
  max-width: 300px;
}

.close-button {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}
</style> 