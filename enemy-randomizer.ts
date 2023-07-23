declare const sc: any;
declare const ig: any;

let mapId = 1000

export async function loadAllEnemyTypes(data) {
    for (let enemy in data) {
        new sc.EnemyType(enemy)
    }
}

export function randomizeEnemy(enemy, seed, data, preset, changeMap, levels) {
    // console.log('enemy', ig.copy(enemy), seed, data, preset)

    let level = enemy.level
    let z
    if (typeof level == 'object') { 
        level = level.level
        z = levels[level].height + level.offset
    } else {
        z = levels[level].height
    }
    
    let enemyGroup = enemy.settings.enemyInfo.group
    let enemyType = enemy.settings.enemyInfo.type

    return getRandomEnemy(enemy.settings.enemyInfo, 
                          { x: enemy.x, y: enemy.y, width: 16, height: 16, z },
                          (enemy.x * enemy.y * parseInt(seed.substring(2))) % 1000000,
                          data.regularEnemies, preset, changeMap)
}


export function randomizeSpawner(spawner, seed, data, preset, changeMap, levels) {
    // console.log('spawner', spawner, seed, data, preset)

    const spawnerSeed = (spawner.x * spawner.y * parseInt(seed.substring(2))) % 1000000
    const allMapObjects = []
    let allObjectsSet = new Set()

    let level = spawner.level
    let z
    if (typeof level == 'object') { 
        level = level.level
        z = levels[level].height + level.offset
    } else {
        z = levels[level].height
    }

    const newEnemyTypes = []
    for (let i = 0; i < spawner.settings.enemyTypes.length; i++) {
        const entry = spawner.settings.enemyTypes[i]

        for (let h = 0; h < entry.count; h++) {
            let newEntry = ig.copy(entry)
            newEntry.count = 1
            let newEnemyInfo = newEntry.info
            let enemySeed = spawnerSeed * (i+1) * (h+1)
            const mapObjects = getRandomEnemy(newEnemyInfo, 
                               { x: spawner.x, y: spawner.y, width: spawner.settings.size.x,
                                   height: spawner.settings.size.y, z },
                               enemySeed, data.regularEnemies, preset, changeMap)

            newEnemyTypes.push(newEntry)
            for (let objEntity of mapObjects) {
                let type = objEntity.type
                if (allObjectsSet.has(type)) { continue }
                allObjectsSet.add(type)
                allMapObjects.push(objEntity)
            }
        }
    }

    spawner.settings.enemyTypes = newEnemyTypes

    return allMapObjects
}

function getCurrentPlayerElements() {
    return [
        sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_HEAT),
        sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_COLD),
        sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_SHOCK),
        sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_WAVE),
    ]
}

function seedrandom(min, max, seed) {
    const x = Math.sin(seed) * 10000
    const random = (x - Math.floor(x)) * (max - min) + min
    return Math.floor(random)
}

function getRandomEnemy(enemyInfo, rect, enemySeed, data, preset, changeMap) {
    const enemyType = enemyInfo.type
    const myDbEntry = data[enemyType]

    if (! myDbEntry) { console.log('enemy randomizer:', enemyType, 'not found in db'); return [] }
    // if (enemyType == 'mine-runbot') { return [] }

    const endurance = myDbEntry.endurance
    
    const gameDbEntry = ig.database.data.enemies[enemyType]
    const origLevel = gameDbEntry.level

    const elements = getCurrentPlayerElements()

    const compatibleEnemyTypes = Object.entries(data).filter(entry => {
        let entryEndurance = data[entry[0]].endurance

        if (entryEndurance - preset.enduranceRange[0] > endurance ||
               entryEndurance + preset.enduranceRange[1] < endurance) { return false }
        if (! preset.elementCompatibility) { return true }

        const val = entry[1]

        // check for element compatibility
        // check if any elements are available
        if (val.elements[0] == -1) {
            let elementsOk = false
            for (let i = 0; i < val.elements.length; i++) {
                if (elements[i]) {
                    elementsOk = true
                    break
                }
            }
            if (! elementsOk) { return false }
        } else {
            for (let i = 0; i < val.elements.length; i++) {
                if (val.elements[i] && !elements[i]) { return false }
            }
        }
        return true
    })

    const randTypeIndex = seedrandom(0, compatibleEnemyTypes.length, enemySeed)
    const randType = compatibleEnemyTypes[randTypeIndex][0]
    // console.log('rand', enemySeed, randTypeIndex, 'from', enemyType, 'to', randType, 'endurance', endurance, 'to', data[randType].endurance)

    enemySeed *= 1.5
    const randLevel = seedrandom(origLevel - preset.levelRange[0], origLevel + preset.levelRange[1], enemySeed)

    if (! changeMap[enemyType]) {
        changeMap[enemyType] = []
    }
    changeMap[enemyType].push(randType)

    enemyInfo.type = randType
    enemyInfo.level = randLevel
    enemyInfo.customGenerated = true


    let mapObjects = []
    if (preset.spawnMapObjects) {
        mapObjects = spawnMapObjects(data[randType].mapElements, rect, elements)
    }
    return mapObjects
}

