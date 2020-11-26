const StaticByLocal= require('../src/index')

module.exports = {
  chainWebpack:config=>{
    config.plugin('StaticByLocal').use(StaticByLocal, [{
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].css',
      maxRetries: 3,
      // type: 'localStorage',
      type: 'indexedDB',
      cacheSwitch: true,
      version: 3
    }])
  }
}