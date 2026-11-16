# Changelog

## 0.1.0 — 2026-11-16

首个可发布版本。

- 两种模式：`select`（只能选清单内的值）/ `create`（可新建选项）
- 值 / 标签分离；`name` → 自动生成隐藏 input，随表单提交 value
- 筛选：子串、忽略大小写，支持自定义 `filter`
- 键盘：↑ ↓ Home End Enter Tab Esc，自动跳过 `disabled`
- 中文输入法（composition）期间不筛选、不提交
- 浮层挂 body + fixed 定位：自动上下翻转、贴边收拢、滚动跟随（重新定位）、锚点不可见才收起
- 聚焦/点击展开列出全部候选（`showAllOnOpen`），敲字立即恢复筛选；回车选定后再点输入框可重新展开
- 无障碍：combobox / listbox / option 语义 + aria-activedescendant
- CSS 变量主题（亮/暗），`--sc-z` 可调层级
- 异步候选源（返回 Promise 的函数），过期响应自动丢弃
- `setOptions` 支持每行独立候选；`destroy()` 完整还原 DOM
- 单文件 UMD，无构建、无依赖；可直接从 jsDelivr 引入（`examples/cdn.html` 提供可复制的最小页面，含加载失败兜底）
- 测试：纯逻辑 11 项（`node --test`）+ 浏览器 DOM 30 项（`test/browser.html`）
