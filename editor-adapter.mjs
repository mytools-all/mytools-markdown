import { createApp, h, ref } from "./vue.mjs";
import MdEditor from "./md-editor.mjs";
import DOMPurify from "./purify.mjs";
export function createEditor(target, options) {
  const content = ref(""),
    theme = ref(
      document.documentElement.dataset.theme === "light" ? "light" : "dark",
    ),
    mode = ref("edit"),
    modeRevision = ref(0);
  MdEditor.config({
    editorExtensions: {
      highlight: { instance: window.hljs },
      cropper: { instance: window.Cropper },
      screenfull: { instance: window.screenfull },
    },
    editorConfig: { renderDelay: 100 },
  });
  const app = createApp({
    render: () =>
      h(MdEditor, {
        key: modeRevision.value,
        modelValue: content.value,
        "onUpdate:modelValue": (v) => {
          content.value = v;
          options.onChange(v);
        },
        theme: theme.value,
        previewOnly: mode.value === "preview",
        preview: mode.value !== "source",
        editorId: "markdown-editor",
        language: "zh-CN",
        noIconfont: true,
        noPrettier: true,
        noMermaid: true,
        noKatex: true,
        noUploadImg: false,
        toolbars: [
          "bold",
          "underline",
          "italic",
          "strikeThrough",
          "-",
          "title",
          "sub",
          "sup",
          "quote",
          "unorderedList",
          "orderedList",
          "task",
          "-",
          "codeRow",
          "code",
          "link",
          "image",
          "table",
          "-",
          "revoke",
          "next",
          "save",
          "=",
          "pageFullscreen",
          "preview",
          "htmlPreview",
          "catalog",
        ],
        sanitize: (html) =>
          DOMPurify.sanitize(html, {
            FORBID_TAGS: ["iframe", "style", "form"],
            FORBID_ATTR: ["style"],
          }),
        onSave: options.onSave,
        onError: (e) => options.onError(e.message || e.cause || String(e)),
        onUploadImg: async (files, callback) => {
          try {
            const urls = [];
            for (const file of files) {
              if (file.size > 1024 * 1024)
                throw Error("图片大于 1 MB，请缩小后插入");
              urls.push(
                await new Promise((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(r.result);
                  r.onerror = () => reject(Error("图片读取失败"));
                  r.readAsDataURL(file);
                }),
              );
            }
            callback(urls);
          } catch (e) {
            options.onError(e.message);
          }
        },
      }),
  });
  app.config.errorHandler = (e) => options.onError(e.message || String(e));
  app.mount(target);
  const observer = new MutationObserver(() => {
    theme.value =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return {
    setValue: (v) => {
      content.value = v;
    },
    setMode: (value) => {
      if (!["edit", "source", "preview"].includes(value)) throw Error("未知编辑模式");
      mode.value = value;
      modeRevision.value++;
    },
    destroy: () => { observer.disconnect(); app.unmount(); },
  };
}
