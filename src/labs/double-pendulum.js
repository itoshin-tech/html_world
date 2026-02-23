/**
 * DoublePendulum Lab
 * 二重振子シミュレーション
 *
 * - RK4（Runge-Kutta 4次）法による高精度物理演算
 * - わずかに初期角度が異なる複数の振子を同時実行 → カオスを可視化
 * - Canvas 2D による軌跡の残像描画
 * - マウスドラッグで第1振子の初期角度を設定
 */

export class DoublePendulum {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // --- 物理パラメータ ---
        this.g = 9.81;      // 重力加速度
        this.L1 = 140;      // 第1振子の長さ (px → 正規化スケール)
        this.L2 = 110;      // 第2振子の長さ
        this.m1 = 10;       // 第1振子の質量
        this.m2 = 8;        // 第2振子の質量
        this.dt = 0.018;     // 時間ステップ（遅くする）

        // --- UIステート ---
        this.isDragging = false;
        this.baseAngle = Math.PI * 0.75; // デフォルト初期角度

        // --- カオス表示用の複数振子 ---
        // 少しずつ初期角度をずらした振子群
        this.PENDULUM_COUNT = 8;
        this.pendulums = [];

        // 各振子の残像トレール
        this.trails = [];

        // ネオンカラーパレット
        this.palette = [
            '#ff2d78', '#ff6b35', '#ffe234',
            '#3dff8f', '#00e5ff', '#7c4dff',
            '#ff4fc8', '#29ffb8',
        ];

