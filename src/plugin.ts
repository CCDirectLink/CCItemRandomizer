import { Check, Element, Overrides, getChecks } from './checks.js';
import { EnemyData } from './enemy-data.model.js';
import { EnemyGeneratorPreset, randomizeEnemy, randomizeSpawner } from './enemy-randomizer.js';
import { Markers, extractMarkers } from './extract-markers.js';

// @ts-ignore
const fs: typeof import('fs') = require('fs');

declare const ig: any;
declare const sc: any;

let baseDirectory = '';

async function generateRandomizerState(
	forceGenerate?: any,
	fixedSeed?: any,
): Promise<{
	spoilerLog: Check[];
	maps: Record<string, Record<number, Check[]>>;
	quests: Check[];
	shops: Record<string, Check[]>;
	overrides: Overrides;
	markers: Markers;
	enemyRandomizerPreset: EnemyGeneratorPreset;
	seed: string;
}> {
	const stateExists = fs.existsSync('randomizerState.json');
	if (!forceGenerate && stateExists) {
		return JSON.parse((await fs.readFileSync('randomizerState.json')) as unknown as string);
	}

	const { spoilerLog, maps, quests, shops, overrides, seed } = await getChecks(baseDirectory, fixedSeed);

	const mapNames = Object.keys(maps);
	const mapData = await Promise.all(
		mapNames.map(name => fetch('data/maps/' + name.replace(/[\.]/g, '/') + '.json').then(resp => resp.json())),
	);
	const areaNames = mapData.map(d => d.attributes.area).filter((v, i, arr) => arr.indexOf(v) === i);
	const areas = await Promise.all(areaNames.map(a => fetch('data/areas/' + a + '.json').then(resp => resp.json())));

	const markers = await extractMarkers(spoilerLog, mapNames, mapData, areaNames, areas);

	const enemyRandomizerPreset: EnemyGeneratorPreset = {
		enable: true,
		randomizeSpawners: true,
		randomizeEnemies: true,
		levelRange: [5, 3],
		elementCompatibility: true,
		spawnMapObjects: true,
		enduranceRange: [1, 1.5],
	};

	fs.promises.writeFile(
		'randomizerState.json',
		JSON.stringify({ spoilerLog, maps, quests, shops, overrides, markers, enemyRandomizerPreset, seed }),
	);

	const items = (await (await fetch('data/item-database.json')).json()).items;
	const database = await (await fetch('data/database.json')).json();
	const shopsDatabase = database.shops;
	const areasDatabase = database.areas;

	const fullMapNames = mapData.map((d, i) => {
		const ai = areaNames.indexOf(d.attributes.area);
		const area = areas[ai];
		const areaName = areasDatabase[d.attributes.area].name.en_US;
		const mapName = mapNames[i];
		for (const floor of area.floors) {
			for (const map of floor.maps) {
				if (map.path === mapName) {
					return areaName + ' - ' + map.name.en_US;
				}
			}
		}
		return mapName;
	});

	function getPrettyName(log: Check) {
		if (log.type === 'shop') {
			return shopsDatabase[log.name].name.en_US;
		}

		if ('name' in log) {
			return log.name; //TODO: quest names
		}

		const index = mapNames.indexOf(log.map);
		if (index < 0) {
			return log.map;
		}

		return fullMapNames[index];
	}

	const pretty = spoilerLog.map(log => {
		return `${(('chestType' in log ? log.chestType : '') + ' ' + log.type).padStart(13, ' ')} contains ${
			log.replacedWith!.amount
		} ${(items[log.replacedWith!.item] ? items[log.replacedWith!.item].name.en_US : log.replacedWith!.item).padEnd(
			20,
			' ',
		)} at ${getPrettyName(log).padEnd(40, ' ')} (${'map' in log ? log.map : log.name})`;
	});

	const prettyOrderd = spoilerLog
		.filter(() => true) //Copy array
		.sort((a, b) => getPrettyName(a).localeCompare(getPrettyName(b)))
		.map(log => {
			return `${(('chestType' in log ? log.chestType : '') + ' ' + log.type).padStart(13, ' ')} contains ${
				log.replacedWith!.amount
			} ${(items[log.replacedWith!.item] ? items[log.replacedWith!.item].name.en_US : log.replacedWith!.item).padEnd(
				20,
				' ',
			)} at ${getPrettyName(log).padEnd(40, ' ')} (${'map' in log ? log.map : log.name})`;
		});

	await fs.promises.writeFile(
		'spoilerlog.txt',
		`Seed: ${seed}\r\n` + pretty.join('\r\n') + '\r\n\r\n' + prettyOrderd.join('\r\n'),
	);
	return { spoilerLog, maps, quests, shops, overrides, markers, enemyRandomizerPreset, seed };
}

