<template>
  <div class="upload-container">
    <div v-if="!isUploaded" class="upload-form">
      <h2>上传点云文件</h2>
      <div class="file-input-container">
        <label for="file-upload" class="file-label">
          选择 PLY 文件
        </label>
        <input id="file-upload" type="file" @change="onFileSelected" accept=".ply" class="file-input" />
        <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
      </div>
      <button @click="uploadFile" :disabled="!selectedFile || isUploading" class="upload-button">
        {{ isUploading ? '上传中...' : '上传' }}
      </button>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
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
      this.selectedFile = event.target.files[0];
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
</style> 