import * as THREE from 'three';

// ─── Supported Equipment Model Keys ─────────────────────────────────────────

export const EQUIPMENT_MODEL_KEYS = [
  'soccer',
  'basketball',
  'football',
  'cleats',
  'bottle',
  'cone',
  'kit',
  'racket',
  'bag',
  'whistle',
  'jersey',
  'trophy',
  'helmet',
  'shinguards',
  'stopwatch',
  'vault',
] as const;

export type EquipmentModelKey = (typeof EQUIPMENT_MODEL_KEYS)[number];

// ─── Procedural Canvas Texture Generators ────────────────────────────────────

function createTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      draw(ctx, width, height);
    }
  } catch {
    // In headless jsdom test environments, getContext may be unmocked
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  return texture;
}

// 1. Classic Soccer Ball Hexagon/Pentagon Texture
export function createSoccerBallTexture(): THREE.CanvasTexture {
  return createTexture(1024, 512, (ctx, w, h) => {
    // Premium off-white stitched leather base
    ctx.fillStyle = '#F5F5F7';
    ctx.fillRect(0, 0, w, h);

    // Subtle leather grain texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    for (let i = 0; i < 6000; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }

    // Grid of pentagons & hexagons
    const cols = 6;
    const rows = 3;
    const cellW = w / cols;
    const cellH = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * cellW + cellW / 2 + (r % 2 === 1 ? cellW / 4 : -cellW / 4);
        const cy = r * cellH + cellH / 2;
        const radius = Math.min(cellW, cellH) * 0.36;

        const isPentagon = (r + c) % 2 === 0;

        ctx.beginPath();
        const sides = isPentagon ? 5 : 6;
        for (let s = 0; s < sides; s++) {
          const angle = (s * 2 * Math.PI) / sides - Math.PI / 2;
          const px = cx + radius * Math.cos(angle);
          const py = cy + radius * Math.sin(angle);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        if (isPentagon) {
          ctx.fillStyle = '#18181B';
          ctx.fill();
        } else {
          ctx.fillStyle = '#FAFAFC';
          ctx.fill();
        }

        // Realistic seam stitching line
        ctx.strokeStyle = '#27272A';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Stitch dash accents
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });
}

// 2. Dimpled Pebbled Basketball Texture with Black Seam Channels
export function createBasketballTexture(): THREE.CanvasTexture {
  return createTexture(1024, 512, (ctx, w, h) => {
    // Rich basketball orange leather
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#E65100');
    grad.addColorStop(0.5, '#F57C00');
    grad.addColorStop(1, '#D84315');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Pebbled rubber dimple dots
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const ox = (y % 12 === 0 ? 3 : 0) + (Math.random() - 0.5) * 1.5;
        const oy = (Math.random() - 0.5) * 1.5;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Black curved basketball seam channels
    ctx.strokeStyle = '#121214';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';

    // Horizontal equator
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Vertical seam lines
    for (let i = 0; i <= 4; i++) {
      const sx = (w / 4) * i;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }

    // Curved ribbing arcs
    ctx.beginPath();
    ctx.ellipse(w * 0.25, h / 2, w * 0.18, h * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(w * 0.75, h / 2, w * 0.18, h * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// 3. American Football Pebbled Brown Leather Texture with Grip Stripes
export function createFootballTexture(): THREE.CanvasTexture {
  return createTexture(1024, 512, (ctx, w, h) => {
    // Deep pigskin leather
    ctx.fillStyle = '#6D2B12';
    ctx.fillRect(0, 0, w, h);

    // Pebbled leather grain
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < h; y += 5) {
      for (let x = 0; x < w; x += 5) {
        ctx.fillRect(x + ((y % 10 === 0) ? 2.5 : 0), y, 1.8, 1.8);
      }
    }

    // White varsity grip stripes near both tapered ends
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(w * 0.15, 0, w * 0.05, h);
    ctx.fillRect(w * 0.80, 0, w * 0.05, h);

    // Stitched central seam
    ctx.strokeStyle = '#3E1404';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
}

// 4. Athletic Cleat Synthetic Weave & Team Speed Texture
export function createCleatTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1E1E24';
    ctx.fillRect(0, 0, w, h);

    // Honeycomb micro-texture
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 12) {
      for (let x = 0; x < w; x += 12) {
        ctx.strokeRect(x, y, 10, 10);
      }
    }

    // Dynamic PackPlay orange speed swish
    ctx.fillStyle = '#FF4D00';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.6);
    ctx.quadraticCurveTo(w * 0.5, h * 0.45, w * 0.9, h * 0.25);
    ctx.quadraticCurveTo(w * 0.55, h * 0.55, w * 0.15, h * 0.72);
    ctx.closePath();
    ctx.fill();

    // White speed accent
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.76);
    ctx.quadraticCurveTo(w * 0.55, h * 0.58, w * 0.9, h * 0.32);
    ctx.stroke();
  });
}

// 5. Water Bottle Stainless & PackPlay Grip Texture
export function createBottleTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    // Brushed metallic gradient
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#CBD5E1');
    grad.addColorStop(0.3, '#F1F5F9');
    grad.addColorStop(0.5, '#FFFFFF');
    grad.addColorStop(0.7, '#E2E8F0');
    grad.addColorStop(1, '#94A3B8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // PackPlay orange rubber waist grip band
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(0, h * 0.38, w, h * 0.24);

    // Diamond knurling grip pattern on band
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.38);
      ctx.lineTo(x + 20, h * 0.62);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 20, h * 0.38);
      ctx.lineTo(x, h * 0.62);
      ctx.stroke();
    }

    // Measurement marks
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px monospace';
    const marks = ['750 ML', '500 ML', '250 ML', '100 ML'];
    marks.forEach((txt, idx) => {
      const y = h * 0.7 + idx * 30;
      ctx.fillRect(w * 0.15, y, 20, 2);
      ctx.fillText(txt, w * 0.22, y + 4);
    });
  });
}

