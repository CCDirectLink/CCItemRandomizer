import { Check } from './checks.js';

export interface Marker {
	key: 'CHEST' | 'UNKNOWN';
	x: number;
	y: number;
	level: number;
	index: number;
	map: string;
	mapId: number;
}

export type Markers = Record<string, Marker[]>;

export async function extractMarkers(
	spoilerLog: Check[],
	mapNames: string[],
	mapData: any[],
	areaNames: string[],
	areas: any[],
) {
	const markers: Markers = {};
	for (const check of spoilerLog) {
		if (!('map' in check)) {
			continue;
		}

		const map = mapData[mapNames.indexOf(check.map)];
		const { mapWidth, mapHeight } = map;

		const entity = map.entities.find((e: { settings: { mapId: number } }) => e.settings.mapId === check.mapId);

		const { x, y, level } = entity;

		const px = x / (mapWidth * 16);
		const py = (y + map.levels[level.level === undefined ? level : level.level].height) / (mapHeight * 16);

		const ai = areaNames.indexOf(map.attributes.area);
		const area = areas[ai];

		let floor;
		let index = -1;
		for (const f of area.floors) {
			index = f.maps.findIndex((map: { path: string }) => map.path === check.map);
			if (index >= 0) {
				floor = f;
				index++;
				break;
			}
		}

		if (floor === undefined) {
			continue;
		}

		let startY = floor.tiles.length;
		let startX = floor.tiles[0].length;
		let endY = 0;
		let endX = 0;

		for (let y = 0; y < floor.tiles.length; y++) {
			for (let x = 0; x < floor.tiles[y].length; x++) {
				if (floor.tiles[y][x] === index) {
					startY = Math.min(y, startY);
					startX = Math.min(x, startX);
					endY = Math.max(y, endY);
					endX = Math.max(x, endX);
				}
			}
		}

		const tx = startX + (endX - startX) * px;
		const ty = startY + (endY - startY) * py;

		const mx = tx * 8;
		const my = ty * 8;

		markers[map.attributes.area] = markers[map.attributes.area] || [];
		markers[map.attributes.area].push({
			key: check.type === 'chest' ? 'CHEST' : 'UNKNOWN',
			x: mx,
			y: my,
			level: floor.level,
			index: markers[map.attributes.area].length,
			map: check.map,
			mapId: check.mapId,
		});
	}
	return markers;
}
