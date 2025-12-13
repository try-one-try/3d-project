# Introduction

Project name: An Efficient Web Application for 3D Point Cloud -- Ultimate Version

Github: https://github.com/try-one-try/3d-project#

Name: CHANG, Ruihe

Email: rchangab@connect.ust.hk

This project represents a **completely rebuild version** of my MSBD5014A project. In addition to implementing **lots of new features**, this version completely **refactors all** the frontend codebase, by utilizing **numerous** **new technologies and optimization strategies**. This architectural shift not only enforces the system architecture with high cohesion and low coupling, but also significantly boosts performance, with faster rendering speeds and lower resource consumption when processing complex 3D point clouds.

## System Architecture and Upgrades

The project utilizes a decoupled front-end/back-end architecture, following the RESTful API specification, and implements the following key technical upgrades to enhance performance and code quality:

- **Frontend Framework Migration (Vue → React):** Leveraged React's rich community resources and declarative UI logic to improve development efficiency in complex interaction scenarios, enhancing component flexibility and cross-platform potential.
- **Language Upgrade (JavaScript → TypeScript):** Introduced a strong typing system that improves code self-documentation and effectively reduces runtime errors through strict type checking, significantly boosting the maintainability of large-scale projects.
- **Build Tool (Vite):** Adopted Vite for modern build processes, utilizing its ES Modules-based on-demand compilation to achieve instant startup and Hot Module Replacement (HMR), drastically reducing build wait times.
- **Code Standardization (Prettier + ESLint):** Established a standardized mechanism for code style and quality inspection, automating formatting issues to ensure high readability and consistency in team collaboration.

```Python
# This project is front-end/back-end separation architecture, following RESTful API specification
frontend-react/
    ├── public/                  # Static assets
    ├── src/                     # Source code
    │   ├── apis/                # API definition
    │   │   └── pointCloud.ts    # Point cloud related API calls
    │   ├── components/          # Reusable components
    │   │   └── PointCloudViewer.tsx # 3D point cloud visualization component
    │   ├── store/               # State management (Redux)
    │   │   └── pointCloudSlice.ts # Point cloud data slice
    │   ├── views/               # Page components
    │   │   ├── Down-Sampling/   # Downsampling page
    │   │   │   └── index.tsx
    │   │   ├── File-Analyzing/  # File analysis page(Upload + LLM Analysis)
    │   │   │   └── index.tsx
    │   │   ├── Home/            # Home page
    │   │   │   └── index.tsx
    │   │   └── Layout/          # Global layout
    │   │       └── index.tsx
    │   ├── App.tsx              # Main application component
    │   ├── main.tsx             # Application entry point
    │   └── request.ts           # Axios configuration 
    ├── .prettierrc.cjs          # code formatter Prettier configuration
    ├── eslint.config.js         # code inspection tool ESLint configuration configuration
    ├── package.json             # Dependencies and scripts 
    └── vite.config.ts           # Vite configuration 

backend/
    ├── app.py                   # Main Flask application and API endpoints 
    ├── check_colors.py          # PLY file property inspector
    ├── downsample.py            # Point cloud downsampling algorithm 
    ├── requirements.txt         # Python dependencies 
    └── uploads/                 # Directory for uploaded files
```

**For more details, please see `Final Report`.**



# **Setup and Run**

## **System Requirements**

- Python 3.8 or higher
- Node.js 18 or higher
- Git

## **Installation and Setup**

1. **Install Backend Dependencies**

   Navigate to the `backend` directory and install the required Python packages:

   ```Bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Install Frontend Dependencies**

   Navigate to the `frontend-react` directory and install the required npm packages:

   ```Bash
   cd frontend-react
   npm install
   ```

## **Running the Application**

1. **Start the Backend Server**

   Open a terminal window and run:

   ```Bash
   cd backend
   python app.py
   ```

   The backend server will start at `http://localhost:8085`.

2. **Start the Frontend Application**

   Open another terminal window and run:

   ```Bash
   cd frontend-react
   npm run dev
   ```

   The frontend application will start (usually at `http://localhost:5173`).
   Navigate to the URL shown in the terminal (e.g., `http://localhost:5173/`) to use the application.