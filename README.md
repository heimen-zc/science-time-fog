# 答案诞生之前

一个从现代出发、穿过“时间迷雾”重做关键科学实验的互动科普 Demo。

当前主线任务是法拉第 1831 年电磁感应实验。玩家不是去寻找预设答案，而是先留下一个可被推翻的猜想，再自由改变装置条件、记录现象，最后用自己做出的对照实验参加“科学法庭”。

## 当前体验

- 从现代科学世界进入历史坐标
- 科学发展时间地图与知识恢复度
- 实验前猜想、信心值与事后修正
- 感应环和磁铁线圈两套可操作装置
- 通断电、极性、铁芯、线圈匝数、电池数量和运动速度等变量
- 面向初学者的四段主线引导，并可随时切换完整自由实验室
- 可点击的证据槽、变量锁定、“复制实验”和逐级求助
- 法拉第、雾灯助手与时间迷雾根据玩家行动实时切换的剧情对白
- 拖动导线、按住观察，以及支持拖拽和点击的三时刻证据链
- 科学质询中的分步配对、候选证据标记与逐变量错误说明
- 每次实验后即时显示改变与保持不变的条件
- 自动生成实验日志，但不替玩家下结论
- 必须依靠成组对照实验击破旧解释的“科学法庭”
- 法拉第真实发现路径、玩家发现路径与科学共同体三种档案视图
- 每份史料明确标注“能支持什么”和“不能单独证明什么”
- XP、能力解锁和下一关预告
- 手机、平板和桌面端响应式布局
- 进度仅保存在浏览器本机，不收集个人信息

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 检查与构建

```bash
npm run check
```

推送到 `main` 分支后，GitHub Actions 会构建静态版本并发布到 GitHub Pages。首次发布时需要在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

## 实验操作视频

已接入 Agnes 官方异步视频 API，模型为 `agnes-video-2.5-flash`。按[官方文档](https://agnes-ai.com/zh-Hans/docs/agnes-video-25-flash)约束，每段使用 12 秒、`720P`、`16:9`、纯文本模式，共三段，合成为 36 秒的演示。分镜和提示词位于 `content/faraday-video.json`。

1. 先认识铁环上的两组独立回路。
2. 接通并继续保持，比较瞬间信号与稳定状态。
3. 断开并比较方向，用现代磁场概念解释现象。

```bash
npm run video:plan
npm run video:generate
```

生成命令会提示输入 API Key，输入内容不会回显。也支持从本机进程环境的 `AGNES_API_KEY` 读取。密钥不写入任何项目文件，不使用 `NEXT_PUBLIC_` 变量，浏览器只播放已经生成的静态视频，不直接调用收费 API。

创建任务后，视频 ID 与状态保存在被 Git 忽略的 `work/agnes-faraday/jobs.json`。中断后使用 `npm run video:wait` 继续查询；已有分镜不会重复创建。只有明确的 `video_queue_full` 响应会间隔 45 秒重试，最多 15 次；超时等结果不确定的请求不会自动重做。生成失败也不会自动切换模型或付费重试。`npm run video:diagnose` 只读检查密钥与模型列表。

定时续作可以设置 `AGNES_QUEUE_RETRIES=0`，让每次唤醒只尝试创建一次；队列仍满时留待下次唤醒，避免密集请求。用户选择继续等待 Flash，不切换标准版。

拿到三段真实视频后，执行：

```bash
npm run video:render
```

后期脚本需要本机 `ffmpeg`（可通过 `FFMPEG_PATH` 指定）与 macOS 已安装的 `Tingting` 中文语音，用于添加逐句对齐的旁白、中文字幕和章节标题。它会核验源片与成片时长、解码成片，生成 MP4、WebP 封面、VTT 字幕与去除临时下载链接的来源说明。字幕是后期制作，避免依赖模型生成准确的中文文字。

前端由 `content/faraday-video-asset.json` 的 `ready` 控制入口。只有真实素材完成后期并通过校验，脚本才将其设为 `true`；没有视频文件时不显示空播放器。视频就绪后，首页出现“先看 36 秒实验演示”，首次进入实验台先显示视频向导，也可通过 `?demo=faraday` 直达。观看不会添加实验记录或自动通过调查。

AI 视频是教学重现，并非历史录像或实验数据。发布前应人工检查两组回路的隔离、开关动作与指针的时序；偏转方向的左右取决于具体接线，重点是接通与断开的相对方向。

## 设计目标

结论不是章节的终点。Demo 更看重五种可迁移的科学能力：精确观察、控制变量、重复检验、排除替代解释，以及知道模型的适用边界。

## 后续路线

1. 氧气、燃素说与拉瓦锡的定量革命
2. 卢瑟福散射实验与原子核
3. 光的干涉与波粒之争
4. 门捷列夫元素周期表与未知元素
5. 科学人物、史料卡片和跨章节知识树

## 史实资料

- [英国皇家研究院：法拉第感应环原始装置](https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus)
- [英国皇家研究院：法拉第发电机](https://www.rigb.org/explore-science/explore/collection/michael-faradays-generator)
- [英国皇家学会：1831 年论文手稿](https://makingscience.royalsociety.org/items/pt_20_4/paper-experimental-researches-in-electricity-by-m-michael-faraday)
- [《法拉第日记》预览档案](https://faradaysdiary.com/ws3/faraday.pdf)
- [Project Gutenberg：Experimental Researches in Electricity](https://www.gutenberg.org/files/14986/14986-h/14986-h.htm)
- [MIT OpenCourseWare：法拉第定律](https://ocw.mit.edu/courses/8-02x-physics-ii-electricity-magnetism-with-an-experimental-focus-spring-2005/)
- [美国化学会：氧气的发现](https://www.acs.org/education/whatischemistry/landmarks/josephpriestleyoxygen.html)

历史场景经过叙事化处理；可验证事实、现代解释与互动旁白会保持明确区分。
