# Introduction

Project name: An Efficient Web Application for 3D Point Cloud Visualization and Down-Sampling

Project name: An Efficient Web Application for 3D Point Cloud Visualization and Down-Sampling

Name: CHANG, Ruihe

Email: rchangab@connect.ust.hk

This project is a 3D point cloud visualization web application. It aims to offer intuitive, efficient point cloud processing and interactive visualization. The system uses a front-end/back-end separation architecture. The front end is built with Vue.js, and the back end uses Flask. Together, they let users upload, render, interact with, and down-sample point clouds right in the browser.

## System Architecture

The system is built with a clear front-end/back-end split:

- **Front End:** Uses Vue.js and Three.js for a smooth user interface and high-performance 3D rendering.
- **Back End:** Uses Flask and Python libraries to handle point cloud data.
- **Communication:** The two sides talk via a RESTful API, forming a complete web solution for 3D point cloud visualization.

```python
frontend/
    ├── public/              # Static assets
    ├── src/                 # Source code
    │   ├── components/      # Vue components
    │   │   ├── DownsamplePly.vue      # Point cloud downsampling component
    │   │   ├── FileUpload.vue         # File upload component
    │   │   └── PointCloudViewer.vue   # 3D visualization component
    │   ├── App.vue          # Main application component
    │   └── main.js          # Application entry point
    ├── package.json         # Dependencies and scripts
    ├── vue.config.js        # Vue configuration
    └── babel.config.js      # Babel configuration
backend/
    ├── app.py               # Main Flask application and API endpoints
    ├── downsample.py        # Point cloud downsampling algorithm
    ├── requirements.txt     # Python dependencies
    └── uploads/             # Directory for uploaded point cloud files
```



**For more details, please see `Final Report`.**



# **Setup and Run**

## **System Requirements**

- Python 3.6 or higher
- Node.js 14 or higher
- Git

## **Installation and Setup**

Install the required Python packages:

```Bash
cd backend
pip install -r requirements.txt
```

Install the required npm packages:

```Bash
cd frontend
npm install
```

## **Running the Application**

Start the Backend Server on terminal

```Bash
cd backend
python app.py
```

Start the Frontend Application on another terminal

```Bash
cd frontend
npm run serve
```

By default, I set up 

backend server port to 8085: `http://localhost:8085/`

frontend application port to 8086: `http://localhost:8086/`

Finally, Navigate to `http://localhost:8086/` on web browser.