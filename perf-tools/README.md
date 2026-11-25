# 测试工具（电脑上跑《恶魔与精灵》COW8D 客户端）

用工程自带的 QA 微信宿主（`latest/qa/engine/instrumented-host.cjs`）加真实画布库，把 `client/` 原样跑起来做测量和回归。**只代表电脑上的相对对比，不代替 iPhone 真机验收。**

准备（只需一次，在本文件夹）：

```bash
npm install
```

建议都在断网沙盒里跑（和工程自带 `qa/smoke.sh` 一样）：`/usr/bin/sandbox-exec -f ../恶魔与精灵_COW8D优化/qa/network-closed.sb node <脚本> …`

| 脚本 | 做什么 | 用法 |
|---|---|---|
| `host.cjs` | 由 `patch-host.cjs` 从工程自带宿主生成：可设像素比、可改屏幕尺寸、统计存储写入/定时器/画布创建 | 被其它脚本引用 |
| `compare.cjs` | 同种子同操作，记录逐秒游戏状态和逐 2 秒整屏像素哈希；`--diff` 比较两次结果 | `node compare.cjs <client> out.json 7200`；`node compare.cjs --diff a.json b.json` |
| `profile.cjs` | 每帧耗时、像素量、绘制调用、离屏画布、内存分配、长帧归因、常驻图片/画布清单 | `ALLIES=8 IMMORTAL=1 CHECKS=300,600 [MOVE=1] [ALLOC=1] node --expose-gc profile.cjs <client> <输出目录>` |
| `walkline.cjs` | 连续走路 30 秒，统计每帧是否现画地形 | `node walkline.cjs <client> 标签` |
| `spikes.cjs` | 跳镜头、对局中内存警告、连开 3 局的内存 | `node --expose-gc spikes.cjs <client> out.json` |
| `wave10.cjs` | 第 9–11 波逐帧：耗时、分包加载、图片解码 | `node wave10.cjs <client> out.json` |
| `menuidle.cjs` | 暂停菜单空闲时每秒唤醒次数 | `node menuidle.cjs <client> 标签` |
| `fuzz.cjs` | 随机乱点试玩（含切后台、横竖屏、内存警告、存读档），收集报错 | `node fuzz.cjs <client> <输出目录> <种子> <电脑数> <帧数>` |
| `lifecycle.cjs` | 切后台续玩、存读档、横竖屏专项 | `node lifecycle.cjs <client> <输出目录>` |
| `calls.cjs`、`jumpprof.cjs`、`groundbench.cjs` | 方法调用次数、跳镜头长帧归因、地形块绘制分解 | 见文件头 |
| `pixdiff.cjs` | 两帧原始像素逐点比较并出差异图 | `node pixdiff.cjs a.rgba b.rgba 780 diff.png` |
| `edit.py` | 对压缩过的源码做“必须恰好匹配一次”的替换 | `python3 edit.py <文件> old.txt new.txt` |

说明：`IMMORTAL=1` 只为测试让精灵不死（否则空手不建房 6 分钟会被规则淘汰）；测得的毫秒数是 Mac 上 Skia 软件渲染的数，像素量、调用次数、分配量、是否现画地形这些不随机器变。

## 2026-11-25 新增（R12-PF2 这轮）

**确定性模式（做前后对比必须用）**：游戏里 Boss 等内容要等素材异步加载完才出场。不开这个模式时，加载完成的时刻随机器忙闲变化，同样操作跑两次局面会分叉。

- `VTIMERS=1`：游戏的 `setTimeout` 按游戏时钟触发（`host.cjs`）。
- `detgfx.cjs`：图片加载完成的通知只在固定帧统一发出（`updbench.cjs`、`longrun.cjs`、`compare.cjs` 已经在用）。

