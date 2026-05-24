# Visualizing Molecular Point Groups

基于 Vue 3 + Vite + Three.js + Electron 的分子点群可视化应用。

## 版本信息

- 当前版本：`V1.0.0`

## 作者

- Lequan Wang
- Haibei Li

## 主要功能

- `Symmetry Elements`：展示分子对称元素与对称操作动画。
- `Point Group Flowchart`：通过流程图辅助点群判定，并联动代表分子结构。
- `Quiz`：随机分子点群测验，支持答案校验与统计。

## 技术栈

- `Vue 3`
- `Vue Router`
- `Vite`
- `Three.js`
- `KaTeX`
- `Electron`

## 项目结构

```text
src/
  components/
  pages/
  data/
  utils/
  router.js
  main.js
electron/
calculations/
```

## 开发说明

当前项目可构建 Web 版本，也可打包为 Windows 便携版（`.exe`）。

### 环境要求

- `Node.js >= 18`
- `npm >= 9`

### 安装依赖

```bash
npm install
```

### 本地开发（Web）

```bash
npm run dev
```

### 本地开发（桌面联调）

```bash
npm run dev:desktop
```

### 构建 Web

```bash
npm run build
```

### 打包 Windows 便携版

```bash
npm run build:desktop
```