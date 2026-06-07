const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  publicPath: process.env.NODE_ENV === 'production' ? '/feature-walkthrough/' : '/',
  transpileDependencies: true,
  chainWebpack: config => {
    config.module
      .rule('jwt-source')
      .test(/\.jwt$/)
      .type('asset/source')
  }
})
