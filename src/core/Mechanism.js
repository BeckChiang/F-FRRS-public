import * as THREE from "three";
//import { createMechanism } from "../utils/GeometryUtils.js";
import {
  createMechanism,
  computeWorldRotationFromNormals,
  computeL2AngleFromNormals,
} from "../utils/GeometryUtils.js";
/**
 * 机构实体类
 * 封装了单个机构的几何、材质、位置、旋转、L角度等所有数据
 * 负责 Three.js 组的构建、更新、序列化/反序列化及资源清理
 */
export class Mechanism {
  /**
   * @param {object} config
   * @param {number} config.id - 唯一标识
   * @param {THREE.Vector3} config.position - 位置
   * @param {THREE.Euler} config.worldRotation - 世界旋转
   * @param {number} config.l1Angle - L1 角度（度）
   * @param {number} config.l2Angle - L2 角度（度）
   * @param {number} config.armSize - L零件边长
   * @param {number} config.thickness - L零件厚度
   * @param {number} config.cubeSize - 立方体边长
   * @param {number} config.axisRadius - 轴半径
   */
  constructor(config) {
    this.id = config.id || 1;
    this.position = config.position || new THREE.Vector3(0, 0, 0);
    this.worldRotation =
      config.worldRotation || new THREE.Euler(0, 0, 0, "XYZ");
    this.l1Angle = config.l1Angle || 0;
    this.l2Angle = config.l2Angle || 0;
    this.armSize = config.armSize || 0.75;
    this.thickness = config.thickness || 0.125;
    this.cubeSize = config.cubeSize || 1;
    this.axisRadius = config.axisRadius || 0.125;
    // 移除圆角参数，固定使用内部计算

    this.group = null;
    this.normal = new THREE.Vector3(0, 0, 1)
      .applyEuler(this.worldRotation)
      .normalize();
    this._disposed = false;
    this._buildGroup();
  }

  /**
   * 构建 Three.js 组（内部调用）
   * 如果已有组则先释放
   */
  _buildGroup() {
    if (this.group) this.dispose();
    const {
      position,
      worldRotation,
      l1Angle,
      l2Angle,
      armSize,
      thickness,
      cubeSize,
      axisRadius,
    } = this;
    this.group = createMechanism(
      position,
      worldRotation,
      l1Angle,
      l2Angle,
      armSize,
      thickness,
      cubeSize,
      axisRadius,
      false
      // 不再传入圆角参数
    );
    this.group.userData.mechanismRef = this;
  }

  /**
   * 根据当前状态更新 Three.js 组（位置、旋转、L角度）
   * 当外部修改了 position / worldRotation / l1Angle / l2Angle 后调用
   */
  updateFromState() {
    if (!this.group) return;
    this.group.position.copy(this.position);
    this.group.quaternion.setFromEuler(this.worldRotation);
    this.group.userData.l1.rotation.z = THREE.MathUtils.degToRad(this.l1Angle);
    this.group.userData.l2.rotation.z = THREE.MathUtils.degToRad(this.l2Angle);
    this.normal = new THREE.Vector3(0, 0, 1)
      .applyEuler(this.worldRotation)
      .normalize();
  }

  /**
   * 释放 Three.js 资源（几何体、材质）
   * 调用后不可再使用该实例
   */
  dispose() {
    if (this._disposed || !this.group) return;

    // 遍历组中所有 Mesh，释放几何体和材质
    this.group.traverse((child) => {
      if (child.isMesh) {
        // 几何体
        if (child.geometry) {
          child.geometry.dispose();
        }
        // 材质（可能是数组）
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });

    // 如果组有父级，从场景移除（由外部负责）
    // 这里只清空引用
    this.group = null;
    this._disposed = true;
  }

  // ==================== 序列化 ====================

  /**
   * 导出为纯对象（用于保存 JSON）
   * @returns {object}
   */
  toJSON() {
    if (!this.group) {
      // 如果已释放，仍可导出存档数据（但不包含实时旋转）
      const euler = this.worldRotation.clone();
      return {
        id: this.id,
        position: [this.position.x, this.position.y, this.position.z],
        worldRotation: [
          THREE.MathUtils.radToDeg(euler.x),
          THREE.MathUtils.radToDeg(euler.y),
          THREE.MathUtils.radToDeg(euler.z),
        ],
        l1Angle: this.l1Angle,
        l2Angle: this.l2Angle,
        armSize: this.armSize,
        thickness: this.thickness,
        cubeSize: this.cubeSize,
        axisRadius: this.axisRadius,
      };
    }

    const euler = new THREE.Euler().setFromQuaternion(
      this.group.quaternion,
      "XYZ"
    );
    return {
      id: this.id,
      position: [this.position.x, this.position.y, this.position.z],
      worldRotation: [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z),
      ],
      l1Angle: this.l1Angle,
      l2Angle: this.l2Angle,
      armSize: this.armSize,
      thickness: this.thickness,
      cubeSize: this.cubeSize,
      axisRadius: this.axisRadius,
    };
  }

  /**
   * 从纯对象恢复（静态工厂方法）
   * @param {object} data - 由 toJSON 生成的对象
   * @returns {Mechanism}
   */
  static fromJSON(data) {
    return new Mechanism({
      id: data.id,
      position: new THREE.Vector3(
        data.position[0],
        data.position[1],
        data.position[2]
      ),
      worldRotation: new THREE.Euler(
        THREE.MathUtils.degToRad(data.worldRotation[0]),
        THREE.MathUtils.degToRad(data.worldRotation[1]),
        THREE.MathUtils.degToRad(data.worldRotation[2]),
        "XYZ"
      ),
      l1Angle: data.l1Angle,
      l2Angle: data.l2Angle,
      armSize: data.armSize,
      thickness: data.thickness,
      cubeSize: data.cubeSize,
      axisRadius: data.axisRadius,
    });
  }

  /**
 * 从简化格式恢复（文件导入专用）
 * @param {object} data - { i, p, s, a, b, c }
 * @param {number} thickness - 所有模块共用的 L 厚度
 * @returns {Mechanism}
 */
  static fromSimplifiedJSON(data, thickness) {
    const cubeSize = data.s;
    const position = new THREE.Vector3(data.p[0], data.p[1], data.p[2]);

    const aVec = new THREE.Vector3(data.a[0], data.a[1], data.a[2]).normalize();
    const bVec = new THREE.Vector3(data.b[0], data.b[1], data.b[2]).normalize();
    const cVec = new THREE.Vector3(data.c[0], data.c[1], data.c[2]).normalize();

    const worldRotation = computeWorldRotationFromNormals(aVec, bVec);
    const l1Angle = 0;
    const l2Angle = computeL2AngleFromNormals(aVec, bVec, cVec);

    const armSize = cubeSize - 2 * thickness;
    const axisRadius = cubeSize / 8;

    return new Mechanism({
      id: data.i,
      position,
      worldRotation,
      l1Angle,
      l2Angle,
      armSize,
      thickness,
      cubeSize,
      axisRadius,
    });
  }
}