// 6. Training Cone Reflective Honeycomb Band Texture
export function createConeTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    // Vibrant safety orange
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(0, 0, w, h);

    // Molded ring lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 3;
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Wide reflective white vinyl stripe
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h * 0.42, w, h * 0.22);

    // Prismatic micro-honeycomb on reflective band
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.25)';
    ctx.lineWidth = 1;
    for (let y = h * 0.42; y < h * 0.64; y += 8) {
      for (let x = 0; x < w; x += 8) {
        ctx.strokeRect(x, y, 6, 6);
      }
    }
  });
}

// 7. First Aid Kit Medical Cross Emblem Texture
export function createFirstAidTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    // Emergency tactical red
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, 0, w, h);

    // Border bevel frame
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Centered bright white medical cross
    const cx = w / 2;
    const cy = h / 2;
    const barW = 44;
    const barL = 140;

    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 10;
    // Horizontal bar
    ctx.fillRect(cx - barL / 2, cy - barW / 2, barL, barW);
    // Vertical bar
    ctx.fillRect(cx - barW / 2, cy - barL / 2, barW, barL);
    ctx.shadowBlur = 0;

    // Typography
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText('FIRST AID', cx, h - 50);
  });
}

// 8. Sports Racket String Bed Lattice Texture
export function createRacketStringsTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // High-density cross nylon strings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.6;

    const step = 14;
    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Stenciled PackPlay orange center target emblem
    ctx.fillStyle = 'rgba(255, 77, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 48, 0, Math.PI * 2);
    ctx.fill();
  });
}

