// Role-rule, game, guide, and design settings UI.

function setRoleRuleOption(key, enabled) {
    if (!(key in defaultRoleRuleSettings)) return;
    roleRuleSettings[key] = enabled === true;
    localStorage.setItem(roleRulesStorageKey, JSON.stringify(roleRuleSettings));
    scheduleGameSave();
}

function loadPersistentRuleSettings() {
    try {
        roleRuleSettings = pickKnownSettings(
            defaultRoleRuleSettings,
            JSON.parse(localStorage.getItem(roleRulesStorageKey))
        );
        gameSettings = pickKnownSettings(
            defaultGameSettings,
            JSON.parse(localStorage.getItem(gameSettingsStorageKey))
        );
    } catch (error) {
        roleRuleSettings = { ...defaultRoleRuleSettings };
        gameSettings = { ...defaultGameSettings };
    }
}

function showGameGuide() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal gameGuideModal" role="dialog" aria-modal="true" aria-labelledby="gameGuideTitle">
        <h2 id="gameGuideTitle">Moderator Game Guide</h2>
        <p>The assistant tracks hidden identities, role state, protection, linked players, delayed effects, and victory conditions while the moderator leads the table through alternating Night and Day phases.</p>

        <h3>What to read aloud</h3>
        <p>Text in quotation marks is intended to be read to the players. Text labeled <strong>Moderator Note</strong>, private role displays, target selectors, explanations, and result details are for the moderator only.</p>

        <h3>Night 1: identifying random cards</h3>
        <p>Cards are dealt randomly, so every dealt non-Villager role wakes at least once on Night 1—even passive roles and roles whose abilities cannot act yet. This first wake tells the moderator who holds the card. Ordinary Villagers do not need an individual wake and are assigned automatically after every other identity is known.</p>

        <h3>Why a role may wake twice</h3>
        <p>Some actions depend on identities that may not have been collected yet. Before an information role acts, the assistant checks whether it can calculate every possible result correctly.</p>
        <ul class="guideList">
            <li><strong>Exact-role checks</strong>, such as Mystic Seer or Mystic Wolf, need exact identities for every possible target.</li>
            <li><strong>Werewolf checks</strong>, such as P.I., can proceed once every role that could appear as a Werewolf has been identified. Remaining unknown players can then safely be treated as not appearing Werewolf.</li>
            <li><strong>Alignment checks</strong>, such as Seer, wait only for roles that could affect the thumbs-up or thumbs-down result.</li>
            <li><strong>Team comparisons</strong>, such as Mentalist, can proceed when all remaining unknown roles are guaranteed to share one team.</li>
        </ul>
        <p>If enough information is already known, the player stays awake and continues directly into the action. If information is missing, the role is told to sleep and its action is queued. It wakes a second time only after the missing identities have been collected. Role priority affects how often this is necessary.</p>

        <h3>Theatrical wakes and hidden deaths</h3>
        <p>A theatrical wake protects secret information. A role that has used its ability, cannot legally act, represents the Drunk's unknown card, or died with its role hidden may still be called. The moderator waits briefly, records no action, and sends the role back to sleep. A player eliminated during the current Night may still complete an action before the morning announcement; the village does not officially know that player died until everyone wakes.</p>

        <h3>How Night consequences are resolved</h3>
        <p>The assistant records choices as they occur, then resolves interacting effects in a stable order so later information uses the correct state:</p>
        <ol class="guideList">
            <li>Werewolf and other Night targets are recorded.</li>
            <li>Barricades, Bodyguard protection, Priest blessings, armor, voodoo dolls, and role-specific defenses are applied.</li>
            <li>Conversions, redirects, delayed Tough Guy injuries, and Diseased consequences are resolved.</li>
            <li>Cupid, Dire Wolf, Hunter, Mad Bomber, Wolf Cub, and other linked or triggered consequences are resolved.</li>
            <li>The Night update explains eliminations, prevented attacks, conversions, and other relevant outcomes.</li>
            <li>Victory is checked only after required death and trigger sequences finish.</li>
        </ol>

        <h3>Hidden roles and public information</h3>
        <p>The moderator can always see the true role and relevant private state. The village sees a role only when the reveal rules allow it. A Kick is an outside-the-game removal and remains distinct from a Day vote or Night death. “Nobody” records that a role deliberately took no action without forcing an illegal target.</p>

        <h3>Inherited and delayed roles</h3>
        <p>The Doppelganger and Martyr inherit the existing state of a role: established links and targets remain, and spent abilities stay spent. Doppelganger death-trigger roles may trigger again when the Doppelganger later dies and is revealed as having inherited that role. Martyr transfers the role before the original player's death consequences, so the original player cannot trigger the exchanged role. The Drunk appears as a Villager until receiving the leftover physical card at the start of Night 3; delayed setup is then resolved as required.</p>

        <h3>Teams, appearance, and victory</h3>
        <dl class="guideDefinitions">
            <dt>Team</dt><dd>The side a player wins with. A role can appear differently from its actual team.</dd>
            <dt>Appears as</dt><dd>What information roles detect. For example, the Lycan is a Villager who appears as a Werewolf.</dd>
            <dt>Werewolf elimination</dt><dd>Werewolves wake together to choose the shared target. Werewolf-team support roles such as Minion and Sorceress still use only their individual abilities.</dd>
            <dt>Parity</dt><dd>The Werewolf team normally wins when its applicable parity count equals or exceeds the Villager side. Role options can change whether certain support roles count, and the Mayor affects the Villager voting strength under the configured rules.</dd>
            <dt>Value</dt><dd>A balancing estimate. Positive values generally help Villagers; negative values generally help Werewolves.</dd>
            <dt>Once per game</dt><dd>The player is still called after using the ability, but no further action is recorded.</dd>
        </dl>

        <h3>House-rule options</h3>
        <p>Role information cards contain independent on/off switches for disputed or group-specific interactions. Fixed rules are marked “Always on.” Settings persist until Restore All Defaults is used; starting a new game clears game events but retains the chosen role rules.</p>

        <h3>Saving, correcting, and ending</h3>
        <p>The current game is saved automatically in this browser and restores after a refresh or reopening the app. Back undoes the most recent recorded action; it may be used repeatedly to move farther through the saved action history. Correct Game State can repair a player's role, team, life and reveal status, elimination details, armor, one-use ability status, or directional death link. Corrections are logged privately and can be undone. <strong>End Game</strong> clears active progress after confirmation and opens the final summary.</p>
        <div class="modalActions gameGuideActions"><button type="button" class="dangerButton" data-click="endGame()">End Game</button><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", activateModal(overlay, close));
}

