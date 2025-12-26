
export default class ActorSg extends Actor {
/**
   * Apply a certain amount of damage or healing to the health pool for Actor
   * @param {number} amount       An amount of damage (positive) or healing (negative) to sustain
   * @param {number} multiplier   A multiplier which allows for resistance, vulnerability, or healing
   * @return {Promise<Actor>}     A Promise which resolves once the damage has been applied
   */
 async applyDamage(amount=0, multiplier=1) {
    amount = Math.floor(parseInt(amount) * multiplier);

    // Deduct damage from temp HP first
    const tmp = parseInt(this.system.temp_health.value) || 0;
    const dt = amount > 0 ? Math.min(tmp, amount) : 0;

    // Remaining goes to health
    const tmpMax = parseInt(this.system.temp_health.max) || 0;
    const dh = Math.clamped(this.system.health.value - (amount - dt), 0, this.system.health.max + tmpMax);

    // Update the Actor
    const updates = {
      "system.temp_health.value": tmp - dt,
      "system.health.value": dh
    };

    // Delegate damage application to a hook
    // TODO replace this in the future with a better modifyTokenAttribute function in the core
    const allowed = Hooks.call("modifyTokenAttribute", {
      attribute: "health",
      value: amount,
      isDelta: false,
      isBar: true
    }, updates);
    return allowed !== false ? this.update(updates) : this;
    }

    /** @inheritdoc */
    getRollData() {
        let rollData = super.getRollData();

        // Set the Tension Die from the scene, and if necessary, from the campaign
        const tensionDie = game.sgrpg.getTensionDie();
        rollData.tensionDie = tensionDie;
        rollData.tensionDice = tensionDie;
        rollData.TD = tensionDie;
        rollData.td = tensionDie;

        return rollData;
    }
}