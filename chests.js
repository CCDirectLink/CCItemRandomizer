const fs = require('fs');
const path = require('path');

export async function extract() {
    const kvs = await extractFolder('./assets/data/maps/');
    const result = {};
    for (const [key, value] of kvs) {
        if (Object.keys(value).length > 0) {
            result[prettyNameFromPath(key)] = value;
        }
    }
    return result;
}

function prettyNameFromPath(name) {
    name = name.slice(17, name.length - 5);
    return name.replace(/[\\/]/g, '.');
}

async function extractFolder(name) {
    const files = await fs.promises.readdir(name, {recursive: true, withFileTypes: true});
    return [].concat(...await Promise.all(files.map(async file => {
        const p = path.join(name, file.name);
        if (file.isFile()) {
            return [await extractFile(p)];
        }
        if (file.isDirectory()) {
            return await extractFolder(p);
        }
        return [];
    })));
}

async function extractFile(name) {
    const contentRaw = await fs.promises.readFile(name);
    const content = JSON.parse(contentRaw);
    const result = {};
    for (const entity of content.entities) {
        if (entity.type === 'Chest') {
            result[entity.settings.mapId] = { type: entity.settings.chestType, mapId: entity.settings.mapId, item: entity.settings.item, amount: entity.settings.amount, chestType: entity.settings.chestType };
        }
    }

    for (const event of searchObject(content.entities, '')) {
        result[event.path] = event;
    }

    return [name, result];
}

function searchObject(obj, path) {
    if (!obj) {
        return [];
    }

    if (obj instanceof Array) {
        const arrResult = [];
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'object') {
                arrResult.push(...searchObject(obj[i], path + '.' + i));
            }
        }
        return arrResult;
    }
    if (obj.type === 'GIVE_ITEM') {
        return [{type: 'GIVE_ITEM', path, item: obj.item, amount: obj.amount}]
    }

    const result = [];
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
            result.push(...searchObject(obj[key], path + '.' + key));
        }
    }
    return result;
}

export async function printChests(chests) {
    let text = 'Map;Id;Item;Amount;Area';
    for (const [map, mapData] of Object.entries(chests)) {
        for (const [id, data] of Object.entries(mapData)) {
            text += `\r\n${map};${id};${data.item};${data.amount};`;
        }
    } 
    await fs.promises.writeFile('randomItems.csv', text);
}

