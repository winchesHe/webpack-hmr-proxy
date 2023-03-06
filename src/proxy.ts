/* eslint-disable no-console */
import { resolve } from 'path'
import { existsSync } from 'fs'
import type { Application } from 'express'
import chokidar from 'chokidar'
import chalk from 'chalk'
import type { Options } from 'http-proxy-middleware'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { isMatch } from 'lodash'

const runDir = process.cwd()
function getFilePath() {
  function validPath(type: string) {
    const pathJs = resolve(runDir, `${type}.config.js`)
    const pathCjs = resolve(runDir, `${type}.config.cjs`)

    if (existsSync(pathJs))
      return pathJs

    if (existsSync(pathCjs))
      return pathCjs
  }

  // 优先自定义 proxy 规则，然后 webpack -> vue
  return validPath('proxy') ?? validPath('webpack') ?? validPath('vue') ?? ''
}
type ProxyConfig = Record<string, Options>
export interface ProxyOptions {
  path: string
  showProxy?: string
  middlewares?: any[]
}

export class HmrProxy {
  private app: Application
  private filePath: string
  private initialProxyConfig: ProxyConfig
  private middlewareStartIndex = 0
  private middlewareEndIndex = 0
  private middlewareLength = 0
  private watchFile = new Set<string>()
  private watcher: chokidar.FSWatcher
  private proxyOptions?: ProxyOptions

  constructor(app: Application, options?: ProxyOptions) {
    this.app = app
    this.filePath = options?.path ?? getFilePath()
    this.proxyOptions = options

    if (!this.filePath) {
      console.log(chalk.redBright(`The proxy file at \`${this.filePath}\` is not found.`))
      process.exit(1)
    }
    // 初始化配置文件
    this.initialProxyConfig = this.getProxyConfig()
    // 初始化监听文件
    this.watchFile = this.collectDeps()
    // 初始化监听器
    this.watcher = chokidar.watch(Array.from(this.watchFile.values()))
    // 避免回调函数丢失this
    this.watcherCallback = this.watcherCallback.bind(this)
  }

  // 收集文件依赖模块及其缓存
  collectDeps() {
    const deps: Set<string> = new Set<string>([this.filePath])
    // 运行文件制造缓存
    require(this.filePath)
    const cachePath = require.cache[require.resolve(this.filePath)]!
    deps.add(cachePath.id)
    return deps
  }

  run() {
    // 取消http中间件
    this.cleanHttpMiddleware()
    // 注册中间件
    this.registerRoutes()
    // 启用监听器监听配置文件, 当文件变更，添加，移除时除非回调，更新proxy
    try {
      this.watcher.on('change', this.watcherCallback)
        .on('add', this.watcherCallback)
        .on('unlink', this.watcherCallback)
    }
    catch (error) {
      console.log(chalk.redBright(error))
    }
  }

  createOptions(customOptions: Options): Options {
    const options: Options = {
      logLevel: 'silent',
    }
    return Object.assign({}, options, customOptions)
  }

  cleanHttpMiddleware() {
    if (this.proxyOptions?.middlewares) {
      this.proxyOptions.middlewares = this.proxyOptions.middlewares.filter(i => i.name !== 'http-proxy-middleware')
    }
    else {
      const firstIndex = this.app._router.stack.findIndex((i: any) => i.name === 'webpackDevMiddleware')
      const lastIndex = this.app._router.stack.findIndex((i: any, index: number) => i.name === 'webpackDevMiddleware' && index !== firstIndex)
      if (firstIndex !== -1 && lastIndex !== -1)
        this.app._router.stack.splice(firstIndex, lastIndex + 1)
    }
  }

  getProxyConfig(): ProxyConfig {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require(this.filePath)).devServer.proxy
  }

  registerRoutes() {
    // 获取proxy配置
    const localProxy: ProxyConfig = this.getProxyConfig()

    Object.entries(localProxy).forEach(([context, customOptions]) => {
      const options = this.createOptions(customOptions)
      // 添加用户代理配置
      this.app.use(createProxyMiddleware(context, options))
      // 记录注册中间件的末尾长度
      this.middlewareEndIndex = this.app._router.stack.length
    })
    // 记录注册中间件栈长度
    this.middlewareLength = Object.keys(localProxy).length
    // 记录注册中间件的起始长度
    this.middlewareStartIndex = this.middlewareEndIndex - this.middlewareLength
  }

  unRegisterRoutes() {
    // 移除已注册路由
    this.app._router.stack.splice(this.middlewareStartIndex, this.middlewareEndIndex)
    // 清理缓存
    this.cleanDeps()
  }

  cleanDeps() {
    this.watchFile.forEach((watchFile) => {
      delete require.cache[require.resolve(watchFile)]
    })
  }

  recollectDeps() {
    // 重新收集依赖
    const newDeps = this.collectDeps()
    // 删除旧的依赖模块
    Array.from(this.watchFile.values()).forEach((id) => {
      if (!newDeps.has(id))
        this.watchFile.delete(id)
    })
    // 添加新的缓存模块
    Array.from(newDeps.values()).forEach((id) => {
      if (!this.watchFile.has(id))
        this.watcher.add(id)
    })
  }

  watcherCallback(path: string) {
    // 先清理缓存再require
    this.cleanDeps()
    const newProxyConfig = this.getProxyConfig()
    const logProxy = this.proxyOptions?.showProxy ? { proxy: newProxyConfig } : ''
    // 当新旧代理配置不一样时重新更新
    if (!isMatch(this.initialProxyConfig, newProxyConfig)) {
      // 删除旧的代理配置
      this.unRegisterRoutes()
      // 重新收集依赖模块
      this.recollectDeps()
      // 重新注册新的代理配置
      this.registerRoutes()
      console.log()
      typeof logProxy === 'object'
        ? console.log(chalk.magentaBright('> Proxy Server hot reload success!'), logProxy)
        : console.log(chalk.magentaBright('> Proxy Server hot reload success!'))
      console.log(chalk.magentaBright(`> loaded path: ${path}`))
    }
  }
}
