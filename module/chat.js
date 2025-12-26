/**
 * Highlight critical success or failure on d20 rolls
 */
 export const highlightCriticalSuccessFailure = function(message, html, data) {
    if ( !message.isRoll || !message.isContentVisible ) return;

    // Highlight rolls where the first part is a d20 roll
    const roll = message.rolls?.[0];
    if ( !roll || !roll.dice?.length ) return;
    const d = roll.dice[0];

    // Ensure it is an un-modified d20 roll
    const isD20 = (d.faces === 20) && ( d.values.length === 1 );
    if ( !isD20 ) return;
    const isModifiedRoll = ("success" in d.results[0]) || d.options.marginSuccess || d.options.marginFailure;
    if ( isModifiedRoll ) return;

    // Highlight successes and failures
    const critical = d.options.critical || 20;
    const fumble = d.options.fumble || 1;

    // Handle both jQuery and HTMLElement for v13+ compatibility
    const element = html instanceof HTMLElement ? html : html[0];
    const diceTotal = element.querySelector(".dice-total");

    if (!diceTotal) return;

    if ( d.total >= critical ) diceTotal.classList.add("critical");
    else if ( d.total <= fumble ) diceTotal.classList.add("fumble");
    else if ( d.options.target ) {
      if ( roll.total >= d.options.target ) diceTotal.classList.add("success");
      else diceTotal.classList.add("failure");
    }
  };

  /**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {Array} options       The Array of Context Menu options
 *
 * @return {Array}              The extended options Array including new context choices
 */
export const addChatMessageContextOptions = function(html, options) {
  let canApply = li => {
    const messageId = li.dataset?.messageId || li.getAttribute?.("data-message-id");
    const message = game.messages.get(messageId);
    return message?.isRoll && message?.isContentVisible && canvas.tokens?.controlled.length;
  };
  options.push(
    {
      name: "Apply damage",
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    },
    {
      name: "Apply healing",
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, -1)
    },
    {
      name: "Apply double damage",
      icon: '<i class="fas fa-user-injured"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 2)
    },
    {
      name: "Apply half damage",
      icon: '<i class="fas fa-user-shield"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 0.5)
    }
  );
  return options;
};

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {HTMLElement} li      The chat entry which contains the roll data
 * @param {Number} multiplier   A damage multiplier to apply to the rolled damage.
 * @return {Promise}
 */
function applyChatCardDamage(li, multiplier) {
  const messageId = li.dataset?.messageId || li.getAttribute?.("data-message-id");
  const message = game.messages.get(messageId);
  const roll = message.roll;
  return Promise.all(canvas.tokens.controlled.map(t => {
    const a = t.actor;
    return a.applyDamage(roll.total, multiplier);
  }));
}