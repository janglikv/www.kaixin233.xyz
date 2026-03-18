# 项目 Agent 备注

## PixiJS v8 接入
- 必须先 `await app.init({...})` 再访问 renderer / canvas。
- 画布挂载用 `container.appendChild(app.canvas)`，不要用 `app.view`。
- 使用 `resizeTo` 时，`app.init()` 完成前不要调用 `app.destroy()`。用 `initialized` 标记保护清理流程。

## PixiJS v8 Graphics API
- `beginFill` / `endFill` 已弃用。
- `drawRect` 改名为 `rect`。
- 推荐链式：`graphics.rect(x, y, w, h).fill(color)`。

## 命令执行约定
- 不要每次修改后都运行 `build` 和 `lint`。
- 只有在改动范围较大、涉及多文件联动或用户明确要求时，才运行 `lint`。
- `build` 仅在确有必要验证打包结果时执行，非必要不要主动运行。
