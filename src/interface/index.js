
module.exports = class PluginOptions {
  constructor(){
    this.filename ="[name].css"; // 'css/[name].[contenthash:8].css' 打包hash文件的格式
    this.chunkFilename=""; // 同上
    this.maxRetries=0;// 当不支持利用缓存模式时增加js请求失败后重试情况
    this.cacheBust=null; // 主要是与maxRetries配合使用，当重试的时候在链接后面追加自定义参数 以防止被缓存
    this.type="" // 缓存的类型 localStorage 、indexedDB（如果不支持默认降级为localStorage）
    this.cacheSwitch=false; // 是否开启缓存的开关
    this.version=0; // 当前缓存的版本 利用版本来控制当前的缓存
    this.jsOmit=null; // 不需要处理的js文件
    this.cssOmit=null; // 不需要处理的css文件
    this.otherJs=null; // 如果有url则只添加url 无url 则添加 innerHTML
    this.otherCss=null // 如果有url则只添加url 无url 则添加 innerHTML
  }
  
}