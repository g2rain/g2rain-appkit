# @g2rain/theme

CSS-only 主题包，提供设计变量、亮暗配色、Element Plus 变量映射和基础样式，不依赖 Vue。

## 安装和加载

```bash
npm install @g2rain/theme
```

```ts
import 'element-plus/dist/index.css'
import '@g2rain/theme/styles.css'

document.documentElement.dataset.g2Theme = 'light'
```

`styles.css` 按顺序加载 tokens、light、dark、Element Plus 映射和 base。Element Plus 的原始组件样式由应用加载。

| 公开入口 | 内容 |
| --- | --- |
| `@g2rain/theme/styles.css` | 完整主题 |
| `@g2rain/theme/tokens.css` | 字体、间距、圆角、阴影和过渡变量 |
| `@g2rain/theme/light.css` | 亮色语义变量 |
| `@g2rain/theme/dark.css` | 暗色语义变量 |
| `@g2rain/theme/element-plus.css` | G2rain 到 Element Plus 的变量映射 |
| `@g2rain/theme/base.css` | 页面与公共容器基础样式 |

本包没有 JavaScript 根入口。按需加载时应自行组合所需 CSS，避免漏掉 tokens 或基础配色。

## 主题行为

亮色规则匹配 `:root` 与 `:root[data-g2-theme='light']`；暗色匹配 `:root[data-g2-theme='dark']`。Element Plus 映射匹配 `:root[data-g2-theme]`，所以应用应显式设置主题属性。

亮色主色为 `#409eff`。业务样式优先使用 `--g2-color-primary`、`--g2-text-primary`、`--g2-bg-page`、`--g2-bg-container`、`--g2-border-color` 等语义变量。完整变量以 [tokens](src/tokens.css)、[light](src/themes/light.css)、[dark](src/themes/dark.css) 和 [Element Plus 映射](src/element-plus.css) 为准。

需要订阅、持久化回调和资源释放时，使用 `@g2rain/platform/theme` 的 `createThemeController`。Controller 初始化优先使用根元素已有主题；本包自身不读取持久化配置，也不观察系统颜色偏好。

集成模式由主壳拥有主题。启用 qiankun 样式隔离时，需要主壳或应用适配实际容器的属性和 CSS 选择器；本包不操作 DOM 或同步容器属性。

## 参考

- [根使用手册](../../README.md)
- [主题协作说明](../../docs/architecture/theme-and-micro-app.md)
