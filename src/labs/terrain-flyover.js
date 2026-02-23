import * as THREE from 'three';

export class TerrainFlyover {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000510);
        this.scene.fog = new THREE.FogExp2(0x000510, 0.025);

        this.camera = new THREE.PerspectiveCamera(65, this.container.clientWidth / this.container.clientHeight, 0.1, 500);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.clock = new THREE.Clock();
        this.speed = 8.0; // 前進速度 (units/sec)

        // 🔑 浮動小数点精度問題の根本解決:
        // カメラのZ座標を大きくする代わりに、JavaScriptの高精度数値で
        // 「世界の進行オフセット」を管理し、カメラは常に原点付近に留める。
        this.worldOffset = new THREE.Vector2(0, 0); // 累積移動距離

        this.init();
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // カメラの初期位置
        this.camera.position.set(0, 8, 0);

        // 地形の設定
        const size = 160;
        const segments = 128;
        this.terrainSize = size;
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        this.terrainMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uWorldOffset: { value: new THREE.Vector2(0, 0) }, // 精度問題回避用
                uHeight: { value: 22.0 }, // より高い起伏
                uWaterLevel: { value: 0.38 },
                uColorDeepWater: { value: new THREE.Color(0x000520) },
                uColorShallowWater: { value: new THREE.Color(0x0055ff) },
                uColorLand: { value: new THREE.Color(0x00ff44) },
                uColorMountain: { value: new THREE.Color(0x667766) },
                uColorPeak: { value: new THREE.Color(0xeeeeff) },
            },
            vertexShader: `
                uniform vec2 uWorldOffset; // カメラの累積移動距離（JSで高精度管理）
                uniform float uHeight;
                uniform float uWaterLevel;
                varying float vHeight;
                varying vec2 vWorldPos;

                float rand(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(rand(i), rand(i + vec2(1.0, 0.0)), u.x),
                        mix(rand(i + vec2(0.0, 1.0)), rand(i + vec2(1.0, 1.0)), u.x),
                        u.y
                    );
                }
                float fbm(vec2 p) {
                    float v = 0.0, amp = 0.5;
                    for (int i = 0; i < 7; i++) {
                        v += amp * noise(p);
                        p *= 2.1;
                        amp *= 0.48;
                    }
                    return v;
                }

                void main() {
                    // 🔑 position (メッシュローカル座標) + worldOffset（JS高精度）
                    // => これにより camera.position.z が巨大になっても精度落ちしない
                    vec2 worldPos2D = vec2(position.x, position.z) + uWorldOffset;
                    vWorldPos = worldPos2D;

                    // スケールを小さくすると地形が大きく・緩やかになる
                    float h = fbm(worldPos2D * 0.018);

                    // 山と海の高さ整形
                    float actualHeight;
                    if (h < uWaterLevel) {
                        actualHeight = uWaterLevel; // 海面でフラット
                    } else {
                        // 山の急峻さを指数関数で誇張
                        float t = (h - uWaterLevel) / (1.0 - uWaterLevel);
                        actualHeight = uWaterLevel + pow(t, 1.5) * (1.0 - uWaterLevel);
                    }

                    vHeight = actualHeight;
                    vec3 pos = position;
                    pos.y = actualHeight * uHeight;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uWaterLevel;
                uniform vec3 uColorDeepWater;
                uniform vec3 uColorShallowWater;
                uniform vec3 uColorLand;
                uniform vec3 uColorMountain;
                uniform vec3 uColorPeak;
                varying float vHeight;
                varying vec2 vWorldPos;

                void main() {
                    vec3 col;
                    
                    if (vHeight <= uWaterLevel + 0.001) {
                        // 海の表現
                        float distToShore = (uWaterLevel - vHeight); 
                        col = uColorDeepWater;
                        // 水面にグリッド
                        float grid = abs(sin(vWorldPos.x * 0.5)) * abs(sin(vWorldPos.y * 0.5));
                        col += step(0.98, grid) * 0.15;
                    } else {
                        // 陸・山・雪山
                        float hRel = (vHeight - uWaterLevel) / (1.0 - uWaterLevel);
                        if (hRel < 0.2) {
                            col = mix(uColorShallowWater, uColorLand, hRel * 5.0);
                        } else if (hRel < 0.5) {
                            col = mix(uColorLand, uColorMountain, (hRel - 0.2) * 3.33);
                        } else {
                            col = mix(uColorMountain, uColorPeak, (hRel - 0.5) * 2.0);
                        }
                    }

                    // グリッド / ワイヤーフレーム風の効果
                    float grid = abs(sin(vWorldPos.x * 2.0)) * abs(sin(vWorldPos.y * 2.0));
                    col += step(0.99, grid) * 0.2;

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            wireframe: true,
            transparent: true,
            opacity: 0.9
        });

        this.terrain = new THREE.Mesh(geometry, this.terrainMaterial);
        this.scene.add(this.terrain);

        this.addStars();
        this.animate();
        window.addEventListener('resize', () => this.onResize());
    }

    addStars() {
        const count = 1500;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 400;
            positions[i * 3 + 1] = Math.random() * 100 + 20;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ size: 0.2, color: 0xffffff, transparent: true, opacity: 0.5 });
        this.stars = new THREE.Points(geometry, material);
        this.scene.add(this.stars);
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        if (!this.container.contains(this.renderer.domElement)) return;
        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();
        const totalTime = this.clock.getElapsedTime();

        // 🔑 精度問題の根本解決:
        // カメラの position.z は動かさず、JS高精度数値で worldOffset を累積する。
        // カメラは常に z=0 付近に留まるため float32 の精度劣化が起きない。
        this.worldOffset.y -= this.speed * dt; // Z方向に進む（ノイズのUV座標）

        // カメラの横揺れ（滑空感）- X方向にも反映
        const sway = Math.sin(totalTime * 0.4) * 4.0;
        this.worldOffset.x = sway;

        // カメラは常に原点付近に固定
        this.camera.position.set(0, 10, 0);
        this.camera.rotation.z = Math.sin(totalTime * 0.4) * 0.04; // 軽いバンク
        this.camera.lookAt(sway * 0.3, 3, -60);

        // ユニフォーム更新（高精度JSから低精度GPUへ安全に受け渡し）
        this.terrainMaterial.uniforms.uWorldOffset.value.set(
            this.worldOffset.x,
            this.worldOffset.y
        );

        // 地形メッシュはカメラ前方に常に展開（カメラが動かないのでz=-80固定）
        this.terrain.position.set(0, 0, -80);

        this.renderer.render(this.scene, this.camera);
    }
}
