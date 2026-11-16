# SmartCombo

**一个输入框 + 一个下拉。零依赖、无构建。** 两种模式：

| 模式 | 用途 | 行为 |
| --- | --- | --- |
| `select` | 从清单里选 | 敲字即筛选；只能提交清单里的值，敲了清单外的内容在失焦时退回上一个有效值 |
| `create` | 选，或者新建 | 清单里没有的内容会多出一行「＋ 新建 “xxx”」，回车即成为新选项并留在清单里 |

```js
new SmartCombo("#city", { options: cities });                        // 只能选清单里的
new SmartCombo("#tag",  { options: tags, mode: "create" });          // 能选，也能新建
```

---

## 常见场景

| 场景 | 模式 | 关键点 |
| --- | --- | --- |
| 国家/地区、省市、城市 | `select` | 提交代码、显示名称（`value` / `label` 分离） |
| 部门、负责人、审批人 | `select` | 主字段一变就用 `setOptions()` 换掉从属字段的候选 |
| 客户、商品、成员（几千条以上） | `select` + 异步 `options` | 边敲边查，不必一次把全量灌进页面 |
| 标签、分类、自定义项 | `create` | 允许现场新建，新建项留在候选里 |
| 枚举字段（状态、优先级、计量单位） | `select` | 比原生 `<select>` 好找，也允许清空 |
| 筛选器、明细表的每一行 | `select` + `setOptions()` | 每行一个实例，候选按行下发 |

---

## 为什么不用现成的

| 方案 | 不够用的地方 |
| --- | --- |
| `<input list>` + `<datalist>` | 下拉样式完全由浏览器决定，无法自定义行高/字号/高亮；无法拦截"敲了清单外的东西"；不能加"新建"这一行；移动端表现不一致 |
| `<select>` | 不能输入；选项几百条时无法筛选 |
| awesomplete / Choices.js 等 | 要么只管补全不管提交语义（不区分"选中的值"与"看见的标签"），要么依赖一大堆 |
| Element Plus / AntD | 需要整套组件库 + 框架 + 构建 |

SmartCombo 只做一件事，把它的**边界情况**做干净：值/标签分离、失焦落值、中文输入法、浮层被祖先容器裁掉、滚动后脱离锚点、键盘与无障碍。

---

## 特性

- **值 / 标签分离**：`<option>` 的 `value` 是提交用的值，`label` 是输入框里显示的文字
- **可筛选**：子串匹配、忽略大小写，也可完全自定义 `filter`
- **可新建**：`mode: "create"`，新建的项默认并入候选（`keepCreated`）
- **键盘完整**：`↑ ↓ Home End Enter Tab Esc`，自动跳过 `disabled` 项
- **中文输入法安全**：合成（拼音）期间不筛选、不提交，选字结束才刷新
- **浮层永不被裁**：挂在 `body` 上、`position: fixed`、自动上下翻转、贴边收拢
- **滚动跟随**：页面/容器滚动时浮层跟着输入框重新定位，锚点不可见才收起
- **无障碍**：`role=combobox` + `aria-expanded / aria-activedescendant / aria-selected`，`listbox` 与 `option` 语义齐备
- **表单友好**：给 `name` 就自动带一个隐藏 `input`，提交的是 `value` 而不是标签
- **可清空 / 可禁用 / 只读 / 异步候选 / 每行独立候选**
- **CSS 变量主题**：亮/暗两套默认，改几个变量就能贴合你的设计系统
- 单文件 UMD：`<script>` 直接可用，也能被 Vite / webpack / Node 直接 `require`

---

## 安装

三种引法，按你的场景挑一种。

### 一、CDN（不装任何东西，两条标签）

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/smart-combo@0.1.0/smart-combo.css">
<script src="https://cdn.jsdelivr.net/npm/smart-combo@0.1.0/smart-combo.js"></script>

<script>
  new SmartCombo("#city", { options: ["北京", "上海", "深圳"] });
</script>
```

脚本挂在全局 `SmartCombo` 上，**不需要** `type="module"`，也不用起构建。

版本号怎么写：

| 写法 | 行为 | 用在哪 |
| --- | --- | --- |
| `@0.1.0` | 精确锁死，内容永不变 | **生产环境**，推荐 |
| `@0.1` | 锁小版本，自动收补丁 | 想要 bugfix 又不想被新功能影响 |
| `@latest` | 永远最新 | 试玩、文档站；生产别用，随时可能变更 |

**还没发 npm 时**（或发布前的自测），同一份文件可以直接从 GitHub 取 —— 仓库推上去就能用：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/longavailable/smart-combo@v0.1.0/smart-combo.css">
<script src="https://cdn.jsdelivr.net/gh/longavailable/smart-combo@v0.1.0/smart-combo.js"></script>
```

`@main` 也可以，但 jsDelivr 会缓存并延迟刷新（急的时候刷 `?v=2` 绕过），**生产请用 tag**。

需要 SRI 时加 `integrity` + `crossorigin="anonymous"`；哈希可以在 `https://cdn.jsdelivr.net/npm/smart-combo@0.1.0/` 的目录页上拿到。

