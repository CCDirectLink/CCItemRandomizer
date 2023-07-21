# CrossCode Item Randomizer

## Installation

Download the [latest release](https://github.com/CCDirectLink/CCItemRandomizer/releases/latest) and put it into your mods folder.

## Starting a new run

The mod will generate a file called `randomizerState.json` in your CrossCode folder. As long as that file exists, you can continue your run. Delete it to start a new run.

## Contributing

Current, the mod generates all the checks only based of the `item-data.json` included in the mod.

### item-data.json

#### version

The version contains a unique string that should be changed whenever the logic or checks are changed. This version is included in the seed and indicates how to regenerate a random state from a seed. If the version is the same as the seed version, the same seed should always yield the same result.

#### areas

Areas are a list of progression stoppers, all checks needed to complete the run need to be here. The first number is the area where you enter from and the second number is the area to which the condition on the right applies.

There are two types of conditions:
* Elements: `"heat"`, `"cold"`, `"shock"`, `"wave"`
* Total items collected: `"item.x.amount >= y"`

You can use an arbitrary amount of conditions for any area. All conditions of previous areas are automatically applied.

Limitations:
* An area number can only be used as a first number if it was used as a second number before. Otherwise, the randomizer will assume that there are no conditions necessary for entering it.
* An area can only be entered from one area. If there are multiple entrances you have to use a common parent. For example if there is `A -> B -> C` with condition `a` and `A -> D -> C` with condition `b` you need to do `A <-> C a b`.

#### softLockAreas

Areas that never contain key items (items required to enter areas).

#### startingArea

Currently unused, keep it as at a sane value.

#### keys

Conditions required to open locked chests. This is unlikely to ever be changed.

#### items

This contains a list of maps with their chests and events.

The `"chests"` key has a map of `mapId` to their contents and conditions. The first condition is always an area, all following conditions are regular conditions. Empty conditions have no effect. The difference between chest conditions and area conditions is that these are not considered progression stoppers and might never be opened.

The `"events"` contains a list of `GIVE_ITEM` events that should be considered to be randomized. Just like the chest they use the `mapId` of an event but may contain multiple entries since one event may give multiple items. The `"path"` inside an event description is used to identify which event should be replaced.

The `"disabledEvents"` contain a list of disabled event mapIds. For example: `[1, 2, 3]`.

The `"variablesOnLoad"` contain variables that are set every time a player enters that room. For example:
```json
{
    "map.someVariable": true,
    "tmp.someCount": 1,
}
```

#### shops

Shops contain the shops as they are found in the `database.json` file of the game. The data includes the price multipler `"scale"`, the area that is needed to reach the shop and a list of itemIds. Every shop item is considered to have the amount 1 so if it is randomized to be in a chest you can only get one of that item. If a chest item is put in a shop, it's price is divided by the amount of items in that chest. The base price is a random number between 1000 and 9000 inclusive.