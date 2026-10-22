# 第三方项目与许可证

本仓库提供自行编写的 Harness 面板和接入脚本，不打包 Harness、Ruflo、React 或原生模块的可执行代码。运行时安装脚本根据 `runtime/package.json` 与锁文件从 npm 下载依赖；面板通过 Harness 加载其提供的 React 与界面接口。

| 项目 | 验证版本 | 项目链接 | 包声明的许可证 |
| --- | --- | --- | --- |
| DeepSeek Harness | 0.2.0-rc.2 | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | MIT |
| Ruflo | 3.59.13 | [ruvnet/claude-flow](https://github.com/ruvnet/claude-flow) | MIT |
| better-sqlite3 | 12.11.1 | [WiseLibs/better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT |
| ruvector | 0.2.41 | [ruvnet/ruvector](https://github.com/ruvnet/ruvector) | MIT |
| ruvector-core-linux-x64-gnu | 0.1.31 | [ruvnet/ruvector](https://github.com/ruvnet/ruvector) | MIT |

上表只列宿主和安装脚本直接指定的依赖，不代表全部传递依赖都采用 MIT。完整依赖与版本见锁文件；具体许可、版权和通知以下载的各包及上游项目内的文件为准。如自行再分发第三方程序，也需要保留它们要求的许可与通知。

截图来自隔离测试用的 Harness 界面。DeepSeek、Ruflo 及其他项目的名称、标识与商标属于其各自权利人，不表示这些项目为本插件背书。本仓库的 MIT 许可不授予第三方商标权。
