export class MandelbrotFractal {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);

    // alpha: false でWebGLコンテキストを透過なしで取得（重要）
    this.gl = this.canvas.getContext('webgl', { alpha: false })
      || this.canvas.getContext('experimental-webgl', { alpha: false });

    if (!this.gl) {
      console.error('WebGL not supported');
      return;
    }

    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.offset = { x: -0.5, y: 0.0 };
    this.targetOffset = { x: -0.5, y: 0.0 };
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.velX = 0; // 慣性用の速度
    this.velY = 0;
    this.startTime = Date.now();

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const speed = 1.25;
      const factor = e.deltaY > 0 ? 1 / speed : speed;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const W = this.canvas.width;
      const H = this.canvas.height;

      // シェーダーの座標変換: c = (pixel - center) / H * 4.0 / zoom + offset
      // ズーム前後でマウス直下のフラクタル座標が不変になるよう offset を補正する
      // newOffset = oldOffset + mouseInFractalSpace * (1/oldZoom - 1/newZoom)
      const dx_fractal = (mx - W / 2) / H * 4.0;
      const dy_fractal = (H / 2 - my) / H * 4.0; // y軸は反転（WebGL座標系）

      const newZoom = this.targetZoom * factor;
      this.targetOffset.x += dx_fractal * (1 / this.targetZoom - 1 / newZoom);
      this.targetOffset.y += dy_fractal * (1 / this.targetZoom - 1 / newZoom);
      this.targetZoom = newZoom;
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      const scale = 4.0 / (this.canvas.height * this.zoom);
      const deltaX = -dx * scale;
      const deltaY = dy * scale;

      this.offset.x += deltaX;
      this.offset.y += deltaY;
      this.targetOffset.x = this.offset.x;
      this.targetOffset.y = this.offset.y;

      // 指数平滑化で速度を記録（ノイズを抑える）
      this.velX = this.velX * 0.3 + deltaX * 0.7;
      this.velY = this.velY * 0.3 + deltaY * 0.7;

      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      // mouseup時には慣性をそのまま残す（velX/velYはリセットしない）
    });

    // ----- Shaders -----
    const vs = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    // Fragment shader: 収束速度 → HSV 色相回転でカラーリング
    const fs = `
      precision highp float;
      uniform vec2 u_res;
      uniform float u_zoom;
      uniform vec2 u_off;
      uniform float u_time;

      vec3 hsv2rgb(float h, float s, float v) {
        float c = v * s;
        float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
        float m = v - c;
        vec3 rgb;
        if      (h < 60.0)  rgb = vec3(c, x, 0.0);
        else if (h < 120.0) rgb = vec3(x, c, 0.0);
        else if (h < 180.0) rgb = vec3(0.0, c, x);
        else if (h < 240.0) rgb = vec3(0.0, x, c);
        else if (h < 300.0) rgb = vec3(x, 0.0, c);
        else                rgb = vec3(c, 0.0, x);
        return rgb + vec3(m);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
        vec2 c = uv * 4.0 / u_zoom + u_off;

        vec2 z = vec2(0.0);
        float n = 0.0;
        const int MAXN = 100;

        for (int i = 0; i < MAXN; i++) {
          float nx = z.x * z.x - z.y * z.y + c.x;
          float ny = 2.0 * z.x * z.y + c.y;
          z = vec2(nx, ny);
          if (dot(z, z) > 16.0) break;
          n += 1.0;
        }

        if (n >= 99.5) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          // 収束速度を色相(hue)に変換: 鮮やかな虹色が出る
          float hue = mod(n * 3.6 + u_time * 20.0, 360.0);
          vec3 col = hsv2rgb(hue, 1.0, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }
      }
    `;

    const prog = this.createProgram(vs, fs);
    if (!prog) return;
    this.gl.useProgram(prog);

    const buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
      -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    ]), this.gl.STATIC_DRAW);

    const aPos = this.gl.getAttribLocation(prog, 'a_pos');
    this.gl.enableVertexAttribArray(aPos);
    this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, 0, 0);

    this.uRes = this.gl.getUniformLocation(prog, 'u_res');
    this.uZoom = this.gl.getUniformLocation(prog, 'u_zoom');
    this.uOff = this.gl.getUniformLocation(prog, 'u_off');
    this.uTime = this.gl.getUniformLocation(prog, 'u_time');

    this.animate();
  }

  compileShader(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  createProgram(vsSrc, fsSrc) {
    const vs = this.compileShader(this.gl.VERTEX_SHADER, vsSrc);
    const fs = this.compileShader(this.gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;

    const prog = this.gl.createProgram();
    this.gl.attachShader(prog, vs);
    this.gl.attachShader(prog, fs);
    this.gl.linkProgram(prog);

    if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  animate() {
    if (!this.container.contains(this.canvas)) return;

    const lerp = 0.12;
    // ズームのみ補間（スムーズなアニメーション）
    this.zoom += (this.targetZoom - this.zoom) * lerp;
    // オフセットは直接同期（ドラッグ後のズームオフセット補正のみ補間）
    this.offset.x += (this.targetOffset.x - this.offset.x) * lerp;
    this.offset.y += (this.targetOffset.y - this.offset.y) * lerp;

    // 慃性: ドラッグ退準後に速度を減衰させながら動かす
    if (!this.isDragging) {
      const friction = 0.90;
      this.velX *= friction;
      this.velY *= friction;
      const threshold = 1e-7;
      if (Math.abs(this.velX) > threshold || Math.abs(this.velY) > threshold) {
        this.offset.x += this.velX;
        this.offset.y += this.velY;
        this.targetOffset.x = this.offset.x;
        this.targetOffset.y = this.offset.y;
      }
    }

    this.gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    this.gl.uniform1f(this.uZoom, this.zoom);
    this.gl.uniform2f(this.uOff, this.offset.x, this.offset.y);
    // 経過秒数（小さい値）を渡す → float精度の問題を回避
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.gl.uniform1f(this.uTime, elapsed);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    requestAnimationFrame(() => this.animate());
  }
}
