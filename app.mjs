import { createEditor } from "./editor-adapter.mjs";
import {
  $,
  $$,
  action,
  copy,
  status,
  ready,
  call,
  debounce,
} from "./common.mjs";
import { marked } from "./marked.mjs";
import DOMPurify from "./purify.mjs";
let folders = ["默认分类"],
  currentFolder = "默认分类";
let notes = [],
  active = "",
  loaded = false,
  revision = 0,
  savedRevision = 0,
  saving = false,
  pending = false,
  renderTimer = null,
  dialogAction = null;
const note = () => notes.find((n) => n.id === active);
const source = $("#source");
const editor = createEditor($("#editor-root"), {
  onChange: (value) => {
    source.value = value;
    changed();
  },
  onSave: () => void persist(),
  onError: (message) => status(message, true),
});
for (const id of ["export", "html", "copy", "preview-mode", "edit-mode", "source-mode"])
  $(".document-head").append($("#" + id));

const newNote = (title = "未命名笔记", text = "") => ({
  id: crypto.randomUUID(),
  title,
  text,
  folder: currentFolder,
  created: Date.now(),
  updated: Date.now(),
});
function list() {
  const q = $("#note-search").value.trim().toLowerCase();
  $("#note-list").replaceChildren();
  const categories = [
    ...new Set([...folders, ...notes.map((n) => n.folder || "默认分类")]),
  ];
  for (const folder of categories) {
    const group = document.createElement("details");
    group.open = true;
    const heading = document.createElement("summary");
    heading.textContent = folder;
    heading.onclick = () => {
      currentFolder = folder;
    };
    group.append(heading);
    for (const n of [...notes]
      .filter((n) => (n.folder || "默认分类") === folder)
      .sort((a, b) => b.updated - a.updated)) {
      if (q && !(n.title + "\n" + n.text).toLowerCase().includes(q)) continue;
      const button = document.createElement("button");
      button.className = "note" + (n.id === active ? " active" : "");
      const title = document.createElement("b");
      title.textContent = n.title || "未命名笔记";
      const time = document.createElement("small");
      time.textContent = new Date(n.updated).toLocaleString();
      button.append(title, time);
      button.onclick = () => select(n.id);
      group.append(button);
    }
    $("#note-list").append(group);
  }
  const selectFolder = $("#folder");
  selectFolder.replaceChildren();
  for (const folder of categories) {
    const option = document.createElement("option");
    option.value = folder;
    option.textContent = folder;
    selectFolder.append(option);
  }
  selectFolder.value = note()?.folder || "默认分类";
}

function render() {
  try {
    $("#preview").innerHTML = DOMPurify.sanitize(
      marked.parse(source.value, { gfm: true, breaks: false }),
      { FORBID_TAGS: ["iframe", "style", "form"], FORBID_ATTR: ["style"] },
    );
    $$("#preview a").forEach(
      (a) =>
        (a.onclick = action(async (e) => {
          e.preventDefault();
          if (/^https?:\/\//.test(a.href))
            await call("shell.open", { url: a.href });
        })),
    );
    $("#outline").replaceChildren();
    $$("#preview h1,#preview h2,#preview h3,#preview h4").forEach((h) => {
      const b = document.createElement("button");
      b.textContent = h.textContent;
      b.style.paddingLeft = (Number(h.tagName[1]) - 1) * 10 + 5 + "px";
      b.onclick = () => h.scrollIntoView({ block: "start" });
      $("#outline").append(b);
    });
    status(
      source.value.length +
        " 字符 · " +
        source.value.split("\n").length +
        " 行",
    );
  } catch (e) {
    status("预览失败：" + e.message, true);
  }
}
function state() {
  $("#save-state").textContent = !loaded
    ? "正在恢复…"
    : revision > savedRevision
      ? saving
        ? "保存中…"
        : "未保存"
      : "已保存";
}
async function persist() {
  if (!loaded) return;
  if (saving) {
    pending = true;
    return;
  }
  saving = true;
  state();
  try {
    do {
      pending = false;
      const target = revision;
      const snapshot = JSON.parse(
        JSON.stringify({ version: 1, active, notes, folders }),
      );
      await call("storage.set", { key: "notebook", value: snapshot });
      savedRevision = target;
    } while (pending || revision > savedRevision);
    state();
  } catch (e) {
    status(
      "保存失败：" +
        (e.message || String(e)) +
        "。请点击保存重试，内容仍保留在编辑器中。",
      true,
    );
  } finally {
    saving = false;
    state();
  }
}
function changed() {
  if (!note()) return;
  note().text = source.value;
  note().title = $("#title").value || "未命名笔记";
  note().updated = Date.now();
  revision++;
  state();
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 80);
  void persist();
}
function select(id) {
  active = id;
  const n = note();
  if (!n) return;
  currentFolder = n.folder || "默认分类";
  source.value = n.text;
  editor.setValue(n.text);
  $("#title").value = n.title;
  list();
  render();
  state();
}
function dialog(title, message, callback, input = false) {
  $("#dialog-input").classList.toggle("hidden", !input);
  $("#dialog-input").value = "";
  $("#dialog-title").textContent = title;
  $("#dialog-message").textContent = message;
  dialogAction = callback;
  $("#dialog").classList.remove("hidden");
}
$("#dialog-cancel").onclick = () => {
  $("#dialog").classList.add("hidden");
  dialogAction = null;
};
$("#dialog-confirm").onclick = action(async () => {
  const callback = dialogAction;
  dialogAction = null;
  $("#dialog").classList.add("hidden");
  if (callback) await callback();
});
$("#new-folder").onclick = () =>
  dialog(
    "新建分类",
    "输入分类名称",
    async () => {
      const name = $("#dialog-input").value.trim();
      if (!name) throw Error("分类名称不能为空");
      if (folders.includes(name)) throw Error("该分类已存在");
      folders.push(name);
      currentFolder = name;
      revision++;
      list();
      await persist();
    },
    true,
  );
