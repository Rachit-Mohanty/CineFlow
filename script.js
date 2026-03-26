/* --------------------------------------------------------------------------
   THEME TOGGLE LOGIC
-------------------------------------------------------------------------- */
function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

/* --------------------------------------------------------------------------
   LIQUID ETHER WEBGL BACKGROUND IMPLEMENTATION
-------------------------------------------------------------------------- */
function initLiquidEther(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    function makePaletteTexture(stops) {
        let arr = (Array.isArray(stops) && stops.length > 0) ? stops : ['#ffffff', '#ffffff'];
        if(arr.length === 1) arr = [arr[0], arr[0]];
        const w = arr.length;
        const data = new Uint8Array(w * 4);
        for (let i = 0; i < w; i++) {
            const c = new THREE.Color(arr[i]);
            data[i * 4 + 0] = Math.round(c.r * 255);
            data[i * 4 + 1] = Math.round(c.g * 255);
            data[i * 4 + 2] = Math.round(c.b * 255);
            data[i * 4 + 3] = 255;
        }
        const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        return tex;
    }

    // Apply Requested Colors
    const paletteTex = makePaletteTexture(['#285A48', '#408A71', '#B0E4CC']);
    const bgVec4 = new THREE.Vector4(0, 0, 0, 0);

    class CommonClass {
        constructor() {
            this.width = 0; this.height = 0; this.aspect = 1; this.pixelRatio = 1;
            this.time = 0; this.delta = 0; this.container = null; this.renderer = null; this.clock = null;
        }
        init(container) {
            this.container = container;
            this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            this.resize();
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.autoClear = false;
            this.renderer.setClearColor(new THREE.Color(0x000000), 0);
            this.renderer.setPixelRatio(this.pixelRatio);
            this.renderer.setSize(this.width, this.height);
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.renderer.domElement.style.display = 'block';
            this.clock = new THREE.Clock();
            this.clock.start();
        }
        resize() {
            if (!this.container) return;
            const rect = this.container.getBoundingClientRect();
            this.width = Math.max(1, Math.floor(rect.width));
            this.height = Math.max(1, Math.floor(rect.height));
            this.aspect = this.width / this.height;
            if (this.renderer) this.renderer.setSize(this.width, this.height, false);
        }
        update() {
            this.delta = this.clock.getDelta();
            this.time += this.delta;
        }
    }
    const Common = new CommonClass();

    class MouseClass {
        constructor() {
            this.coords = new THREE.Vector2(); this.coords_old = new THREE.Vector2(); this.diff = new THREE.Vector2();
            this.isHoverInside = false; this.hasUserControl = false; this.isAutoActive = false;
            this.autoIntensity = 2.0; this.takeoverActive = false; this.takeoverDuration = 0.25;
            this.takeoverFrom = new THREE.Vector2(); this.takeoverTo = new THREE.Vector2();
            this._onMouseMove = this.onDocumentMouseMove.bind(this);
            this._onTouchStart = this.onDocumentTouchStart.bind(this);
            this._onTouchMove = this.onDocumentTouchMove.bind(this);
            this._onTouchEnd = () => { this.isHoverInside = false; };
            this._onDocumentLeave = () => { this.isHoverInside = false; };
        }
        init(container) {
            this.container = container;
            this.listenerTarget = window; // Global listener for background
            this.listenerTarget.addEventListener('mousemove', this._onMouseMove);
            this.listenerTarget.addEventListener('touchstart', this._onTouchStart, { passive: true });
            this.listenerTarget.addEventListener('touchmove', this._onTouchMove, { passive: true });
            this.listenerTarget.addEventListener('touchend', this._onTouchEnd);
            document.addEventListener('mouseleave', this._onDocumentLeave);
        }
        updateHoverState(clientX, clientY) {
            this.isHoverInside = true; return true; // Always true since it's full bg
        }
        setCoords(x, y) {
            if (!this.container) return;
            const rect = this.container.getBoundingClientRect();
            const nx = (x - rect.left) / rect.width;
            const ny = (y - rect.top) / rect.height;
            this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
        }
        setNormalized(nx, ny) { this.coords.set(nx, ny); }
        onDocumentMouseMove(event) {
            if (this.onInteract) this.onInteract();
            if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
                const rect = this.container.getBoundingClientRect();
                const nx = (event.clientX - rect.left) / rect.width;
                const ny = (event.clientY - rect.top) / rect.height;
                this.takeoverFrom.copy(this.coords);
                this.takeoverTo.set(nx * 2 - 1, -(ny * 2 - 1));
                this.takeoverStartTime = performance.now();
                this.takeoverActive = true;
                this.hasUserControl = true;
                this.isAutoActive = false;
                return;
            }
            this.setCoords(event.clientX, event.clientY);
            this.hasUserControl = true;
        }
        onDocumentTouchStart(event) {
            if (event.touches.length !== 1) return;
            if (this.onInteract) this.onInteract();
            this.setCoords(event.touches[0].clientX, event.touches[0].clientY);
            this.hasUserControl = true;
        }
        onDocumentTouchMove(event) {
            if (event.touches.length !== 1) return;
            if (this.onInteract) this.onInteract();
            this.setCoords(event.touches[0].clientX, event.touches[0].clientY);
        }
        update() {
            if (this.takeoverActive) {
                const t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
                if (t >= 1) {
                    this.takeoverActive = false; this.coords.copy(this.takeoverTo); this.coords_old.copy(this.coords); this.diff.set(0, 0);
                } else {
                    const k = t * t * (3 - 2 * t);
                    this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
                }
            }
            this.diff.subVectors(this.coords, this.coords_old);
            this.coords_old.copy(this.coords);
            if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
            if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
        }
    }
    const Mouse = new MouseClass();

    class AutoDriver {
        constructor(mouse, manager, opts) {
            this.mouse = mouse; this.manager = manager; this.enabled = opts.enabled; this.speed = opts.speed;
            this.resumeDelay = opts.resumeDelay || 3000; this.rampDurationMs = (opts.rampDuration || 0) * 1000;
            this.active = false; this.current = new THREE.Vector2(0, 0); this.target = new THREE.Vector2();
            this.lastTime = performance.now(); this.activationTime = 0; this.margin = 0.2; this._tmpDir = new THREE.Vector2();
            this.pickNewTarget();
        }
        pickNewTarget() { const r = Math.random; this.target.set((r() * 2 - 1) * (1 - this.margin), (r() * 2 - 1) * (1 - this.margin)); }
        forceStop() { this.active = false; this.mouse.isAutoActive = false; }
        update() {
            if (!this.enabled) return;
            const now = performance.now();
            const idle = now - this.manager.lastUserInteraction;
            if (idle < this.resumeDelay || this.mouse.isHoverInside) { if (this.active) this.forceStop(); return; }
            if (!this.active) { this.active = true; this.current.copy(this.mouse.coords); this.lastTime = now; this.activationTime = now; }
            this.mouse.isAutoActive = true;
            let dtSec = (now - this.lastTime) / 1000;
            this.lastTime = now;
            if (dtSec > 0.2) dtSec = 0.016;
            const dir = this._tmpDir.subVectors(this.target, this.current);
            const dist = dir.length();
            if (dist < 0.01) { this.pickNewTarget(); return; }
            dir.normalize();
            let ramp = 1;
            if (this.rampDurationMs > 0) { const t = Math.min(1, (now - this.activationTime) / this.rampDurationMs); ramp = t * t * (3 - 2 * t); }
            const step = this.speed * dtSec * ramp;
            this.current.addScaledVector(dir, Math.min(step, dist));
            this.mouse.setNormalized(this.current.x, this.current.y);
        }
    }

    // Raw Shader Definitions
    const face_vert = `attribute vec3 position; uniform vec2 boundarySpace; varying vec2 uv; void main(){ vec3 pos = position; vec2 scale = 1.0 - boundarySpace * 2.0; pos.xy = pos.xy * scale; uv = vec2(0.5)+(pos.xy)*0.5; gl_Position = vec4(pos, 1.0); }`;
    const line_vert = `attribute vec3 position; uniform vec2 px; varying vec2 uv; void main(){ vec3 pos = position; uv = 0.5 + pos.xy * 0.5; vec2 n = sign(pos.xy); pos.xy = abs(pos.xy) - px * 1.0; pos.xy *= n; gl_Position = vec4(pos, 1.0); }`;
    const mouse_vert = `attribute vec3 position; attribute vec2 uv; uniform vec2 center; uniform vec2 scale; uniform vec2 px; varying vec2 vUv; void main(){ vec2 pos = position.xy * scale * 2.0 * px + center; vUv = uv; gl_Position = vec4(pos, 0.0, 1.0); }`;
    const advection_frag = `precision highp float; uniform sampler2D velocity; uniform float dt; uniform bool isBFECC; uniform vec2 fboSize; varying vec2 uv; void main(){ vec2 ratio = max(fboSize.x, fboSize.y) / fboSize; if(!isBFECC){ vec2 vel = texture2D(velocity, uv).xy; vec2 uv2 = uv - vel * dt * ratio; vec2 newVel = texture2D(velocity, uv2).xy; gl_FragColor = vec4(newVel, 0.0, 0.0); } else { vec2 spot_new = uv; vec2 vel_old = texture2D(velocity, uv).xy; vec2 spot_old = spot_new - vel_old * dt * ratio; vec2 vel_new1 = texture2D(velocity, spot_old).xy; vec2 spot_new2 = spot_old + vel_new1 * dt * ratio; vec2 error = spot_new2 - spot_new; vec2 spot_new3 = spot_new - error / 2.0; vec2 vel_2 = texture2D(velocity, spot_new3).xy; vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio; vec2 newVel2 = texture2D(velocity, spot_old2).xy; gl_FragColor = vec4(newVel2, 0.0, 0.0); } }`;
    const color_frag = `precision highp float; uniform sampler2D velocity; uniform sampler2D palette; uniform vec4 bgColor; varying vec2 uv; void main(){ vec2 vel = texture2D(velocity, uv).xy; float lenv = clamp(length(vel), 0.0, 1.0); vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb; vec3 outRGB = mix(bgColor.rgb, c, lenv); float outA = mix(bgColor.a, 1.0, lenv); gl_FragColor = vec4(outRGB, outA); }`;
    const externalForce_frag = `precision highp float; uniform vec2 force; varying vec2 vUv; void main(){ vec2 circle = (vUv - 0.5) * 2.0; float d = 1.0 - min(length(circle), 1.0); d *= d; gl_FragColor = vec4(force * d, 0.0, 1.0); }`;
    const divergence_frag = `precision highp float; uniform sampler2D velocity; uniform float dt; uniform vec2 px; varying vec2 uv; void main(){ float x0 = texture2D(velocity, uv-vec2(px.x, 0.0)).x; float x1 = texture2D(velocity, uv+vec2(px.x, 0.0)).x; float y0 = texture2D(velocity, uv-vec2(0.0, px.y)).y; float y1 = texture2D(velocity, uv+vec2(0.0, px.y)).y; float divergence = (x1 - x0 + y1 - y0) / 2.0; gl_FragColor = vec4(divergence / dt); }`;
    const poisson_frag = `precision highp float; uniform sampler2D pressure; uniform sampler2D divergence; uniform vec2 px; varying vec2 uv; void main(){ float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r; float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r; float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r; float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r; float div = texture2D(divergence, uv).r; float newP = (p0 + p1 + p2 + p3) / 4.0 - div; gl_FragColor = vec4(newP); }`;
    const pressure_frag = `precision highp float; uniform sampler2D pressure; uniform sampler2D velocity; uniform vec2 px; uniform float dt; varying vec2 uv; void main(){ float p0 = texture2D(pressure, uv + vec2(px.x, 0.0)).r; float p1 = texture2D(pressure, uv - vec2(px.x, 0.0)).r; float p2 = texture2D(pressure, uv + vec2(0.0, px.y)).r; float p3 = texture2D(pressure, uv - vec2(0.0, px.y)).r; vec2 v = texture2D(velocity, uv).xy; vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5; v = v - gradP * dt; gl_FragColor = vec4(v, 0.0, 1.0); }`;

    class ShaderPass {
        constructor(props) {
            this.props = props || {}; this.scene = new THREE.Scene(); this.camera = new THREE.Camera();
            if (this.props.material) {
                this.material = new THREE.RawShaderMaterial(this.props.material);
                this.geometry = new THREE.PlaneGeometry(2.0, 2.0);
                this.plane = new THREE.Mesh(this.geometry, this.material);
                this.scene.add(this.plane);
            }
        }
        update() {
            Common.renderer.setRenderTarget(this.props.output || null);
            Common.renderer.render(this.scene, this.camera);
            Common.renderer.setRenderTarget(null);
        }
    }

    class Simulation {
        constructor() {
            this.options = { iterations_poisson: 32, iterations_viscous: 32, mouse_force: 20, resolution: 0.5, cursor_size: 100, viscous: 30, isBounce: false, dt: 0.014, isViscous: false, BFECC: true };
            this.fbos = { vel_0: null, vel_1: null, vel_viscous0: null, vel_viscous1: null, div: null, pressure_0: null, pressure_1: null };
            this.fboSize = new THREE.Vector2(); this.cellScale = new THREE.Vector2(); this.boundarySpace = new THREE.Vector2();
            this.init();
        }
        init() {
            this.calcSize();
            const type = /(iPad|iPhone|iPod)/i.test(navigator.userAgent) ? THREE.HalfFloatType : THREE.FloatType;
            const opts = { type, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
            for (let key in this.fbos) this.fbos[key] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
            
            this.advection = new ShaderPass({ material: { vertexShader: face_vert, fragmentShader: advection_frag, uniforms: { boundarySpace: { value: this.cellScale }, px: { value: this.cellScale }, fboSize: { value: this.fboSize }, velocity: { value: this.fbos.vel_0.texture }, dt: { value: this.options.dt }, isBFECC: { value: true } } }, output: this.fbos.vel_1 });
            this.externalForce = new ShaderPass({ material: { vertexShader: mouse_vert, fragmentShader: externalForce_frag, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { px: { value: this.cellScale }, force: { value: new THREE.Vector2(0,0) }, center: { value: new THREE.Vector2(0,0) }, scale: { value: new THREE.Vector2(this.options.cursor_size, this.options.cursor_size) } } }, output: this.fbos.vel_1 });
            this.divergence = new ShaderPass({ material: { vertexShader: face_vert, fragmentShader: divergence_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, velocity: { value: this.fbos.vel_1.texture }, px: { value: this.cellScale }, dt: { value: this.options.dt } } }, output: this.fbos.div });
            this.poisson = new ShaderPass({ material: { vertexShader: face_vert, fragmentShader: poisson_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, pressure: { value: this.fbos.pressure_0.texture }, divergence: { value: this.fbos.div.texture }, px: { value: this.cellScale } } }, output: this.fbos.pressure_1 });
            this.pressure = new ShaderPass({ material: { vertexShader: face_vert, fragmentShader: pressure_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, pressure: { value: this.fbos.pressure_0.texture }, velocity: { value: this.fbos.vel_1.texture }, px: { value: this.cellScale }, dt: { value: this.options.dt } } }, output: this.fbos.vel_0 });
        }
        calcSize() {
            const width = Math.max(1, Math.round(this.options.resolution * Common.width));
            const height = Math.max(1, Math.round(this.options.resolution * Common.height));
            this.cellScale.set(1.0 / width, 1.0 / height); this.fboSize.set(width, height);
        }
        resize() { this.calcSize(); for (let key in this.fbos) this.fbos[key].setSize(this.fboSize.x, this.fboSize.y); }
        update() {
            this.boundarySpace.copy(this.options.isBounce ? new THREE.Vector2(0,0) : this.cellScale);
            this.advection.material.uniforms.dt.value = this.options.dt;
            this.advection.material.uniforms.isBFECC.value = this.options.BFECC;
            this.advection.update();
            
            const fX = (Mouse.diff.x / 2) * this.options.mouse_force;
            const fY = (Mouse.diff.y / 2) * this.options.mouse_force;
            const cX = Math.min(Math.max(Mouse.coords.x, -1 + this.options.cursor_size * this.cellScale.x + this.cellScale.x*2), 1 - this.options.cursor_size * this.cellScale.x - this.cellScale.x*2);
            const cY = Math.min(Math.max(Mouse.coords.y, -1 + this.options.cursor_size * this.cellScale.y + this.cellScale.y*2), 1 - this.options.cursor_size * this.cellScale.y - this.cellScale.y*2);
            this.externalForce.material.uniforms.force.value.set(fX, fY);
            this.externalForce.material.uniforms.center.value.set(cX, cY);
            this.externalForce.update();
            
            this.divergence.material.uniforms.velocity.value = this.fbos.vel_1.texture;
            this.divergence.update();
            
            let p_in, p_out;
            for (let i = 0; i < this.options.iterations_poisson; i++) {
                if (i % 2 === 0) { p_in = this.fbos.pressure_0; p_out = this.fbos.pressure_1; } else { p_in = this.fbos.pressure_1; p_out = this.fbos.pressure_0; }
                this.poisson.material.uniforms.pressure.value = p_in.texture;
                this.poisson.props.output = p_out;
                this.poisson.update();
            }
            
            this.pressure.material.uniforms.pressure.value = p_out.texture;
            this.pressure.material.uniforms.velocity.value = this.fbos.vel_1.texture;
            this.pressure.update();
        }
    }

    class WebGLManager {
        constructor(props) {
            Common.init(props.$wrapper); Mouse.init(props.$wrapper);
            Mouse.autoIntensity = props.autoIntensity; Mouse.takeoverDuration = props.takeoverDuration;
            this.lastUserInteraction = performance.now();
            Mouse.onInteract = () => { this.lastUserInteraction = performance.now(); if (this.autoDriver) this.autoDriver.forceStop(); };
            this.autoDriver = new AutoDriver(Mouse, this, { enabled: props.autoDemo, speed: props.autoSpeed, resumeDelay: props.autoResumeDelay, rampDuration: props.autoRampDuration });
            this.simulation = new Simulation();
            this.outputPass = new ShaderPass({ material: { vertexShader: face_vert, fragmentShader: color_frag, transparent: true, depthWrite: false, uniforms: { velocity: { value: this.simulation.fbos.vel_0.texture }, boundarySpace: { value: new THREE.Vector2() }, palette: { value: paletteTex }, bgColor: { value: bgVec4 } } } });
            this._loop = () => { if(this.running) { if(this.autoDriver) this.autoDriver.update(); Mouse.update(); Common.update(); this.simulation.update(); this.outputPass.update(); requestAnimationFrame(this._loop); } };
            window.addEventListener('resize', () => { Common.resize(); this.simulation.resize(); });
            props.$wrapper.appendChild(Common.renderer.domElement);
            this.running = true; this._loop();
        }
    }
    new WebGLManager({ $wrapper: container, autoDemo: true, autoSpeed: 0.5, autoIntensity: 2.2, takeoverDuration: 0.25, autoResumeDelay: 1000, autoRampDuration: 0.6 });
}

