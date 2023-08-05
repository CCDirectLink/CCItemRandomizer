import { Check, Overrides, getChecks } from "./checks.js";
import { EnemyData } from "./enemy-data.model.js";
import { EnemyGeneratorPreset } from "./enemy-randomizer.js";
import { Markers } from "./extract-markers.js";
import { ItemData } from "./item-data.model.js";
import { initRandom, readJsonFromFile } from './utils.js';

// @ts-ignore
const fs: typeof import('fs') = require('fs');

export interface GenerateOptions {
    version?: string;
    forceGenerate?: boolean;
    seed?: string;
    enemyRandomizerPreset?: EnemyGeneratorPreset;
    itemTemplatePath: string;
    enemyTemplatePath?: string;
    statePath?: string;
    shops?: ShopsPreset;
}

export interface ShopsPreset {
    enable: boolean;
    containsKeyItems?: boolean;
}

export async function generateRandomizerState(
    options: GenerateOptions
): Promise<{
    spoilerLog: Check[];
    maps: Record<string, Record<number, Check[]>>;
    quests: Check[];
    shops: Record<string, Check[]> | undefined;
    overrides: Overrides;
    markers: Markers;
    enemyRandomizerPreset: EnemyGeneratorPreset;
    enemyData: EnemyData | undefined;
    seed: string;
    currentVersion: string;
}> {
	const data: ItemData = await readJsonFromFile(options.itemTemplatePath);
    const stateExists = fs.existsSync(options.statePath ?? 'randomizerState.json');
    if (!options.forceGenerate && stateExists) {
        return { ...await readJsonFromFile(options.statePath ?? 'randomizerState.json'), currentVersion: data.version };
    }
    

    if (options.version !== undefined && data.version !== options.version) {
        console.warn('Seed from another template was used. This will not give you the same result.');
    }

    const seed = options.seed ?? (Math.random() + '').slice(2);
    options = {
        ...options,
        version: options.version ?? data.version,
        seed
    }
	initRandom(seed);

    const { spoilerLog, maps, quests, shops, overrides } = await getChecks(data, options);

    const enemyRandomizerPreset: EnemyGeneratorPreset = options.enemyRandomizerPreset ?? {
        enable: !!options.enemyTemplatePath,
        randomizeSpawners: true,
        randomizeEnemies: true,
        levelRange: [5, 3],
        elementCompatibility: true,
        spawnMapObjects: true,
        enduranceRange: [1, 1.5],
    };

    fs.promises.writeFile(
        options.statePath ?? 'randomizerState.json',
        JSON.stringify({ spoilerLog, maps, quests, shops, overrides, markers: data.markers, enemyRandomizerPreset, seed: serialize(options) }),
    );

    const items = (await readJsonFromFile('assets/data/item-database.json')).items;
    const database = await readJsonFromFile('assets/data/database.json');
    const shopsDatabase = database.shops;

    function getPrettyName(log: Check) {
        if (log.type === 'shop') {
            return shopsDatabase[log.name].name.en_US;
        }

        if ('name' in log) {
            return log.name; //TODO: quest names
        }

        return log.mapName;
    }

    const pretty = spoilerLog.map(log => {
        return `${(('chestType' in log ? log.chestType : '') + ' ' + log.type).padStart(13, ' ')} contains ${log.replacedWith!.amount
            } ${(items[log.replacedWith!.item] ? items[log.replacedWith!.item].name.en_US : log.replacedWith!.item).padEnd(
                20,
                ' ',
            )} at ${getPrettyName(log).padEnd(40, ' ')} (${'map' in log ? log.map : log.name})`;
    });

    const prettyOrderd = spoilerLog
        .filter(() => true) //Copy array
        .sort((a, b) => getPrettyName(a).localeCompare(getPrettyName(b)))
        .map(log => {
            return `${(('chestType' in log ? log.chestType : '') + ' ' + log.type).padStart(13, ' ')} contains ${log.replacedWith!.amount
                } ${(items[log.replacedWith!.item] ? items[log.replacedWith!.item].name.en_US : log.replacedWith!.item).padEnd(
                    20,
                    ' ',
                )} at ${getPrettyName(log).padEnd(40, ' ')} (${'map' in log ? log.map : log.name})`;
        });

    await fs.promises.writeFile(
        'spoilerlog.txt',
        `Seed: ${seed}\r\n` + pretty.join('\r\n') + '\r\n\r\n' + prettyOrderd.join('\r\n'),
    );

    let enemyData: EnemyData | undefined;
    if (enemyRandomizerPreset?.enable && options.enemyTemplatePath) {
        enemyData = await readJsonFromFile(options.enemyTemplatePath);
    }

    return { spoilerLog, maps, quests, shops, overrides, markers: data.markers, enemyRandomizerPreset, enemyData, seed: serialize(options), currentVersion: data.version };
}

