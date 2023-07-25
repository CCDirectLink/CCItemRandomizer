export function initRandom(seed: string) {
    // @ts-ignore
    Math.seedrandomSeed(seed);
}

export function randomNumber(): number {
    // @ts-ignore
    return Math.randomSeed();
}

export function fixedRandomNumber(seed: string | number): number { 
    // @ts-ignore
    return new Math.seedrandomSeed(seed)();
}


export function randomInt(min: number, max: number) {
    return (randomNumber() * (max - min) + min) >>> 0;
}

export function fixedRandomInt(seed: string | number, min: number, max: number): number { 
    return (fixedRandomNumber(seed) * (max - min) + min) >>> 0;
}