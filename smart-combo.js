/*!
 * SmartCombo v0.1.0
 * A tiny, dependency-free combobox: one text input + one dropdown.
 *
 *   mode "select" — pick from a list (typing filters; only in-list values commit)
 *   mode "create" — pick from a list, or add a brand-new option on the fly
 *
 * MIT License · https://github.com/OWNER/smart-combo
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else if (typeof define === "function" && define.amd) { define([], factory); }
  else { root.SmartCombo = factory(); }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* -------------------------------------------------------------- constants */

  var KEY = { TAB: 9, ENTER: 13, ESC: 27, END: 35, HOME: 36, UP: 38, DOWN: 40 };
  var GAP = 2;          // px between the input and the popup
  var EDGE = 6;         // px kept away from the viewport edges
  var MIN_POP_H = 96;   // smallest useful popup height
  var MAX_POP_W = 560;  // popup never grows wider than this

  var MSG = { empty: "没有匹配项", loading: "加载中…" };

  var DEFAULTS = {
    options: [],          // array | (query, instance) => array | Promise<array>
    mode: "select",       // "select" | "create"
    value: null,          // initial value (matched against options)
    name: null,           // when set, a hidden input with this name carries the value (form submit)
    placeholder: null,
    maxRender: 100,       // render at most N candidates (the rest stay filterable)
    caseSensitive: false,
    allowFree: false,     // select mode: commit text that is not in the list as a free value
    keepCreated: true,    // create mode: fold a created option into the candidate list
    clearable: false,
    disabled: false,
    readonly: false,
    openOnFocus: true,
    showAllOnOpen: true,  // opening by focus/click lists everything, not just what is typed
    createLabel: null,    // (text) => string, or a template containing {value}
    filter: null,         // (item, query, raw) => boolean
    messages: null,       // { empty, loading }
    onChange: null,       // (value, item, instance)
    onSelect: null,       // (value, item, instance) — picked an existing option
    onCreate: null,       // (value, item, instance) — a new option was created
    onOpen: null,
    onClose: null,
    onInvalid: null       // (text, instance) — select mode, text matched nothing
  };

  /* ---------------------------------------------------------------- helpers */

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
      }
    }
    return target;
  }
  function isFn(v) { return typeof v === "function"; }
  function toText(v) { return v === null || v === undefined ? "" : String(v); }
  function isThenable(v) { return !!v && isFn(v.then); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** Anything the caller passes as `options` becomes an internal record. */
  function normalizeOptions(raw) {
    var list = raw === null || raw === undefined ? [] : (Array.isArray(raw) ? raw : [raw]);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === null || o === undefined || o === "") continue;
      if (typeof o === "object") {
        var value = o.value !== undefined ? o.value : o.label;
        if (value === undefined || value === null) continue;
        out.push({
          value: value,
          label: toText(o.label !== undefined ? o.label : value),
          disabled: !!o.disabled,
          created: !!o.created,
          raw: o
        });
      } else {
        out.push({ value: o, label: toText(o), disabled: false, created: false, raw: o });
      }
    }
    return out;
  }

  function defaultFilter(item, query, caseSensitive) {
    if (!query) return true;
    var hay = caseSensitive ? item.label : item.label.toLowerCase();
    var needle = caseSensitive ? query : query.toLowerCase();
    return hay.indexOf(needle) !== -1;
  }

  function filterItems(items, query, cfg) {
    var q = toText(query);
    if (!q) return items.slice();
    var cs = !!(cfg && cfg.caseSensitive);
    var userFilter = cfg && cfg.filter;
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (userFilter) {
        if (userFilter(it, q, it.raw) === true) out.push(it);
      } else if (defaultFilter(it, q, cs)) {
        out.push(it);
      }
    }
    return out;
  }

  /** Exact match on value, then on label ("users re-type what they see"). */
  function findExact(items, text, caseSensitive) {
    var t = caseSensitive ? text : text.toLowerCase();
    var i, v, l;
    for (i = 0; i < items.length; i++) {
      v = toText(items[i].value);
      if ((caseSensitive ? v : v.toLowerCase()) === t) return items[i];
    }
    for (i = 0; i < items.length; i++) {
      l = items[i].label;
      if ((caseSensitive ? l : l.toLowerCase()) === t) return items[i];
    }
    return null;
  }

  /** Move through rows by `delta`, skipping disabled ones, wrapping around. */
  function stepEnabled(rows, from, delta) {
    var n = rows.length;
    if (!n) return -1;
    var i = from < 0 ? (delta > 0 ? -1 : n) : from;
    for (var c = 0; c < n; c++) {
      i = (i + delta + n) % n;
      if (!rows[i].disabled) return i;
    }
    return -1;
  }

  function formatCreate(text, tpl) {
    if (isFn(tpl)) return toText(tpl(text));
    if (tpl) return toText(tpl).replace(/\{value\}/g, text);
    return "＋ 新建 “" + text + "”";
  }

  /* ---------------------------------------------------------------- library */

  var INSTANCES = [];   // live instances (for SmartCombo.get / closeAll)
  var openInstance = null;
  var uid = 0;

  function SmartCombo(target, options) {
    if (!(this instanceof SmartCombo)) return new SmartCombo(target, options);

    var input = typeof target === "string" ? document.querySelector(target) : target;
    if (!input || !input.nodeType) throw new Error("SmartCombo: input element not found");

    var prev = SmartCombo.get(input);
    if (prev) prev.destroy();

    this.opts = assign({}, DEFAULTS, options || {});
    this.messages = assign({}, MSG, this.opts.messages || {});
    this.input = input;
    this.id = ++uid;
    this._value = "";
    this._label = "";
    this._item = null;
    this._all = [];
    this._rows = [];
    this._active = -1;
    this._query = "";
    this._showAll = false;
    this._loading = false;
    this._seq = 0;
    this._composing = false;
    this._destroyed = false;
    this._raf = null;

    this._build();
    this._bind();

    if (!isFn(this.opts.options)) this._all = normalizeOptions(this.opts.options);
    if (this.opts.value !== null && this.opts.value !== undefined) {
      this.setValue(this.opts.value);
    } else if (input.value) {
      // pre-filled by the host page: adopt it as the current value
      this._commitText(input.value, true);
    }

    INSTANCES.push(this);
  }

  var P = SmartCombo.prototype;

  /* ------------------------------------------------------------------- DOM */

  P._build = function () {
    var input = this.input;
    var opts = this.opts;

    var wrap = document.createElement("span");
    wrap.className = "sc-wrap";
    if (input.parentNode) input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    this._wrap = wrap;

    input.classList.add("sc-input");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "sc-list-" + this.id);
    if (opts.placeholder && !input.getAttribute("placeholder")) {
      input.setAttribute("placeholder", opts.placeholder);
    }

    // caret: a real button (mouse + touch), but never a tab stop
    var caret = document.createElement("button");
    caret.type = "button";
    caret.className = "sc-caret";
    caret.tabIndex = -1;
    caret.setAttribute("aria-label", "展开选项");
    caret.title = "展开选项";
    caret.innerHTML = '<svg viewBox="0 0 10 6" aria-hidden="true">'
      + '<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" '
      + 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    wrap.appendChild(caret);
    this._caret = caret;

    if (opts.clearable) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "sc-clear";
      clear.tabIndex = -1;
      clear.setAttribute("aria-label", "清空");
      clear.title = "清空";
      clear.textContent = "✕";
      wrap.appendChild(clear);
      this._clear = clear;
    }

    if (opts.name) {
      var hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = opts.name;
      hidden.className = "sc-value";
      wrap.appendChild(hidden);
      this._hidden = hidden;
    }

    // The popup lives on <body>: ancestors with overflow/transform would clip it,
    // and z-index only competes inside the stacking context it was born in.
    var pop = document.createElement("div");
    pop.className = "sc-pop";
    pop.setAttribute("data-sc-pop", String(this.id));

    var list = document.createElement("div");
    list.className = "sc-list";
    list.id = "sc-list-" + this.id;
    list.setAttribute("role", "listbox");
    pop.appendChild(list);

    document.body.appendChild(pop);
    this._pop = pop;
    this._list = list;

    this.setDisabled(!!opts.disabled);
    this.setReadonly(!!opts.readonly);
    this._syncChrome();
  };

  /* ---------------------------------------------------------------- events */

  P._bind = function () {
    var self = this;
    var input = this.input;

    this._onInput = function () {
      if (self._composing || self._destroyed) return;   // IME mid-composition
      self._query = toText(input.value);
      self._showAll = false;          // typed something → back to filtering
      if (self._isOpen()) self._render();
      else self.open(false);
    };

    this._onCompositionStart = function () { self._composing = true; };
    this._onCompositionEnd = function () {
      self._composing = false;
      if (self._destroyed) return;
      self._query = toText(input.value);
      self._showAll = false;
      if (self._isOpen()) self._render();
    };

    this._onKey = function (e) {
      if (e.isComposing || e.keyCode === 229) return;    // never act mid-IME
      var open = self._isOpen();
      var row;

      switch (e.keyCode) {
        case KEY.DOWN:
          e.preventDefault();
          if (!open) { self.open(); break; }
          self._setActive(stepEnabled(self._rows, self._active, 1));
          break;

        case KEY.UP:
          if (!open) break;
          e.preventDefault();
          self._setActive(stepEnabled(self._rows, self._active, -1));
          break;

        case KEY.HOME:
          if (!open) break;
          e.preventDefault();
          self._setActive(stepEnabled(self._rows, -1, 1));
          break;

        case KEY.END:
          if (!open) break;
          e.preventDefault();
          self._setActive(stepEnabled(self._rows, -1, -1));
          break;

        case KEY.ENTER:
          if (open) e.preventDefault();
          row = self._rows[self._active];
          if (open && row && !row.disabled) self._pick(row);
          else self._commitText(input.value);
          break;

        case KEY.TAB:
          if (open) self.close();
          self._commitText(input.value);   // Tab keeps moving: no preventDefault
          break;

        case KEY.ESC:
          if (!open) break;
          e.preventDefault();
          self.close();
          self._revert();
          break;
      }
    };

    this._onFocus = function () {
      if (self.opts.openOnFocus && !self._suppressFocusOpen) self.open();
    };

    /* Enter/click-away closes the popup while the input keeps the focus, so a
     * plain click on that same input fires no `focus` — without this the user
     * clicks the field and nothing happens. Only ever opens, never toggles:
     * a click must not swallow a list the user is reading. */
    this._onClick = function () {
      if (!self._isOpen() && !self._composing) self.open();
    };

    this._onBlur = function () {
      if (self._destroyed) return;
      self._commitText(input.value);
      self.close();
    };

    this._onCaretDown = function (e) {
      e.preventDefault();          // keep the input focused (no blur / no double toggle)
      e.stopPropagation();
      if (self._isOpen()) self.close();
      else self.open(true);        // show the whole list, not whatever is typed
    };

    this._onPopDown = function (e) {
      var rowEl = e.target && e.target.closest ? e.target.closest(".sc-opt") : null;
      if (!rowEl) return;
      e.preventDefault();          // keep focus in the input so blur never races the pick
      e.stopPropagation();
      var row = self._rows[Number(rowEl.getAttribute("data-row"))];
      if (!row || row.disabled) return;
      self._pick(row);
    };

    this._onPopOver = function (e) {
      var rowEl = e.target && e.target.closest ? e.target.closest(".sc-opt") : null;
      if (!rowEl) return;
      var idx = Number(rowEl.getAttribute("data-row"));
      var row = self._rows[idx];
      if (!row || row.disabled || idx === self._active) return;
      self._setActive(idx, false);
    };

    this._onDocDown = function (e) {
      if (!self._isOpen()) return;
      var t = e.target;
      if (!t || !t.closest) return;
      if (self._wrap.contains(t) || self._pop.contains(t)) return;
      // Clicking anywhere else means "I am done" — commit first, then hide.
      // Relying on blur alone loses the typed value whenever the click target
      // swallows focus (preventDefault on pointerdown, non-focusable div, …).
      self._commitText(self.input.value);
      self.close();
    };

    /* The popup is fixed-positioned, so a page/container scroll would leave it
     * floating where the input used to be. Re-anchoring on every scroll keeps it
     * glued; it closes only when the input itself is no longer visible.
     * 🔴 Do not just close on any scroll: focusing an input near the viewport
     *    bottom makes the browser scroll it into view, and that queued scroll
     *    event would kill the popup the same focus had just opened. */
    this._onScroll = function (e) {
      if (!self._isOpen()) return;
      if (e.target && e.target.nodeType === 1 && self._pop.contains(e.target)) return;
      if (self._raf) return;
      var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
      self._raf = raf(function () {
        self._raf = null;
        if (!self._isOpen() || self._destroyed) return;
        if (!self._anchorVisible()) { self.close(); return; }
        self._place();
      });
    };

    this._onResize = function () { if (self._isOpen()) self._place(); };

    input.addEventListener("input", this._onInput);
    input.addEventListener("compositionstart", this._onCompositionStart);
    input.addEventListener("compositionend", this._onCompositionEnd);
    input.addEventListener("keydown", this._onKey);
    input.addEventListener("focus", this._onFocus);
    input.addEventListener("click", this._onClick);
    input.addEventListener("blur", this._onBlur);

    this._caret.addEventListener("pointerdown", this._onCaretDown);
    if (this._clear) {
      this._clear.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.setValue("", { fire: true });
        self.close();
        self.input.focus();
      });
    }
    this._pop.addEventListener("pointerdown", this._onPopDown);
    this._pop.addEventListener("pointerover", this._onPopOver);
    document.addEventListener("pointerdown", this._onDocDown, true);
    window.addEventListener("scroll", this._onScroll, true);
    window.addEventListener("resize", this._onResize);
  };

  P._unbind = function () {
    var input = this.input;
    input.removeEventListener("input", this._onInput);
    input.removeEventListener("compositionstart", this._onCompositionStart);
    input.removeEventListener("compositionend", this._onCompositionEnd);
    input.removeEventListener("keydown", this._onKey);
    input.removeEventListener("focus", this._onFocus);
    input.removeEventListener("click", this._onClick);
    input.removeEventListener("blur", this._onBlur);
    this._caret.removeEventListener("pointerdown", this._onCaretDown);
    this._pop.removeEventListener("pointerdown", this._onPopDown);
    this._pop.removeEventListener("pointerover", this._onPopOver);
    document.removeEventListener("pointerdown", this._onDocDown, true);
    window.removeEventListener("scroll", this._onScroll, true);
    window.removeEventListener("resize", this._onResize);
  };

  /* ----------------------------------------------------------------- popup */

  P._isOpen = function () { return this._pop.classList.contains("is-open"); };

  P.open = function (showAll) {
    if (this._destroyed || this._disabled || this._readonly) return this;
    if (openInstance && openInstance !== this) openInstance.close();
    openInstance = this;

    // Opening by focus/click/caret shows the whole list: with a value already in
    // the box, filtering by that value would leave a single row to look at.
    this._showAll = showAll === undefined ? !!this.opts.showAllOnOpen : !!showAll;
    this._query = this._showAll ? "" : toText(this.input.value);
    this._pop.classList.add("is-open");
    this._wrap.classList.add("is-open");
    this.input.setAttribute("aria-expanded", "true");
    this._load();
    this._emit("onOpen");
    return this;
  };

  P.close = function () {
    if (!this._isOpen()) return this;
    this._pop.classList.remove("is-open");
    this._wrap.classList.remove("is-open");
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this._active = -1;
    if (openInstance === this) openInstance = null;
    this._emit("onClose");
    return this;
  };

  P.toggle = function (showAll) {
    return this._isOpen() ? this.close() : this.open(showAll);
  };

  /** Pull the candidate list (sync array or async source) and render it. */
  P._load = function () {
    var self = this;
    var src = this.opts.options;

    // An array source is normalised once (constructor / setOptions); re-normalising
    // here would throw away options created at runtime via keepCreated.
    if (!isFn(src)) {
      this._render();
      return;
    }

    var mine = ++this._seq;
    var res = src(this._query, this);
    if (!isThenable(res)) {
      this._all = normalizeOptions(res);
      this._render();
      return;
    }
    this._loading = true;
    this._render();
    Promise.resolve(res).then(function (list) {
      if (mine !== self._seq || self._destroyed) return;
      self._loading = false;
      self._all = normalizeOptions(list);
      self._render();
    }, function () {
      if (mine !== self._seq || self._destroyed) return;
      self._loading = false;
      self._render();
    });
  };

  P._render = function () {
    var self = this;
    var list = this._list;
    while (list.firstChild) list.removeChild(list.firstChild);
    this._rows = [];

    var items = this._showAll
      ? this._all.slice()
      : filterItems(this._all, this._query, this.opts);
    var shown = items.slice(0, Math.max(1, this.opts.maxRender));
    var typed = toText(this._query).trim();
    // "create" only offers the new-option row when the text is genuinely new
    var canCreate = this.opts.mode === "create" && typed !== ""
      && !findExact(this._all, typed, this.opts.caseSensitive);

    var frag = document.createDocumentFragment();

    if (this._loading) {
      frag.appendChild(this._msgNode(this.messages.loading));
    }

    for (var i = 0; i < shown.length; i++) {
      var it = shown[i];
      var el = document.createElement("div");
      el.className = "sc-opt";
      el.id = "sc-opt-" + this.id + "-" + i;
      el.setAttribute("role", "option");
      el.setAttribute("data-row", String(this._rows.length));
      el.textContent = it.label;
      if (it.disabled) {
        el.classList.add("is-disabled");
        el.setAttribute("aria-disabled", "true");
      }
      if (it.created) el.classList.add("is-created");
      if (this._item && toText(it.value) === toText(this._item.value)) {
        el.classList.add("is-selected");
        el.setAttribute("aria-selected", "true");
      }
      this._rows.push({ kind: "item", item: it, disabled: !!it.disabled, el: el });
      frag.appendChild(el);
    }

    if (canCreate) {
      var cel = document.createElement("div");
      cel.className = "sc-opt sc-opt--create";
      cel.id = "sc-opt-" + this.id + "-new";
      cel.setAttribute("role", "option");
      cel.setAttribute("data-row", String(this._rows.length));
      cel.textContent = formatCreate(typed, this.opts.createLabel);
      this._rows.push({ kind: "create", text: typed, disabled: false, el: cel });
      frag.appendChild(cel);
    }

    if (!this._rows.length && !this._loading) {
      frag.appendChild(this._msgNode(this.messages.empty));
    }

    // cap hint: say so instead of silently hiding matches
    if (items.length > shown.length) {
      frag.appendChild(this._msgNode("还有 " + (items.length - shown.length)
        + " 项，继续输入可缩小范围"));
    }

    list.appendChild(frag);
    this._place();
    this._autoActivate();
  };

  P._msgNode = function (text) {
    var el = document.createElement("div");
    el.className = "sc-msg";
    el.textContent = text;
    return el;
  };

  /** Activate the row for the current value, else the first enabled row. */
  P._autoActivate = function () {
    var target = -1;
    var i;
    if (this._item) {
      for (i = 0; i < this._rows.length; i++) {
        if (this._rows[i].kind === "item"
          && toText(this._rows[i].item.value) === toText(this._item.value)) { target = i; break; }
      }
    }
    if (target < 0) target = stepEnabled(this._rows, -1, 1);
    this._setActive(target, true);
  };

  P._setActive = function (idx, scroll) {
    if (!this._rows.length) { this._active = -1; return; }
    if (idx < 0) idx = -1;
    for (var i = 0; i < this._rows.length; i++) {
      this._rows[i].el.classList.toggle("is-active", i === idx);
    }
    this._active = idx;
    var row = this._rows[idx];
    if (!row) { this.input.removeAttribute("aria-activedescendant"); return; }
    this.input.setAttribute("aria-activedescendant", row.el.id);
    if (scroll !== false && row.el.scrollIntoView) {
      row.el.scrollIntoView({ block: "nearest" });
    }
  };

  /** Is the input still on screen (and not clipped away by a scrolling box)? */
  P._anchorVisible = function () {
    var r = this.input.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false;
    var p = this.input.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      var st = window.getComputedStyle ? window.getComputedStyle(p) : null;
      if (st && (/(auto|scroll|hidden)/.test(st.overflowY) || /(auto|scroll|hidden)/.test(st.overflowX))) {
        var pr = p.getBoundingClientRect();
        if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) return false;
        break;                       // nearest clipping box is enough
      }
      p = p.parentElement;
    }
    return true;
  };

  P._place = function () {
    var pop = this._pop;
    if (!this._isOpen()) return;
    var ir = this.input.getBoundingClientRect();
    var wr = this._wrap.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;

    pop.style.minWidth = Math.round(wr.width) + "px";
    pop.style.maxWidth = Math.min(MAX_POP_W, vw - EDGE * 2) + "px";
    pop.style.maxHeight = "";
    pop.style.visibility = "hidden";        // measure, then reveal

    var w = Math.min(pop.offsetWidth || wr.width, vw - EDGE * 2);
    var h = pop.offsetHeight;
    var below = vh - ir.bottom - GAP - EDGE;
    var above = ir.top - GAP - EDGE;
    var useAbove = h > below && above > below;
    var maxH = Math.max(MIN_POP_H, useAbove ? above : below);
    var top = useAbove
      ? Math.max(EDGE, ir.top - GAP - Math.min(h, maxH))
      : Math.min(ir.bottom + GAP, vh - EDGE - Math.min(h, maxH));

    pop.style.maxHeight = Math.round(maxH) + "px";
    pop.style.top = Math.round(top) + "px";
    pop.style.left = Math.round(clamp(ir.left, EDGE, Math.max(EDGE, vw - w - EDGE))) + "px";
    pop.style.visibility = "";
  };

  /* ---------------------------------------------------------------- commit */

  P._pick = function (row) {
    if (row.kind === "create") this._create(row.text);
    else this._commitItem(row.item);
  };

  P._commitItem = function (item) {
    this._apply(item.value, item.label, item);
    this.close();
    this._emit("onSelect", item.value, item, this);
  };

  P._create = function (text) {
    var t = toText(text).trim();
    if (!t) return;
    var item = { value: t, label: t, disabled: false, created: true, raw: { value: t, label: t, created: true } };
    if (this.opts.keepCreated) this._all.push(item);
    this._apply(t, t, item);
    this.close();
    this._emit("onCreate", t, item, this);
  };

  /** Turn whatever is in the input into a committed value. */
  P._commitText = function (text, quiet) {
    var t = toText(text).trim();
    var cs = this.opts.caseSensitive;

    if (t === "") {
      if (this._value !== "" || this._label !== "") this._apply("", "", null);
      return;
    }
    var hit = findExact(this._all, t, cs);
    if (hit) {
      if (toText(hit.value) !== toText(this._value)) this._commitItem(hit);
      else { this.input.value = hit.label; this._label = hit.label; }
      return;
    }
    if (this.opts.mode === "create") { this._create(t); return; }
    if (this.opts.allowFree) {
      if (toText(this._value) !== t) this._apply(t, t, { value: t, label: t, free: true });
      return;
    }
    // select mode, nothing matched: keep the last good value and restore its label
    if (quiet) return;
    this._revert();
    this._emit("onInvalid", t, this);
  };

  P._revert = function () {
    this.input.value = this._item ? this._item.label : this._label;
  };

  P._apply = function (value, label, item) {
    var changed = toText(value) !== toText(this._value);
    this._value = value === null || value === undefined ? "" : value;
    this._label = toText(label);
    this._item = item || null;
    this.input.value = this._label;
    if (this._hidden) this._hidden.value = toText(this._value);
    this._syncChrome();
    if (changed) this._emit("onChange", this._value, this._item, this);
  };

  P._syncChrome = function () {
    var has = toText(this._value) !== "";
    this._wrap.classList.toggle("has-value", has);
    this._wrap.classList.toggle("has-created", !!(this._item && this._item.created));
  };

  P._emit = function (name) {
    var fn = this.opts[name];
    if (!isFn(fn)) return;
    var args = Array.prototype.slice.call(arguments, 1);
    try { fn.apply(this, args); }
    catch (err) { if (typeof console !== "undefined") console.error("SmartCombo: " + name + " threw", err); }
  };

  /* ------------------------------------------------------------ public API */

  P.setValue = function (value, o) {
    var opts = o || {};
    var self = this;
    if (value === null || value === undefined || value === "") {
      this._value = ""; this._label = ""; this._item = null;
      if (!opts.keepInput) this.input.value = "";
      if (this._hidden) this._hidden.value = "";
      this._syncChrome();
      if (opts.fire) this._emit("onChange", "", null, this);
      return this;
    }
    var promise = null;
    if (isFn(this.opts.options)) {
      var res = this.opts.options("", this);
      if (isThenable(res)) promise = Promise.resolve(res);
      else this._all = normalizeOptions(res);
    }
    var applyNow = function () {
      var hit = findExact(self._all, toText(value), self.opts.caseSensitive);
      var v = hit ? hit.value : value;
      var l = hit ? hit.label : toText(value);
      self._value = v; self._label = l; self._item = hit;
      self.input.value = l;
      if (self._hidden) self._hidden.value = toText(v);
      self._syncChrome();
      if (opts.fire) self._emit("onChange", v, hit, self);
    };
    if (promise) promise.then(function (list) { self._all = normalizeOptions(list); applyNow(); }, applyNow);
    else applyNow();
    return this;
  };

  P.getValue = function () { return this._value; };
  P.getLabel = function () { return this._label; };
  P.getItem = function () { return this._item; };
  P.getOptions = function () { return this._all.slice(); };
  P.getInput = function () { return this.input; };
  P.getPopup = function () { return this._pop; };

  /** Replace the candidate list (per-row lists, remote results, …). */
  P.setOptions = function (list, o) {
    var opts = o || {};
    this.opts.options = list === undefined ? this.opts.options : list;
    if (!isFn(this.opts.options)) {
      this._all = normalizeOptions(this.opts.options);
      // keep the label in sync with the (possibly new) list, value untouched
      if (toText(this._value) !== "") {
        var hit = findExact(this._all, toText(this._value), this.opts.caseSensitive);
        if (hit) { this._label = hit.label; this._item = hit; this.input.value = hit.label; }
      }
    }
    this._syncChrome();
    if (!opts.silent && this._isOpen()) this._load();
    return this;
  };

  P.setDisabled = function (on) {
    this._disabled = !!on;
    this.input.disabled = this._disabled;
    this._caret.disabled = this._disabled;
    this._wrap.classList.toggle("is-disabled", this._disabled);
    if (this._disabled) this.close();
    return this;
  };

  P.setReadonly = function (on) {
    this._readonly = !!on;
    this.input.readOnly = this._readonly;
    this._wrap.classList.toggle("is-readonly", this._readonly);
    if (this._readonly) this.close();
    return this;
  };

  P.enable = function () { return this.setDisabled(false); };
  P.disable = function () { return this.setDisabled(true); };
  P.focus = function () { this.input.focus(); return this; };

  P.destroy = function () {
    if (this._destroyed) return;
    this._destroyed = true;
    this.close();
    this._unbind();
    if (this._pop.parentNode) this._pop.parentNode.removeChild(this._pop);
    if (this._wrap.parentNode) {
      var wrap = this._wrap;
      wrap.parentNode.insertBefore(this.input, wrap);
      wrap.parentNode.removeChild(wrap);
    }
    this.input.classList.remove("sc-input");
    this.input.removeAttribute("role");
    this.input.removeAttribute("aria-autocomplete");
    this.input.removeAttribute("aria-expanded");
    this.input.removeAttribute("aria-controls");
    this.input.removeAttribute("aria-activedescendant");
    var i = INSTANCES.indexOf(this);
    if (i >= 0) INSTANCES.splice(i, 1);
  };

  /* ---------------------------------------------------------------- statics */

  SmartCombo.version = "0.1.0";

  SmartCombo.get = function (el) {
    var node = typeof el === "string" ? document.querySelector(el) : el;
    for (var i = 0; i < INSTANCES.length; i++) {
      if (INSTANCES[i].input === node) return INSTANCES[i];
    }
    return null;
  };

  SmartCombo.closeAll = function () {
    if (openInstance) openInstance.close();
    return SmartCombo;
  };

  /** Turn every [data-smart-combo] element into an instance (no build step needed).
   *  data-options='["a","b"]' | "a,b,c"   data-mode="create"   data-name="..."  */
  SmartCombo.autoInit = function (root, defaults) {
    var scope = root || document;
    var nodes = scope.querySelectorAll("[data-smart-combo]");
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var raw = el.getAttribute("data-options") || "";
      var list = [];
      if (raw) {
        try { list = JSON.parse(raw); }
        catch (e) { list = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean); }
      }
      out.push(new SmartCombo(el, assign({}, defaults || {}, {
        options: list,
        mode: el.getAttribute("data-mode") || "select",
        name: el.getAttribute("data-name") || null,
        placeholder: el.getAttribute("data-placeholder") || el.getAttribute("placeholder") || null,
        value: el.getAttribute("data-value") || null
      })));
    }
    return out;
  };

  SmartCombo.utils = {
    normalizeOptions: normalizeOptions,
    filterItems: filterItems,
    findExact: findExact,
    stepEnabled: stepEnabled,
    formatCreate: formatCreate
  };

  return SmartCombo;
});
