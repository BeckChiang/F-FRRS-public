// src/utils/AnimationUtils.js

/**
 * 缓动函数集合
 */
export const Easing = {
  // 线性
  linear: (t) => t,

  // 二次
  quadraticIn: (t) => t * t,
  quadraticOut: (t) => t * (2 - t),
  quadraticInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // 三次
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => (--t) * t * t + 1,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  // 正弦
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t) => 0.5 * (1 - Math.cos(Math.PI * t)),

  // 指数
  expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoInOut: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return Math.pow(2, 10 * (2 * t - 1)) / 2;
    return (2 - Math.pow(2, -10 * (2 * t - 1))) / 2;
  },

  // 弹性
  elasticIn: (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  elasticInOut: (t) => {
    if (t === 0 || t === 1) return t;
    t *= 2;
    if (t < 1) {
      return -0.5 * Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    }
    return 0.5 * Math.pow(2, -10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI) + 1;
  },

  // 回弹
  backIn: (t) => t * t * (2.70158 * t - 1.70158),
  backOut: (t) => 1 - (--t) * t * (2.70158 * t + 1.70158),
  backInOut: (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    if (t < 0.5) {
      return (t * t * ((c2 + 1) * 2 * t - c2)) / 2;
    }
    return ((2 * t - 2) * (2 * t - 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
  },

  // 弹跳
  bounceOut: (t) => {
    const n1 = 7.5625,
          d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  bounceIn: (t) => 1 - Easing.bounceOut(1 - t),
  bounceInOut: (t) => {
    if (t < 0.5) {
      return (1 - Easing.bounceOut(1 - 2 * t)) / 2;
    }
    return (1 + Easing.bounceOut(2 * t - 1)) / 2;
  },
};

/**
 * 补间动画类
 * 对单个对象的属性进行插值动画
 */
export class Tween {
  /**
   * @param {object} target - 目标对象
   * @param {string} property - 属性名（支持嵌套，如 'position.x'）
   * @param {number|object} from - 起始值
   * @param {number|object} to - 结束值
   * @param {object} options - 配置
   * @param {number} options.duration - 持续时间(ms)，默认1000
   * @param {number} options.delay - 延迟(ms)，默认0
   * @param {string|Function} options.easing - 缓动函数名或自定义函数，默认 'cubicInOut'
   * @param {Function} options.onUpdate - 每帧更新回调
   * @param {Function} options.onComplete - 完成回调
   * @param {Function} options.onStart - 开始回调
   */
  constructor(target, property, from, to, options = {}) {
    this.target = target;
    this.property = property;
    this.from = from;
    this.to = to;
    this.duration = options.duration || 1000;
    this.delay = options.delay || 0;
    this.easing = options.easing || 'cubicInOut';
    this.onUpdate = options.onUpdate || null;
    this.onComplete = options.onComplete || null;
    this.onStart = options.onStart || null;

    this._startTime = null;
    this._elapsed = 0;
    this._running = false;
    this._finished = false;
    this._started = false;
    this._value = null;

    // 如果是对象插值（如 Vector3），需要支持
    this._isObject = typeof from === 'object' && from !== null;
    this._keys = this._isObject ? Object.keys(from) : null;
  }

  /**
   * 开始动画
   */
  start() {
    if (this._running) return this;
    this._running = true;
    this._finished = false;
    this._started = false;
    this._startTime = null;
    this._elapsed = 0;
    // 如果延迟为0，立即开始
    if (this.delay === 0) {
      this._startTime = performance.now();
    }
    return this;
  }

  /**
   * 停止动画
   */
  stop() {
    this._running = false;
    this._finished = true;
    return this;
  }

  /**
   * 更新动画（由 TweenManager 调用）
   * @param {number} now - 当前时间戳
   * @returns {boolean} 是否仍在运行
   */
  update(now) {
    if (!this._running || this._finished) return false;

    // 处理延迟
    if (this._startTime === null) {
      if (this.delay > 0) {
        // 首次调用时记录开始时间，考虑延迟
        this._startTime = now + this.delay;
        return true;
      } else {
        this._startTime = now;
      }
    }

    // 检查是否到达开始时间（含延迟）
    if (now < this._startTime) return true;

    if (!this._started) {
      this._started = true;
      if (this.onStart) this.onStart(this);
    }

    const elapsed = now - this._startTime;
    this._elapsed = elapsed;

    let progress = Math.min(elapsed / this.duration, 1);
    // 应用缓动
    const eased = this._applyEasing(progress);

    // 计算当前值
    const current = this._interpolate(eased);

    // 设置目标属性
    this._setValue(current);

    // 触发更新回调
    if (this.onUpdate) this.onUpdate(current, progress, this);

    if (progress >= 1) {
      this._finished = true;
      this._running = false;
      if (this.onComplete) this.onComplete(this);
      return false;
    }

    return true;
  }

  /**
   * 应用缓动函数
   */
  _applyEasing(progress) {
    if (typeof this.easing === 'function') {
      return this.easing(progress);
    }
    const easingFn = Easing[this.easing];
    if (easingFn) {
      return easingFn(progress);
    }
    // 默认使用三次缓入缓出
    return Easing.cubicInOut(progress);
  }

  /**
   * 插值计算
   */
  _interpolate(t) {
    if (this._isObject) {
      const result = {};
      for (const key of this._keys) {
        const fromVal = this.from[key];
        const toVal = this.to[key];
        if (typeof fromVal === 'number' && typeof toVal === 'number') {
          result[key] = fromVal + (toVal - fromVal) * t;
        } else {
          // 非数值类型直接使用 to 值（在 t=1 时）
          result[key] = t >= 1 ? toVal : fromVal;
        }
      }
      return result;
    } else {
      return this.from + (this.to - this.from) * t;
    }
  }

  /**
   * 设置目标属性值
   */
  _setValue(value) {
    const parts = this.property.split('.');
    let obj = this.target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] === undefined) return;
      obj = obj[parts[i]];
    }
    const lastKey = parts[parts.length - 1];
    obj[lastKey] = value;
  }

  /**
   * 获取当前进度 (0-1)
   */
  getProgress() {
    return Math.min(this._elapsed / this.duration, 1);
  }

  /**
   * 是否正在运行
   */
  isRunning() {
    return this._running && !this._finished;
  }

  /**
   * 是否已完成
   */
  isFinished() {
    return this._finished;
  }
}

