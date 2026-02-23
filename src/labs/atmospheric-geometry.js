import * as THREE from 'three';

export class AtmosphericGeometry {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        // 視点移動用のステート
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0 };
        this.velocity = { x: 0.001, y: 0.003 }; // 回転速度と方向
        this.mouse = { x: 0, y: 0 };
        this.isDragging = false;

        this.init();
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;

        // Objects - Switched to a beautiful TorusKnot
        const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
        const material = new THREE.MeshPhongMaterial({
            color: 0x007aff,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
        });

        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        // Particles/Stars
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 500;
        const posArray = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 10;
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const starsMaterial = new THREE.PointsMaterial({
            size: 0.02,
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x007aff, 2);
        pointLight.position.set(2, 3, 4);
        this.scene.add(pointLight);

        this.animate();

        window.addEventListener('resize', () => this.onResize());

        // ドラッグ操作の追加
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.mouse.x;
            const deltaY = e.clientY - this.mouse.y;

            this.targetRotation.y += deltaX * 0.01;
            this.targetRotation.x += deltaY * 0.01;

            // ドラッグの勢いで回転速度（方向）を更新
            this.velocity.y = deltaX * 0.0005;
            this.velocity.x = deltaY * 0.0005;

            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        if (!this.container.contains(this.renderer.domElement)) return;
        requestAnimationFrame(() => this.animate());

        // 常に現在の速度でターゲットを動かし続ける
        this.targetRotation.y += this.velocity.y;
        this.targetRotation.x += this.velocity.x;

        // スムーズな補完
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;

        // オブジェクトの回転に反映（カメラを回す代わり）
        this.sphere.rotation.x = this.rotation.x;
        this.sphere.rotation.y = this.rotation.y;

        // 星々も少しだけ動かして奥行き感を出す
        this.stars.rotation.y = this.rotation.y * 0.2;
        this.stars.rotation.x = this.rotation.x * 0.2;

        this.renderer.render(this.scene, this.camera);
    }
}
