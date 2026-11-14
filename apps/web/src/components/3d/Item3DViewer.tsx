import { useEffect, useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  EQUIPMENT_MODEL_KEYS,
  createEquipmentModel,
  type EquipmentModelKey,
} from './equipmentModels';

export interface Item3DViewerProps {
  name: string;
  category?: string;
  className?: string;
  height?: number | string;
}

// ─── Equipment Matching Logic ────────────────────────────────────────────────

export function getModelKey(name: string, category?: string): EquipmentModelKey {
  const text = ` ${name} ${category || ''} `.toLowerCase();

  // 1. Cleats / Footwear (check before ball/sport name so 'Soccer Boots' -> cleats)
  if (
    text.includes('cleat') ||
    text.includes('stud') ||
    text.includes('shoe') ||
    text.includes('boot') ||
    text.includes('footwear') ||
    text.includes('spike') ||
    text.includes('sneaker')
  ) {
    return 'cleats';
  }

  // 2. Stopwatch / Timer (check before whistle so 'Coach Stopwatch' -> stopwatch)
  if (
    text.includes('stopwatch') ||
    text.includes('timer') ||
    text.includes('clock') ||
    text.includes('counter')
  ) {
    return 'stopwatch';
  }

  // 3. Helmet / Headgear (check before bat/racket so 'Batting Helmet' -> helmet)
  if (
    text.includes('helmet') ||
    text.includes('headgear') ||
    text.includes('visor') ||
    text.includes('faceguard') ||
    text.includes('mask')
  ) {
    return 'helmet';
  }

  // 4. Shin Guards / Protective Pads
  if (
    text.includes('shin') ||
    text.includes('guard') ||
    /\bpads?\b/.test(text) ||
    text.includes('protector') ||
    text.includes('brace')
  ) {
    return 'shinguards';
  }

  // 5. Jersey / Apparel (check before generic sport names)
  if (
    text.includes('jersey') ||
    text.includes('uniform') ||
    text.includes('apparel') ||
    text.includes('shirt') ||
    text.includes('bib') ||
    text.includes('pinny') ||
    text.includes('shorts') ||
    text.includes('socks') ||
    text.includes('clothing')
  ) {
    return 'jersey';
  }

  // 6. Water Bottle / Hydration
  if (
    text.includes('bottle') ||
    text.includes('water') ||
    text.includes('hydration') ||
    text.includes('drink') ||
    text.includes('flask') ||
    text.includes('shaker') ||
    text.includes('canteen') ||
    text.includes('jug')
  ) {
    return 'bottle';
  }

  // 7. Training Cones / Agility Markers
  if (
    text.includes('cone') ||
    text.includes('marker') ||
    text.includes('pylon') ||
    text.includes('agility') ||
    text.includes('drill') ||
    text.includes('slalom') ||
    text.includes('hurdle') ||
    text.includes('boundary')
  ) {
    return 'cone';
  }

  // 8. First Aid Kit / Medical
  if (
    text.includes('first aid') ||
    text.includes('medical') ||
    text.includes('tape') ||
    text.includes('bandage') ||
    text.includes('gauze') ||
    text.includes('ice pack') ||
    text.includes('trauma') ||
    text.includes('spray') ||
    (text.includes('kit') && !text.includes('apparel'))
  ) {
    return 'kit';
  }

  // 9. Sports Racket / Bats / Paddles
  if (
    text.includes('racket') ||
    text.includes('racquet') ||
    text.includes('paddle') ||
    text.includes('pickleball') ||
    text.includes('tennis') ||
    text.includes('badminton') ||
    text.includes('squash') ||
    /\bbat\b/.test(text) ||
    text.includes('baseball bat') ||
    text.includes('softball bat') ||
    text.includes('stick') ||
    text.includes('club')
  ) {
    return 'racket';
  }

  // 10. Gym Duffel Bag / Backpack
  if (
    text.includes('bag') ||
    text.includes('duffel') ||
    text.includes('duffle') ||
    text.includes('backpack') ||
    text.includes('luggage') ||
    text.includes('pack') ||
    text.includes('sack') ||
    text.includes('tote') ||
    text.includes('carryall')
  ) {
    return 'bag';
  }

  // 11. Referee Whistle / Officiating
  if (
    text.includes('whistle') ||
    text.includes('referee') ||
    text.includes('umpire') ||
    text.includes('card') ||
    text.includes('coach')
  ) {
    return 'whistle';
  }

  // 12. Trophy / Award
  if (
    text.includes('trophy') ||
    text.includes('medal') ||
    text.includes('cup') ||
    text.includes('award') ||
    text.includes('champion') ||
    text.includes('tournament') ||
    text.includes('plaque')
  ) {
    return 'trophy';
  }

  // 13. Basketball
  if (text.includes('basketball') || text.includes('hoop')) {
    return 'basketball';
  }

  // 14. American Football / Rugby
  if (text.includes('football') || text.includes('rugby') || text.includes('nfl') || text.includes('pigskin')) {
    return 'football';
  }

  // 15. Soccer Ball (futsal, soccer, match ball, or generic ball)
  if (
    text.includes('soccer') ||
    text.includes('futsal') ||
    text.includes('ball')
  ) {
    return 'soccer';
  }

  // Deterministic fallback for everything else
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % EQUIPMENT_MODEL_KEYS.length;
  return EQUIPMENT_MODEL_KEYS[index];
}

// ─── Model Caching & Normalization ──────────────────────────────────────────

