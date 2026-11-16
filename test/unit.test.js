/* Pure-logic tests — no DOM needed: `node --test test/` */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const SmartCombo = require("../smart-combo.js");

const { normalizeOptions, filterItems, findExact, stepEnabled, formatCreate } = SmartCombo.utils;

test("normalizeOptions: strings, numbers, objects, junk", () => {
  const out = normalizeOptions(["a", 12, { value: "v", label: "Vee" }, null, "", undefined]);
  assert.deepStrictEqual(out.map((o) => [o.value, o.label]), [
    ["a", "a"],
    [12, "12"],
    ["v", "Vee"]
  ]);
  assert.strictEqual(out[0].disabled, false);
  assert.strictEqual(normalizeOptions(null).length, 0);
});

test("normalizeOptions: object without value falls back to label", () => {
  const out = normalizeOptions([{ label: "只有标签" }]);
  assert.strictEqual(out[0].value, "只有标签");
  assert.strictEqual(out[0].label, "只有标签");
});

test("normalizeOptions: disabled and created flags survive", () => {
  const out = normalizeOptions([{ value: 1, label: "x", disabled: true, created: true }]);
  assert.strictEqual(out[0].disabled, true);
  assert.strictEqual(out[0].created, true);
});

test("filterItems: substring, case-insensitive by default", () => {
  const items = normalizeOptions(["WGS 84 / UTM zone 50N", "CGCS2000", "4326"]);
  assert.strictEqual(filterItems(items, "utm").length, 1);
  assert.strictEqual(filterItems(items, "UTM ZONE").length, 1);
  assert.strictEqual(filterItems(items, "2000").length, 1);
  assert.strictEqual(filterItems(items, "zzz").length, 0);
});

test("filterItems: empty query returns a copy of everything", () => {
  const items = normalizeOptions(["a", "b"]);
  const out = filterItems(items, "");
  assert.strictEqual(out.length, 2);
  assert.notStrictEqual(out, items);
});

test("filterItems: caseSensitive option is honoured", () => {
  const items = normalizeOptions(["Abc", "abc2"]);
  assert.strictEqual(filterItems(items, "Abc", { caseSensitive: true }).length, 1);
});

test("filterItems: custom filter sees the raw option", () => {
  const items = normalizeOptions([{ value: 1, label: "one", code: "AAA" }, { value: 2, label: "two", code: "BBB" }]);
  const out = filterItems(items, "bbb", {
    filter: (item, q) => String(item.raw.code).toLowerCase().indexOf(q.toLowerCase()) !== -1
  });
  assert.deepStrictEqual(out.map((o) => o.value), [2]);
});

test("findExact: value first, then label, case-insensitive", () => {
  const items = normalizeOptions([{ value: "js", label: "JavaScript" }]);
  assert.strictEqual(findExact(items, "js", false).value, "js");
  assert.strictEqual(findExact(items, "javascript", false).value, "js");
  assert.strictEqual(findExact(items, "j", false), null);
  assert.strictEqual(findExact(items, "JavaScript", true).value, "js");
  assert.strictEqual(findExact(items, "javascript", true), null);
});

test("stepEnabled: wraps around and skips disabled rows", () => {
  const rows = [{ disabled: false }, { disabled: true }, { disabled: false }];
  assert.strictEqual(stepEnabled(rows, -1, 1), 0);
  assert.strictEqual(stepEnabled(rows, 0, 1), 2);
  assert.strictEqual(stepEnabled(rows, 2, 1), 0);
  assert.strictEqual(stepEnabled(rows, 0, -1), 2);
  assert.strictEqual(stepEnabled([{ disabled: true }], -1, 1), -1);
  assert.strictEqual(stepEnabled([], -1, 1), -1);
});

test("formatCreate: default, template and function", () => {
  assert.strictEqual(formatCreate("32699"), "＋ 新建 “32699”");
  assert.strictEqual(formatCreate("32699", "Add {value}"), "Add 32699");
  assert.strictEqual(formatCreate("x", (t) => "(" + t + ")"), "(x)");
});

test("public surface is intact", () => {
  assert.strictEqual(typeof SmartCombo, "function");
  assert.strictEqual(SmartCombo.version, "0.1.0");
  ["get", "closeAll", "autoInit", "utils"].forEach((k) => {
    assert.ok(SmartCombo[k], "missing static " + k);
  });
  ["open", "close", "toggle", "setOptions", "setValue", "getValue", "getItem",
    "destroy", "enable", "disable", "focus", "setDisabled", "setReadonly"].forEach((k) => {
      assert.strictEqual(typeof SmartCombo.prototype[k], "function", "missing method " + k);
    });
});
