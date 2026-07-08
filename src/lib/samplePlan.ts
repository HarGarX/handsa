// A small, pre-furnished studio apartment shown to first-time guests instead
// of a blank canvas — the fastest way to make "how this helps you" obvious
// without more marketing copy (see the README's Phase 6 section). Plain data,
// built the same way any real plan is; a guest can rename, edit, or delete it
// exactly like their own work.

import { v4 as uuidv4 } from 'uuid';
import type { Opening, PlacedSymbol, Plan, Wall } from '../types/plan';
import { createDefaultLayers } from '../types/plan';

function wall(id: string, start: [number, number], end: [number, number]): Wall {
  return { id, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] }, thickness: 15 };
}

export function createSamplePlan(): Plan {
  const layers = createDefaultLayers();
  const electricalId = layers.find((l) => l.kind === 'electrical')!.id;
  const lightingId = layers.find((l) => l.kind === 'lighting-power-hvac')!.id;
  const furnitureId = layers.find((l) => l.kind === 'furniture')!.id;

  // A 6m x 5m shell split by one partition into a living room (bottom, with
  // the entry) and a bedroom (top, with the window).
  const walls: Wall[] = [
    wall('sample-wall-top', [0, 0], [600, 0]),
    wall('sample-wall-right', [600, 0], [600, 500]),
    wall('sample-wall-bottom', [600, 500], [0, 500]),
    wall('sample-wall-left', [0, 500], [0, 0]),
    wall('sample-wall-partition', [0, 300], [600, 300]),
  ];

  const openings: Opening[] = [
    { id: 'sample-window', wallId: 'sample-wall-top', type: 'window', t: 0.5, width: 150 },
    {
      id: 'sample-entry',
      wallId: 'sample-wall-bottom',
      type: 'door',
      t: 0.5,
      width: 90,
      hinge: 'start',
      swing: 'right',
    },
    {
      id: 'sample-passage',
      wallId: 'sample-wall-partition',
      type: 'door',
      t: 0.15,
      width: 90,
      hinge: 'start',
      swing: 'left',
    },
  ];

  const symbols: PlacedSymbol[] = [
    // Living room: sofa against the partition, TV stand opposite it, a floor
    // lamp in the corner — the same "faces the focal wall" arrangement the
    // Placement Assistant would suggest.
    { id: 'sample-sofa', layerId: furnitureId, type: 'sofa', position: { x: 220, y: 348 }, rotation: 0 },
    {
      id: 'sample-tv',
      layerId: furnitureId,
      type: 'tv-stand',
      position: { x: 480, y: 477 },
      rotation: 180,
      wallId: 'sample-wall-bottom',
      t: 0.2,
    },
    { id: 'sample-lamp', layerId: furnitureId, type: 'floor-lamp', position: { x: 25, y: 480 }, rotation: 0 },
    { id: 'sample-light-living', layerId: lightingId, type: 'light-ceiling', position: { x: 300, y: 400 }, rotation: 0 },
    {
      id: 'sample-outlet',
      layerId: electricalId,
      type: 'outlet',
      position: { x: 600, y: 400 },
      rotation: 90,
      wallId: 'sample-wall-right',
      t: 0.8,
    },
    // Bedroom: bed against the left wall, wardrobe along the window wall.
    { id: 'sample-bed', layerId: furnitureId, type: 'bed', position: { x: 103, y: 150 }, rotation: -90 },
    {
      id: 'sample-wardrobe',
      layerId: furnitureId,
      type: 'wardrobe',
      position: { x: 500, y: 0 },
      rotation: 0,
      wallId: 'sample-wall-top',
      t: 0.833,
    },
    { id: 'sample-light-bedroom', layerId: lightingId, type: 'light-ceiling', position: { x: 300, y: 150 }, rotation: 0 },
  ];

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: 'Sample Apartment',
    walls,
    openings,
    labels: [],
    layers,
    symbols,
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}
