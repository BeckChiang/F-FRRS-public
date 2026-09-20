/**
 * 连接实体类
 * 表示两个机构平面之间的连接
 */
export class Connection {
  /**
   * @param {object} params
   * @param {number} params.id - 连接唯一ID
   * @param {object} params.planeA - { mechanismIndex: number, planeIndex: number }
   * @param {object} params.planeB - { mechanismIndex: number, planeIndex: number }
   */
  constructor({ planeA, planeB, id }) {
    this.id = id || 0;
    this.planeA = { ...planeA }; // { mechanismIndex, planeIndex }
    this.planeB = { ...planeB };
  }

  /**
   * 导出为纯对象（用于序列化）
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      planeA: {
        mechanismIndex: this.planeA.mechanismIndex,
        planeIndex: this.planeA.planeIndex,
      },
      planeB: {
        mechanismIndex: this.planeB.mechanismIndex,
        planeIndex: this.planeB.planeIndex,
      },
    };
  }

  /**
   * 从纯对象恢复（静态工厂方法）
   * @param {object} data - 由 toJSON 生成的对象
   * @returns {Connection}
   */
  static fromJSON(data) {
    return new Connection({
      id: data.id,
      planeA: data.planeA,
      planeB: data.planeB,
    });
  }

  /**
   * 检查两个平面是否相同
   * @param {object} plane - { mechanismIndex, planeIndex }
   * @param {object} other - { mechanismIndex, planeIndex }
   * @returns {boolean}
   */
  static areSamePlane(plane, other) {
    return plane.mechanismIndex === other.mechanismIndex &&
           plane.planeIndex === other.planeIndex;
  }

  /**
   * 检查当前连接是否包含指定平面
   * @param {object} plane - { mechanismIndex, planeIndex }
   * @returns {boolean}
   */
  hasPlane(plane) {
    return Connection.areSamePlane(this.planeA, plane) ||
           Connection.areSamePlane(this.planeB, plane);
  }

  /**
   * 获取另一个平面的信息（给定一个平面，返回对面的平面）
   * @param {object} plane - { mechanismIndex, planeIndex }
   * @returns {object|null} 另一个平面，如果未找到返回 null
   */
  getOtherPlane(plane) {
    if (Connection.areSamePlane(this.planeA, plane)) {
      return { ...this.planeB };
    }
    if (Connection.areSamePlane(this.planeB, plane)) {
      return { ...this.planeA };
    }
    return null;
  }
}