> 国内网络访问 jsDelivr 有时不稳。它只影响「引不进文件」这一刻，不影响库本身；备选：`https://unpkg.com/smart-combo@0.1.0/smart-combo.js`，或者干脆走下面的本地文件。
>
> 完整可运行的最小页面见 [`examples/cdn.html`](examples/cdn.html) —— 里面还带了一段"CDN 没加载成功"的兜底提示，拷走就能改。

### 二、本地文件（离线 / 内网）

```html
<link rel="stylesheet" href="vendor/smart-combo.css">
<script src="vendor/smart-combo.js"></script>
```

把 `smart-combo.js` + `smart-combo.css` 两个文件拷进项目即可（32 KB + 6 KB，合计约 11 KB gzip）。

### 三、npm / bundler

```bash
npm i smart-combo
```

```js
import SmartCombo from "smart-combo";
import "smart-combo.css";
```

---

## 快速开始

```html
<input id="city" placeholder="选择城市">
```

```js
const combo = new SmartCombo("#city", {
  options: [                                     // 或 ["北京", "上海", "深圳"]
    { value: "310000", label: "上海" },
    { value: "440300", label: "深圳" }
  ],
  mode: "select",
  placeholder: "选择城市",
  onChange(value, item) {
    console.log("提交的值：", value, "整条候选：", item);   // "310000"
  }
});
```

新建模式：

```js
new SmartCombo("#tag", {
  options: ["前端", "后端", "设计", "测试"],
  mode: "create",
  name: "tag",                                 // 表单提交 value
  createLabel: "＋ 新建标签 “{value}”",         // 字符串模板或函数
  onCreate(text, item) { console.log("新建了", text); }
});
```

---

## 选项

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `options` | `[]` | 候选：字符串数组、`{value,label,disabled}` 数组，或 `(query, instance) => 数组 / Promise` |
| `mode` | `"select"` | `"select"` 只能选；`"create"` 可新建 |
| `value` | `null` | 初始值（按 `value` 匹配候选，命中后显示它的 `label`） |
| `name` | `null` | 给定后自动生成隐藏 `input`，随表单提交 `value` |
| `placeholder` | `null` | 输入框占位符 |
| `maxRender` | `100` | 最多渲染多少行；超出时给「还有 N 项」提示，继续输入可缩小范围 |
| `caseSensitive` | `false` | 匹配是否区分大小写 |
| `filter` | `null` | `(item, query, raw) => boolean`，完全接管筛选 |
| `allowFree` | `false` | `select` 模式下也接受清单外的自由文本（值即文本） |
| `keepCreated` | `true` | 新建的项并入候选清单 |
| `createLabel` | `"＋ 新建 “{value}”"` | 新建行文案，支持 `{value}` 模板或函数 |
| `clearable` | `false` | 显示 ✕ 清空按钮 |
| `disabled` / `readonly` | `false` | 禁用 / 只读（都不展开） |
| `openOnFocus` | `true` | 聚焦即展开 |
| `showAllOnOpen` | `true` | 聚焦/点击展开时列出全部候选（而不是被框里的值筛成一行）；一旦敲字立刻恢复筛选 |
| `messages` | `{empty:"没有匹配项", loading:"加载中…"}` | 文案 |
| `onChange` | — | `(value, item, instance)` 值变化 |
| `onSelect` | — | `(value, item, instance)` 选中已有候选 |
| `onCreate` | — | `(value, item, instance)` 新建了选项 |
| `onInvalid` | — | `(text, instance)` `select` 模式下没匹配上 |
| `onOpen` / `onClose` | — | 展开 / 收起 |

## 方法

| 方法 | 说明 |
| --- | --- |
| `getValue()` / `getLabel()` / `getItem()` | 取值 / 取显示文字 / 取整条候选 |
| `getOptions()` | 取当前候选（归一化后的 `{value,label,disabled}` 数组，含新建项） |
| `getInput()` / `getPopup()` | 底层元素（自定义定位或挂额外 UI 时才需要） |
| `setValue(v, { fire, keepInput })` | 程序化赋值（默认不触发 `onChange`，`fire: true` 可触发） |
| `setOptions(list, { silent })` | 整体替换候选（每行独立候选就用它） |
| `open(showAll?)` / `close()` / `toggle()` | 展开（`showAll` 忽略已输入的内容）/ 收起 |
| `enable()` / `disable()` / `setReadonly(bool)` | 状态 |
| `focus()` | 聚焦 |
| `destroy()` | 拆干净：还原 DOM、移除浮层、解绑所有监听 |

静态方法：`SmartCombo.get(el)`、`SmartCombo.closeAll()`、`SmartCombo.autoInit(root, defaults)`（扫 `[data-smart-combo]` 自动初始化）、`SmartCombo.utils`（纯函数，便于单测）。

---

## 每行独立候选

表格里每一行一套候选（「部门 → 审批人」这类联动字段就是这么用的）：

```js
const combo = new SmartCombo(cellInput, { options: depts[i].people });

deptSelect.addEventListener("change", () => {
  idx = Number(deptSelect.value);
  combo.setValue("", { fire: true });       // 旧审批人不属于新部门
  combo.setOptions(depts[idx].people);      // 候选整体换掉
});
```

