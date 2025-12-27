/**
 * An application for selecting items (weapons or equipment) to add to an actor's inventory
 * @extends {Application}
 */
export default class InventorySelector extends Application {
  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
    this.currentTab = 'equipment';
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "inventory-selector",
      classes: ["sgrpg", "inventory-selector"],
      template: "systems/sgrpg/templates/apps/inventory-selector.hbs",
      width: 700,
      height: 650,
      resizable: true,
      title: "Add Item to Inventory"
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const data = await super.getData();

    // Fetch all weapon items from the world
    const weapons = game.items.filter(i => i.type === 'weapon');
    weapons.sort((a, b) => a.name.localeCompare(b.name));

    // Fetch all equipment items from the world
    const equipment = game.items.filter(i => i.type === 'equip');
    equipment.sort((a, b) => a.name.localeCompare(b.name));

    data.weapons = weapons;
    data.equipment = equipment;
    data.actor = this.actor;

    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Tab switching
    html.find('.inventory-tab').click(this._onTabSwitch.bind(this));

    // Item card click - add item to actor
    html.find('.item-card').click(this._onItemSelect.bind(this));

    // Search functionality
    html.find('#inventory-search').on('input', this._onSearch.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle tab switching
   * @param {Event} event The originating click event
   * @private
   */
  _onTabSwitch(event) {
    event.preventDefault();

    const tab = event.currentTarget.dataset.tab;
    this.currentTab = tab;

    // Update active tab button
    this.element.find('.inventory-tab').removeClass('active');
    $(event.currentTarget).addClass('active');

    // Update active tab content
    this.element.find('.tab-content').removeClass('active');
    this.element.find(`[data-tab-content="${tab}"]`).addClass('active');

    // Clear and refocus search
    const searchInput = this.element.find('#inventory-search');
    searchInput.val('');
    this._onSearch({ target: searchInput[0] });
  }

  /* -------------------------------------------- */

  /**
   * Handle item selection
   * @param {Event} event The originating click event
   * @private
   */
  async _onItemSelect(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const itemType = event.currentTarget.dataset.itemType;
    const item = game.items.get(itemId);

    if (!item) {
      ui.notifications.error("Item not found!");
      return;
    }

    // Create a copy of the item on the actor
    await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);

    ui.notifications.info(`Added ${item.name} to inventory`);
    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Handle search input
   * @param {Event} event The originating input event
   * @private
   */
  _onSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const activeTabContent = this.element.find('.tab-content.active');
    const itemCards = activeTabContent.find('.item-card');

    itemCards.each(function() {
      const itemName = $(this).find('.item-name').text().toLowerCase();
      if (itemName.includes(searchTerm)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }
}
