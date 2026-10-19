/** Original Earnly room geometry. x/y are integers; z uses quarter-height units. */
export type XY = Readonly<{ x: number; y: number }>;
export type XYZ = Readonly<{ x: number; y: number; z: number }>;
export type Tile = Readonly<{ z: number; walkable: boolean; canSit: boolean; canLay: boolean; itemId?: string; petBed?: string; petToy?: string }>;
export type ItemPlacement = Readonly<{
  id: string; x: number; y: number; z: number;
  width: number; length: number; rotation: 0 | 2 | 4 | 6;
  itemHeight: number; walkable: boolean; canStack: boolean;
  canSit?: boolean; canLay?: boolean; centered?: boolean; petBed?: string; petToy?: string;
}>;
const MAX_SIDE = 64;
const MAX_HEIGHT = 64;
const MAX_ITEMS = 2048;
export function tileKey(p: XY): string { return `${p.x},${p.y}`; }
export function validXY(p: unknown): p is XY {
  if (!p || typeof p !== 'object') return false;
  const q = p as XY;
  return Number.isSafeInteger(q.x) && Number.isSafeInteger(q.y);
}
function height(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= MAX_HEIGHT && Number.isInteger(n * 4);
}
/** Decimal floor digits and x/ X voids. Ragged/empty/oversized input fails closed. */
export function parseHeightmap(source: string): (number | null)[][] {
  if (typeof source !== 'string' || source.length > MAX_SIDE * (MAX_SIDE + 2)) throw new Error('Invalid heightmap');
  const rows = source.replace(/\r\n/g, '\n').split('\n');
  if (rows.length < 1 || rows.length > MAX_SIDE || rows[0].length < 1 || rows[0].length > MAX_SIDE) throw new Error('Invalid heightmap dimensions');
  const width = rows[0].length;
  return rows.map(row => {
    if (row.length !== width || !/^[0-9xX]+$/.test(row)) throw new Error('Invalid heightmap row');
    return [...row].map(c => /x/i.test(c) ? null : Number(c));
  });
}
/** Immutable navigation snapshot. Build only from server-owned floor/item records. */
export class RoomGrid {
  readonly width: number;
  readonly length: number;
  readonly revision: number;
  readonly #tiles: readonly (Tile | null)[];
  constructor(floor: readonly (readonly (number | null)[])[], items: readonly ItemPlacement[] = [], revision = 0) {
    if (!Array.isArray(floor) || floor.length < 1 || floor.length > MAX_SIDE || !Array.isArray(floor[0]) || floor[0].length < 1 || floor[0].length > MAX_SIDE) throw new Error('Invalid floor dimensions');
    this.width = floor[0].length; this.length = floor.length;
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid room revision');
    this.revision = revision;
    const tiles: (Tile | null)[] = [];
    for (const row of floor) {
      if (!Array.isArray(row) || row.length !== this.width) throw new Error('Ragged floor');
      for (const z of row) {
        if (z !== null && (!height(z) || !Number.isInteger(z))) throw new Error('Invalid floor height');
        tiles.push(z === null ? null : { z, walkable: true, canSit: false, canLay: false });
      }
    }
    if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new Error('Too many room items');
    const stacks = new Map<number, ItemPlacement[]>();
    const ids = new Set<string>();
    for (const item of items as readonly ItemPlacement[]) {
      if (!item || typeof item.id !== 'string' || !item.id.length || item.id.length > 128 || ids.has(item.id) || !validXY(item) || ![0,2,4,6].includes(item.rotation) || !Number.isInteger(item.width) || !Number.isInteger(item.length) || item.width < 1 || item.length < 1 || item.width > MAX_SIDE || item.length > MAX_SIDE || !height(item.z) || !height(item.itemHeight) || item.itemHeight <= 0 || item.z + item.itemHeight > MAX_HEIGHT || typeof item.walkable !== 'boolean' || typeof item.canStack !== 'boolean' || (item.canSit !== undefined && typeof item.canSit !== 'boolean') || (item.canLay !== undefined && typeof item.canLay !== 'boolean')) throw new Error('Invalid room item');
      if(item.centered!==undefined&&typeof item.centered!=='boolean'||item.centered&&(item.width!==1||item.length!==1||item.canStack))throw new Error('Invalid centered table');
      ids.add(item.id);
      const turned = item.rotation === 2 || item.rotation === 6;
      const w = (turned ? item.length : item.width)+(item.centered?1:0), h = (turned ? item.width : item.length)+(item.centered?1:0);
      for (let y = item.y; y < item.y + h; y++) for (let x = item.x; x < item.x + w; x++) {
        if (!this.inBounds({x,y}) || !tiles[y * this.width + x]) throw new Error('Item outside usable floor');
        const key = y * this.width + x;
        const stack = stacks.get(key) || []; stack.push(item); stacks.set(key,stack);
      }
    }
    for (const [key, stack] of stacks) {
      stack.sort((a,b) => a.z - b.z || a.id.localeCompare(b.id));
      let top = tiles[key]!; let stackable = true;
      for (const item of stack) {
        // Exact quarter units avoid floating-point drift; no floating or intersecting items.
        if (item.z !== top.z || !stackable) throw new Error('Unsupported or overlapping item stack');
        top = { z:item.z + item.itemHeight, walkable:item.walkable, canSit:item.canSit === true, canLay:item.canLay === true, itemId:item.id, petBed:item.petBed, petToy:item.petToy };
        stackable = item.canStack;
      }
      tiles[key] = top;
    }
    this.#tiles = Object.freeze(tiles.map(t => t && Object.freeze(t)));
    Object.freeze(this);
  }
  inBounds(p: XY): boolean { return validXY(p) && p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.length; }
  tile(p: XY): Tile | null { return this.inBounds(p) ? this.#tiles[p.y * this.width + p.x] : null; }
}
