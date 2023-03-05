import type { Application } from 'express'
import type { ProxyOptions } from './proxy'
import { HmrProxy } from './proxy'

export function useHmrProxy(app: Application, options?: ProxyOptions) {
  const hmrProxy = new HmrProxy(app, options)
  // 开启代理热更新
  hmrProxy.run()
}
