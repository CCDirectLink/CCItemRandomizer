export interface ItemData {
	version: string;
	areas: RawAreas;
	softLockAreas: string[];
	startingArea: string;
	keys: Record<ChestType, string>;
	items: RawItems;
	shops: RawShops;
}

export type RawAreas = [from: string, type: '<->', to: string, ...conditions: string[]];

export type RawItems = { [mapName: string]: RawMapItems };

export interface RawMapItems {
	chests: RawChests;
	events: RawEvents;
	disabledEvents: number[];
	variablesOnLoad: Record<string, unknown>;
}

export type RawChests = { [mapId: string]: RawChest };

export type ChestType = 'Default' | 'Bronze' | 'Silver' | 'Gold' | 'MasterKey';

export interface RawChest {
	item: number;
	amount: number;
	type: ChestType;
	condition: [area: string, ...conditions: string[]];
}

export type RawEvents = { [mapId: string]: RawEvent[] };

export interface RawEvent {
	item: number;
	amount: number;
	type: '';
	condition: [area: string, ...conditions: string[]];
	path: string;
}

export type RawShops = { [shopName: string]: RawShop };

export interface RawShop {
	scale: number;
	area: string;
	items: string[];
}