function settingToggle(key, label, description) {
    return `<label class="ruleToggle">
        <input type="checkbox" ${gameSettings[key] ? "checked" : ""} data-change="setGameSetting('${key}', this.checked); this.nextElementSibling.querySelector('small').textContent = this.checked ? 'On' : 'Off'">
        <span><strong>${escapeHTML(label)}</strong><small>${gameSettings[key] ? "On" : "Off"}</small><em>${escapeHTML(description)}</em></span>
    </label>`;
}

function showGameSettings() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="gameSettingsTitle">
        <h2 id="gameSettingsTitle">Game Settings</h2>
        ${settingToggle("continueVotingAfterWolfElimination", "Continue voting after eliminating a wolf", "A village vote that eliminates a wolf allows another vote the same Day. Victory still ends the game.")}
        <p>These options change core moderator and game behavior.</p>
        ${settingToggle("revealNightRoles", "Reveal roles eliminated at Night", "Day-vote roles are always revealed. Turn this on to reveal Night eliminations too.")}
        ${settingToggle("showModeratorDetails", "Show Moderator details", "Displays the private explanation of protections, conversions, and other results.")}
        ${settingToggle("confirmKick", "Confirm before Kick", "Requires an extra confirmation before removing a player without revealing their role.")}
        <label class="ruleToggle">
            <input type="checkbox" ${gameSettings.werewolfEliminationOnFirstNight ? "checked" : ""} data-change="setGameSetting('werewolfEliminationOnFirstNight', this.checked); showGameSettings()">
            <span><strong>Allow a Werewolf elimination on Night 1</strong><small>${gameSettings.werewolfEliminationOnFirstNight ? "On" : "Off"}</small><em>Also activates Bodyguard, Witch, and other Night 1 attack-dependent actions.</em></span>
        </label>
        ${!gameSettings.werewolfEliminationOnFirstNight ? `<div style="margin-left:1.25rem;">${settingToggle("beginGameOnNightZero", "Begin the first Night on Night 0", "Labels the no-elimination setup Night as Night 0. Ravenous Wolf does not count it because the Werewolves cannot eliminate anyone.")}</div>` : ""}
        <div class="modalActions"><button type="button" data-click="resetGameSettings(); showGameSettings()">Restore All Defaults</button><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", activateModal(overlay, close));
}

