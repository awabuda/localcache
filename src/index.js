 const utils  = require("./utils/index");
const PluginOptions  = require("./interface");
const loader  = require("./utils/loader");
const PluginName = "StaticByLocal";
const MODULE_TYPE = 'css/mini-extract' // 该项主要是为了处理  经过webpack插件min-css-extact提取单独的css文件
const REGEXP_PLACEHOLDERS = /\[(name|id|chunkhash)\]/g
module.exports = class StaticByLocal {
  constructor(options){
    this.options = options ||  new PluginOptions()
    const {chunkFilename,filename} = this.options;
    if(!chunkFilename){
      if(filename.match(REGEXP_PLACEHOLDERS)){
        this.options.chunkFilename = filename
      }else {
        this.options.chunkFilename = filename.replace(/(^|\/)([^/]*(?:\?|$))/, '$1[id].$2')
      }
    }
  }
  //该插件的核心功能
  apply(compiler){
    compiler.hooks.compilation.tap(PluginName, compilation => {
      var {
        mainTemplate
      } = compilation
      if (mainTemplate.hooks.jsonpScript) {
        // Adapted from https://github.com/webpack/webpack/blob/11e94dd2d0a8d8baae75e715ff8a69f27a9e3014/lib/web/JsonpMainTemplatePlugin.js#L145-L210
        // 修改webpack的模块加载机制
        mainTemplate.hooks.jsonpScript.tap(PluginName, (source, chunk) => {
          const {
            crossOriginLoading,
            chunkLoadTimeout,
            jsonpScriptType
          } = mainTemplate.outputOptions

          const crossOriginScript = `
          if (script.src.indexOf(window.location.origin + '/') !== 0) {
            script.crossOrigin = ${JSON.stringify(crossOriginLoading)};
          }
        `

          const getCacheBustString = () =>
            this.options.cacheBust
              ? `
            (${this.options.cacheBust})();
          `
              : '"cache-bust=true"'

          const maxRetryValueFromOptions = Number(this.options.maxRetries)
          const maxRetries =
            Number.isInteger(maxRetryValueFromOptions) &&
            maxRetryValueFromOptions > 0
              ? maxRetryValueFromOptions
              : 1

          const scriptWithRetry = `
          // create error before stack unwound to get useful stacktrace later
          var error = new Error();
          function loadScript(src, retries) {
            
            var script = document.createElement('script');
            
            var retryAttempt = ${maxRetries} - retries + 1;
            var retryAttemptString = '&retry-attempt=' + retryAttempt;
            var onScriptComplete;
            ${
  jsonpScriptType
    ? `script.type = ${JSON.stringify(jsonpScriptType)};`
    : ''
}
            script.timeout = ${chunkLoadTimeout / 100};
            if (${mainTemplate.requireFn}.nc) {
              script.setAttribute("nonce", ${mainTemplate.requireFn}.nc);
            }
            if(window._cache_local_ && window._cache_local_.isSupport()){
              setTimeout(function(){
                window._cache_local_.load(src,true,function(){
                });
              },0)
              script.id =  window._cache_local_.getShortName(src)
              return script
            }
            script.src = src;
            ${crossOriginLoading ? crossOriginScript : ''}
            onScriptComplete = function (event) {
              // avoid mem leaks in IE.
              script.onerror = script.onload = null;
              clearTimeout(timeout);
              var chunk = installedChunks[chunkId];
              if (chunk !== 0) {
                if (chunk) {
                  if (retries === 0) {
                    var errorType = event && (event.type === 'load' ? 'missing' : event.type);
                    var realSrc = event && event.target && event.target.src;
                    error.message = 'Loading chunk ' + chunkId + ' failed after ${maxRetries} retries.\\n(' + errorType + ': ' + realSrc + ')';
                    error.name = 'ChunkLoadError';
                    error.type = errorType;
                    error.request = realSrc;
                    chunk[1](error);
                  } else {
                    var cacheBust = ${getCacheBustString()} + retryAttemptString;
                    var retryScript = loadScript(jsonpScriptSrc(chunkId) + '?' + cacheBust, (retries-1));
                    document.head.appendChild(retryScript);
                  }
                } else {
                }
              }
            };
            var timeout = setTimeout(function(){
              onScriptComplete({ type: 'timeout', target: script });
            }, ${chunkLoadTimeout});
            script.onerror = script.onload = onScriptComplete;
            return script;
          }
          var script = loadScript(jsonpScriptSrc(chunkId), ${maxRetries});
        `

          return scriptWithRetry
  
        })
      }
      mainTemplate.hooks.requireEnsure.tap(PluginName, (source, chunk, hash) => {
        const chunkMap = this.getCssChunkObject(chunk)
        if (Object.keys(chunkMap).length > 0) {
          const chunkMaps = chunk.getChunkMaps()
          const {
            crossOriginLoading
          } = mainTemplate.outputOptions

          const linkHrefPath = mainTemplate.getAssetPath(JSON.stringify(this.options.chunkFilename), {
            hash: `" + ${mainTemplate.renderCurrentHashCode(hash)} + "`,
            hashWithLength: length => `" + ${mainTemplate.renderCurrentHashCode(hash, length)} + "`,
            chunk: {
              id: '" + chunkId + "',
              hash: `" + ${JSON.stringify(chunkMaps.hash)}[chunkId] + "`,

              hashWithLength (length) {
                var shortChunkHashMap = Object.create(null)

                for (var chunkId of Object.keys(chunkMaps.hash)) {
                  if (typeof chunkMaps.hash[chunkId] === 'string') {
                    shortChunkHashMap[chunkId] = chunkMaps.hash[chunkId].substring(0, length)
                  }
                }

                return `" + ${JSON.stringify(shortChunkHashMap)}[chunkId] + "`
              },

              contentHash: {
                [MODULE_TYPE]: `" + ${JSON.stringify(chunkMaps.contentHash[MODULE_TYPE])}[chunkId] + "`
              },
              contentHashWithLength: {
                [MODULE_TYPE]: length => {
                  var shortContentHashMap = {}
                  var contentHash = chunkMaps.contentHash[MODULE_TYPE]

                  for (var chunkId of Object.keys(contentHash)) {
                    if (typeof contentHash[chunkId] === 'string') {
                      shortContentHashMap[chunkId] = contentHash[chunkId].substring(0, length)
                    }
                  }

                  return `" + ${JSON.stringify(shortContentHashMap)}[chunkId] + "`
                }
              },
              name: `" + (${JSON.stringify(chunkMaps.name)}[chunkId]||chunkId) + "`
            },
            contentHashType: MODULE_TYPE
          })
          return utils.asString([
            '',
            `// ${PluginName} CSS loading`,
            `var cssChunks = ${JSON.stringify(chunkMap)};`,
            'if(installedCssChunks[chunkId]) promises.push(installedCssChunks[chunkId]);',
            'else if(installedCssChunks[chunkId] !== 0 && cssChunks[chunkId]) {',
            utils.indent([
              'promises.push(installedCssChunks[chunkId] = new Promise(function(resolve, reject) {',
              utils.indent([
                `var href = ${linkHrefPath};`,
                `var fullhref = ${mainTemplate.requireFn}.p + href`,
                'var existingLinkTags = document.getElementsByTagName("link");',
                'for(var i = 0; i < existingLinkTags.length; i++) {',
                utils.indent([
                  'var tag = existingLinkTags[i];',
                  'var dataHref = tag.getAttribute("data-href") || tag.getAttribute("href");',
                  'if(tag.rel === "stylesheet" && (dataHref === href || dataHref === fullhref)) return resolve();'
                ]),
                '}',
                'var existingStyleTags = document.getElementsByTagName("style");',
                'for(var i = 0; i < existingStyleTags.length; i++) {',
                utils.indent([
                  'var tag = existingStyleTags[i];',
                  'var dataHref = tag.getAttribute("data-href");',
                  'if(dataHref === href || dataHref === fullhref) return resolve();'
                ]),
                '}',
                ` if(window._cache_local_ && window._cache_local_.isSupport()){
                    var shortName = window._cache_local_.getShortName(fullhref);
                    window._cache_local_.load(fullhref,true,function(){
                    });
                   return resolve()
                }`,
                'var linkTag = document.createElement("link");',
                'linkTag.rel = "stylesheet";',
                'linkTag.type = "text/css";',
                'linkTag.onload = resolve;',
                'linkTag.onerror = function(event) {',
                utils.indent([
                  'var request = event && event.target && event.target.src || fullhref;',
                  'var err = new Error("Loading CSS chunk " + chunkId + " failed.\\n(" + request + ")");',
                  'err.code = "CSS_CHUNK_LOAD_FAILED";',
                  'err.request = request;',
                  '// 删除 installedCssChunks[chunkId]',
                  'delete installedCssChunks[chunkId]',
                  'linkTag.parentNode.removeChild(linkTag)',
                  'reject(err);'
                ]),
                '};',
                'linkTag.href = fullhref;',
                crossOriginLoading
                  ? utils.asString([
                    `if (linkTag.href.indexOf(window.location.origin + '/') !== 0) {`,
                    utils.indent(
                      `linkTag.crossOrigin = ${JSON.stringify(
                        crossOriginLoading
                      )};`
                    ),
                    '}'
                  ])
                  : '',
                'var head = document.getElementsByTagName("head")[0];',
                'head.appendChild(linkTag);'
              ]),
              '}).then(function() {',
              utils.indent(['installedCssChunks[chunkId] = 0;']),
              '}));'
            ]),
            '}',
            '',
            '// JSONP chunk loading for javascript',
            '',
            'var installedChunkData = installedChunks[chunkId];',
            'if(installedChunkData !== 0) { // 0 means "already installed".',
            utils.indent([
              '',
              '// a Promise means "currently loading".',
              'if(installedChunkData) {',
              utils.indent(['promises.push(installedChunkData[2]);']),
              '} else {',
              utils.indent([
                '// setup Promise in chunk cache',
                'var promise = new Promise(function(resolve, reject) {',
                utils.indent([
                  'installedChunkData = installedChunks[chunkId] = [resolve, reject];'
                ]),
                '});',
                'promises.push(installedChunkData[2] = promise);',
                '',
                '// start chunk loading',
                mainTemplate.hooks.jsonpScript.call('', chunk, hash),
                'script && document.head.appendChild(script);'
              ]),
              '}'
            ]),
            '}'
          ])
        }
        return source
      })
    })
    const {cacheSwitch,otherCss,otherJs} = this.options
    // 如果设置了支持缓存或者是额外增加的jss 或css资源
    if(cacheSwitch || (otherCss && otherCss.length) || (otherJs && otherJs.length)){
      this.addStaticToHtml(compiler)
    }   
  }
  generateUtilScript(){
    const {baseKey="",version="",storeKey,storeName,dbName,cssExtraFn,jsExtraFn,cacheSwitch=false,type} = this.options
    let innerHTML = 'try{(' + loader + ')();'
    innerHTML += 'window._cache_local_.setBaseConfig('+JSON.stringify({
      type,
      baseKey,
      version,
      storeKey,
      storeName,
      dbName,
      cssExtraFn,
      jsExtraFn,
      cacheSwitch
    })+');}catch(e){console.error("_cahce_local_Plugin_error:",e)}'
    return utils.jsDefaultFormate({
      innerHTML:innerHTML
    })
  }
  createScriptCacheScript(){
    return function(url,type){
      try{
        window._cache_local_.load(url)
      }catch(e){
        var oHead = document.getElementsByTagName('HEAD').item(0);
        var tag = null
        if(type === 'js'){
          tag = document.createElement('script');
          tag.type = 'text/javascript';
          tag.src = url;
        }else {
          tag = document.createElement('link');
          tag.rel = 'stylesheet';
          tag.href = url
        }
        oHead.appendChild(tag);
      }
    }
  }
  // 添加缓存的脚本到html
  addStaticToHtml(compiler){
    let self = this

    // 找到compilation钩子，并注册HtmlWebpackCachePlugin插件
    compiler.hooks.compilation.tap(PluginName, compilation => {
      // 获取html-webpack-plugin暴露出的AlterAssetTags钩子
      // html-webpack-plugin v3版本和v4版本获取方式不同，需做兼容处理
      // V3版本语法
      let alterAssetTagsHook = compilation.hooks.htmlWebpackPluginAlterAssetTags
      if (!alterAssetTagsHook) {
        var [htmlWebpackPlugin] = compiler.options.plugins
          .filter(plugin => plugin.constructor.name === 'HtmlWebpackPlugin')
        if (!htmlWebpackPlugin) {
          console.error('Unable to find an instance of HtmlWebpackPlugin in the current compilation.')
        }
        // V4版本语法
        alterAssetTagsHook = htmlWebpackPlugin.constructor.getHooks(compilation).alterAssetTags
      }

      // 获取钩子失败，则退出
      if (!alterAssetTagsHook) {
        return
      }

      // 监听钩子，注册回调函数
      alterAssetTagsHook.tapAsync(PluginName,
        (data, cb) => {
          // 修改webpack产出
          // 依据options中的jsOmit和cssOmit选项，进行过滤
          let options = self.options
          let {
            cacheSwitch,
            jsOmit,
            cssOmit,
            otherCss,
            otherJs
          } = options
          let [cacheScripts, styles, cacheStyles] = [
            [],
            [],
            []
          ]
          // 获取asset资源，兼容html-webpack-plugin的v3和v4版本
          let assetScripts = data.body || data.assetTags.scripts
          let assetstyles = data.head || data.assetTags.styles
          // 添加外部需要引入的js 或css 静态资源
          if (otherJs && otherJs.length) {
            otherJs.map(item => {
              assetScripts.unshift(utils.jsDefaultFormate(item))
            })
          }
          if (otherCss && otherCss.length) {
            otherCss.map(item => {
              assetstyles.unshift(utils.cssDefaultFormate(item))
            })
          }
          const scriptIsRepeat = {}
          const stylesIsRepeat = {}
          if(cacheSwitch){
            assetScripts.map(script => {
              let scriptPath = script.attributes.src
              if (scriptPath && !(jsOmit && jsOmit.test(scriptPath)) && !scriptIsRepeat[scriptPath]) {
                scriptIsRepeat[scriptPath] = true
                let htmlContent = ''
                htmlContent += '(' + this.createScriptCacheScript().toString() + ')("' + scriptPath + '","js")'
                script.innerHTML = htmlContent
                script.attributes = {
                  type: 'text/javascript',
                  cache_id: scriptPath
                }
              }
  
              cacheScripts.push(script)
            })
            assetstyles.map(style => {
              // 创建style标签，用于无缓存情况下，请求css文件之后，嵌入样式
              let stylePath = style.attributes.href
              //排除 prefetch 与preload的情况
              let isPrefetchOrLoad = ['prefetch', 'preload'].includes(style.attributes.rel)
              if (/\.css$/.test(stylePath) && !(cssOmit && cssOmit.test(stylePath))) {
                if (isPrefetchOrLoad) {
                  styles.push(style)
                } else {
                  styles.push({
                    tagName: 'style',
                    closeTag: true,
                    attributes: {
                      type: 'text/css',
                      cache_id: stylePath
                    }
                  })
                }
              }
            })
            // 支持css缓存，则需要把link标签修改为script标签，然后为scirpt标签注入缓存代码
            // 需要进行去重处理
  
            assetstyles.map(style => {
              let stylePath = style.attributes.href
  
              let isPrefetchOrLoad = ['prefetch', 'preload'].includes(style.attributes.rel)
              if (/\.css$/.test(stylePath) && !stylesIsRepeat[stylePath] && !(cssOmit && cssOmit.test(stylePath)) && !isPrefetchOrLoad) {
                stylesIsRepeat[stylePath] = true
                let htmlContent = ''
                htmlContent += '(' + this.createScriptCacheScript().toString() + ')("' + stylePath + '","css")'
                cacheStyles.push({
                  tagName: 'script',
                  closeTag: true,
                  attributes: {
                    type: 'text/javascript'
                  },
                  innerHTML: htmlContent
                })
              }
            })
          }
          // 生成支持js缓存的script标签
          // 需要进行去重处理

           
          styles =  cacheSwitch? styles.concat(cacheStyles) : assetstyles
          cacheScripts = cacheSwitch ? cacheScripts : assetScripts
          // 添加 js代码到styles的头部，为了保证util的代码片段优先于其他片段执行
          var utilScript = this.generateUtilScript()
          cacheSwitch && styles.unshift(utilScript)
          data.body ? data.body = cacheScripts : data.assetTags.scripts = cacheScripts
          data.head ? data.head = styles : data.assetTags.styles = styles
          // Tell webpack to move on
          cb(null, data)
        }
      )
    })
  }
  // 获取经min-css-extact处理过的css的静态资源chunk
  getCssChunkObject(mainChunk){
    const obj = {}

    for (const chunk of mainChunk.getAllAsyncChunks()) {
      for (const module of chunk.modulesIterable) {
        if (module.type === MODULE_TYPE) {
          obj[chunk.id] = 1
          break
        }
      }
    }

    return obj
  }
}

