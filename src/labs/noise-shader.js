export class NoiseShader {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.gl = this.canvas.getContext('webgl', { alpha: false })
      || this.canvas.getContext('experimental-webgl', { alpha: false });

    if (!this.gl) return;

    this.startTime = Date.now();
    this.mouse = [0.5, 0.5];
    this.prevMouse = [0.5, 0.5];
    this.mouseActive = 0.0; // マウスがキャンバス上にいるか

    // ----- 渦度フィールド（Vortex System）-----
    this.MAX_V = 20;
    this.vortices = [];
    this.lastSpawnTime = 0;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // マウス操作
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / this.canvas.width;
      const ny = 1.0 - (e.clientY - rect.top) / this.canvas.height;

      const dx = nx - this.mouse[0];
      const dy = ny - this.mouse[1];
      const speed = Math.sqrt(dx * dx + dy * dy);

      // マウスが十分速く動いたとき、渦を生成（川の杭）
      const now = Date.now();
      if (speed > 0.008 && now - this.lastSpawnTime > 120) {
        // 速度ベクトルの垂直成分から回転方向を決定（自然なうずき方向）
        const sign = (dx - dy) > 0 ? 1 : -1;
        this.spawnVortex(nx, ny, speed, sign);
        this.lastSpawnTime = now;
      }

      this.prevMouse = [...this.mouse];
      this.mouse = [nx, ny];
    });

    this.canvas.addEventListener('mouseenter', () => { this.mouseActive = 1.0; });
    this.canvas.addEventListener('mouseleave', () => { this.mouseActive = 0.0; });

    // タッチ操作（スマホ対応）
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.mouseActive = 1.0;
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches[0];
      this.mouse = [
        (t.clientX - rect.left) / this.canvas.width,
        1.0 - (t.clientY - rect.top) / this.canvas.height,
      ];
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches[0];
      const nx = (t.clientX - rect.left) / this.canvas.width;
      const ny = 1.0 - (t.clientY - rect.top) / this.canvas.height;

      const dx = nx - this.mouse[0];
      const dy = ny - this.mouse[1];
      const speed = Math.sqrt(dx * dx + dy * dy);

      const now = Date.now();
      if (speed > 0.008 && now - this.lastSpawnTime > 120) {
        const sign = (dx - dy) > 0 ? 1 : -1;
        this.spawnVortex(nx, ny, speed, sign);
        this.lastSpawnTime = now;
      }

      this.prevMouse = [...this.mouse];
      this.mouse = [nx, ny];
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this.mouseActive = 0.0;
    });

    // ----- Vertex Shader -----
    const vs = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    // ----- Fragment Shader -----
    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2  u_resolution;
      uniform vec2  u_mouse;
      uniform float u_mouse_active; // 0.0 or 1.0

      // 渦フィールド（最大 ${this.MAX_V} 個）
      uniform vec4  u_vortices[${this.MAX_V}]; // (x, y, strength, life)
      uniform float u_vcount;                  // 有効な渦の数

      // ---- Value Noise ----
      float rand(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(rand(i),               rand(i + vec2(1.0, 0.0)), u.x),
          mix(rand(i + vec2(0.0, 1.0)), rand(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      // ---- fBm（雲ノイズ）----
      float fbm(vec2 p) {
        float v = 0.0, amp = 0.5;
        for (int i = 0; i < 6; i++) {
          v += amp * noise(p);
          p  *= 2.0;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float t  = u_time * 0.15;

        // ---- 障害物回避ロジック（ポテンシャル流モデル） ----
        // 煙の流れの基本ベクトルを想定（右下方向：1, -1）
        vec2 flowDir = normalize(vec2(1.0, -0.6));
        float cylR = 0.07;
        vec2 dV = uv - u_mouse;
        float dist_cyl = length(dV);
        
        // 円柱（杭）の存在による流線の歪みを計算
        // 理論：座標 P = P + (R^2 / r^2) * ( (P-M) - 2 * dot(P-M, V) * V ) 的な歪み
        // シンプルに「中心からの斥力」を「流れの直交方向」に強く効かせる
        vec2 cylUV = uv;
        if (dist_cyl > 0.001) {
            // 煙の流れる方向ベクトル
            vec2 flowDir = normalize(vec2(1.0, -0.6));
            
            // 下流側判定
            float dotProx = dot(dV / dist_cyl, flowDir);
            
            // 非対称性を劇的に強化 (4.0 -> 12.0) 
            // 杭の背後(downstream)に非常に長い影響範囲を持たせる
            float wakeExtension = 1.0 + max(0.0, dotProx) * 12.0;
            
            // 下流側ではforce（斥力）をあえて維持し、煙が中央に戻るのを防ぐ
            float forceScale = 1.5 + max(0.0, dotProx) * 1.5;
            float force = (cylR * cylR * forceScale) / (dist_cyl * dist_cyl + 0.001);
            
            float range = cylR * 10.0 * wakeExtension; 
            cylUV -= dV * force * smoothstep(range, cylR, dist_cyl) * u_mouse_active;
        }
        // ---- 渦度フィールドによる UV ワーピング（Rankine 渦モデル）----
        vec2 vortexWarp = vec2(0.0);
        for (int i = 0; i < ${this.MAX_V}; i++) {
          float active = step(float(i) + 0.5, u_vcount);
          vec4  v  = u_vortices[i];
          vec2  d  = uv - v.xy;
          float dist_vortex = length(d);

          // 方向ベクトル（ゼロ除算防止）
          vec2 dir     = d / max(dist_vortex, 0.001);
          vec2 tangent = vec2(-dir.y, dir.x); // 接線方向

          // Rankine 渦: 中心(r<core)は剛体回転、外側は 1/r 減衰
          float core  = 0.04;
          float speed = (dist_vortex < core)
            ? dist_vortex / (core * core)          // 固体回転コア（特異点なし）
            : 1.0 / (dist_vortex + 0.001);         // 外側は渦糸

          // 影響範囲を exp で制限（半径 ~0.09 程度で急激に消える）
          float falloff = exp(-dist_vortex * dist_vortex / 0.008);

          vortexWarp += tangent * speed * v.z * v.w * falloff * 0.018 * active;
        }

        // 渦で歪めた UV でノイズをサンプリング（円柱回避UV + 渦ワープ）
        vec2 warpedUV = cylUV + vortexWarp;

        // ---- ドメインワーピング（本来の雲の流れ）----
        vec2 q = vec2(
          fbm(warpedUV + t * 0.5),
          fbm(warpedUV + vec2(5.2, 1.3) + t * 0.3)
        );
        vec2 r_warp = vec2(
          fbm(warpedUV + 4.0 * q + vec2(1.7, 9.2) + t * 0.2),
          fbm(warpedUV + 4.0 * q + vec2(8.3, 2.8) + t * 0.1)
        );
        float f = fbm(warpedUV + 4.0 * r_warp);

        // ---- カーソルのライト効果は削除 ----

        // ---- カラーパレット ----
        vec3 col = mix(vec3(0.01, 0.02, 0.1),   vec3(0.0, 0.3, 0.8),  clamp(f * f * 4.0, 0.0, 1.0));
        col = mix(col, vec3(0.0, 0.8, 1.0),    clamp(f * f * f * 6.0, 0.0, 1.0));
        col = mix(col, vec3(0.5, 0.0, 1.0), clamp(length(q) * 0.8, 0.0, 1.0));

        // ---- 円柱の視覚表示（装飾を排し、流れの観察を優先） ----
        float edge = smoothstep(cylR, cylR * 0.95, dist_cyl) * u_mouse_active;
        vec3 cylColor = vec3(0.01, 0.1, 0.25); // より青に近い色
        col = mix(col, cylColor, edge);
 // エッジにわずかな発光

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const prog = this.createProgram(vs, fs);
    if (!prog) return;
    this.gl.useProgram(prog);

    const buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), this.gl.STATIC_DRAW);

    const aPos = this.gl.getAttribLocation(prog, 'a_pos');
    this.gl.enableVertexAttribArray(aPos);
    this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, 0, 0);

    this.uTime = this.gl.getUniformLocation(prog, 'u_time');
    this.uRes = this.gl.getUniformLocation(prog, 'u_resolution');
    this.uMouse = this.gl.getUniformLocation(prog, 'u_mouse');
    this.uActive = this.gl.getUniformLocation(prog, 'u_mouse_active');
    this.uVcount = this.gl.getUniformLocation(prog, 'u_vcount');

    // 渦の uniform 位置（配列要素を個別に取得するのが WebGL 1.0 で最も互換性が高い）
    this.uVortices = [];
    for (let i = 0; i < this.MAX_V; i++) {
      this.uVortices.push(this.gl.getUniformLocation(prog, `u_vortices[${i}]`));
    }

    this.animate();
  }

  spawnVortex(x, y, speed, sign) {
    if (this.vortices.length >= this.MAX_V) this.vortices.shift();
    this.vortices.push({
      x, y,
      strength: Math.min(speed * 4.0, 0.7) * sign,
      life: 1.0,
      fadeIn: 0.0, // フェードイン: 0→ 1 に徐々に増加
    });
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
      console.error('Link error:', this.gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  compileShader(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.error('Compile error:', this.gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  animate() {
    if (!this.container.contains(this.canvas)) return;

    // 渦が徐々に多い印象をする（fadeIn 上昇 + life 減衰）
    this.vortices = this.vortices.filter(v => {
      v.fadeIn = Math.min(v.fadeIn + 0.06, 1.0); // 約 17フレームでフェードイン
      v.life *= 0.993;
      return v.life > 0.02;
    });

    // 渦データを GPU に転送（fadeIn を強度に捺屋に適用）
    const count = Math.min(this.vortices.length, this.MAX_V);
    for (let i = 0; i < this.MAX_V; i++) {
      if (i < count) {
        const v = this.vortices[i];
        // strength * fadeIn: 胨時は弱く、完全に生まれたらフル強度
        this.gl.uniform4f(this.uVortices[i], v.x, v.y, v.strength * v.fadeIn, v.life);
      } else {
        this.gl.uniform4f(this.uVortices[i], 0, 0, 0, 0);
      }
    }
    this.gl.uniform1f(this.uVcount, count);

    const elapsed = (Date.now() - this.startTime) / 1000;
    this.gl.uniform1f(this.uTime, elapsed);
    this.gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.uMouse, this.mouse[0], this.mouse[1]);
    this.gl.uniform1f(this.uActive, this.mouseActive);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    requestAnimationFrame(() => this.animate());
  }
}
