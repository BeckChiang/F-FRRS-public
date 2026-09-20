// src/ui/Notification.js

/**
 * 通知系统
 * 管理页面通知消息的显示、队列、自动消失和手动关闭
 */
export class Notification {
  /**
   * @param {HTMLElement} container - 通知容器DOM元素
   * @param {object} options - 配置选项
   * @param {number} options.maxItems - 最大同时显示数量，默认3
   * @param {number} options.defaultDuration - 默认显示时长(ms)，默认3000
   */
  constructor(container, options = {}) {
    this.container = container;
    this.maxItems = options.maxItems || 3;
    this.defaultDuration = options.defaultDuration || 3000;
    this.queue = [];
    this.active = null;
    this.timeouts = new Map();
  }

  /**
   * 显示通知
   * @param {string} message - 消息内容
   * @param {string} type - 类型: 'info', 'success', 'error', 'warning'
   * @param {number} duration - 显示时长(ms)，0表示不自动消失
   * @returns {string} 通知ID（可用于手动关闭）
   */
  show(message, type = 'info', duration = this.defaultDuration) {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const item = {
      id,
      message,
      type,
      duration: duration || this.defaultDuration,
    };
    this.queue.push(item);
    this._process();
    return id;
  }

  /**
   * 显示成功通知
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长
   * @returns {string} 通知ID
   */
  showSuccess(message, duration) {
    return this.show(message, 'success', duration);
  }

  /**
   * 显示错误通知
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长
   * @returns {string} 通知ID
   */
  showError(message, duration) {
    return this.show(message, 'error', duration);
  }

  /**
   * 显示警告通知
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长
   * @returns {string} 通知ID
   */
  showWarning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  /**
   * 显示信息通知
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长
   * @returns {string} 通知ID
   */
  showInfo(message, duration) {
    return this.show(message, 'info', duration);
  }

  /**
   * 处理队列，显示下一个通知
   * @private
   */
  _process() {
    // 如果当前有活跃通知或队列为空，不处理
    if (this.active || this.queue.length === 0) return;

    // 检查当前显示数量是否已达上限
    const visibleItems = this.container.querySelectorAll('.notif-item:not(.hiding)');
    if (visibleItems.length >= this.maxItems) return;

    const item = this.queue.shift();
    this.active = item;
    this._render(item);
  }

  /**
   * 渲染通知DOM
   * @param {object} item - 通知项
   * @private
   */
  _render(item) {
    const el = document.createElement('div');
    el.className = `notif-item ${item.type}`;
    el.dataset.id = item.id;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    el.innerHTML = `
      <span class="notif-icon">${icons[item.type] || 'ℹ️'}</span>
      <span class="notif-msg">${this._escapeHtml(item.message)}</span>
      <button class="notif-close" aria-label="关闭通知">✕</button>
    `;

    // 关闭按钮事件
    const closeBtn = el.querySelector('.notif-close');
    closeBtn.addEventListener('click', () => this._dismiss(item.id));

    // 添加到容器
    this.container.appendChild(el);

    // 设置自动消失定时器
    if (item.duration > 0) {
      const timer = setTimeout(() => this._dismiss(item.id), item.duration);
      this.timeouts.set(item.id, timer);
    }

    // 限制最大显示数量
    this._trim();
  }

  /**
   * 关闭通知
   * @param {string} id - 通知ID
   * @private
   */
  _dismiss(id) {
    const el = this.container.querySelector(`.notif-item[data-id="${id}"]`);

    if (el) {
      // 添加隐藏动画类
      el.classList.add('hiding');

      // 延迟移除DOM
      setTimeout(() => {
        if (el.parentNode) {
          el.remove();
        }
        // 清理定时器
        if (this.timeouts.has(id)) {
          clearTimeout(this.timeouts.get(id));
          this.timeouts.delete(id);
        }
        // 如果当前激活的通知被关闭，重置active并处理队列
        if (this.active && this.active.id === id) {
          this.active = null;
          this._process();
        }
      }, 300);
    } else {
      // 如果元素已不存在，仅清理状态
      if (this.active && this.active.id === id) {
        this.active = null;
        this._process();
      }
      if (this.timeouts.has(id)) {
        clearTimeout(this.timeouts.get(id));
        this.timeouts.delete(id);
      }
    }
  }

  /**
   * 限制同时显示的通知数量，移除最早的通知
   * @private
   */
  _trim() {
    const items = this.container.querySelectorAll('.notif-item:not(.hiding)');
    while (items.length > this.maxItems) {
      const first = items[0];
      if (first) {
        const id = first.dataset.id;
        // 直接移除，不触发动画
        if (this.timeouts.has(id)) {
          clearTimeout(this.timeouts.get(id));
          this.timeouts.delete(id);
        }
        first.remove();
        if (this.active && this.active.id === id) {
          this.active = null;
          this._process();
        }
        // 从队列中移除（如果还在队列中）
        const queueIdx = this.queue.findIndex(q => q.id === id);
        if (queueIdx !== -1) {
          this.queue.splice(queueIdx, 1);
        }
      }
    }
  }

  /**
   * 清除所有通知
   */
  clear() {
    // 清除所有定时器
    for (const [id, timer] of this.timeouts) {
      clearTimeout(timer);
    }
    this.timeouts.clear();

    // 清空容器
    this.container.innerHTML = '';
    this.queue = [];
    this.active = null;
  }

  /**
   * 转义HTML特殊字符，防止XSS
   * @param {string} text - 原始文本
   * @returns {string} 转义后的文本
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 获取当前显示的通知数量
   * @returns {number}
   */
  getVisibleCount() {
    return this.container.querySelectorAll('.notif-item:not(.hiding)').length;
  }

  /**
   * 获取队列中等待的通知数量
   * @returns {number}
   */
  getQueueCount() {
    return this.queue.length;
  }
}