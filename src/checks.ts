import { ChestType, ItemData } from "./item-data.model";
import { initRandom, randomInt } from "./utils";

export type Element = 'heat' | 'cold' | 'shock' | 'wave';
export type Check = ({
    type: 'element';
    map: string;
    item: Element;
    amount: 1;
    mapId: number;
    conditions: string[];
} | {
    type: 'chest';
    map: string;
    mapId: number;
    item: number;
    amount: number;
    conditions: string[];
    chestType: ChestType;
} | {
    type: 'event';
    map: string;
    mapId: number;
    item: number;
    amount: number;
    conditions: string[];
    path: string;
} | {
    type: 'shop';
    name: string;
    item: number;
    amount: number;
    conditions: string[];
    price: number;
} | {
    type: 'quest';
    name: string;
    item: number;
    amount: number;
    conditions: string[];
}) & {
    replacedWith?: {
        item: number | Element;
        amount: number;
    }
};

export type Overrides = Record<string, {disabledEvents: string[], variablesOnLoad: Record<string, unknown>}>;

export async function getChecks(baseDirectory: string, fixedSeed?: string) {
    const data: ItemData = await (await fetch(baseDirectory.slice(7) + 'data/item-data.json')).json();

    const seed = checkSeed(data.version, fixedSeed);

    initRandom(seed);

    const areaConditions: Record<string, string[]> = {};
    areaConditions[data.startingArea] = [];
    for (const area of data.areas) {
        const [from, _type, to, ...condition] = area;
        areaConditions[to] = areaConditions[from]
            .concat(condition)
            .filter(c => c)
            .filter((c, i, arr) => arr.indexOf(c) === i);
    }

    const checks = [
        { type: 'element', map: 'cold-dng.b3.room7', item: 'heat', amount: 1, mapId: 45, conditions: [...areaConditions["8"]] },
        { type: 'element', map: 'heat-dng.f2.room-cold', item: 'cold', amount: 1, mapId: 78, conditions: [...areaConditions["16"]] },
        { type: 'element', map: 'wave-dng.b1.center-05-element', item: 'shock', amount: 1, mapId: 248, conditions: [...areaConditions["27"]] },
        { type: 'element', map: 'shock-dng.f2.room-element', item: 'wave', amount: 1, mapId: 86, conditions: [...areaConditions["25"]] },
    ] as Check[];
    for (const map of Object.keys(data.items)) {
        for (const mapId of Object.keys(data.items[map].chests)) {
            const { item, amount, type, condition } = data.items[map].chests[mapId];
            const conditions = (areaConditions[condition[0]] || ['softlock']).concat(condition.slice(1)).concat([data.keys[type]]).filter(c => c).filter((c, i, arr) => arr.indexOf(c) === i);
            checks.push({type: 'chest', map, mapId: Number(mapId), item, amount, conditions, chestType: type})
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
        if (!('map' in a) || !('map' in b)) {
            return 0;
        }
        
        const d = a.map.localeCompare(b.map);
        if (d !== 0) {
            return d!;
        }

        return a.mapId - b.mapId;
    })
    
    for (const [shopName, shopData] of Object.entries(data.shops) as Iterable<[string, any]>) {
        const conditions = (areaConditions[shopData.area] || ['softlock']).concat(['softlock']).filter(c => c).filter((c, i, arr) => arr.indexOf(c) === i);
        for (const item of shopData.items) {
            checks.push({type: 'shop', name: shopName, item: +item, amount: 1, price: randomInt(1, 10) * 1000 * shopData.scale, conditions})
        }
    }

    checks.push({ type: 'quest', name: 'daft-frobbit', conditions: [...areaConditions["20"]], item: 376, amount: 1 });
    checks.push({ type: 'quest', name: 'basin-mush-2', conditions: [...areaConditions["23"]], item: 345, amount: 1 });


    const requiredItems = ([] as string[]).concat(...Object.values(areaConditions))
        .concat(Object.values(data.keys))
        .map(c => c.includes('>=') ? Number(c.slice(5, c.length - 12)) : c as Element)
        .filter(c => c)
        .filter((c, i, arr) => arr.indexOf(c) === i);
    const allItems = [...requiredItems];
    const nonRequiredItems: (number | Element)[] = [];
    for (const check of checks) {
        if (!allItems.includes(check.item)) {
            allItems.push(check.item);
            nonRequiredItems.push(check.item);
        }
    }

    const withAmounts: Record<string | number, {item: Element | number, amount: number}[]> = {};
    for (const item of allItems) {
        withAmounts[item] = checks.filter(c => c.item == item).map(c => ({item: c.item, amount: c.amount}));;
    }
    
    const spoilerLog: Check[] = [];

    const fulfilledConditions = new Set<string>();
    const fulfilledItems: Record<number, number> = {};

    for (const item of requiredItems) {
        replaceChecks(withAmounts[item], checks, spoilerLog, fulfilledConditions, fulfilledItems);
    }
    fulfilledConditions.add('softlock');
    for (const item of nonRequiredItems) {
        replaceChecks(withAmounts[item], checks, spoilerLog, fulfilledConditions, fulfilledItems);
    }

    const maps: Record<string, Record<number, Check[]>> = {};
    const quests: Check[] = [];
    const shops: Record<string, Check[]> = {};
    for (const check of spoilerLog) {
        if (check.type === 'quest') {
            quests.push(check);
            continue;
        }
        if (check.type === 'shop') {
            shops[check.name] = shops[check.name] || [];
            shops[check.name].push(check);
            continue;
        }

        const map = maps[check.map] || {};
        maps[check.map] = map;

        const entry = map[check.mapId] || [];
        map[check.mapId] = entry;

        entry.push(check);
    }

    const overrides: Overrides = {};
    for (const [mapName, mapData] of Object.entries(data.items) as Iterable<[string, any]>) {
        overrides[mapName] = {
            disabledEvents: mapData.disabledEvents,
            variablesOnLoad: mapData.variablesOnLoad,
        }
    }

    return {spoilerLog, quests, maps, shops, overrides, seed};
}

function replaceChecks(items: {item: Element | number, amount: number}[], input: Check[], output: Check[], fulfilledConditions: Set<string>, fulfilledItems: Record<number, number>) {
    while (items.length > 0) {
        const fulfilledChecks = input.filter(check => check.conditions.every(c => fulfilledConditions.has(c)));
        const nextCheck = fulfilledChecks[randomInt(0, fulfilledChecks.length)];
        output.push(nextCheck);

        const replacedWith = items.shift();
        if (!replacedWith) {
            throw new Error('unreachable: Ran out of items to replace checks with');
        }
        nextCheck.replacedWith = replacedWith;

        input.splice(input.indexOf(nextCheck), 1);

        if (typeof replacedWith.item === 'string') {
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

function checkSeed(version: string, fixedSeed?: string) {
    if (fixedSeed) {
        if (!fixedSeed.includes('_') && version) {
            console.warn('Seed from another version was used. This will not give you the same result.')
        } else if (fixedSeed.includes('_') && version !== fixedSeed.split('_')[0]) {
            console.warn('Seed from another version was used. This will not give you the same result.')
        }
    }

    return fixedSeed || ((version ? version + '_' : '') + (Math.random() + '').slice(2));
}