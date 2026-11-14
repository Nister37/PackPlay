import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from '../apps/web/node_modules/esbuild/lib/main.js';
import { chromium } from '../node_modules/playwright/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(projectRoot, 'apps/web/public/models');

async function main() {
  console.log('Bundling model generator with esbuild...');
  const bundleResult = await esbuild.build({
    stdin: {
      contents: `
        import * as THREE from 'three';
        import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
        import {
          EQUIPMENT_MODEL_KEYS,
          createEquipmentModel,
        } from './src/components/3d/equipmentModels';

        window.exportAllModels = async function() {
          const exporter = new GLTFExporter();
          const results = {};

          for (const key of EQUIPMENT_MODEL_KEYS) {
            console.log('Generating procedural model:', key);
            const group = createEquipmentModel(key);

            // Ensure materials and textures are properly resolved
            group.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const glbBuffer = await exporter.parseAsync(group, {
              binary: true,
              embedImages: true,
            });

            // Convert ArrayBuffer to base64
            const bytes = new Uint8Array(glbBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            results[key] = btoa(binary);
          }

          return results;
        };
      `,
      resolveDir: path.resolve(projectRoot, 'apps/web'),
      sourcefile: 'bundle-entry.js',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
  });

  const bundledCode = bundleResult.outputFiles[0].text;
  console.log('Bundle size:', (bundledCode.length / 1024).toFixed(1), 'KB');

  console.log('Launching headless browser to render textures and export GLB models...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('Browser log:', msg.text()));

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <div id="canvas-container"></div>
      </body>
    </html>
  `);

  await page.addScriptTag({ content: bundledCode });

  console.log('Exporting all 16 equipment models...');
  const results = await page.evaluate(async () => {
    return await window.exportAllModels();
  });

  await browser.close();

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [key, b64] of Object.entries(results)) {
    const buf = Buffer.from(b64, 'base64');
    const filePath = path.join(outputDir, `${key}.glb`);
    fs.writeFileSync(filePath, buf);
    console.log(`Saved ${key}.glb: ${(buf.length / 1024).toFixed(1)} KB`);
  }

  // Also write ball.glb as a copy of soccer.glb for legacy compatibility
  if (results['soccer']) {
    const ballPath = path.join(outputDir, 'ball.glb');
    fs.writeFileSync(ballPath, Buffer.from(results['soccer'], 'base64'));
    console.log(`Saved ball.glb (alias to soccer.glb)`);
  }

  console.log('All models exported successfully!');
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
