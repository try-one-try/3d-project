<template>
  <div id="app">
    <div v-if="!uploadedFile" class="upload-page-wrapper">
      <FileUpload @file-uploaded="onFileUploaded" />
      <button @click="useRecommend" class="recommend-btn" :disabled="isLoadingRecommend">使用推荐点云文件</button>
      <div v-if="isLoadingRecommend" style="margin-top:10px;color:#2196f3;font-size:16px;">上传中...</div>
    </div>
    <div v-else class="viewer-wrapper">
      <PointCloudViewer :filename="uploadedFile.filename" @back-to-upload="onBackToUpload" />
    </div>
    <div class="author-info">
      CHANG, Rui He (rchangab@connect.ust.hk)
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
      uploadedFile: null,
      isLoadingRecommend: false
    }
  },
  methods: {
    onFileUploaded(fileData) {
      this.uploadedFile = fileData;
    },
    onBackToUpload() {
      this.uploadedFile = null;
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
