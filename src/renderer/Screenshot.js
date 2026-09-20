import * as THREE from 'three';

let _renderer = null; // 单例离屏渲染器

/**
 * 截图工具（单例渲染器，避免多次创建 WebGL 上下文）
 */
export class Screenshot {
  /**
   * @param {SceneManager} sceneManager
   */
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
  }

  /**
   * 截取截图
   * @param {object} resolution - { width, height }
   * @param {boolean} hideUI - 是否隐藏 UI 控件
   * @returns {Promise<string>} dataURL
   */
  take(resolution, hideUI = true) {
    const { width, height } = resolution;
    if (width < 1 || height < 1) {
      return Promise.reject(new Error('分辨率无效'));
    }

    // 创建或复用离屏渲染器
    if (!_renderer) {
      _renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      _renderer.shadowMap.enabled = true;
      _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    return new Promise((resolve, reject) => {
      try {
        if (hideUI) {
          document.body.classList.add('hide-ui');
        }

        // 调整尺寸（固定像素比 1，保证输出清晰）
        _renderer.setSize(width, height, false);
        _renderer.setPixelRatio(1);
        _renderer.setClearColor(this.sceneManager.scene.background);

        // 复制当前相机参数
        const tmpCam = new THREE.PerspectiveCamera(
          this.sceneManager.camera.fov,
          width / height,
          this.sceneManager.camera.near,
          this.sceneManager.camera.far
        );
        tmpCam.position.copy(this.sceneManager.camera.position);
        tmpCam.up.copy(this.sceneManager.camera.up);
        tmpCam.lookAt(this.sceneManager.controls.target);
        tmpCam.updateProjectionMatrix();

        // 渲染
        _renderer.render(this.sceneManager.scene, tmpCam);

        // 获取图像
        const url = _renderer.domElement.toDataURL('image/png');
        resolve(url);
      } catch (err) {
        reject(err);
      } finally {
        if (hideUI) {
          document.body.classList.remove('hide-ui');
        }
      }
    });
  }

  /**
   * 释放离屏渲染器（应用退出时调用）
   */
  static dispose() {
    if (_renderer) {
      _renderer.dispose();
      if (_renderer.domElement && _renderer.domElement.parentNode) {
        _renderer.domElement.remove();
      }
      _renderer = null;
    }
  }
}