function setGameSetting(key, enabled) {
    if (!(key in defaultGameSettings)) return;
    gameSettings[key] = enabled === true;
    localStorage.setItem(gameSettingsStorageKey, JSON.stringify(gameSettings));
    scheduleGameSave();
}

function resetGameSettings() {
    gameSettings = { ...defaultGameSettings };
    roleRuleSettings = { ...defaultRoleRuleSettings };
    localStorage.setItem(gameSettingsStorageKey, JSON.stringify(gameSettings));
    localStorage.setItem(roleRulesStorageKey, JSON.stringify(roleRuleSettings));
    scheduleGameSave();
}

function showDesignSettings() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    const themes = [
        ["classic", "Classic", "Dark blue to blood red"],
        ["moonlight", "Moonlight", "Deep blue and silver"],
        ["ember", "Ember", "Charcoal and warm red"],
        ["classic-light", "Classic Light", "Soft sky blue to rose"],
        ["moonlight-light", "Moonlight Light", "Icy blue and silver"],
        ["ember-light", "Ember Light", "Warm cream and copper"]
    ];
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="designSettingsTitle">
        <h2 id="designSettingsTitle">Design</h2>
        <h3>Color theme</h3>
        <div class="themeChoices">${themes.map(([key, label, description]) => `
            <button type="button" class="themeChoice ${designSettings.theme === key ? "selected" : ""}" data-click="setDesignSetting('theme', '${key}'); showDesignSettings()">
                <span class="themeSwatch ${key}"></span><strong>${label}</strong><small>${description}</small>
            </button>`).join("")}</div>
        <h3>Display</h3>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.largeText ? "checked" : ""} data-change="setDesignSetting('largeText', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Larger text</strong><small>${designSettings.largeText ? "On" : "Off"}</small></span></label>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.compactRows ? "checked" : ""} data-change="setDesignSetting('compactRows', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Compact player and role rows</strong><small>${designSettings.compactRows ? "On" : "Off"}</small></span></label>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.keepAwake ? "checked" : ""} data-change="setDesignSetting('keepAwake', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Keep the screen awake during games</strong><small>${designSettings.keepAwake ? "On" : "Off"}</small></span></label>
        <div class="modalActions"><button type="button" data-click="resetDesignSettings(); showDesignSettings()">Reset</button><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", activateModal(overlay, close));
}

function setDesignSetting(key, value) {
    if (!(key in defaultDesignSettings)) return;
    designSettings[key] = value;
    localStorage.setItem(designStorageKey, JSON.stringify(designSettings));
    applyDesignSettings();
    updateWakeLock();
}

function resetDesignSettings() {
    designSettings = { ...defaultDesignSettings };
    localStorage.setItem(designStorageKey, JSON.stringify(designSettings));
    applyDesignSettings();
    updateWakeLock();
}

function loadDesignSettings() {
    try {
        designSettings = { ...defaultDesignSettings, ...(JSON.parse(localStorage.getItem(designStorageKey)) || {}) };
    } catch (error) {
        designSettings = { ...defaultDesignSettings };
    }
    applyDesignSettings();
}

function applyDesignSettings() {
    document.body.dataset.theme = designSettings.theme;
    document.body.classList.toggle("largeText", designSettings.largeText === true);
    document.body.classList.toggle("compactRows", designSettings.compactRows === true);
}