export default class ItemRandomizer {
	constructor(mod: { baseDirectory: string }) {
		baseDirectory = mod.baseDirectory;
	}

	async prestart() {
		// @ts-ignore
		window.generateRandomizerState = generateRandomizerState;
		const { maps, quests, shops, markers, overrides, enemyRandomizerPreset, seed } = await generateRandomizerState();
		console.log('seed', seed);

		let mapObjectSpawnQueue: any[] = [];
		let enemyData: EnemyData;
		if (enemyRandomizerPreset?.enable) {
			enemyData = await (await fetch(baseDirectory.substring(7) + 'data/enemy-data.json')).json();
		}

		ig.ENTITY.Chest.inject({
			_reallyOpenUp() {
				const map = maps[ig.game.mapName];
				if (!map) {
					console.warn('Chest not in logic');
					return this.parent();
				}
				const check = map[this.mapId];
				if (!check || check.length !== 1 || !check[0]) {
					console.warn('Chest not in logic');
					return this.parent();
				}

				const stamps = sc.menu.mapStamps[sc.map.currentArea.path];
				if (stamps) {
					const stamp = stamps.find(
						(s: { map: any; mapId: any }) => s?.map === ig.game.mapName && s?.mapId === this.mapId,
					);
					if (stamp) {
						stamp.key = 'DEFAULT';
					}
				}

				const old = sc.ItemDropEntity.spawnDrops;
				try {
					switch (check[0].replacedWith?.item) {
						case 'heat':
							sc.ItemDropEntity.spawnDrops = () => {};
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
							this.amount = 0;
							return this.parent();
						case 'cold':
							sc.ItemDropEntity.spawnDrops = () => {};
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
							this.amount = 0;
							return this.parent();
						case 'wave':
							sc.ItemDropEntity.spawnDrops = () => {};
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
							this.amount = 0;
							return this.parent();
						case 'shock':
							sc.ItemDropEntity.spawnDrops = () => {};
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, true);
							this.amount = 0;
							return this.parent();
						default:
							this.item = check[0].replacedWith?.item;
							this.amount = check[0].replacedWith?.amount;
							return this.parent();
					}
				} finally {
					sc.ItemDropEntity.spawnDrops = old;
				}
			},
		});