/**
 * 补间管理器
 * 管理所有补间动画，驱动更新循环
 */
export class TweenManager {
  constructor() {
    this._tweens = [];
    this._toRemove = [];
    this._autoStart = true;
    this._running = false;
    this._rafId = null;
  }

  /**
   * 创建并添加一个补间
   */
  create(target, property, from, to, options = {}) {
    const tween = new Tween(target, property, from, to, options);
    this.add(tween);
    return tween;
  }

  /**
   * 添加补间到管理器
   */
  add(tween) {
    if (this._autoStart && !tween.isRunning()) {
      tween.start();
    }
    this._tweens.push(tween);
    this._startLoop();
    return tween;
  }

  /**
   * 移除补间
   */
  remove(tween) {
    const idx = this._tweens.indexOf(tween);
    if (idx !== -1) {
      this._tweens.splice(idx, 1);
    }
    if (this._tweens.length === 0) {
      this._stopLoop();
    }
  }

  /**
   * 清除所有补间
   */
  clear() {
    this._tweens = [];
    this._toRemove = [];
    this._stopLoop();
  }

  /**
   * 更新所有补间
   * @param {number} now - 当前时间戳
   */
  update(now = performance.now()) {
    if (this._tweens.length === 0) {
      this._stopLoop();
      return;
    }

    this._toRemove = [];
    for (const tween of this._tweens) {
      const alive = tween.update(now);
      if (!alive) {
        this._toRemove.push(tween);
      }
    }

    // 移除已完成的补间
    if (this._toRemove.length > 0) {
      for (const tween of this._toRemove) {
        const idx = this._tweens.indexOf(tween);
        if (idx !== -1) {
          this._tweens.splice(idx, 1);
        }
      }
      this._toRemove = [];
    }

    if (this._tweens.length === 0) {
      this._stopLoop();
    }
  }

  /**
   * 启动动画循环
   */
  _startLoop() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  /**
   * 停止动画循环
   */
  _stopLoop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * 循环更新
   */
  _loop() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((now) => {
      this.update(now);
      if (this._running && this._tweens.length > 0) {
        this._loop();
      }
    });
  }

  /**
   * 获取当前活动补间数量
   */
  count() {
    return this._tweens.length;
  }

  /**
   * 暂停所有补间
   */
  pauseAll() {
    for (const tween of this._tweens) {
      tween._running = false;
    }
    this._stopLoop();
  }

  /**
   * 恢复所有补间
   */
  resumeAll() {
    for (const tween of this._tweens) {
      if (!tween.isFinished()) {
        tween._running = true;
        // 重新计算开始时间，保持进度
        const now = performance.now();
        const elapsed = tween._elapsed;
        tween._startTime = now - elapsed;
      }
    }
    if (this._tweens.length > 0) {
      this._startLoop();
    }
  }
}

// 全局单例管理器
let _defaultManager = null;

/**
 * 获取默认的 TweenManager 单例
 */
export function getDefaultTweenManager() {
  if (!_defaultManager) {
    _defaultManager = new TweenManager();
  }
  return _defaultManager;
}

/**
 * 快速创建补间（使用默认管理器）
 */
export function tween(target, property, from, to, options = {}) {
  const manager = getDefaultTweenManager();
  return manager.create(target, property, from, to, options);
}

/**
 * 停止所有补间（默认管理器）
 */
export function stopAllTweens() {
  if (_defaultManager) {
    _defaultManager.clear();
  }
}