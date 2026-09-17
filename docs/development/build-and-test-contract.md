# 构建、制品与测试契约

本文定义代码生成和人工实现都必须遵守的工程契约。除非通过 ADR 修改，生成器不得自行改变工具链、输出路径或公开入口。

## 1. 工具链基线

| 项目 | 基线 |
| --- | --- |
| Node.js | `>=22` |
| 包管理器 | npm，提交根 `package-lock.json` |
| TypeScript | `5.9.3` |
| Vite | `^7.3.0` |
| Vue | `^3.5.26` |
| vue-tsc | `3.2.1` |
| Element Plus | `^2.13.0` |
| Vitest | `5.0.0` |
| Vue Test Utils | `2.4.6` |
| jsdom | `29.1.1` |
| Coverage Provider | `@vitest/coverage-v8@5.0.0` |

测试工具版本于 2026-09-09 从公开 npm Registry 核对。落地时根据 Node 22.20 的真实安装结果，将 jsdom 固定为 `29.1.1`、Vue Test Utils 固定为 `2.4.6`，以避开新版本传递依赖要求 Node 22.22.2 的问题。初始化时必须写入 lockfile；后续升级通过独立变更完成，不允许生成器静默改用其他主版本。

公共工具链沿用现有 App 的声明：Vite `^7.3.0`、`@vitejs/plugin-vue` `^6.0.3`、TypeScript `5.9.3`、vue-tsc `3.2.1`。Vitest 5 同时兼容 Vite 6、7、8，因此根 `overrides` 将其传递 Vite 限制为 `^7.3.0`，避免 npm 同时安装 Vite 7 和 8。`@types/node` 采用模板及当前 Node 22 对应的 `^22.19.0`；其他部分既有 App 中的 `^25.0.3` 差异应另行统一，不能带入本公共库。

## 2. TypeScript 基线

根目录提供 `tsconfig.base.json`，至少采用以下约束：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "useDefineForClassFields": true
  }
}
```

各包提供自己的 `tsconfig.json` 和 `tsconfig.build.json`。构建配置必须生成声明文件，并排除测试、Story、Playground 和构建配置文件。

发布包的 `tsconfig.build.json` 至少包含：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

公开 API 不新增 `any`。迁移源码中已有的开放结构应改为泛型、`unknown` 或明确的索引类型。

## 3. 标准制品布局

```text
packages/<name>/dist/
├─ index.js
├─ index.d.ts
├─ style.css             # 仅 ui
├─ styles.css            # 仅 theme
├─ tokens.css            # 仅 theme
├─ base.css              # 仅 theme
├─ element-plus.css      # 仅 theme
└─ themes/               # 仅 theme
   ├─ light.css
   └─ dark.css
```

`package.json#exports` 只能指向该布局中真实存在的文件。构建结束后必须运行制品检查，缺少任意公开入口时失败。

## 4. Theme 构建

`@g2rain/theme` 是 CSS-only 包，不提供裸 JavaScript 入口。源码包含：

```text
packages/theme/src/
├─ styles.css
├─ tokens.css
├─ base.css
├─ element-plus.css
└─ themes/
   ├─ light.css
   └─ dark.css
```

`styles.css` 是消费方默认入口：

```css
@import './tokens.css';
@import './themes/light.css';
@import './themes/dark.css';
@import './element-plus.css';
@import './base.css';
```

包构建脚本使用仓库内 TypeScript 脚本将 CSS 原样复制到 `dist`，保留相对目录，不做变量重命名或哈希。脚本只能清理当前包的 `dist`，不得删除 workspace 或其他包目录。

主题包导出固定为：

```json
{
  "exports": {
    "./styles.css": "./dist/styles.css",
    "./tokens.css": "./dist/tokens.css",
    "./base.css": "./dist/base.css",
    "./element-plus.css": "./dist/element-plus.css",
    "./light.css": "./dist/themes/light.css",
    "./dark.css": "./dist/themes/dark.css"
  },
  "sideEffects": ["**/*.css"]
}
```

## 5. UI 构建

`@g2rain/ui` 使用 Vite Library Mode：

- 入口：`src/index.ts`。
- 格式：仅 ESM。
- JavaScript：`dist/index.js`。
- 样式：`dist/style.css`。
- 类型：`dist/index.d.ts` 及其引用的声明文件。
- `cssCodeSplit`：关闭，确保得到稳定的单一 `style.css`。

