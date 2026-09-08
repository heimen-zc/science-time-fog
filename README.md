# 答案诞生之前

一个从现代出发、穿过“时间迷雾”重做关键科学实验的互动科普 Demo。

当前主线任务是法拉第 1831 年电磁感应实验。玩家需要先选择猜想，再操作感应环装置、收集三条实验现象，并在“科学法庭”中用证据击败无法解释全部现象的旧理论。

## 当前体验

- 从现代科学世界进入历史坐标
- 科学发展时间地图与知识恢复度
- 实验前猜想与阵营选择
- 感应环、开关和检流计互动
- 证据背包与理论解释力战斗
- XP、升级、记忆锚点和下一关预告
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

## 后续路线

1. 氧气、燃素说与拉瓦锡的定量革命
2. 卢瑟福散射实验与原子核
3. 光的干涉与波粒之争
4. 门捷列夫元素周期表与未知元素
5. 科学人物、史料卡片和跨章节知识树

## 史实资料

- [英国皇家研究院：法拉第感应环原始装置](https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus)
- [MIT OpenCourseWare：法拉第定律](https://ocw.mit.edu/courses/8-02x-physics-ii-electricity-magnetism-with-an-experimental-focus-spring-2005/)
- [美国化学会：氧气的发现](https://www.acs.org/education/whatischemistry/landmarks/josephpriestleyoxygen.html)

历史场景经过叙事化处理；可验证事实、现代解释与互动旁白会保持明确区分。
