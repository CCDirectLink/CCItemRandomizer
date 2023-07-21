import { getChecks } from "./chests.js";
import { extractMarkers } from "./extract-markers.js";

// @ts-ignore
const fs = require('fs');

declare const ig: any;
declare const sc: any;

let baseDirectory = '';
async function generateRandomizerState(forceGenerate?: any, fixedSeed?: any) {
    const stateExists = fs.existsSync('randomizerState.json');
    if (!forceGenerate && stateExists) {
        return JSON.parse(await fs.readFileSync('randomizerState.json'));
    }

    const {spoilerLog, maps, quests, shops, overrides, seed} = await getChecks(baseDirectory, fixedSeed);

    const mapNames = Object.keys(maps);
    const mapData = await Promise.all(mapNames.map(name => fetch('data/maps/' + name.replace(/[\.]/g, '/') + '.json').then(resp => resp.json())))
    const areaNames = mapData.map(d => d.attributes.area).filter((v, i, arr) => arr.indexOf(v) === i);
    const areas = await Promise.all(areaNames.map(a => fetch('data/areas/' + a + '.json').then(resp => resp.json())));

    const markers = await extractMarkers(spoilerLog, mapNames, mapData, areaNames, areas);

    fs.promises.writeFile('randomizerState.json', JSON.stringify({spoilerLog, maps, quests, shops, overrides, markers, seed}));
    
    const items = (await (await fetch('data/item-database.json')).json()).items;
    const database = (await (await fetch('data/database.json')).json());
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

    function getPrettyName(log) {
        if (log.type === 'shop') {
            return shopsDatabase[log.name].name.en_US;
        }

        if (log.name) {
            return log.name; //TODO: quest names
        }

        const index = mapNames.indexOf(log.map);
        if (index < 0) {
            return log.map;
        }

        return fullMapNames[index];
    }

    const pretty = spoilerLog.map(log => {
        return `${((log.chestType || '') + ' ' + log.type).padStart(13, ' ')} contains ${log.replacedWith.amount} ${(items[log.replacedWith.item] ? items[log.replacedWith.item].name.en_US : log.replacedWith.item).padEnd(20, ' ')} at ${getPrettyName(log).padEnd(40, ' ')} (${log.map || log.name})`
    });

    const prettyOrderd = spoilerLog
        .filter(() => true) //Copy array
        .sort((a, b) => getPrettyName(a).localeCompare(getPrettyName(b)))
        .map(log => {
            return `${((log.chestType || '') + ' ' + log.type).padStart(13, ' ')} contains ${log.replacedWith.amount} ${(items[log.replacedWith.item] ? items[log.replacedWith.item].name.en_US : log.replacedWith.item).padEnd(20, ' ')} at ${getPrettyName(log).padEnd(40, ' ')} (${log.map || log.name})`
        });

    await fs.promises.writeFile('spoilerlog.txt', `Seed: ${seed}\r\n` + pretty.join('\r\n') + '\r\n\r\n' + prettyOrderd.join('\r\n'));
    return {spoilerLog, maps, quests, shops, overrides, markers, seed};
}

export default class ItemRandomizer {
    constructor(mod) {
        baseDirectory = mod.baseDirectory;
    }

    async prestart() {    
        // @ts-ignore
        window.generateRandomizerState = generateRandomizerState;
        const { maps, quests, shops, markers, overrides, seed } = await generateRandomizerState();
        console.log('seed', seed);

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
                    const stamp = stamps.find(s => s.map === ig.game.mapName && s.mapId === this.mapId);
                    if (stamp) {
                        stamp.key = 'DEFAULT';
                    }
                }