function spawnMapObjects(mapObject, rect, elements) {
    let mx = rect.x + rect.width/2
    let my = rect.y + rect.height/2
    rect.x2 = rect.x + rect.width
    rect.y2 = rect.y + rect.height
    let z = rect.z
    switch (mapObject) {
        case 'pole': {
            return [ elementPole(mx - 8, my + 64, z) ]
        }
        case 'magnet': {
            let side = 'NORTH'
            return [ magnet(mx - 8, rect.y2 - 24, z, side) ]
            break
        }
        case 'teslaCoil': {
            return [
                teslaCoil(rect.x + 4, rect.y + 4, z, 'SOURCE'),
                antiCompressor(rect.x + 24, rect.y + 4, z),
                teslaCoil(rect.x + 4, rect.y + 20, z, 'GROUND_DISCHARGE'),
                compressor(rect.x - 20, rect.y + 4, z),
            ]
        }
        case 'compressor': {
            return [
                boldPntMarker(mx - 16, my - 16, z, 1),
                compressor(rect.x + 80, rect.y2 - 80, z),
            ]
        }
        case 'waveTeleport': {
            let arr = [
                waveTeleport(rect.x + 32, rect.y + 32, z),
                waveTeleport(rect.x2 - 32, rect.y2 - 32, z),
            ]
            // if player is missing wave
            if (! elements[3]) {
                arr.push(ballChangerElement(rect.x + 32, rect.y2 - 48, z, 'WAVE', 'NORTH'))
                arr.push(ballChangerElement(rect.x2 - 48, rect.y + 32, z, 'WAVE', 'NORTH'))
            }
            return arr
        }
        case 'waterBubblePanel': {
            return [ waterBubblePanel(mx + 56, my + 56, z) ]
        }
    }
    return []
}



function elementPole(x, y, z) {
    return {
        type: 'ElementPole',
        x, y, z,
        settings: {
            name: '',
            poleType: 'LONG', 
            group: '',
            mapId: mapId++,
        }
    }
}

function waterBubblePanel(x, y, z) {
    return {
        type: 'WaterBubblePanel',
        x, y, z,
        settings: {
            name: '', 
            mapId: mapId++,
        }
    }
}

function waveTeleport(x, y, z) {
    return {
        type: 'WaveTeleport',
        x, y, z,
        settings: {
            name: '', 
            mapId: mapId++,
        }
    }
}

function ballChangerElement(x, y, z, element, dir) {
    return {
        type: 'BallChanger',
        x, y, z,
        settings: {
            name: '',
            condition: '',
            changerType: {
                type: 'CHANGE_ELEMENT',
                settings: {
                    element,
                    dir,
                }
            },
            mapId: mapId++,
        }
    }
}

function compressor(x, y, z) {
    return {
        type: 'Compressor',
        x, y, z,
        settings: {
            name: '', 
            mapId: mapId++,
        }
    }
}

function antiCompressor(x, y, z) {
    return {
        type: 'AntiCompressor',
        x, y, z,
        settings: {
            name: '', 
            mapId: mapId++,
        }
    }
}

function boldPntMarker(x, y, z, index) {
    return {
        type: 'Marker',
        x, y, z,
        settings: {
            name: 'boldPnt' + index, 
            dir: 'NORTH',
            mapId: mapId++,
        }
    }
}

function magnet(x, y, z, dir) {
    return {
        type: 'Magnet',
        x, y, z,
        settings: {
            name: '', 
            dir,
            mapId: mapId++,
        }
    }
}

// type: SOURCE, EXTENDER, GROUND_DISCHARGE
function teslaCoil(x, y, z, type) {
    return {
        type: 'TeslaCoil',
        x, y, z,
        settings: {
            name: '', 
            coilType: type,
            mapId: mapId++,
        }
    }
}
