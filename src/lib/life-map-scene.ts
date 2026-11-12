// The Life Map's 3D scene: particle clusters, connecting streams, floating labels.
// Browser only; three.js is loaded on demand so no other screen pays for it.

import type * as Three from "three";
import type { MapGraph, MapNode } from "./life-map";

export type Tier = "high" | "medium" | "low";

/** How much each tier draws. A slow phone starts lower, and a scene that runs slowly steps down by itself. */
const TIERS: Record<Tier, { dpr: number; density: number; stream: number; twinkle: number; dof: number }> = {
  high: { dpr: 2, density: 1, stream: 54, twinkle: 1, dof: 1 },
  medium: { dpr: 1.5, density: 0.6, stream: 30, twinkle: 1, dof: 0.7 },
  low: { dpr: 1, density: 0.35, stream: 14, twinkle: 0, dof: 0 },
};
const STEP_DOWN: Record<Tier, Tier | null> = { high: "medium", medium: "low", low: null };

/** A first guess from what the browser tells us about the device. */
export function startTier(nav: { deviceMemory?: number; hardwareConcurrency?: number }, coarse: boolean): Tier {
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  if (mem <= 2 || cores <= 2) return "low";
  if (mem <= 4 || cores <= 4 || coarse) return "medium";
  return "high";
}

// Soft round particles that twinkle, blur a little away from the point the camera
// looks at (a light depth of field), and fade into the distance (fog).
const POINT_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uFocus;
  uniform float uDof;
  uniform float uTwinkle;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(1.0, -mv.z);
    float tw = 1.0 + uTwinkle * 0.35 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 40.0);
    float blur = clamp(abs(dist - uFocus) / uFocus, 0.0, 1.5) * uDof;
    gl_PointSize = max(1.5, uSize * uScale * tw * (1.0 + blur * 1.6) / dist);
    vAlpha = (0.6 + 0.4 * tw) / (1.0 + blur * 2.2) * smoothstep(uFocus * 2.6, uFocus * 1.15, dist);
    gl_Position = projectionMatrix * mv;
  }
`;
const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  }
`;
// One large, very soft disc behind each node: the glow, without a post-processing pass.
const HALO_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(512.0, aSize * uScale / max(1.0, -mv.z));
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;
const HALO_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;
// Stream particles carry their own colour and a brightness that rises towards where they are going.
const STREAM_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aHead;
  uniform float uSize;
  uniform float uScale;
  uniform float uFocus;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(1.0, -mv.z);
    gl_PointSize = max(1.5, uSize * uScale * (0.6 + 0.8 * aHead) / dist);
    vColor = aColor;
    vAlpha = (0.25 + 0.75 * aHead) * smoothstep(uFocus * 2.6, uFocus * 1.15, dist);
    gl_Position = projectionMatrix * mv;
  }
`;
const STREAM_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.1, d) * vAlpha * uOpacity);
  }
`;

export type LifeMapScene = {
  setGraph: (graph: MapGraph) => void;
  setSelected: (id: string | null) => void;
  setSpin: (on: boolean) => void;
  fit: () => void;
  /** The tier in use now; it can drop while the scene runs. */
  tier: () => Tier;
  /** Re-reads the theme's colours. */
  repaint: () => void;
  dispose: () => void;
};

const WIDE = 700;
const clampZoom = (r: number) => Math.max(90, Math.min(640, r));