// 9. Sports Racket Handle Grip Tape Texture
export function createRacketGripTexture(): THREE.CanvasTexture {
  return createTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, w, h);

    // Overlapping spiral wrap lines
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 3;
    for (let y = -50; y < h + 50; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 45);
      ctx.stroke();
    }

    // Perforation ventilation holes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    for (let y = 10; y < h; y += 20) {
      for (let x = 12; x < w; x += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// 10. Gym Duffel Bag Woven Ballistic Nylon & Top Zipper Texture
export function createDuffelTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    // Charcoal tactical canvas
    ctx.fillStyle = '#27272A';
    ctx.fillRect(0, 0, w, h);

    // Woven 900D texture
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Centered zipper teeth track
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, h * 0.48, w, 20);

    ctx.fillStyle = '#A1A1AA';
    for (let x = 0; x < w; x += 6) {
      ctx.fillRect(x, h * 0.48 + 3, 3, 6);
      ctx.fillRect(x + 3, h * 0.48 + 11, 3, 6);
    }

    // PackPlay orange accent piping
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(0, h * 0.44, w, 4);
    ctx.fillRect(0, h * 0.54, w, 4);
  });
}

// 11. Athletic Jersey Micro-Mesh & Team Varsity Graphic Texture
export function createJerseyTexture(): THREE.CanvasTexture {
  return createTexture(1024, 1024, (ctx, w, h) => {
    // Clean athletic white fabric
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, w, h);

    // Athletic breathable eyelet mesh texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        ctx.beginPath();
        ctx.arc(x + (y % 12 === 0 ? 3 : 0), y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bold PackPlay orange varsity chest band
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(0, h * 0.28, w, h * 0.18);

    // Dark trim accents
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, h * 0.26, w, 12);
    ctx.fillRect(0, h * 0.46, w, 12);

    // Varsity Player Number "10" on chest
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 130px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('10', w / 2, h * 0.37);

    // "PACKPLAY" chest lettering
    ctx.fillStyle = '#18181B';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('PACKPLAY', w / 2, h * 0.21);
  });
}

// 12. Trophy Plaque Inscription Texture
export function createTrophyPlaqueTexture(): THREE.CanvasTexture {
  return createTexture(512, 256, (ctx, w, h) => {
    // Brushed gold/brass finish
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#D4AF37');
    grad.addColorStop(0.5, '#FEE180');
    grad.addColorStop(1, '#AA7C11');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#6E4E05';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = '#3A2700';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px serif';
    ctx.fillText('PACKPLAY READINESS AWARD', w / 2, h * 0.42);
    ctx.font = 'italic 16px serif';
    ctx.fillText('CHAMPIONSHIP SQUAD', w / 2, h * 0.68);
  });
}

// 13. PackPlay Equipment Vault Carbon-Fiber Texture
export function createVaultTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    // Dark carbon base
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, w, h);

    // Carbon weave twill simulation
    ctx.fillStyle = '#27272A';
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        if ((x + y) % 16 === 0) {
          ctx.fillRect(x, y, 7, 7);
        }
      }
    }

    // PackPlay orange center shield emblem
    ctx.fillStyle = '#FF4D00';
    ctx.beginPath();
    ctx.roundRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4, 16);
    ctx.fill();

    // Inner play mark
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.4);
    ctx.lineTo(w * 0.6, h * 0.5);
    ctx.lineTo(w * 0.45, h * 0.6);
    ctx.closePath();
    ctx.fill();
  });
}

// 14. Sports Helmet Dual Racing Stripe & Aerodynamic Texture
export function createHelmetTexture(): THREE.CanvasTexture {
  return createTexture(1024, 512, (ctx, w, h) => {
    // Stealth carbon black shell
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, w, h);

    // Micro-honeycomb texture across shell
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 12) {
      for (let x = 0; x < w; x += 12) {
        ctx.strokeRect(x, y, 10, 10);
      }
    }

    // Bold center racing stripes
    const cx = w / 2;
    // Outer white pin stripes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 36, 0, 72, h);

    // Center PackPlay orange racing stripe
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(cx - 24, 0, 48, h);

    // Side aerodynamic speed chevrons
    [w * 0.2, w * 0.8].forEach((sx) => {
      ctx.fillStyle = '#FF4D00';
      ctx.beginPath();
      ctx.moveTo(sx - 30, h * 0.4);
      ctx.lineTo(sx + 30, h * 0.5);
      ctx.lineTo(sx - 30, h * 0.6);
      ctx.closePath();
      ctx.fill();
    });

    // Rear exhaust mesh vents
    ctx.fillStyle = '#09090B';
    ctx.fillRect(cx - 60, h * 0.82, 120, 24);
  });
}

