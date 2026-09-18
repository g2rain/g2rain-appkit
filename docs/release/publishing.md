# 发布流程

## 1. 版本策略

各包独立遵循语义化版本：

- Patch：向后兼容的缺陷修复。
- Minor：向后兼容的新能力。
- Major：不兼容变更。

在 `1.0.0` 前，业务应用建议使用 `~0.x.y`；稳定后可使用 `^1.x.y`。版本变更必须同步根目录 [`CHANGELOG.md`](../../CHANGELOG.md)。

## 2. 发布前检查

1. 类型检查。
2. 单元测试。
3. 生产构建。
4. `npm pack` / `npm run pack:check` 检查文件清单。
5. Playground 安装制品并构建。
6. 真实试点应用在独立模式和 qiankun 模式验证。
7. 确认版本号、`CHANGELOG.md`、迁移说明和[接入就绪清单](../development/integration-readiness.md)一致。
8. 确认根 `LICENSE` 与各包 `license` 字段一致（Apache-2.0）。

在 C 档条件未满足前，可对内使用 `npm pack` 试点，但不得宣称已完成正式 Registry 推广。

## 3. 发布

公开 Registry 固定为 `https://registry.npmjs.org/`，发布包在 `package.json` 声明：

```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

当前公共包尚未正式发布。首次发布前必须重新查询目标包名、使用实际发布账号执行 `npm whoami`，并确认该账号具有 `@g2rain` scope 权限；旧的 `@g2rain/runtime` 工作名称不得进入发布清单。

推荐发布顺序：

```bash
npm publish --workspace @g2rain/theme --access public
npm publish --workspace @g2rain/ui --access public
npm publish --workspace @g2rain/http --access public
npm publish --workspace @g2rain/platform --access public
```

`ui` 依赖 `theme` peer；若 `theme` 有新版本，应先发布并确认可从 Registry 获取后再发 `ui`。`http` 与 `platform` 的 Kernel 不形成硬依赖，可在 `theme` 之后并行发布。执行此命令前必须已完成 `packages/runtime` 到 `packages/platform` 的直接重命名；不得发布 `@g2rain/runtime`。

## 4. 不兼容变更

必须说明受影响的包与版本范围、变化的 API、迁移前后示例、兼容层移除时间和回滚方式，并更新相关 docs 与 ADR。

## 5. 回滚

npm 已发布版本不可覆盖。出现问题时：

1. 停止其他应用升级问题版本。
2. 在消费应用中回退 `package.json` 和 lockfile。
3. 兼容修复发布新的 Patch 版本。
4. 不复用旧版本号。
5. 记录根因并补充发布检查或自动化测试。
