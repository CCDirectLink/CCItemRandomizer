// @ts-ignore
const fs: typeof import('fs') = require('fs');
// @ts-ignore
const path: typeof import('path') = require('path');

export async function extract() {
	const kvs = await extractFolder('./assets/data/maps/');
	const result: any = {};
	for (const [key, value] of kvs) {
		if (Object.keys(value).length > 0) {
			result[prettyNameFromPath(key)] = value;
		}
	}
	return result;
}

function prettyNameFromPath(name: string) {
	name = name.slice(17, name.length - 5);
	return name.replace(/[\\/]/g, '.');
}

async function extractFolder(name: string): Promise<any[]> {
	const files = await fs.promises.readdir(name, { recursive: true, withFileTypes: true });
	return ([] as string[]).concat(
		...(await Promise.all(
			files.map(async file => {
				const p = path.join(name, file.name);
				if (file.isFile()) {
					return [await extractFile(p)];
				}
				if (file.isDirectory()) {
					return await extractFolder(p);
				}
				return [];
			}),
		)),
	);
}

async function extractFile(name: string) {
	const contentRaw = await fs.promises.readFile(name);
	const content = JSON.parse(contentRaw as unknown as string);
	const result: any = {};
	for (const entity of content.entities) {
		if (entity.type === 'Chest') {
			result[entity.settings.mapId] = {
				type: entity.settings.chestType,
				mapId: entity.settings.mapId,
				item: entity.settings.item,
				amount: entity.settings.amount,
				chestType: entity.settings.chestType,
			};
		}
	}

	for (const event of searchObject(content.entities, '')) {
		result[event.path] = event;
	}

	return [name, result];
}

function searchObject(obj: any, path: string) {
	if (!obj) {
		return [];
	}

	if (obj instanceof Array) {
		const arrResult: any[] = [];
		for (let i = 0; i < obj.length; i++) {
			if (typeof obj[i] === 'object') {
				arrResult.push(...searchObject(obj[i], path + '.' + i));
			}
		}
		return arrResult;
	}
	if (obj.type === 'GIVE_ITEM') {
		return [{ type: 'GIVE_ITEM', path, item: obj.item, amount: obj.amount }];
	}

	const result: any[] = [];
	for (const key of Object.keys(obj)) {
		if (typeof obj[key] === 'object') {
			result.push(...searchObject(obj[key], path + '.' + key));
		}
	}
	return result;
}

export async function printChests(chests: Record<string, Record<string, { item: number; amount: number }>>) {
	let text = 'Map;Id;Item;Amount;Area';
	for (const [map, mapData] of Object.entries(chests)) {
		for (const [id, data] of Object.entries(mapData)) {
			text += `\r\n${map};${id};${(data as any).item};${(data as any).amount};`;
		}
	}
	await fs.promises.writeFile('randomItems.csv', text);
}
