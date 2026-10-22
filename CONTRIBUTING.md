# 开发与发布

使用 Node.js 24+ 和 Git。根目录不需要安装 npm 依赖：

```bash
node tools/check.mjs
```

检查包括严格 UTF-8、JavaScript 语法、代码文件少于 3,000 行，以及常见凭据和本机路径模式。它不能替代人工确认分享内容，也不宣称完成了真实 Harness 集成测试。

`lib/` 是运行时插件，`scripts/` 是安装与接入脚本，`runtime/` 只存第三方依赖清单与锁文件，`tools/` 是仓库检查和打包工具。不要提交运行时的 `node_modules`、工作区数据、profile、备份或密钥。

## 打包

先更新版本、变更记录与安装指引，再提交全部发布内容。在干净的 Git checkout 中运行：

```bash
node tools/release.mjs
```

输出位于忽略提交的 `dist/<版本>/`，包括 ZIP、TGZ、`SHA256SUMS.txt` 和包含源提交 SHA 的 `release-manifest.json`。打包工具要求 npm 打包结果与 Git HEAD 文件逐项一致，并拒绝覆盖已有输出。`package.json` 中的 `private: true` 用于阻止误发 npm，不影响 GitHub 分发或 `npm pack`。

先核对制品，再把同一提交标记为 `v<版本>` 并创建 GitHub Release。不要把完整本地工作台或未脱敏的验证日志放入附件。

## 行为验证

当前人工集成验证范围见 [VERIFICATION.md](./VERIFICATION.md)。修改数据读取、鉴权或安装逻辑时，应在独立 Harness profile 和独立合成数据上验证：首次安装、已有配置保护、升级、失败回退、卸载保留数据，以及有权/无权请求。不要使用真实个人数据作为测试夹具。
