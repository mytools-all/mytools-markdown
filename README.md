# Markdown 编辑器

首次运行测试先执行 npm install --ignore-scripts，安装固定的开发测试依赖；这些依赖不进入运行包。

版本 0.1.1：顶部“双栏 / 源码 / 预览”直接控制实际编辑器。所用 md-editor-v3 2.11.3 在初始化时固定部分模式参数，因此切换时重新挂载编辑器并保留文档内容；编辑器内撤销栈和光标位置可能重置，不承诺跨模式保留撤销历史。没有修改第三方编辑器源码。

执行 npm test、npm pack 后，从宿主“插件中心 → 开发者 → 安装插件包（.zip / .tgz）”安装实际包，关闭并重开插件。

Markdown 编辑器：实时预览、自动保存草稿。

源码版本：0.1.1；适用于 MyTools，不能作为独立网页调用宿主能力。

## 安装

在 MyTools 插件管理的 npm 安装入口输入 `@mytools-all/mytools-markdown@0.1.1`。也可以下载本仓库，在开发者页面选择“安装本地目录”。

## 开发

直接编辑本目录的 HTML、JavaScript 和样式，无需依赖宿主源码或其他插件仓库。修改后重新安装本地目录。运行 `npm test` 检查包内契约和逻辑。插件 API 规范见 [mytools](https://github.com/mytools-all/mytools/tree/main/docs)。

## 权限

声明的宿主能力：storage.get、storage.set、clipboard.write、shell.open、fs.exporttext。目录和危险操作仍需用户授权。

## 许可

项目代码使用 MIT；随附的第三方代码遵循各自随附的许可证。
