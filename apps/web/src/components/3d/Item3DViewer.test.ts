import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getModelKey } from './Item3DViewer';
import {
  EQUIPMENT_MODEL_KEYS,
  createEquipmentModel,
  createSoccerBallTexture,
  createBasketballTexture,
  createFootballTexture,
  createCleatTexture,
  createBottleTexture,
  createConeTexture,
  createFirstAidTexture,
  createRacketStringsTexture,
  createDuffelTexture,
  createJerseyTexture,
  createTrophyPlaqueTexture,
  createVaultTexture,
  createHelmetTexture,
  createShinGuardTexture,
  createStopwatchTexture,
} from './equipmentModels';

describe('Item3DViewer - getModelKey', () => {
  it('identifies soccer ball items', () => {
    expect(getModelKey('Official Match Soccer Ball')).toBe('soccer');
    expect(getModelKey('Training Ball', 'BALLS')).toBe('soccer');
    expect(getModelKey('Futsal Pro')).toBe('soccer');
  });

  it('identifies basketball items', () => {
    expect(getModelKey('Spalding Basketball')).toBe('basketball');
    expect(getModelKey('Court Ball', 'basketball')).toBe('basketball');
  });

  it('identifies american football and rugby items', () => {
    expect(getModelKey('Wilson Football')).toBe('football');
    expect(getModelKey('Gilbert Rugby Match Ball')).toBe('football');
  });

  it('identifies cleats and footwear', () => {
    expect(getModelKey('Nike Cleats')).toBe('cleats');
    expect(getModelKey('Turf Studs', 'FOOTWEAR')).toBe('cleats');
    expect(getModelKey('Running Shoes')).toBe('cleats');
    expect(getModelKey('Soccer Boots')).toBe('cleats');
  });

  it('identifies hydration and water bottles', () => {
    expect(getModelKey('Stainless Water Bottle')).toBe('bottle');
    expect(getModelKey('Electrolyte Shaker', 'HYDRATION')).toBe('bottle');
    expect(getModelKey('Hydration Flask')).toBe('bottle');
  });

  it('identifies training cones and agility markers', () => {
    expect(getModelKey('Agility Cones')).toBe('cone');
    expect(getModelKey('Slalom Marker Pylons', 'TRAINING')).toBe('cone');
  });

  it('identifies first aid kits and medical gear', () => {
    expect(getModelKey('Emergency First Aid Kit')).toBe('kit');
    expect(getModelKey('Athletic Tape', 'MEDICAL')).toBe('kit');
    expect(getModelKey('Sterile Gauze Bandage')).toBe('kit');
  });

  it('identifies sports rackets and paddles', () => {
    expect(getModelKey('Wilson Tennis Racket')).toBe('racket');
    expect(getModelKey('Carbon Pickleball Paddle')).toBe('racket');
    expect(getModelKey('Badminton Racquet')).toBe('racket');
  });

  it('identifies gym duffel bags and packs', () => {
    expect(getModelKey('Team Gym Duffel Bag')).toBe('bag');
    expect(getModelKey('Athletic Backpack')).toBe('bag');
  });

  it('identifies referee whistles and cards', () => {
    expect(getModelKey('Fox 40 Referee Whistle')).toBe('whistle');
    expect(getModelKey('Penalty Card Set', 'OFFICIATING')).toBe('whistle');
  });

  it('identifies team jerseys and apparel', () => {
    expect(getModelKey('Matchday Home Jersey')).toBe('jersey');
    expect(getModelKey('Training Bib Uniform', 'APPAREL')).toBe('jersey');
  });

  it('identifies trophies and medals', () => {
    expect(getModelKey('Championship Cup Trophy')).toBe('trophy');
    expect(getModelKey('Gold Winner Medal')).toBe('trophy');
  });

  it('identifies protective helmets and headgear', () => {
    expect(getModelKey('Batting Helmet')).toBe('helmet');
    expect(getModelKey('Protective Headgear')).toBe('helmet');
  });

  it('identifies shin guards and protective pads', () => {
    expect(getModelKey('Carbon Shin Guards')).toBe('shinguards');
    expect(getModelKey('Knee Protection Pads')).toBe('shinguards');
  });

  it('identifies stopwatches and timers', () => {
    expect(getModelKey('Digital Coach Stopwatch')).toBe('stopwatch');
    expect(getModelKey('Lap Timer Clock')).toBe('stopwatch');
  });

  it('deterministically maps unmatched equipment items to a valid model key', () => {
    const key1 = getModelKey('Random Gadget 123');
    const key2 = getModelKey('Random Gadget 123');
    expect(key1).toBe(key2);
    expect(EQUIPMENT_MODEL_KEYS).toContain(key1);
  });
});

describe('equipmentModels - Procedural Texture Generators', () => {
  it('generates high-resolution canvas textures without throwing', () => {
    const texList = [
      createSoccerBallTexture(),
      createBasketballTexture(),
      createFootballTexture(),
      createCleatTexture(),
      createBottleTexture(),
      createConeTexture(),
      createFirstAidTexture(),
      createRacketStringsTexture(),
      createDuffelTexture(),
      createJerseyTexture(),
      createTrophyPlaqueTexture(),
      createVaultTexture(),
      createHelmetTexture(),
      createShinGuardTexture(),
      createStopwatchTexture(),
    ];

    texList.forEach((tex) => {
      expect(tex).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex.image).toBeDefined();
      expect(tex.image.width).toBeGreaterThan(0);
      expect(tex.image.height).toBeGreaterThan(0);
    });
  });
});

describe('equipmentModels - Procedural 3D Model Builders', () => {
  it('creates valid THREE.Group models for all 16 equipment keys with meshes and materials', () => {
    EQUIPMENT_MODEL_KEYS.forEach((key) => {
      const model = createEquipmentModel(key);
      expect(model).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          meshCount++;
          const mesh = child as THREE.Mesh;
          expect(mesh.geometry).toBeDefined();
          expect(mesh.material).toBeDefined();
        }
      });

      expect(meshCount).toBeGreaterThan(0);
    });
  });
});