export async function getChecks(baseDirectory, fixedSeed) {
    const data = await (await fetch(baseDirectory.slice(7) + 'item-data.json')).json();

    if (fixedSeed) {
        if (!fixedSeed.includes('_') && data.version) {
            console.warn('Seed from another version was used. This will not give you the same result.')
        } else if (fixedSeed.includes('_') && data.version !== fixedSeed.split('_')[0]) {
            console.warn('Seed from another version was used. This will not give you the same result.')
        }
    }

    const seed = fixedSeed || ((data.version ? data.version + '_' : '') + (Math.random() + '').slice(2));
    Math.seedrandomSeed(seed);

    const areaConditions = {};
    areaConditions[data.startingArea] = [];
    for (const area of data.areas) {
        const [from, _type, to, ...condition] = area;
        areaConditions[to] = areaConditions[from].concat(condition).filter(c => c).filter((c, i, arr) => arr.indexOf(c) === i);
    }

    const checks = [
        { type: 'element', map: 'cold-dng.b3.room7', item: 'heat', amount: 1, mapId: 45, conditions: [...areaConditions["8"]] },
        { type: 'element', map: 'heat-dng.f2.room-cold', item: 'cold', amount: 1, mapId: 78, conditions: [...areaConditions["16"]] },
        { type: 'element', map: 'wave-dng.b1.center-05-element', item: 'shock', amount: 1, mapId: 248, conditions: [...areaConditions["27"]] },
        { type: 'element', map: 'shock-dng.f2.room-element', item: 'wave', amount: 1, mapId: 86, conditions: [...areaConditions["25"]] },
    ];
    for (const map of Object.keys(data.items)) {
        for (const mapId of Object.keys(data.items[map].chests)) {
            const { item, amount, type, condition } = data.items[map].chests[mapId];
            const conditions = (areaConditions[condition[0]] || ['softlock']).concat(condition.slice(1)).concat([data.keys[type]]).filter(c => c).filter((c, i, arr) => arr.indexOf(c) === i);
            checks.push({type: 'chest', map, mapId: Number(mapId), item, amount, conditions})
        }
        for (const mapId of Object.keys(data.items[map].events)) {
            for (const event of data.items[map].events[mapId]) {
                const { item, amount, path, condition } = event;
                const conditions = (areaConditions[condition[0]] || ['softlock']).concat(condition.slice(1)).filter(c => c).filter((c, i, arr) => arr.indexOf(c) === i);
                checks.push({type: 'event', map, mapId: Number(mapId), item, amount, path, conditions})
            }
        }
    }

    checks.sort((a, b) => {
        const d = a.map.localeCompare(b.map);
        if (d !== 0) {
            return d;
        }

        return a.mapId - b.mapId;
    })
    
    checks.push({ type: 'quest', name: 'daft-frobbit', conditions: [...areaConditions["20"]], item: 376, amount: 1 });
    checks.push({ type: 'quest', name: 'basin-mush-2', conditions: [...areaConditions["23"]], item: 345, amount: 1 });


    const requiredItems = [].concat(...Object.values(areaConditions)).concat(Object.values(data.keys)).map(c => c.includes('>=') ? Number(c.slice(5, c.length - 12)) : c).filter(c => c).filter((c, i, arr) => arr.indexOf(c) === i);
    const allItems = [...requiredItems];
    const nonRequiredItems = [];
    for (const check of checks) {
        if (!allItems.includes(check.item)) {
            allItems.push(check.item);
            nonRequiredItems.push(check.item);
        }
    }

    const withAmounts = {};
    for (const item of allItems) {
        withAmounts[item] = checks.filter(c => c.item == item).map(c => ({item: c.item, amount: c.amount}));;
    }
    
    const spoilerLog = [];

    const fulfilledConditions = new Set();
    const fulfilledItems = {};

    for (const item of requiredItems) {
        replaceChecks(withAmounts[item], checks, spoilerLog, fulfilledConditions, fulfilledItems);
    }
    fulfilledConditions.add('softlock');
    for (const item of nonRequiredItems) {
        replaceChecks(withAmounts[item], checks, spoilerLog, fulfilledConditions, fulfilledItems);
    }

    const maps = {};
    const quests = [];
    for (const check of spoilerLog) {
        if (check.type === 'quest') {
            quests.push(check);
            continue;
        }

        const map = maps[check.map] || {};
        maps[check.map] = map;

        const entry = map[check.mapId] || [];
        map[check.mapId] = entry;

        entry.push(check);
    }

    return {spoilerLog, quests, maps, seed};
}

function randomNumber(min, max) {
    return (Math.randomSeed() * (max - min) + min) >>> 0;
}

function replaceChecks(items, input, output, fulfilledConditions, fulfilledItems) {
    while (items.length > 0) {
        const fulfilledChecks = input.filter(check => check.conditions.every(c => fulfilledConditions.has(c)));
        const nextCheck = fulfilledChecks[randomNumber(0, fulfilledChecks.length)];
        // const nextCheck = fulfilledChecks[0];
        output.push(nextCheck);

        if (!nextCheck) {
debugger;
        }

        const replacedWith = items.shift();
        nextCheck.replacedWith = replacedWith;

        input.splice(input.indexOf(nextCheck), 1);

        if (isNaN(Number(replacedWith.item))) {
            fulfilledConditions.add(replacedWith.item);
        } else {
            const count = fulfilledItems[replacedWith.item] || 0;
            fulfilledItems[replacedWith.item] = count + replacedWith.amount;
            for (let i = count + 1; i <= count + replacedWith.amount; i++) {
                fulfilledConditions.add(`item.${replacedWith.item}.amount >= ${i}`);
            }
        }
    }
}