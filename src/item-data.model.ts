import { EnemyData } from "./enemy-data.model";

export interface ItemData {
	version: string;
	areas: RawAreas;
	softLockAreas: string[];
	startingArea: string;
	keys: Record<ChestType, string>;
	items: RawItems;
	shops: RawShops;
	markers: Record<string, Marker[]>;
	enemyData: EnemyData;
}

export type RawAreas = [from: string, type: '<->', to: string, ...conditions: string[]];

export type RawItems = { [mapName: string]: RawMapItems };

export interface RawMapItems {
	name: string;
	chests: RawChests;
	events: RawEvents;
	elements: RawElements;
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

export type RawElements = { [mapId: string]: RawElement };

export interface RawElement {
	item: string;
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

export interface Marker {
	key:  'CHEST' | 'UNKNOWN';
	x: number;
	y: number;
	level: number;
	index: number;
	map: string;
	mapId: number;
}
