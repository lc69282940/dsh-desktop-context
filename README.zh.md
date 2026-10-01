# dsh-desktop-context

[English](<README.md>) · [版本记录](<CHANGELOG.md>)

**宿主端系统提示修正插件**：纠正 DeepSeek Harness 桌面端沿用的 Web 环境说明，修改的是实际系统提示组装结果，不是给聊天临时追加提醒。

**版本 0.1.0；已验证 Windows 桌面 DSH 0.2.0-rc.2；Node 24+；MIT。** 非官方插件，没有按钮、HTTP 接口、客户端脚本或自动浏览器，不修改应用归档，不替换共享核心服务。

## 修正内容

已验证版本的桌面宿主复用了 Web 启动层，默认 `app:web-surface` 把原生窗口描述成 Web GUI；`harness:source` 把 ASAR 内部虚拟路径说成普通源码目录。本插件通过官方 `system-prompt/assemble` 接口，替换这两个**已知模板**。

[提示正文](<prompts/desktop-surface.md>)明确要求模型：

- 默认面对现有 Electron 桌面，不因 Web/React 包名或 loopback 地址就打开 Edge/Chrome。
- ASAR 不是普通目录；提取镜像需核对当前归档，改镜像不等于改应用。
- 刷新 renderer 也可能打断当前 agent；任务运行中不擅自刷新/重启，必要时先保存工作并与用户约定空闲时机。
- 区分 profile 配置热更新、客户端交付文件、源码构建和宿主模块缓存。
- 用真实桌面、日志、配置、作用域和当前版本契约验收，不用理想 mock 代替实机证据。
- 轨迹缺失先查“显示代码工作视图”，不盲目重装或清空 profile。

安装路径和传输事实动态获取，不包含开发者的私人路径。

## 不会改变什么

- 只有真实进程入口属于 `dsh-desktop-host` 才启用，不靠 profile 名称或 DSH_WEB_URL 猜测。
- 真正的 Web/CLI 会话不受影响。
- 不改变工具、模型、权限、runtime context、persona 和无关系统段。
- 对升级后的未知模板、与原模板不同的自定义段保持不动。
- 用户刻意指定的 **complete prompt** 仍由官方最后恢复为完整提示；本插件不会强行插入。
- 只能保证注入内容被纠正，不能保证模型永远不误判。

兼容范围严格限定已验证 DSH 版本。路径解析有跨平台单元覆盖，不代表已在 macOS/Linux 桌面实测。可选 peer 仅为避免安装第二套宿主，不是绕过 Harness 兼容性检查。

## 安装

等任务全部结束，在**现有桌面端 → 插件 → 添加插件**填写 `dsh-desktop-context-0.1.0.tgz` 的完整路径；若管理器无法使用本地 tarball，可指定解包后的 package 目录。包文件应放在稳定目录，profile 可能持续引用它。

也可以先通过桌面原生菜单启用**该 Desktop 安装附带的 dsh 命令**，再运行：

```powershell
dsh plugin --profile desktop add "<dsh-desktop-context-0.1.0.tgz 的完整路径>"
```

不要改用另装 npm 版 dsh 管理桌面保留 profile，不需创建 Web/Vite 服务器。安装包已包含产物，无运行期依赖、无需编译或安装脚本。正常安装器会同时添加依赖、bundle 和宿主条目。

插件激活后，随后正常组装的系统提示开始生效，新会话及普通子会话也适用；已经发送的历史 prompt 不会被改写。如果安装器要求下次启动，等空闲再正常退出重开；插件本身不会刷新或重启。

从本地同名开发副本升级时，先备份并在空闲时卸载旧副本，再装新包，勿重复挂载两个实例。

## 诊断

默认位于 `$DSH_HOME/diagnostics/dsh-desktop-context/`；没有指定 DSH_HOME 时使用正常用户 `.dsh` 目录。安装包目录可以保持只读。

- `events.jsonl`：仅追加加载/组装元数据，相同组装状态去重；无总文件轮转限制，必要时在空闲时清理旧诊断。
- `last-assembly.json`：脱敏的模板匹配状态和元数据指纹，**不保存提示原文或私人路径**。
- `DSH_DESKTOP_CONTEXT_DIAGNOSTICS`、`DSH_DESKTOP_CONTEXT_EVIDENCE` 可覆盖完整输出文件路径。

组装记录只能证明 hook 执行。`agentContextPresent` 只表示上下文传入了 agent 字段，不证明模型已经收到请求或日志已经保存；complete prompt 也可能在其后覆盖最终文本。需要最终发送/落盘证明时，应独立只读检查，不把诊断状态扩大解释。

发布包不包含生产诊断或真实会话导出。

## 卸载与升级

使用插件管理器，或：

```powershell
dsh plugin --profile desktop remove dsh-desktop-context
```

卸载仅撤销组装 hook，后续步骤恢复官方提供的提示；不删会话或回滚用户设置。将来官方修复提示文案或升级契约后，应重新核验兼容性，不能只放宽版本范围。

## 源码测试与打包

```powershell
pnpm check
pnpm test
$env:DSH_TEST_RUNTIME_ROOT = '<已核对的可读 DSH runtime 根目录>'
pnpm test:runtime
pnpm test:all
pnpm pack --pack-destination ../../dist
```

单元测试只需 Node；运行时测试必须显式给出有 node_modules 的可读 runtime 根，不能把 ASAR 虚拟目录交给普通 Node。镜像使用前先与当前归档核验。测试运行在隔离进程，不创建模型请求，不操作真实用户会话。
