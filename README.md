## 本地静态资源缓存化 介绍
```
  该插件主要适用于纯静态资源的本地化，或者是通过webpack打包后赖加载的模式，理论上支持vue react;已在vue中进行了实验
  同样也可以直接在html中使用将项目中的loader.js内的代码直接放在script表标签内
```
```
  插件支持两种缓存模式 localStorage 和indexedDB;可进行配置,如果配置了indexedDB，在发现浏览器不支持的情况下回降级到localStorage
```
### 插件使用 html
```
如果已经是一些现有的项目比如项目中的链接地址都是已知的；可以将项目中loader.js中的代码直接复制到项目中，同时执行window._cache_local_.setBaseConfig({...options}), 注意参数的配置，同时注意版本号verison，一旦静态资源有变化必须更新版本号
示例：可以查看example.html
```
### 插件使用 vue
```
  插件本身依赖于webpack、html-webpack-plugin（index.html模板） 、min-css-extract-plugin(css提取),当然如果不单独提取css也没有关系, 示例查看example目录中的vue
```
```
const LocalCache = require('localcache');
config.plugin('LocalCache').use(LocalCache, [{
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].css',
      maxRetries: 3,
      type: 'localstorage',
      cacheIsOn: process.env.NODE_ENV === 'production',
      version: version,
      otherJs:''
      ...
    }])
```
### 插件配置使用说明
参数|类型|说明
--:|--:|--:|
filename|string|文件打包格式vue中默认为hash格式[name].[contenthash:8].
chunkFilename|同上
maxRetries|number|当不支持缓存的时候遇到js加载进行重试的次数
type|string| 支持localStorage、indexedDB，未进行配置的情况不走缓存逻辑
cacheSwitch|boolean| 是否开启缓存模式
version|number| 版本号，主要是用于清空历史缓存的静态资源信息
jsOmit|RegExp| 不需要处理的js
cssOmit|REgExp| 不需要处理的css
otherJs|OtherStaticContent|额外在html中追加的js外链或者是code
otherCss|OtherStaticContent|额外在html中追加的css外链或者是code
baseKey|string|localStorage模式下的缓存key前缀 默认为_cache_local_loader_
dbName|string|indexedDB模式下的库的名称默认为static
storeName|string|indexedDB模式下的库的表名 默认为test
storeKey|string|indexedDB模式下建表的主键key 默认为 path
cssExtraFn|Function|通过ajax请求将静态资源下载的code额外进行处理 再返回code,比如需要替换某个字符串等等，一般业务场景应该用不到
jsExtraFn|Function| 同上,

#### OtherStaticContent
属性|类型|说明
|--:|--:|--:|
innerHTML|string|需要插入的代码块
url|string| 需要插入的外链