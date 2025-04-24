<template>
  <div id="app">
    <div v-if="!uploadedFile">
      <FileUpload @file-uploaded="onFileUploaded" />
    </div>
    <div v-else class="viewer-wrapper">
      <PointCloudViewer :filename="uploadedFile.filename" />
    </div>
  </div>
</template>

<script>
import FileUpload from './components/FileUpload.vue';
import PointCloudViewer from './components/PointCloudViewer.vue';

export default {
  name: 'App',
  components: {
    FileUpload,
    PointCloudViewer
  },
  data() {
    return {
      uploadedFile: null
    }
  },
  methods: {
    onFileUploaded(fileData) {
      this.uploadedFile = fileData;
    }
  }
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100vh;
  width: 100vw;
}

.viewer-wrapper {
  height: 100%;
  width: 100%;
}
</style>
