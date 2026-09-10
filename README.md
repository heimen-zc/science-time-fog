# 答案诞生之前

一个从现代出发、穿过“时间迷雾”重做关键科学实验的互动科普 Demo。

当前主线任务是法拉第 1831 年电磁感应实验。玩家不是去寻找预设答案，而是先留下一个可被推翻的猜想，再自由改变装置条件、记录现象，最后用自己做出的对照实验参加“科学法庭”。

## 当前体验

- 从现代科学世界进入历史坐标
- 科学发展时间地图与知识恢复度
- 实验前猜想、信心值与事后修正
- 感应环和磁铁线圈两套可操作装置
- 通断电、极性、铁芯、线圈匝数、电池数量和运动速度等变量
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
