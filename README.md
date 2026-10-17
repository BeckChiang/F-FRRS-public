# F-FRRS 项目文档 / F-FRRS Project Documentation

> **中英双语完整代码注释文档**  
> **Bilingual Complete Code Annotation Document**

---

## 目录 / Table of Contents

- [1. 项目概览 / Project Overview](#1-项目概览--project-overview)
- [2. 快速开始 / Quick Start](#2-快速开始--quick-start)
- [3. 目录结构 / Directory Structure](#3-目录结构--directory-structure)
- [4. 核心概念 / Core Concepts](#4-核心概念--core-concepts)
- [5. 数据格式 / Data Format](#5-数据格式--data-format)
- [6. 模块详解 / Module Reference](#6-模块详解--module-reference)
- [7. 关键算法 / Key Algorithms](#7-关键算法--key-algorithms)
- [8. UI 交互 / UI Interactions](#8-ui-交互--ui-interactions)
- [9. 快捷键 / Keyboard Shortcuts](#9-快捷键--keyboard-shortcuts)
- [10. 国际化 / Internationalization](#10-国际化--internationalization)
- [附录 A：模块依赖关系 / Appendix A](#附录-a模块依赖关系--appendix-a-module-dependencies)
- [附录 B：常见问题 / Appendix B](#附录-b常见问题--appendix-b-faq)

---

## 1. 项目概览 / Project Overview

### 中文

**F-FRRS**（Fractal-Frrs）是一个基于 **Three.js** 的 **3D 机构可视化编辑器**。它用于构建、编辑、连接、可视化由 **L 形零件**（L1 蓝色 / L2 红色）组成的立方体机构，并支持机构之间的平面连接形成拓扑网络。

**主要功能**：

- 🏗️ **机构生成**：可视化参数化生成立方体机构，包含 L1/L2 双 L 零件与中心轴
- 🔗 **平面连接**：通过选择任意两个平面建立物理连接约束
- 🗺️ **拓扑可视化**：力导向布局绘制机构连接图，自动检测回环
- 📊 **连接矩阵**：移植自 MATLAB 的整数连接矩阵构建算法
- ⚡ **动画过渡**：所有变换（平移、旋转、L 角度）支持平滑动画
- 🔒 **约束系统**：自动处理双环锁定、基准平面锁定、链条级锁定
- 💾 **导入导出**：JSON 格式，支持法向量反算和连接矩阵嵌入
- 🌐 **中英双语**：完整国际化支持
- 🎨 **明暗主题**：深色/浅色一键切换
- 📸 **高清截图**：最高 8K 分辨率离屏渲染

### English

**F-FRRS** (Fractal-Frrs) is a **3D mechanism visualization editor** built on **Three.js**. It is used to construct, edit, connect, and visualize cubic mechanisms composed of **L-shaped parts** (L1 blue / L2 red), supporting planar connections between mechanisms to form topological networks.

**Key Features**:

- 🏗️ **Mechanism Generation**: Parametric generation of cubic mechanisms containing L1/L2 L-parts and central axis
- 🔗 **Planar Connections**: Establish physical constraints by selecting any two planes
- 🗺️ **Topology Visualization**: Force-directed layout of connection graph with automatic cycle detection
- 📊 **Connection Matrix**: Integer connection matrix algorithm ported from MATLAB
- ⚡ **Animated Transitions**: All transformations (translation, rotation, L angle) support smooth animation
- 🔒 **Constraint System**: Automatic handling of double-loop locking, base plane locking, chain-level locking
- 💾 **Import/Export**: JSON format with normal-vector back-calculation and embedded connection matrix
- 🌐 **Bilingual**: Complete i18n support
- 🎨 **Light/Dark Theme**: One-click theme switching
- 📸 **High-Resolution Screenshots**: Up to 8K offscreen rendering

---

## 2. 快速开始 / Quick Start

### 中文

**依赖**：

- Python 3（仅用于本地 HTTP 服务；也可用 `npx serve` 等任意静态服务器替代）
- 现代浏览器（Chrome 86+ / Edge 86+ / Firefox 90+）
- **无需外网**：Three.js v0.160.0 已内置于 `vendor/` 目录，完全离线可用

**运行**：

```bash
# Windows：双击 start.bat

# 或手动（跨平台）
python -m http.server 8080
# 然后浏览器访问 http://localhost:8080

# Node.js 环境也可用
npx serve .
```

> 注意：平台使用 ES Modules，浏览器仅允许通过 HTTP(S) 加载，直接双击 `index.html`（file:// 协议）无法运行。

**目录要求**：

```
F-FRRS/
├── index.html
├── start.bat
├── readme.txt
├── vendor/                  # Three.js v0.160.0（本地化，离线可用）
└── src/
    ├── core/
    ├── renderer/
    ├── ui/
    ├── utils/
    └── main.js
```

`Sample_Mechanisms/`（示例机构 JSON，可选）可与平台放在同一目录下，通过界面的导入功能加载。

### English

**Requirements**:

- Python 3 (only for the local HTTP server; any static file server such as `npx serve` works too)
- Modern browser (Chrome 86+ / Edge 86+ / Firefox 90+)
- **No internet required**: Three.js v0.160.0 is bundled in `vendor/` and runs fully offline

**Run**:

```bash
# Windows: double-click start.bat

# Or manually (cross-platform)
python -m http.server 8080
# Then open http://localhost:8080 in a browser

# With Node.js:
npx serve .
```

> Note: the platform uses ES Modules, which browsers only load over HTTP(S); opening `index.html` directly via `file://` will not work.

---

## 3. 目录结构 / Directory Structure

```
F-FRRS/
├── index.html                          # 主页面 / Main page (HTML + CSS + importmap)
├── start.bat                           # Windows 启动脚本 / Windows launcher
├── readme.txt                          # 简要说明 / Brief readme
├── vendor/                             # Three.js v0.160.0 本地化依赖 / Vendored Three.js
│   ├── three.module.js                 # 核心库 / Core library
│   └── OrbitControls.js                # 相机控制器 / Camera controls
├── Sample_Mechanisms/                  # 示例机构 / Sample mechanism JSON files
│   ├── robot_state_*.json              # 各示例机构 / Individual mechanisms
│   └── robotic_arm_sequence/           # 机械臂 19 步装配序列 / Robotic-arm assembly sequence
└── src/
    ├── main.js                         # 入口 / Entry point
    ├── core/                           # 核心数据模型 / Core data models
    │   ├── AppState.js                 # 全局状态 / Global state
    │   ├── Mechanism.js                # 机构实体 / Mechanism entity
    │   ├── Connection.js               # 连接实体 / Connection entity
    │   └── History.js                  # 撤销/重做 / Undo/Redo stack
    ├── renderer/                       # 渲染层 / Rendering layer
    │   ├── SceneManager.js             # 场景/相机/控制器 / Scene/Camera/Controls
    │   ├── TopologyRenderer.js         # 拓扑图绘制 / Topology canvas
    │   ├── ConnectionMatrixRenderer.js # 连接矩阵绘制 / Matrix canvas
    │   └── Screenshot.js               # 离屏截图 / Offscreen screenshot
    ├── ui/                             # UI 层 / UI layer
    │   ├── PanelManager.js             # 面板切换 / Panel switching
    │   ├── UIBinder.js                 # DOM 事件绑定 / DOM event binding
    │   └── Notification.js             # 通知系统 / Notification system
    └── utils/                          # 工具函数 / Utilities
        ├── GeometryUtils.js            # 几何创建/反算 / Geometry creation & inversion
        ├── AnimationUtils.js           # 缓动函数/Tween / Easing & Tween
        ├── ConnectionMatrix.js         # 连接矩阵算法 / Connection matrix algorithm
        ├── Renumber.js                 # 重新编号算法 / Renumbering algorithm
        └── i18n.js                     # 国际化 / i18n
```

### 3.1 加载示例机构 / Loading Sample Mechanisms

**中文**：`Sample_Mechanisms/` 目录包含论文中用到的示例机构（全英文文件名）。启动平台后，通过"生成"面板的导入按钮（或快捷键 `Ctrl+O`）选择任一 `robot_state_*.json` 即可加载。机械臂装配序列（`robotic_arm_sequence/`，`Robotic_arm_0.json` 至 `Robotic_arm_end.json`）请按编号顺序依次导入。

**English**: `Sample_Mechanisms/` contains the mechanism examples used in the paper (English file names). After starting the platform, load any `robot_state_*.json` via the import button in the "Generate" panel (or `Ctrl+O`). For the robotic-arm assembly sequence (`robotic_arm_sequence/`, `Robotic_arm_0.json` … `Robotic_arm_end.json`), import the files in numbered order.

---

## 4. 核心概念 / Core Concepts

### 4.1 机构 / Mechanism

**中文**

每个**机构**是一个边长为 `cubeSize` 的立方体，包含：

- **L1 零件**（蓝色）：由两块平板组成，围绕机构中心 Z 轴旋转 `l1Angle`
  - 平面 1（底面）：法向量方向 `-Z`
  - 平面 2（右面）：法向量方向 `+X`
- **L2 零件**（红色）：同上，旋转 `l2Angle`
  - 平面 3（顶面）：法向量方向 `+Z`
  - 平面 4（左面）：法向量方向 `-X`
- **中心轴**：半径 `axisRadius`，长度 `armSize`
- **位置**：世界坐标 `position`
- **世界旋转**：`worldRotation`（XYZ 欧拉角）

**L 零件参数约束**：

```
armSize    = cubeSize - 2 * thickness      （L 边长）
axisRadius = cubeSize / 8                  （轴半径）
```

**圆角规则**（固定，不可配）：

- L1：左上、左下圆角；右上、右下直角
- L2：右上、右下圆角；左上、左下直角

**English**

Each **mechanism** is a cube of side length `cubeSize`, comprising:

- **L1 part** (blue): Two plates, rotated around the mechanism's local Z axis by `l1Angle`
  - Plane 1 (bottom): normal direction `-Z`
  - Plane 2 (right): normal direction `+X`
- **L2 part** (red): Same, rotated by `l2Angle`
  - Plane 3 (top): normal direction `+Z`
  - Plane 4 (left): normal direction `-X`
- **Central axis**: Radius `axisRadius`, length `armSize`
- **Position**: World coordinates `position`
- **World rotation**: `worldRotation` (XYZ Euler angles)

**L-part parameter constraints**:

```
armSize    = cubeSize - 2 * thickness      (L side length)
axisRadius = cubeSize / 8                  (axis radius)
```

**Rounded corner rules** (fixed, not configurable):

- L1: top-left, bottom-left rounded; top-right, bottom-right square
- L2: top-right, bottom-right rounded; top-left, bottom-left square

---

### 4.2 平面索引 / Plane Indices

| 索引 / Index | 零件 / Part | 名称 / Name | 法向量 / Normal |
|:---:|:---:|:---:|:---:|
| 1 | L1 | 底面 / Bottom | `-Z` |
| 2 | L1 | 右面 / Right | `+X` |
| 3 | L2 | 顶面 / Top | `+Z` |
| 4 | L2 | 左面 / Left | `-X` |

---

### 4.3 基准平面 / Base Plane

**中文**

**基准平面**是一个无限大的虚拟平面（位于 `z=0`），有特殊的哨兵索引：

- `mechanismIndex = -1`（区别于真实机构）
- `planeIndex = 1`（固定）
- 导出时映射为机构 ID `0`

**作用**：作为"地面"或"世界坐标系"，可用于将机构锁定到世界坐标。

**English**

The **base plane** is an infinite virtual plane (at `z=0`) with special sentinel indices:

- `mechanismIndex = -1` (distinct from real mechanisms)
- `planeIndex = 1` (fixed)
- Mapped to mechanism ID `0` on export

**Purpose**: Acts as "ground" or "world reference", used to lock mechanisms to world coordinates.

---

### 4.4 连接 / Connection

**中文**

**连接**表示两个平面之间的物理约束，存储格式：

```js
{
  id: number,
  planeA: { mechanismIndex: number, planeIndex: 1..4 },
  planeB: { mechanismIndex: number, planeIndex: 1..4 }
}
```

**约束效果**（在 `applyConstraints` 中）：

- 若 `cubeSize` 相同，则强制 B 机构的位置，使平面 B 中心与平面 A 中心重合
- 通过 BFS 传播到所有连通机构

**English**

A **connection** represents a physical constraint between two planes:

```js
{
  id: number,
  planeA: { mechanismIndex: number, planeIndex: 1..4 },
  planeB: { mechanismIndex: number, planeIndex: 1..4 }
}
```

**Constraint effect** (in `applyConstraints`):

- If `cubeSize` matches, force B's position so plane B center coincides with plane A center
- Propagates to all connected mechanisms via BFS

---

### 4.5 连接链 / Connection Chain

**中文**

从某机构出发，沿所有 L1（平面 1/2）或 L2（平面 3/4）分支可达的**平面集合**与**机构集合**。

- L1 分支：`[1, 2]`
- L2 分支：`[3, 4]`

遍历规则（BFS）：

1. 从起始机构的两个平面出发
2. 到达机构 M 的平面 P 后：
   - 若 M 不是起始机构，加入 M 的所有平面（平面配对）
   - 加入 M 的配对平面（1↔2 或 3↔4）
   - 通过连接扩散到相邻机构的对应平面

**English**

The **set of planes** and **set of mechanisms** reachable from a given mechanism along all L1 (planes 1/2) or L2 (planes 3/4) branches.

- L1 branch: `[1, 2]`
- L2 branch: `[3, 4]`

Traversal (BFS):

1. Start from the two planes of the origin mechanism
2. Upon reaching plane P of mechanism M:
   - If M is not the origin, add all of M's planes (plane pairing)
   - Add M's paired plane (1↔2 or 3↔4)
   - Propagate to neighbor mechanisms' corresponding planes via connections

---

### 4.6 锁定状态 / Lock States

**中文**

系统有三类锁定，用于保护物理合理性：

| 锁定类型 | 触发条件 | 禁止操作 |
|---|---|---|
| **双环锁定** | 机构同时参与同一个回环，且该环同时使用 L1 和 L2 | L1/L2 旋转 |
| **基准平面锁定** | 机构所在分支链条上存在基准平面连接 | 平移 / 世界轴旋转 |
| **链条级锁定** | 机构自身或链上其他机构与基准平面连接 | 对应分支的 L 旋转 |

**English**

Three lock types exist to preserve physical plausibility:

| Lock Type | Trigger | Forbidden Ops |
|---|---|---|
| **Double-loop lock** | Mechanism is in a cycle that uses both L1 and L2 | L1/L2 rotation |
| **Base plane lock** | Base plane connection exists on the chain | Translation / world-axis rotation |
| **Chain-level lock** | Self or chain has base plane connection | Corresponding L rotation |

---

## 5. 数据格式 / Data Format

### 5.1 简化的 JSON 格式（v=1）/ Simplified JSON Format (v=1)

**中文**

```jsonc
{
  "_": ["文件格式说明...", "..."],       // 说明注释 / Comment lines
  "v": 1,                                 // 版本号 / Version
  "t": 0.125,                             // L 厚度 / L thickness (all modules)
  "m": [                                  // 机构数组 / Mechanisms
    {
      "i": 1,                             // id
      "p": [0.5, 0.5, 0.5],               // 世界坐标 / Position
      "s": 1,                             // cubeSize
      "a": [0, 0, -1],                    // 平面 1 法向量 (世界)
      "b": [1, 0, 0],                     // 平面 2 法向量
      "c": [-1, 0, 0]                     // 平面 4 法向量
    }
  ],
  "c": [                                  // 连接数组 / Connections
    { "i": 1, "a": [1, 2], "b": [2, 3] }  // a/b: [机构 id, 平面索引]
  ],
  "n": 2,                                 // 下一个可用连接 id
  "matrix": [[...], [...]]                // 可选：连接矩阵
}
```

**反算规则 / Back-calculation rules**：

- `worldRotation` 由平面 1、2 法向量反算（XYZ 顺序）
- `l1Angle` 恒为 0
- `l2Angle` 由平面 4 法向量反算
- `armSize = s - 2*t`
- `axisRadius = s / 8`

**English**

```jsonc
{
  "_": ["File format description...", "..."],
  "v": 1,
  "t": 0.125,
  "m": [
    {
      "i": 1,
      "p": [0.5, 0.5, 0.5],
      "s": 1,
      "a": [0, 0, -1],
      "b": [1, 0, 0],
      "c": [-1, 0, 0]
    }
  ],
  "c": [
    { "i": 1, "a": [1, 2], "b": [2, 3] }
  ],
  "n": 2,
  "matrix": [[...], [...]]
}
```

---

### 5.2 旧格式（兼容）/ Legacy Format (Compatible)

**中文**

旧版文件包含 `data.mechanisms` 数组（对象形式，带 `worldRotation/l1Angle/...`）。

`AppState.restore()` 会自动检测格式：

- `data.mechanisms` 存在 → 旧格式
- `data.m` 存在 → 新格式

**English**

Legacy files contain `data.mechanisms` (object form with `worldRotation/l1Angle/...`).

`AppState.restore()` auto-detects:

- `data.mechanisms` present → legacy
- `data.m` present → new

---

### 5.3 连接矩阵 / Connection Matrix

**中文**

`(N+1) × (N+3)` 整数矩阵：

- 行 1..N → 机构；行 N+1 → 基准平面
- 列 1..N → 机构；列 N+1..N+3 → x, y, z 坐标
- `M[i][j] = p` 表示机构 i 的平面 p 连接到机构 j
- `M[i][i] = (s_i - 1) * 4 + code`，code ∈ [1,4] 是内部平行方向编码

**English**

`(N+1) × (N+3)` integer matrix:

- Rows 1..N → mechanisms; row N+1 → base plane
- Columns 1..N → mechanisms; cols N+1..N+3 → x, y, z
- `M[i][j] = p` means mechanism i's plane p connects to j
- `M[i][i] = (s_i - 1) * 4 + code`, code ∈ [1,4] internal parallel direction encoding

---

## 6. 模块详解 / Module Reference

### 6.1 `src/main.js` — 入口 / Entry Point

**中文**

启动流程：

```js
// 1. 初始化核心模块
const sceneManager = new SceneManager(container);
const appState = new AppState(sceneManager);
const notification = new Notification(notifContainer, opts);
const topologyRenderer = new TopologyRenderer(topoCanvas, appState);
const uiBinder = new UIBinder(appState, sceneManager, topologyRenderer, notification);

// 2. 添加初始机构（可选，注释掉可禁用）
const initMech = new Mechanism({ id: 1, position: (0.5,0.5,0.5), ... });
appState.addMechanism(initMech, true);

// 3. 启动动画循环
function animate(now) {
  requestAnimationFrame(animate);
  appState.updateAnimation(now);   // 驱动补间
  sceneManager.render();            // 渲染
}
animate();
```

**暴露的调试接口**：

- `window.__app`：包含所有核心模块
- `window.__appState`：`AppState` 实例

**English**

Startup flow:

```js
const sceneManager = new SceneManager(container);
const appState = new AppState(sceneManager);
const notification = new Notification(notifContainer, opts);
const topologyRenderer = new TopologyRenderer(topoCanvas, appState);
const uiBinder = new UIBinder(appState, sceneManager, topologyRenderer, notification);

const initMech = new Mechanism({ id: 1, position: (0.5,0.5,0.5), ... });
appState.addMechanism(initMech, true);

function animate(now) {
  requestAnimationFrame(animate);
  appState.updateAnimation(now);
  sceneManager.render();
}
animate();
```

**Debug interfaces**:

- `window.__app`: All core modules
- `window.__appState`: `AppState` instance

---

### 6.2 `src/core/AppState.js` — 全局状态 / Global State

**中文**

**核心数据**：

| 属性 | 类型 | 说明 |
|---|---|---|
| `mechanisms` | `Mechanism[]` | 机构数组 |
| `connections` | `Connection[]` | 连接数组 |
| `activeIdx` | `number` | 当前激活机构索引（-1 表示无） |
| `selectedPlaneData` | `object` | 选中的平面信息 |
| `selectedConnA/B` | `object` | 连接选择 A/B |
| `history` | `History` | 撤销/重做栈 |
| `_topoVersion` | `number` | 拓扑版本号（用于缓存失效） |
| `animState` | `object` | 动画状态机 |

**核心方法**：

| 方法 | 功能 |
|---|---|
| `addMechanism(mech, record)` | 添加机构 |
| `removeMechanism(idx, record)` | 删除机构（级联删除连接） |
| `addConnection(A, B, record)` | 添加连接（去重） |
| `removeConnection(id, record)` | 删除连接（重排编号） |
| `applyConstraints()` | 应用连接约束（BFS 传播位置） |
| `getConnectionChain(idx, "L1"/"L2")` | 获取连接链 |
| `isInBothLoops(idx)` | 检测双环锁定 |
| `renumber()` | 重排序所有机构与连接 |
| `serialize()` / `restore(data)` | 序列化/反序列化 |
| `startAnimation(...)` | 启动补间动画 |
| `_saveState()` | 校正精度并写入历史 |

**English**

**Core data**:

| Property | Type | Description |
|---|---|---|
| `mechanisms` | `Mechanism[]` | Mechanisms |
| `connections` | `Connection[]` | Connections |
| `activeIdx` | `number` | Active mechanism index (-1 = none) |
| `selectedPlaneData` | `object` | Selected plane info |
| `selectedConnA/B` | `object` | Connection endpoints A/B |
| `history` | `History` | Undo/redo stack |
| `_topoVersion` | `number` | Topology version (cache invalidation) |
| `animState` | `object` | Animation state machine |

**Key methods**:

| Method | Purpose |
|---|---|
| `addMechanism(mech, record)` | Add mechanism |
| `removeMechanism(idx, record)` | Remove (cascade connections) |
| `addConnection(A, B, record)` | Add connection (dedupe) |
| `removeConnection(id, record)` | Remove (renumber) |
| `applyConstraints()` | Apply constraints (BFS propagation) |
| `getConnectionChain(idx, "L1"/"L2")` | Get connection chain |
| `isInBothLoops(idx)` | Detect double-loop lock |
| `renumber()` | Renumber all |
| `serialize()` / `restore(data)` | Serialize / Deserialize |
| `startAnimation(...)` | Start tween animation |
| `_saveState()` | Snap precision & save to history |

---

### 6.3 `src/core/Mechanism.js` — 机构实体 / Mechanism Entity

**中文**

**构造参数**：

```js
new Mechanism({
  id, position, worldRotation, l1Angle, l2Angle,
  armSize, thickness, cubeSize, axisRadius
});
```

**关键方法**：

- `_buildGroup()`：调用 `createMechanism` 创建 Three.js Group
- `updateFromState()`：从数据同步到 Group
- `dispose()`：释放几何体和材质
- `toJSON()` / `fromJSON()`：旧格式序列化
- `fromSimplifiedJSON(data, thickness)`：新格式反算（法向量 → 欧拉角 + L2 角度）

**反算流程**（`fromSimplifiedJSON`）：

```
输入：平面 1/2/4 的世界法向量 a/b/c
1. worldRotation = computeWorldRotationFromNormals(a, b)
2. l2Angle = computeL2AngleFromNormals(a, b, c)
3. armSize = cubeSize - 2*thickness
4. axisRadius = cubeSize / 8
```

**English**

**Constructor**:

```js
new Mechanism({
  id, position, worldRotation, l1Angle, l2Angle,
  armSize, thickness, cubeSize, axisRadius
});
```

**Key methods**:

- `_buildGroup()`: Build Three.js group via `createMechanism`
- `updateFromState()`: Sync data → Group
- `dispose()`: Release geometries & materials
- `toJSON()` / `fromJSON()`: Legacy format serialization
- `fromSimplifiedJSON(data, thickness)`: New format back-calculation

**Back-calculation flow**:

```
Input: World normals a/b/c of planes 1/2/4
1. worldRotation = computeWorldRotationFromNormals(a, b)
2. l2Angle = computeL2AngleFromNormals(a, b, c)
3. armSize = cubeSize - 2*thickness
4. axisRadius = cubeSize / 8
```

---

### 6.4 `src/core/Connection.js` — 连接实体 / Connection Entity

**中文**

简洁的数据容器，提供：

- `toJSON()` / `fromJSON()`：序列化
- `areSamePlane(p1, p2)`：判断平面相等（静态）
- `hasPlane(plane)`：检查连接是否包含平面
- `getOtherPlane(plane)`：返回对面平面

**English**

Simple data container:

- `toJSON()` / `fromJSON()`: Serialization
- `areSamePlane(p1, p2)`: Static plane equality
- `hasPlane(plane)`: Check if connection contains plane
- `getOtherPlane(plane)`: Get opposite plane

---

### 6.5 `src/core/History.js` — 撤销/重做 / Undo/Redo

**中文**

**基于 JSON 字符串栈**：

- 每次 `push(state)` 前先 `JSON.stringify` 去重
- 最大长度 200（可配）
- `undo()` / `redo()` 移动索引
- 栈尾之外的 push 会截断"未来分支"

**English**

**JSON string stack**:

- Dedupe via `JSON.stringify` before each `push(state)`
- Max length 200 (configurable)
- `undo()` / `redo()` move index
- Push beyond current index truncates the "future branch"

---

### 6.6 `src/renderer/SceneManager.js` — 场景管理 / Scene Manager

**中文**

**职责**：

- Three.js `Scene` / `PerspectiveCamera` / `WebGLRenderer` / `OrbitControls`
- 灯光（环境光 + 方向光，含阴影优化）
- 网格 `GridHelper` + 参考平面（基准平面）
- 世界坐标系辅助（X/Y/Z 轴）
- 几何/材质缓存
- 窗口 resize 自适应
- 资源释放

**English**

**Responsibilities**:

- Three.js `Scene` / `PerspectiveCamera` / `WebGLRenderer` / `OrbitControls`
- Lights (ambient + directional with shadow optimization)
- `GridHelper` + reference plane (base plane)
- World coordinate axes
- Geometry/material caches
- Window resize handling
- Resource disposal

---

### 6.7 `src/renderer/TopologyRenderer.js` — 拓扑图 / Topology Graph

**中文**

**布局算法**（`_drawTopology`）：

1. **根节点**：`highlightedId` 对应的机构，或机构 0
2. **BFS 分层**：得到 `layer` 和 `parent`
3. **回环检测**：Kahn 拓扑排序 + Tarjan 式 DFS
4. **显示节点筛选**：
   - 深度 ≤ 1 的节点
   - 含根环（≤8 节点）全显示
   - 不含根环只显示入口
5. **力导向迭代**（250 步）：
   - 斥力：`F = repulsion / dist²`
   - 引力：`F = attraction * dist`
   - 阻尼 0.85，限速 20
6. **环固定**：小环的位置被强制固定在圆周上
7. **碰撞后处理**：节点排斥 + 环排斥 + 边界裁剪
8. **父子距离约束**：限制 `[2.5·d, 3·d]`
9. **整体居中**

**颜色编码**：

- 普通机构：`#4a9eff`（蓝）
- 环上机构：`#ff8800`（橙）
- 当前选中：`#00cc66`（绿，带发光）
- 选中连接边：`#00ccff`（青）
- 环边：`#ff8800`（橙）

**English**

**Layout algorithm** (`_drawTopology`):

1. **Root**: Mechanism for `highlightedId`, or mechanism 0
2. **BFS layering**: Produce `layer` and `parent`
3. **Cycle detection**: Kahn topological + Tarjan-style DFS
4. **Display node filtering**:
   - Nodes with depth ≤ 1
   - Root-containing cycles (≤8 nodes) shown in full
   - Non-root cycles: only entry nodes
5. **Force-directed iteration** (250 steps):
   - Repulsion: `F = repulsion / dist²`
   - Attraction: `F = attraction * dist`
   - Damping 0.85, max speed 20
6. **Ring fixing**: Small cycles pinned to circles
7. **Collision post-processing**: Node repulsion + ring repulsion + boundary clamping
8. **Parent-child distance constraint**: `[2.5·d, 3·d]`
9. **Global centering**

**Color coding**:

- Normal: `#4a9eff` (blue)
- Cycle: `#ff8800` (orange)
- Selected: `#00cc66` (green, glow)
- Selected edge: `#00ccff` (cyan)
- Cycle edge: `#ff8800` (orange)

---

### 6.8 `src/renderer/ConnectionMatrixRenderer.js` — 连接矩阵 / Connection Matrix

**中文**

**两种模式**：

| 模式 | 说明 |
|---|---|
| `full` | 显示所有机构的完整连接矩阵 |
| `subset` | 显示与当前激活机构直接连接的子矩阵 |

**高亮规则**：

- `full` 模式：激活机构对应的行列高亮
- `subset` 模式：激活机构固定在第 0 行/列，与其直接相连的单元格高亮

**绘制**：

- 深色背景 `#0f1629`，浅色 `#f8f9fa`
- 单元格颜色：
  - 普通：白/深灰
  - 非零：浅蓝/深蓝
  - 对角线：浅绿/深绿
  - 基准平面行：浅黄/深黄
  - 高亮：亮黄/金黄

**English**

**Two modes**:

| Mode | Description |
|---|---|
| `full` | Full connection matrix of all mechanisms |
| `subset` | Sub-matrix of mechanisms directly connected to the active one |

**Highlight rules**:

- `full`: Rows/cols of active mechanism highlighted
- `subset`: Active pinned to row/col 0; directly-connected cells highlighted

**Rendering**:

- Dark bg `#0f1629`, light `#f8f9fa`
- Cell colors:
  - Normal: white/dark gray
  - Non-zero: light blue/dark blue
  - Diagonal: light green/dark green
  - Base plane row: light yellow/dark yellow
  - Highlight: bright yellow/gold

---

### 6.9 `src/renderer/Screenshot.js` — 截图 / Screenshot

**中文**

- **单例离屏渲染器**：避免多次创建 WebGL 上下文
- **参数**：`{ width, height }` + `hideUI` 标志
- **实现**：临时 `PerspectiveCamera` 复制当前相机参数，渲染到离屏渲染器，导出 `toDataURL`
- **释放**：`Screenshot.dispose()`（应用退出时调用）

**English**

- **Singleton offscreen renderer**: Avoids repeated WebGL contexts
- **Params**: `{ width, height }` + `hideUI` flag
- **Implementation**: Temporary `PerspectiveCamera` copies current params, renders to offscreen, exports `toDataURL`
- **Disposal**: `Screenshot.dispose()` (on app exit)

---

### 6.10 `src/ui/UIBinder.js` — UI 绑定 / UI Binding

**中文**

**最庞大的模块（约 2000+ 行）**，负责：

1. **DOM 引用收集**（`_collectDOM`）
2. **事件绑定**（`_bindAll`）
3. **面板切换**（`_showPanel`）
4. **数值变换应用**（`_applyTransform` / `_applyAbsoluteRotation` / `_applyWorldAxis`）
5. **连接管理**（`_onConnect` / `_onConnClear`）
6. **导入导出**（`_export` / `_exportSorted` / `_import`）
7. **UI 刷新**（`_refreshUI` / `_updateMechList` / `_updateOpPanel` / ...）
8. **射线检测**（`_setupRaycaster` / `_getIntersect`）
9. **键盘快捷键**（`_setupKeyboard`）

**变换应用流程**（`_applyTransform`）：

```
1. 读取输入值 → deltaPos / deltaL1 / deltaL2
2. 双环检查：isInBothLoops → 阻止 L 旋转
3. 链条级锁定：_chainHasBasePlaneConnection
4. 计算受影响机构（BFS 或链）
5. 保存初始状态
6. 应用变换，得到目标状态
7. 回滚到初始
8. 启动动画（startAnimation）
9. 动画完成 → applyConstraints + _saveState + _refreshUI
```

**English**

**Largest module (~2000+ lines)**:

1. **DOM collection** (`_collectDOM`)
2. **Event binding** (`_bindAll`)
3. **Panel switching** (`_showPanel`)
4. **Transform application** (`_applyTransform` / `_applyAbsoluteRotation` / `_applyWorldAxis`)
5. **Connection management** (`_onConnect` / `_onConnClear`)
6. **Import/Export** (`_export` / `_exportSorted` / `_import`)
7. **UI refresh** (`_refreshUI` / `_updateMechList` / `_updateOpPanel` / ...)
8. **Raycasting** (`_setupRaycaster` / `_getIntersect`)
9. **Keyboard shortcuts** (`_setupKeyboard`)

**Transform flow** (`_applyTransform`):

```
1. Read inputs → deltaPos / deltaL1 / deltaL2
2. Double-loop check → block L rotation
3. Chain-level lock check
4. Compute affected mechanisms
5. Save initial state
6. Apply transform → target state
7. Roll back to initial
8. Start animation
9. On complete → applyConstraints + _saveState + _refreshUI
```

---

### 6.11 `src/ui/Notification.js` — 通知 / Notifications

**中文**

- 队列 + 显示上限（默认 3）
- 四种类型：`info` / `success` / `error` / `warning`
- 自动消失 + 手动关闭
- HTML 转义防 XSS

**English**

- Queue + display limit (default 3)
- Four types: `info` / `success` / `error` / `warning`
- Auto-dismiss + manual close
- HTML escaping for XSS prevention

---

### 6.12 `src/ui/PanelManager.js` — 面板管理 / Panel Manager

**中文**

- 4 个面板：`ui` / `gen` / `op` / `conn`
- `show(id)` / `toggle(id)` / `getActive()`
- 触发 `panelchange` 自定义事件

**English**

- 4 panels: `ui` / `gen` / `op` / `conn`
- `show(id)` / `toggle(id)` / `getActive()`
- Dispatches `panelchange` custom event

---

### 6.13 `src/utils/GeometryUtils.js` — 几何工具 / Geometry Utils

**中文**

**核心函数**：

| 函数 | 功能 |
|---|---|
| `computeCornerRadius(side, thick)` | 圆角半径计算 |
| `getFixedCorners()` | 固定圆角配置 |
| `createRoundedRectShape(w, h, r, corners)` | 圆角矩形 Shape |
| `createLPart(...)` | L 零件（两块平板） |
| `createAxis(radius, len)` | 中心轴 |
| `createMechanism(...)` | 完整机构 |
| `getPlaneWorldCenter(mech, planeIdx)` | 平面世界中心 |
| `getWorldPlaneNormal(mech, planeIdx)` | 平面世界法向量 |
| `computeWorldRotationFromNormals(a, b)` | 反算世界旋转 |
| `computeL2AngleFromNormals(a, b, c)` | 反算 L2 角度 |
| `normalizeAngleDeg(d)` | 归一化角度到 [-180, 180] |
| `snapAngle(deg, eps)` | 吸附角度到 0/±90/±180 |
| `snapValue(v, eps)` | 吸附数值到整数/0.5 倍 |

**English**

**Core functions**:

| Function | Purpose |
|---|---|
| `computeCornerRadius(side, thick)` | Corner radius calc |
| `getFixedCorners()` | Fixed corner config |
| `createRoundedRectShape(w, h, r, corners)` | Rounded rect Shape |
| `createLPart(...)` | L part (two plates) |
| `createAxis(radius, len)` | Central axis |
| `createMechanism(...)` | Full mechanism |
| `getPlaneWorldCenter(mech, planeIdx)` | Plane world center |
| `getWorldPlaneNormal(mech, planeIdx)` | Plane world normal |
| `computeWorldRotationFromNormals(a, b)` | Back-calc world rotation |
| `computeL2AngleFromNormals(a, b, c)` | Back-calc L2 angle |
| `normalizeAngleDeg(d)` | Normalize to [-180, 180] |
| `snapAngle(deg, eps)` | Snap to 0/±90/±180 |
| `snapValue(v, eps)` | Snap to int/0.5 multiple |

---

### 6.14 `src/utils/ConnectionMatrix.js` — 连接矩阵 / Connection Matrix

**中文**

**核心函数**：`buildConnectionMatrix(mechs, conns)` → `(N+1)×(N+3)` 二维数组

**算法步骤**（移植自 MATLAB `buildConnectionMatrix.m`）：

1. 坐标写入列 N+1..N+3
2. 连接写入非对角元素
3. 对角线：找行中第一个非零项 j，用 `findParallelCode(mechA, pA, planeDirection(mechB, pB, 1))` 得到内部平行方向编码
4. 合并为 `(s_i - 1) * 4 + code`

**辅助函数**：

- `planeAxisDir1(mech, planeIdx)`：平面轴与参考方向
- `planeDirection(mech, planeIdx, k)`：k ∈ [1,4] 时平面方向
- `findParallelCode(mech, planeIdx, refDir)`：找与参考方向最平行的 k

**English**

**Core**: `buildConnectionMatrix(mechs, conns)` → `(N+1)×(N+3)` 2D array

**Steps** (ported from MATLAB `buildConnectionMatrix.m`):

1. Write coordinates to cols N+1..N+3
2. Write connections to off-diagonal elements
3. Diagonal: find first non-zero column j in row; use `findParallelCode(mechA, pA, planeDirection(mechB, pB, 1))` for internal parallel direction code
4. Combine as `(s_i - 1) * 4 + code`

**Helpers**:

- `planeAxisDir1(mech, planeIdx)`: Plane axis & reference direction
- `planeDirection(mech, planeIdx, k)`: Plane direction for k ∈ [1,4]
- `findParallelCode(mech, planeIdx, refDir)`: Find k most parallel to refDir

---

### 6.15 `src/utils/Renumber.js` — 重编号 / Renumbering

**中文**

**算法**（移植自 MATLAB `renumberRobotStateBySizeThenGraphWithCycles.m`）：

1. **节点映射**：基准平面 → 节点 1，机构 k → 节点 k+2
2. **尺寸降序分组**：同尺寸模块处理在一起
3. **组内连通分量**：
   - 每轮选**种子**：
     - 与已编号机构连接数最多
     - 组内未编号度最大
     - 节点编号最小
   - 从种子 BFS：
     - 邻居按与已编号连接数降序排
4. **分配新 id**：按 BFS 顺序递增
5. **更新机构数组**：`mechs.sort((a,b) => a.id - b.id)`
6. **更新连接**：重映射 `mechanismIndex`

**English**

**Algorithm** (ported from MATLAB `renumberRobotStateBySizeThenGraphWithCycles.m`):

1. **Node mapping**: Base plane → node 1, mechanism k → node k+2
2. **Size-descending grouping**
3. **Connected components within group**:
   - **Seed selection** each round:
     - Most connections to numbered nodes
     - Max unnumbered degree within group
     - Smallest node index
   - BFS from seed:
     - Neighbors sorted by connections to numbered nodes (desc)
4. **Assign new ids**: Increment in BFS order
5. **Update mechanism array**: `mechs.sort((a,b) => a.id - b.id)`
6. **Update connections**: Remap `mechanismIndex`

---

### 6.16 `src/utils/AnimationUtils.js` — 动画工具 / Animation Utils

**中文**

- `Easing`：**30+ 缓动函数**（Linear/Quad/Cubic/Sine/Expo/Elastic/Back/Bounce）
- `Tween`：单属性补间（支持对象插值）
- `TweenManager`：多补间管理器（RAF 驱动）
- 全局单例：`getDefaultTweenManager()`

**注**：主流程**未使用** `TweenManager`（`AppState` 内置动画更快），但模块保留供扩展。

**English**

- `Easing`: **30+ easing functions** (Linear/Quad/Cubic/Sine/Expo/Elastic/Back/Bounce)
- `Tween`: Single-property tween (supports object interpolation)
- `TweenManager`: Multi-tween manager (RAF-driven)
- Global singleton: `getDefaultTweenManager()`

**Note**: The main flow **does not use** `TweenManager` (AppState's built-in animation is faster), but kept for extension.

---

### 6.17 `src/utils/i18n.js` — 国际化 / i18n

**中文**

- 双语字典：`translations.zh` / `translations.en`
- `t(key, params)`：取值 + `${var}` 插值
- `setLang(lang)`：切换语言，派发 `langchange` 事件
- `getLang()`：获取当前语言

**English**

- Bilingual dictionary: `translations.zh` / `translations.en`
- `t(key, params)`: Get + `${var}` interpolation
- `setLang(lang)`: Switch language, dispatch `langchange`
- `getLang()`: Get current language

---

## 7. 关键算法 / Key Algorithms

### 7.1 法向量反算世界旋转 / Back-calc Rotation from Normals

**中文**

**问题**：给定机构平面 1（局部 `-Z`）和平面 2（局部 `+X`）的世界法向量 `a, b`，求世界旋转 `R`。

**方法**（`computeWorldRotationFromNormals`）：

1. 构造初始正交基：
   - `u0 = -Z`（平面 1 初始法向量）
   - `v0 = +X`（平面 2 初始法向量）
   - `w0 = u0 × v0`
2. 构造目标正交基：
   - `u = normalize(a)`
   - `v = normalize(b)`
   - `w = u × v`
3. `R = [u v w] · [u0 v0 w0]ᵀ`
4. 四元数 → 欧拉角（XYZ 顺序）

**English**

**Problem**: Given world normals `a, b` of planes 1 (local `-Z`) and 2 (local `+X`), find world rotation `R`.

**Method** (`computeWorldRotationFromNormals`):

1. Build initial orthonormal basis:
   - `u0 = -Z`
   - `v0 = +X`
   - `w0 = u0 × v0`
2. Build target basis:
   - `u = normalize(a)`, `v = normalize(b)`, `w = u × v`
3. `R = [u v w] · [u0 v0 w0]ᵀ`
4. Quaternion → Euler (XYZ order)

---

### 7.2 L2 角度反算 / L2 Angle Back-calculation

**中文**

**问题**：已知世界旋转 `R`、平面 4 的世界法向量 `c`，求 `l2Angle`。

**方法**（`computeL2AngleFromNormals`）：

1. 由 a、b 得到 `R`（同 7.1）
2. 转换到局部：`c_local = Rᵀ · c`
3. 在局部中，`R_z(θ) · [-1, 0, 0] = [-cosθ, -sinθ, 0]`
4. 解得 `θ = atan2(-c_local.y, -c_local.x)`

**English**

**Problem**: Given world rotation `R` and plane 4 world normal `c`, find `l2Angle`.

**Method** (`computeL2AngleFromNormals`):

1. Get `R` from a, b (same as 7.1)
2. To local: `c_local = Rᵀ · c`
3. Locally, `R_z(θ) · [-1, 0, 0] = [-cosθ, -sinθ, 0]`
4. `θ = atan2(-c_local.y, -c_local.x)`

---

### 7.3 双环检测 / Double-Loop Detection

**中文**

**问题**：判断机构 `idx` 是否同时参与一个回环，且该环同时使用了 L1 和 L2 分支。

**方法**（`isInBothLoops`）：

1. 构建含基准平面的虚拟邻接表
2. DFS 查找包含 `idx` 的环
3. 对每个环，检查 `idx` 的两个邻居边对应的平面
4. 若一个邻居使用 L1（平面 1/2），另一个使用 L2（平面 3/4）→ 返回 true

**English**

**Problem**: Determine if mechanism `idx` is in a cycle that uses both L1 and L2.

**Method** (`isInBothLoops`):

1. Build virtual adjacency with base plane
2. DFS find cycles containing `idx`
3. For each cycle, check the two edge planes at `idx`
4. If one is L1 (planes 1/2) and other is L2 (3/4) → true

---

### 7.4 力导向布局 / Force-Directed Layout

**中文**

**参数**：

```
iterations = 250
repulsion = 3.0      // 斥力系数
attraction = 0.06    // 引力系数
damping = 0.85       // 阻尼
maxSpeed = 20        // 限速
```

**步骤**：

1. **初始位置**：根节点居中，其他节点按种子随机散开
2. **小环固定**：≤8 节点的含根环固定在圆周
3. **迭代**：
   - 斥力：`F = repulsion / (dist² + 0.1)`，方向背离
   - 引力：`F = attraction * dist`，方向沿边
   - 阻尼 + 限速
4. **碰撞后处理**（30 步）：
   - 节点间排斥：`overlap = minDist - dist`，按半径比例推开
   - 环排斥：环上节点与环外节点相互推开
   - 边界裁剪
5. **父子距离约束**（20 步）：`dist ∈ [2.5·d, 3·d]`
6. **整体居中**

**English**

**Parameters**:

```
iterations = 250
repulsion = 3.0
attraction = 0.06
damping = 0.85
maxSpeed = 20
```

**Steps**:

1. **Initial positions**: Root centered, others scattered with seeded random
2. **Ring fixing**: Root cycles ≤ 8 nodes pinned to circles
3. **Iterations**:
   - Repulsion: `F = repulsion / (dist² + 0.1)`, away
   - Attraction: `F = attraction * dist`, along edges
   - Damping + speed limit
4. **Collision post-processing** (30 steps):
   - Node repulsion: `overlap = minDist - dist`, ratio by radii
   - Ring repulsion
   - Boundary clamping
5. **Parent-child distance constraint** (20 steps): `dist ∈ [2.5·d, 3·d]`
6. **Global centering**

---

## 8. UI 交互 / UI Interactions

### 8.1 面板概览 / Panel Overview

| 面板 / Panel | 快捷键 / Shortcut | 功能 / Function |
|---|:---:|---|
| **界面** / Interface | `Ctrl+1` | 语言、主题、动画、截图、聚焦点、相机 |
| **生成** / Generate | `Ctrl+2` | 导入导出、机构尺寸、体心坐标、世界旋转、L 角度 |
| **操作** / Operations | `Ctrl+3` | 当前选择、整体平移、世界旋转、L 旋转 |
| **连接** / Connections | `Ctrl+4` | 平面选择、多选、连接矩阵、拓扑图、连接链 |

---

### 8.2 交互流程 / Interaction Flows

#### 8.2.1 创建连接 / Create Connection

**中文**

1. 切换到"连接"面板
2. 开启"多选模式"（或按住 Ctrl）
3. 点击第一个平面（变青）
4. 点击第二个平面（变紫）
5. 点击"🔗 连接"

**English**

1. Switch to "Connections" panel
2. Enable "Multi-select" (or hold Ctrl)
3. Click first plane (turns cyan)
4. Click second plane (turns purple)
5. Click "🔗 Connect"

#### 8.2.2 重新排序 / Renumber

**中文**

1. 切换到"连接"面板
2. 点击"🔢 重新排序"
3. 确认对话框
4. 机构与连接按尺寸 + 图遍历重编号

**English**

1. Switch to "Connections" panel
2. Click "🔢 Renumber"
3. Confirm dialog
4. Mechanisms & connections renumbered by size + graph traversal

#### 8.2.3 排序并导出 / Sort & Export

**中文**

1. 切换到"生成"面板
2. 点击"📊 排序并导出"
3. 自动重排序 + 生成连接矩阵 + 弹出保存对话框

**English**

1. Switch to "Generate" panel
2. Click "📊 Sort & Export"
3. Auto renumber + generate matrix + save dialog

---

## 9. 快捷键 / Keyboard Shortcuts

| 快捷键 / Shortcut | 功能 / Function |
|---|---|
| `Ctrl+Z` | 撤销 / Undo |
| `Ctrl+Y` | 重做 / Redo |
| `Delete` / `Backspace` | 删除当前机构 / Delete active mechanism |
| `Ctrl+S` | 导出 JSON / Export JSON |
| `Ctrl+O` | 导入 JSON / Import JSON |
| `Ctrl+Shift+E` | 截屏 / Screenshot |
| `Ctrl+1` ~ `Ctrl+4` | 切换面板 / Switch panel |
| `Ctrl+L` | 机构列表 / Mechanism list |
| `Ctrl+H` | 隐藏控件 / Hide controls |
| `Ctrl+C` | 创建连接 / Create connection |
| `Ctrl+Shift+R` | 刷新拓扑图 / Refresh topology |
| `?` 或 `/` | 帮助 / Help |

---

## 10. 国际化 / Internationalization

### 10.1 添加新翻译 / Adding New Translations

**中文**

1. 在 `i18n.js` 的 `translations.zh` 中添加键值
2. 在 `translations.en` 中添加对应英文
3. HTML 中通过 `data-i18n="key"` 属性标记
4. JS 中通过 `t("key", { param: value })` 调用

**English**

1. Add key-value in `translations.zh`
2. Add English in `translations.en`
3. Mark HTML with `data-i18n="key"`
4. Use `t("key", { param: value })` in JS

### 10.2 切换语言 / Switch Language

**中文**

- 通过界面面板的"🌐 语言"按钮
- 或代码中 `setLang("zh")` / `setLang("en")`
- 会派发 `langchange` 事件

**English**

- Via "🌐 Language" button in Interface panel
- Or `setLang("zh")` / `setLang("en")` in code
- Dispatches `langchange` event

---

## 附录 A：模块依赖关系 / Appendix A: Module Dependencies

```
main.js
 ├── core/AppState.js
 │    ├── core/Mechanism.js
 │    ├── core/Connection.js
 │    ├── core/History.js
 │    ├── utils/GeometryUtils.js
 │    └── utils/Renumber.js
 ├── renderer/SceneManager.js
 ├── renderer/TopologyRenderer.js
 │    ├── utils/GeometryUtils.js
 │    └── utils/i18n.js
 ├── ui/Notification.js
 ├── ui/UIBinder.js
 │    ├── core/Mechanism.js
 │    ├── renderer/ConnectionMatrixRenderer.js
 │    ├── utils/GeometryUtils.js
 │    ├── utils/i18n.js
 │    └── utils/ConnectionMatrix.js
 ├── utils/i18n.js
 └── utils/GeometryUtils.js
```

---

## 附录 B：常见问题 / Appendix B: FAQ

### Q1：为什么圆角是固定的？/ Why are corners fixed?

**中文**：为保证力学一致性，L1 和 L2 的圆角方向被硬编码在 `getFixedCorners()` 中。如需自定义，需修改该函数并同步 `createRoundedRectShape`。

**English**: For mechanical consistency, L1 and L2 corner directions are hardcoded in `getFixedCorners()`. To customize, modify that function and sync `createRoundedRectShape`.

### Q2：为什么删除连接后编号会重排？/ Why does deleting a connection renumber?

**中文**：`removeConnection` 调用 `_renumberConnections`，保证 id 始终连续（1..N）。如需保留 id，可注释该调用。

**English**: `removeConnection` calls `_renumberConnections` to keep ids continuous (1..N). To preserve ids, comment out that call.

### Q3：连接矩阵的对角线是什么？/ What is the diagonal of the connection matrix?

**中文**：对角线是机构的**内部方向编码**：`(s_i - 1) * 4 + code`。`code` 是该机构的某个平面与参考方向最平行的方向编号（1..4）。

**English**: The diagonal is the mechanism's **internal direction code**: `(s_i - 1) * 4 + code`. `code` is the internal direction (1..4) of a plane most parallel to the reference direction.

### Q4：如何禁用初始机构？/ How to disable the initial mechanism?

**中文**：在 `main.js` 中注释掉以下代码块：

```js
const initCube = 1;
...
appState._saveState();
```

**English**: Comment out this block in `main.js`:

```js
const initCube = 1;
...
appState._saveState();
```

### Q5：截图为什么模糊？/ Why are screenshots blurry?

**中文**：截图使用**离屏渲染器**，分辨率由 `screenshot-res` 决定。若模糊，请选择更高分辨率（4K / 8K）。

**English**: Screenshots use an **offscreen renderer**; resolution is set by `screenshot-res`. If blurry, choose higher resolution (4K / 8K).

### Q6：连接面板第一个方框怎么变成了两行？/ Why did the first box in the Connections panel become two rows?

**中文**：按最新布局：第一行显示平面 A / B（压缩）和多选模式开关；第二行显示连接 / 清除 / 重新排序三个按钮。

**English**: In the latest layout: the first row shows planes A / B (compressed) and the multi-select toggle; the second row shows the Connect / Clear / Renumber buttons.

### Q7：如何导出带有排序的机构？/ How to export with mechanisms sorted?

**中文**：切换到"生成"面板 → 点击"📊 排序并导出"。会自动重排序、生成连接矩阵并弹出保存对话框。

**English**: Switch to the "Generate" panel → click "📊 Sort & Export". It renumbers automatically, generates the connection matrix, and opens the save dialog.

### Q8：连接矩阵显示异常怎么办？/ What if the connection matrix renders abnormally?

**中文**：检查 `src/renderer/ConnectionMatrixRenderer.js` 的 `_draw` 方法。若画布尺寸为 0，尝试在 `refresh()` 中增加 `setTimeout` 兜底重绘。

**English**: Check the `_draw` method in `src/renderer/ConnectionMatrixRenderer.js`. If the canvas size is 0, add a `setTimeout` fallback redraw in `refresh()`.

### Q9：为什么切换中英文后控件会换行？/ Why do controls wrap after switching language?

**中文**：`UIBinder._updateAllTexts()` 会重新填充所有 `[data-i18n]` 元素的 `textContent`。若出现换行，需检查 CSS 中相关控件的 `white-space` 和 `flex-wrap` 设置。

**English**: `UIBinder._updateAllTexts()` refills the `textContent` of all `[data-i18n]` elements. If wrapping occurs, check the `white-space` and `flex-wrap` CSS settings of the affected controls.

### Q10：如何修改轴径自动运算公式？/ How to change the automatic axis-radius formula?

**中文**：修改以下两处保持一致：

**English**: Update both of the following consistently:

1. `src/ui/UIBinder.js` → `_updateGenDisplay()` 中的 / in `const axisDiam = cubeSize / 4;`
2. `src/core/Mechanism.js` → `fromSimplifiedJSON()` 中的 / in `const axisRadius = cubeSize / 8;`

---

## 如何引用 / How to Cite

**中文**：若本平台用于学术研究，请引用以下论文（录用后补全卷期页码）：

> [Authors], "[Paper Title]," *IEEE Transactions on Robotics*, 2026.（待录用 / to appear）

**English**: If you use this platform in academic research, please cite:

> [Authors], "[Paper Title]," *IEEE Transactions on Robotics*, 2026. (to appear)

---

## 版权与许可 / Copyright & License

**中文**：本项目采用 **MIT 许可证** 开源（Copyright (c) 2026 BeckChiang），许可全文见仓库根目录的 `LICENSE` 文件。简而言之：可自由使用、复制、修改、合并、发布、分发、再许可和销售（包括商用），但需在副本中保留上述版权与许可声明。作者与版权持有人对软件不承担任何担保责任。

**English**: This project is licensed under the **MIT License** (Copyright (c) 2026 BeckChiang); see the `LICENSE` file in the repository root for the full text. In short: you may freely use, copy, modify, merge, publish, distribute, sublicense, and sell copies (including commercial use), provided the copyright and permission notice are retained in all copies. The software is provided "as is", without warranty of any kind.

---

**文档版本 / Doc Version**: 1.2  
**最后更新 / Last Updated**: 2026-10-17