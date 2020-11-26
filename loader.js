window._cache_local_ = {
  // 判断是否支持indexedDB
  getDB: function () {
    return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB || undefined;
  },
  // 基础配置
  setBaseConfig: function (options) {
    // 缓存配置开关
    this.cacheSwitch = options.cacheSwitch || true
    // 缓存的基础key'
    this.baseKey = options.baseKey || '_cache_local_loader_';
    // 缓存版本号
    this.version = options.version || 1;
    this.storeKey = options.storeKey || 'path';
    this.storeName = options.storeName || 'test';
    this.dbName = options.dbName || 'static'
    // 是否已经全部移除过期版本
    this.hasRemoveAll = false;
    // 是否校验过版本号
    this.hasChekVersion = false;
    // js运行丢列
    this.jsRunSequence = [];
    // css运行队列
    this.cssRunSequence = [];
    // js加载失败时的运行队列
    this.jsNameMap = {};
    // css加载失败时的运行队列
    this.cssNameMap = {};
    var isSuuportDB = !!this.getDB()
    this.cssExtraFn = options.cssExtraFn;
    this.jsExtraFn = options.jsExtraFn
    var isSupportStorgae = !!window.localStorage
    if (isSuuportDB && options.type === 'indexedDB') {
      this.type = "indexedDB"
    } else if (isSupportStorgae && options.type === 'localStorage') {
      this.type = 'localStorage'
    } else {
      this.type = ''; // 额外增加处理 不支持
    }
  },
  //获取短链名
  getShortName: function (path) {
    return (path || '').split('/').pop();
  },
  // todo 校验版本
  checkVersion: function () {
    if (!this.hasChekVersion) {
      this.hasChekVersion = true;
    }
    if (this.type === 'localStorage') {
      var current = this.getStorage("_VERSION") || -1;
      if (+current !== +this.version) {
        this.removeAll()
      }
      this.setStorage('_VERSION', this.version)
    }
    if (this.type === 'indexedDB') {
      this.openDataBase()
    }
  },
  // 取search中的属性
  getItemFromSearch: function (name, str) {
    var r,
      reg
    reg = new RegExp('[?|&]' + name + '=(.*?)(&|#|$)', 'i')
    r = str ? ('?' + str).match(reg) : window.location.search.match(reg)
    return (r && decodeURIComponent(r[1])) || undefined
  },
  // 是否支持本地缓存
  isSupport: function () {
    var searchNoLocal = this.getItemFromSearch('nolocal'); // 增加链接search控制是否支持缓存
    if (!this.type || searchNoLocal) {
      this.removeAll()
    }
    return !searchNoLocal && !!this.type && this.cacheSwitch;
  },
  // 设置LocalStorage 缓存
  setStorage: function (key, val) {
    try {
      localStorage.setItem(this.baseKey + this.version + key, val)
    } catch (error) {
      console.error('写入缓存失败--', error)
    }
  },
  // 取LocalStorage 缓存
  getStorage: function (key) {
    return localStorage.getItem(this.baseKey + this.version + key)
  },
  // 移除缓存
  removeAll: function () {
    if (this.hasRemoveAll) return;
    if (this.type == 'localStorage') {
      for (var i in window.localStorage) {
        if (i && i.indexOf(this.baseKey) > -1) {
          localStorage.removeItem(i)
        }
      }
    }
    if (this.type == 'indexedDB') { // 这个地方不需要因为在indexedDB 打开的时候如果发现需要升级已经把之前的存储数据删除了

    }
    this.hasRemoveAll = true

  },
  // 创建ajax
  createRequest: function () {
    if (window.XMLHttpRequest) {
      return new window.XMLHttpRequest()
    } else if (window.ActiveXObject) {
      return new window.ActiveXObject('MsXml2.XmlHttp')
    }
  },
  // 发送ajax请求
  ajax: function (url, sortUrlName, success, fail) {
    try {
      var xhr = this.createRequest()
      xhr.open('get', url, true)
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
            if (xhr.responseText !== '') {
              success && success(sortUrlName, xhr.responseText)
              return
            }
          }
          fail && fail(url, sortUrlName)
        }
      }
      xhr.send(null)
    } catch (e) {
      fail && fail(url, sortUrlName)
    }
  },
  // ajax请求失败 创建标签
  ajaxFailBack: function (url, sortUrlName) {
    var isJs = /\.js/.test(url)
    if (this[isJs ? 'jsNameMap' : 'cssNameMap'][sortUrlName]) {
      return
    }
    this[isJs ? 'jsNameMap' : 'cssNameMap'][sortUrlName] = sortUrlName
    var runSequenceName = isJs ? 'jsRunSequence' : 'cssRunSequence'
    for (var i in this[runSequenceName]) {
      if (this[runSequenceName][i].sortUrlName === sortUrlName) {
        this[runSequenceName][i].code = ''
        this[runSequenceName][i].status = 'failed'
        this[runSequenceName][i].url = url
      }
    }
    this[isJs ? 'runjs' : 'runcss']()
  },
  // 真正发起请求的方法
  requestResource: function (url, sortUrlName, onload) {
    var isJS = /\.js/.test(url)
    this[isJS ? 'jsRunSequence' : 'cssRunSequence'].push({
      url: url,
      sortUrlName: sortUrlName,
      code: '',
      onload: onload
    })
    var that = this
    this.ajax(url, sortUrlName, function (sortUrlName, code) {
      that[isJS ? 'runjs' : 'runcss'](sortUrlName, code)
      that.setCache(sortUrlName, code)

    }, function (url, sortUrlName) {
      that.ajaxFailBack(url, sortUrlName)
    })
  },
  openDataBase: function () {
    var _this = this;
    return new Promise(function (resolve) {
      if (_this.dbservice) {
        return resolve(_this.dbservice)
      }
      var db = _this.getDB()
      if (db) {
        // 这个方法接受两个参数，第一个参数是字符串，表示数据库的名字。如果指定的数据库不存在，就会新建数据库。第二个参数是整数，表示数据库的版本。如果省略，打开已有数据库时，默认为当前版本；新建数据库时，默认为1
        // 数据库有版本的概念。同一个时刻，只能有一个版本的数据库存在。如果要修改数据库结构（新增或删除表、索引或者主键），只能通过升级数据库版本完成
        // 第一个参数为数据库的名称 第二个参数为数据库的版本号
        var dbservice = db.open(_this.dbName, _this.version);
        // 如果指定的版本号，大于数据库的实际版本号，就会发生数据库升级事件
        // 新建数据库与打开数据库是同一个操作。如果指定的数据库不存在，就会新建。不同之处在于，后续的操作主要在upgradeneeded事件的监听函数里面完成，因为这时版本从无到有，所以会触发这个事件。通常，新建数据库以后，第一件事是新建对象仓库（即新建表）
        // 是唯一可以修改数据库结构的地方 
        dbservice.addEventListener('upgradeneeded', function (event) {
          _this.dbservice = event.target.result;
          // 当由其他页签请求了版本变更时，确认添加了一个会被通知的事件处理程序。
          // _this.dbservice.onversionchange = function () {
          //   // dbresp.close()
          // }
          console.error('版本更新了')
          if (!_this.dbservice.objectStoreNames.contains(_this.storeName)) {
            // 可以理解为在创建对象仓库
            var store = _this.dbservice.createObjectStore(_this.storeName, { // 表格名称
              keyPath: _this.storeKey // 主键 
              // autoIncrement:true  是否自增
            });
            // 创建不带hash的路径索引，用于删除过期缓存 
            // 指定可以被索引的字段  unique 字段是否唯一
            store.createIndex('pathNoHash', 'pathNoHash', {
              // unique:false
            });
          }
          resolve(_this.dbservice)
        })
        dbservice.addEventListener('blocked', function () {
          console.error('这个时候我们需要关闭其他的标签了。。。')
        })
        dbservice.onsuccess = function (event) {
          // console.error('success---', event)
          _this.dbservice = event.target.result;
          resolve(_this.dbservice)
        }
        dbservice.onerror = function () {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    })

  },
  successTest: 0,
  getObjectStore: function (key, cb) {
    var _this = this;
    this.openDataBase().then(function (dbservice) {
      if (dbservice) {
        //创建一个事务，并要求具有读写权限
        var transaction = dbservice.transaction(_this.storeName, 'readwrite'); // readonly
        // 
        var objectStore = transaction.objectStore(_this.storeName);
        cb && cb(objectStore);
      } else {
        cb && cb()

      }
    })
  },

  // 设置缓存
  setCache: function (key, val) {
    var _this = this;
    if (this.type == 'localStorage') {
      this.setStorage(key, val)
    }
    if (this.type == 'indexedDB') {
      this.getObjectStore(key, function (objectStore) {
        if (objectStore) {
          var addContent = {
            content: val,
            pathNoHash: key,
          }
          addContent[_this.storeKey] = key
          var addRequest = objectStore.put(addContent) // 不存在则新增，存在则修改
          addRequest.onsuccess = function () {
            console.error('key---' + key + '添加成功')
          }
          addRequest.onerror = function (e) {
            _this.dbservice = null
            console.error('key___' + key + '写入失败')
          }

        }
      })
    }
  },
  // 获取缓存
  getCache: function (key, cb) {
    if (this.type == 'localStorage') {

      cb && cb(this.getStorage(key))
    }
    var _this = this;
    if (this.type == 'indexedDB') {
      this.getObjectStore(key, function (objectStore) {
        if (objectStore) {
          var getRequest = objectStore.get(key);
          getRequest.addEventListener('success', function (event) {
            var result = event && event.target && event.target.result || {};
            var cache = result.content;
            // console.error('key---', key + '获取成功')
            if (cache) {
              cb && cb(cache);
            } else {
              cb && cb();
            }
          });
          getRequest.addEventListener('error', function (event) {
            // console.error('key---', key + '获取失败')

            _this.dbservice = null
            cb && cb();
          });
        } else {
          console.error('无indexdb')
          cb && cb()
        }
      })
    }
  },
  // css执行队列
  runcss: function (sortUrlName, code) {
    if (sortUrlName && code) {
      for (var i in this.cssRunSequence) {
        if (this.cssRunSequence[i].sortUrlName === sortUrlName) {
          if (this.cssExtraFn && typeof this.cssExtraFn == 'function') {
            code = this.cssExtraFn(code)
          }
          this.cssRunSequence[i].code = code
        }
      }
    }
    if (this.cssRunSequence[0] && this.cssRunSequence[0].code && this.cssRunSequence[0].status !==
      'failed') {
      // 每次进入runcss检查cssRunSequence,如果第一项有代码并且状态没被置为failed,执行并剔除队列,回调

      var style0 = document.createElement('style')
      var head0 = document.getElementsByTagName('head')[0]
      style0.setAttribute('data-href', this.cssRunSequence[0].url)
      style0.id = this.cssRunSequence[0].sortUrlName
      style0.appendChild(document.createTextNode(this.cssRunSequence[0].code))
      head0.appendChild(style0)
      this.cssRunSequence[0].onload && this.cssRunSequence[0].onload()
      this.cssRunSequence.shift()

      // 如果cssRunSequence还有排队的 继续运行
      if (this.cssRunSequence.length > 0) {
        this.runcss()
      }
    } else if (this.cssRunSequence[0] && this.cssRunSequence[0].status === 'failed') {
      var that = this
      var link = document.createElement('link')
      link.type = 'text/css'
      link.crossorigin = 'anonymous'
      link.rel = 'stylesheet'
      link.id = this.cssRunSequence[0].sortUrlName
      link.href = this.cssRunSequence[0].url
      this.cssRunSequence[0].status = 'loading'
      this.cssRunSequence[0].onload && this.cssRunSequence[0].onload()
      link.onload = link.onerror = function () {
        that.cssRunSequence.shift()
        // 如果cssRunSequence还有排队的 继续运行
        if (that.cssRunSequence.length > 0) {
          that.runcss()
        }
      }
      document.head.appendChild(link)
    }
  },
  // js 执行队列
  runjs: function (sortUrlName, code) {
    if (sortUrlName && code) {
      for (var i in this.jsRunSequence) {
        if (this.jsRunSequence[i].sortUrlName === sortUrlName) {
          if (this.jsExtraFn && typeof this.jsExtraFn == 'function') {
            code = this.jsExtraFn(code)
          }
          this.jsRunSequence[i].code = code
        }
      }
    }
    if (this.jsRunSequence[0] && this.jsRunSequence[0].code && this.jsRunSequence[0].status !==
      'failed') {
      // 每次进入runjs检查jsRunSequence,如果第一项有代码并且状态没被置为failed,执行并剔除队列,回调
      var shortName = this.jsRunSequence[0].sortUrlName
      var dom = document.getElementById(shortName)
      if (dom) {
        dom.text = this.jsRunSequence[0].code
      } else {
        var script0 = document.createElement('script')
        script0.type = 'text/javascript'
        script0.text = this.jsRunSequence[0].code
        script0.id = shortName
        // var root0 = document.getElementsByTagName('body')[0]
        var oHead = document.getElementsByTagName('HEAD').item(0)

        oHead.appendChild(script0)
      }
      this.jsRunSequence[0].onload && this.jsRunSequence[0].onload()
      this.jsRunSequence.shift()

      // 如果jsSequence还有排队的 继续运行
      if (this.jsRunSequence.length > 0) {
        this.runjs()
      }
    } else if (this.jsRunSequence[0] && this.jsRunSequence[0].status === 'failed') {
      var that = this
      var sortUrlName1 = this.jsRunSequence[0].sortUrlName
      var script1 = document.getElementById(sortUrlName1)
      if (script1) {
        script1.src = this.jsRunSequence[0].url
      } else {
        script1 = document.createElement('script')
        script1.type = 'text/javascript'
        script1.crossorigin = 'anonymous'
        script1.src = this.jsRunSequence[0].url
        script1.id = sortUrlName1
      }
      this.jsRunSequence[0].status = 'loading'
      this.jsRunSequence[0].onload && this.jsRunSequence[0].onload()
      script1.onload = script1.onerror = function () {
        that.jsRunSequence.shift()
        // 如果jsSequence还有排队的 继续运行
        if (that.jsRunSequence.length > 0) {
          that.runjs()
        }
      }
      document.body.appendChild(script1)
    }
  },
  load: function (url, iswebpack, onload) {
    var sortUrlName = this.getShortName(url);
    var isJs = /\.js/.test(url);
    var _this = this;
    if (this.isSupport()) {
      this.checkVersion(url)
      var t = Date.now()
      this.getCache(sortUrlName, function (code) {

        if (code) {
          _this[isJs ? 'jsRunSequence' : 'cssRunSequence'].push({
            url: url,
            sortUrlName: sortUrlName,
            code: code,
            onload: onload,
            t: t
          })
          _this[isJs ? 'runjs' : 'runcss'](sortUrlName, code)
        } else {
          _this.requestResource(url, sortUrlName, onload)
        }
      })

    } else { //不支持的情况直接添加标签
      this[isJs ? 'jsRunSequence' : 'cssRunSequence'].push({
        url: url,
        sortUrlName: sortUrlName,
        code: '',
        onload: onload
      })
      this.ajaxFailBack(url, sortUrlName)
    }
  }
}