import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/views/Layout'
import Home from '@/views/Home'
import DownSampling from '@/views/Down-Sampling'


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
      }
    ]
  }
])

export default router