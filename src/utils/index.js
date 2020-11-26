
class CacheUtils {
  asString(str) {
    if (Array.isArray(str)) {
      return str.join('\n')
    }
    return str
  }
  indent(s) {
    if (Array.isArray(s)) {
      return s.map(this.indent).join('\n')
    } else {
      const str = s.trimRight()
      if (!str) return ''
      const ind = str[0] === '\n' ? '' : '\t'
      return ind + str.replace(/\n([^\n])/g, '\n\t$1')
    }
  }
  /**
   * @description 生成默认的js引用树
   * @param url 
   */
  jsDefaultFormate(staticContent) {
    const content = {
      tagName: 'script',
      closeTag: true,
      attributes: {
        type: 'text/javascript',
        crossorigin: 'anonymous'
      }
    }
    const {url, innerHTML} = staticContent ||  {}
    if(url){
      content.attributes.src = url
    }else if(innerHTML){
      content.innerHTML = innerHTML
    }
    return content

  }
  /**
   * @description 生成默认的css引用树
   * @param url 
   */
  cssDefaultFormate(staticContent) {
    const content = {
      tagName: 'link',
      selfClosingTag: false,
      voidTag: true,
      attributes: {
        rel: 'stylesheet',
        crossorigin: 'anonymous'
      }
    }
    const {url, innerHTML} = staticContent ||  {}

    if(url){
      content.attributes.href = url
    }else if(innerHTML){
      content.innerHTML = innerHTML ||''
    }
    return content
  }
}
module.exports =  new CacheUtils()