// Initialize Background Effect
document.addEventListener('DOMContentLoaded', () => {
    initLiquidEther('liquid-ether-bg');
});

/* --------------------------------------------------------------------------
   MAIN APP LOGIC & API INTEGRATION
-------------------------------------------------------------------------- */
const API_KEY = '782cbda843843a9d10a003da00b9d14f';
const API_BASE = 'https://api.themoviedb.org/3';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';

const mainGrid = document.getElementById('main-grid');
const form = document.getElementById('form');
const searchInput = document.getElementById('search');
const sectionTitle = document.getElementById('section-title');
const sectionTitleWrapper = document.getElementById('section-title-wrapper');
const loadingSpinner = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const detailsView = document.getElementById('details-view');
const detailsContent = document.getElementById('details-content');

let currentMediaType = 'movie'; // 'movie' or 'tv'

// Variable Proximity Effect Logic 
class VariableProximity {
    constructor(element, options) {
        this.container = element; this.label = options.label || ''; this.fromSettings = this.parseSettings(options.fromFontVariationSettings);
        this.toSettings = this.parseSettings(options.toFontVariationSettings); this.radius = options.radius || 50; this.falloff = options.falloff || 'linear';
        this.mousePos = { x: -1000, y: -1000 }; this.letterElements = []; this.interpolatedSettings = [];
        this.initDOM(); this.bindEvents(); this.loop();
    }
    parseSettings(settingsStr) {
        const map = new Map(); settingsStr.split(',').map(s => s.trim()).forEach(s => {
            const parts = s.split(' '); if (parts.length === 2) map.set(parts[0].replace(/['"]/g, ''), parseFloat(parts[1]));
        }); return map;
    }
    initDOM() {
        this.container.innerHTML = ''; this.container.classList.add('variable-proximity'); this.container.style.display = 'inline-block';
        const words = this.label.split(' ');
        words.forEach((word, wordIndex) => {
            if (word === '<br>') { this.container.appendChild(document.createElement('br')); return; }
            const wordSpan = document.createElement('span'); wordSpan.style.display = 'inline-block'; wordSpan.style.whiteSpace = 'nowrap';
            word.split('').forEach(letter => {
                const letterSpan = document.createElement('span'); letterSpan.style.display = 'inline-block'; letterSpan.textContent = letter;
                letterSpan.style.transition = 'font-variation-settings 0.1s ease-out, transform 0.1s ease-out';
                const initSet = Array.from(this.fromSettings.entries()).map(([axis, val]) => `'${axis}' ${val}`).join(', ');
                letterSpan.style.fontVariationSettings = initSet;
                this.letterElements.push(letterSpan); this.interpolatedSettings.push(initSet); wordSpan.appendChild(letterSpan);
            });
            this.container.appendChild(wordSpan);
            if (wordIndex < words.length - 1 && words[wordIndex + 1] !== '<br>') {
                const space = document.createElement('span'); space.style.display = 'inline-block'; space.innerHTML = '&nbsp;'; this.container.appendChild(space);
            }
        });
    }
    bindEvents() {
        const updatePosition = (x, y) => { const rect = this.container.getBoundingClientRect(); this.mousePos = { x: x - rect.left, y: y - rect.top }; };
        window.addEventListener('mousemove', e => updatePosition(e.clientX, e.clientY));
        window.addEventListener('touchmove', e => { if (e.touches.length > 0) updatePosition(e.touches[0].clientX, e.touches[0].clientY); });
    }
    calculateDistance(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
    calculateFalloff(distance) {
        const norm = Math.min(Math.max(1 - distance / this.radius, 0), 1);
        return this.falloff === 'gaussian' ? Math.exp(-((distance / (this.radius / 2)) ** 2) / 2) : norm;
    }
    loop() {
        if (this.letterElements.length === 0) return;
        const containerRect = this.container.getBoundingClientRect();
        this.letterElements.forEach((letterSpan, index) => {
            const rect = letterSpan.getBoundingClientRect();
            const dist = this.calculateDistance(this.mousePos.x, this.mousePos.y, rect.left + rect.width / 2 - containerRect.left, rect.top + rect.height / 2 - containerRect.top);
            let newSettings;
            if (dist >= this.radius) {
                newSettings = Array.from(this.fromSettings.entries()).map(([axis, val]) => `'${axis}' ${val}`).join(', ');
                letterSpan.style.transform = 'translateY(0px) scale(1)';
            } else {
                const falloffVal = this.calculateFalloff(dist);
                newSettings = Array.from(this.fromSettings.entries()).map(([axis, fromVal]) => `'${axis}' ${fromVal + ((this.toSettings.has(axis) ? this.toSettings.get(axis) : fromVal) - fromVal) * falloffVal}`).join(', ');
                letterSpan.style.transform = `translateY(${-falloffVal * 4}px) scale(${1 + (falloffVal * 0.15)})`;
            }
            if (this.interpolatedSettings[index] !== newSettings) { letterSpan.style.fontVariationSettings = newSettings; this.interpolatedSettings[index] = newSettings; }
        });
        requestAnimationFrame(() => this.loop());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('hero-title-effect');
    if (titleElement) new VariableProximity(titleElement, { label: 'Discover cinema. <br> Anywhere. Anytime.', fromFontVariationSettings: "'wght' 400, 'opsz' 36", toFontVariationSettings: "'wght' 1000, 'opsz' 144", radius: 180, falloff: 'gaussian' });
    buildMarquee();
});

const programsData = [
    { image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=500&fit=crop", category: "TRENDING", title: "Top Box Office hits" },
    { image: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&h=500&fit=crop", category: "SCI-FI", title: "Intergalactic journeys" },
    { image: "https://images.unsplash.com/photo-1585951237318-9ea5e175b891?w=400&h=500&fit=crop", category: "DRAMA", title: "Award-winning stories" },
    { image: "https://images.unsplash.com/photo-1620336655055-088d06e36bf0?w=400&h=500&fit=crop", category: "FANTASY", title: "Magical Worlds" },
    { image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=500&fit=crop", category: "CLASSICS", title: "Timeless masterpieces" }
];

function buildMarquee() {
    const container = document.getElementById('marquee-content');
    let cardsHTML = '';
    [...programsData, ...programsData].forEach(program => {
        cardsHTML += `<div onclick="enterCineFlow()" class="flex-shrink-0 cursor-pointer relative overflow-hidden rounded-[24px] shadow-[0_8px_32px_rgba(40,90,72,0.2)] hover:-translate-y-2 transition-transform duration-300 w-[280px] h-[380px] sm:w-[356px] sm:h-[480px]">
                <img src="${program.image}" alt="${program.title}" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-gradient-to-t from-cineDark via-cineDark/40 to-transparent"></div>
                <div class="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-2">
                    <span class="text-xs font-semibold text-cineMint uppercase tracking-widest">${program.category}</span>
                    <h3 class="text-2xl font-bold text-white leading-snug">${program.title}</h3>
                </div></div>`;
    });
    container.innerHTML = cardsHTML;
}

function enterCineFlow() {
    document.getElementById('page-transition').style.opacity = '1';
    document.getElementById('page-transition').classList.remove('pointer-events-none');
    setTimeout(() => {
        document.getElementById('landing-container').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        loadGenreNav('all'); // Load ALL movies by default
        window.scrollTo({ top: 0, behavior: 'auto' });
        setTimeout(() => {
            document.getElementById('page-transition').style.opacity = '0';
            document.getElementById('page-transition').classList.add('pointer-events-none');
        }, 1000);
    }, 600);
}

function returnToLanding() {
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('flex');
    document.getElementById('landing-container').style.display = 'flex';
    setTimeout(() => { document.getElementById('landing-container').style.opacity = '1'; window.scrollTo({ top: 0, behavior: 'auto' }); }, 50);
}

// --- NAVIGATION LOGIC ---
function updateNavStyle(activeId) {
    document.querySelectorAll('.nav-chip').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`nav-${activeId}`);
    if(activeEl && activeEl.classList.contains('nav-chip')) {
        activeEl.classList.add('active');
    }
}

async function loadGenreNav(id, titleText = '') {
    closeDetails();
    searchInput.value = "";
    updateNavStyle(id);

    if (id === 'all') {
        currentMediaType = 'movie';
        sectionTitle.innerText = "All Movies";
        await fetchAndDisplayMovies(`${API_BASE}/discover/movie?sort_by=popularity.desc&api_key=${API_KEY}&page=1`);
    } else if (id === 'discover') {
        currentMediaType = 'movie';
        sectionTitle.innerText = "Popular Movies";
        await fetchAndDisplayMovies(`${API_BASE}/discover/movie?sort_by=popularity.desc&api_key=${API_KEY}&page=1`);
    } else if (id === 'tv') {
        currentMediaType = 'tv';
        sectionTitle.innerText = "Popular Web Series";
        await fetchAndDisplayMovies(`${API_BASE}/discover/tv?sort_by=popularity.desc&api_key=${API_KEY}&page=1`);
    } else {
        currentMediaType = 'movie';
        sectionTitle.innerText = `Top ${titleText} Movies`;
        await fetchAndDisplayMovies(`${API_BASE}/discover/movie?with_genres=${id}&sort_by=popularity.desc&api_key=${API_KEY}&page=1`);
    }
}

async function fetchAndDisplayMovies(url) {
    toggleLoading(true);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderGridMovies(data.results);
        } else {
            showError("No items found. Try a different search.");
        }
    } catch (error) {
        showError("Failed to fetch data. Please verify internet connection.");
    } finally {
        setTimeout(() => toggleLoading(false), 800);
    }
}

// --- BENTO GRID RENDERING ---
function renderGridMovies(items) {
    mainGrid.innerHTML = '';
    mainGrid.classList.remove('hidden');
    errorMessage.classList.add('hidden');

    items.forEach((item, index) => {
        const title = item.title || item.name;
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path;

        const card = document.createElement('div');
        
        // Bento Layout Dynamic Sizing Logic
        let bentoClass = 'col-span-1 row-span-1';
        if (index === 0 || index % 9 === 0) {
            bentoClass = 'col-span-2 row-span-2 md:col-span-2 md:row-span-2';
        } else if (index % 5 === 0) {
            bentoClass = 'col-span-2 row-span-1 md:col-span-2 md:row-span-1';
        } else if (index % 7 === 0) {
            bentoClass = 'col-span-1 row-span-2 md:col-span-1 md:row-span-2';
        }

        card.className = `bg-white dark:bg-cineDark/80 rounded-2xl overflow-hidden shadow-lg transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-cineGreen/20 flex flex-col border border-cineMint dark:border-cineForest cursor-pointer ${bentoClass}`;
        card.onclick = () => fetchMovieDetails(item.id, currentMediaType);

        const imageSrc = posterPath ? IMG_PATH + posterPath : 'https://via.placeholder.com/500x750/B0E4CC/091413?text=No+Poster';
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const ratingColorClass = getRatingColor(item.vote_average);
        const year = releaseDate ? releaseDate.substring(0, 4) : 'Unknown';

        card.innerHTML = `
            <div class="relative w-full h-full group bg-gray-100 dark:bg-cineDark overflow-hidden flex flex-col">
                <img src="${imageSrc}" alt="${title}" class="absolute inset-0 w-full h-full object-cover img-loaded transition-transform duration-700 group-hover:scale-105" loading="lazy">
                
                <div class="absolute inset-0 bg-gradient-to-t from-cineDark via-cineDark/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                
                <div class="absolute inset-0 bg-cineDark/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-5 text-center">
                    <div class="bg-cineGreen text-white rounded-full p-4 mb-4 shadow-lg transform scale-90 group-hover:scale-100 transition-transform"><i class="fas fa-info-circle text-xl sm:text-2xl"></i></div>
                    <h3 class="text-lg sm:text-xl font-bold text-white mb-2">View Details</h3>
                </div>
                
                <div class="absolute top-3 right-3 bg-white/90 dark:bg-cineDark/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-lg border border-cineMint dark:border-cineForest flex items-center gap-1 z-10">
                    <i class="fas fa-star text-xs ${ratingColorClass}"></i><span class="text-xs sm:text-sm font-bold text-cineDark dark:text-white">${rating}</span>
                </div>
                
                <div class="absolute bottom-0 left-0 right-0 p-4 z-10 flex flex-col justify-end">
                    <h3 class="text-base sm:text-lg lg:text-xl font-bold text-white mb-1 truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" title="${title}">${title}</h3>
                    <p class="text-xs sm:text-sm text-cineMint font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">${year}</p>
                </div>
            </div>`;
        mainGrid.appendChild(card);
    });
}

function getRatingColor(vote) {
    if (!vote || vote === 0) return 'text-gray-400';
    if (vote >= 7.5) return 'text-cineGreen';
    if (vote >= 6) return 'text-yellow-500';
    return 'text-red-500';
}

function toggleLoading(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove('hidden'); 
        loadingSpinner.classList.add('flex');
        mainGrid.classList.add('hidden');
        if (detailsView) detailsView.classList.add('hidden');
    } else {
        loadingSpinner.classList.add('hidden'); 
        loadingSpinner.classList.remove('flex');
        mainGrid.classList.remove('hidden');
    }
}

function showError(message) {
    mainGrid.innerHTML = ''; mainGrid.classList.remove('hidden');
    errorMessage.innerText = message; errorMessage.classList.remove('hidden');
}

function closeDetails() {
    if (!detailsView) return;
    detailsView.classList.add('hidden');
    sectionTitleWrapper.classList.remove('hidden');
    // Restore context
    mainGrid.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function fetchMovieDetails(id, type = 'movie') {
    mainGrid.classList.add('hidden');
    sectionTitleWrapper.classList.add('hidden');
    detailsView.classList.add('hidden');
    
    loadingSpinner.classList.remove('hidden'); loadingSpinner.classList.add('flex');

    try {
        const res = await fetch(`${API_BASE}/${type}/${id}?api_key=${API_KEY}&append_to_response=watch/providers`);
        if (!res.ok) throw new Error('Details not found');
        const data = await res.json();
        renderDetails(data, type);
    } catch (error) {
        showError("Failed to load details."); closeDetails();
    } finally {
        loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex');
    }
}

function renderDetails(data, type) {
    const title = data.title || data.name;
    const releaseDate = data.release_date || data.first_air_date;
    const runtime = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 'N/A');
    
    const posterSrc = data.poster_path ? IMG_PATH + data.poster_path : 'https://via.placeholder.com/500x750/B0E4CC/091413?text=No+Poster';
    const backdropSrc = data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '';
    const year = releaseDate ? releaseDate.substring(0, 4) : 'Unknown';
    const ratingColor = getRatingColor(data.vote_average);
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'NR';
    const genreText = data.genres ? data.genres.map(g => g.name).join(', ') : 'Unknown Genre';
    
    let providersHtml = '<p class="text-cineForest dark:text-cineMint/70 text-sm italic">Not currently available online in standard regions.</p>';
    const providersData = data['watch/providers']?.results;
    if (providersData) {
        const region = providersData['IN'] || providersData['US'] || Object.values(providersData)[0];
        if (region) {
            const options = region.flatrate || region.rent || region.buy;
            if (options && options.length > 0) {
                providersHtml = `<div class="flex flex-wrap gap-3 mt-3">` + options.slice(0, 5).map(p => `
                    <div class="relative group/provider cursor-pointer">
                        <img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${p.provider_name}" class="w-12 h-12 rounded-xl shadow-lg border border-cineMint dark:border-cineForest hover:border-cineGreen transition">
                        <span class="absolute -top-8 left-1/2 -translate-x-1/2 bg-cineDark text-xs text-white px-2 py-1 rounded opacity-0 group-hover/provider:opacity-100 transition whitespace-nowrap pointer-events-none z-10 border border-cineForest shadow-xl">${p.provider_name}</span>
                    </div>`).join('') + `</div>`;
            }
        }
    }

    const imdbBtn = data.imdb_id ? `<a href="https://www.imdb.com/title/${data.imdb_id}" target="_blank" class="inline-flex items-center gap-2 bg-[#f5c518] text-black font-bold py-2 px-4 rounded-lg hover:bg-[#d4a80e] transition shadow-md transform hover:-translate-y-1"><i class="fab fa-imdb text-xl"></i> View on IMDb</a>` : '';

    detailsContent.innerHTML = `
        <div class="md:w-1/3 relative shrink-0 z-20"><img src="${posterSrc}" alt="${title}" class="w-full h-full object-cover"></div>
        <div class="md:w-2/3 p-6 md:p-10 flex flex-col relative z-20">
            <div class="absolute inset-0 z-0 overflow-hidden">
                ${backdropSrc ? `<img src="${backdropSrc}" class="w-full h-full object-cover opacity-20 dark:opacity-[0.15]">` : ''}
                <div class="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/60 dark:from-cineDark dark:via-cineDark/90 dark:to-cineDark/60"></div>
            </div>
            <div class="flex-grow z-10 relative">
                <h2 class="text-3xl md:text-5xl font-extrabold text-cineDark dark:text-white mb-2 leading-tight">${title} <span class="text-cineForest dark:text-cineMint/70 font-light text-2xl md:text-4xl">(${year})</span></h2>
                <p class="text-cineGreen dark:text-cineMint font-medium mb-6 text-sm md:text-base">${genreText} &bull; ${runtime} min &bull; ${type.toUpperCase()}</p>
                <div class="flex flex-wrap items-center gap-4 mb-8">
                    <div class="bg-white/80 dark:bg-cineDark/80 backdrop-blur-md px-5 py-2 rounded-lg shadow-inner border border-cineMint flex items-center gap-2">
                        <i class="fas fa-star ${ratingColor} text-xl"></i><span class="text-2xl font-bold text-cineDark dark:text-white">${rating}</span><span class="text-sm text-cineForest dark:text-cineMint/70">/ 10</span>
                    </div>
                    ${imdbBtn}
                </div>
                <h3 class="text-xl font-bold text-cineDark dark:text-white mb-3 flex items-center gap-2"><i class="fas fa-book-open text-cineGreen dark:text-cineMint"></i> Synopsis</h3>
                <p class="text-cineForest dark:text-gray-300 leading-relaxed text-base md:text-lg mb-8 shadow-sm p-5 bg-cineMint/10 dark:bg-cineDark/60 rounded-xl border border-cineMint dark:border-cineForest/50 backdrop-blur-sm">
                    ${data.overview || 'No synopsis available for this title.'}
                </p>
            </div>
            <div class="mt-auto z-10 relative pt-6 border-t border-cineMint dark:border-cineForest/50">
                <h3 class="text-lg font-bold text-cineDark dark:text-white mb-1"><i class="fas fa-play-circle text-cineGreen mr-2"></i> Where to Watch</h3>
                ${providersHtml}
            </div>
        </div>`;

    detailsView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    closeDetails();
    const searchTerm = searchInput.value.trim();
    if (searchTerm && searchTerm !== '') {
        document.querySelectorAll('.nav-chip').forEach(el => el.classList.remove('active'));
        sectionTitle.innerText = `Search Results for "${searchTerm}"`;
        currentMediaType = 'movie'; // Defaulting to search movies
        fetchAndDisplayMovies(`${API_BASE}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(searchTerm)}`);
    } else {
        loadGenreNav('all');
    }
});