// 15. Contoured Shin Guard Shock-Absorption Texture
export function createShinGuardTexture(): THREE.CanvasTexture {
  return createTexture(512, 1024, (ctx, w, h) => {
    // Anatomical shield base
    ctx.fillStyle = '#27272A';
    ctx.fillRect(0, 0, w, h);

    // Carbon-composite twill grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 40);
      ctx.stroke();
    }

    // Dynamic PackPlay orange chevron spine
    ctx.fillStyle = '#FF4D00';
    for (let y = 140; y < h - 140; y += 120) {
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 - 70, y + 60);
      ctx.lineTo(w / 2 - 40, y + 60);
      ctx.lineTo(w / 2, y + 25);
      ctx.lineTo(w / 2 + 40, y + 60);
      ctx.lineTo(w / 2 + 70, y + 60);
      ctx.closePath();
      ctx.fill();
    }

    // "PACKPLAY IMPACT" lettering
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PACKPLAY', w / 2, h * 0.12);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#A1A1AA';
    ctx.fillText('IMPACT SHIELD', w / 2, h * 0.15);
  });
}

// 16. Digital Stopwatch Tactical LCD Face Texture
export function createStopwatchTexture(): THREE.CanvasTexture {
  return createTexture(512, 512, (ctx, w, h) => {
    // Outer dial rim
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, w, h);

    // Bezel tick marks
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = '#52525B';
    ctx.lineWidth = 2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 30) {
      const r1 = 230;
      const r2 = a % (Math.PI / 6) === 0 ? 210 : 220;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.stroke();
    }

    // Inner LCD frame
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.arc(cx, cy, 185, 0, Math.PI * 2);
    ctx.fill();

    // High contrast digital LCD display background
    ctx.fillStyle = '#022C22';
    ctx.beginPath();
    ctx.arc(cx, cy, 175, 0, Math.PI * 2);
    ctx.fill();

    // LCD digital readout
    ctx.fillStyle = '#34D399';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top status indicator
    ctx.font = 'bold 20px monospace';
    ctx.fillText('LAP 04  SPLIT', cx, cy - 70);

    // Main stopwatch time
    ctx.font = '900 68px monospace';
    ctx.fillText('00:42.85', cx, cy);

    // Millisecond sub counter
    ctx.font = 'bold 22px monospace';
    ctx.fillText('1/100 SEC', cx, cy + 55);

    // Brand tag
    ctx.fillStyle = '#FF4D00';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('PACKPLAY TIMING', cx, cy + 95);
  });
}


// ─── High-Quality Procedural 3D Model Builders ───────────────────────────────

export function buildSoccerBallModel(): THREE.Group {
  const group = new THREE.Group();
  const tex = createSoccerBallTexture();
  const geo = new THREE.SphereGeometry(1.1, 48, 48);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.35,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function buildBasketballModel(): THREE.Group {
  const group = new THREE.Group();
  const tex = createBasketballTexture();
  const geo = new THREE.SphereGeometry(1.1, 48, 48);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.65,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function buildAmericanFootballModel(): THREE.Group {
  const group = new THREE.Group();
  const tex = createFootballTexture();

  // Prolate spheroid with pointed football ends
  const geo = new THREE.SphereGeometry(0.85, 48, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const taper = 1.0 - 0.25 * (z * z);
    pos.setX(i, pos.getX(i) * taper);
    pos.setY(i, pos.getY(i) * taper);
    pos.setZ(i, z * 1.5);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.08,
  });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 3D Raised White Laces
  const laceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
  });
  // Center spine lace
  const centerLace = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 0.8),
    laceMat,
  );
  centerLace.position.set(0, 0.82, 0);
  group.add(centerLace);

  // Cross stitches
  for (let i = -3; i <= 3; i++) {
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.04, 0.05),
      laceMat,
    );
    cross.position.set(0, 0.82, i * 0.1);
    group.add(cross);
  }

  return group;
}

