import { GenerateOptions, deserialize, serialize } from "./generate";

declare const ig: any;
declare const sc: any;
declare const KEY_SPLINES: any;


let options: GenerateOptions;

const RANDOMIZER_SETS = {
    'enemy': {
        type: "MULTI",
        order: 2E3
    },
    'shop': {
        type: "MULTI",
        order: 2E3
    }
};

const RANDOMIZER_OPTIONS = {
    'enemy-enabled': {
        set: "enemy",
        cost: 0,
        getter: () => options.enemyRandomizerPreset?.enable ?? true,
        setter: (value: boolean) => {
            options.enemyRandomizerPreset ??= {
                enable: true,
                randomizeSpawners: true,
                randomizeEnemies: true,
                levelRange: [5, 3],
                elementCompatibility: true,
                spawnMapObjects: true,
                enduranceRange: [1, 1.5],
            };
            options.enemyRandomizerPreset.enable = value;
        }
    },
    'shop-enabled': {
        set: "shop",
        cost: 0,
        getter: () => options.shops?.enable ?? true,
        setter: (value: boolean) => {
            options.shops ??= {
                enable: true,
            };
            options.shops.enable = value;
        }
    },
    'shop-key-items': {
        set: "shop",
        cost: 0,
        getter: () => options.shops?.containsKeyItems ?? false,
        setter: (value: boolean) => {
            options.shops ??= {
                enable: true,
            };
            options.shops.containsKeyItems = value;
        }
    }
};