export function serialize(options: GenerateOptions) {
    let result = options.version + '_' + options.seed;
    if (options.enemyRandomizerPreset?.enable) {
        if (!options.enemyRandomizerPreset.randomizeSpawners) {
            result += '_es';
        }
        if (!options.enemyRandomizerPreset.randomizeEnemies) {
            result += '_ee';
        }
        if (options.enemyRandomizerPreset.levelRange[0] !== 5) {
            result += '_el0' + options.enemyRandomizerPreset.levelRange[0];
        }
        if (options.enemyRandomizerPreset.levelRange[1] !== 3) {
            result += '_el1' + options.enemyRandomizerPreset.levelRange[1];
        }
        if (!options.enemyRandomizerPreset.elementCompatibility) {
            result += '_ec';
        }
        if (!options.enemyRandomizerPreset.spawnMapObjects) {
            result += '_em';
        }
        if (options.enemyRandomizerPreset.enduranceRange[0] !== 1) {
            result += '_er0' + options.enemyRandomizerPreset.enduranceRange[0];
        }
        if (options.enemyRandomizerPreset.enduranceRange[1] !== 1.5) {
            result += '_er1' + options.enemyRandomizerPreset.enduranceRange[1];
        }
    } else {
        result += '_e';
    }

    if (options.shops?.enable) {
        if (options.shops.containsKeyItems) {
            result += '_sk';
        }
    } else {
        result += '_s';
    }

    return result;
}

export function deserialize(input: string): GenerateOptions {
    const parts = input.split('_');
    if (parts.length === 1) {
        return {
            seed: parts[0],
            enemyRandomizerPreset: {
                enable: false,
                randomizeSpawners: true,
                randomizeEnemies: true,
                levelRange: [5, 3],
                elementCompatibility: true,
                spawnMapObjects: true,
                enduranceRange: [1, 1.5],
            },
            itemTemplatePath: '',
            enemyTemplatePath: '',
            version: '',
        }
    }

    const enemyRandomizerPreset: EnemyGeneratorPreset = {
        enable: true,
        randomizeSpawners: true,
        randomizeEnemies: true,
        levelRange: [5, 3],
        elementCompatibility: true,
        spawnMapObjects: true,
        enduranceRange: [1, 1.5],
    };

    const shopPreset: ShopsPreset = {
        enable: true
    }

    const version = parts.shift();
    const seed = parts.shift();

    while (parts.length > 0) {
        const next = parts.shift();
        switch (next) {
            case 'e':
                enemyRandomizerPreset.enable = false;
                break;
            case 'es':
                enemyRandomizerPreset.randomizeSpawners = false;
                break;
            case 'ee':
                enemyRandomizerPreset.randomizeEnemies = false;
                break;
            case 'ec':
                enemyRandomizerPreset.elementCompatibility = false;
                break;
            case 'em':
                enemyRandomizerPreset.spawnMapObjects = false;
                break;
            case 's':
                shopPreset.enable = false;
                break;
            case 'sk':
                shopPreset.containsKeyItems = true;
                break;
            default:
                if (next?.startsWith('el0')) {
                    enemyRandomizerPreset.levelRange[0] = +next.slice(3);
                } else if (next?.startsWith('el1')) {
                    enemyRandomizerPreset.levelRange[1] = +next.slice(3);
                } else if (next?.startsWith('er0')) {
                    enemyRandomizerPreset.enduranceRange[0] = +next.slice(3);
                } else if (next?.startsWith('er1')) {
                    enemyRandomizerPreset.enduranceRange[1] = +next.slice(3);
                } else {
                    console.warn('unknown option', next);
                }
                break;
        }
    }

    return {
        seed: seed ?? '',
        enemyRandomizerPreset,
        shops: shopPreset,
        itemTemplatePath: '',
        enemyTemplatePath: '',
        forceGenerate: false,
        statePath: '',
        version: version ?? ''
    }
}

