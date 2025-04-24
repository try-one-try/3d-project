const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  // 开发服务器配置
  devServer: {
    // 配置代理
    proxy: {
      '/api': {
        // 目标后端服务器地址 - 本地8085端口
        target: 'http://localhost:8085',
        // 允许跨域
        changeOrigin: true
      }
    }
  }
})
