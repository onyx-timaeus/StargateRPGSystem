export default class SGItemSheet extends ItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          classes: ["sheet", "item", "itemsheet"],
          width: 720,
          height: 650,
          tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
        });
      }

    get template() {
        return `systems/sgrpg/templates/sheets/item-sheet.hbs`;
    }

    _getTabs() {
        const tabs = super._getTabs();
        // Set initial tab to stats for all items
        tabs.forEach(tab => {
            tab.initial = "stats";
        });
        return tabs;
    }

    getData(options) {
        let isOwner = this.item.isOwner;
        const data = {
          owner: isOwner,
          limited: this.item.limited,
          options: this.options,
          editable: this.isEditable,
          cssClass: isOwner ? "editable" : "locked",
          rollData: this.item.getRollData.bind(this.item),
          config: CONFIG.SGRPG,
          isWeapon: this.item.type == "weapon"
        };

        // The Actor's data
        const itemData = this.item.toObject(false);
        data.item = itemData;
        data.system = itemData.system;
        data.data = itemData.system;  // Keep for template compatibility

        // Potential consumption targets
        data.abilityConsumptionTargets = this._getItemConsumptionTargets(itemData);

        console.log(data.system);
        return data;
    }


    /**
     * Get the valid item consumption targets which exist on the actor
     * @param {Object} item         Item data for the item being displayed
     * @return {{string: string}}   An object of potential consumption targets
     * @private
     */
    _getItemConsumptionTargets(item) {
      const actor = this.item.actor;
      if ( !actor ) return {};

      // Ammunition
      return actor.itemTypes.equip.reduce((ammo, i) =>  {
        ammo[i.id] = `${i.name} (${i.system.quantity})`;
        return ammo;
      }, {});
    }

    /** @override */
    async activateEditor(name, options={}, initialContent="") {
        options.content_style = "body { color: #e0e0e0; background-color: rgba(5, 15, 25, 0.9); } body * { color: #e0e0e0; }";
        return super.activateEditor(name, options, initialContent);
    }
}