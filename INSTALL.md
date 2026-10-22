# 安装与使用

以下命令在 **Linux 或 WSL Ubuntu** 的终端中执行。先解压安装包并进入其目录。所有 `node` 命令都应使用同一个 Node.js 24+；若工作台使用独立 Node，请将 `node` 替换为那个程序的绝对路径。

## 0. 获取插件

在 [GitHub Releases](https://github.com/zjun96472-blip/dsh-ruflo-panel/releases/latest) 下载 `dsh-ruflo-panel-0.2.0.zip` 或 `.tgz`，同时下载 `SHA256SUMS.txt`。自动生成的 “Source code” 是整个仓库源码，命名下载包是按发布清单打包的安装文件。

例如，在新的空目录内下载并校验 TGZ：

```bash
curl -fLO https://github.com/zjun96472-blip/dsh-ruflo-panel/releases/download/v0.2.0/dsh-ruflo-panel-0.2.0.tgz
curl -fLO https://github.com/zjun96472-blip/dsh-ruflo-panel/releases/download/v0.2.0/SHA256SUMS.txt
sha256sum --check --ignore-missing SHA256SUMS.txt
tar -xzf dsh-ruflo-panel-0.2.0.tgz
cd package
```

校验应显示 `.tgz: OK`（或本地语言的成功提示），再执行安装。ZIP 解压后的目录为 `dsh-ruflo-panel-0.2.0/`；两种压缩格式包含相同文件。

也可使用 `git clone --branch v0.2.0 https://github.com/zjun96472-blip/dsh-ruflo-panel.git`，然后 `cd dsh-ruflo-panel`。

## 1. 准备 Ruflo

已有 Ruflo 3.59.13 的用户可以跳到第 2 步。新用户先安装构建依赖（Ubuntu）：

```bash
sudo apt-get install build-essential python3
node scripts/setup-ruflo.mjs
```

默认运行时安装在 `$HOME/.local/share/ruflo-harness/runtime`，按附带锁文件安装，不修改全局 npm 包。

也可指定独立的新目录：

```bash
node scripts/setup-ruflo.mjs --dir "/path/to/private/ruflo-runtime"
```

此步骤需要 npm 网络访问和磁盘空间。安装器不会覆盖未知目录；中断后可运行同一命令继续。

## 2. 找到两个 Harness 路径

- `--profile`：当前使用的 profile，例如 `/path/to/data/profiles/web`。目录里应已有 `package.json` 和 Harness 配置。
- `--dsh`：当前安装的 `@deepseek-ai/dsh/lib/bin.js` 文件。

应先正常安装并启动过 Harness web，再向它添加插件。不要把另一台电脑的 profile、模型配置或数据目录整体复制过来。

预览安装，不改动 profile：

```bash
node scripts/install.mjs \
  --profile "/path/to/data/profiles/web" \
  --dsh "/path/to/node_modules/@deepseek-ai/dsh/lib/bin.js"
```

确认显示的目录正确，暂停正在运行的任务并用原方式停止工作台，然后加 `--apply`：

```bash
node scripts/install.mjs \
  --profile "/path/to/data/profiles/web" \
  --dsh "/path/to/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  --apply
```

默认工作区为 `$HOME/.local/share/ruflo-harness/workspace`，第一次应用时自动创建。模型密钥由已有 Harness 配置管理；安装器不复制或设置模型密钥。

## 3. 已有 Ruflo 的接入方式

用 `--ruflo` 指向 **包含 Ruflo package.json 的包目录**，不是运行时父目录；`--workspace` 指向要看的真实数据目录：

```bash
node scripts/install.mjs \
  --profile "/path/to/data/profiles/web" \
  --dsh "/path/to/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  --ruflo "/path/to/ruflo-runtime/node_modules/ruflo" \
  --workspace "/path/to/ruflo-data" \
  --server-name ruflo \
  --apply
```

可选参数 `--node /path/to/node` 指定服务运行用的 Node；`--memory-database .swarm/agentdb-memory.db` 指定工作区内的记忆数据库相对路径。路径包含空格或中文时保留双引号。

安装器将添加两个全局插件：官方 `mcp-ruflo` 和图形页 `ruflo-panel`。若已有同名配置或不受此安装器管理的面板目录，会停止并保留原状；请手动备份、迁移原配置，避免创建两个同名 MCP 连接。

## 4. 启动与检查

按原来的方式启动 Harness，重新打开带登录权限的工作台地址，点击左侧 **Ruflo**。面板中的工具数量来自 Harness 实际注册状态。

也可单独检查 MCP 握手和工具列表（不调用模型、不创建记录）：

```bash
node scripts/probe.mjs --workspace "/path/to/ruflo-data" \
  --ruflo "/path/to/ruflo-runtime/node_modules/ruflo"
```

在聊天中试一句：

> 请使用 Ruflo 的任务工具，创建一个任务：整理我的个人工作台待办。只创建记录，暂不执行。

创建后在面板刷新即可看到。新安装不会带入其他人的演示任务或记忆。

## 失败与回退

安装器把改前配置、升级前插件和离线校验结果保存在 profile 的 `.ruflo-panel-backups/` 下；这些本地备份可能含您已有的模型配置，**不要放进分享包**。

离线校验失败时自动还原本次改动。若检测到同时有人编辑配置，安装器停止覆盖，并报告恢复资料的位置。

离线校验不能替代实际启动检查。若插件启动失败，运行卸载器移除本次接入，再按原方式启动工作台；不会删掉数据。

```bash
node scripts/uninstall.mjs --profile "/path/to/data/profiles/web" --apply
```

不要用旧备份覆盖之后新增的其他配置，也不要对工作台执行整库 reset/clean。