		const elements = [
			sc.PLAYER_CORE.ELEMENT_HEAT,
			sc.PLAYER_CORE.ELEMENT_COLD,
			sc.PLAYER_CORE.ELEMENT_WAVE,
			sc.PLAYER_CORE.ELEMENT_SHOCK,
		];
		ig.EVENT_STEP.SET_PLAYER_CORE.inject({
			init(settings: { bypass: any; alsoGiveElementChange: any }) {
				this.bypass = !!settings.bypass;
				this.alsoGiveElementChange = !!settings.alsoGiveElementChange;
				return this.parent(settings);
			},
			start() {
				if (this.alsoGiveElementChange) {
					if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
					}
				}

				if (this.bypass || !elements.includes(this.core)) {
					return this.parent();
				}

				const map = maps[ig.game.mapName];
				if (!map) {
					return this.parent();
				}

				//The only check in element rooms are the elements
				//TODO: implement something that doesn't break if this is wrong

				//Do not disable any other elements
				if (!this.value) {
					return;
				}

				const check = (Object.values(map) as any[])[0][0];
				switch (check.replacedWith.item) {
					case 'heat':
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
						return;
					case 'cold':
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
						return;
					case 'wave':
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
						return;
					case 'shock':
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, true);
						return;
					default:
						sc.model.player.addItem(check.replacedWith.item, check.replacedWith.amount, false);
				}
			},
		});

		ig.EVENT_STEP.RESET_SKILL_TREE.inject({
			start() {
				if (maps[ig.game.mapName]) {
					return; //Do not reset the skilltree if there is a check in the room.
				}
				return this.parent();
			},
		});

		ig.Game.inject({
			loadLevel(map: any, ...args: unknown[]) {
				const mapChecks = maps[map.name.replace(/[\\\/]/g, '.')] || {};
				const mapOverrides = (overrides && overrides[map.name.replace(/[\\\/]/g, '.')]) || {};

				if (enemyRandomizerPreset?.enable) {
					mapObjectSpawnQueue = [];
					const mapEntityGroups = {};
					const changeMap: Record<string, string[]> = {};
					const entityNameToTypeMap: Record<string, string> = {};
					for (const entity of map.entities) {
						let mapObjects;
						if (entity.type == 'EnemySpawner' && enemyRandomizerPreset.randomizeSpawners) {
							mapObjects = randomizeSpawner(entity, seed, enemyData, enemyRandomizerPreset, changeMap, map.levels);
						} else if (entity.type == 'Enemy' && enemyRandomizerPreset.randomizeEnemies) {
							entityNameToTypeMap[entity.settings.name] = entity.settings.enemyInfo.type;
							mapObjects = randomizeEnemy(entity, seed, enemyData, enemyRandomizerPreset, changeMap, map.levels);
						}
						if (mapObjects) {
							mapObjectSpawnQueue = mapObjectSpawnQueue.concat(mapObjects);
						}
					}

					// search for SET_TYPED_ENEMY_TARGET in EventTrigger's and replace old enemy types with new
					for (const entity of map.entities) {
						if (entity.type != 'EventTrigger') {
							continue;
						}

						const events = entity.settings.event;

						for (let i = 0; i < events.length; i++) {
							const event = ig.copy(events[i]);
							if (event.type == 'SET_TYPED_ENEMY_TARGET') {
								const oldType = event.enemyType;

								const newTypes = changeMap[oldType];
								if (!newTypes) {
									continue;
								}

								events.splice(i, 1);
								const alreadyAdded = new Set();
								for (const newType of newTypes) {
									if (alreadyAdded.has(newType)) {
										continue;
									}
									alreadyAdded.add(newType);
									const newEvent = ig.copy(event);
									newEvent.enemyType = newType;
									events.splice(i, 0, newEvent);
									i++;
								}
							} else if (event.type == 'WAIT_UNTIL_ACTION_DONE') {
								if (event.entity) {
									const entityName = event.entity.name;
									if (changeMap[entityNameToTypeMap[entityName]]) {
										events.splice(i, 1);
										events.splice(i, 0, {
											type: 'SET_ENEMY_TARGET',
											enemy: { global: true, name: entityName },
											target: { player: true },
										});
									}
								}
							}
						}
					}
				}

				if (mapChecks) {
					for (let i = 0; i < map.entities.length; i++) {
						const entity = map.entities[i];

						if (
							entity &&
							entity.settings &&
							entity.settings.mapId &&
							mapOverrides &&
							mapOverrides.disabledEvents &&
							mapOverrides.disabledEvents.includes(entity.settings.mapId)
						) {
							map.entities.splice(i, 1);
							i--;
							continue;
						}
						if (entity && entity.settings && entity.settings.mapId && mapChecks[entity.settings.mapId]) {
							for (const check of mapChecks[entity.settings.mapId]) {
								if (check.type === 'event') {
									const path = check.path.slice(1).split(/\./g);
									switch (check.replacedWith?.item) {
										case 'heat':
											set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
											set(entity, 'ELEMENT_HEAT', [...path, 'core']);
											set(entity, true, [...path, 'value']);
											set(entity, true, [...path, 'bypass']);
											set(entity, true, [...path, 'alsoGiveElementChange']);
											break;
										case 'cold':
											set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
											set(entity, 'ELEMENT_COLD', [...path, 'core']);
											set(entity, true, [...path, 'value']);
											set(entity, true, [...path, 'bypass']);
											set(entity, true, [...path, 'alsoGiveElementChange']);
											break;
										case 'wave':
											set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
											set(entity, 'ELEMENT_WAVE', [...path, 'core']);
											set(entity, true, [...path, 'value']);
											set(entity, true, [...path, 'bypass']);
											set(entity, true, [...path, 'alsoGiveElementChange']);
											break;
										case 'shock':
											set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
											set(entity, 'ELEMENT_SHOCK', [...path, 'core']);
											set(entity, true, [...path, 'value']);
											set(entity, true, [...path, 'bypass']);
											set(entity, true, [...path, 'alsoGiveElementChange']);
											break;
										default:
											set(entity, check.replacedWith?.item, [...path, 'item'], 0);
											set(entity, check.replacedWith?.amount, [...path, 'amount'], 0);
											break;
									}
								}
							}
						}
					}
				}

				return this.parent(map, ...args);
			},
			loadingComplete() {
				this.parent();
				const mapOverrides = (overrides && overrides[ig.game.mapName]) || {};
				if (mapOverrides && mapOverrides.variablesOnLoad) {
					for (const [name, value] of Object.entries(mapOverrides.variablesOnLoad)) {
						ig.vars.set(name, value);
					}
				}

				checkMarkers();

				for (const entity of mapObjectSpawnQueue) {
					ig.game.spawnEntity(entity.type, entity.x, entity.y, entity.z, entity.settings);
				}
				mapObjectSpawnQueue = [];
			},
		});

		ig.ENTITY.Enemy.inject({
			init(a: unknown, b: unknown, d: unknown, settings: { enemyInfo: { customGenerated?: boolean } }) {
				this.parent(a, b, d, settings);
				if (settings.enemyInfo && settings.enemyInfo.customGenerated) {
					this.customGenerated = true;
				}
			},
			onFallBehavior(...args: unknown[]) {
				const ret: unknown = this.parent(args);
				// when a flying entity that is over a hole is randomized into a non-flying entity,
				// fix the entity falling over and over by settings the respawn point to the player pos
				if (this.customGenerated) {
					if (!this.fallCount) {
						this.fallCount = 0;
					}
					this.fallCount++;
					if (this.fallCount >= 2) {
						let newPos = ig.copy(ig.game.playerEntity.coll.pos);
						newPos.z += 256;
						this.setRespawnPoint(newPos);
						this.setTarget(ig.game.playerEntity);
						this.fallCount = -100;
					}
				}
                return ret
			},
			doEnemyAction(...args: unknown[]) {
				try {
					this.parent(...args);
				} catch (error) {}
			},
		});

		sc.EnemyType.inject({
			updateAction(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) {}
			},
			postActionUpdate(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) {}
			},
			getAppearAction(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) {}
			},
		});

		sc.EnemyState.inject({
			selectAction(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) {}
			},
		});

		function checkMarkers() {
			if (markers && Object.values(sc.menu.mapStamps as Record<string, any[]>).every(v => v.every(c => !c))) {
				sc.menu.mapStamps = markers;
			}
		}

		sc.MenuModel.inject({
			onStoragePreLoad(data: unknown) {
				this.parent(data);
				checkMarkers();
			},
		});

		sc.QuestModel.inject({
			_collectRewards(quest: { id: string }) {
				const check = quests.find(q => 'name' in q && q.name === quest.id);
				if (!check) {
					return this.parent(quest);
				}
				if (check) {
					switch (check.replacedWith?.item) {
						case 'heat':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
							return;
						case 'cold':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
							return;
						case 'wave':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
							return;
						case 'shock':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, true);
							return;
						default:
							sc.model.player.addItem(check.replacedWith?.item, check.replacedWith?.amount, false);
							return;
					}
				}
				this.parent(quest);
			},
		});

		if (shops) {
			ig.Database.inject({
				onload(data: any) {
					for (const [shopName, shopChecks] of Object.entries(shops) as Iterable<[string, any]>) {
						const original = data.shops[shopName].pages[0];
						original.content = shopChecks.map((check: any) => {
							return {
								item: check.replacedWith.item + '',
								price: (check.price / check.replacedWith.amount) >>> 0,
							};
						});
					}

					this.parent(data);
				},
			});

			//Only needed for elements in shops
			sc.PlayerModel.inject({
				addItem(id: number | Element, ...args: unknown[]) {
					switch (id) {
						case 'heat':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
							return;
						case 'cold':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
							return;
						case 'wave':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
							return;
						case 'shock':
							if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
								sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
							}
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
							sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, true);
							return;
						default:
							return this.parent(id, ...args);
					}
				},
			});

			sc.Inventory.inject({
				onload(data: unknown) {
					this.parent(data);
					this.items.heat = getElementItem('heat');
					this.items.cold = getElementItem('cold');
					this.items.shock = getElementItem('shock');
					this.items.wave = getElementItem('wave');
				},
			});

			function getElementItem(element: Element) {
				const name =
					{
						heat: 'Heat Element',
						cold: 'Cold Element',
						wave: 'Wave Element',
						shock: 'Shock Element',
					}[element] || element;
				return {
					name: {
						en_US: name,
						de_DE: name,
						fr_FR: name,
						zh_CN: name,
						ja_JP: name,
						ko_KR: name,
						zh_TW: name,
					},
					description: {
						en_US: name,
						de_DE: name,
						fr_FR: name,
						zh_CN: name,
						ja_JP: name,
						ko_KR: name,
						zh_TW: name,
					},
					type: 'KEY',
					icon: 'item-key',
					order: 0,
					level: 1,
					effect: {
						sheet: '',
						name: null,
					},
					rarity: 0,
					cost: 0,
					noTrack: true,
					sources: [],
				};
			}
		}
	}

	async main() {
		// register non existing puzzle elements
		ig.MapStyle.registerStyle('default', 'puzzle2', { sheet: 'media/entity/style/default-puzzle-2-fix.png' });
		ig.MapStyle.registerStyle('default', 'magnet', { sheet: 'media/map/shockwave-dng.png', x: 160, y: 272 });
		ig.MapStyle.registerStyle('default', 'bouncer', { sheet: 'media/map/shockwave-dng-props.png', x: 0, y: 0 });
		ig.MapStyle.registerStyle('default', 'waterblock', {
			sheet: 'media/map/shockwave-dng.png',
			x: 384,
			y: 304,
			puddleX: 352,
			puddleY: 448,
		});
		ig.MapStyle.registerStyle('default', 'waveblock', { sheet: 'media/map/shockwave-dng.png', x: 96, y: 480 });
		ig.MapStyle.registerStyle('default', 'tesla', { sheet: 'media/map/shockwave-dng.png', x: 240, y: 352 });
		ig.MapStyle.registerStyle('default', 'waveSwitch', { sheet: 'media/map/shockwave-dng.png', x: 16, y: 696 });
		ig.MapStyle.registerStyle('default', 'anticompressor', { sheet: 'media/map/shockwave-dng.png', x: 240, y: 400 });
		ig.MapStyle.registerStyle('default', 'dynPlatformSmall', { sheet: 'media/map/shockwave-dng.png', x: 48, y: 640 });
		ig.MapStyle.registerStyle('default', 'dynPlatformMedium', { sheet: 'media/map/shockwave-dng.png', x: 0, y: 640 });
		ig.MapStyle.registerStyle('default', 'lorry', {
			sheet: 'media/map/shockwave-dng.png',
			railX: 176,
			railY: 304,
			lorryX: 128,
			lorryY: 304,
		});
		ig.MapStyle.registerStyle('default', 'rotateBlocker', { sheet: 'media/map/shockwave-dng.png', x: 256, y: 720 });
		ig.MapStyle.registerStyle('default', 'destruct', { sheet: 'media/entity/style/shockwave-dng-destruct.png' });
		ig.MapStyle.registerStyle('default', 'effect', { sheet: 'area.cold-dng' });

		ig.MapStyle.registerStyle('cold-dng', 'puzzle2', { sheet: 'media/entity/style/default-puzzle-2-fix.png' });
	}
}

function set(root: any, value: unknown, path: string[], offset = 0) {
	if (path.length <= offset) {
		return;
	}
	while (offset < path.length - 1) {
		root = root[path[offset]];
		offset++;
	}

	if (path.length - 1 === offset) {
		root[path[offset]] = value;
	}
}
