# 恶魔与精灵（微信小游戏）· COW8D-PF1 接手仓库

公开仓库，不用登录就能克隆或下载。给接手的 AI（Codex 等）和开发者继续改用。

- 克隆：`git clone https://github.com/wuxian1016/demon-and-elves.git`
- 只下载最新版压缩包（不用 git）：<https://github.com/wuxian1016/demon-and-elves/archive/refs/heads/main.zip>

## 这是什么

| 标签 | 内容 |
|---|---|
| `cow8d` | 原版底稿：COW8D 官方测试预览工程（`BN19R10-C3-REBUILT-P0-COW8D`），从交接站 <https://demon-and-elves-cow8d-handoff.whxh1987.chatgpt.site/> 下载，两卷分片和 1,440 个文件都已核对 SHA-256，原样提交，没有任何修改。 |
| `cow8d-pf1` | 当前版本 COW8D-PF1：针对手机发热、长帧、内存做的修改候选。改了 7 个文件（4 个性能修复 + 3 处版本标签）。在电脑测试环境里，与原版逐帧画面像素、逐秒游戏状态完全一致。**还没有在 iPhone 上验收。** |

看全部改动：`git diff cow8d cow8d-pf1 -- client`

## 目录

- `client/`：完整小游戏工程，可直接导入微信开发者工具（AppID `wxe6064709895531ce`，`compileType: game`）。首页左上角显示「COW8D-PF1 · 单人测试 · …」。
- `qa/`：交接包自带测试，`bash qa/smoke.sh`（共 22 项）。
- `handoff/`：原交接包的说明。重点是 `START-HERE.md`、`docs/01-问题账本.md`（待办与验收）、`docs/02-玩法与定稿素材.md`（不可擅改的数值和素材）、`PERFORMANCE-PLAN.md`（真机验收方法）。
- `perf-report/`：`检查与优化报告.md`（发热原因、bug 检查、改了什么、前后对比、待决定事项）、`COW8D-修改候选.patch`、`数据/`（全部测量原始数据）、`截图/`。
- `perf-tools/`：在电脑上运行本游戏做测量和逐帧回归的脚本，用法见 `perf-tools/README.md`。
- `source.sha256.cow8d`、`source.sha256.pf1`：两版 `client/` 的文件清单（在 `client/` 里执行 `shasum -a 256 -c`）。

报告第 8 节写的是作者本机的文件夹，对应关系：`恶魔与精灵_COW8D优化/client` → `client/`，`报告/` → `perf-report/`，`测试工具/` → `perf-tools/`。

## 接手先做

1. 校验：`cd client && shasum -a 256 -c ../source.sha256.pf1`，应 1,440 行全部 OK（清单 SHA-256 `1dbfaef420163b28651ed478be9aa9289821f7c3199f49d1aee2cfc54647a15f`）。
2. 依次读 `perf-report/检查与优化报告.md`、`handoff/START-HERE.md`、`handoff/docs/01-问题账本.md`。
3. 准备测试环境：在 `perf-tools/` 里 `npm install`。在仓库根目录跑 `NODE_PATH="$PWD/perf-tools/node_modules" bash qa/smoke.sh`（macOS 上它会自己进断网沙盒）。
4. 每次改动都和改前版本对比：`perf-tools/compare.cjs` 记录同种子、同操作下的逐秒状态和逐帧像素，`--diff` 比较两次结果。

## PF1 改了什么

| 代码 | 文件 | 改动 |
|---|---|---|
| L1 | `client/js/main.js` | 镜头跳转时缺的地形块直接画进缓存，不再画两遍（跳转后几帧 8–12 ms → 4.4–6.7 ms，Mac） |
| L2 | `client/network/ordinary-building-grid.js` | `zoneAt` 先用平方距离排除远处区域，再加 16 条记忆（只在对局中启用，区域位置一变就清空），结果不变 |
| L3 | `client/art163/terrain-edge-prefetch.js`、`client/js/main.js` | 地形预取改成屏幕外一圈：按移动方向就近，每块分 2–4 条带分帧画（像素相同），内存警告后不再停；地形缓存 12 → 16 MB（+4 MB）。走路时现画地形的帧 200 → 1 |
| H2 | `client/runtime.js`、`client/js/main.js` | 暂停/菜单/结算页没变化时不再每帧唤醒（约 57 → 6 次/秒）；触摸、`wake()` 或 `wxUiDirty=true` 立刻恢复 |
| G1 | `client/js/main.js` | 敌人空间网格 `hostilesNear200` 改用数字键，少产生垃圾 |
| G3 | `client/js/main.js` | `allyWorkPointSafe` 不再复制敌人列表、不再为每个敌人新建闭包，判断顺序不变 |
| H1 | `client/js/main.js` | 实验，默认关闭：树/矿层和建筑层只贴有内容的格子（像素相同，少混合 14–21% 像素，但在 Skia 上反而慢）。真机 A/B：在 `client/game-startup.js` 的 `const env=require('./runtime');` 后面加 `env.window.sparseLayerBlitBN=true;` |
| 标签 | `client/single-player-build.js`、`client/asset-config.js`、`client/release.json` | 版本标签改为 `COW8D-PF1` / `BN19R10-C3-REBUILT-P0-COW8D-PF1`，只改文字 |

代码里每处改动都有 `PERF-` 注释。地形预取的计数器在 `game.terrainTiles200.prefStatsBN`，可在调试时查看。

## 用户定的硬要求（必须遵守）

- 目标：稳 60 帧，不卡顿、不掉帧、没有长帧，不明显发热，全程不出现内存警告。
- 严禁用降低画质、限制帧率、删特效或玩法来换性能；严禁把解码停顿挪到首次操作或回前台时。
- 不擅改已定数值和定稿素材（`handoff/docs/02-玩法与定稿素材.md`）。改素材的加载时机或分辨率，先问用户。
- 纯性能改动必须证明画面像素和游戏状态与改前一致；有变化就写清楚变了什么。
- 没在 iPhone 上测过的指标不能说达标。真机按 `handoff/PERFORMANCE-PLAN.md` 做同机对比。

## 待办（按优先级）

1. 真机对比 COW8D 与 PF1：同一台 iPhone，单人中等 + 8 电脑，30 分钟，记录帧时间、内存警告次数、温度和耗电。
2. 内存：大图快用到时提前在后台加载。可省的有机器人图集 19.4 MB、加农炮 6 MB、防空/捕网 2–3 级 15.4 MB、蝙蝠动画约 28 MB。这会改变加载时机，用户还没批准，动手前先问。
3. H1 实验开关做真机 A/B。
4. 首页火把只重画局部；镜头跳到没去过的远处，首帧仍约 75 ms（Mac）。
5. 联机发热：确认 iOS 高性能模式下 `connectContainer` 断开后是否退回每 500 ms 一次的 `callContainer` 轮询。

## 注意

- `client/js/main.js` 第一行注释说它由 `build-wechat125.cjs` 从共享 `js/` 源码生成，但交接包里没有那份源码。PF1 直接改的是 `client/`（与交接文档的做法一致）。以后如果拿到共享源码，要把 PF1 的改动移植过去，否则重新生成会把它们覆盖。
- 测试和预览不要读写真实存档，也不要打开真实广告。命令行出预览码前，要在微信开发者工具里打开「设置 › 安全设置 › 服务端口」。
- 原交接包里的沟通记录（8,607 条）、取证图片、游戏开发 Skill 和只读 MCP 没有放进本仓库，到原交接站获取。