export function buildCleatsModel(): THREE.Group {
  const group = new THREE.Group();
  const cleatTex = createCleatTexture();

  const upperMat = new THREE.MeshStandardMaterial({
    map: cleatTex,
    roughness: 0.4,
    metalness: 0.1,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x111113,
    roughness: 0.2,
    metalness: 0.7,
  });
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    metalness: 0.4,
    roughness: 0.3,
  });
  const laceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
  });

  // Shoe Upper Body
  const heel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.9), upperMat);
  heel.position.set(0, 0.05, -0.6);
  heel.castShadow = true;
  group.add(heel);

  const toe = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.2, 16), upperMat);
  toe.rotation.x = Math.PI / 2;
  toe.position.set(0, -0.1, 0.45);
  toe.scale.set(0.85, 1, 0.5);
  toe.castShadow = true;
  group.add(toe);

  // Ankle collar
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.1, 12, 24),
    soleMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.42, -0.5);
  group.add(collar);

  // Crossed laces
  for (let i = 0; i < 4; i++) {
    const lace = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.03, 0.05),
      laceMat,
    );
    lace.position.set(0, 0.25, -0.2 + i * 0.2);
    group.add(lace);
  }

  // Sole Plate
  const sole = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.12, 2.1),
    soleMat,
  );
  sole.position.set(0, -0.38, 0);
  sole.receiveShadow = true;
  group.add(sole);

  // 8 Traction Cleat Studs
  const studPositions = [
    [-0.26, -0.5, -0.8],
    [0.26, -0.5, -0.8],
    [-0.26, -0.5, -0.3],
    [0.26, -0.5, -0.3],
    [-0.24, -0.5, 0.3],
    [0.24, -0.5, 0.3],
    [-0.20, -0.5, 0.8],
    [0.20, -0.5, 0.8],
  ];

  studPositions.forEach(([x, y, z]) => {
    const stud = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.18, 8),
      studMat,
    );
    stud.rotation.x = Math.PI;
    stud.position.set(x, y, z);
    group.add(stud);
  });

  return group;
}

export function buildWaterBottleModel(): THREE.Group {
  const group = new THREE.Group();
  const bottleTex = createBottleTexture();

  // Bottle Body
  const bodyGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.6, 32);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: bottleTex,
    roughness: 0.25,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Tapered Neck
  const neckGeo = new THREE.CylinderGeometry(0.24, 0.48, 0.3, 32);
  const neck = new THREE.Mesh(neckGeo, bodyMat);
  neck.position.set(0, 0.95, 0);
  group.add(neck);

  // Screw Cap
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x111113,
    roughness: 0.3,
    metalness: 0.2,
  });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.25, 32),
    capMat,
  );
  cap.position.set(0, 1.2, 0);
  group.add(cap);

  // Spout / Straw
  const spoutMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    roughness: 0.2,
    metalness: 0.1,
  });
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.16, 16),
    spoutMat,
  );
  spout.position.set(0.1, 1.36, 0);
  group.add(spout);

  // Loop Handle
  const loop = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.04, 12, 24),
    capMat,
  );
  loop.position.set(-0.16, 1.3, 0);
  loop.rotation.y = Math.PI / 2;
  group.add(loop);

  return group;
}

