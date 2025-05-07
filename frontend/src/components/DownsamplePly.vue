<template>
  <div class="downsample-container">
    <h2>PLY point cloud down-sampling tool</h2>
    <div class="file-select-row">
      <input type="file" accept=".ply" @change="onFileSelected" id="downsample-file" style="display:none;" />
      <button @click="triggerFileInput">select file to down-sample</button>
      <span v-if="selectedFile" class="file-name">{{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})</span>
    </div>
    
    <div class="ratio-selection">
      <p>select the ratio of down-sampling:</p>
      <div class="ratio-options">
        <label>
          <input type="radio" v-model="keepRatio" value="0.1" />
          <span>keep 10%</span>
        </label>
        <label>
          <input type="radio" v-model="keepRatio" value="0.25" />
          <span>keep 25%</span>
        </label>
        <label>
          <input type="radio" v-model="keepRatio" value="0.5" />
          <span>keep 50%</span>
        </label>
        <label>
          <input type="radio" v-model="keepRatio" value="0.75" />
          <span>keep 75%</span>
        </label>
      </div>
    </div>
    
    <button @click="downsample" :disabled="!selectedFile || isProcessing" class="downsample-btn">down-sample</button>
    
    <div v-if="isProcessing" class="processing-container">
      <div class="processing-msg">down-sampling in progress, please wait...</div>
      <div v-if="uploadProgress < 100" class="progress-container">
        <div class="progress-label">upload progress: {{ uploadProgress }}%</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
      </div>
      <div v-else class="processing-note">file is being processed, large files may take several minutes...</div>
    </div>
    
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div v-if="downloadUrl" class="download-row">
      <a :href="downloadUrl" :download="`downsampled_${keepRatio}_${selectedFile?.name || 'file.ply'}`" class="download-btn">下载降采样后的PLY文件</a>
    </div>
    
    <div class="quality-note">
      <h3>down-sampling quality note</h3>
      <ul>
        <li><strong>keep 10%:</strong> significantly reduce file size, suitable for very large files(i.e. CUHK_UPPER_ds.ply), but will significantly reduce details</li>
        <li><strong>keep 25%:</strong> significantly reduce file size, but may reduce details</li>
        <li><strong>keep 50%:</strong> balance point cloud quality and file size, recommended choice</li>
        <li><strong>keep 75%:</strong> keep high quality, reduce file size by 25%</li>
      </ul>
      <div class="file-tips">
        <h3>note for large point cloud</h3>
        <p>for large point cloud (>400M points):</p>
        <ul>
          <li>upload and processing may take a long time (15mins for CUHK_UPPER_ds.ply with 3700M points), please be patient</li>
          <li>the lower the down-sampling ratio, the faster the processing speed</li>
          <li>recommended to use 10% of the retention ratio to process very large files</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DownsamplePly',
  data() {
    return {
      selectedFile: null,
      isProcessing: false,
      errorMessage: '',
      downloadUrl: '',
      keepRatio: '0.1', // 默认10%
      uploadProgress: 0
    }
  },
  methods: {
    triggerFileInput() {
      this.$el.querySelector('#downsample-file').click();
    },
    onFileSelected(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        this.errorMessage = '';
        this.downloadUrl = '';
        
        // 检查文件大小并给予提示
        if (file.size > 1024 * 1024 * 1024) { // 如果大于1GB
          this.keepRatio = '0.25'; // 对于大文件默认推荐使用25%保留率
        }
      }
    },
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    async downsample() {
      if (!this.selectedFile) return;
      this.isProcessing = true;
      this.errorMessage = '';
      this.downloadUrl = '';
      this.uploadProgress = 0;
      
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('keep_ratio', this.keepRatio);
      
      try {
        // 使用XMLHttpRequest来跟踪上传进度
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              this.uploadProgress = Math.round((event.loaded / event.total) * 100);
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              this.uploadProgress = 100;
              resolve(xhr.response);
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.error || '降采样失败'));
              } catch (e) {
                reject(new Error('降采样过程中出错'));
              }
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('网络错误，请稍后重试'));
          });
          
          xhr.addEventListener('abort', () => {
            reject(new Error('上传已取消'));
          });
          
          xhr.responseType = 'blob';
          xhr.open('POST', 'http://localhost:8085/api/downsample');
          xhr.send(formData);
        }).then((response) => {
          // 创建下载链接
          this.downloadUrl = URL.createObjectURL(response);
          
          // 自动触发下载
          setTimeout(() => {
            const downloadLink = this.$el.querySelector('.download-btn');
            if (downloadLink) {
              downloadLink.click();
            }
          }, 100);
        });
      } catch (e) {
        this.errorMessage = e.message || '降采样过程中发生错误';
      } finally {
        this.isProcessing = false;
      }
    }
  }
}
</script>

<style scoped>
.downsample-container {
  max-width: 600px;
  margin: 40px auto;
  padding: 30px 24px;
  background: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  text-align: center;
}
.file-select-row {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.ratio-selection {
  margin: 20px 0;
  text-align: center;
}
.ratio-selection p {
  margin-bottom: 10px;
  font-weight: bold;
}
.ratio-options {
  display: flex;
  justify-content: center;
  gap: 20px;
}
.ratio-options label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 8px 12px;
  background: #e0e0e0;
  border-radius: 4px;
  transition: background-color 0.2s;
}
.ratio-options label:hover {
  background: #d0d0d0;
}
.processing-container {
  margin-top: 20px;
}
.progress-container {
  margin-top: 10px;
  width: 100%;
}
.progress-label {
  margin-bottom: 5px;
  font-size: 14px;
  color: #2196f3;
}
.progress-bar {
  width: 100%;
  height: 10px;
  background: #e0e0e0;
  border-radius: 5px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #2196f3;
  transition: width 0.3s ease;
}
.processing-note {
  margin-top: 10px;
  font-size: 14px;
  color: #f57c00;
}
.downsample-btn {
  padding: 10px 24px;
  font-size: 16px;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
  transition: background 0.2s;
}
.downsample-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}
.processing-msg {
  color: #2196f3;
  margin-top: 12px;
}
.error-message {
  color: red;
  margin-top: 12px;
  padding: 10px;
  background: #ffecec;
  border-radius: 4px;
}
.download-row {
  margin-top: 18px;
}
.download-btn {
  display: inline-block;
  padding: 10px 16px;
  background: #4caf50;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background 0.2s;
}
.download-btn:hover {
  background: #3d8b40;
}
.file-name {
  font-size: 14px;
  color: #333;
}
.quality-note {
  margin-top: 30px;
  text-align: left;
  padding: 15px;
  background: #e8f4fd;
  border-radius: 4px;
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
.file-tips {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #c9e2f7;
}
.file-tips h3 {
  color: #f57c00;
}
</style> 