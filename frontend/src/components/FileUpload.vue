<template>
  <div class="upload-container">
    <div v-if="!isUploaded" class="upload-form">
      <h2>upload point cloud file</h2>
      <div class="file-input-container">
        <label for="file-upload" class="file-label">
          select PLY file (point number cannot exceed 400M)
        </label>
        <input id="file-upload" type="file" @change="onFileSelected" accept=".ply" class="file-input" />
        <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
      </div>
      <button @click="uploadFile" :disabled="!selectedFile || isUploading" class="upload-button">
        {{ isUploading ? 'uploading...' : 'upload' }}
      </button>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <div class="quality-note">
        <h3>point cloud file upload note</h3>
        <ul>
          <li><strong>Compatible format:</strong> Only PLY file format is supported</li>
          <li><strong>Size limitation:</strong> The point number cannot exceed 400M points, otherwise the server will crash</li>
          <li><strong>Large files:</strong> For large point clouds, please use the down-sampling tool first</li>
          <li><strong>Processing time:</strong> Large point cloud may take longer to upload and process</li>
        </ul>
      </div>

    </div>

  </div>
</template>

<script>
export default {
  name: 'FileUpload',
  data() {
    return {
      selectedFile: null,
      isUploading: false,
      isUploaded: false,
      errorMessage: '',
      uploadedFilename: ''
    }
  },
  methods: {
    onFileSelected(event) {
      const file = event.target.files[0];
      this.selectedFile = file;
      this.errorMessage = '';
    },
    async uploadFile() {
      if (!this.selectedFile) {
        this.errorMessage = '请选择文件';
        return;
      }
      this.isUploading = true;
      this.errorMessage = '';
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      try {
        const response = await fetch('http://localhost:8085/api/upload', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        if (response.ok) {
          this.isUploaded = true;
          this.uploadedFilename = result.filename;
          // 发射事件通知父组件渲染点云
          this.$emit('file-uploaded', {
            filename: result.filename,
            totalPoints: result.total_points,
            hasColors: result.has_colors
          });
        } else {
          this.errorMessage = result.error || '上传失败';
          // 如果是点数超限错误，添加额外提示
          if (result.error && result.error.includes('超过了400万点的限制')) {
            this.errorMessage += ' Please use the "point cloud down-sampling tool" at the top of the page to reduce the point cloud density first.';
          }
        }
      } catch (error) {
        this.errorMessage = '上传过程中发生错误: ' + error.message;
      } finally {
        this.isUploading = false;
      }
    }
  }
}
</script>

<style scoped>
.upload-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.upload-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.file-input-container {
  margin: 20px 0;
}

.file-label {
  padding: 10px 15px;
  background-color: #4CAF50;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  display: inline-block;
}

.file-input {
  display: none;
}

.file-name {
  margin-left: 10px;
  font-size: 14px;
}

.upload-button {
  padding: 10px 20px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.upload-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: red;
  margin-top: 10px;
}

.quality-note {
  margin-top: 30px;
  text-align: left;
  padding: 15px;
  background: #e8f4fd;
  border-radius: 4px;
  max-width: 500px;
  width: 100%;
}

.quality-note h3 {
  margin-bottom: 10px;
  font-size: 16px;
  color: #1976d2;
}

.quality-note ul {
  padding-left: 20px;
}

.quality-note li {
  margin-bottom: 5px;
}

</style> 