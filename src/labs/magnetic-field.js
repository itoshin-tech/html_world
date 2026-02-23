export class MagneticField {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.particles = [];
        this.mouse = { x: null, y: null };
        this.gridSize = 30;

        this.init();
    }

    init() {
        this.resize();
        this.createParticles();
        this.animate();

        window.addEventListener('resize', () => this.resize());

        // マウス操作
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        this.container.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        // タッチ操作（スマホ対応）
        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const t = e.touches[0];
            this.mouse.x = t.clientX - rect.left;
            this.mouse.y = t.clientY - rect.top;
        }, { passive: false });
        this.container.addEventListener('touchend', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    resize() {
        this.width = this.canvas.width = this.container.clientWidth;
        this.height = this.canvas.height = this.container.clientHeight;
        this.createParticles();
    }

    createParticles() {
        this.particles = [];
        const rows = Math.ceil(this.height / this.gridSize);
        const cols = Math.ceil(this.width / this.gridSize);

        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                this.particles.push({
                    baseX: c * this.gridSize,
                    baseY: r * this.gridSize,
                    x: c * this.gridSize,
                    y: r * this.gridSize,
                    angle: 0
                });
            }
        }
    }

    animate() {
        if (!this.container.contains(this.canvas)) return;

        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.particles.forEach(p => {
            let angle = 0;
            if (this.mouse.x !== null) {
                angle = Math.atan2(this.mouse.y - p.baseY, this.mouse.x - p.baseX);
            }

            // Smooth rotate (shortest path)
            let diff = angle - p.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            p.angle += diff * 0.1;

            const length = 15;
            const tx = p.baseX + Math.cos(p.angle) * length;
            const ty = p.baseY + Math.sin(p.angle) * length;

            this.ctx.strokeStyle = '#007aff';
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(p.baseX, p.baseY);
            this.ctx.lineTo(tx, ty);
            this.ctx.stroke();

            // Dot at base
            this.ctx.fillStyle = 'rgba(0, 122, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(p.baseX, p.baseY, 1, 0, Math.PI * 2);
            this.ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }
}
