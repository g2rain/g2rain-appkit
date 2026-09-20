# `@g2rain/theme`

G2rain 语义化设计变量、亮暗主题与 Element Plus 映射。CSS-only，不依赖 Vue。

## Install

```bash
npm install @g2rain/theme
```

在正式 Registry 版本可用前，使用仓库内 `npm pack` 产物安装。

## Usage

```ts
import '@g2rain/theme/styles.css'
```

按需入口：`./tokens.css`、`./base.css`、`./element-plus.css`、`./light.css`、`./dark.css`。

主题 DOM 切换使用 `@g2rain/platform/theme` 的 `createThemeController`，不在本包。

## Docs

- [包设计](../../docs/packages/README.md)
- [主题与微应用协作](../../docs/architecture/theme-and-micro-app.md)
- [Changelog](../../CHANGELOG.md)
