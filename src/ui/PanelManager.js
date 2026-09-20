// src/ui/PanelManager.js

/**
 * 面板管理器
 * 控制界面面板的显示/隐藏，管理激活状态
 * 不包含业务逻辑，仅负责UI切换
 */
export class PanelManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.uiPanel - 界面面板元素
   * @param {HTMLElement} options.genPanel - 生成面板元素
   * @param {HTMLElement} options.opPanel - 操作面板元素
   * @param {HTMLElement} options.connPanel - 连接面板元素
   * @param {HTMLElement} options.btnUi - 界面按钮
   * @param {HTMLElement} options.btnGen - 生成按钮
   * @param {HTMLElement} options.btnOp - 操作按钮
   * @param {HTMLElement} options.btnConn - 连接按钮
   */
  constructor({
    uiPanel, genPanel, opPanel, connPanel,
    btnUi, btnGen, btnOp, btnConn
  }) {
    this.panels = {
      ui: uiPanel,
      gen: genPanel,
      op: opPanel,
      conn: connPanel,
    };
    this.buttons = {
      ui: btnUi,
      gen: btnGen,
      op: btnOp,
      conn: btnConn,
    };
    this.activePanel = null; // 当前显示的面板ID: 'ui', 'gen', 'op', 'conn'
    this._boundEvents = [];

    // 初始化：默认显示界面面板
    this.show('ui');
  }

  /**
   * 显示指定面板，隐藏其他
   * @param {string} id - 面板标识: 'ui', 'gen', 'op', 'conn'
   * @param {Function} [onShow] - 显示后回调
   * @returns {boolean} 是否成功
   */
  show(id, onShow) {
    if (!this.panels[id]) {
      console.warn(`PanelManager: 未知面板ID "${id}"`);
      return false;
    }

    // 如果已经显示，不重复操作
    if (this.activePanel === id) {
      if (onShow) onShow();
      return true;
    }

    // 隐藏所有面板
    for (const key of Object.keys(this.panels)) {
      const panel = this.panels[key];
      panel.classList.add('hidden');
      // 移除按钮激活状态
      if (this.buttons[key]) {
        this.buttons[key].classList.remove('active');
      }
    }

    // 显示目标面板
    const target = this.panels[id];
    target.classList.remove('hidden');
    if (this.buttons[id]) {
      this.buttons[id].classList.add('active');
    }

    const previous = this.activePanel;
    this.activePanel = id;

    if (onShow) onShow();

    // 触发自定义事件，供外部监听
    const event = new CustomEvent('panelchange', {
      detail: { panel: id, previous }
    });
    document.dispatchEvent(event);

    return true;
  }

  /**
   * 切换面板（如果当前是目标则隐藏，否则显示）
   * @param {string} id - 面板标识
   * @param {Function} [onShow] - 显示时回调
   * @returns {boolean} 是否显示
   */
  toggle(id, onShow) {
    if (this.activePanel === id) {
      // 如果当前面板就是目标，不操作（或者可以选择隐藏所有）
      // 根据原逻辑，点击已激活按钮不会关闭面板，所以这里不做隐藏
      return false;
    }
    return this.show(id, onShow);
  }

  /**
   * 获取当前激活的面板ID
   * @returns {string|null}
   */
  getActive() {
    return this.activePanel;
  }

  /**
   * 获取面板元素
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  getPanel(id) {
    return this.panels[id] || null;
  }

  /**
   * 销毁，移除事件监听（如有）
   */
  destroy() {
    this._boundEvents.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._boundEvents = [];
    this.activePanel = null;
  }
}