                const old = sc.ItemDropEntity.spawnDrops;
                try {
                    switch (check[0].replacedWith.item) {
                        case "heat":
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
                        case "cold":
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
                        case "wave":
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
                        case "shock":
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
                            this.item = check[0].replacedWith.item;
                            this.amount = check[0].replacedWith.amount;         
                            return this.parent();
                    }
                } finally {
                    sc.ItemDropEntity.spawnDrops = old;
                }
            }
        });

        const elements = [sc.PLAYER_CORE.ELEMENT_HEAT, sc.PLAYER_CORE.ELEMENT_COLD, sc.PLAYER_CORE.ELEMENT_WAVE, sc.PLAYER_CORE.ELEMENT_SHOCK];
        ig.EVENT_STEP.SET_PLAYER_CORE.inject({
            init(settings) {
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
                    case "heat":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
                        return;
                    case "cold":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
                        return;
                    case "wave":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
                        return;
                    case "shock":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, true);
                        return;
                    default:                
                        sc.model.player.addItem(check.replacedWith.item, check.replacedWith.amount, false)
                }
            }
        })

        ig.Game.inject({
            loadLevel(map, ...args) {
                const mapChecks = maps[map.name.replace(/[\\\/]/g, '.')] || {};
                const mapOverrides = overrides && overrides[map.name.replace(/[\\\/]/g, '.')] || {};
                if (mapChecks) {
                    for (let i = 0; i < map.entities.length; i++) {
                        const entity = map.entities[i];
                        if (entity
                            && entity.settings
                            && entity.settings.mapId
                            && mapOverrides
                            && mapOverrides.disabledEvents
                            && mapOverrides.disabledEvents.includes(entity.settings.mapId)
                            ) {
                                map.entities.splice(i, 1);
                                i--;
                                continue;
                            }

                        if (entity
                            && entity.settings
                            && entity.settings.mapId
                            && mapChecks[entity.settings.mapId]) {
                                for (const check of mapChecks[entity.settings.mapId]) {
                                    if (check.type === 'event') {
                                        const path = check.path.slice(1).split(/\./g);
                                        switch (check.replacedWith.item) {
                                            case "heat":
                                                set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
                                                set(entity, 'ELEMENT_HEAT', [...path, 'core']);
                                                set(entity, true, [...path, 'value']);
                                                set(entity, true, [...path, 'bypass']);
                                                set(entity, true, [...path, 'alsoGiveElementChange']);
                                                break;
                                            case "cold":
                                                set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
                                                set(entity, 'ELEMENT_COLD', [...path, 'core']);
                                                set(entity, true, [...path, 'value']);
                                                set(entity, true, [...path, 'bypass']);
                                                set(entity, true, [...path, 'alsoGiveElementChange']);
                                                break;
                                            case "wave":
                                                set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
                                                set(entity, 'ELEMENT_WAVE', [...path, 'core']);
                                                set(entity, true, [...path, 'value']);
                                                set(entity, true, [...path, 'bypass']);
                                                set(entity, true, [...path, 'alsoGiveElementChange']);
                                                break;
                                            case "shock":
                                                set(entity, 'SET_PLAYER_CORE', [...path, 'type']);
                                                set(entity, 'ELEMENT_SHOCK', [...path, 'core']);
                                                set(entity, true, [...path, 'value']);
                                                set(entity, true, [...path, 'bypass']);
                                                set(entity, true, [...path, 'alsoGiveElementChange']);
                                                break;
                                            default:                
                                                set(entity, check.replacedWith.item, [...path, 'item'], 0);
                                                set(entity, check.replacedWith.amount, [...path, 'amount'], 0);
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
                const mapOverrides = overrides && overrides[ig.game.mapName] || {};
                if (mapOverrides && mapOverrides.variablesOnLoad) {
                    for (const [name, value] of Object.entries(mapOverrides.variablesOnLoad)) {
                        ig.vars.set(name, value);
                    }
                }
            }
        });

        sc.MenuModel.inject({
            onStoragePreLoad(data) {
                this.parent(data);

                if (markers && Object.keys(sc.menu.mapStamps).length === 0) {
                    sc.menu.mapStamps = markers;
                }
            }
        })

        sc.QuestModel.inject({
            _collectRewards(quest) {
                const check = quests.find(q => q.name === quest.id);
                if (!check) {
                    return this.parent(quest);
                }
                if (check) {
                    switch (check.replacedWith.item) {
                        case "heat":
                            if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                            }
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
                            return;
                        case "cold":
                            if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                            }
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
                            return;
                        case "wave":
                            if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                            }
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
                            return;
                        case "shock":
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
                            sc.model.player.addItem(check.replacedWith.item, check.replacedWith.amount, false);
                            return;
                    }
                }
                this.parent(quest);
            }
        });

        if (shops) {
            ig.Database.inject({
                onload(data) {
                    for (const [shopName, shopChecks] of Object.entries(shops) as Iterable<[string, any]>) {
                        const original = data.shops[shopName].pages[0];
                        original.content = shopChecks.map(check => {
                            return {
                                item: check.replacedWith.item + '',
                                price: (check.price / check.replacedWith.amount) >>> 0, 
                            }
                        })
                    }
    
                    this.parent(data);
                }
            });

            //Only needed for elements in shops
            sc.PlayerModel.inject({
                addItem(id, ...args) {
                    switch (id) {
                        case "heat":
                            if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                            }
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
                            return;
                        case "cold":
                            if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                            }
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
                            return;
                        case "wave":
                            if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
                                sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                            }
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
                            return;
                        case "shock":
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
                            return this.parent(id, ...args)
                    }
                }
            })

            sc.Inventory.inject({
                onload(data) {
                    this.parent(data);
                    this.items.heat = getElementItem('heat');
                    this.items.cold = getElementItem('cold');
                    this.items.shock = getElementItem('shock');
                    this.items.wave = getElementItem('wave');
                }
            });

            function getElementItem(name) {
                name = {
                    'heat': 'Heat Element',
                    'cold': 'Cold Element',
                    'wave': 'Wave Element',
                    'shock': 'Shock Element',
                }[name] || name;
                return {
                    "name": {
                        "en_US": name,
                        "de_DE": name,
                        "fr_FR": name,
                        "zh_CN": name,
                        "ja_JP": name,
                        "ko_KR": name,
                        "zh_TW": name
                    },
                    "description": {
                        "en_US": name,
                        "de_DE": name,
                        "fr_FR": name,
                        "zh_CN": name,
                        "ja_JP": name,
                        "ko_KR": name,
                        "zh_TW": name
                    },
                    "type": "KEY",
                    "icon": "item-key",
                    "order": 0,
                    "level": 1,
                    "effect": {
                        "sheet": "",
                        "name": null
                    },
                    "rarity": 0,
                    "cost": 0,
                    "noTrack": true,
                    "sources": []
                    
                }
            }
        }
    }
}

function set(root, value, path, offset = 0) {
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