$("#folder").onchange = () => {
  if (!note()) return;
  note().folder = $("#folder").value;
  currentFolder = note().folder;
  revision++;
  list();
  void persist();
};
$("#new").onclick = () => {
  if (!loaded) return;
  const n = newNote();
  notes.push(n);
  revision++;
  select(n.id);
  void persist();
  source.focus();
};
$("#delete").onclick = () => {
  if (!note()) return;
  dialog(
    "删除笔记",
    "确认删除「" + note().title + "」？可先通过备份保存全部笔记。",
    async () => {
      notes = notes.filter((n) => n.id !== active);
      if (!notes.length) notes = [newNote()];
      revision++;
      select(notes[0].id);
      await persist();
    },
  );
};
$("#save").onclick = () => void persist();
source.oninput = changed;
$("#title").oninput = () => {
  changed();
  list();
};
$("#note-search").oninput = list;
function insert(before, after = "") {
  const start = source.selectionStart,
    end = source.selectionEnd;
  source.setRangeText(
    before + source.value.slice(start, end) + after,
    start,
    end,
    "select",
  );
  source.focus();
  changed();
}
function block(prefix) {
  const start =
    source.value.lastIndexOf("\n", Math.max(0, source.selectionStart - 1)) + 1;
  let end = source.value.indexOf("\n", source.selectionEnd);
  if (end < 0) end = source.value.length;
  const selected = source.value.slice(start, end);
  const lines = selected
    .split("\n")
    .map(
      (line) =>
        prefix + line.replace(/^#{1,6}\s+|^>\s+|^[-*]\s+|^\d+\.\s+/, ""),
    );
  source.setRangeText(lines.join("\n"), start, end, "select");
  source.focus();
  changed();
}
$$("#formats [data-before]").forEach(
  (b) => (b.onclick = () => insert(b.dataset.before, b.dataset.after || "")),
);
$$("#formats [data-block]").forEach(
  (b) => (b.onclick = () => block(b.dataset.block)),
);
$("#code").onclick = () => insert("\n```\n", "\n```\n");
$("#link").onclick = () => insert("[链接文字", "](https://example.com)");
$("#image").onclick = () =>
  insert("![图片描述", "](https://example.com/image.png)");
$("#table").onclick = () =>
  insert("\n| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |\n");
function mode(name) {
  editor.setMode(name);
  for (const key of ["edit", "source", "preview"])
    { const button = $("#" + key + "-mode");
      button.classList.toggle("active", key === name);
      button.setAttribute("aria-pressed", String(key === name)); }
}
$("#edit-mode").onclick = () => mode("edit");
$("#preview-mode").onclick = () => mode("preview");
$("#source-mode").onclick = () => mode("source");
$("#outline-toggle").onclick = () => $("#outline").classList.toggle("hidden");
source.onkeydown = (e) => {
  if (e.isComposing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void persist();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    insert("**", "**");
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
    e.preventDefault();
    insert("*", "*");
  } else if (e.key === "Tab") {
    e.preventDefault();
    insert("  ");
  }
};
let syncing = false;
function sync(from, to) {
  if (syncing) return;
  syncing = true;
  const a = from.scrollHeight - from.clientHeight,
    b = to.scrollHeight - to.clientHeight;
  to.scrollTop = a > 0 ? (from.scrollTop / a) * b : 0;
  requestAnimationFrame(() => (syncing = false));
}
source.onscroll = () => sync(source, $("#preview"));
$("#preview").onscroll = () => sync($("#preview"), source);
async function exportText(name, content) {
  const result = await call("fs.exporttext", { name, content });
  status(result.cancelled ? "已取消导出" : "已导出：" + result.path);
}
$("#export").onclick = action(() =>
  exportText((note()?.title || "文档") + ".md", source.value),
);
$("#html").onclick = action(() =>
  exportText(
    (note()?.title || "文档") + ".html",
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{max-width:850px;margin:40px auto;font:16px/1.8 sans-serif;padding:20px}pre{white-space:pre-wrap;background:#f4f4f4;padding:15px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px}</style><body>' +
      $("#preview").innerHTML +
      "</body></html>",
  ),
);
$("#copy").onclick = action(() => copy(source.value));
$("#backup").onclick = action(() =>
  exportText(
    "Markdown笔记备份.json",
    JSON.stringify({ version: 1, notes }, null, 2),
  ),
);
$("#open").onclick = () => $("#file").click();
$("#file").onchange = action(async () => {
  if (!loaded) throw Error("笔记恢复未完成，请稍后重试");
  const selected = [...$("#file").files];
  for (const file of selected) {
    if (file.size > 2 * 1024 * 1024) throw Error(file.name + " 超过 2 MB");
    const n = newNote(
      file.name.replace(/\.(md|markdown|txt)$/i, ""),
      await file.text(),
    );
    notes.push(n);
    active = n.id;
  }
  if (selected.length) {
    revision++;
    select(active);
    await persist();
  }
  $("#file").value = "";
});
$("#restore").onclick = () => $("#backup-file").click();
$("#backup-file").onchange = action(async () => {
  const f = $("#backup-file").files[0];
  if (!f) return;
  if (f.size > 8 * 1024 * 1024) throw Error("备份文件超过 8 MB");
  const data = JSON.parse(await f.text());
  if (
    !Array.isArray(data.notes) ||
    !data.notes.every(
      (n) => typeof n.title === "string" && typeof n.text === "string",
    )
  )
    throw Error("不是有效的笔记备份");
  dialog(
    "恢复备份",
    "将导入 " + data.notes.length + " 篇笔记，已有笔记会保留。",
    async () => {
      for (const n of data.notes) {
        const restored = newNote(n.title, n.text);
        restored.folder = typeof n.folder === "string" ? n.folder : "默认分类";
        notes.push(restored);
      }
      revision++;
      select(notes.at(-1).id);
      await persist();
    },
  );
  $("#backup-file").value = "";
});
$("#editor-root").inert = true;
source.disabled = true;
$("#title").disabled = true;
ready(async () => {
  try {
    const saved = await call("storage.get", { key: "notebook" });
    if (saved && Array.isArray(saved.notes) && saved.notes.length) {
      notes = saved.notes
        .filter((n) => typeof n.id === "string" && typeof n.text === "string")
        .map((n) => ({ ...n, title: String(n.title || "未命名笔记") }));
      active = saved.active;
      if (Array.isArray(saved.folders))
        folders = saved.folders.filter((folder) => typeof folder === "string");
    }
    if (!notes.length) {
      const draft = await call("storage.get", { key: "draft" });
      notes = [
        newNote(
          "默认文章",
          typeof draft === "string"
            ? draft
            : "# 你好，超级 Markdown\n\n开始记录你的想法。",
        ),
      ];
    }
    if (!notes.some((n) => n.id === active)) active = notes[0].id;
    loaded = true;
    $("#editor-root").inert = false;
    source.disabled = false;
    $("#title").disabled = false;
    select(active);
  } catch (e) {
    status(
      "恢复笔记失败：" +
        (e.message || String(e)) +
        "。请重新打开，避免覆盖已有笔记。",
      true,
    );
  }
});
