/**
 * 历史记录（撤销/重做）
 * - 使用增量快照（仅存储变化）
 * - 限制最大长度
 * - 提供 undo / redo 接口
 */
export class History {
  /**
   * @param {number} maxLength - 最大存储长度
   */
  constructor(maxLength = 200) {
    this.stack = [];
    this.index = -1;
    this.maxLength = maxLength;
    this._lastSerialized = null; // 用于去重
  }

  /**
   * 压入新状态
   * @param {object} state - 由 AppState.serialize() 生成的对象
   */
  push(state) {
    const serialized = JSON.stringify(state);
    // 如果与上一个状态相同，则跳过
    if (this._lastSerialized === serialized) return;
    this._lastSerialized = serialized;

    // 如果当前不在栈尾，则截断（丢弃未来的分支）
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    this.stack.push(serialized);
    if (this.stack.length > this.maxLength) {
      this.stack.shift();
      // 调整索引（因为shift后索引会变化）
      this.index = this.stack.length - 1;
    } else {
      this.index = this.stack.length - 1;
    }
  }

  /**
   * 撤销（回退到上一个状态）
   * @returns {object|null} 恢复的状态对象，如果无法撤销则返回 null
   */
  undo() {
    if (this.index <= 0) return null;
    this.index--;
    return JSON.parse(this.stack[this.index]);
  }

  /**
   * 重做（前进到下一个状态）
   * @returns {object|null} 恢复的状态对象，如果无法重做则返回 null
   */
  redo() {
    if (this.index >= this.stack.length - 1) return null;
    this.index++;
    return JSON.parse(this.stack[this.index]);
  }

  /**
   * 是否可以撤销
   * @returns {boolean}
   */
  canUndo() {
    return this.index > 0;
  }

  /**
   * 是否可以重做
   * @returns {boolean}
   */
  canRedo() {
    return this.index < this.stack.length - 1;
  }

  /**
   * 清空历史
   */
  clear() {
    this.stack = [];
    this.index = -1;
    this._lastSerialized = null;
  }

  /**
   * 获取当前栈大小（调试用）
   * @returns {number}
   */
  size() {
    return this.stack.length;
  }

  /**
   * 获取当前索引位置（调试用）
   * @returns {number}
   */
  currentIndex() {
    return this.index;
  }
}