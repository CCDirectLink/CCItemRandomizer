export interface EnemyData {
	regularEnemies: RawRegularEnemies;
}

export type RawRegularEnemies = { [name: string]: RawRegularEnemy };

export interface RawRegularEnemy {
	elements: [heat: -1 | 0 | 1, cold: 0 | 1, shock: 0 | 1, wave: 0 | 1];
	mapElements: string;
	endurance: number;
}