## 异步候选源

```js
new SmartCombo("#member", {
  options: (query) =>
    fetch(`/api/members?q=${encodeURIComponent(query)}`).then(r => r.json())
});
```

打开时带当前关键字请求，期间显示「加载中…」，结果覆盖候选；过期的响应会被丢弃（只认最后一次请求）。

---

## 样式与主题

所有颜色/圆角/行高都是 CSS 变量，覆盖在 `:root`、某个容器或单个实例上：

```css
.my-form {
  --sc-primary: #0f766e;
  --sc-radius: 8px;
  --sc-row-h: 34px;
}
```

| 变量 | 默认（亮色） |
| --- | --- |
| `--sc-fg` / `--sc-fg-muted` | `#1f2733` / `#6b7686` |
| `--sc-bg` / `--sc-pop-bg` | `#fff` / `#fff` |
| `--sc-border` / `--sc-pop-border` | `#d6dae1` / `#dfe3ea` |
| `--sc-primary` / `--sc-primary-soft` | `#2563eb` / `#e8f1fb` |
| `--sc-radius` / `--sc-row-h` | `6px` / `30px` |
| `--sc-z` | `2147483000` |

深色：给 `<html>` 或 `<body>` 加 `data-theme="dark"`（或任意祖先加 `.sc-dark`）。
浮层挂在 `body` 上，所以**主题属性要放在 `html`/`body` 这一层**；只想改浮层就单独给 `.sc-pop` 设变量。

---

## 键盘与无障碍

| 键 | 行为 |
| --- | --- |
| `↓` / `↑` | 展开；上下移动高亮（跳过禁用项） |
| `Home` / `End` | 首项 / 末项 |
| `Enter` | 选中高亮项；`create` 模式下等价于「确认新建」 |
| `Tab` | 提交当前值并正常离开（不会被吞掉） |
| `Esc` | 收起并还原成上一个有效值 |

`role="combobox"` + `aria-expanded` / `aria-activedescendant` / `aria-controls`，候选用 `role="listbox"` + `role="option"`，选中项带 `aria-selected`，禁用项带 `aria-disabled`。

---

## 浏览器支持

Chrome / Edge / Firefox / Safari 最近两个大版本，以及对应移动端。用到 `PointerEvent`、`color-mix()`（无该函数时仅影响聚焦光圈与图标的淡色，不影响布局）。

---

## 开发与测试

无构建、无依赖：

```bash
npm test          # 纯逻辑单测（node --test，11 项）
```

DOM 行为（30 项：键盘、新建、IME、滚动跟随、销毁还原……）直接用浏览器打开
[`test/browser.html`](test/browser.html)，页面顶部会显示 `PASS / FAIL` 与逐条明细。

改动 `smart-combo.css` 后刷新 [`index.html`](index.html) 看效果（浅色/深色可切换）。

---

## 几个已经踩过的坑（写在这里，免得你重踩）

1. **浮层必须挂在 `body` 上。** 放在表格或面板里会被 `overflow: hidden` 裁掉；`z-index` 也只在同一个层叠上下文里比较，面板的 `z-index: 150` 会把它盖住。
2. **别指望 `blur` 落值。** 点到一个 `pointerdown` 里 `preventDefault()` 的元素、或者点到不可聚焦的区域时，`blur` 不一定来 —— 所以"点别处"要显式落值。
3. **滚动不要一律收起浮层。** 聚焦视口底部的输入框会让浏览器滚动它进入视口，这个排队中的 `scroll` 事件会把刚打开的浮层关掉。正确做法是滚动时重新定位，锚点不可见才收起。
4. **中文输入法必须挡。** 拼音阶段 `input` 事件一触发就筛选/回填，用户会把「guan」当成一个值提交。`compositionstart → compositionend` 之间什么都不做。
5. **浮层 `z-index` 给到 `2147483000`**，同时留 `--sc-z` 变量给人调。
6. **"显示全部"必须在敲字时复位。** 点箭头展开时忽略框里已有的字（`showAll`），但用户接着敲字就必须回到筛选，否则输入什么都没有反应 —— 这个状态漏了复位就是一个"打字没反应"的诡异 bug。

---

## English

**SmartCombo** is a zero-dependency combobox for vanilla JS: one text input plus one filterable dropdown, with an optional *create-a-new-option* mode. Value and label are kept separate, the popup lives on `<body>` (so no ancestor can clip it) and re-anchors on scroll, IME composition never commits, and keyboard/a11y semantics are wired.

```js
import SmartCombo from "smart-combo";
new SmartCombo("#field", { options: ["a", "b"], mode: "create" });
```

`mode: "select"` commits only in-list values; `mode: "create"` turns unknown text into a new option. API: `getValue/getLabel/getItem/setValue/setOptions/open/close/disable/destroy`; events: `onChange/onSelect/onCreate/onInvalid/onOpen/onClose`. Theme with `--sc-*` custom properties.

No build step, no runtime deps. `npm test` for logic tests, open `test/browser.html` for DOM tests.

---

## License

MIT © 2026 Bruce
