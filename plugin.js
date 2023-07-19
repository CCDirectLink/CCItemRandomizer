import { getChecks } from "./chests.js";
const fs = require('fs');

let baseDirectory = '';
async function generateRandomizerState(forceGenerate, fixedSeed) {
    const stateExists = fs.existsSync('randomizerState.json');
    if (!forceGenerate && stateExists) {
        return JSON.parse(await fs.readFileSync('randomizerState.json'));
    }

    const {spoilerLog, maps, quests, seed} = await getChecks(baseDirectory, fixedSeed);
    fs.promises.writeFile('randomizerState.json', JSON.stringify({spoilerLog, maps, quests, seed}));
    
    const items = (await (await fetch('data/item-database.json')).json()).items;
    const areasDatabase = (await (await fetch('data/database.json')).json()).areas;
    const mapNames = Object.keys(maps);
    const mapData = await Promise.all(mapNames.map(name => fetch('data/maps/' + name.replace(/[\.]/g, '/') + '.json').then(resp => resp.json())))
    const areaNames = mapData.map(d => d.attributes.area).filter((v, i, arr) => arr.indexOf(v) === i);
    const areas = await Promise.all(areaNames.map(a => fetch('data/areas/' + a + '.json').then(resp => resp.json())))

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
    return {spoilerLog, maps, quests, seed};
}

export default class ItemRandomizer {
    constructor(mod) {
        baseDirectory = mod.baseDirectory;
    }

    async prestart() {
        window.generateRandomizerState = generateRandomizerState;
        const {maps, quests, seed} = await generateRandomizerState();
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
                this.item = check[0].replacedWith.item;
                this.amount = check[0].replacedWith.amount;

                switch (this.item) {
                    case "heat":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
                        this.amount = 0;
                        return this.parent();
                    case "cold":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
                        this.amount = 0;
                        return this.parent();
                    case "wave":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
                        this.amount = 0;
                        return this.parent();
                    case "shock":
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                        sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, true);
                        this.amount = 0;
                        return this.parent();
                    default:       
                        this.item = check[0].replacedWith.item;
                        this.amount = check[0].replacedWith.amount;         
                        return this.parent();
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
                    sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
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
                
                const check = Object.values(map)[0][0];
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
                const mapOverrides = maps[map.name.replace(/[\\\/]/g, '.')];
                if (mapOverrides) {
                    for (const entity of map.entities) {
                        if (entity
                            && entity.settings
                            && entity.settings.mapId
                            && mapOverrides[entity.settings.mapId]
                            && mapOverrides[entity.settings.mapId][0]
                            && mapOverrides[entity.settings.mapId][0].type === 'event') {
                                for (const check of mapOverrides[entity.settings.mapId]) {
                                    const path = check.path.slice(1).split(/\./g);
                                    switch (this.item) {
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

                return this.parent(map, ...args);
            }
        });

        sc.QuestModel.inject({
            _collectRewards(quest) {
                const check = quests.find(q => q.name === quest.id);
                if (!check) {
                    return this.parent(quest);
                }
                if (check) {
                    switch (check.replacedWith.item) {
                        case "heat":
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, true);
                            return;
                        case "cold":
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, true);
                            return;
                        case "wave":
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, true);
                            return;
                        case "shock":
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