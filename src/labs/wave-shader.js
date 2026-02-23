export class WaveShader {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.gl = this.canvas.getContext('webgl', { alpha: false });

    if (!this.gl) return;

    this.startTime = Date.now();
    this.mouse = [0.5, 0.5];

    // ----- 波紋管理システム -----
    this.MAX_RIPPLES = 30;    // 同時に表示できる波紋の最大数
    this.ripples = [];        // { x, y, time }
    this.lastSpawnTime = 0;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / this.canvas.width;
      const ny = 1.0 - (e.clientY - rect.top) / this.canvas.height;

      const dx = nx - this.mouse[0];
      const dy = ny - this.mouse[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      // マウスが動いた場所に波紋を「置く」
      const now = Date.now();
      if (dist > 0.01 && now - this.lastSpawnTime > 50) {
        this.spawnRipple(nx, ny);
        this.lastSpawnTime = now;
      }

      this.mouse = [nx, ny];
    });

    const vs = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      
      // 波紋データ: (x, y, startTime, unused)
      uniform vec4 u_ripples[${this.MAX_RIPPLES}];
      uniform float u_rippleCount;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / u_resolution.y;
        
        // 基礎となる水面の揺れ（NoiseShaderと同様の深い青）
        float baseWave = sin(uv.x * 12.0 + u_time * 0.8) * 0.005 
                       + sin(uv.y * 15.0 + u_time * 0.5) * 0.005;
        
        vec2 distortedUV = uv + baseWave;
        
        // 波紋の合成
        float rippleTotal = 0.0;
        for (int i = 0; i < ${this.MAX_RIPPLES}; i++) {
          if (float(i) >= u_rippleCount) break;
          
          vec4 r = u_ripples[i];
          vec2 rPos = r.xy;
          float startTime = r.z;
          
          float age = u_time - startTime;
          if (age > 4.0) continue; // 4秒経った波は無視

          // 物理的に正しい波紋の広がり
          float dist = distance(uv * vec2(aspect, 1.0), rPos * vec2(aspect, 1.0));
          
          // 波の速度と周期
          float waveSpeed = 0.4;
          float currentRadius = age * waveSpeed;
          
          // 波の形（中心から広がる輪っか）
          float wave = sin((dist - currentRadius) * 40.0);
          
          // 減衰計算: 中心から離れるほど、時間が経つほど弱くなる
          float opacity = smoothstep(0.15, 0.0, abs(dist - currentRadius));
          opacity *= (1.0 - age / 4.0); // 寿命による減衰
          opacity *= smoothstep(0.5, 0.0, dist); // 距離による減衰
          
          rippleTotal += wave * opacity * 0.3;
        }

        // カラーパレット: 深海から水面へのグラデーション
        vec3 deepBlue = vec3(0.0, 0.05, 0.15);
        vec3 surfaceBlue = vec3(0.0, 0.4, 0.7);
        vec3 highlight = vec3(0.4, 0.8, 1.0);

        vec3 color = mix(deepBlue, surfaceBlue, distortedUV.y + rippleTotal);
        // 波の山にハイライトを追加
        color += highlight * max(0.0, rippleTotal) * 0.5;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const program = this.createProgram(vs, fs);
    this.gl.useProgram(program);

    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), this.gl.STATIC_DRAW);

    const pos = this.gl.getAttribLocation(program, 'position');
    this.gl.enableVertexAttribArray(pos);
    this.gl.vertexAttribPointer(pos, 2, this.gl.FLOAT, false, 0, 0);

    this.uTime = this.gl.getUniformLocation(program, 'u_time');
    this.uRes = this.gl.getUniformLocation(program, 'u_resolution');
    this.uRipples = this.gl.getUniformLocation(program, 'u_ripples');
    this.uRippleCount = this.gl.getUniformLocation(program, 'u_rippleCount');

    this.animate();
  }

  spawnRipple(x, y) {
    const now = (Date.now() - this.startTime) / 1000;
    if (this.ripples.length >= this.MAX_RIPPLES) {
      this.ripples.shift();
    }
    this.ripples.push({ x, y, time: now });
  }

  createProgram(vsSrc, fsSrc) {
    const vs = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vs, vsSrc);
    this.gl.compileShader(vs);
    const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fs, fsSrc);
    this.gl.compileShader(fs);
    const prog = this.gl.createProgram();
    this.gl.attachShader(prog, vs);
    this.gl.attachShader(prog, fs);
    this.gl.linkProgram(prog);
    return prog;
  }

  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  animate() {
    if (!this.container.contains(this.canvas)) return;
    const t = (Date.now() - this.startTime) / 1000;

    // 古い波紋をフィルタリング
    this.ripples = this.ripples.filter(r => t - r.time < 4.0);

    this.gl.uniform1f(this.uTime, t);
    this.gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);

    // 波紋データを転送
    const rippleData = new Float32Array(this.MAX_RIPPLES * 4);
    for (let i = 0; i < this.ripples.length; i++) {
      rippleData[i * 4 + 0] = this.ripples[i].x;
      rippleData[i * 4 + 1] = this.ripples[i].y;
      rippleData[i * 4 + 2] = this.ripples[i].time;
      rippleData[i * 4 + 3] = 0;
    }
    this.gl.uniform4fv(this.uRipples, rippleData);
    this.gl.uniform1f(this.uRippleCount, this.ripples.length);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    requestAnimationFrame(() => this.animate());
  }
}