export function addTitleMenuButton(initialOptions: GenerateOptions, update: (options: GenerateOptions) => Promise<unknown>) {
    options = initialOptions;

    Object.assign(window, {
        RANDOMIZER_OPTIONS,
        RANDOMIZER_SETS,
    })

    const RandomizerCartEntry = ig.GuiElementBase.extend({
        text: null,
        value: null,
        init(text: string) {
            this.parent();
            this.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP);
            this.setSize(157, 8);
            this.text = new sc.TextGui(text, {
                font: sc.fontsystem.tinyFont
            });
            this.addChildGui(this.text);
            this.value = new sc.TextGui('<>', {
                font: sc.fontsystem.tinyFont
            });
            this.value.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
            this.addChildGui(this.value)
        },
        setValue(value: string, flag: boolean) {
            this.value.setText(value, flag)
        }
    });
    const RandomizerCart = sc.MenuPanel.extend({
        transitions: {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: -164
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        },
        points: null,
        cost: null,
        rest: null,
        enabled: true,
        init() {
            this.parent(sc.MenuPanelType.TOP_RIGHT_EDGE);
            this.setSize(164, 87);
            this.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
            this.setPos(8, 28);
            var b = 5,
                a = new sc.TextGui(ig.lang.get("sc.gui.menu.new-game.overview"), {
                    font: sc.fontsystem.tinyFont
                });
            a.setPos(2, b);
            this.addChildGui(a);
            b = b + 13;
            this.points = new RandomizerCartEntry(ig.lang.get("sc.gui.menu.randomizer.seed"));
            this.points.setPos(4, b);
            this.addChildGui(this.points);
            this.doStateTransition("HIDDEN", true)
        },
        resetSeed(flag: boolean) {
            this.points.setValue(serialize(options), flag);
        },
        updateSeed(flag: boolean) {
            this.points.setValue(serialize(options), flag);
        },
        updateDrawables(renderer: any) {
            this.parent(renderer);
            renderer.addColor("#7E7E7E", 0, 12, this.hook.size.x, 1);
            renderer.addColor("#FFF", 3, 42, this.hook.size.x - 6, 1)
        },
        show() {
            this.resetSeed(true);
            this.doStateTransition("DEFAULT")
        },
        hide() {
            this.doStateTransition("HIDDEN")
        }
    });


    const RandomizerOptionButton = sc.ListBoxButton.extend({
        amount: null,
        set: null,
        setKey: null,
        setGui: null,
        init(nameLabel: any, name: keyof typeof RANDOMIZER_OPTIONS, descriptionLabel: any, setKey: string, set: any, setGui: any) {
            this.parent(nameLabel, 142, 40, name, descriptionLabel);
            this.set = set;
            this.setKey = setKey;
            this.setGui = setGui;
            this.button.submitSound = null;
            this.updateToggleState()
        },
        updateToggleState() {
            const enabled = RANDOMIZER_OPTIONS[this.data.id as keyof typeof RANDOMIZER_OPTIONS]?.getter() || false;
            const enabledText =
                this.set.type == sc.TOGGLE_SET_TYPE.SINGLE
                    ? "\\i[" + (enabled ? "toggle-item-on-radio" : "toggle-item-off-radio") + (this.active ? "" : "-grey") + "]"
                    : "\\i[" + (enabled ? "toggle-item-on" : "toggle-item-off") + (this.active ? "" : "-grey") + "]";
            this.button.textChild.setText(enabledText + this.button.getButtonText());
        },
        setActive(active: boolean) {
            this.active = active;
            this.button.setActive(active);
            this.updateToggleState();
        }
    })
    const RandomizerToggleSet = ig.GuiElementBase.extend({
        header: null,
        background: null,
        buttons: [],
        set: null,
        listIndex: 0,
        init(setName: keyof typeof RANDOMIZER_SETS, list: any, globalRow: number, listIndex: number, counterObject: { counter: number }) {
            this.parent();
            this.setSize(363, 9);
            this.listIndex = listIndex;
            this.set = RANDOMIZER_SETS[setName];
            if (this.set.color) {
                this.background = new ig.ColorGui(this.set.color);
                this.background.hook.localAlpha = 0.2;
                this.background.setPos(-1, 0);
                this.addChildGui(this.background)
            }
            this.header = new sc.TextGui(ig.lang.get("sc.gui.menu.randomizer.sets." + setName), {
                font: sc.fontsystem.tinyFont
            });
            this.header.setPos(0, 1);
            this.addChildGui(this.header);
            this.line = new ig.ColorGui("#545454", this.hook.size.x + 2, 1);
            this.line.setPos(-1, 9);
            this.addChildGui(this.line);
            const buttonGroup = list.buttonGroup();
            let column = 0;
            let row = 0;
            let index = 0;
            for (const [name, options] of Object.entries(RANDOMIZER_OPTIONS) as Iterable<[string, any]>) {
                if (!(options.set != setName || options.disabled)) {
                    const nameLabel = ig.LangLabel.getText(ig.lang.get("sc.gui.menu.randomizer.options.names." + name));
                    const descriptionLabel = ig.LangLabel.getText(ig.lang.get("sc.gui.menu.randomizer.options.descriptions." + name));
                    const button = new RandomizerOptionButton(nameLabel, name, descriptionLabel, setName, this.set, this);
                    button.setPos(column * 182, row * 20 + 11);
                    this.addChildGui(button);
                    this.buttons.push(button);
                    if (sc.menu.newGameViewMode) {
                        button.blockedSound = null;
                        sc.newgame.get(name) || button.setActive(false)
                    }
                    buttonGroup.addFocusGui(button, column, row + globalRow);
                    column++;
                    if (column >= 2) {
                        column = 0;
                        row++
                    }
                    index++
                }
            }
            this.hook.size.y = Math.ceil(index / 2) * 20 + 15;
            this.background && this.background.setSize(this.hook.size.x + 2, Math.ceil(index / 2) * 20 + 15);
            counterObject.counter = index
        },
        updateTogglesStates(button?: any) {
            for (const otherButton of this.buttons) {
                if (button != otherButton) {
                    otherButton.updateToggleState();
                }
            }

            if (button) {
                const anim = new sc.ItemMenuToggleAnimation(
                    () => { button.updateToggleState() },
                    button.set.type == sc.TOGGLE_SET_TYPE.SINGLE);
                button.addChildGui(anim)
            }
        },
        updateActiveState() {
            for (let i = this.buttons.length - 1; i >= 0; i--) {
                const id = this.buttons[i].data.id as keyof typeof RANDOMIZER_OPTIONS;
                this.buttons[i].setActive(RANDOMIZER_OPTIONS[id]?.getter() || false);
            }
        }
    });
    const RandomizerList = ig.GuiElementBase.extend({
        transitions: {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: -184
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        },
        gfx: new ig.Image("media/gui/menu.png"),
        sets: [],
        list: null,
        buttongroup: null,
        toggleOnSound: null,
        toggleOffSound: null,
        _curElement: -1,
        init() {
            this.parent();
            this.setSize(368, 263);
            this.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
            this.toggleOnSound = sc.BUTTON_SOUND.toggle_on;
            this.toggleOffSound = sc.BUTTON_SOUND.toggle_off;
            const menuPanel = new sc.MenuPanel;
            menuPanel.setSize(368, 263);
            menuPanel.setPos(0, 0);
            this.addChildGui(menuPanel);
            this.list = new sc.MultiColumnItemListBox(1, 182, sc.LIST_COLUMNS.TWO, 1);
            this.list.setPos(0, 5);
            this.list.setSize(368, 251);
            this.list.setSelectState("HIDDEN", true);
            this.list.list.onGetHeightAtIndex = this.onGetHeightAtIndex.bind(this);
            this.addChildGui(this.list);
            for (let i = this.list.quantities.length - 1; i >= 0; i--) {
                this.list.quantities[i].setText("");
            }
            this.buttongroup = this.list.buttonGroup();
            this.buttongroup.setMouseFocusLostCallback(() => {
                sc.menu.setInfoText("", true);
                sc.menu.setBuffText("", true);
                this._curElement = null
            });
            this.buttongroup.addSelectionCallback((result: { data: { description: any; id: any; }; }) => {
                if (result.data) {
                    this._curElement = result;
                    sc.menu.setInfoText(result.data.description ? result.data.description : result.data);
                    result.data.id && sc.menu.setItemInfo(result.data.id)
                }
            });
            this.buttongroup.addPressCallback(this.onItemButtonPressed.bind(this));
            this.createListEntries();
            this.doStateTransition("HIDDEN", true)
        },
        createListEntries: function () {
            this.buttongroup.clear();
            this.list.clear(true);
            this.sets.length = 0;
            this.list.list.columns = 1;
            this.list.list.paddingTop = 1;
            const counterObj = {
                counter: 0
            };
            let row = 0;
            let index = 0;
            for (const name of Object.keys(RANDOMIZER_SETS)) {
                counterObj.counter = 0;
                const button = new RandomizerToggleSet(name, this.list, row, index, counterObj);
                this.list.addButton(button, true);
                row = row + Math.ceil(counterObj.counter / 2);
                this.sets[index] = button;
                index++
            }
            this.list.list.paddingTop = 1;
            this.list.list.columns = 2;
            this.buttongroup.fillEmptySpace()
        },
        updateEntries: function (skipSetSynop: any) {
            if (!skipSetSynop) {
                sc.menu.setSynopPressed()
            }
        },
        addObservers: function () {
            sc.Model.addObserver(sc.menu, this)
        },
        removeObservers: function () {
            sc.Model.removeObserver(sc.menu, this)
        },
        show: function () {
            ig.interact.setBlockDelay(0.2);
            this.updateEntries(true);
            this.list.activate();
            this.doStateTransition("DEFAULT")
        },
        hide: function () {
            this.list.deactivate();
            sc.menu.setInfoText("", false);
            sc.menu.setBuffText("", false);
            this.doStateTransition("HIDDEN")
        },
        onGetHeightAtIndex: function (_: unknown, y: any) {
            const element = this.buttongroup.getYElementAt(y) ?? this.buttongroup.getElementAt(this.buttongroup.current.x - 1, y);
            if (y >= 0 && element) {
                return element.setGui.hook.pos.y + element.hook.pos.y + element.hook.size.y;
            }
            return 0;
        },
        onItemButtonPressed: function (button: any) {
            const id = button.data.id as keyof typeof RANDOMIZER_OPTIONS;
            const toggleOn = !RANDOMIZER_OPTIONS[id].getter();
            RANDOMIZER_OPTIONS[id]?.setter(toggleOn);
            if (toggleOn) {
                this.toggleOnSound.play();
                button.setGui.updateTogglesStates(button);
            } else {
                this.toggleOffSound.play();
                button.setGui.updateTogglesStates();
            }
            this.updateEntries()
        },
        isNonMouseMenuInput: function () {
            return sc.control.menuConfirm()
                || sc.control.rightDown()
                || sc.control.leftDown()
                || sc.control.downDown()
                || sc.control.upDown()
                || sc.control.menuCircleLeft()
                || sc.control.menuCircleRight()
        },
        modelChanged: function () { }
    })

    const RandomizerMenu = sc.ListInfoMenu.extend({
        points: null,
        button: null,
        init() {
            this.parent(new RandomizerList, null, true);
            this.points = new RandomizerCart();
            this.addChildGui(this.points);
            this.button = new sc.ButtonGui("\\i[help2]" + ig.lang.get("sc.gui.menu.randomizer.start"), 160);
            this.button.hook.transitions = {
                DEFAULT: {
                    state: {},
                    time: 0.2,
                    timeFunction: KEY_SPLINES.LINEAR
                },
                HIDDEN: {
                    state: {
                        alpha: 0,
                        offsetX: -160
                    },
                    time: 0.2,
                    timeFunction: KEY_SPLINES.LINEAR
                }
            };
            this.button.keepMouseFocus = true;
            this.button.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
            this.button.setPos(10, 30);
            this.button.doStateTransition("HIDDEN", true);
            this.button.onButtonPress = this.onBeginButtonPressed.bind(this);
            this.button.setActive(true);
            this.addChildGui(this.button);
            this.doStateTransition("DEFAULT")
        },
        showMenu() {
            this.points.show();
            this.button.doStateTransition("DEFAULT");
            sc.menu.buttonInteract.addGlobalButton(this.button, () => false);
            this.parent();
            if (sc.menu.previousMenu == sc.MENU_SUBMENU.SAVE) {
                this.points.updateSeed(true);
                sc.menu.popBackCallback()
            } else sc.menu.newGameViewMode && this.points.updateSeed(true)
        },
        exitMenu() {
            this.parent();
            sc.menu.buttonInteract.removeGlobalButton(this.button);
            this.points.hide();
            this.button.doStateTransition("HIDDEN")
        },
        async onBeginButtonPressed() {
            const result: GenerateOptions = {
                ...deserialize(serialize(options)),
                forceGenerate: true,
                itemTemplatePath: initialOptions.itemTemplatePath,
                enemyTemplatePath: initialOptions.enemyTemplatePath,
                statePath: initialOptions.statePath,
            }
            this.button.setActive(false);
            await update(result);
            sc.model.enterRunning();
        },
        modelChanged(source: unknown, type: unknown) {
            if (source == sc.menu && type == sc.MENU_EVENT.SYNOP_BUTTON_PRESS) {
                this.points.updateSeed();
            }
        }
    });

    sc.MENU_SUBMENU.RANDOMIZER = Object.keys(sc.MENU_SUBMENU).length;
    sc.SUB_MENU_INFO[sc.MENU_SUBMENU.RANDOMIZER] = {
        Clazz: RandomizerMenu,
        name: "randomizer"
    };

    sc.TitleScreenButtonGui.inject({
        randomizerButton: null,
        init(...args: unknown[]) {
            this.parent(...args);

            ig.lang.labels.sc.gui['title-screen'].randomizer ??= 'Randomizer' //TODO: do this properly
            this.randomizerButton = new sc.ButtonGui(ig.lang.get("sc.gui.title-screen.randomizer"), sc.BUTTON_DEFAULT_WIDTH - 8);
            this.randomizerButton.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_BOTTOM);
            this.randomizerButton.setPos(-20, 40);
            this.randomizerButton.onButtonPress = () => {
                sc.menu.setDirectMode(true, sc.MENU_SUBMENU.RANDOMIZER);
                sc.model.enterMenu(true)
            }
            this.randomizerButton.hook.transitions = {
                DEFAULT: {
                    state: {},
                    time: 0.2,
                    timeFunction: KEY_SPLINES.EASE
                },
                HIDDEN: {
                    state: {
                        offsetY: -80,
                        alpha: 0
                    },
                    time: 0.2,
                    timeFunction: KEY_SPLINES.LINEAR
                }
            };
            this.randomizerButton.doStateTransition("HIDDEN", true);
            this.buttonGroup.addFocusGui(this.randomizerButton, 3, 4);
            this.addChildGui(this.randomizerButton);
        },
        show() {
            this.parent();
            this.randomizerButton.doStateTransition("DEFAULT");
        },
        hide(a: unknown) {
            this.parent(a);
            this.randomizerButton.doStateTransition("HIDDEN", a);
        }
    })
}