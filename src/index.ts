import type { Application } from 'express'
import { HmrProxy } from './proxy'

export function useHmrProxy(app: Application, options?: { path: string }) {
  const hmrProxy = new HmrProxy(app, options)
  // 开启代理热更新
  hmrProxy.run()
}
