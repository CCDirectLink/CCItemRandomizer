import { Check, Element, Overrides } from './checks.js';
import { EnemyData } from './enemy-data.model.js';
import { EnemyGeneratorPreset, randomizeEnemy, randomizeSpawner } from './enemy-randomizer.js';
import { Markers, extractMarkers } from './extract-markers.js';
import { GenerateOptions, deserialize, generateRandomizerState } from './generate.js';
import { addTitleMenuButton } from './randomizer-menu.js';


declare const ig: any;
declare const sc: any;
declare const nw: any;

let baseDirectory = '';
let spoilerLog: Check[];
let maps: Record<string, Record<number, Check[]>>;
let quests: Check[];
let shops: Record<string, Check[]> | undefined;
let markers: Markers;
let overrides: Overrides;
let enemyRandomizerPreset: EnemyGeneratorPreset;
let seed: string;
let currentVersion: string;
let enemyData: EnemyData | undefined;

let currentOptions: GenerateOptions;


export default class ItemRandomizer {
	constructor(mod: { baseDirectory: string }) {
		baseDirectory = mod.baseDirectory;
	}

	private async generate(options: GenerateOptions) {
		currentOptions = options;
		const state = await generateRandomizerState(options);
		spoilerLog = state.spoilerLog;
		maps = state.maps;
		quests = state.quests;
		shops = state.shops;
		markers = state.markers;
		overrides = state.overrides;
		enemyRandomizerPreset = state.enemyRandomizerPreset;
		enemyData = state.enemyData;
		seed = state.seed;
		currentVersion = state.currentVersion;
		console.log('seed', seed);
	}

	async prestart() {
		// @ts-ignore
		window.generateRandomizerState = (options: GenerateOptions) => this.generate({
			...options,
			itemTemplatePath: options.itemTemplatePath ?? (baseDirectory + 'data/item-data.json'),
			enemyTemplatePath: options.enemyTemplatePath ?? (baseDirectory + 'data/enemy-data.json'),
		});
		// @ts-ignore
		window.generateRandizerFromSeed = (seed: string, itemTemplatePath?: string, enemyTemplatePath?: string) => this.generate({
			...deserialize(seed),
			itemTemplatePath: itemTemplatePath ?? (baseDirectory + 'data/item-data.json'),
			enemyTemplatePath: enemyTemplatePath ?? (baseDirectory + 'data/enemy-data.json'),
			forceGenerate: true,
		});
		// @ts-ignore
		window.generateMarkers = async () => {
			const markers = await extractMarkers(spoilerLog);
			console.log(JSON.stringify(markers));
		}

		await this.generate({
			itemTemplatePath: baseDirectory + 'data/item-data.json',
			enemyTemplatePath: baseDirectory + 'data/enemy-data.json'
		});

		addTitleMenuButton({
			...deserialize(seed),
			itemTemplatePath: baseDirectory + 'data/item-data.json',
			enemyTemplatePath: baseDirectory + 'data/enemy-data.json',
			statePath: 'randomizerState.json'
		}, currentVersion, options => this.generate(options));

		let mapObjectSpawnQueue: any[] = [];

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
							sc.ItemDropEntity.spawnDrops = () => { };
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
							sc.ItemDropEntity.spawnDrops = () => { };
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
							sc.ItemDropEntity.spawnDrops = () => { };
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
							sc.ItemDropEntity.spawnDrops = () => { };
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

				if (enemyRandomizerPreset?.enable && enemyData) {
					mapObjectSpawnQueue = [];
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
				} catch (error) { }
			},
		});

		sc.EnemyType.inject({
			updateAction(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) { }
			},
			postActionUpdate(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) { }
			},
			getAppearAction(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) { }
			},
		});

		sc.EnemyState.inject({
			selectAction(...args: unknown[]) {
				try {
					return this.parent(...args);
				} catch (error) { }
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

		let shopCache: Record<string, Check[]>;
		ig.Database.inject({
			get(key: string) {
				if (key !== 'shops') {
					return this.parent(key);
				}

				if (!this.data.originalShops) {
					//Deep copy shops
					this.data.originalShops = {};
					for (const shopName of Object.keys(this.data.shops)) {
						this.data.originalShops[shopName] = {
							...this.data.shops[shopName],
							pages: this.data.shops[shopName].pages ? [
								{
									...this.data.shops[shopName].pages[0],
									content: Object.assign(this.data.shops[shopName].pages[0].content),
								},
								...this.data.shops[shopName].pages.slice(1)
							] : this.data.shops[shopName].pages
						}
					}
				}

				if (!shops) {
					return this.data.originalShops;
				}

				if (shopCache === shops) {
					return this.parent(key);
				}

				for (const [shopName, shopChecks] of Object.entries(shops) as Iterable<[string, any]>) {
					const original = this.data.shops[shopName].pages[0];
					original.content = shopChecks.map((check: any) => {
						return {
							item: check.replacedWith.item + '',
							price: (check.price / check.replacedWith.amount) >>> 0,
						};
					});
				}
				shopCache = shops;

				return this.parent(key);
			}
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

		//Only needed for elements in shops
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


		ig.lang.labels.sc.gui.menu.randomizer = {
			start: 'Generate',
			copy: 'Copy',
			paste: 'Paste',
			regenerate: 'Regenerate',
			sets: {
				enemy: 'Enemy Randomizer',
				shop: 'Shop Randomizer',
			},
			options: {
				names: {
					'enemy-enabled': 'Enabled',
					'shop-enabled': 'Enabled',
					'shop-key-items': 'Key items'
				},
				descriptions: {
					'enemy-enabled': 'Enables or disables the enemy randomizer.',
					'shop-enabled': 'Enabled or disables the shop randomizer.',
					'shop-key-items': 'Determines whether a shop may include key items.'
				}
			},
			seed: 'Seed',
			seedTitle: 'Randomizer'
		}
		ig.lang.labels.sc.gui.menu['menu-titles'].randomizer = 'Randomizer';
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
