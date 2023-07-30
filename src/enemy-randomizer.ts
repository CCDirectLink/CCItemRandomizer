import { EnemyData, RawRegularEnemies } from './enemy-data.model.js';
import { fixedRandomInt } from './utils.js';

declare const sc: any;
declare const ig: any;

let mapId = 1000;

interface Enemy {
	settings: {
		enemyInfo: EnemyInfo;
	};
	x: number;
	y: number;
	level: number | { level: number; offset: number };
}

interface Spawner {
	settings: {
		enemyTypes: EnemyType[];
		size: {
			x: number;
			y: number;
		};
	};
	x: number;
	y: number;
	level: number | { level: number; offset: number };
}

interface EnemyType {
	count: number;
	info: EnemyInfo;
}

interface EnemyInfo {
	type: string;
	level: number;
	customGenerated?: true;
}

interface Rectangle {
	x: number;
	y: number;
	z: number;
	width: number;
	height: number;
}

export interface EnemyGeneratorPreset {
	enable: boolean;
	randomizeSpawners: boolean;
	randomizeEnemies: boolean;
	elementCompatibility: boolean;
	spawnMapObjects: boolean;

	enduranceRange: [min: number, max: number];
	levelRange: [min: number, max: number];
}

interface Level {
	height: number;
}

type ElementFlags = [heat: boolean, cold: boolean, shock: boolean, wave: boolean];

export async function loadAllEnemyTypes(data: RawRegularEnemies) {
	for (let enemy in data) {
		new sc.EnemyType(enemy);
	}
}

export function randomizeEnemy(
	enemy: Enemy,
	seed: string,
	data: EnemyData,
	preset: EnemyGeneratorPreset,
	changeMap: Record<string, string[]>,
	levels: Level[],
) {
	// console.log('enemy', ig.copy(enemy), seed, data, preset)

	let level = enemy.level;
	let z;
	if (typeof level == 'object') {
		z = levels[level.level].height + level.offset;
	} else {
		z = levels[level].height;
	}

	// let enemyGroup = enemy.settings.enemyInfo.group
	// let enemyType = enemy.settings.enemyInfo.type

	return getRandomEnemy(
		enemy.settings.enemyInfo,
		{ x: enemy.x, y: enemy.y, width: 16, height: 16, z },
		(enemy.x * enemy.y * parseInt(seed.split('_')[1])) % 1000000,
		data.regularEnemies,
		preset,
		changeMap,
	);
}

export function randomizeSpawner(
	spawner: Spawner,
	seed: string,
	data: EnemyData,
	preset: EnemyGeneratorPreset,
	changeMap: Record<string, string[]>,
	levels: Level[],
) {
	// console.log('spawner', spawner, seed, data, preset)

	const spawnerSeed = (spawner.x * spawner.y * parseInt(seed.split('_')[1])) % 1000000;
	const allMapObjects: any = [];
	let allObjectsSet = new Set();

	let level = spawner.level;
	let z;
	if (typeof level == 'object') {
		z = levels[level.level].height + level.offset;
	} else {
		z = levels[level].height;
	}

	const newEnemyTypes: any = [];
	for (let i = 0; i < spawner.settings.enemyTypes.length; i++) {
		const entry = spawner.settings.enemyTypes[i];

		for (let h = 0; h < entry.count; h++) {
			let newEntry: EnemyType = ig.copy(entry);
			newEntry.count = 1;
			let newEnemyInfo = newEntry.info;
			let enemySeed = spawnerSeed * (i + 1) * (h + 1);
			const mapObjects: any = getRandomEnemy(
				newEnemyInfo,
				{ x: spawner.x, y: spawner.y, width: spawner.settings.size.x, height: spawner.settings.size.y, z },
				enemySeed,
				data.regularEnemies,
				preset,
				changeMap,
			);

			newEnemyTypes.push(newEntry);
			for (let objEntity of mapObjects) {
				let type = objEntity.type;
				if (allObjectsSet.has(type)) {
					continue;
				}
				allObjectsSet.add(type);
				allMapObjects.push(objEntity);
			}
		}
	}

	spawner.settings.enemyTypes = newEnemyTypes;

	return allMapObjects;
}

function getCurrentPlayerElements(): ElementFlags {
	if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
		return [false, false, false, false];
	}
	return [
		sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_HEAT),
		sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_COLD),
		sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_SHOCK),
		sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_WAVE),
	];
}