        this.animFrameId = null;
        this.running = true;
        this.startTime = null;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.resetPendulums(this.baseAngle);
        this.setupMouseEvents();
        this.animate();
    }

    resize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.cx = this.canvas.width / 2;
        this.cy = this.canvas.height * 0.35; // 支点は上寄り

        // アームの長さをキャンバスサイズに合わせてスケール
        // 小さい辺の 28% / 22% を基準にすることで画面からはみ出さない
        const baseSize = Math.min(this.canvas.width, this.canvas.height);
        this.L1 = baseSize * 0.28; // デスクトップ500px → 140px相当
        this.L2 = baseSize * 0.22; // デスクトップ500px → 110px相当
    }

    /** 振子群をリセット（初期角度 θ1 を基準に微小オフセット） */
    resetPendulums(theta1Base) {
        this.pendulums = [];
        this.trails = [];
        for (let i = 0; i < this.PENDULUM_COUNT; i++) {
            const offset = (i - this.PENDULUM_COUNT / 2) * 0.003; // ごくわずかなずれ
            this.pendulums.push({
                // [θ1, ω1, θ2, ω2]
                state: [theta1Base + offset, 0, theta1Base + offset + 0.1, 0],
            });
            this.trails.push([]);
        }
    }

    // =====================================================
    // RK4 物理演算
    // =====================================================

    /** 二重振子の運動方程式 dState/dt を返す */
    derivatives(state) {
        const [th1, w1, th2, w2] = state;
        const { g, L1, L2, m1, m2 } = this;

        // スケール調整（px単位 → 物理単位に近似）
        const l1 = L1 / 100;
        const l2 = L2 / 100;

        const delta = th2 - th1;
        const denom1 = (m1 + m2) * l1 - m2 * l1 * Math.cos(delta) * Math.cos(delta);
        const denom2 = (l2 / l1) * denom1;

        const dw1 = (
            m2 * l1 * w1 * w1 * Math.sin(delta) * Math.cos(delta)
            + m2 * g * Math.sin(th2) * Math.cos(delta)
            + m2 * l2 * w2 * w2 * Math.sin(delta)
            - (m1 + m2) * g * Math.sin(th1)
        ) / denom1;

        const dw2 = (
            -m2 * l2 * w2 * w2 * Math.sin(delta) * Math.cos(delta)
            + (m1 + m2) * g * Math.sin(th1) * Math.cos(delta)
            - (m1 + m2) * l1 * w1 * w1 * Math.sin(delta)
            - (m1 + m2) * g * Math.sin(th2)
        ) / denom2;

        return [w1, dw1, w2, dw2];
    }

    /** RK4 ワンステップ */
    stepRK4(state) {
        const { dt } = this;
        const add = (a, b, s) => a.map((v, i) => v + b[i] * s);

        const k1 = this.derivatives(state);
        const k2 = this.derivatives(add(state, k1, dt / 2));
        const k3 = this.derivatives(add(state, k2, dt / 2));
        const k4 = this.derivatives(add(state, k3, dt));

        return state.map((v, i) => v + (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) * dt / 6);
    }

    /** 角度から先端座標を計算 */
    getPositions(state) {
        const [th1, , th2] = state;
        const x1 = this.cx + this.L1 * Math.sin(th1);
        const y1 = this.cy + this.L1 * Math.cos(th1);
        const x2 = x1 + this.L2 * Math.sin(th2);
        const y2 = y1 + this.L2 * Math.cos(th2);
        return { x1, y1, x2, y2 };
    }

    // =====================================================
    // マウスインタラクション
    // =====================================================

    setupMouseEvents() {
        const onDown = (cx, cy) => {
            this.isDragging = true;
            this.running = false;
        };
        const onMove = (cx, cy) => {
            if (!this.isDragging) return;
            // 支点からのドラッグ角度を計算
            const dx = cx - this.cx;
            const dy = cy - this.cy;
            this.baseAngle = Math.atan2(dx, dy); // θ = atan2(x, y) で振子と同じ基準
            // プレビュー: 静止状態でドラッグ中に角度を反映
            this.resetPendulums(this.baseAngle);
        };
        const onUp = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.running = true;
        };

        this.canvas.addEventListener('mousedown', e => {
            const r = this.canvas.getBoundingClientRect();
            onDown(e.clientX - r.left, e.clientY - r.top);
        });
        window.addEventListener('mousemove', e => {
            const r = this.canvas.getBoundingClientRect();
            onMove(e.clientX - r.left, e.clientY - r.top);
        });
        window.addEventListener('mouseup', onUp);

        // タッチ操作
        this.canvas.addEventListener('touchstart', e => {
            const r = this.canvas.getBoundingClientRect();
            const t = e.touches[0];
            onDown(t.clientX - r.left, t.clientY - r.top);
            e.preventDefault();
        }, { passive: false });
        window.addEventListener('touchmove', e => {
            const r = this.canvas.getBoundingClientRect();
            const t = e.touches[0];
            onMove(t.clientX - r.left, t.clientY - r.top);
        });
        window.addEventListener('touchend', onUp);
    }

    // =====================================================
    // 描画
    // =====================================================

    drawBackground() {
        // 半透明の黒で残像フェード
        this.ctx.fillStyle = 'rgba(0, 2, 15, 0.18)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawTip(px, py, color) {
        // 先端の光点
        const grd = this.ctx.createRadialGradient(px, py, 0, px, py, 12);
        grd.addColorStop(0, color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = grd;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 12, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawPendulum(state, color) {
        const { x1, y1, x2, y2 } = this.getPositions(state);
        const ctx = this.ctx;

        // --- 振子の棒 ---
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // --- 関節の円 ---
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x1, y1, 5, 0, Math.PI * 2);
        ctx.fill();

        // --- 先端の輝点 ---
        this.drawTip(x2, y2, color);

        ctx.globalAlpha = 1.0;
        return { x2, y2 };
    }

    drawTrail(trail, color) {
        if (trail.length < 2) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.lineWidth = 1.5;
        for (let i = 1; i < trail.length; i++) {
            const alpha = (i / trail.length) * 0.7;
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawOrigin() {
        // 支点の描画
        const ctx = this.ctx;
        const grd = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, 18);
        grd.addColorStop(0, 'rgba(255,255,255,0.5)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHint() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        // タッチとマウス両方に対応したヒント
        const isTouchDevice = ('ontouchstart' in window);
        const hint = isTouchDevice
            ? 'タップ＆スワイプで初期角度を設定 → 離すと開始'
            : 'ドラッグして初期角度を設定 → 離すと開始';
        ctx.fillText(hint, this.canvas.width / 2, this.canvas.height - 20);
        ctx.restore();
    }

    // =====================================================
    // アニメーションループ
    // =====================================================

    animate() {
        if (!this.container.contains(this.canvas)) return;
        this.animFrameId = requestAnimationFrame(() => this.animate());

        this.drawBackground();

        const TRAIL_MAX = 60; // 残像の最大点数（少なめで動きを見やすく）

        for (let i = 0; i < this.PENDULUM_COUNT; i++) {
            const p = this.pendulums[i];
            const trail = this.trails[i];
            const color = this.palette[i % this.palette.length];

            // 物理演算（dragging中は停止）
            if (this.running) {
                p.state = this.stepRK4(p.state);
                // サブステップなし（スピード調整済み）
            }

            const pos = this.getPositions(p.state);

            // 軌跡の蓄積
            trail.push({ x: pos.x2, y: pos.y2 });
            if (trail.length > TRAIL_MAX) trail.shift();

            // 軌跡と振子を描画
            this.drawTrail(trail, color);
            // 最初の振子のみ棒と先端を描画（他はトレールのみ）
            if (i === 0) {
                this.drawPendulum(p.state, color);
            }
        }

        this.drawOrigin();
        this.drawHint();

        // ドラッグ中のインジケーター
        if (this.isDragging) {
            const pos0 = this.getPositions(this.pendulums[0].state);
            const ctx = this.ctx;
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.setLineDash([4, 6]);
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(this.cx, this.cy);
            ctx.lineTo(pos0.x1, pos0.y1);
            ctx.lineTo(pos0.x2, pos0.y2);
            ctx.stroke();
            ctx.restore();
        }
    }
}