export function buildTrainingConeModel(): THREE.Group {
  const group = new THREE.Group();
  const coneTex = createConeTexture();

  // Square base plate
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    roughness: 0.4,
    metalness: 0.05,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.9), baseMat);
  base.position.set(0, -0.85, 0);
  base.receiveShadow = true;
  group.add(base);

  // Cone Upright Body
  const coneGeo = new THREE.CylinderGeometry(0.18, 0.85, 1.7, 32);
  const coneMat = new THREE.MeshStandardMaterial({
    map: coneTex,
    roughness: 0.35,
    metalness: 0.05,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(0, 0.05, 0);
  cone.castShadow = true;
  group.add(cone);

  // Top Hole Rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.04, 12, 24),
    baseMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.9, 0);
  group.add(rim);

  return group;
}

export function buildFirstAidKitModel(): THREE.Group {
  const group = new THREE.Group();
  const kitTex = createFirstAidTexture();

  // Tactical hardcase box
  const caseGeo = new THREE.BoxGeometry(1.8, 1.4, 0.85);
  const caseMat = new THREE.MeshStandardMaterial({
    map: kitTex,
    roughness: 0.3,
    metalness: 0.1,
  });
  const caseMesh = new THREE.Mesh(caseGeo, caseMat);
  caseMesh.castShadow = true;
  caseMesh.receiveShadow = true;
  group.add(caseMesh);

  // Dual metallic front latches
  const latchMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.2,
  });
  [-0.45, 0.45].forEach((lx) => {
    const latch = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.25, 0.08),
      latchMat,
    );
    latch.position.set(lx, 0, 0.44);
    group.add(latch);
  });

  // Top carry handle
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.4,
  });
  const handleBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.14),
    handleMat,
  );
  handleBar.position.set(0, 0.95, 0);
  group.add(handleBar);

  [-0.4, 0.4].forEach((hx) => {
    const handleStrut = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.25, 0.12),
      handleMat,
    );
    handleStrut.position.set(hx, 0.82, 0);
    group.add(handleStrut);
  });

  return group;
}

export function buildSportsRacketModel(): THREE.Group {
  const group = new THREE.Group();
  const stringTex = createRacketStringsTexture();
  const gripTex = createRacketGripTexture();

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.25,
    metalness: 0.4,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    roughness: 0.2,
    metalness: 0.5,
  });

  // Elliptical racket head frame
  const headFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.06, 16, 48),
    frameMat,
  );
  headFrame.scale.set(0.85, 1.25, 1);
  headFrame.position.set(0, 0.65, 0);
  headFrame.castShadow = true;
  group.add(headFrame);

  // String Bed Mesh Plane
  const stringMat = new THREE.MeshStandardMaterial({
    map: stringTex,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    roughness: 0.1,
  });
  const stringPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.7),
    stringMat,
  );
  stringPlane.position.set(0, 0.65, 0);
  group.add(stringPlane);

  // Racket Throat V-Yoke
  [-0.14, 0.14].forEach((tx) => {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12),
      frameMat,
    );
    strut.position.set(tx, -0.35, 0);
    strut.rotation.z = tx > 0 ? 0.2 : -0.2;
    group.add(strut);
  });

  // Grip Shaft
  const shaftMat = new THREE.MeshStandardMaterial({
    map: gripTex,
    roughness: 0.6,
  });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16),
    shaftMat,
  );
  shaft.position.set(0, -0.9, 0);
  shaft.castShadow = true;
  group.add(shaft);

  // Butt cap
  const buttCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.1, 16),
    accentMat,
  );
  buttCap.position.set(0, -1.35, 0);
  group.add(buttCap);

  return group;
}

export function buildGymDuffelBagModel(): THREE.Group {
  const group = new THREE.Group();
  const duffelTex = createDuffelTexture();

  const mainMat = new THREE.MeshStandardMaterial({
    map: duffelTex,
    roughness: 0.5,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    roughness: 0.3,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x111113,
    roughness: 0.8,
  });

  // Horizontal Barrel Body
  const bodyGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.8, 32);
  const body = new THREE.Mesh(bodyGeo, mainMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Side end caps
  [-0.92, 0.92].forEach((ex) => {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.66, 0.08, 32),
      accentMat,
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.set(ex, 0, 0);
    group.add(cap);
  });

  // Top Handles
  const handleLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 12, 32, Math.PI),
    strapMat,
  );
  handleLoop.position.set(0, 0.45, 0);
  group.add(handleLoop);

  // Handle velcro wrap
  const wrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16),
    accentMat,
  );
  wrap.rotation.z = Math.PI / 2;
  wrap.position.set(0, 1.0, 0);
  group.add(wrap);

  return group;
}

