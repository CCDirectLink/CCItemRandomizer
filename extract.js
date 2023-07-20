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