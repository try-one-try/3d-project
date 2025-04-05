<template>
  <div id="app">
    <!-- 这里将放置我们的3D场景查看器组件 -->
    <scene-viewer />
  </div>
</template>

<script>
import SceneViewer from './components/SceneViewer.vue'

export default {
  name: 'App',
  components: {
    SceneViewer
  }
}
</script>

<style>
/* 重置默认样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 设置根元素样式 */
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
