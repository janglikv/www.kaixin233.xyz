# 项目 Agent 备注

## PixiJS v8 接入
- 必须先 `await app.init({...})` 再访问 renderer / canvas。
- 画布挂载用 `container.appendChild(app.canvas)`，不要用 `app.view`。
- 使用 `resizeTo` 时，`app.init()` 完成前不要调用 `app.destroy()`。用 `initialized` 标记保护清理流程。

## PixiJS v8 Graphics API
- `beginFill` / `endFill` 已弃用。
- `drawRect` 改名为 `rect`。
- 推荐链式：`graphics.rect(x, y, w, h).fill(color)`。

## Planck.js 类型
- 这版 `planck-js` 的“函数式工厂”基本都已弃用，统一用 `new`。
- 例如：
- `new planck.Vec2(x, y)`
- `new planck.Box(w, h)`
- `new planck.Polygon(vertices)`
- `new planck.RevoluteJoint(def, bodyA, bodyB, anchor)`
- 规则：看到 `planck.Xxx(...)` 直接调用时，优先改成 `new planck.Xxx(...)`，可长期避免 TS 弃用提示。
