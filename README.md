# 3D点云查看器

这是一个简单的3D点云查看器，支持上传PLY格式的点云文件并在浏览器中渲染显示。

## 功能特点

- 支持拖放或选择文件上传
- 直接在浏览器中查看点云
- 支持鼠标交互旋转、缩放
- 自动渲染原始颜色（如果点云有颜色信息）

## 项目结构

- `frontend/`: Vue.js前端应用
- `backend/`: Flask后端API

## 安装和运行

### 后端

1. 进入后端目录：
   ```bash
   cd backend
   ```

2. 创建虚拟环境（可选但推荐）：
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

3. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```

4. 运行后端服务器：
   ```bash
   python app.py
   ```
   服务器将在 http://localhost:8085 上运行

### 前端

1. 进入前端目录：
   ```bash
   cd frontend
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 运行开发服务器：
   ```bash
   npm run serve
   ```
   前端将在 http://localhost:8080 上运行

## 使用方法

1. 打开浏览器访问 http://localhost:8080
2. 拖放或选择一个PLY格式的点云文件
3. 等待上传和处理完成
4. 使用鼠标交互查看点云：
   - 左键拖动：旋转
   - 右键拖动：平移
   - 滚轮：缩放

## 注意事项

- 只支持PLY格式的点云文件
- 对于大型点云文件（超过几百万点），加载可能需要较长时间
- 推荐使用现代浏览器（Chrome、Firefox、Edge等）以获得最佳性能
