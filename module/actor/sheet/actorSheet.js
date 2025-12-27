import ActorSheetFlags from "../../apps/actor-flags.js";
import WeaponSelector from "../../apps/weapon-selector.js";
import InventorySelector from "../../apps/inventory-selector.js";

export default class SGActorSheet extends ActorSheet {
    /** Default skill to attribute mappings */
    static DEFAULT_SKILL_MODS = {
        acrobatics: "dex",
        animalhandling: "wis",
        athletics: "str",
        culture: "wis",
        deception: "cha",
        engineering: "int",
        history: "int",
        insight: "wis",
        intimidation: "cha",
        investigation: "int",
        medicine: "wis",
        nature: "int",
        perception: "wis",
        performance: "cha",
        persuasion: "cha",
        pilot: "dex",
        science: "int",
        sleight: "dex",
        stealth: "dex",
        survival: "wis"
    };

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            width: 875,
            height: 900,
            tabs: [{navSelector: ".tabs", contentSelector: ".sg-sheet-body", initial: "character"}]
        });

        // https://foundryvtt.wiki/en/development/guides/SD-tutorial/SD07-Extending-the-ActorSheet-class
    }

    get template() {
        return `systems/sgrpg/templates/sheets/${this.actor.type}-sheet.hbs`;
    }


    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        const data = actorData.system;

        // Loop through ability scores, and add their modifiers to our sheet output.
        for (let [key, ability] of Object.entries(data.attributes)) {
            // Calculate the modifier using d20 rules.
            ability.mod = Math.floor((ability.value - 10) / 2);
        }
    }

    getData(options) {
        let isOwner = this.actor.isOwner;

        const data = {
          owner: isOwner,
          limited: this.actor.limited,
          options: this.options,
          editable: this.isEditable,
          cssClass: isOwner ? "editable" : "locked",
          isCharacter: this.actor.type === "character",
          isNPC: this.actor.type === "npc",
          isGM: game.user.isGM,
          isVehicle: this.actor.type === 'vehicle',
          rollData: this.actor.getRollData.bind(this.actor),
        };

        // The Actor's data
        const actorData = this.actor.toObject(false);
        data.actor = actorData;
        data.system = actorData.system;
        data.data = actorData.system;  // Keep for template compatibility
        data.system.tensionDie = game.sgrpg.getTensionDie();
        data.data.tensionDie = game.sgrpg.getTensionDie();

        // Remove undefined skill if it exists (data migration issue)
        if (data.system.skills && data.system.skills.undefined) {
            delete data.system.skills.undefined;
        }

        data.items = actorData.items;
        for ( let iData of data.items ) {
          const item = this.actor.items.get(iData._id);
          iData.hasAmmo = item.consumesAmmunition;
          iData.labels = item.labels;

          // Calculate to-hit for weapons
          if (iData.type === 'weapon') {
            const attackAbility = iData.system.attackAbility || 'dex';
            const abilityMod = data.system.attributes[attackAbility]?.mod || '+0';
            const profBonus = iData.system.isProficient ? parseInt(data.system.prof) : 0;

            // Parse ability mod (it's stored as "+2" or "-1")
            const abilityNum = parseInt(abilityMod);
            const totalToHit = abilityNum + profBonus;

            iData.calculatedToHit = totalToHit >= 0 ? `+${totalToHit}` : totalToHit.toString();
          }
        }
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this._prepareItemData(data);
        this._prepare_proficient_skills(data);

        data.config = foundry.utils.mergeObject(CONFIG.SGRPG, {
            conditions: {
                normal: "Normal",
                disadvabilitychecks: "Disadv ability checks",
                speedhalved: "Speed halved",
                disadvattackssaves: "Disadv attacks, saves",
                hpmaxhalved: "HP max halved",
                speedzero: "Speed zero",
                death: "Death"
            },
            saves: CONFIG.SGRPG.abilities
        });

        return data;
    }

    /**
     * Activate event listeners using the prepared sheet HTML
     * @param html {jQuery}   The prepared HTML object ready to be rendered into the DOM
     */
    activateListeners(html) {
        super.activateListeners(html);
        if ( ! this.isEditable ) return;

        // Rollable skill checks
        html.find('a.txt-btn[type="roll"]').click(event => this._onRollCheck(event));
        html.find('a.txt-btn[type="roll_init"]').click(event => this._roll_initiative(event));
        html.find('a.txt-btn[type="roll_moxie"]').click(event => this._roll_moxie(event));
        html.find('a[type="roll_attack"]').click(event => this._roll_attack(event));

        // Data-action handlers
        html.find('[data-action="rollTD"]').click(event => this._onRollTensionDie(event));
        html.find('[data-action="rollHD"]').click(event => this._onRollHitDice(event));
        html.find('[data-action="rollDeathSave"]').click(event => this._onRollDeathSave(event));
        html.find('[data-action="addWeapon"]').click(event => this._onAddWeapon(event));
        html.find('[data-action="addInventory"]').click(event => this._onAddItem(event));

        html.find('input[data_type="ability_value"]').change(this._onChangeAbilityValue.bind(this));
        html.find('input[data_type="skill_prof"]').click(event => this._onToggleSkillProficiency(event));
        html.find('input[name="data.prof"]').change(event => this._onProfChanged(event));
        html.find('select[data_type="skill_mod"]').change(event => this._onChangeSkillMod(event));
        html.find('a.skill-mod-revert').click(event => this._onSkillRestoreDefaultModClicked(event));

        html.find('.item-consume').click(event => this._onItemConsume(event));
        html.find('.item-edit').click(event => this._onItemEdit(event));
        html.find('.item-delete').click(event => this._onItemDelete(event));
        html.find('.item-roll').click(event => this._onItemRoll(event));
        html.find('.item-reload').click(event => this._onItemReload(event));

        html.find('a.config-button').click(this._onConfigMenu.bind(this));
    }

    async _onSkillRestoreDefaultModClicked(event) {
        event.preventDefault();
        const skillName = event.currentTarget.parentElement.dataset.skill;

        if (!skillName) {
            console.error("Skill name not found", event.currentTarget);
            return;
        }

        const defaultSkillMod = SGActorSheet.DEFAULT_SKILL_MODS[skillName];

        if (!defaultSkillMod) {
            console.error(`No default mod found for skill: ${skillName}`);
            return;
        }

        // Update the skill's mod to the default
        await this.actor.update({ [`system.skills.${skillName}.mod`]: defaultSkillMod });

        // Now recalculate all skill values
        const skillUpdates = this._compileSkillValues();
        return this.actor.update(skillUpdates);
    }

    /** @override */
    async _onDropItemCreate(itemData) {
        // if ( itemData.data ) {
        //     // Ignore certain statuses
        //     ["equipped", "proficient", "prepared"].forEach(k => delete itemData.data[k]);
        // }

        // Stack identical equipment
        if ( itemData.type === "equip" && itemData.flags.core?.sourceId ) {
            const similarItem = this.actor.items.find(i => {
                const sourceId = i.getFlag("core", "sourceId");
                return sourceId && (sourceId === itemData.flags.core?.sourceId) && (i.type === "equip");
            });
            if ( similarItem ) {
                return similarItem.update({
                    'system.quantity': similarItem.system.quantity + Math.max(itemData.system.quantity, 1)
                });
            }
        }

        // Create the owned item as normal
        return super._onDropItemCreate(itemData);
    }

    _prepareItemData(data) {
        let inventory = {
            weapon: [],
            equip: []
        };

        let curBulk = 0;
        for(const item of data.items) {
            if(! Object.keys(inventory).includes(item.type)) {
                console.error("Unknown item type!");
                continue;
            }

            item.isStack = Number.isNumeric(item.system.quantity) && (item.system.quantity !== 1);

            // Calculate item bulk.
            const itemBulk = item.system.bulk || 0;
            const itemCount = (item.isStack ? item.system.quantity : 1);
            curBulk += itemBulk * itemCount;
            if (item.type == "weapon" && item.system.ammo) {
                const ammoBulk = item.system.ammo.bulk;
                const ammoCount = item.system.ammo.value;
                curBulk += ammoBulk * ammoCount;
            }

            // Add item into proper inventory.
            inventory[item.type].push(item);
        }
        curBulk = Math.ceil(curBulk);

        const maxBulk = data.data.bulk + parseInt(data.data.attributes.str.mod);

        data.items = inventory;
        data.currentBulk = curBulk;
        data.currentBulkPerc = Math.min((curBulk / maxBulk) * 100, 100);
        data.isOverloaded = curBulk > maxBulk;
        data.maxBulk = maxBulk;
    }


    _prepare_proficient_skills(data) {
        data.proficient_skills = {};
        for(const skill_id in data.data.skills) {
            const skill = data.data.skills[skill_id];
            if (skill.proficient) {
                data.proficient_skills[skill_id] = foundry.utils.deepClone(skill);
            }
        }
    }

    async _onChangeAbilityValue(event) {
        event.preventDefault();
        const newAttrVal = parseInt(event.currentTarget.value);
        const attrName = event.currentTarget.parentElement.dataset.attr;

        await this.actor.update({
            [`system.attributes.${attrName}.mod`]: this._calculateAttributeMod(newAttrVal),
            [`system.attributes.${attrName}.value`]: newAttrVal
        }, {render: false});

        return this.actor.update(this._compileSkillValues());
    }

    async _onProfChanged(event) {
        event.preventDefault();
        const newProf = parseInt(event.currentTarget.value);

        await this.actor.update({
            "system.prof": newProf
        }, {render: false});

        return this.actor.update(this._compileSkillValues());
    }

    async _onToggleSkillProficiency(event) {
        event.preventDefault();
        const cb = event.currentTarget;

        await this.actor.update({[cb.name]: cb.checked == true }, {render: false});
        return this.actor.update(this._compileSkillValues());
    }

    async _onChangeSkillMod(event) {
        event.preventDefault();
        const select = event.currentTarget;

        await this.actor.update({[select.name]: select.value }, {render: false});
        return this.actor.update(this._compileSkillValues());
    }

    _compileSkillValues() {
        const actorData = this.getData();
        const skillList = foundry.utils.getProperty(actorData, "system.skills");
        const savesList = foundry.utils.getProperty(actorData, "system.saves");
        const currentProfValue = parseInt(foundry.utils.getProperty(actorData, "system.prof"));

        let modify = {};
        for(const skillName in skillList) {
            const skill = skillList[skillName]
            const skillModName = foundry.utils.getProperty(actorData, `system.skills.${skillName}.mod`);
            let baseVal = parseInt(foundry.utils.getProperty(actorData, `system.attributes.${skillModName}.mod`));
            if (skill.proficient) {
                baseVal += currentProfValue;
            }
            modify[`system.skills.${skillName}.value`] = baseVal < 0 ? baseVal.toString() : "+"+baseVal;
        }

        for(const saveName in savesList) {
            const save = savesList[saveName]
            const saveModName = foundry.utils.getProperty(actorData, `system.saves.${saveName}.mod`);
            let baseVal = parseInt(foundry.utils.getProperty(actorData, `system.attributes.${saveModName}.mod`));
            if (save.proficient) {
                baseVal += currentProfValue;
            }
            modify[`system.saves.${saveName}.value`] = baseVal < 0 ? baseVal.toString() : "+"+baseVal;
        }


        return modify;
    }

    /**
     * Handle editing an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemEdit(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        return item.sheet.render(true);
    }

    _onItemConsume(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        return item.consume();
    }

    async _onItemReload(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);

        if (item.system.ammo.value == item.system.ammo.max) {
            return ui.notifications.info("Weapon is already reloaded.");
        }

        const ammoItem = item.findAmmunition();
        if (! ammoItem) {
            if (item.system.ammo.target == CONFIG.SGRPG.actionReloadValue) {
                // Weapon has no magazine, allow free reload.
                return item.update({"system.ammo.value": item.system.ammo.max});
            }
            return ui.notifications.info(`Unable to find magazine to reload '${item.name}'.`);
        }

        const magCount = ammoItem.system.quantity || 0;
        if (magCount <= 0) {
            return ui.notifications.info(`No more magazines left for '${item.name}' in inventory.`);
        }

        await ammoItem.update({
            "system.quantity": magCount - 1
        }, {render: false});

        return item.update({"system.ammo.value": item.system.ammo.max});
    }

    /* -------------------------------------------- */

    /**
     * Handle deleting an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemDelete(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);

        if (confirm(`Do you really want to delete '${item.name}' from inventory?`) !== true) {
            return;
        }

        if ( item ) return item.delete();
    }

    _onItemRoll(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        if ( item ) return item.roll()
    }

    /**
     * Handle toggling Ability score proficiency level
     * @param {Event} event     The originating click event
     * @private
     */
     async _onRollCheck(event) {
        event.preventDefault();

        let actorData = this.getData();
        let bonusDataPath = event.currentTarget.dataset.bonus;

        let rollData = parseInt(foundry.utils.getProperty(actorData, bonusDataPath));
        if (rollData >= 0) {
            // Make sure there is always sign.
            rollData = "+" + rollData;
        }


        let r = new CONFIG.Dice.D20Roll("1d20 @prof", {prof: rollData});
        const configured = await r.configureDialog({
            title: `Roll check for ${event.currentTarget.innerText}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        // Print roll to console.
        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: event.currentTarget.innerText
        });
    }

    async _onRollDeathSave(event) {
        event.preventDefault();

        let r = new Roll("1d20");
        await r.evaluate();
        const rollResult = r.total;

        // Count current successes and failures
        const system = this.actor.system;
        const curSuccesses = [system.death_success1, system.death_success2, system.death_success3].filter(Boolean).length;
        const curFailures = [system.death_failure1, system.death_failure2, system.death_failure3].filter(Boolean).length;
        const curHealth = parseInt(system.health.value);

        const updates = {};

        if (rollResult == 1) {
            // Critical fail: 2 failures
            if (curFailures === 0) {
                updates["system.death_failure1"] = true;
                updates["system.death_failure2"] = true;
            } else if (curFailures === 1) {
                if (!system.death_failure2) updates["system.death_failure2"] = true;
                if (!system.death_failure3) updates["system.death_failure3"] = true;
            } else if (curFailures === 2) {
                if (!system.death_failure3) updates["system.death_failure3"] = true;
                updates["system.condition"] = "death";
            }
        }
        else if (rollResult == 20) {
            // Critical success: heal 1 HP and reset death saves
            const maxHealth = parseInt(system.health.max);
            updates["system.death_success1"] = false;
            updates["system.death_success2"] = false;
            updates["system.death_success3"] = false;
            updates["system.death_failure1"] = false;
            updates["system.death_failure2"] = false;
            updates["system.death_failure3"] = false;
            updates["system.health.value"] = Math.min(curHealth + 1, maxHealth);
        }
        else if (rollResult >= 10) {
            // Success
            if (curSuccesses === 0) {
                updates["system.death_success1"] = true;
            } else if (curSuccesses === 1) {
                updates["system.death_success2"] = true;
            } else if (curSuccesses === 2) {
                // Third success: stabilize and reset
                updates["system.death_success1"] = false;
                updates["system.death_success2"] = false;
                updates["system.death_success3"] = false;
                updates["system.death_failure1"] = false;
                updates["system.death_failure2"] = false;
                updates["system.death_failure3"] = false;
            }
        }
        else {
            // Failure
            if (curFailures === 0) {
                updates["system.death_failure1"] = true;
            } else if (curFailures === 1) {
                updates["system.death_failure2"] = true;
            } else if (curFailures === 2) {
                updates["system.death_failure3"] = true;
                updates["system.condition"] = "death";
            }
        }

        if (Object.keys(updates).length > 0) {
            await this.actor.update(updates);
        }

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Death Save"
        });
    }

    _reset_deathsave(event) {
        event.preventDefault();
        return this.actor.update({
            "system.death_success1": false,
            "system.death_success2": false,
            "system.death_success3": false,
            "system.death_failure1": false,
            "system.death_failure2": false,
            "system.death_failure3": false
        });
    }

    _roll_initiative(event) {
        return this.actor.rollInitiative({createCombatants: true});
    }

    _roll_moxie(event) {
        return ui.notifications.warn("Moxie combat is not implemented, please use different way");
    }

    /**
     * Handle rolling the Tension Die
     * @param {Event} event   The click event
     * @private
     */
    async _onRollTensionDie(event) {
        event.preventDefault();
        const tensionDie = this.actor.system.tensionDie || "d6";

        let r = new Roll(`1${tensionDie}`);
        await r.evaluate();

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `Tension Die (${tensionDie})`
        });
    }

    /**
     * Handle rolling the Hit Dice
     * @param {Event} event   The click event
     * @private
     */
    async _onRollHitDice(event) {
        event.preventDefault();
        const hitDice = this.actor.system.hd || "d6";
        const conMod = this.actor.system.attributes.con.mod || "+0";

        let r = new Roll(`1${hitDice} + ${conMod}`);
        await r.evaluate();

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `Hit Dice (${hitDice} + CON)`
        });
    }

    /**
     * Handle spawning the TraitSelector application which allows a checkbox of multiple trait options
     * @param {Event} event   The click event which originated the selection
     * @private
     */
    _onConfigMenu(event) {
        event.preventDefault();
        const button = event.currentTarget;
        let app;
        console.log(button.dataset.action)
        switch ( button.dataset.action ) {
        case "flags":
            app = new ActorSheetFlags(this.object);
            break;
        }
        app?.render(true);
    }

    /**
     * Handle opening the item selector dialog (weapons and equipment)
     * @param {Event} event   The click event
     * @private
     */
    _onAddItem(event) {
        event.preventDefault();
        const selector = new InventorySelector(this.actor);
        selector.render(true);
    }

    /**
     * Handle opening the weapon selector dialog (weapons only)
     * @param {Event} event   The click event
     * @private
     */
    _onAddWeapon(event) {
        event.preventDefault();
        const selector = new WeaponSelector(this.actor);
        selector.render(true);
    }

    /**
     * Handle input changes to numeric form fields, allowing them to accept delta-typed inputs
     * @param event
     * @private
     */
     _calculateAttributeMod(value) {
        const stat_base = value

        let stat_mod = 0;
        if (stat_base >= 30) stat_mod = "+10";
        else if (stat_base >= 28) stat_mod = "+9";
        else if (stat_base >= 26) stat_mod = "+8";
        else if (stat_base >= 24) stat_mod = "+7";
        else if (stat_base >= 22) stat_mod = "+6";
        else if (stat_base >= 20) stat_mod = "+5";
        else if (stat_base >= 18) stat_mod = "+4";
        else if (stat_base >= 16) stat_mod = "+3";
        else if (stat_base >= 14) stat_mod = "+2";
        else if (stat_base >= 12) stat_mod = "+1";
        else if (stat_base >= 10) stat_mod = "+0";
        else if (stat_base >= 8) stat_mod = "-1";
        else if (stat_base >= 6) stat_mod = "-2";
        else if (stat_base >= 4) stat_mod = "-3";
        else if (stat_base >= 2) stat_mod = "-4";
        else if (stat_base <= 1) stat_mod = "-5";
        else stat_mod = "+0";

        return stat_mod;
    }
}