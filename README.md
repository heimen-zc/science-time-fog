# 答案诞生之前

一个从现代出发、穿过“时间迷雾”重做关键科学实验的互动科普 Demo。

当前主线任务是法拉第 1831 年电磁感应实验。玩家从一台可以亲手操作的装置开始，观察异常、保存零结果、只改变一个条件做对照；熟悉之后再进入完整实验室，自由检验猜想，最后用自己做出的证据参加“科学法庭”。

## 直接操作的动画实验

首页可直接进入“只动一下的指针”。首屏只突出一个可操作节点：合上开关，观察指针回零，再抬起开关。完成观察后，拖动或依次点击两张记录叠放曲线；再只反转电池，做一组其他条件不变的对照。

仪器在完整观察窗口结束后保存记录。示范、暂停、慢放及原理回放均不产生额外证据；收齐六条观察后才解锁现代磁场示意。完成的观察会接入已有实验日志，自动闭合前两项调查，再继续磁铁与线圈实验、科学质询和历史档案。

- 装置是可以直接响应点击、拖动和键盘操作的 HTML/SVG 动画。
- 手机支持点击代替拖动，操作热点保持足够大小。
- 一套纯模型同时驱动磁通量、感应电动势、指针和记录；模型保留 `e = -dΦ/dt` 的关系，但使用无量纲相对刻度并放慢瞬态，不用于定量测量。
- 只在用户操作后运行实验；离开屏幕或隐藏标签页时暂停，支持减少动态效果的系统设置。
- 可用 `?lab=induction` 直接打开本关。

科学模型位于 `lib/induction-model.ts`，交互场景位于 `components/induction-discovery.tsx`。插画从 `scripts/induction-art/build.mjs` 生成并进行几何检查，前端只读取预计算的矢量路径。绘图工具沿用 Anatomy 的 MIT 授权代码。

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

其中 `npm test` 验证稳态零信号、通断与极性反向、磁通量与感应电动势的一致性，以及证据闭合条件。GitHub Pages 发布流程会执行这些检查。

推送到 `main` 分支后，GitHub Actions 会构建静态版本并发布到 GitHub Pages。首次发布时需要在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

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
