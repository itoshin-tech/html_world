import './styles/index.css';
import gsap from 'gsap';

console.log('🚀 Hello from Antigravity! Connection confirmed at:', new Date().toLocaleTimeString());

// --- Hero Canvas Animation (2D Particles Demo) ---
const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');

let width, height, particles = [];

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  initParticles();
}

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.size = Math.random() * 2 + 1;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.speedY = (Math.random() - 0.5) * 0.5;
    this.alpha = Math.random() * 0.5 + 0.1;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
      this.reset();
    }
  }

  draw() {
    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  const count = Math.min(Math.floor(width * height / 10000), 100);
  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }
}

function animate() {
  ctx.clearRect(0, 0, width, height);

  // Background effect (very subtle gradient)
  const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
  grad.addColorStop(0, '#0a0a0d');
  grad.addColorStop(1, '#050505');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  particles.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
resize();
animate();

// --- GSAP Animations ---
gsap.from('.hero-content > *', {
  y: 30,
  opacity: 0,
  duration: 1.2,
  stagger: 0.2,
  ease: 'power3.out'
});

// --- Labs Setup ---
const labs = [
  {
    id: 'fluid-particles',
    title: 'Fluid Particles',
    desc: '2D Canvasを用いた物理シミュレーション。パーティクルが空間を浮遊し、視覚的な静寂を作り出します。',
    tech: 'Canvas API / GSAP',
    category: '2D'
  },
  {
    id: 'atmospheric-geometry',
    title: 'Atmospheric Geometry',
    desc: 'Three.jsを用いた3D空間の抽象表現。幾何学的な構造体が高密度の星々の中で回転します。',
    tech: 'Three.js / WebGL',
    category: '3D'
  },
  {
    id: 'noise-shader',
    title: 'Noise Shader',
    desc: 'WebGLシェーダー（GLSL）による、フラクタルノイズを利用したサイケデリックなライブ映像。GPUが即時演算する圧倒的な視覚体験。マウスを動かすと色が変化する。',
    tech: 'WebGL / GLSL / fBm',
    category: 'Shader'
  },
  {
    id: 'magnetic-field',
    title: 'Magnetic Field',
    desc: '2D Canvasを用いた磁場シミュレーション。グリッド上の数千のポインターが、磁石に引き寄せられるようにマウスの動きを追いかけます。',
    tech: 'Canvas API / Physics',
    category: '2D'
  },
  {
    id: 'wave-shader',
    title: 'Wave Ripple',
    desc: '水面の波紋を数学的に表現したシェーダー。マウスを動かす地点から波紋が広がり、光と影の干渉をリアルタイムに計算します。',
    tech: 'WebGL / GLSL',
    category: 'Shader'
  },
  {
    id: 'mandelbrot-fractal',
    title: 'Mandelbrot Garden',
    desc: '無限の深淵へと続くフラクタル図形。マウスホイールで拡大、ドラッグで移動。数学が描く無限の美しさを探索してください。',
    tech: 'WebGL / GLSL / Fractal',
    category: 'Shader'
  },
  {
    id: 'terrain-flyover',
    title: 'Terrain Flyover',
    desc: 'フラクタル地形の上空を無限に滑空する3Dデモ。レトロなワイヤーフレームと霧が織りなすサイバー空間。',
    tech: 'Three.js / GLSL / Perlin Noise',
    category: '3D'
  },
  {
    id: 'double-pendulum',
    title: 'Double Pendulum',
    desc: 'わずかな初期角度の差が全く異なる軌跡を生む「カオス」を可視化。複数の振子が描くネオンの軌跡が幻想的な絵を織りなす。ドラッグで初期角度を自由に設定できる。',
    tech: 'Canvas 2D / RK4 Physics / Chaos Theory',
    category: 'Physics'
  }
];

const labsGrid = document.getElementById('labs-grid');

// Modal Setup
const modal = document.createElement('div');
modal.className = 'lab-modal';
modal.innerHTML = `
  <div class="modal-overlay"></div>
  <div class="modal-container">
    <button class="modal-close">&times;</button>
    <div class="modal-content">
      <div id="canvas-container"></div>
      <div class="modal-info">
        <h2 id="modal-title"></h2>
        <p id="modal-desc"></p>
        <div id="modal-tech"></div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(modal);

const closeModal = () => {
  modal.classList.remove('active');
  const container = document.getElementById('canvas-container');
  container.innerHTML = ''; // Clean up canvas
};

modal.querySelector('.modal-close').addEventListener('click', closeModal);
modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

labs.forEach(lab => {
  const card = document.createElement('div');
  card.className = 'lab-card';
  card.innerHTML = `
    <div class="lab-card-content">
      <span class="lab-category">${lab.category}</span>
      <h3 class="lab-title">${lab.title}</h3>
      <p class="lab-desc">${lab.desc}</p>
      <div class="lab-tech">${lab.tech}</div>
    </div>
  `;

  card.addEventListener('click', async () => {
    document.getElementById('modal-title').textContent = lab.title;
    document.getElementById('modal-desc').textContent = lab.desc;
    document.getElementById('modal-tech').textContent = lab.tech;
    modal.classList.add('active');

    if (lab.id === 'atmospheric-geometry') {
      const { AtmosphericGeometry } = await import('./labs/atmospheric-geometry.js');
      new AtmosphericGeometry('canvas-container');
    } else if (lab.id === 'fluid-particles') {
      const { FluidParticles } = await import('./labs/fluid-particles.js');
      new FluidParticles('canvas-container');
    } else if (lab.id === 'noise-shader') {
      const { NoiseShader } = await import('./labs/noise-shader.js');
      new NoiseShader('canvas-container');
    } else if (lab.id === 'magnetic-field') {
      const { MagneticField } = await import('./labs/magnetic-field.js');
      new MagneticField('canvas-container');
    } else if (lab.id === 'wave-shader') {
      const { WaveShader } = await import('./labs/wave-shader.js');
      new WaveShader('canvas-container');
    } else if (lab.id === 'mandelbrot-fractal') {
      const { MandelbrotFractal } = await import('./labs/mandelbrot-fractal.js');
      new MandelbrotFractal('canvas-container');
    } else if (lab.id === 'terrain-flyover') {
      const { TerrainFlyover } = await import('./labs/terrain-flyover.js');
      new TerrainFlyover('canvas-container');
    } else if (lab.id === 'double-pendulum') {
      const { DoublePendulum } = await import('./labs/double-pendulum.js');
      new DoublePendulum('canvas-container');
    }
  });

  labsGrid.appendChild(card);
});

// Add styles dynamically
const style = document.createElement('style');
style.textContent = `
  .lab-card {
    background: var(--secondary-color);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    padding: 1.5rem;
    transition: all 0.4s cubic-bezier(0.2, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    /* タップ操作で見た目がフィードバックするように */
    -webkit-tap-highlight-color: transparent;
  }
  .lab-card:hover {
    transform: translateY(-8px);
    border-color: var(--accent-color);
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  }
  /* タッチデバイスでのフィードバック */
  .lab-card:active {
    transform: scale(0.97);
    border-color: var(--accent-color);
  }
  .lab-category {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent-color);
    margin-bottom: 0.5rem;
    display: block;
  }
  .lab-title {
    font-size: 1.4rem;
    margin-bottom: 0.8rem;
  }
  .lab-desc {
    font-size: 0.9rem;
    opacity: 0.6;
    margin-bottom: 1.2rem;
    line-height: 1.6;
  }
  .lab-tech {
    font-size: 0.8rem;
    font-weight: 500;
    opacity: 0.4;
  }

  /* Modal Styles */
  .lab-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
  }
  .lab-modal.active {
    opacity: 1;
    pointer-events: auto;
  }
  .modal-overlay {
    position: absolute;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .modal-container {
    position: relative;
    width: 92%;
    max-width: 1000px;
    height: 85vh;
    /* モバイルブラウザのアドレスバー考慮 */
    max-height: 85svh;
    background: var(--bg-color);
    border: 1px solid var(--glass-border);
    border-radius: 24px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    z-index: 10;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    line-height: 1;
  }
  .modal-close:hover, .modal-close:active {
    background: rgba(255,255,255,0.2);
  }
  .modal-content {
    display: grid;
    grid-template-columns: 1fr 280px;
    height: 100%;
    overflow: hidden;
  }
  #canvas-container {
    background: #000;
    position: relative;
    overflow: hidden;
    /* OSレベルのピンチズームを無効化: これがないとブラウザがピンチを横取りする */
    touch-action: none;
  }
  .modal-info {
    padding: 2rem;
    border-left: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow-y: auto;
  }
  #modal-title { margin-bottom: 0.8rem; font-size: 1.6rem; line-height: 1.2; }
  #modal-desc { opacity: 0.7; line-height: 1.7; margin-bottom: 1.5rem; font-size: 0.9rem; }
  #modal-tech { font-size: 0.75rem; font-weight: 600; color: var(--accent-color); text-transform: uppercase; letter-spacing: 0.08em; }

  /* タブレット以下 (768px): 縦並びレイアウト */
  @media (max-width: 768px) {
    .modal-container {
      width: 96%;
      height: 90vh;
      max-height: 90svh;
      border-radius: 20px;
    }
    .modal-content {
      grid-template-columns: 1fr;
      /* キャンバス60% + 情報40% の縦割り */
      grid-template-rows: 60% 40%;
    }
    #canvas-container {
      height: 100%;
    }
    .modal-info {
      border-left: none;
      border-top: 1px solid var(--glass-border);
      padding: 1rem 1.2rem;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    #modal-title { font-size: 1.2rem; margin-bottom: 0.3rem; width: 100%; }
    #modal-desc  { font-size: 0.82rem; margin-bottom: 0.5rem; width: 100%; }
  }

  /* スマホ (480px以下) */
  @media (max-width: 480px) {
    .modal-container {
      width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }
    .modal-content {
      grid-template-rows: 55% 45%;
    }
    .modal-close {
      top: 12px;
      right: 12px;
    }
    .modal-info {
      padding: 0.8rem 1rem;
    }
    #modal-title { font-size: 1.1rem; }
    #modal-desc  { font-size: 0.8rem; line-height: 1.5; }
  }
`;
// styleを一度だけ追加（バグ修正: 以前は2回appendされていた）
document.head.appendChild(style);