export function buildRefereeWhistleModel(): THREE.Group {
  const group = new THREE.Group();

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.95,
    roughness: 0.12,
  });
  const peaMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.6,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    metalness: 0.6,
    roughness: 0.2,
  });

  // Sound chamber sphere/cylinder
  const chamber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.65, 32),
    chromeMat,
  );
  chamber.rotation.z = Math.PI / 2;
  chamber.position.set(-0.2, 0, 0);
  chamber.castShadow = true;
  group.add(chamber);

  // Internal sound pea
  const pea = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), peaMat);
  pea.position.set(-0.2, 0, 0);
  group.add(pea);

  // Mouthpiece tube
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.35, 0.5),
    chromeMat,
  );
  mouth.position.set(0.45, 0.1, 0);
  group.add(mouth);

  // Split ring at back
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.04, 12, 24),
    ringMat,
  );
  ring.position.set(-0.75, 0, 0);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);

  return group;
}

export function buildJerseyModel(): THREE.Group {
  const group = new THREE.Group();
  const jerseyTex = createJerseyTexture();

  const fabricMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.3,
  });

  // Torso Body
  const torsoGeo = new THREE.CylinderGeometry(0.7, 0.62, 1.5, 32);
  const torso = new THREE.Mesh(torsoGeo, fabricMat);
  torso.castShadow = true;
  group.add(torso);

  // Left & Right Short Sleeves
  [-0.78, 0.78].forEach((sx) => {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.6, 24),
      fabricMat,
    );
    sleeve.position.set(sx, 0.45, 0);
    sleeve.rotation.z = sx > 0 ? -0.55 : 0.55;
    sleeve.castShadow = true;
    group.add(sleeve);
  });

  // Neck collar trim
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.06, 16, 32),
    trimMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.75, 0);
  group.add(collar);

  return group;
}

export function buildTrophyModel(): THREE.Group {
  const group = new THREE.Group();
  const plaqueTex = createTrophyPlaqueTexture();

  // Dark marble pedestal base
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), baseMat);
  base.position.set(0, -0.9, 0);
  base.receiveShadow = true;
  group.add(base);

  // Brass Plaque on front
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    roughness: 0.25,
    metalness: 0.7,
  });
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.32),
    plaqueMat,
  );
  plaque.position.set(0, -0.9, 0.61);
  group.add(plaque);

  // Polished gold materials
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.88,
    roughness: 0.18,
  });

  // Stepped plinth & stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.35, 0.6, 24),
    goldMat,
  );
  stem.position.set(0, -0.4, 0);
  group.add(stem);

  // Chalice cup bowl
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.3, 0.9, 32, 1, true),
    goldMat,
  );
  bowl.position.set(0, 0.3, 0);
  bowl.castShadow = true;
  group.add(bowl);

  // Dual sculpted golden handles
  [-0.85, 0.85].forEach((hx) => {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.05, 12, 24, Math.PI),
      goldMat,
    );
    handle.position.set(hx, 0.35, 0);
    handle.rotation.z = hx > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(handle);
  });

  return group;
}

export function buildHelmetModel(): THREE.Group {
  const group = new THREE.Group();
  const helmetTex = createHelmetTexture();

  const shellMat = new THREE.MeshStandardMaterial({
    map: helmetTex,
    roughness: 0.25,
    metalness: 0.35,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.85,
  });

  // Dome helmet shell
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65),
    shellMat,
  );
  dome.rotation.x = Math.PI;
  dome.position.set(0, 0.2, 0);
  dome.castShadow = true;
  group.add(dome);

  // Visor shield
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 0.3, 32, 1, true, 0, Math.PI),
    visorMat,
  );
  visor.position.set(0, 0.1, 0.2);
  group.add(visor);

  return group;
}

