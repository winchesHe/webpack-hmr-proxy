## HmrProxy

解决 `webpack-der-server vue-cli` 更换 `proxy` 时需要重启服务问题，**避免烦人的重新打包编译耗时**

![image](https://s27.aconvert.com/convert/p3r68-cdx67/z1ex8-q82c8-001.gif)


## 安装
```sh
npm i -D @winches/hmr-proxy
pnpm add -D @winches/hmr-proxy
yarn add -D @winches/hmr-proxy
```

## 用法
### 1. 创建一个proxy.config.c?js文件（非必须）
```javascript
// proxy.config.c?js
module.exports = {
  devServer: {
    proxy: {
      "/api": {
        ws: true,
        changeOrigin: true,
        target: "http://127.0.0.1:8888",
      },
    }
  }
};
```

> 若未创建，则默认寻址webpack -> vue 的配置文件

### 2. 使用热更新代理
`vue.config.c?js` or `webpack.config.c?js`

- 对于 `webpack-dev-server v3`

  ```javascript
  // ...
  const { useHmrProxy } = require("@winches/hmr-proxy");

  module.exports = {
    // ...
    devServer: {
      // ...
      after(app) {
        useHmrProxy(app);
      },
    },
  };
  ```

- 对于 `webpack-dev-server v4`

  ```javascript
  const { useHmrProxy } = require("@winches/hmr-proxy");

  module.exports = {
    devServer: {
      onAfterSetupMiddleware: function (devServer) {
        useHmrProxy(devServer.app);
      },
    },
  };
  ```

- 对于 `webpack-dev-server v4.7.0+`

  ```javascript
  const { useHmrProxy } = require("@winches/hmr-proxy");

  module.exports = {
    devServer: {
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined');
        }

        useHmrProxy(devServer.app)
        return middlewares
      }
    },
  };
  ```

### 自定义配置文件路径
```javascript
const filePath = path.resolve(__dirname, "proxy.config.js");

module.exports = {
  // ...
  devServer: {
    // ...(webpack-dev-server v3)
    after(app) {
      useProxy(app, { path: filePath });
    },
  },
};
```
