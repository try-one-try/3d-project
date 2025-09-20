import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/views/Layout'
import Home from '@/views/Home'
import DownSampling from '@/views/Down-Sampling'
import AI_Chatting from '@/views/AI-Chatting'

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
        path: '/ai-chatting',
        element: <AI_Chatting />
      }
    ]
  }
])

export default router