export function buildShinGuardsModel(): THREE.Group {
  const group = new THREE.Group();
  const guardTex = createShinGuardTexture();

  const guardMat = new THREE.MeshStandardMaterial({
    map: guardTex,
    roughness: 0.3,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    roughness: 0.2,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.7,
  });

  // Curved anatomical shield
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.42, 1.7, 32, 1, true, 0, Math.PI),
    guardMat,
  );
  shield.position.set(0, 0, -0.1);
  shield.castShadow = true;
  group.add(shield);

  // Central impact spine rib
  const rib = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.5, 0.08),
    accentMat,
  );
  rib.position.set(0, 0, 0.46);
  group.add(rib);

  // Dual elastic velcro straps
  [-0.5, 0.5].forEach((sy) => {
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.05, 12, 24),
      strapMat,
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, sy, 0);
    group.add(strap);
  });

  return group;
}

export function buildStopwatchModel(): THREE.Group {
  const group = new THREE.Group();
  const screenTex = createStopwatchTexture();

  const casingMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.3,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    roughness: 0.15,
    metalness: 0.1,
  });
  const btnMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    metalness: 0.6,
    roughness: 0.2,
  });

  // Round body casing
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.35, 32),
    casingMat,
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // Digital LCD screen
  const screen = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 32),
    screenMat,
  );
  screen.position.set(0, 0, 0.18);
  group.add(screen);

  // Top push buttons
  [-0.35, 0, 0.35].forEach((bx) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16),
      btnMat,
    );
    btn.position.set(bx, 0.95, 0);
    group.add(btn);
  });

  return group;
}


export function buildPackPlayVaultModel(): THREE.Group {
  const group = new THREE.Group();
  const vaultTex = createVaultTexture();

  const caseMat = new THREE.MeshStandardMaterial({
    map: vaultTex,
    roughness: 0.35,
    metalness: 0.2,
  });
  const cornerMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    metalness: 0.6,
    roughness: 0.25,
  });

  // High-tech gear crate box
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 1.2), caseMat);
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);

  // 8 Reinforced PackPlay Orange Corner Brackets
  const cornerCoords = [
    [-0.95, -0.65, -0.6],
    [0.95, -0.65, -0.6],
    [-0.95, 0.65, -0.6],
    [0.95, 0.65, -0.6],
    [-0.95, -0.65, 0.6],
    [0.95, -0.65, 0.6],
    [-0.95, 0.65, 0.6],
    [0.95, 0.65, 0.6],
  ];

  cornerCoords.forEach(([cx, cy, cz]) => {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      cornerMat,
    );
    bracket.position.set(cx, cy, cz);
    group.add(bracket);
  });

  return group;
}

// ─── Master Model Factory ───────────────────────────────────────────────────

export function createEquipmentModel(key: EquipmentModelKey): THREE.Group {
  switch (key) {
    case 'soccer':
      return buildSoccerBallModel();
    case 'basketball':
      return buildBasketballModel();
    case 'football':
      return buildAmericanFootballModel();
    case 'cleats':
      return buildCleatsModel();
    case 'bottle':
      return buildWaterBottleModel();
    case 'cone':
      return buildTrainingConeModel();
    case 'kit':
      return buildFirstAidKitModel();
    case 'racket':
      return buildSportsRacketModel();
    case 'bag':
      return buildGymDuffelBagModel();
    case 'whistle':
      return buildRefereeWhistleModel();
    case 'jersey':
      return buildJerseyModel();
    case 'trophy':
      return buildTrophyModel();
    case 'helmet':
      return buildHelmetModel();
    case 'shinguards':
      return buildShinGuardsModel();
    case 'stopwatch':
      return buildStopwatchModel();
    case 'vault':
    default:
      return buildPackPlayVaultModel();
  }
}
