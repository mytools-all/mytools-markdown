import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

test("real vendored editor switches preview/source/split without losing the document", async () => {
  const window = new Window({ settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const names = ["window", "document", "navigator", "Event", "CustomEvent", "MouseEvent", "Node", "Element", "HTMLElement", "SVGElement", "MutationObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let editor;
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: typeof window[name] === "function" && /AnimationFrame/.test(name) ? window[name].bind(window) : window[name] });
    window.Cropper = class {};
    window.screenfull = { isEnabled: false };
    window.document.body.innerHTML = '<div id="editor"></div>';
    const errors = [];
    const { createEditor } = await import("./editor-adapter.mjs");
    const { nextTick } = await import("./vue.mjs");
    editor = createEditor(window.document.querySelector("#editor"), { onChange() {}, onSave() {}, onError: (message) => errors.push(message) });
    const text = "# 文档标题\n\n保留这段内容";
    editor.setValue(text);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(window.document.querySelector("textarea"));
    assert.equal(window.document.querySelector("textarea").value, text);
    editor.setMode("preview");
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(window.document.querySelector(".md-editor-previewOnly"));
    assert.match(window.document.querySelector(".md-editor-preview").textContent, /文档标题[\s\S]*保留这段内容/);
    editor.setMode("source");
    await nextTick();
    assert.equal(window.document.querySelector(".md-editor-previewOnly"), null);
    assert.equal(window.document.querySelector("textarea").value, text);
    assert.equal(window.document.querySelector(".md-editor-preview-wrapper"), null);
    editor.setMode("edit");
    await nextTick();
    assert.equal(window.document.querySelector("textarea").value, text);
    assert.notEqual(window.document.querySelector(".md-editor-preview-wrapper").style.display, "none");
    assert.deepEqual(errors, []);
  } finally {
    editor?.destroy();
    await window.happyDOM.close();
    for (const name of names) {
      if (previous.get(name)) Object.defineProperty(globalThis, name, previous.get(name));
      else delete globalThis[name];
    }
  }
});