Vite 配置的关键部分固定为：

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        '@element-plus/icons-vue',
        '@g2rain/theme',
      ],
    },
  },
})
```

以下依赖必须 external，不得打入 UI 包：

```text
vue
element-plus
@element-plus/icons-vue
@g2rain/theme
```

推荐脚本顺序：

```json
{
  "scripts": {
    "typecheck": "vue-tsc --noEmit -p tsconfig.json",
    "build:js": "vite build",
    "build:types": "vue-tsc --declaration --emitDeclarationOnly -p tsconfig.build.json",
    "build": "npm run typecheck && npm run build:js && npm run build:types",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

`build:types` 在 Vite 构建之后执行；它不得清空已有 `dist`。`tsconfig.build.json` 必须设置兼容的 `outDir`，且不启用会删除目录的额外脚本。

## 6. HTTP 与 Runtime 构建

`@g2rain/http` 和 `@g2rain/runtime` 同样使用 Vite Library Mode，输出 ESM `dist/index.js` 和声明文件。

依赖策略：

| 包 | 普通 dependencies | peerDependencies / external |
| --- | --- | --- |
| `http` | `axios`、`jose`、`js-sha256` 等由包直接使用的库 | 无宿主框架依赖 |
| `runtime` | `@g2rain/http` | `vue`、`element-plus`；未启用 UI 能力时允许通过子路径避免加载对应模块 |

普通 dependency 也保持 external，由 npm 安装解析，避免把第三方库重复内联到每个公共包制品。Runtime 必须使用明确子路径导出，使纯消息能力不会因为根入口而加载 Vue 或 Element Plus。

首批子路径至少预留：

```text
@g2rain/runtime/theme
@g2rain/runtime/micro-app
@g2rain/runtime/permission
@g2rain/runtime/loading
```

Runtime 使用多入口构建，入口名称与 `exports` 路径保持一致：

```ts
lib: {
  entry: {
    index: resolve(__dirname, 'src/index.ts'),
    'theme/index': resolve(__dirname, 'src/theme/index.ts'),
    'micro-app/index': resolve(__dirname, 'src/micro-app/index.ts'),
    'permission/index': resolve(__dirname, 'src/permission/index.ts'),
    'loading/index': resolve(__dirname, 'src/loading/index.ts'),
  },
  formats: ['es'],
}
```

构建验证必须确认 Rollup 没有重命名这些稳定入口。

## 7. 测试契约

统一使用 Vitest、Vue Test Utils 和 jsdom。测试分层：

- `theme`：校验全部 CSS 文件存在、`styles.css` 引入顺序正确、亮暗主题定义必需变量。
- `ui`：Props、Emits、Slots、Expose、异步竞态、卸载清理和主题变量使用。
- `http`：序列化、错误标准化、刷新单航班、一次重试、取消和认证失败传播。
- `runtime`：消息类型守卫、订阅释放、重复挂载、主题状态和 Loading 引用计数。
- `playground`：从公开入口消费，禁止从 `src` 或 `dist` 深度导入。

首个发布候选的语句覆盖率底线为 80%，分支覆盖率底线为 70%。认证刷新、消息释放和主题切换关键模块必须达到 100% 分支覆盖；覆盖率下降需要在变更说明中解释。

## 8. 根脚本与制品检查

根目录必须提供：

```json
{
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "pack:check": "tsx scripts/check-package-artifacts.ts"
  }
}
```

`pack:check` 至少检查：

1. 每个 `exports` 目标存在。
2. 声明文件可被 TypeScript 解析。
3. `npm pack --dry-run` 不包含源码外的密钥、缓存、测试输出或临时文件。
4. 包中不存在应用目录别名和跨包内部路径。
5. Theme 的默认入口同时包含 light 与 dark。
6. UI、Runtime 不重复打包 Vue 和 Element Plus。

## 9. 代码生成完成条件

代码生成不能只创建空目录。一次“工程骨架生成”完成必须满足：

- npm install 成功并生成根 lockfile。
- 四个包和 Playground 均能被 workspace 识别。
- 根 typecheck、test、build、pack:check 全部通过。
- 所有 `exports` 目标真实存在。
- Playground 仅通过公开入口完成生产构建。
