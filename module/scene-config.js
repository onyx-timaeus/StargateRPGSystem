import { SGRPG } from "./config.js";

Hooks.on("renderSceneConfig", (sheet, html, data) => {
    const campaignTension = game.settings.get("sgrpg", "campaignTension");
    const sceneTension = data.document.getFlag("sgrpg", "sceneTensionDie") || "";

    let tensionDiceOptions = "";
    for(const die in SGRPG.tensionDice) {
        tensionDiceOptions += `<option value="${die}" ${sceneTension === die ? "selected" : ""}>${SGRPG.tensionDice[die]}</option>`
    }

    // Handle both jQuery and HTMLElement for v13+ compatibility
    const element = html instanceof HTMLElement ? html : html[0];
    const journalSelect = element.querySelector(`select[name="journal"]`);

    if (journalSelect && journalSelect.parentElement) {
        const newContent = `\
        <div class="form-group">
            <label>Scene Tension Level</label>
            <div class="form-fields">
                <select type="text" name="flags.sgrpg.sceneTensionDie" data-dtype="String">
                    <option value="" ${sceneTension ? "" : "selected"}>Campaign Base (${campaignTension})</option>
                    ${tensionDiceOptions}
                </select>
            </div>
            <p class="notes">The Tension level can be set to differ from the campaign base value when this Scene is active.</p>
        </div>`;

        journalSelect.parentElement.insertAdjacentHTML('afterend', newContent);
    }

    if (! sheet._minimized) {
        sheet.setPosition(sheet.position);
    }
});