export async function createLifeMapScene(host: HTMLElement, labels: HTMLElement, onSelect: (id: string | null) => void): Promise<LifeMapScene> {
  const THREE = await import("three");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rect = host.getBoundingClientRect();

  let tier = startTier(navigator as { deviceMemory?: number; hardwareConcurrency?: number }, window.matchMedia("(pointer: coarse)").matches);
  let cfg = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ antialias: tier !== "low", alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dpr));
  renderer.setSize(rect.width, rect.height);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = "position:absolute;inset:0;touch-action:none;outline:none";
  host.insertBefore(canvas, host.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, Math.max(1, rect.width) / Math.max(1, rect.height), 1, 3000);
  const sphere = new THREE.SphereGeometry(1, 28, 18);
  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const look = new THREE.Vector3();

  // A phone is narrow, so it stands further back to keep all four areas in view.
  const fitZoom = () => clampZoom(250 * Math.max(1, 0.8 / camera.aspect));
  const orbit = { th: 0.7, ph: 1.15, r: fitZoom() };
  let zoom = orbit.r;
  let lastTouch = 0;
  let spin = !reduced;
  let selected: string | null = null;
  let hover: string | null = null;
  let graph: MapGraph | null = null;
  let focusHub: string | null | undefined;

  let byId: Record<string, MapNode> = {};
  let meshes: Record<string, Three.Mesh> = {};
  /** 0 = an area's items rest close to it, 1 = they have opened out to their places. */
  let openness: Record<string, number> = {};
  let order: Record<string, number> = {};
  let halo: Three.Points | null = null;
  let haloPos = new Float32Array(0);
  let haloAlpha = new Float32Array(0);
  let dark = false;
  let focusAt = 0;
  const born = performance.now();
  // Measured speed: a scene that cannot keep up steps down a tier.
  let frames = 0;
  let slow = 0;
  let lastFrame = 0;
  const shared = { uTime: { value: 0 }, uScale: { value: 1 }, uFocus: { value: 250 }, uDof: { value: cfg.dof }, uTwinkle: { value: reduced ? 0 : cfg.twinkle } };
  let tags: Record<string, HTMLDivElement & { show?: boolean; x?: number; y?: number }> = {};
  let ring: Three.Mesh | null = null;
  let lines: Three.LineSegments | null = null;
  let linePos = new Float32Array(0);
  let lineBase = 0.35;
  let streams: Three.Points | null = null;
  let streamPos = new Float32Array(0);
  let streamPhase = new Float32Array(0);
  let streamJitter = new Float32Array(0);
  let streamHead = new Float32Array(0);
  const STREAM = TIERS.high.stream;

  function clear() {
    for (const o of [...scene.children]) {
      o.traverse((c) => {
        const m = c as Three.Mesh;
        if (m.geometry && m.geometry !== sphere) m.geometry.dispose();
        (m.material as Three.Material | undefined)?.dispose?.();
      });
      scene.remove(o);
    }
  }

  function build() {
    if (!graph) return;
    clear();
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const bg = new THREE.Color(token("--bg", "#ffffff"));
    dark = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722 < 0.4;
    const blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    const colors: Record<string, string> = {
      acc: token("--acc", "#3355FF"),
      ok: token("--ok", "#0E9F5B"),
      warn: token("--warn", "#E0A100"),
      bad: token("--bad", "#E5383B"),
      neu: token("--mut2", "#8E94A0"),
    };
    const { nodes, edges } = graph;
    byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    meshes = {};
    focusHub = undefined;
    const wasOpen = openness;
    openness = {};
    order = {};
    const seen: Record<string, number> = {};

    haloPos = new Float32Array(nodes.length * 3);
    haloAlpha = new Float32Array(nodes.length);
    const haloSize = new Float32Array(nodes.length);
    const haloCol = new Float32Array(nodes.length * 3);

    nodes.forEach((n, i) => {
      const col = new THREE.Color(colors[n.st] ?? colors.neu);
      const leaf = n.kind !== "core" && n.kind !== "hub";
      openness[n.id] = leaf ? (wasOpen[n.id] ?? 0) : 1;
      if (leaf && n.hub) order[n.id] = seen[n.hub] = (seen[n.hub] ?? -1) + 1;
      // The mesh is the invisible tap target; the particles are what you see.
      const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ visible: false }));
      mesh.scale.setScalar(n.r);
      mesh.position.set(...n.pos);
      mesh.userData.id = n.id;
      scene.add(mesh);
      meshes[n.id] = mesh;

      const count = n.kind === "core" ? 1400 : n.kind === "hub" ? 620 : 170;
      const pa = new Float32Array(count * 3);
      const seed = new Float32Array(count);
      for (let q = 0; q < count; q++) {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        // The core is a shell (the score sits inside it); areas and items are denser towards the middle.
        const rr = n.kind === "core" ? 1.25 + (Math.random() - 0.5) * 0.35 : Math.pow(Math.random(), 1.5) * 1.5;
        const sq = Math.sqrt(1 - u * u);
        pa.set([Math.cos(th) * sq * rr, u * rr, Math.sin(th) * sq * rr], q * 3);
        seed[q] = Math.random();
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(pa, 3));
      pg.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      pg.setDrawRange(0, Math.ceil(count * cfg.density));
      const pts = new THREE.Points(
        pg,
        new THREE.ShaderMaterial({
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          uniforms: {
            ...shared,
            uColor: { value: col },
            uOpacity: { value: 0 },
            uSize: { value: n.kind === "core" ? 1.1 : n.kind === "hub" ? 1.0 : 0.85 },
          },
          transparent: true,
          depthWrite: false,
          blending,
        }),
      );
      pts.frustumCulled = false;
      pts.userData.count = count;
      // Additive light adds up fast where particles are dense, so the core stays faint enough to read the score in it.
      pts.userData.gain = dark ? (n.kind === "core" ? 0.3 : n.kind === "hub" ? 0.55 : 0.7) : n.kind === "core" ? 0.45 : 0.85;
      mesh.add(pts);
      mesh.userData.pts = pts;

      haloSize[i] = n.r * (n.kind === "core" ? 9 : n.kind === "hub" ? 8 : 6.5);
      haloCol.set([col.r, col.g, col.b], i * 3);
    });

    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
    hg.setAttribute("aSize", new THREE.BufferAttribute(haloSize, 1));
    hg.setAttribute("aColor", new THREE.BufferAttribute(haloCol, 3));
    hg.setAttribute("aAlpha", new THREE.BufferAttribute(haloAlpha, 1));
    halo = new THREE.Points(
      hg,
      new THREE.ShaderMaterial({ vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, uniforms: { uScale: shared.uScale }, transparent: true, depthWrite: false, blending }),
    );
    halo.frustumCulled = false;
    halo.renderOrder = -1;
    scene.add(halo);

    ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.3, 10, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.acc), transparent: true, opacity: 0.85 }));
    scene.add(ring);

    linePos = new Float32Array(edges.length * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    lineBase = dark ? 0.1 : 0.3;
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(dark ? colors.acc : token("--line2", "#CDD1D8")), transparent: true, opacity: lineBase }));
    lines.frustumCulled = false;
    scene.add(lines);

    // Streams run from the first node of an edge to the second, in the colour of where they arrive.
    streamPhase = Float32Array.from({ length: edges.length * STREAM }, () => Math.random());
    streamJitter = Float32Array.from({ length: edges.length * STREAM * 3 }, () => (Math.random() - 0.5) * 1.6);
    streamPos = new Float32Array(edges.length * STREAM * 3);
    streamHead = new Float32Array(edges.length * STREAM);
    const streamCol = new Float32Array(edges.length * STREAM * 3);
    edges.forEach(([, b], i) => {
      const c = new THREE.Color(colors[byId[b]?.st] ?? colors.acc);
      for (let q = 0; q < STREAM; q++) streamCol.set([c.r, c.g, c.b], (i * STREAM + q) * 3);
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
    sg.setAttribute("aColor", new THREE.BufferAttribute(streamCol, 3));
    sg.setAttribute("aHead", new THREE.BufferAttribute(streamHead, 1));
    streams = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        vertexShader: STREAM_VERT,
        fragmentShader: STREAM_FRAG,
        uniforms: { uScale: shared.uScale, uFocus: shared.uFocus, uSize: { value: 1.5 }, uOpacity: { value: dark ? 0.9 : 0.75 } },
        transparent: true,
        depthWrite: false,
        blending,
      }),
    );
    streams.frustumCulled = false;
    scene.add(streams);

    labels.replaceChildren();
    tags = {};
    for (const n of nodes) {
      const d = document.createElement("div");
      d.style.cssText = "position:absolute;left:0;top:0;opacity:0;white-space:nowrap;pointer-events:none;transition:opacity .2s;color:var(--ink);will-change:transform";
      if (n.kind === "core") {
        d.style.textAlign = "center";
        const num = document.createElement("div");
        num.style.cssText = "font-family:var(--font-serif);font-size:40px;line-height:1";
        num.textContent = n.val === null || n.val === undefined ? "—" : String(n.val);
        const cap = document.createElement("div");
        cap.style.cssText = "font-family:var(--font-mono);font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mut2);margin-top:2px";
        cap.textContent = n.label;
        d.append(num, cap);
      } else if (n.kind === "hub") {
        d.style.cssText += ";font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:var(--card);border:1px solid var(--line);box-shadow:0 2px 10px rgba(0,0,0,.08)";
        d.textContent = n.val === null || n.val === undefined ? n.label : `${n.label}  ${n.val}`;
      } else {
        d.style.cssText += ";font-size:11.5px;font-weight:700;text-shadow:0 0 6px var(--bg),0 0 3px var(--bg),0 0 2px var(--bg)";
        d.textContent = n.label;
      }
      labels.appendChild(d);
      tags[n.id] = d;
    }
  }

  function hit(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    const first = ray.intersectObjects(Object.values(meshes), false)[0];
    return first ? (first.object.userData.id as string) : null;
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch: number | null = null;

  const onDown = (e: PointerEvent) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    lastTouch = performance.now();
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === "mouse") hover = hit(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      orbit.th -= dx * 0.006;
      orbit.ph = Math.max(0.3, Math.min(2.85, orbit.ph - dy * 0.006));
      moved += Math.abs(dx) + Math.abs(dy);
    } else {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom = clampZoom((zoom * pinch) / d);
      pinch = d;
      moved += 20;
    }
    lastTouch = performance.now();
  };
  const onUp = (e: PointerEvent) => {
    const had = pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.style.cursor = "";
    if (had && moved < 6 && e.type === "pointerup") onSelect(hit(e));
  };
  const onLeave = () => {
    hover = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoom = clampZoom(zoom * (1 + e.deltaY * 0.0012));
    lastTouch = performance.now();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const resize = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height);
    rescale();
  });
  resize.observe(host);

  /** Point sizes are in world units; this turns them into pixels at distance 1. */
  function rescale() {
    shared.uScale.value = renderer.getDrawingBufferSize(v2).y * 0.5 * camera.projectionMatrix.elements[5];
  }
  rescale();

  function applyTier(next: Tier) {
    tier = next;
    cfg = TIERS[next];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dpr));
    shared.uDof.value = cfg.dof;
    shared.uTwinkle.value = reduced ? 0 : cfg.twinkle;
    for (const m of Object.values(meshes)) {
      const pts = m.userData.pts as Three.Points;
      pts.geometry.setDrawRange(0, Math.ceil((pts.userData.count as number) * cfg.density));
    }
    rescale();
  }

  const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

  function frame(t: number) {
    if (!graph || !lines || !ring || !halo) return;
    const { nodes, edges } = graph;
    const now = performance.now();
    const sel = selected ? byId[selected] : undefined;
    const ease = reduced ? 1 : 0.08;

    // After the fly-in, watch the frame time for a few seconds and draw less if it is too slow.
    if (lastFrame && now - born > 2200 && frames < 150 && document.visibilityState === "visible") {
      frames++;
      if (now - lastFrame > 30) slow++;
      if (frames === 150 && slow > 60) {
        const down = STEP_DOWN[tier];
        if (down) applyTier(down);
        frames = slow = 0;
      }
    }
    lastFrame = now;

    // Fly in once: from far and to the side, settling where the map rests.
    const intro = reduced ? 1 : easeOut(Math.min(1, (now - born) / 1800));

    if (spin && now - lastTouch > 3500 && !sel) orbit.th += 0.0016;

    const hub = sel && sel.kind !== "core" ? byId[`h-${sel.hub}`] : undefined;
    if (hub) {
      const want = Math.atan2(hub.pos[2], hub.pos[0]);
      const d = Math.atan2(Math.sin(want - orbit.th), Math.cos(want - orbit.th));
      orbit.th += d * (reduced ? 1 : 0.06);
      orbit.ph += (1.25 - orbit.ph) * (reduced ? 1 : 0.06);
    }
    const items = hub ? nodes.filter((n) => n.hub === hub.hub && n.kind !== "hub").length : 0;
    orbit.r += ((sel ? 130 + items * 8 : zoom) - orbit.r) * ease;

    // Keep the chosen node clear of the panel: beside it when wide, above it on a phone.
    const wide = canvas.clientWidth > WIDE;
    const camR = orbit.r * (1 + 1.3 * (1 - intro));
    const camTh = orbit.th - 1.4 * (1 - intro);
    if (sel) {
      tmp.copy(meshes[sel.id].position);
      if (wide) tmp.add(tmp2.set(Math.sin(orbit.th), 0, -Math.cos(orbit.th)).multiplyScalar(-orbit.r * 0.22));
      else tmp.y -= orbit.r * 0.12;
    } else tmp.set(0, 0, 0);
    look.lerp(tmp, ease);

    camera.position.set(
      look.x + camR * Math.sin(orbit.ph) * Math.cos(camTh),
      look.y + camR * Math.cos(orbit.ph),
      look.z + camR * Math.sin(orbit.ph) * Math.sin(camTh),
    );
    camera.lookAt(look);

    const tt = reduced ? 0 : t / 1000;
    shared.uTime.value = tt;
    shared.uFocus.value = camR;
    const inFocus = (n: MapNode) => !hub || n.id === sel?.id || n.id === hub.id || (n.hub === hub.hub && n.kind !== "hub");
    if (focusHub !== (hub?.id ?? null)) {
      focusHub = hub?.id ?? null;
      focusAt = now;
      (lines.material as Three.LineBasicMaterial).opacity = hub ? 0.25 : lineBase;
    }

    nodes.forEach((n, i) => {
      const me = meshes[n.id];
      const leaf = n.kind !== "core" && n.kind !== "hub";
      const on = inFocus(n);
      if (leaf) {
        // An area's items open out one after another when it is chosen, and fold back when it is left.
        const want = hub && n.hub === hub.hub ? 1 : 0;
        const wait = want ? (order[n.id] ?? 0) * 45 : 0;
        if (reduced) openness[n.id] = want;
        else if (now - focusAt >= wait) openness[n.id] += (want - openness[n.id]) * 0.1;
        const o = openness[n.id];
        const h = byId[`h-${n.hub}`];
        const k = 0.5 + 0.5 * o;
        me.position.set(h.pos[0] + (n.pos[0] - h.pos[0]) * k, h.pos[1] + (n.pos[1] - h.pos[1]) * k + Math.sin(tt * 0.8 + n.ph) * 1.2, h.pos[2] + (n.pos[2] - h.pos[2]) * k);
      }
      const o = openness[n.id];
      const pulse = n.st === "bad" ? 1 + Math.sin(tt * 3 + n.ph) * 0.12 : 1;
      me.scale.setScalar(n.r * pulse * (leaf ? 0.7 + 0.3 * o : 1) * (hover === n.id || selected === n.id ? 1.35 : 1));
      const pts = me.userData.pts as Three.Points;
      pts.rotation.y = tt * 0.2 + n.ph;
      const u = (pts.material as Three.ShaderMaterial).uniforms.uOpacity;
      const wantA = (on ? (pts.userData.gain as number) : 0.06) * intro;
      u.value += (wantA - u.value) * (reduced ? 1 : 0.12);
      haloPos.set([me.position.x, me.position.y, me.position.z], i * 3);
      const glow = (on ? (dark ? 0.2 : 0.1) : 0) * intro * (n.kind === "core" ? 1.3 : 1) * (selected === n.id || hover === n.id ? 1.6 : 1);
      haloAlpha[i] += (glow - haloAlpha[i]) * (reduced ? 1 : 0.12);
    });
    halo.geometry.attributes.position.needsUpdate = true;
    halo.geometry.attributes.aAlpha.needsUpdate = true;

    ring.visible = !hub;
    ring.lookAt(camera.position);
    ring.rotation.z = tt * 0.4;

    edges.forEach(([a, b], i) => {
      const A = meshes[a].position;
      const B = meshes[b].position;
      linePos.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6);
      const show = !hub || (inFocus(byId[a]) && inFocus(byId[b]));
      for (let q = 0; q < STREAM; q++) {
        const o = (i * STREAM + q) * 3;
        if (!show || q >= cfg.stream) {
          streamPos[o] = streamPos[o + 1] = streamPos[o + 2] = 1e5;
          continue;
        }
        const p = (streamPhase[i * STREAM + q] + tt * 0.08) % 1;
        const w = Math.sin(p * Math.PI);
        streamPos[o] = A.x + (B.x - A.x) * p + streamJitter[o] * w;
        streamPos[o + 1] = A.y + (B.y - A.y) * p + streamJitter[o + 1] * w;
        streamPos[o + 2] = A.z + (B.z - A.z) * p + streamJitter[o + 2] * w;
        // Brighter and larger towards the end it is heading for: the direction can be read.
        streamHead[i * STREAM + q] = p * p * intro;
      }
    });
    lines.geometry.attributes.position.needsUpdate = true;
    if (streams) {
      streams.geometry.attributes.position.needsUpdate = true;
      streams.geometry.attributes.aHead.needsUpdate = true;
    }

    renderer.render(scene, camera);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const close = !sel && orbit.r < 150;
    const px = (h / 2) * camera.projectionMatrix.elements[5]; // world units to pixels at distance 1
    const core = meshes.core;
    const coreDist = core ? camera.position.distanceTo(core.position) : 0;
    const coreP = core ? tmp2.copy(core.position).project(camera) : null;
    const coreX = coreP ? ((coreP.x + 1) / 2) * w : 0;
    const coreY = coreP ? ((1 - coreP.y) / 2) * h : 0;
    const coreR = core ? (byId.core.r * 1.45 * px) / Math.max(1, coreDist) : 0;
    const fade: Record<string, number> = {};
    for (const n of nodes) {
      const d = tags[n.id];
      const pos = meshes[n.id].position;
      const dist = camera.position.distanceTo(pos);
      const p = tmp.copy(pos).project(camera);
      if (p.z > 1) {
        d.show = false;
        continue;
      }
      const sx = ((p.x + 1) / 2) * w;
      const sy = ((1 - p.y) / 2) * h;
      d.x = sx;
      d.y = sy + (n.kind === "core" ? 0 : (meshes[n.id].scale.x * 1.5 * px) / dist + 14);
      d.style.transform = `translate(${d.x.toFixed(1)}px,${d.y.toFixed(1)}px) translate(-50%,-50%)`;
      // A label whose node sits behind the core would be read through it: hide it.
      const behindCore = n.kind !== "core" && dist > coreDist && Math.hypot(sx - coreX, d.y - coreY) < coreR + 18;
      d.show = !behindCore && intro > 0.85 && (hub ? inFocus(n) : n.kind === "core" || n.kind === "hub" || hover === n.id || close);
      // Further away reads fainter, so depth shows in the labels too.
      fade[n.id] = n.kind === "core" || n.id === selected ? 1 : Math.max(0.45, Math.min(1, 1.25 - (dist - camR) / (camR * 0.9)));
    }

    // Biggest labels first; anything that would overlap one already placed stays hidden.
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    const rank = (n: MapNode) => (n.id === selected ? 3 : n.kind === "core" ? 2 : n.kind === "hub" ? 1 : 0);
    for (const n of [...nodes].sort((a, b) => rank(b) - rank(a) || b.r - a.r)) {
      const d = tags[n.id];
      if (!d.show) {
        d.style.opacity = "0";
        continue;
      }
      const pad = 4;
      const R = { l: d.x! - d.offsetWidth / 2 - pad, r: d.x! + d.offsetWidth / 2 + pad, t: d.y! - d.offsetHeight / 2 - pad, b: d.y! + d.offsetHeight / 2 + pad };
      if (n.id !== selected && placed.some((q) => R.l < q.r && R.r > q.l && R.t < q.b && R.b > q.t)) {
        d.style.opacity = "0";
        continue;
      }
      placed.push(R);
      d.style.opacity = fade[n.id].toFixed(2);
    }
  }

  renderer.setAnimationLoop(frame);

  return {
    setGraph(next) {
      graph = next;
      build();
    },
    setSelected(id) {
      selected = id;
    },
    setSpin(on) {
      spin = on;
    },
    fit() {
      zoom = fitZoom();
      orbit.ph = 1.15;
    },
    tier: () => tier,
    repaint: build,
    dispose() {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      clear();
      sphere.dispose();
      renderer.dispose();
      canvas.remove();
      labels.replaceChildren();
    },
  };
}
