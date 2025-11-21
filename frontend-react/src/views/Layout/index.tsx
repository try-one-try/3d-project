import React from 'react'
import { UploadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { Layout, Menu, theme } from 'antd'
import './index.less'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Header, Content, Footer, Sider } = Layout

const items = [
  {
    key: '/',
    icon: <UserOutlined />,
    label: 'Home'
  },
  {
    key: '/down-sampling',
    icon: <UserOutlined />,
    label: 'Down-Sampling'
  },
  {
    key: '/file-analyzing',
    icon: <UserOutlined />,
    label: 'File Analyzing'
  }
]

const App: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken()

  const navigate = useNavigate()
  const location = useLocation()
  const handleMenuClick = (e: any) => {
    console.log(e.key)
    navigate(e.key) // 返回一个函数
  }

  return (
    <Layout className='layout-container'>
      <Sider collapsible={true}>
        <div className='demo-logo-vertical' />
        <Menu
          theme='dark'
          mode='inline'
          selectedKeys={[location.pathname]}
          items={items}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <h1 style={{ margin: 0, color: '#333', textAlign: 'center' }}>
            3D-Point Cloud Processing System
          </h1>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              minHeight: '100%',
              background: colorBgContainer,
              borderRadius: borderRadiusLG
            }}
          >
            <Outlet />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>CHANG, Ruihe 21109304</Footer>
      </Layout>
    </Layout >
  )
}

export default App