const modelCache = new Map<string, THREE.Group>();
const gltfLoader = new GLTFLoader();

function normalizeGroupDimensions(group: THREE.Group, targetRadius = 2.2): THREE.Group {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetRadius / maxDim;

  group.scale.setScalar(scale);
  group.position.x = -center.x * scale;
  group.position.y = -center.y * scale;
  group.position.z = -center.z * scale;
  return group;
}

export function loadOrGenerateModel(key: EquipmentModelKey): Promise<THREE.Group> {
  const cached = modelCache.get(key);
  if (cached) {
    return Promise.resolve(cached.clone(true));
  }

  // Try loading GLB first if available
  return new Promise((resolve) => {
    gltfLoader.load(
      `/models/${key}.glb`,
      (gltf) => {
        const scene = gltf.scene;
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        const root = new THREE.Group();
        root.add(scene);
        normalizeGroupDimensions(root, 2.2);
        modelCache.set(key, root);
        resolve(root.clone(true));
      },
      undefined,
      () => {
        // Fallback: Rich procedural textured 3D equipment model
        const proceduralGroup = createEquipmentModel(key);
        normalizeGroupDimensions(proceduralGroup, 2.2);
        modelCache.set(key, proceduralGroup);
        resolve(proceduralGroup.clone(true));
      },
    );
  });
}

// ─── Viewer Component ────────────────────────────────────────────────────────

export const Item3DViewer = memo(function Item3DViewer({
  name,
  category,
  className = '',
  height = 200,
}: Item3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  // Drag interaction refs
  const isDragging = useRef(false);
  const prevPointer = useRef({ x: 0, y: 0 });
  const rotVelocity = useRef({ x: 0, y: 0.008 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let destroyed = false;
    let animId: number;

    const width = container.clientWidth || 280;
    const h = typeof height === 'number' ? height : parseInt(height, 10) || 200;

    // Scene & Perspective Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / h, 0.1, 100);
    camera.position.set(0, 0.8, 4.4);
    camera.lookAt(0, 0, 0);

    // High performance antialiased WebGL renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ── Studio 3-Point Athletic Lighting ──────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Key Light from upper-right
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(4, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Signature PackPlay orange rim light from back-left
    const orangeRimLight = new THREE.DirectionalLight(0xff4d00, 1.3);
    orangeRimLight.position.set(-4, -2, -3);
    scene.add(orangeRimLight);

    // Warm varsity fill light
    const fillLight = new THREE.DirectionalLight(0xfdba74, 0.5);
    fillLight.position.set(0, -3, 3);
    scene.add(fillLight);

    // Subtle contact shadow disc at base
    const shadowGeo = new THREE.CircleGeometry(1.2, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.2;
    scene.add(shadowMesh);

    // Model pivot container
    const pivot = new THREE.Group();
    scene.add(pivot);

    // Wireframe placeholder during first parse
    const placeholderGeo = new THREE.IcosahedronGeometry(0.9, 0);
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0xff4d00,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
    pivot.add(placeholderMesh);

    // Load or generate high-quality textured model
    const modelKey = getModelKey(name, category);
    loadOrGenerateModel(modelKey)
      .then((loadedGroup) => {
        if (destroyed) return;
        pivot.remove(placeholderMesh);
        placeholderGeo.dispose();
        placeholderMat.dispose();
        pivot.add(loadedGroup);
        setLoading(false);
      })
      .catch(() => {
        if (destroyed) return;
        pivot.remove(placeholderMesh);
        // Guaranteed fallback: PackPlay Vault model
        const fallback = createEquipmentModel('vault');
        normalizeGroupDimensions(fallback, 2.2);
        pivot.add(fallback);
        setLoading(false);
      });

    // ── Pointer Drag / Orbit Handlers ─────────────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      prevPointer.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - prevPointer.current.x;
      const deltaY = e.clientY - prevPointer.current.y;
      prevPointer.current = { x: e.clientX, y: e.clientY };

      pivot.rotation.y += deltaX * 0.012;
      pivot.rotation.x = Math.max(-0.6, Math.min(0.6, pivot.rotation.x + deltaY * 0.01));
      rotVelocity.current = { x: deltaY * 0.005, y: deltaX * 0.008 };
    };

    const onPointerUp = () => {
      isDragging.current = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // ── Render loop with turntable rotation & inertia damping ─────────────────
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isDragging.current) {
        // Inertia damping and gentle baseline turntable spin
        rotVelocity.current.y = THREE.MathUtils.lerp(rotVelocity.current.y, 0.008, 0.04);
        rotVelocity.current.x = THREE.MathUtils.lerp(rotVelocity.current.x, 0, 0.04);
        pivot.rotation.y += rotVelocity.current.y;
        pivot.rotation.x += rotVelocity.current.x;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / h;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, h);
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [name, category, height]);

  return (
    <div
      className={`relative w-full rounded-md overflow-hidden bg-gradient-to-b from-[#1E1E24]/5 to-[#1E1E24]/10 border border-brand-border/20 ${className}`}
      style={{ height }}
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] pointer-events-none transition-opacity duration-300">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-headline text-[9px] uppercase tracking-widest text-brand-muted font-bold">
              RENDERING 3D ASSET
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-1 right-2 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
        <span className="font-headline text-[8px] uppercase tracking-widest text-brand-muted">
          DRAG TO ROTATE
        </span>
      </div>
    </div>
  );
});
