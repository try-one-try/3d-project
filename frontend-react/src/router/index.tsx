import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/views/Layout'
import Home from '@/views/Home'
import DownSampling from '@/views/Down-Sampling'
import FileAnalyzing from '@/views/File-Analyzing'


const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <Home />
      },
      {
        path: '/down-sampling',
        element: <DownSampling />
      },
      {
        path: '/file-analyzing',
        element: <FileAnalyzing />
      }
    ]
  }
])

export default router