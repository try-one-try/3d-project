const { defineConfig } = require('@vue/cli-service')
const webpack = require('webpack')

module.exports = defineConfig({
  transpileDependencies: true,
  // 添加开发服务器配置，设置端口为8086
  devServer: {
    port: 8086
  },
  configureWebpack: {
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      fallback: {
        path: false,
        fs: false
      }
    },
    // 设置Vue的特性标志
    plugins: [
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: JSON.stringify(true),
        __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
      })
    ]
  }
})
