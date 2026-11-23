# 测试工具（电脑上跑《恶魔与精灵》COW8D 客户端）

用工程自带的 QA 微信宿主（`latest/qa/engine/instrumented-host.cjs`）加真实画布库，把 `client/` 原样跑起来做测量和回归。**只代表电脑上的相对对比，不代替 iPhone 真机验收。**

准备（只需一次，在本文件夹）：

```bash
npm install
```

建议都在断网沙盒里跑（和工程自带 `qa/smoke.sh` 一样）：`/usr/bin/sandbox-exec -f ../qa/network-closed.sb node <脚本> …`

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
