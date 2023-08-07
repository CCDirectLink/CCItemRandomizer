import { GenerateOptions, ShopsPreset } from './generate.js';
import { ChestType, Element, ItemData } from './item-data.model.js';
import { randomInt } from './utils.js';

export type Check = (
	| {
			type: 'element';
			map: string;
			mapName: string;
			item: Element;
			amount: 1;
			mapId: number;
			conditions: string[];
	  }
	| {
			type: 'chest';
			map: string;
			mapName: string;
			mapId: number;
			item: number;
			amount: number;
			conditions: string[];
			chestType: ChestType;
	  }
	| {
			type: 'event';
			map: string;
			mapName: string;
			mapId: number;
			item: number;
			amount: number;
			conditions: string[];
			path: string;
	  }
	| {
			type: 'shop';
			name: string;
			item: number;
			amount: number;
			conditions: string[];
			price: number;
	  }
	| {
			type: 'quest';
			name: string;
			item: number;
			amount: number;
			conditions: string[];
	  }
) & {
	replacedWith?: {
		item: number | Element;
		amount: number;
	};
};

export type Overrides = Record<string, { disabledEvents: string[]; variablesOnLoad: Record<string, unknown> }>;

export async function getChecks(data: ItemData, options: GenerateOptions) {
    const shopPreset: ShopsPreset = options.shops ?? {
        enable: true
    }
	
	const areaConditions: Record<string, string[]> = {};
	areaConditions[data.startingArea] = [];
	for (const area of data.areas) {
		const [from, _type, to, ...condition] = area;
		areaConditions[to] = areaConditions[from]
			.concat(condition)
			.filter(c => c)
			.filter((c, i, arr) => arr.indexOf(c) === i);
	}

	const checks: Check[] = [];
	for (const map of Object.keys(data.items)) {
		for (const mapId of Object.keys(data.items[map].chests)) {
			const { item, amount, type, condition } = data.items[map].chests[mapId];
			const conditions = (areaConditions[condition[0]] || ['softlock'])
				.concat(condition.slice(1))
				.concat([data.keys[type]])
				.filter(c => c)
				.filter((c, i, arr) => arr.indexOf(c) === i);
			checks.push({ type: 'chest', map, mapName: data.items[map].name, mapId: Number(mapId), item, amount, conditions, chestType: type });
		}
		for (const mapId of Object.keys(data.items[map].events)) {
			for (const event of data.items[map].events[mapId]) {
				const { item, amount, path, condition } = event;
				const conditions = (areaConditions[condition[0]] || ['softlock'])
					.concat(condition.slice(1))
					.filter(c => c)
					.filter((c, i, arr) => arr.indexOf(c) === i);
				checks.push({ type: 'event', map, mapName: data.items[map].name, mapId: Number(mapId), item, amount, path, conditions });
			}
		}
		for (const mapId of Object.keys(data.items[map].elements ?? {})) {
			const { item, amount, condition } = data.items[map].elements![mapId];
			const conditions = (areaConditions[condition[0]] || ['softlock'])
				.concat(condition.slice(1))
				.filter(c => c)
				.filter((c, i, arr) => arr.indexOf(c) === i);
			checks.push({ type: 'element', map, mapName: data.items[map].name, mapId: Number(mapId), item, amount, conditions });
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
	});

	if (shopPreset.enable) {
		const softlockOption = shopPreset.containsKeyItems ? [] : ['softlock'];
		for (const [shopName, shopData] of Object.entries(data.shops) as Iterable<[string, any]>) {
			const conditions = (areaConditions[shopData.area] || softlockOption)
				.concat(softlockOption)
				.filter(c => c)
				.filter((c, i, arr) => arr.indexOf(c) === i);
			for (const item of shopData.items) {
				checks.push({
					type: 'shop',
					name: shopName,
					item: +item,
					amount: 1,
					price: randomInt(1, 10) * 1000 * shopData.scale,
					conditions,
				});
			}
		}
	}

	checks.push({ type: 'quest', name: 'daft-frobbit', conditions: [...areaConditions['20']], item: 376, amount: 1 });
	checks.push({ type: 'quest', name: 'basin-mush-2', conditions: [...areaConditions['23']], item: 345, amount: 1 });

	const requiredItems = ([] as string[])
		.concat(...Object.values(areaConditions))
		.concat(Object.values(data.keys))
		.map(c => (c.includes('>=') ? Number(c.slice(5, c.length - 12)) : (c as Element)))
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

	const withAmounts: Record<string | number, { item: Element | number; amount: number }[]> = {};
	for (const item of allItems) {
		withAmounts[item] = checks.filter(c => c.item == item).map(c => ({ item: c.item, amount: c.amount }));
	}

	const spoilerLog: Check[] = [];

	const fulfilledConditions = new Set<string>();
	const fulfilledItems: Record<number, number> = {};

	const requiredItemsWithItems = requiredItems.map(i => withAmounts[i]).flat();
	replaceChecks(requiredItemsWithItems, checks, spoilerLog, fulfilledConditions, fulfilledItems);

	fulfilledConditions.add('softlock');
	const nonRequiredItemsWithItems = nonRequiredItems.map(i => withAmounts[i]).flat();
	replaceChecks(nonRequiredItemsWithItems, checks, spoilerLog, fulfilledConditions, fulfilledItems);

	const indexes = new Map(requiredItems.concat(nonRequiredItems).map((value, index) => [value, index]));
	spoilerLog.sort((a, b) => {
		return indexes.get(a.replacedWith!.item)! - indexes.get(b.replacedWith!.item)!;
	})

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
		};
	}

	return { spoilerLog, quests, maps, shops: shopPreset.enable ? shops : undefined, overrides };
}

function replaceChecks(
	items: { item: Element | number; amount: number }[],
	input: Check[],
	output: Check[],
	fulfilledConditions: Set<string>,
	fulfilledItems: Record<number, number>,
) {
	while (items.length > 0) {
		const fulfilledChecks = input.filter(check => check.conditions.every(c => fulfilledConditions.has(c)));
		const nextCheck = fulfilledChecks[randomInt(0, fulfilledChecks.length)];
		output.push(nextCheck);

		const replacedWith = items.splice(randomInt(0, Math.min(items.length, fulfilledChecks.length)), 1)[0];
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
