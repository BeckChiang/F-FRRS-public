// src/renderer/ConnectionMatrixRenderer.js
import { t } from "../utils/i18n.js";
import { buildConnectionMatrix } from "../utils/ConnectionMatrix.js";

export class ConnectionMatrixRenderer {
  constructor(canvas, appState) {
    this.canvas = canvas;
    this.appState = appState;
    this.mode = "full"; // 'full' | 'subset'
    this.enabled = true;
    this._drawPending = false;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.refresh();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.refresh();
  }

  refresh() {
    if (!this.enabled || !this.canvas) return;
    if (this._drawPending) return;
    this._drawPending = true;
    requestAnimationFrame(() => {
      this._drawPending = false;
      this._draw();
    });
  }

  clearCanvas() {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.clientWidth || 400;
    const H = canvas.clientHeight || 250;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    const isLight = document.body.classList.contains("light-theme");
    ctx.fillStyle = isLight ? "#f8f9fa" : "#0f1629";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = isLight ? "#888" : "#b0b0b0";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t("conn-matrix-empty"), W / 2, H / 2);
  }

  _draw(canvasOverride, widthOverride, heightOverride, opts = {}) {
    const { upscale = false } = opts;
    const canvas = canvasOverride || this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // ---- 1. 尺寸：优先用调用方给出的显式尺寸，否则读 CSS 决定的显示尺寸 ----
    let W, H;
    if (widthOverride && heightOverride) {
      W = widthOverride;
      H = heightOverride;
    } else {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (!W || !H) {
        const rect = canvas.parentElement?.getBoundingClientRect?.() || {};
        W = Math.max(200, rect.width || 400);
        H = Math.max(150, (W * 9) / 16);
      }
    }
    W = Math.max(120, W);
    H = Math.max(80, H);

    // 放大模式用更高 DPR，保证清晰
    const dpr = upscale
      ? Math.min(Math.max(window.devicePixelRatio || 1, 2), 3)
      : Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // 仅放大模式显式设置 CSS 尺寸（防止缩略图回弹），缩略图保持 CSS 100%
    if (upscale) {
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // ---- 2. 背景 ----
    const isLight = document.body.classList.contains("light-theme");
    ctx.fillStyle = isLight ? "#f8f9fa" : "#0f1629";
    ctx.fillRect(0, 0, W, H);

    // ---- 3. 数据 ----
    const data = this._computeData();
    if (!data) {
      ctx.fillStyle = isLight ? "#888" : "#b0b0b0";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const msg =
        this.mode === "subset" && this.appState.activeIdx === -1
          ? t("conn-matrix-no-select")
          : t("conn-matrix-empty");
      ctx.fillText(msg, W / 2, H / 2);
      return;
    }

    const {
      M,
      rowLabels,
      colLabels,
      highlightCells,
      highlightRows,
      highlightCols,
    } = data;
    const rows = rowLabels.length;
    const cols = colLabels.length;

    // ---- 4. 布局 ----
    const labelW = Math.max(24, Math.min(upscale ? 70 : 50, W * 0.1));
    const labelH = Math.max(16, Math.min(upscale ? 40 : 26, H * 0.1));
    const padding = 8;
    const availW = W - labelW - padding * 2;
    const availH = H - labelH - padding * 2;

    // 放大时单元格可扩展到填满；缩略图限制上限
    const maxCellW = upscale ? Infinity : 60;
    const maxCellH = upscale ? Infinity : 36;

    const idealW = availW / cols;
    const idealH = availH / rows;
    // 放大时用两方向较小的值，尽量保持单元格接近方形，避免过度拉伸
    const squareIdeal = Math.min(idealW, idealH);

    const cellW = Math.max(
      12,
      Math.min(upscale ? squareIdeal : Math.min(idealW, maxCellW), idealW)
    );
    const cellH = Math.max(
      10,
      Math.min(upscale ? squareIdeal : Math.min(idealH, maxCellH), idealH)
    );

    const gridW = cellW * cols;
    const gridH = cellH * rows;
    const totalW = labelW + gridW;
    const totalH = labelH + gridH;

    // 整体居中
    const baseX = (W - totalW) / 2;
    const baseY = (H - totalH) / 2;
    const startX = baseX + labelW;
    const startY = baseY + labelH;

    const colors = isLight
      ? {
          cellBg: "#ffffff",
          cellBorder: "#d0d5dd",
          nonZeroBg: "#dbeafe",
          nonZeroBorder: "#2563eb",
          nonZeroText: "#1e40af",
          diagBg: "#dcfce7",
          diagBorder: "#16a34a",
          diagText: "#166534",
          baseBg: "#fef3c7",
          baseBorder: "#d97706",
          baseText: "#92400e",
          highlightBg: "#fef08a",
          highlightBorder: "#ca8a04",
          highlightText: "#713f12",
          labelText: "#374151",
          baseLabelText: "#d97706",
          highlightLabelText: "#2563eb",
        }
      : {
          cellBg: "#1a2238",
          cellBorder: "#2a3a5c",
          nonZeroBg: "#1e3a5f",
          nonZeroBorder: "#4a9eff",
          nonZeroText: "#93c5fd",
          diagBg: "#1f3d2e",
          diagBorder: "#4caf84",
          diagText: "#86efac",
          baseBg: "#3d2f1e",
          baseBorder: "#d97706",
          baseText: "#fcd34d",
          highlightBg: "#4a3a1e",
          highlightBorder: "#ffdd57",
          highlightText: "#ffdd57",
          labelText: "#b0b0b0",
          baseLabelText: "#ffaa33",
          highlightLabelText: "#4a9eff",
        };

    // ---- 5. 列标签 ----
    const labelFontSize = Math.max(
      9,
      Math.min(16, Math.min(cellW * 0.55, cellH * 0.5))
    );
    ctx.font = `bold ${labelFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let j = 0; j < cols; j++) {
      const x = startX + j * cellW + cellW / 2;
      ctx.fillStyle =
        highlightCols && highlightCols.has(j)
          ? colors.highlightLabelText
          : colors.labelText;
      ctx.fillText(String(colLabels[j]), x, startY - 3);
    }

    // ---- 6. 行标签 ----
    ctx.font = `bold ${labelFontSize}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < rows; i++) {
      const x = startX - 4;
      const y = startY + i * cellH + cellH / 2;
      let color = colors.labelText;
      if (rowLabels[i] === 0) color = colors.baseLabelText;
      if (highlightRows && highlightRows.has(i))
        color = colors.highlightLabelText;
      ctx.fillStyle = color;
      const label = rowLabels[i] === 0 ? "B" : String(rowLabels[i]);
      ctx.fillText(label, x, y);
    }

    // ---- 7. 单元格 ----
    const cellFontSize = Math.max(
      8,
      Math.min(16, Math.min(cellW * 0.5, cellH * 0.5))
    );
    ctx.font = `${cellFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < rows; i++) {
      const isBaseRow = i === rows - 1;
      const isHiRow = highlightRows && highlightRows.has(i);
      for (let j = 0; j < cols; j++) {
        const x = startX + j * cellW;
        const y = startY + i * cellH;
        const val = M[i][j];
        const isHiCol = highlightCols && highlightCols.has(j);
        const isHiCell = highlightCells && highlightCells.has(i + "," + j);
        const isHi = isHiRow || isHiCol || isHiCell;
        const isDiag = i === j && !isBaseRow;

        let bg = colors.cellBg;
        let border = colors.cellBorder;
        let fg = colors.labelText;

        if (isBaseRow && val !== 0) {
          bg = colors.baseBg;
          border = colors.baseBorder;
          fg = colors.baseText;
        } else if (isDiag && val !== 0) {
          bg = colors.diagBg;
          border = colors.diagBorder;
          fg = colors.diagText;
        } else if (val !== 0) {
          bg = colors.nonZeroBg;
          border = colors.nonZeroBorder;
          fg = colors.nonZeroText;
        }
        if (isHi) {
          bg = colors.highlightBg;
          border = colors.highlightBorder;
          fg = colors.highlightText;
        }

        ctx.fillStyle = bg;
        ctx.fillRect(x, y, cellW - 1, cellH - 1);
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 2, cellH - 2);

        if (val !== 0) {
          ctx.fillStyle = fg;
          let text;
          if (typeof val === "number") {
            text = Number.isInteger(val) ? String(val) : val.toFixed(2);
          } else {
            text = String(val);
          }
          if (text.length > 6) text = text.slice(0, 6);
          ctx.fillText(text, x + cellW / 2, y + cellH / 2);
        }
      }
    }

    try {
      if (!canvasOverride) this.imageData = canvas.toDataURL("image/png");
    } catch (_) {}
  }

  _computeData() {
    const mechs = this.appState.mechanisms;
    const conns = this.appState.connections;
    const N = mechs.length;
    if (N === 0) return null;

    const fullM = buildConnectionMatrix(mechs, conns);

    if (this.mode === "subset") {
      const activeIdx = this.appState.activeIdx;
      if (activeIdx === -1 || activeIdx >= N) return null;
      return this._extractSubset(fullM, mechs, conns, activeIdx);
    }

    return this._extractFull(fullM, mechs);
  }

  _extractFull(M, mechs) {
    const N = mechs.length;
    const rowLabels = [...mechs.map((m) => m.id), 0];
    const colLabels = mechs.map((m) => m.id);

    // 只显示连接列（跳过坐标列）
    const dispM = [];
    for (let i = 0; i <= N; i++) {
      dispM.push(M[i].slice(0, N));
    }

    const highlightRows = new Set();
    const highlightCols = new Set();
    const highlightCells = new Set();

    const activeIdx = this.appState.activeIdx;
    if (activeIdx >= 0 && activeIdx < N) {
      highlightRows.add(activeIdx);
      highlightCols.add(activeIdx);
      for (let j = 0; j < N; j++) {
        if (dispM[activeIdx][j] !== 0) highlightCells.add(activeIdx + "," + j);
      }
      for (let i = 0; i <= N; i++) {
        if (dispM[i][activeIdx] !== 0) highlightCells.add(i + "," + activeIdx);
      }
    }

    return {
      M: dispM,
      rowLabels,
      colLabels,
      highlightCells,
      highlightRows,
      highlightCols,
    };
  }

  _extractSubset(M, mechs, conns, selectedIdx) {
    const N = mechs.length;
    const relevant = new Set([selectedIdx]);
    let includeBase = false;

    for (const c of conns) {
      const aIdx = c.planeA.mechanismIndex;
      const bIdx = c.planeB.mechanismIndex;
      if (aIdx === selectedIdx) {
        if (bIdx === -1) includeBase = true;
        else relevant.add(bIdx);
      }
      if (bIdx === selectedIdx) {
        if (aIdx === -1) includeBase = true;
        else relevant.add(aIdx);
      }
    }

    const sorted = [...relevant].sort((a, b) => a - b);
    sorted.splice(sorted.indexOf(selectedIdx), 1);
    sorted.unshift(selectedIdx);

    const rowLabels = sorted.map((idx) => mechs[idx].id);
    const colLabels = sorted.map((idx) => mechs[idx].id);
    if (includeBase) rowLabels.push(0);

    const dispM = [];
    for (let i = 0; i < rowLabels.length; i++) {
      const row = [];
      if (i < sorted.length) {
        for (let j = 0; j < colLabels.length; j++) {
          row.push(M[sorted[i]][sorted[j]]);
        }
      } else {
        for (let j = 0; j < colLabels.length; j++) {
          row.push(M[N][sorted[j]]);
        }
      }
      dispM.push(row);
    }

    const highlightRows = new Set([0]);
    const highlightCols = new Set([0]);
    const highlightCells = new Set();
    for (let j = 0; j < colLabels.length; j++) {
      if (dispM[0][j] !== 0) highlightCells.add("0," + j);
    }
    for (let i = 0; i < rowLabels.length; i++) {
      if (dispM[i][0] !== 0) highlightCells.add(i + ",0");
    }

    return {
      M: dispM,
      rowLabels,
      colLabels,
      highlightCells,
      highlightRows,
      highlightCols,
    };
  }

  /** 绘制到指定 canvas（供放大模态框使用）—— 重新绘制而非拉伸 */
  drawToCanvas(targetCanvas, width, height) {
    if (!targetCanvas) return;
    const W = Math.max(200, width || targetCanvas.clientWidth || 800);
    const H = Math.max(150, height || targetCanvas.clientHeight || 600);
    this._draw(targetCanvas, W, H, { upscale: true });
  }

  destroy() {
    this.canvas = null;
    this.appState = null;
  }
}