function getRandomEnemy(
	enemyInfo: EnemyInfo,
	rect: Rectangle,
	enemySeed: number,
	data: RawRegularEnemies,
	preset: EnemyGeneratorPreset,
	changeMap: Record<string, string[]>,
) {
	const enemyType = enemyInfo.type;
	const myDbEntry = data[enemyType];

	if (!myDbEntry) {
		console.log('enemy randomizer:', enemyType, 'not found in db');
		return [];
	}
	// if (enemyType == 'mine-runbot') { return [] }

	const endurance = myDbEntry.endurance;

	const gameDbEntry = ig.database.data.enemies[enemyType];
	const origLevel: number = gameDbEntry.level;

	const elements = getCurrentPlayerElements();

	const compatibleEnemyTypes = Object.entries(data).filter(entry => {
		let entryEndurance = data[entry[0]].endurance;

		if (
			entryEndurance - preset.enduranceRange[0] > endurance ||
			entryEndurance + preset.enduranceRange[1] < endurance
		) {
			return false;
		}
		if (!preset.elementCompatibility) {
			return true;
		}

		const val = entry[1];

		// check for element compatibility
		// check if any elements are available
		if (val.elements[0] == -1) {
			let elementsOk = false;
			for (let i = 0; i < val.elements.length; i++) {
				if (elements[i]) {
					elementsOk = true;
					break;
				}
			}
			if (!elementsOk) {
				return false;
			}
		} else {
			for (let i = 0; i < val.elements.length; i++) {
				if (val.elements[i] && !elements[i]) {
					return false;
				}
			}
		}
		return true;
	});

	const randTypeIndex = fixedRandomInt(enemySeed, 0, compatibleEnemyTypes.length);
	const randType = compatibleEnemyTypes[randTypeIndex][0];
	// console.log('rand', enemySeed, randTypeIndex, 'from', enemyType, 'to', randType, 'endurance', endurance, 'to', data[randType].endurance)

	enemySeed *= 1.5;
	let randLevel = fixedRandomInt(enemySeed, origLevel - preset.levelRange[0], origLevel + preset.levelRange[1]);
	if (randLevel <= 0) {
		randLevel = 1;
	}

	if (!changeMap[enemyType]) {
		changeMap[enemyType] = [];
	}
	changeMap[enemyType].push(randType);

	enemyInfo.type = randType;
	enemyInfo.level = randLevel;
	enemyInfo.customGenerated = true;

	let mapObjects: any = [];
	if (preset.spawnMapObjects) {
		mapObjects = spawnMapObjects(data[randType].mapElements, rect, elements);
	}
	return mapObjects;
}

function spawnMapObjects(mapObject: string, rect: Rectangle, elements: ElementFlags) {
	let mx = rect.x + rect.width / 2;
	let my = rect.y + rect.height / 2;
	const x2 = rect.x + rect.width;
	const y2 = rect.y + rect.height;
	let z = rect.z;
	switch (mapObject) {
		case 'pole': {
			return [elementPole(mx - 8, my + 64, z)];
		}
		case 'magnet': {
			return [magnet(mx - 8, y2 - 24, z, 'NORTH')];
		}
		case 'teslaCoil': {
			return [
				teslaCoil(rect.x + 4, rect.y + 4, z, 'SOURCE'),
				antiCompressor(rect.x + 24, rect.y + 4, z),
				teslaCoil(rect.x + 4, rect.y + 20, z, 'GROUND_DISCHARGE'),
				compressor(rect.x - 20, rect.y + 4, z),
			];
		}
		case 'compressor': {
			return [boldPntMarker(mx - 16, my - 16, z, 1), compressor(rect.x + 80, y2 - 80, z)];
		}
		case 'waveTeleport': {
			let arr = [waveTeleport(rect.x + 32, rect.y + 32, z), waveTeleport(x2 - 32, y2 - 32, z)];
			// if player is missing wave
			if (!elements[3]) {
				arr.push(ballChangerElement(rect.x + 32, y2 - 48, z, 'WAVE', 'NORTH'));
				arr.push(ballChangerElement(x2 - 48, rect.y + 32, z, 'WAVE', 'NORTH'));
			}
			return arr;
		}
		case 'waterBubblePanel': {
			return [waterBubblePanel(mx + 56, my + 56, z)];
		}
	}
	return [];
}

function elementPole(x: number, y: number, z: number) {
	return {
		type: 'ElementPole',
		x,
		y,
		z,
		settings: {
			name: '',
			poleType: 'LONG',
			group: '',
			mapId: mapId++,
		},
	};
}

function waterBubblePanel(x: number, y: number, z: number) {
	return {
		type: 'WaterBubblePanel',
		x,
		y,
		z,
		settings: {
			name: '',
			mapId: mapId++,
		},
	};
}

function waveTeleport(x: number, y: number, z: number) {
	return {
		type: 'WaveTeleport',
		x,
		y,
		z,
		settings: {
			name: '',
			mapId: mapId++,
		},
	};
}

function ballChangerElement(
	x: number,
	y: number,
	z: number,
	element: 'HEAT' | 'COLD' | 'WAVE' | 'HEAT',
	dir: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST',
) {
	return {
		type: 'BallChanger',
		x,
		y,
		z,
		settings: {
			name: '',
			condition: '',
			changerType: {
				type: 'CHANGE_ELEMENT',
				settings: {
					element,
					dir,
				},
			},
			mapId: mapId++,
		},
	};
}

function compressor(x: number, y: number, z: number) {
	return {
		type: 'Compressor',
		x,
		y,
		z,
		settings: {
			name: '',
			mapId: mapId++,
		},
	};
}

function antiCompressor(x: number, y: number, z: number) {
	return {
		type: 'AntiCompressor',
		x,
		y,
		z,
		settings: {
			name: '',
			mapId: mapId++,
		},
	};
}

function boldPntMarker(x: number, y: number, z: number, index: number) {
	return {
		type: 'Marker',
		x,
		y,
		z,
		settings: {
			name: 'boldPnt' + index,
			dir: 'NORTH',
			mapId: mapId++,
		},
	};
}

function magnet(x: number, y: number, z: number, dir: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST') {
	return {
		type: 'Magnet',
		x,
		y,
		z,
		settings: {
			name: '',
			dir,
			mapId: mapId++,
		},
	};
}

function teslaCoil(x: number, y: number, z: number, type: 'SOURCE' | 'EXTENDER' | 'GROUND_DISCHARGE') {
	return {
		type: 'TeslaCoil',
		x,
		y,
		z,
		settings: {
			name: '',
			coilType: type,
			mapId: mapId++,
		},
	};
}