| 脚本 | 做什么 | 用法 |
|---|---|---|
| `updbench.cjs` | 只跑游戏逻辑：每分钟的逻辑耗时、地形碰撞查询次数、视线检测次数，以及结束时的完整状态指纹。指纹相同表示玩法结果完全一致 | `VTIMERS=1 node updbench.cjs <client> 720`；`PROF_FROM=540 PROF_OUT=x.cpuprofile` 抓后段 CPU 采样 |
| `longrun.cjs` | 整局逐帧（逻辑 + 绘制）：每秒的帧耗时、长帧数、镜头移动距离、当场现画的地形块数 | `VTIMERS=1 ALLIES=8 DIFF=crazy IMMORTAL=1 [CAM=busy] node --expose-gc longrun.cjs <client> out.json 720` |
| `compare.cjs` | 逐秒状态、整屏像素回归；新增 `DIFF`、`BUSY=1`（镜头看最热闹处）、`PIXEL_EVERY=30` | `VTIMERS=1 DIFF=crazy [BUSY=1 PIXEL_EVERY=30] node compare.cjs <client> out.json 7200`；`--diff a.json b.json` |
| `camtrace.cjs` | 谁在移动镜头（记录写镜头坐标的调用栈） | `AT=60 N=300 node camtrace.cjs <client> <outdir>` |
| `incl.py` / `callers.py` | 汇总 .cpuprofile：按函数的包含时间 / 某函数被谁调用 | `python3 incl.py x.cpuprofile`；`python3 callers.py x.cpuprofile '^函数名'` |

**WebKit测试/**：在 macOS 的 WKWebView 里跑整个游戏，和微信 iOS 高性能模式是同一个 WebKit 引擎。

1. 编译：`swiftc -O -import-objc-header trycatch.h runner.swift -o wkrun`
2. 起服务：`python3 serve.py 8766 www`。先在 `www/c/` 下建软链接，例如 `ln -s <client目录> www/c/r12`。
3. 运行：`[WK_NOACCEL=1] python3 cpurun.py "http://127.0.0.1:8766/index.html?client=r12&allies=8&diff=crazy&secs=60&immortal=1&cam=busy&det=1&ff=540&warm=5" out.json 1800`
   - `WK_NOACCEL=1`：关掉画布硬件加速，改用 CPU 画（推测更接近 iPhone 的情况）。
   - `det=1`：确定性模式。
   - `ff=秒`：先只跑逻辑快进到该时刻。
   - `phases=1`：按绘制阶段计时。
   - `scope=draw&primspy=1&primgroup=1`：逐次绘制调用计时。
   - `skip=函数名`：去掉某个绘制函数，看能省多少。
   - 输出里有每帧耗时、两个 WebKit 进程的 CPU 时间、结束时的状态指纹。
   - `menus=1`：每 900 帧（15 秒）在固定帧打开和关闭建造菜单、升级面板、暂停菜单。
   - `pixhash=30`：每 30 帧、以及每次菜单开关时，记一次整屏像素指纹。
   - `dumpf=4469,4589`：在这些帧把整屏 PNG 打印到输出里。
   - `tint=image|fill`：强制全屏遮罩用贴图或原画法，只用于测试。
   - `realprobe=1`：画布类型检测那几帧改用真实时钟；确定性模式下其余时间仍走游戏时钟。
   - `homeframes=60`：开局前先在首页跑 60 帧。真机上检测是在首页做完的；不加这个，确定性模式会直接开局，检测来不及做完。
   - 上面这些开关都在「首页就绪」之后才设置。更早读取 `host.env()` 会提前加载 runtime.js，游戏时钟的起点会偏移，整局像素都会不同。
   - **显卡画布（`WK_NOACCEL=0`）下像素不能稳定复现**：同一版本不同时间各跑一次，画面可能全部不同。证明像素一致请用 CPU 画布（`WK_NOACCEL=1`，多次运行完全可复现）和 Node。
4. 单独的小页面（直接用 `./wkrun "http://127.0.0.1:8766/<页面>" 300` 跑）：
   - `probe.html`：把画布类型检测连跑 10 次；
   - `probe2.html`：把计时做成「看起来是 CPU 画布」，专门测逐像素核对能不能拦住显卡画布；
   - `tint2.html` + `tintbench.js`：10 种遮罩颜色两种画法的逐像素比较和耗时；
   - `restore-check.html`：确认 `save()/restore()` 会还原 `imageSmoothingEnabled`。

`screen-tint.readable.js`：带完整注释的遮罩模块，内容和 `client/art163/screen-tint.js` 相同，那边只是去掉了注释和缩进。
