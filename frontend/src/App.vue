<template>
  <div id="app">
    <div class="nav-buttons">
      <button v-if="currentView !== 'upload'" @click="currentView = 'upload'">upload page</button>
      <button v-if="currentView !== 'downsample'" @click="currentView = 'downsample'">down-sampling tool</button>
    </div>

    <div v-if="currentView === 'upload'" class="upload-page-wrapper">
      <FileUpload @file-uploaded="onFileUploaded" />
      <button @click="useRecommend" class="recommend-btn" :disabled="isLoadingRecommend"> use recommended point cloud file</button>
      <div v-if="isLoadingRecommend" style="margin-top:10px;color:#2196f3;font-size:16px;">uploading...</div>
    </div>

    <div v-else-if="currentView === 'viewer'" class="viewer-wrapper">
      <PointCloudViewer :filename="uploadedFile.filename" @back-to-upload="onBackToUpload" />
    </div>

    <div v-else-if="currentView === 'downsample'">
      <DownsamplePly />
    </div>

    <div class="author-info">
      CHANG, Rui He (rchangab@connect.ust.hk)
    </div>
  </div>
</template>

<script>
import FileUpload from './components/FileUpload.vue';
import PointCloudViewer from './components/PointCloudViewer.vue';
import DownsamplePly from './components/DownsamplePly.vue';

export default {
  name: 'App',
  components: {
    FileUpload,
    PointCloudViewer,
    DownsamplePly
  },
  data() {
    return {
      uploadedFile: null,
      isLoadingRecommend: false,
      currentView: 'upload' // 'upload', 'viewer', 'downsample'
    }
  },
  watch: {
    uploadedFile(newVal) {
      if (newVal) {
        this.currentView = 'viewer';
      }
    }
  },
  methods: {
    onFileUploaded(fileData) {
      this.uploadedFile = fileData;
    },
    onBackToUpload() {
      this.uploadedFile = null;
      this.currentView = 'upload';
    },
    async useRecommend() {
      this.isLoadingRecommend = true;
      try {
        await fetch('http://localhost:8085/api/pointcloud/recommend.ply');
      } catch {
        // intentionally empty
      }
      this.uploadedFile = {
        filename: 'recommend.ply',
        totalPoints: 0,
        hasColors: false
      };
      this.isLoadingRecommend = false;
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

.nav-buttons {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  gap: 10px;
}

.nav-buttons button {
  padding: 8px 16px;
  background: rgba(33, 150, 243, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upload-page-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.viewer-wrapper {
  height: 100%;
  width: 100%;
}

.recommend-btn {
  margin-top: 10px;
  padding: 10px 24px;
  font-size: 16px;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.recommend-btn:hover {
  background: #357a38;
}

.author-info {
  text-align: center;
  margin-top: 24px;
  font-size: 16px;
  color: #555;
}
</style>
