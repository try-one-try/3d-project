declare module 'three'

// 为 OrbitControls 添加模块声明，避免 TS 报错（本项目未启用 @types/three）
declare module 'three/examples/jsm/controls/OrbitControls.js' {
  import * as THREE from 'three'
  export class OrbitControls {
    constructor(object: THREE.Camera, domElement?: HTMLElement)
    object: THREE.Camera
    domElement: HTMLElement
    // 常用属性
    enabled: boolean
    target: THREE.Vector3
    enableDamping: boolean
    dampingFactor: number
    minDistance: number
    maxDistance: number
    minPolarAngle: number
    maxPolarAngle: number
    // 常用方法
    update(): void
    dispose(): void
    // 这些方法在不同版本中可能不存在，程序化旋转时我们会做兜底
    rotateLeft?(angle: number): void
    rotateUp?(angle: number): void
  }
}


