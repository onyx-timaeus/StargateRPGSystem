/**
 * An application for selecting weapons to add to an actor's inventory
 * @extends {Application}
 */
export default class WeaponSelector extends Application {
  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "weapon-selector",
      classes: ["sgrpg", "weapon-selector"],
      template: "systems/sgrpg/templates/apps/weapon-selector.hbs",
      width: 600,
      height: 600,
      resizable: true,
      title: "Select Weapon"
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const data = await super.getData();

    // Fetch all weapon items from the world
    const weapons = game.items.filter(i => i.type === 'weapon');

    // Sort weapons by name
    weapons.sort((a, b) => a.name.localeCompare(b.name));

    data.weapons = weapons;
    data.actor = this.actor;

    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Weapon card click - add weapon to actor
    html.find('.weapon-card').click(this._onWeaponSelect.bind(this));

    // Search functionality
    html.find('#weapon-search').on('input', this._onSearch.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle weapon selection
   * @param {Event} event The originating click event
   * @private
   */
  async _onWeaponSelect(event) {
    event.preventDefault();

    const weaponId = event.currentTarget.dataset.weaponId;
    const weapon = game.items.get(weaponId);

    if (!weapon) {
      ui.notifications.error("Weapon not found!");
      return;
    }

    // Create a copy of the weapon on the actor
    await this.actor.createEmbeddedDocuments("Item", [weapon.toObject()]);

    ui.notifications.info(`Added ${weapon.name} to inventory`);
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
    const weaponCards = this.element.find('.weapon-card');

    weaponCards.each(function() {
      const weaponName = $(this).find('.weapon-name').text().toLowerCase();
      if (weaponName.includes(searchTerm)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }
}
