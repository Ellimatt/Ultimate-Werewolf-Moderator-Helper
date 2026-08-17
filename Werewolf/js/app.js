// ============================================================
// ULTIMATE WEREWOLF ASSISTANT
// ============================================================

let currentScreen = "players";
let players = [];
let roles = [];
let originalRoleDefinitions = [];


// ============================================================
// NIGHT ONE STATE
// ============================================================

let nightOneWakeOrder = [];
let nightOneCurrentRole = 0;

let nightOneActionOrder = [];
let nightOneCurrentAction = 0;
let nightOneActionMode = null;
let isLaterNight = false;
let savedVoteCount = 0;
let wolvesDisabledNextNight = false;
let wolvesDisabledTonight = false;
let wolfEliminationsTonight = 1;
let currentNight = 1;
let currentDay = 0;
let leftoverCardRole = null;
let resumeMorningAfterSpecialResolution = false;
let roleSearchTerm = "";
let eliminationSequence = 0;
let roleSortMode = "alphabetical-asc";
let roleTeamFilter = "all";
let roleSelectedOnly = false;
let ignoreWinConditions = false;
let gameResultContinuation = null;
let phaseHistory = [];
let dayEliminationVoteOccurred = false;
const defaultRoleRuleSettings = {
    bodyguardProtectsWitch: false,
    bodyguardProtectsHuntress: false,
    werewolfProtectionBlocksAlphaConversion: true,
    wolfCubKickActivatesBonus: false,
    hunterActivatesAtNight: false,
    lycanAppearsWerewolfToPI: false,
    lycanDisguisesRoleFromMysticSeer: false,
    wolfManHiddenFromPI: false,
    wolfManDisguisesRoleFromMysticSeer: false,
    madBomberActivatesDuringNight: true,
    sorceressRevealsWerewolf: false,
    wildChildTransformsAfterKick: true,
    wildChildTransformsAfterDayDeath: true,
    wildChildTransformsAfterNightDeath: true,
    wildChildTransformsIfRoleHidden: true,
    beholderLearnsApprenticeSeer: false,
    beholderLearnsDoppelgangerSeer: false,
    beholderWakesOnFutureNights: false,
    trackerCountsLycanAsWolf: false,
    trackerHidesWolfMan: false,
    minionCountsForWerewolfParity: true,
    fruitBruteCountsForWerewolfParity: true,
    sorceressCountsForWerewolfParity: true,
    doppelgangerPerformsLateSetup: true,
    doppelgangerJoinsNormalWakeSameNight: true,
    doppelgangerReceivesFreshOncePerGameAbility: true,
    doppelgangerAllowsDireWolfConnection: true,
    doppelgangerAllowsCupidPair: false,
    doppelgangerAllowsWildChildRoleModel: true,
    doppelgangerAllowsButcherTarget: true,
    doppelgangerGivesShepherdFlock: true,
    doppelgangerReceivesRoleKnowledge: true,
    mentalistCannotRepeatPlayers: true
};
let roleRuleSettings = { ...defaultRoleRuleSettings };
const defaultGameSettings = {
    revealNightRoles: false,
    showModeratorDetails: true,
    confirmKick: true,
    werewolfEliminationOnFirstNight: false
};
let gameSettings = { ...defaultGameSettings };
const designStorageKey = "ultimateWerewolfAssistant.design";
const savedSetupsStorageKey = "ultimateWerewolfAssistant.savedSetups";
const defaultDesignSettings = { theme: "classic", largeText: false, compactRows: false };
let designSettings = { ...defaultDesignSettings };
const savedGameStorageKey = "ultimateWerewolfAssistant.savedGame";
const savedGameVersion = 3;
let persistenceDisabled = false;
let saveGameTimer = null;
let lastSavedGameState = null;
let backSavedGameState = null;
let restoringPreviousScreen = false;

// ============================================================
// INITIALIZE APP
// ============================================================

document.addEventListener("DOMContentLoaded", async function () {

    await Promise.all([loadRoles(), loadActions()]);
    loadDesignSettings();

    if (!restoreSavedGame()) {
        drawPlayerScreen();
    }

    startGamePersistence();

});

function serializePlayer(player) {

    return {
        ...player,
        connectedToIndex: players.indexOf(player.connectedTo),
        doppelgangerTargetIndex: players.indexOf(player.doppelgangerTarget),
        lastLeftNeighborIndex: players.indexOf(player.lastLeftNeighbor),
        lastRightNeighborIndex: players.indexOf(player.lastRightNeighbor),
        roleModelIndex: players.indexOf(player.roleModel),
        butcherRedirectTargetIndex: players.indexOf(player.butcherRedirectTarget),
        connectedTo: undefined,
        doppelgangerTarget: undefined,
        lastLeftNeighbor: undefined,
        lastRightNeighbor: undefined,
        roleModel: undefined,
        butcherRedirectTarget: undefined
    };

}

function serializeActionItem(item) {

    return {
        ...item,
        actorIndex: players.indexOf(item.actor),
        actor: undefined
    };

}

function captureFormState() {

    return [...document.querySelectorAll("input, select, textarea")].map((control, index) => ({
        index,
        value: control.value,
        checked: control.checked
    }));

}

function captureScreenHTML() {

    const screenCopy = document.getElementById("screen").cloneNode(true);
    screenCopy.querySelectorAll(".screenBackButton").forEach(button => button.remove());
    return screenCopy.innerHTML;

}

function updateBackButton() {

    const screen = document.getElementById("screen");
    const existingButtons = [...screen.querySelectorAll(".screenBackButton")];

    if (!backSavedGameState || ["players", "roles", "confirmation", "vote", "summaryReview"].includes(currentScreen)) {
        existingButtons.forEach(button => button.remove());
        return;
    }

    const actionButton = [...screen.querySelectorAll("button")].find(button =>
        button.textContent.trim().toLowerCase().startsWith("continue")
    ) || [...screen.querySelectorAll("button")].find(button =>
        /^(Take action|Turn the|Save|Start|Return|Next|Skip)/i.test(button.textContent.trim())
    ) || [...screen.querySelectorAll("button")].at(-1);

    if (!actionButton) {
        existingButtons.forEach(button => button.remove());
        return;
    }

    if (
        existingButtons.length === 1 &&
        existingButtons[0].nextElementSibling === actionButton
    ) {
        return;
    }

    existingButtons.forEach(button => button.remove());
    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "backButton screenBackButton";
    backButton.textContent = "← Back";
    backButton.addEventListener("click", goBackOneScreen);
    actionButton.insertAdjacentElement("beforebegin", backButton);

}

function updateModeratorChrome() {

    const showSetupUtilities = currentScreen === "roles";
    const gameSettingsButton = document.getElementById("gameSettingsButton");
    const savedGamesButton = document.getElementById("savedGamesButton");
    if (gameSettingsButton) gameSettingsButton.hidden = !showSetupUtilities;
    if (savedGamesButton) savedGamesButton.hidden = !showSetupUtilities;

    const phaseHeader = document.getElementById("phaseHeader");
    const inActiveGame = currentNight > 0 && players.some(player => player.role);

    if (phaseHeader) {
        phaseHeader.hidden = !inActiveGame;
        if (inActiveGame) {
            const visibleHeading = document.querySelector("#screen h2")?.textContent || "";
            const isNight = visibleHeading.includes("Night");
            const isDay = !isNight && (currentScreen === "day1" || visibleHeading.includes("Day"));
            const phase = isDay ? `☀️ Day ${currentDay}` : `🌙 Night ${currentNight}`;
            const alive = players.filter(player => player.alive).length;
            const progress = !isDay && nightOneActionOrder.length ?
                ` • Action ${Math.min(nightOneCurrentAction + 1, nightOneActionOrder.length)}/${nightOneActionOrder.length}` :
                isDay ? ` • ${savedVoteCount} of 3 Spare votes` : "";
            phaseHeader.textContent = `${phase}${progress} • ${alive} Alive`;
        }
    }

    document.body.classList.toggle("dayTheme", inActiveGame &&
        !document.querySelector("#screen h2")?.textContent.includes("Night") &&
        document.querySelector("#screen h2")?.textContent.includes("Day"));
    document.body.classList.toggle("nightTheme", inActiveGame && !document.body.classList.contains("dayTheme"));

    document.querySelectorAll("#screen h3").forEach(heading => {
        if (heading.textContent.trim() === "Moderator details") {
            heading.classList.add("moderatorHeading");
            heading.nextElementSibling?.classList.add("moderatorPanel");
        }
    });

    document.querySelectorAll("#screen button").forEach(button => {
        const label = button.textContent.trim();
        if (/^(Continue|Start Day|Start Night|Next)/i.test(label)) {
            button.classList.add("primaryAction");
        }
        if (["Eliminate", "Kick", "Finish Game", "Remove All Players", "Remove All Roles"].some(text => label.includes(text))) {
            button.classList.add("dangerButton");
        }
    });

}

function showAppConfirmation(message, onConfirm) {

    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `
        <div class="appModal" role="dialog" aria-modal="true" aria-labelledby="appModalTitle">
            <h2 id="appModalTitle">Are you sure?</h2>
            <p>${escapeHTML(message)}</p>
            <div class="modalActions">
                <button type="button" data-modal-cancel>Cancel</button>
                <button type="button" class="dangerButton" data-modal-confirm>Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => overlay.remove());
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => {
        overlay.remove();
        onConfirm();
    });
    overlay.querySelector("[data-modal-cancel]").focus();

}

function showAppAlert(message) {

    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `
        <div class="appModal" role="alertdialog" aria-modal="true" aria-labelledby="appAlertTitle">
            <h2 id="appAlertTitle">Moderator note</h2>
            <p>${escapeHTML(message)}</p>
            <div class="modalActions">
                <button type="button" data-modal-ok>OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const okButton = overlay.querySelector("[data-modal-ok]");
    okButton.addEventListener("click", () => overlay.remove());
    okButton.focus();

}

window.alert = showAppAlert;

const roleHelpText = {
    "Alpha Wolf": "A Werewolf who may replace one Werewolf elimination with a conversion once per game.",
    "Beholder": "Privately learns who the Seer is. Optional rules can provide updates when another player becomes the Seer.",
    "Black Wolf": "An elimination-capable Werewolf who also silences one player each night.",
    "Butcher": "Chooses a player on Night 1. If the Werewolves later attack the Butcher, that player is eliminated instead.",
    "Apprentice Seer": "Becomes a Seer when the Seer dies or when no Seer was assigned.",
    "Bodyguard": "Chooses a player each night to protect from the Werewolves. The same player cannot be protected on consecutive nights.",
    "Cupid": "Links two players on the first night. When either lover dies, the other dies from the Cupid connection.",
    "Cursed": "Begins on the Villager team but becomes a Werewolf when attacked by the Werewolves.",
    "Dire Wolf": "Connects themself to one player. If that player dies, the Dire Wolf also dies; the connection does not work in reverse.",
    "Diseased": "If eliminated by the Werewolves, their elimination choice on the following night does not count.",
    "Doppelganger": "Chooses a player and privately checks their role each night. When that player dies, the Doppelganger inherits their role and team.",
    "Drunk": "Appears and behaves as a Villager until receiving the leftover card at the start of Night 3.",
    "Hunter": "When eliminated, chooses one living player to eliminate, or chooses Nobody.",
    "Huntress": "May choose one player to eliminate once per game.",
    "Insomniac": "Learns whether either of the two players currently seated beside them took an action that night.",
    "Lone Wolf": "Acts as a regular Werewolf. If they are the final elimination-capable wolf when their team wins, the Lone Wolf receives the victory announcement.",
    "Lycan": "A Villager who appears to information roles as a Werewolf.",
    "Mad Bomber": "When activated by elimination, also eliminates the two living players currently seated beside them.",
    "Magistrate": "Chooses one player each night who may not be eliminated by the village vote the following day.",
    "Martyr": "Before a Day-vote role is revealed, may privately inherit that role and team. The village sees the Martyr card in its place.",
    "Mason": "A Villager who identifies the other Masons.",
    "Mayor": "A Villager whose vote always counts twice. The moderator tracks the additional vote without revealing the Mayor.",
    "Mentalist": "Compares two selected players and learns whether they are on the same team.",
    "Minion": "Knows the Werewolves and wins with their team, but cannot make the shared Werewolf elimination.",
    "Mystic Seer": "Selects a player and learns that player's exact role.",
    "Old Hag": "Selects a player who must leave the village for the following day.",
    "P.I.": "Checks a player and the players currently seated beside them, learning whether the group contains a Werewolf.",
    "Pacifist": "Always votes to spare the accused player. The moderator accounts for that vote without revealing the Pacifist.",
    "Priest": "Permanently blesses one player against all future Werewolf attacks. Other causes can still eliminate that player.",
    "Prince": "Survives the first successful village vote against them and reveals their role.",
    "Revealer": "May reveal a player's role once per game. A Werewolf-team target is eliminated; an incorrect target eliminates the Revealer.",
    "Seer": "Selects a player and learns whether that player appears as a Werewolf.",
    "Sorceress": "Searches for the Seer and wins with the Werewolf team, but cannot make the shared elimination. An optional rule can identify Werewolves separately from Other.",
    "Sasquatch": "Begins as a Villager and becomes a Werewolf after a Day ends without an elimination.",
    "Shepherd": "The flock absorbs the first Werewolf attack against the Shepherd. Later Werewolf attacks eliminate the Shepherd normally.",
    "Spellcaster": "Silences one player for the following day.",
    "Tough Guy": "A Werewolf attack does not eliminate the Tough Guy until the following Night Update. Other deaths are immediate.",
    "Tracker": "When a currently adjacent player is eliminated by the Werewolves, may inspect one player for a Werewolf result.",
    "Village Idiot": "Always votes to eliminate the accused player. The moderator accounts for that vote without revealing the Village Idiot.",
    "Villager": "Has no night action and wins with the Villager team.",
    "Werewolf": "Wakes with the other elimination-capable Werewolves and chooses a target each night.",
    "Witch": "Once per game, may save an attacked player or eliminate a player.",
    "Wolf Cub": "If eliminated by any cause other than Kick, the Werewolves receive two elimination choices the following night.",
    "Wolf Man": "A Werewolf-team player who appears as a Villager to information roles.",
    "Fruit Brute": "Joins the Werewolf targeting phase. The choice works while another elimination-capable wolf is alive, but has no effect when the Fruit Brute is alone.",
    "Wild Child": "Chooses a role model and may become a Werewolf when that player dies, according to the selected death conditions."
};

function roleWakeDescription(role) {
    if (role.wake === "Every") return "Every night";
    if (String(role.wake) === "1") return "Night 1";
    return role.wake ? String(role.wake) : "Does not wake";
}

function playerAppearsWerewolfToPI(player) {
    if (!player) return false;
    if (player.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToPI;
    if (player.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromPI;
    return player.team === "Werewolf";
}

function roleShownToMysticSeer(player) {
    if (!player) return "Villager";
    if (player.role === "Lycan" && roleRuleSettings.lycanDisguisesRoleFromMysticSeer) {
        return "Werewolf";
    }
    if (player.role === "Wolf Man" && roleRuleSettings.wolfManDisguisesRoleFromMysticSeer) {
        return "Villager";
    }
    return player.role || "Villager";
}

function trackerSeesWerewolf(player) {
    if (!player) return false;
    if (player.role === "Lycan") return roleRuleSettings.trackerCountsLycanAsWolf;
    if (player.role === "Wolf Man") return !roleRuleSettings.trackerHidesWolfMan;
    return player.team === "Werewolf";
}

function getSorceressFinding(player) {
    if (player?.role === "Seer") return "Seer";
    const appearsAs = roles.find(role => role.role === player?.role)?.appearsAs || player?.team || "Villager";
    if (appearsAs === "Werewolf" && roleRuleSettings.sorceressRevealsWerewolf) return "Werewolf";
    return "Other";
}

function wildChildHasConditionalRules() {
    return !(
        roleRuleSettings.wildChildTransformsAfterDayDeath &&
        roleRuleSettings.wildChildTransformsAfterNightDeath &&
        roleRuleSettings.wildChildTransformsAfterKick &&
        roleRuleSettings.wildChildTransformsIfRoleHidden
    );
}

function roleDeathWasAtNight(player) {
    return String(player?.deathPhase || "").startsWith("Night ");
}

function madBomberShouldActivate(player) {
    return roleDeathWasAtNight(player) ?
        roleRuleSettings.madBomberActivatesDuringNight :
        true;
}

function hunterShouldActivate(player) {
    if (roleDeathWasAtNight(player)) {
        return roleRuleSettings.hunterActivatesAtNight;
    }
    return player?.deathCause === "Village vote" || player?.roleRevealed === true;
}

function roleOptionMarkup(roleName) {
    const options = [];
    const fixed = [];
    if (roleName === "Bodyguard") {
        fixed.push("Protects against Werewolf attacks");
        options.push(["bodyguardProtectsWitch", "Protects against the Witch"]);
        options.push(["bodyguardProtectsHuntress", "Protects against the Huntress"]);
        options.push(["werewolfProtectionBlocksAlphaConversion", "Protects against Alpha Wolf conversion"]);
    }
    if (roleName === "Priest") {
        fixed.push("Protects against Werewolf attacks");
        options.push(["werewolfProtectionBlocksAlphaConversion", "Protects against Alpha Wolf conversion"]);
    }
    if (roleName === "Wolf Cub") {
        fixed.push("All revealed and night deaths activate the bonus");
        options.push(["wolfCubKickActivatesBonus", "Kick activates the Wolf Cub bonus"]);
    }
    if (roleName === "Hunter") {
        fixed.push("Activates after a revealed Day elimination");
        options.push(["hunterActivatesAtNight", "Activates after a Night elimination"]);
    }
    if (roleName === "Lycan") {
        fixed.push("Appears as a Werewolf to the Seer");
        options.push(["lycanAppearsWerewolfToPI", "Appears as a Werewolf to the P.I."]);
        options.push(["lycanDisguisesRoleFromMysticSeer", "Appears as a Werewolf to the Mystic Seer"]);
        options.push(["trackerCountsLycanAsWolf", "Appears as a Werewolf to the Tracker"]);
    }
    if (roleName === "Wolf Man") {
        fixed.push("Appears as a Villager to the Seer");
        options.push(["wolfManHiddenFromPI", "Appears as a Villager to the P.I."]);
        options.push(["wolfManDisguisesRoleFromMysticSeer", "Appears as a Villager to the Mystic Seer"]);
        options.push(["trackerHidesWolfMan", "Appears as a Villager to the Tracker"]);
    }
    if (roleName === "Mad Bomber") {
        fixed.push("Always activates when eliminated during the Day");
        options.push(["madBomberActivatesDuringNight", "Activates when eliminated during the Night"]);
    }
    if (roleName === "Sorceress") {
        fixed.push("Identifies the Seer separately from other roles");
        options.push(["sorceressRevealsWerewolf", "Identifies players who appear as Werewolves separately from Other"]);
        options.push(["sorceressCountsForWerewolfParity", "Counts toward Werewolf parity"]);
    }
    if (roleName === "Minion") {
        options.push(["minionCountsForWerewolfParity", "Counts toward Werewolf parity"]);
    }
    if (roleName === "Fruit Brute") {
        options.push(["fruitBruteCountsForWerewolfParity", "Counts toward Werewolf parity"]);
    }
    if (roleName === "Wild Child") {
        options.push(["wildChildTransformsAfterDayDeath", "Turns if the role model dies during the Day"]);
        options.push(["wildChildTransformsAfterNightDeath", "Turns if the role model dies during the Night"]);
        options.push(["wildChildTransformsAfterKick", "Turns if the role model is Kicked"]);
        options.push(["wildChildTransformsIfRoleHidden", "Turns if the role model dies with their role hidden"]);
    }
    if (roleName === "Beholder") {
        fixed.push("Learns the original Seer");
        options.push(["beholderWakesOnFutureNights", "Wakes on future nights when someone has taken the Seer's place"]);
        options.push(["beholderLearnsApprenticeSeer", "Learns when the Apprentice Seer becomes the Seer"]);
        options.push(["beholderLearnsDoppelgangerSeer", "Learns when the Doppelganger becomes the Seer"]);
    }
    if (roleName === "Doppelganger") {
        fixed.push("Inherits the chosen player's role, team, and appearance only after that player dies");
        fixed.push("Does not copy the deceased player's targets, connections, protection, wounds, or used state");
        options.push(["doppelgangerPerformsLateSetup", "Performs inherited first-night setup on the next wake"]);
        options.push(["doppelgangerJoinsNormalWakeSameNight", "Joins the inherited role's normal wake that same night"]);
        options.push(["doppelgangerReceivesFreshOncePerGameAbility", "Receives unused once-per-game abilities"]);
        options.push(["doppelgangerAllowsDireWolfConnection", "May create a new Dire Wolf connection"]);
        options.push(["doppelgangerAllowsCupidPair", "May create a new Cupid pair"]);
        options.push(["doppelgangerAllowsWildChildRoleModel", "May choose a new Wild Child role model"]);
        options.push(["doppelgangerAllowsButcherTarget", "May choose a new Butcher replacement target"]);
        options.push(["doppelgangerGivesShepherdFlock", "Receives a fresh Shepherd flock"]);
        options.push(["doppelgangerReceivesRoleKnowledge", "Receives inherited role knowledge"]);
    }
    if (roleName === "Mentalist") {
        fixed.push("Cannot select themself");
        options.push(["mentalistCannotRepeatPlayers", "Each player may be included in only one comparison per game"]);
    }
    if (!options.length && !fixed.length) return "";
    return `<hr><h3>Role options</h3>
        ${fixed.map(label => `<div class="fixedRule"><span aria-hidden="true">✓</span><span>${escapeHTML(label)}<small>Always on</small></span></div>`).join("")}
        ${options.map(([key, label]) => `
        <label class="ruleToggle">
            <input type="checkbox" ${roleRuleSettings[key] ? "checked" : ""} onchange="setRoleRuleOption('${key}', this.checked); this.nextElementSibling.querySelector('small').textContent = this.checked ? 'On' : 'Off'">
            <span><strong>${escapeHTML(label)}</strong><small>${roleRuleSettings[key] ? "On" : "Off"}</small></span>
        </label>`).join("")}`;
}

function showRoleInfo(index) {
    const role = roles[index];
    if (!role) return;
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="roleInfoTitle">
        <div class="infoModalHeading"><h2 id="roleInfoTitle">${escapeHTML(role.role)}</h2><span class="roleValue">${Number(role.value) >= 0 ? "+" : ""}${Number(role.value) || 0}</span></div>
        <p>${escapeHTML(roleHelpText[role.role] || role.question || "No additional role description is available.")}</p>
        <dl class="roleFacts">
            <div><dt>Team</dt><dd>${escapeHTML(role.team || "Unknown")}</dd></div>
            <div><dt>Appears as</dt><dd>${escapeHTML(role.appearsAs || role.team || "Unknown")}</dd></div>
            <div><dt>Wakes</dt><dd>${escapeHTML(roleWakeDescription(role))}</dd></div>
            <div><dt>Ability</dt><dd>${escapeHTML(role.action === "N/A" ? "Passive role" : role.action || "None")}</dd></div>
        </dl>
        ${role.oncePerGame ? '<p class="infoCallout">This ability may be used once per game.</p>' : ""}
        ${roleOptionMarkup(role.role)}
        <div class="modalActions"><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", () => overlay.remove());
    close.focus();
}

function setRoleRuleOption(key, enabled) {
    if (!(key in defaultRoleRuleSettings)) return;
    roleRuleSettings[key] = enabled === true;
    scheduleGameSave();
}

function showGameGuide() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal gameGuideModal" role="dialog" aria-modal="true" aria-labelledby="gameGuideTitle">
        <h2 id="gameGuideTitle">How the Game Works</h2>
        <p>The moderator follows the assistant through alternating Night and Day phases while keeping hidden information from the village.</p>
        <h3>Role facts</h3>
        <dl class="guideDefinitions">
            <dt>Team</dt><dd>The side a player wins with. A role can appear differently from its actual team.</dd>
            <dt>Appears as</dt><dd>What information roles detect. For example, the Lycan is a Villager who appears as a Werewolf.</dd>
            <dt>Wake timing</dt><dd>When the moderator calls the role during the night. Passive roles may still receive theatrical wake instructions to protect secrecy.</dd>
            <dt>Value</dt><dd>A balancing estimate. Positive values generally help Villagers; negative values generally help Werewolves.</dd>
            <dt>Once per game</dt><dd>The player is still called after using the ability, but no further action is recorded.</dd>
        </dl>
        <h3>House-rule options</h3>
        <p>Some role cards contain independent on/off switches for disputed or group-specific interactions. Fixed rules are marked “Always on.” Changing a switch affects game resolution and is saved with the current game.</p>
        <div class="modalActions"><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", () => overlay.remove());
    close.focus();
}

function settingToggle(key, label, description) {
    return `<label class="ruleToggle">
        <input type="checkbox" ${gameSettings[key] ? "checked" : ""} onchange="setGameSetting('${key}', this.checked); this.nextElementSibling.querySelector('small').textContent = this.checked ? 'On' : 'Off'">
        <span><strong>${escapeHTML(label)}</strong><small>${gameSettings[key] ? "On" : "Off"}</small><em>${escapeHTML(description)}</em></span>
    </label>`;
}

function showGameSettings() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="gameSettingsTitle">
        <h2 id="gameSettingsTitle">Game Settings</h2>
        <p>These options change core moderator and game behavior.</p>
        ${settingToggle("revealNightRoles", "Reveal roles eliminated at Night", "Day-vote roles are always revealed. Turn this on to reveal Night eliminations too.")}
        ${settingToggle("showModeratorDetails", "Show Moderator details", "Displays the private explanation of protections, conversions, and other results.")}
        ${settingToggle("confirmKick", "Confirm before Kick", "Requires an extra confirmation before removing a player without revealing their role.")}
        ${settingToggle("werewolfEliminationOnFirstNight", "Allow a Werewolf elimination on Night 1", "Also activates Bodyguard, Alpha Wolf, Witch, and other Night 1 attack-dependent actions.")}
        <div class="modalActions"><button type="button" onclick="resetGameSettings(); showGameSettings()">Restore Defaults</button><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", () => overlay.remove());
    close.focus();
}

function setGameSetting(key, enabled) {
    if (!(key in defaultGameSettings)) return;
    gameSettings[key] = enabled === true;
    scheduleGameSave();
}

function resetGameSettings() {
    gameSettings = { ...defaultGameSettings };
    scheduleGameSave();
}

function showDesignSettings() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    const themes = [
        ["classic", "Classic", "Dark blue to blood red"],
        ["moonlight", "Moonlight", "Deep blue and silver"],
        ["ember", "Ember", "Charcoal and warm red"]
    ];
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="designSettingsTitle">
        <h2 id="designSettingsTitle">Design</h2>
        <h3>Color theme</h3>
        <div class="themeChoices">${themes.map(([key, label, description]) => `
            <button type="button" class="themeChoice ${designSettings.theme === key ? "selected" : ""}" onclick="setDesignSetting('theme', '${key}'); showDesignSettings()">
                <span class="themeSwatch ${key}"></span><strong>${label}</strong><small>${description}</small>
            </button>`).join("")}</div>
        <h3>Display</h3>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.largeText ? "checked" : ""} onchange="setDesignSetting('largeText', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Larger text</strong><small>${designSettings.largeText ? "On" : "Off"}</small></span></label>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.compactRows ? "checked" : ""} onchange="setDesignSetting('compactRows', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Compact player and role rows</strong><small>${designSettings.compactRows ? "On" : "Off"}</small></span></label>
        <div class="modalActions"><button type="button" onclick="resetDesignSettings(); showDesignSettings()">Reset</button><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", () => overlay.remove());
    close.focus();
}

function setDesignSetting(key, value) {
    if (!(key in defaultDesignSettings)) return;
    designSettings[key] = value;
    localStorage.setItem(designStorageKey, JSON.stringify(designSettings));
    applyDesignSettings();
}

function resetDesignSettings() {
    designSettings = { ...defaultDesignSettings };
    localStorage.setItem(designStorageKey, JSON.stringify(designSettings));
    applyDesignSettings();
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

function getSavedSetups() {
    try {
        const saved = JSON.parse(localStorage.getItem(savedSetupsStorageKey));
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function writeSavedSetups(setups) {
    localStorage.setItem(savedSetupsStorageKey, JSON.stringify(setups));
}

function encodeSavedSetupName(name) {
    return encodeURIComponent(name).replace(/'/g, "%27");
}

function promptToSaveGameSetup() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal" role="dialog" aria-modal="true" aria-labelledby="saveSetupTitle">
        <h2 id="saveSetupTitle">Save Game Setup</h2>
        <p>Enter a name for this role setup. Player names will not be saved.</p>
        <input id="savedSetupName" type="text" maxlength="60" placeholder="Game name" aria-label="Game name">
        <div class="modalActions"><button type="button" data-modal-cancel>Cancel</button><button type="button" onclick="saveNamedGameSetup()">Save Game</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => overlay.remove());
    const input = overlay.querySelector("#savedSetupName");
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") saveNamedGameSetup();
    });
    input.focus();
}

function saveNamedGameSetup() {
    const input = document.getElementById("savedSetupName");
    const name = input?.value.trim();
    if (!name) {
        alert("Please enter a game name.");
        return;
    }
    const setup = {
        name,
        minimumPlayers: players.length,
        roleCounts: Object.fromEntries(
            roles.filter(role => Number(role.count) > 0).map(role => [role.role, Number(role.count)])
        ),
        savedAt: Date.now()
    };
    const setups = getSavedSetups();
    const existingIndex = setups.findIndex(saved => saved.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) setups[existingIndex] = setup;
    else setups.push(setup);
    writeSavedSetups(setups);
    document.querySelector(".appModalOverlay")?.remove();
    showAppAlert(`Saved “${name}” for a minimum of ${players.length} players.`);
}

function showSavedGames() {
    document.querySelector(".appModalOverlay")?.remove();
    const setups = getSavedSetups().sort((a, b) => a.name.localeCompare(b.name));
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="savedGamesTitle">
        <h2 id="savedGamesTitle">Saved Games</h2>
        <p>Load a role setup without changing the current player names.</p>
        <div class="savedSetupList">${setups.length ? setups.map(setup => `
            <div class="savedSetupRow">
                <span><strong>${escapeHTML(setup.name)}</strong><small>Minimum ${Number(setup.minimumPlayers) || 0} players</small></span>
                <span><button type="button" onclick="loadSavedGameSetup('${encodeSavedSetupName(setup.name)}')">Load</button><button type="button" class="dangerButton" onclick="deleteSavedGameSetup('${encodeSavedSetupName(setup.name)}')">Delete</button></span>
            </div>`).join("") : "<p>No game setups have been saved yet.</p>"}</div>
        <div class="modalActions"><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", () => overlay.remove());
    close.focus();
}

function loadSavedGameSetup(encodedName) {
    const name = decodeURIComponent(encodedName);
    const setup = getSavedSetups().find(saved => saved.name === name);
    if (!setup) return;
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: (Number(setup.roleCounts?.[role.role]) || 0) +
            (role.role === "Sorceress" ? (Number(setup.roleCounts?.Sorcerer) || 0) : 0)
    }));
    const additionalPlayers = Math.max(0, players.length - (Number(setup.minimumPlayers) || 0));
    const villager = roles.find(role => role.role === "Villager");
    if (villager) villager.count += additionalPlayers;
    document.querySelector(".appModalOverlay")?.remove();
    drawRoleScreen();
    if (players.length < Number(setup.minimumPlayers)) {
        showAppAlert(`${name} requires at least ${setup.minimumPlayers} players. Add ${setup.minimumPlayers - players.length} more player${setup.minimumPlayers - players.length === 1 ? "" : "s"}.`);
    }
}

function deleteSavedGameSetup(encodedName) {
    const name = decodeURIComponent(encodedName);
    showAppConfirmation(`Delete the saved game “${name}”?`, () => {
        writeSavedSetups(getSavedSetups().filter(saved => saved.name !== name));
        showSavedGames();
    });
}

function buildGameState() {

    return {
        currentScreen,
        players: players.map(serializePlayer),
        roles,
        nightOneWakeOrder,
        nightOneCurrentRole,
        nightOneActionOrder: nightOneActionOrder.map(serializeActionItem),
        nightOneCurrentAction,
        nightOneActionMode,
        isLaterNight,
        savedVoteCount,
        wolvesDisabledNextNight,
        wolvesDisabledTonight,
        wolfEliminationsTonight,
        currentNight,
        currentDay,
        leftoverCardRole,
        resumeMorningAfterSpecialResolution,
        roleSearchTerm,
        eliminationSequence,
        roleSortMode,
        roleTeamFilter,
        roleSelectedOnly,
        ignoreWinConditions,
        gameResultContinuation,
        phaseHistory,
        dayEliminationVoteOccurred,
        roleRuleSettings,
        gameSettings,
        screenHTML: captureScreenHTML(),
        formState: captureFormState()
    };

}

function saveGameState() {

    if (persistenceDisabled) {
        localStorage.removeItem(savedGameStorageKey);
        return;
    }

    const screen = document.getElementById("screen");

    if (!screen) {
        return;
    }

    const state = buildGameState();

    lastSavedGameState = state;
    updateBackButton();
    updateModeratorChrome();

    try {
        localStorage.setItem(savedGameStorageKey, JSON.stringify({
            saveVersion: savedGameVersion,
            current: state,
            back: backSavedGameState
        }));
    } catch (error) {
        console.error("Could not save the current game:", error);
    }

}

function scheduleGameSave() {

    clearTimeout(saveGameTimer);
    saveGameTimer = setTimeout(saveGameState, 0);

}

function restoreSavedGame() {

    let savedData;

    try {
        savedData = JSON.parse(localStorage.getItem(savedGameStorageKey));
    } catch (error) {
        console.error("Could not restore the saved game:", error);
        localStorage.removeItem(savedGameStorageKey);
        return false;
    }

    if (savedData?.saveVersion && savedData.saveVersion > savedGameVersion) {
        localStorage.removeItem(savedGameStorageKey);
        return false;
    }

    const state = savedData?.current || savedData;

    if (!state || !Array.isArray(state.players) || typeof state.screenHTML !== "string") {
        return false;
    }

    lastSavedGameState = state;
    backSavedGameState = savedData?.current ? savedData.back || null : null;

    players = state.players.map(savedPlayer => {
        const restoredPlayer = { ...savedPlayer };
        delete restoredPlayer.connectedToIndex;
        delete restoredPlayer.doppelgangerTargetIndex;
        delete restoredPlayer.lastLeftNeighborIndex;
        delete restoredPlayer.lastRightNeighborIndex;
        delete restoredPlayer.roleModelIndex;
        delete restoredPlayer.butcherRedirectTargetIndex;
        return restoredPlayer;
    });
    state.players.forEach((savedPlayer, index) => {
        players[index].connectedTo = players[savedPlayer.connectedToIndex] || null;
        players[index].doppelgangerTarget = players[savedPlayer.doppelgangerTargetIndex] || null;
        players[index].lastLeftNeighbor = players[savedPlayer.lastLeftNeighborIndex] || null;
        players[index].lastRightNeighbor = players[savedPlayer.lastRightNeighborIndex] || null;
        players[index].roleModel = players[savedPlayer.roleModelIndex] || null;
        players[index].butcherRedirectTarget = players[savedPlayer.butcherRedirectTargetIndex] || null;
    });

    const savedRoleCounts = new Map(
        (Array.isArray(state.roles) ? state.roles : []).map(role => [role.role, Number(role.count) || 0])
    );
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: (savedRoleCounts.get(role.role) || 0) +
            (role.role === "Sorceress" ? (savedRoleCounts.get("Sorcerer") || 0) : 0)
    }));
    currentScreen = state.currentScreen || "players";
    nightOneWakeOrder = state.nightOneWakeOrder || [];
    nightOneCurrentRole = Number(state.nightOneCurrentRole) || 0;
    nightOneActionOrder = (state.nightOneActionOrder || []).map(item => ({
        ...item,
        actor: players[item.actorIndex]
    }));
    nightOneCurrentAction = Number(state.nightOneCurrentAction) || 0;
    nightOneActionMode = state.nightOneActionMode ?? null;
    isLaterNight = state.isLaterNight === true;
    savedVoteCount = Number(state.savedVoteCount) || 0;
    wolvesDisabledNextNight = state.wolvesDisabledNextNight === true;
    wolvesDisabledTonight = state.wolvesDisabledTonight === true;
    wolfEliminationsTonight = Number(state.wolfEliminationsTonight) || 1;
    currentNight = Number(state.currentNight) || 1;
    currentDay = Number(state.currentDay) || 0;
    leftoverCardRole = state.leftoverCardRole || null;
    resumeMorningAfterSpecialResolution = state.resumeMorningAfterSpecialResolution === true;
    roleSearchTerm = state.roleSearchTerm || "";
    eliminationSequence = Number(state.eliminationSequence) || 0;
    roleSortMode = state.roleSortMode || "alphabetical-asc";
    roleTeamFilter = state.roleTeamFilter || "all";
    roleSelectedOnly = state.roleSelectedOnly === true;
    ignoreWinConditions = state.ignoreWinConditions === true;
    gameResultContinuation = state.gameResultContinuation || null;
    phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
    sanitizePhaseHistory();
    dayEliminationVoteOccurred = state.dayEliminationVoteOccurred === true;
    roleRuleSettings = {
        ...defaultRoleRuleSettings,
        ...(state.roleRuleSettings || {})
    };
    gameSettings = {
        ...defaultGameSettings,
        ...(state.gameSettings || {})
    };

    if (currentScreen === "roles") {
        drawRoleScreen();
    } else {
        document.getElementById("screen").innerHTML = state.screenHTML;
    }
    (currentScreen === "roles" ? [] : (state.formState || [])).forEach(savedControl => {
        const control = document.querySelectorAll("input, select, textarea")[savedControl.index];
        if (control) {
            control.value = savedControl.value;
            control.checked = savedControl.checked;
        }
    });

    const playerNameInput = document.getElementById("playerName");
    if (playerNameInput) {
        playerNameInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addPlayer();
            }
        });
    }

    updateBackButton();

    return true;

}

function goBackOneScreen() {

    if (!backSavedGameState) {
        return;
    }

    showAppConfirmation(
        "The last action will be undone and must be performed again.",
        restorePreviousScreen
    );

}

function restorePreviousScreen() {

    const stateToRestore = backSavedGameState;
    if (!stateToRestore) {
        return;
    }
    backSavedGameState = null;

    try {
        restoringPreviousScreen = true;
        clearTimeout(saveGameTimer);
        localStorage.setItem(savedGameStorageKey, JSON.stringify({
            saveVersion: savedGameVersion,
            current: stateToRestore,
            back: null
        }));
        window.location.reload();
    } catch (error) {
        restoringPreviousScreen = false;
        console.error("Could not return to the previous screen:", error);
    }

}

function startGamePersistence() {

    const screen = document.getElementById("screen");
    const observer = new MutationObserver(() => {
        updateModeratorChrome();
        scheduleGameSave();
    });
    observer.observe(screen, { childList: true, subtree: true, characterData: true });
    screen.addEventListener("input", scheduleGameSave);
    screen.addEventListener("change", scheduleGameSave);
    screen.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (
            !button ||
            button.classList.contains("screenBackButton") ||
            button.disabled ||
            ["Vote", "Cancel Vote"].includes(button.textContent.trim())
        ) {
            return;
        }

        backSavedGameState = buildGameState();
        updateBackButton();
    }, true);
    window.addEventListener("beforeunload", () => {
        if (!restoringPreviousScreen) {
            saveGameState();
        }
    });
    scheduleGameSave();

}


// ============================================================
// LOAD ROLE DATABASE
// ============================================================

async function loadRoles() {

    try {

        const response = await fetch("Data/roles.json");

        if (!response.ok) {
            throw new Error(
                `Could not load Data/roles.json (${response.status})`
            );
        }

        roles = await response.json();

        roles.forEach(role => {
            role.count = 0;
        });
        originalRoleDefinitions = roles.map(role => ({ ...role }));

    } catch (error) {

        console.error("Could not load roles.json:", error);

        roles = [];

    }

}


// ============================================================
// PLAYER SCREEN
// ============================================================

function drawPlayerScreen() {

    currentScreen = "players";

    const screen = document.getElementById("screen");

    if (!screen) {
        return;
    }

    let html = `
        <h2>Players</h2>
    `;


    // ========================================================
    // EXISTING PLAYERS
    // ========================================================

    players.forEach((player, index) => {

        html += `

            <div class="playerRow">

                <span>
                    ${escapeHTML(player.name)}
                </span>

                <button
                    type="button"
                    onclick="removePlayer(${index})"
                >
                    ❌
                </button>

            </div>

        `;

    });


    // ========================================================
    // ADD PLAYER
    // ========================================================

    html += `

        <div style="margin-top:20px;">

            <input
                id="playerName"
                type="text"
                placeholder="Player Name"
                autocomplete="off"
            >

        </div>

        <div style="margin-top:10px;">

            <button
                type="button"
                onclick="addPlayer()"
            >
                ➕ Add Player
            </button>

            <button
                type="button"
                onclick="drawRoleScreen()"
            >
                Next ➜
            </button>

        </div>

        ${players.length ? `
            <div style="margin-top:18px;">
                <button type="button" onclick="removeAllPlayers()">Remove All Players</button>
            </div>
        ` : ""}

    `;


    screen.innerHTML = html;


    // ========================================================
    // ENTER KEY
    // ========================================================

    const input = document.getElementById("playerName");

    if (input) {

        input.focus();

        input.addEventListener("keydown", function (event) {

            if (event.key === "Enter") {

                event.preventDefault();

                addPlayer();

            }

        });

    }

}


// ============================================================
// ADD PLAYER
// ============================================================

function addPlayer() {

    const input = document.getElementById("playerName");

    if (!input) {
        return;
    }

    const name = input.value.trim();

    if (name === "") {

        input.focus();

        return;

    }


    players.push({

        id: Date.now() + Math.random(),

        name: name,

        role: null,

        alive: true,

        connectedTo: null

    });


    drawPlayerScreen();

}


// ============================================================
// REMOVE PLAYER
// ============================================================

function removePlayer(index) {

    if (
        index < 0 ||
        index >= players.length
    ) {
        return;
    }

    players.splice(index, 1);

    drawPlayerScreen();

}

function removeAllPlayers() {

    if (!players.length) {
        return;
    }
    showAppConfirmation("Remove every player from the list?", () => {
        players = [];
        drawPlayerScreen();
    });

}


// ============================================================
// ROLE SCREEN
// ============================================================

function drawRoleScreen() {

    currentScreen = "roles";

    let html = `
        <h2>Roles in Game</h2>
        <div class="roleToolbar">
            <input
                id="roleSearch"
                class="roleSearch"
                type="search"
                placeholder="Search roles"
                aria-label="Search roles"
                value="${escapeHTML(roleSearchTerm)}"
                oninput="filterRoleList(this.value)"
            >
            <select aria-label="Sort roles" onchange="setRoleSortMode(this.value)">
                <option value="alphabetical-asc" ${roleSortMode === "alphabetical-asc" ? "selected" : ""}>A–Z</option>
                <option value="alphabetical-desc" ${roleSortMode === "alphabetical-desc" ? "selected" : ""}>Z–A</option>
                <option value="value-asc" ${roleSortMode === "value-asc" ? "selected" : ""}>Value: Low–High</option>
                <option value="value-desc" ${roleSortMode === "value-desc" ? "selected" : ""}>Value: High–Low</option>
            </select>
        </div>
        <div class="roleFilterToolbar">
            <select aria-label="Filter by team" onchange="setRoleTeamFilter(this.value)">
                <option value="all" ${roleTeamFilter === "all" ? "selected" : ""}>All teams</option>
                <option value="Villager" ${roleTeamFilter === "Villager" ? "selected" : ""}>Villager team</option>
                <option value="Werewolf" ${roleTeamFilter === "Werewolf" ? "selected" : ""}>Werewolf team</option>
            </select>
            <label class="selectedRoleFilter"><input type="checkbox" ${roleSelectedOnly ? "checked" : ""} onchange="setRoleSelectedOnly(this.checked)"> Selected only</label>
        </div>
        <p id="noRoleSearchResults" style="display:none;">No matching roles found.</p>
    `;


    if (roles.length === 0) {

        html += `

            <p>
                No roles were loaded.
            </p>

            <button
                type="button"
                onclick="drawPlayerScreen()"
            >
                ⬅ Back
            </button>

        `;

        document.getElementById("screen").innerHTML = html;

        return;

    }


    roles
        .map((role, index) => ({ role, index }))
        .sort(compareRoleEntries)
        .forEach(({ role, index }) => {

        html += `

            <div class="playerRow roleOption" data-role-name="${escapeHTML(role.role.toLowerCase())}" data-role-team="${escapeHTML(role.team)}" data-role-wake="${escapeHTML(String(role.wake))}" data-role-selected="${Number(role.count) > 0 ? "true" : "false"}">

                <span>
                    ${escapeHTML(role.role)}
                    <span class="roleValue">${Number(role.value) >= 0 ? "+" : ""}${Number(role.value) || 0}</span>
                    <button class="roleInfoButton" type="button" aria-label="Information about ${escapeHTML(role.role)}" onclick="showRoleInfo(${index})">i</button>
                </span>

                <div>

                    <button
                        type="button"
                        onclick="changeRole(${index}, -1)"
                    >
                        -
                    </button>

                    <strong style="padding:0 10px;">
                        ${role.count}
                    </strong>

                    <button
                        type="button"
                        onclick="changeRole(${index}, 1)"
                    >
                        +
                    </button>

                </div>

            </div>

        `;

    });


    const cards = getTotalCards();
    const requiredCards = getRequiredCardCount();
    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );

    const balance = getBalance();


    html += `

        <hr>

        <h3>
            Players: ${players.length}
        </h3>

        <h3>
            Cards Selected:
            ${cards}
            ${cards === requiredCards ? "✅" : "❌"}
        </h3>

        <h3>
            Balance: ${balance}
        </h3>

        ${drunkIsSelected ? `
            <p style="color:${cards === requiredCards ? "#8fda8f" : "#ff8f8f"}; font-size:.9rem;">
                ${cards === requiredCards ?
                    "Drunk is in play. The extra card has been selected." :
                    "Drunk is in play. Select one extra card."}
            </p>
        ` : ""}

        <br>

        <button type="button" onclick="removeAllRoles()">
            Remove All Roles
        </button>

        <button
            type="button"
            onclick="drawPlayerScreen()"
        >
            ⬅ Back
        </button>

        <button
            type="button"
            onclick="drawGameConfirmation()"
            ${cards !== requiredCards ? "disabled" : ""}
        >
            Next ➜
        </button>

    `;


    document.getElementById("screen").innerHTML = html;
    filterRoleList(roleSearchTerm);

}

function compareRoleEntries(first, second) {

    const alphabeticalComparison = first.role.role.localeCompare(
        second.role.role,
        undefined,
        { sensitivity: "base" }
    );

    if (roleSortMode === "alphabetical-desc") {
        return -alphabeticalComparison;
    }

    if (roleSortMode === "value-asc") {
        return Number(first.role.value) - Number(second.role.value) || alphabeticalComparison;
    }

    if (roleSortMode === "value-desc") {
        return Number(second.role.value) - Number(first.role.value) || alphabeticalComparison;
    }

    return alphabeticalComparison;

}

function setRoleSortMode(sortMode) {

    const validModes = [
        "alphabetical-asc",
        "alphabetical-desc",
        "value-asc",
        "value-desc"
    ];

    roleSortMode = validModes.includes(sortMode) ? sortMode : "alphabetical-asc";
    drawRoleScreen();

}


// ============================================================
// CHANGE ROLE
// ============================================================

function changeRole(index, amount) {

    if (!roles[index]) {
        return;
    }

    roles[index].count += amount;

    const canHaveMultiple = ["Villager", "Mason", "Werewolf"].includes(
        roles[index].role
    );

    if (!canHaveMultiple && roles[index].count > 1) {
        roles[index].count = 1;
    }

    if (roles[index].count < 0) {
        roles[index].count = 0;
    }

    drawRoleScreen();

}


// ============================================================
// TOTAL CARDS
// ============================================================

function getTotalCards() {

    let total = 0;

    roles.forEach(role => {

        total += Number(role.count) || 0;

    });

    return total;

}


// ============================================================
// BALANCE
// ============================================================

function getBalance() {

    let total = 0;

    roles.forEach(role => {

        total +=
            (Number(role.value) || 0) *
            (Number(role.count) || 0);

    });

    return total;

}


// ============================================================
// GAME CONFIRMATION
// ============================================================

function drawGameConfirmation() {

    currentScreen = "confirmation";

    const totalCards = getTotalCards();
    const requiredCards = getRequiredCardCount();

    const totalValue = getBalance();
    const automaticWinMessage = getPossibleSetupAutomaticWin();
    const setupWarnings = [];
    const selectedRoles = roles.filter(role => Number(role.count) > 0);
    const hasEliminationWolf = selectedRoles.some(role =>
        role.team === "Werewolf" && !["Minion", "Sorceress"].includes(role.role)
    );
    if (!hasEliminationWolf) {
        setupWarnings.push("No elimination-capable Werewolf is selected.");
    }
    if (Math.abs(totalValue) >= 10) {
        setupWarnings.push(`The card-value balance is ${totalValue}, so this setup may strongly favor one team.`);
    }
    if (selectedRoles.some(role => role.role === "Drunk") && totalCards !== players.length + 1) {
        setupWarnings.push("The Drunk requires one extra role card.");
    }
    const setupWarningHTML = setupWarnings.length ? `
        <div class="setupWarnings">
            <h3>Setup notes</h3>
            <ul>${setupWarnings.map(warning => `<li>${escapeHTML(warning)}</li>`).join("")}</ul>
        </div>
    ` : "";


    // ========================================================
    // COUNT TEAMS
    // ========================================================

    const teams = {};

    roles.forEach(role => {

        if (role.count > 0) {

            const team = role.team || "Unknown";

            if (!teams[team]) {
                teams[team] = 0;
            }

            teams[team] += role.count;

        }

    });


    // ========================================================
    // TEAM HTML
    // ========================================================

    let teamHTML = "";

    Object.entries(teams).forEach(([team, count]) => {

        teamHTML += `

            <div class="playerRow">

                <span>
                    ${escapeHTML(team)}
                </span>

                <strong>
                    ${count}
                </strong>

            </div>

        `;

    });


    // ========================================================
    // ROLE HTML
    // ========================================================

    let roleHTML = "";

    roles.forEach(role => {

        if (role.count > 0) {

            roleHTML += `

                <div class="playerRow">

                    <span>
                        ${escapeHTML(role.role)}
                    </span>

                    <strong>
                        × ${role.count}
                    </strong>

                </div>

            `;

        }

    });


    // ========================================================
    // CONFIRMATION SCREEN
    // ========================================================

    document.getElementById("screen").innerHTML = `

        <h2>Confirm Game</h2>

        <p>
            Review the game before starting.
        </p>

        <hr>

        <h3>Game Summary</h3>

        <div class="playerRow">
            <span>Players</span>
            <strong>${players.length}</strong>
        </div>

        <div class="playerRow">
            <span>Cards Selected</span>
            <strong>
                ${totalCards} / ${requiredCards}
            </strong>
        </div>

        <div class="playerRow">
            <span>Total Value</span>
            <strong>${totalValue}</strong>
        </div>

        <hr>

        <h3>Teams</h3>

        ${teamHTML}

        <hr>

        <h3>Roles</h3>

        ${roleHTML}

        ${automaticWinMessage ? `<p style="color:#ff9b9b;">${escapeHTML(automaticWinMessage)}</p>` : ""}
        ${setupWarningHTML}

        <hr>

        <button
            type="button"
            onclick="drawRoleScreen()"
        >
            ⬅ Back
        </button>

        <button
            type="button"
            onclick="startNightOne()"
            ${totalCards !== requiredCards || automaticWinMessage ? "disabled" : ""}
        >
            🌙 Start Night 1
        </button>

    `;

}

// ============================================================
// NIGHT ONE - SETUP
// ============================================================

function startNightOne() {

    isLaterNight = false;
    currentNight = 1;
    currentDay = 0;
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;

    const totalCards = getTotalCards();
    const requiredCards = getRequiredCardCount();

    if (totalCards !== requiredCards) {

        alert(
            `Select exactly ${requiredCards} cards for ${players.length} players.`
        );

        return;

    }


    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );

    if (drunkIsSelected && !leftoverCardRole) {
        drawLeftoverCardSelection();
        return;
    }

    // ========================================================
    // CREATE NIGHT ONE WAKE ORDER
    // ========================================================
    //
    // Night 1:
    // Wake every selected role EXCEPT Villager.
    //
    // Priority determines the order.
    //
    // After each role is identified, that role completes its
    // night action before the next role wakes up.
    // ========================================================

    nightOneWakeOrder = roles

        .map(role => ({
            ...role,
            count: Number(role.count) - (leftoverCardRole?.role === role.role ? 1 : 0)
        }))

        .filter(role => role.count > 0)

        .filter(role =>
            String(role.role).toLowerCase() !== "villager"
        )

        .sort((a, b) =>
            Number(a.priority) - Number(b.priority)
        );

    if (leftoverCardRole && leftoverCardRole.role !== "Villager") {
        nightOneWakeOrder.push({
            ...leftoverCardRole,
            count: 0,
            mockLeftoverAction: true
        });
        nightOneWakeOrder.sort((a, b) => Number(a.priority) - Number(b.priority));
    }


    // ========================================================
    // START AT FIRST ROLE
    // ========================================================

    nightOneCurrentRole = 0;


    // ========================================================
    // SHOW FIRST ROLE
    // ========================================================

    drawNightRole();

}

function removeAllRoles() {

    if (!roles.some(role => Number(role.count) > 0)) {
        return;
    }
    showAppConfirmation("Set every selected role card to zero?", () => {
        roles.forEach(role => {
            role.count = 0;
        });
        drawRoleScreen();
    });

}

function drawLeftoverCardSelection() {

    const options = roles
        .filter(role => role.role !== "Drunk" && Number(role.count) > 0)
        .map(role => `<option value="${escapeHTML(role.role)}">${escapeHTML(role.role)}</option>`)
        .join("");

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night 1</h2>
        <h2>Leftover Card</h2>
        <p>Which role card was left over after dealing?</p>
        <select id="leftoverCardRole">
            <option value="">Select the leftover card</option>
            ${options}
        </select>
        <button class="actionContinue" type="button" onclick="confirmLeftoverCard()">Continue ➜</button>
    `;

}

function confirmLeftoverCard() {

    const select = document.getElementById("leftoverCardRole");
    const selectedRole = roles.find(role => role.role === select?.value);

    if (!selectedRole || selectedRole.role === "Drunk" || Number(selectedRole.count) < 1) {
        alert("Please select the leftover role card.");
        return;
    }

    const automaticWinMessage = getSetupAutomaticWin(selectedRole.role);
    if (automaticWinMessage) {
        alert(automaticWinMessage);
        drawRoleScreen();
        return;
    }

    leftoverCardRole = selectedRole;
    startNightOne();

}

// ============================================================
// DRAW CURRENT NIGHT ROLE
// ============================================================

function drawNightRole() {

    // ========================================================
    // NIGHT IS FINISHED
    // ========================================================

    if (
        nightOneCurrentRole >=
        nightOneWakeOrder.length
    ) {

        // ====================================================
        // EVERY PLAYER WHO WAS NOT IDENTIFIED AS ANOTHER ROLE
        // IS A VILLAGER
        // ====================================================

        players.forEach(player => {

            if (!player.role) {

                player.role = "Villager";

                player.team = "Villager";

            }

        });


        drawDayOne();

        return;

    }


    const role =
        nightOneWakeOrder[nightOneCurrentRole];


    if (!role) {

        console.error(
            "No role found for current Night 1 position.",
            {
                currentRole: nightOneCurrentRole,
                wakeOrder: nightOneWakeOrder
            }
        );

        return;

    }

    if (role.mockLeftoverAction) {
        document.getElementById("screen").innerHTML = `
            <h2>🌙 Night ${currentNight}</h2>
            <hr>
            <h2>${readAloud(`${moderatorRoleName(role.role)}, wake up.`)}</h2>
            ${role.question === "N/A" ? "" : `<p>${readAloud(role.question)}</p>`}
            <button type="button" onclick="advanceNightRole()">Go to Sleep</button>
        `;
        return;
    }


    // ========================================================
    // ROLE IDENTIFICATION SCREEN
    // ========================================================

    let html = `

        <h2>🌙 Night ${currentNight}</h2>

        <hr>

        <h2>
            ${readAloud(`${moderatorRoleName(role.role)}, wake up.`)}
        </h2>

        <p>
            Who is the ${escapeHTML(role.role)}?
        </p>

    `;


    // ========================================================
    // AVAILABLE PLAYERS
    // ========================================================

    const availablePlayers =
        players.filter(player => !player.role);


    // ========================================================
    // SINGLE ROLE
    // ========================================================

    if (role.count === 1) {

        html += `

            <select id="nightPlayerSelect">

                <option value="">
                    Select Player
                </option>

        `;


        availablePlayers.forEach(player => {

            const playerIndex =
                players.indexOf(player);


            html += `

                <option value="${playerIndex}">
                    ${escapeHTML(player.name)}
                </option>

            `;

        });


        html += `

            </select>

        `;

    }


    // ========================================================
    // MULTIPLE COPIES OF ROLE
    // ========================================================

    else {

        html += `

            <p>
                Select all ${role.count}
                ${escapeHTML(role.role)}s.
            </p>

        `;


        availablePlayers.forEach(player => {

            const playerIndex =
                players.indexOf(player);


            html += `

                <label
                    style="
                        display:block;
                        margin:8px 0;
                    "
                >

                    <input
                        type="checkbox"
                        name="nightPlayer"
                        value="${playerIndex}"
                    >

                    ${escapeHTML(player.name)}

                </label>

            `;

        });

    }


    // ========================================================
    // NEXT
    // ========================================================

    const roleSleepsAfterIdentification = !hasNightOneAction(role);

    html += `

        <hr>

        ${roleSleepsAfterIdentification ? `<p>${readAloud(`${moderatorRoleName(role.role)}, go to sleep.`)}</p><hr>` : ""}

        <button
            type="button"
            onclick="confirmNightRole()"
        >
            Next ➜
        </button>

    `;


    document.getElementById("screen").innerHTML = html;

}

// ============================================================
// NIGHT ONE - ACTIONS
// ============================================================

function hasNightOneAction(role) {

    const passiveActions = [
        "DelayDeath",
        "RevengeKill",
        "ChangeRole",
        "DisableWolves",
        "Explosion",
        "Prince",
        "ShepherdFlock"
    ];

    return !!role &&
        role.action !== "N/A" &&
        (isLaterNight || gameSettings.werewolfEliminationOnFirstNight || !["KillPlayer", "NightKill", "WitchChoice", "RevealPlayer"].includes(role.action)) &&
        (isLaterNight || gameSettings.werewolfEliminationOnFirstNight || !["ConvertPlayer", "ProtectPlayer"].includes(role.action)) &&
        !passiveActions.includes(role.action) &&
        isValidAction(role.action);

}

function getRequiredCardCount() {

    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );

    return players.length + (drunkIsSelected ? 1 : 0);

}

function getSetupAutomaticWin(leftoverRoleName = null) {

    let werewolfTeamCount = 0;
    let villagerTeamCount = 0;
    let mayorCount = 0;
    let nonMayorVillagerCount = 0;
    let eliminationWolfCount = 0;

    roles.forEach(role => {
        const dealtCount = Math.max(
            0,
            Number(role.count) - (role.role === leftoverRoleName ? 1 : 0)
        );

        if (role.team === "Werewolf") {
            const countsForParity = role.role === "Minion" ? roleRuleSettings.minionCountsForWerewolfParity :
                role.role === "Fruit Brute" ? roleRuleSettings.fruitBruteCountsForWerewolfParity :
                role.role === "Sorceress" ? roleRuleSettings.sorceressCountsForWerewolfParity : true;
            if (countsForParity) werewolfTeamCount += dealtCount;

            if (!["Minion", "Sorceress"].includes(role.role)) {
                eliminationWolfCount += dealtCount;
            }
        } else {
            villagerTeamCount += dealtCount;
            if (role.role === "Mayor") {
                mayorCount += dealtCount;
            } else {
                nonMayorVillagerCount += dealtCount;
            }
        }
    });

    if (nonMayorVillagerCount > 0) {
        villagerTeamCount += mayorCount;
    }

    const leftoverRole = roles.find(role => role.role === leftoverRoleName);
    if (
        leftoverRole?.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(leftoverRole.role)
    ) {
        eliminationWolfCount++;
    }

    if (eliminationWolfCount === 0) {
        return "The Villagers would win automatically because no elimination-capable Werewolf would be dealt.";
    }

    if (werewolfTeamCount >= villagerTeamCount) {
        return "The Werewolf team would win automatically because it would equal or outnumber the Villager team.";
    }

    return null;

}

function getPossibleSetupAutomaticWin() {

    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );

    if (!drunkIsSelected) {
        return getSetupAutomaticWin();
    }

    const possibleLeftovers = roles.filter(role =>
        role.role !== "Drunk" && Number(role.count) > 0
    );
    const outcomes = possibleLeftovers.map(role =>
        getSetupAutomaticWin(role.role)
    );

    if (outcomes.length > 0 && outcomes.every(Boolean)) {
        return "Every possible leftover-card setup would produce an automatic win. Adjust the selected roles before starting.";
    }

    return null;

}

function startNightOneActions(role) {

    nightOneActionOrder = [];
    nightOneActionMode = null;

    if (
        !hasNightOneAction(role)
    ) {
        advanceNightRole();
        return;
    }

    players
        .filter(player =>
            player.role === role.role &&
            player.alive &&
            !(role.oncePerGame && player.usedOncePerGameAction)
        )
        .slice(
            0,
            ["KillPlayer", "RevealGroup"].includes(role.action) ? 1 : undefined
        )
        .forEach(actor => {
            nightOneActionOrder.push({ role, actor });
        });

    nightOneCurrentAction = 0;

    if (nightOneActionOrder.length === 0) {
        drawGoToSleep("advanceNightRole");
        return;
    }

    drawNightAction();

}

function drawNightAction() {

    if (nightOneCurrentAction >= nightOneActionOrder.length) {
        if (isLaterNight) {
            isLaterNight = false;
            drawDayOne();
            return;
        }

        nightOneCurrentRole++;
        drawNightRole();
        return;
    }

    const item = nightOneActionOrder[nightOneCurrentAction];
    const action = getAction(item.role.action);
    const previousAction = nightOneActionOrder[nightOneCurrentAction - 1];
    const isSecondWolfTarget = item.role.action === "KillPlayer" &&
        previousAction?.role.action === "KillPlayer";
    const hasResultScreen = nightActionHasVisibleResult(item.role.action);

    if (item.theatricalOnly) {
        drawTheatricalNightAction(item);
        return;
    }

    if (!action) {
        nightOneCurrentAction++;
        drawNightAction();
        return;
    }

    const targetCount = getNightActionTargetCount(item);
    let availablePlayers = players.filter(player =>
        player.alive &&
        (["ProtectPlayer", "LinkPlayers"].includes(item.role.action) || player !== item.actor)
    );

    if (item.role.action === "ProtectPlayer") {
        availablePlayers = availablePlayers.filter(player =>
            player !== item.actor.lastProtectedPlayer
        );
    }

    if (item.role.action === "CompareTeams" && roleRuleSettings.mentalistCannotRepeatPlayers) {
        const previouslyCompared = new Set(item.actor.mentalistComparedPlayerIds || []);
        availablePlayers = availablePlayers.filter(player => !previouslyCompared.has(player.id));
    }

    if (item.doppelgangerLateCupid) {
        availablePlayers = availablePlayers.filter(player => !player.connectedTo);
    }

    if (item.role.action === "KillPlayer") {
        availablePlayers = availablePlayers.filter(player =>
            !canChooseWerewolfElimination(player) &&
            !player.wolfTargetTonight
        );
    }

    if (item.role.action === "ConvertPlayer") {
        availablePlayers = availablePlayers.filter(player => player.wolfTargetTonight);
    }

    if (item.role.action === "WitchChoice" && nightOneActionMode === "save") {
        availablePlayers = availablePlayers.filter(player => player.attackedTonight);
    }

    if (["WitchChoice", "NightKill", "BlessPlayer", "ConvertPlayer"].includes(item.role.action) && !nightOneActionMode) {
        drawOptionalNightAction(item);
        return;
    }

    if (
        targetCount === 0 &&
        ["BecomeSeer", "ChangeTeams", "CheckRoleModel"].includes(item.role.action)
    ) {
        executeAction(item.role.action, item.actor, []);
        drawNightActionResult(item, [], true);
        return;
    }

    if (["RevealWerewolves", "RevealGroup"].includes(item.role.action)) {
        executeAction(item.role.action, item.actor, []);
        drawNightActionResult(item, [], true);
        return;
    }

    if (item.role.action === "CopyRole" && isLaterNight && item.actor.doppelgangerTarget) {
        executeAction(item.role.action, item.actor, []);
        if (item.actor.doppelgangerTransformedTonight) {
            queueDoppelgangerInheritanceActions(item.actor);
        }
        drawNightActionResult(item, [item.actor.doppelgangerTarget]);
        return;
    }

    let html = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(isSecondWolfTarget ? "Werewolves, choose your second target." : `${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        <p>${readAloud(isSecondWolfTarget ? "Whom would you like as your second elimination target?" :
            item.role.action === "Hear" ? "Choose your two neighbors to learn whether either took an action tonight." : item.role.question)}</p>
    `;

    if (targetCount === 1) {

        html += `<select id="nightActionTarget"${["Investigate", "TrackWolf"].includes(item.role.action) ? ' onchange="updateNeighborAvailability()"' : ""}>
            <option value="">Select Player</option>
            <option value="nobody">Nobody</option>
        `;

        availablePlayers.forEach(player => {
            const index = players.indexOf(player);
            html += `<option value="${index}">${escapeHTML(player.name)}</option>`;
        });

        html += `</select>`;

        if (["Investigate", "TrackWolf"].includes(item.role.action)) {
            html += drawNeighborSelectors(availablePlayers, item.role.action === "Investigate" ? "P.I." : "Tracker", item.actor);
        }

    } else if (targetCount > 1) {

        html += `<p>Select exactly ${targetCount} players.</p>`;
        html += `<label style="display:block; margin:8px 0;">
            <input type="checkbox" id="nightActionNobody">
            Nobody
        </label>`;

        availablePlayers.forEach(player => {
            const index = players.indexOf(player);
            html += `
                <label style="display:block; margin:8px 0;">
                    <input type="checkbox" name="nightActionTarget" value="${index}">
                    ${escapeHTML(player.name)}
                </label>
            `;
        });

    }

    if (item.role.action === "Hear") {
        html += drawNeighborSelectors(availablePlayers, "Insomniac", item.actor);
        html += `<label style="display:block; margin:8px 0;">
            <input type="checkbox" id="nightActionNobody">
            Nobody
        </label>`;
    }

    const followingAction = nightOneActionOrder[nightOneCurrentAction + 1];
    const packHasAnotherTarget = item.role.action === "KillPlayer" &&
        followingAction?.role.action === "KillPlayer";

    html += `
        <hr>
        ${packHasAnotherTarget || hasResultScreen ? "" : `<p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p><hr>`}
        <button class="actionContinue" type="button" onclick="confirmNightAction()">Continue ➜</button>
    `;

    document.getElementById("screen").innerHTML = html;

}

function queueDoppelgangerInheritanceActions(actor) {
    const inheritedRole = actor.doppelgangerInheritedRole;
    const inheritedDefinition = roles.find(role => role.role === inheritedRole);
    if (!inheritedDefinition || inheritedRole === "Doppelganger" || inheritedRole === "Drunk") return;

    const queued = [];
    const addAction = (action, question, extra = {}) => queued.push({
        role: { ...inheritedDefinition, action, question },
        actor,
        doppelgangerInheritedAction: true,
        ...extra
    });

    if (roleRuleSettings.doppelgangerPerformsLateSetup) {
        if (inheritedRole === "Dire Wolf" && roleRuleSettings.doppelgangerAllowsDireWolfConnection) {
            addAction("ConnectToPlayer", "Whom would you like to connect yourself to?");
        } else if (inheritedRole === "Cupid" && roleRuleSettings.doppelgangerAllowsCupidPair) {
            addAction("LinkPlayers", "Which two currently unlinked players would you like to connect?", { doppelgangerLateCupid: true });
        } else if (inheritedRole === "Wild Child" && roleRuleSettings.doppelgangerAllowsWildChildRoleModel) {
            addAction("ChooseRoleModel", "Whom would you like as your role model?");
        } else if (inheritedRole === "Butcher" && roleRuleSettings.doppelgangerAllowsButcherTarget) {
            addAction("SetButcherTarget", "Who should be eliminated instead if the Werewolves attack you?");
        } else if (inheritedRole === "Shepherd" && roleRuleSettings.doppelgangerGivesShepherdFlock) {
            addAction("ShepherdFlock", "Your fresh flock will absorb the first Werewolf attack against you.");
        }
    }

    if (roleRuleSettings.doppelgangerReceivesRoleKnowledge) {
        if (inheritedRole === "Mason") addAction("RevealGroup", "Learn the living Masons.");
        if (inheritedRole === "Minion") addAction("RevealWerewolves", "Learn the living Werewolves.");
        if (inheritedRole === "Beholder") addAction("RevealSeer", "Learn the current Seer.");
    }

    if (roleRuleSettings.doppelgangerJoinsNormalWakeSameNight) {
        const futureActions = nightOneActionOrder.slice(nightOneCurrentAction + 1);
        if (canChooseWerewolfElimination(actor) && !futureActions.some(entry => entry.role.action === "KillPlayer")) {
            const werewolfDefinition = roles.find(role => role.role === "Werewolf");
            if (werewolfDefinition) queued.push({ role: werewolfDefinition, actor, doppelgangerInheritedAction: true });
        }
        const setupActions = new Set(queued.map(entry => entry.role.action));
        if (
            inheritedDefinition.wake === "Every" &&
            inheritedDefinition.action !== "N/A" &&
            inheritedDefinition.action !== "CopyRole" &&
            !setupActions.has(inheritedDefinition.action) &&
            !(inheritedDefinition.oncePerGame && actor.usedOncePerGameAction)
        ) {
            queued.push({ role: inheritedDefinition, actor, doppelgangerInheritedAction: true });
        }
    }

    nightOneActionOrder.splice(nightOneCurrentAction + 1, 0, ...queued);
}

function nightActionHasVisibleResult(actionName) {

    return [
        "RevealWerewolves",
        "BecomeSeer",
        "ChangeTeams",
        "CheckRoleModel",
        "RevealAlignment",
        "RevealRole",
        "RevealPlayer",
        "RevealTeam",
        "RevealGroup",
        "CompareTeams",
        "Investigate",
        "Hear",
        "RevealSeer",
        "TrackWolf",
        "CopyRole"
    ].includes(actionName);

}

function recordPhaseEvent(phase, text, key = null) {

    if (!phase || !text) {
        return;
    }

    const eventKey = key || `${phase}:${text}`;
    if (phaseHistory.some(event => event.key === eventKey)) {
        return;
    }

    phaseHistory.push({ phase, text, key: eventKey });

}

function sanitizePhaseHistory() {

    phaseHistory = phaseHistory.map(event =>
        /^Beholder selected no target\.?$/i.test(event.text) ?
            { ...event, text: "The Beholder checked for the Seer." } :
            event
    );
    const transformedCursedPlayers = new Set();
    const canonicalVillageVotes = new Set(
        phaseHistory
            .filter(event => event.key?.startsWith("elimination-") && /eliminated by Village vote/i.test(event.text))
            .map(event => event.text.match(/^(.+?) was eliminated/i)?.[1])
            .filter(Boolean)
    );
    phaseHistory = phaseHistory.filter(event => {
        const villageVoteMatch = /^(.+?) was eliminated by the village vote\.?$/i.exec(event.text);
        if (!event.key?.startsWith("elimination-") && villageVoteMatch && canonicalVillageVotes.has(villageVoteMatch[1])) {
            return false;
        }
        const match = /^(.+?) was attacked as the Cursed and became a Werewolf/.exec(event.text);
        if (!match) {
            return true;
        }
        const playerName = match[1];
        if (transformedCursedPlayers.has(playerName)) {
            return false;
        }
        transformedCursedPlayers.add(playerName);
        return true;
    });

}

function recordNightActionEvent(item, targets) {

    const roleName = moderatorRoleName(item.role.role);
    const targetNames = targets.map(target => target.name).join(" and ");
    let result = item.skipped ? `${roleName} chose Nobody; no action was taken.` :
        `${roleName} selected ${targetNames || "no target"}.`;

    if (!item.skipped) {
        if (item.role.action === "KillPlayer") {
            result = `Werewolves targeted ${targetNames} for elimination.`;
        } else if (item.role.action === "ProtectPlayer") {
            result = `${item.actor.name}, the ${item.role.role}, protected ${targetNames}.`;
        } else if (item.role.action === "BlessPlayer") {
            result = `${item.actor.name}, the Priest, permanently blessed ${targetNames} against Werewolf attacks.`;
        } else if (item.role.action === "WitchChoice") {
            result = nightOneActionMode === "save" ?
                `The Witch protected ${targetNames}.` :
                `The Witch targeted ${targetNames} for elimination.`;
        } else if (item.role.action === "ConvertPlayer") {
            result = `The Alpha Wolf selected ${targetNames} for conversion.`;
        } else if (item.role.action === "RevealSeer") {
            result = "The Beholder checked for the Seer.";
        }
    }

    recordPhaseEvent(
        `Night ${currentNight}`,
        result,
        `night-action-${currentNight}-${nightOneCurrentAction}-${item.role.role}`
    );

}

function confirmNightAction() {

    const item = nightOneActionOrder[nightOneCurrentAction];
    const targetCount = getNightActionTargetCount(item);
    let targets = [];

    if (item.role.action === "TrackWolf") {
        const previousNeighbors = [item.actor.lastLeftNeighbor, item.actor.lastRightNeighbor].filter(Boolean);
        item.trackerWasTriggered = previousNeighbors.some(player =>
            !player.alive &&
            player.deathCause === "Werewolf attack" &&
            player.deathPhase === `Night ${currentNight - 1}`
        );
        item.neighbors = getSelectedNeighbors();
        if (!item.neighbors) return;
        item.actor.lastLeftNeighbor = item.neighbors[0];
        item.actor.lastRightNeighbor = item.neighbors[1];
    }

    if (document.getElementById("nightActionNobody")?.checked) {
        item.skipped = true;
        recordNightActionEvent(item, []);
        drawNightActionResult(item, []);
        return;
    }

    if (targetCount === 1) {

        const select = document.getElementById("nightActionTarget");

        if (!select || select.value === "") {
            alert("Please select a player.");
            return;
        }

        if (select.value === "nobody") {
            item.skipped = true;
            recordNightActionEvent(item, []);
            drawNightActionResult(item, []);
            return;
        }

        targets = [players[Number(select.value)]];

        if (item.role.action === "Investigate") {
            item.neighbors = getSelectedNeighbors();
            if (!item.neighbors) {
                return;
            }

            if (item.neighbors.includes(targets[0])) {
                alert("The inspected player cannot also be selected as a neighbor.");
                return;
            }
            item.actor.lastLeftNeighbor = item.neighbors[0];
            item.actor.lastRightNeighbor = item.neighbors[1];
        }

        if (item.role.action === "TrackWolf" && !item.trackerWasTriggered) {
            alert("The Tracker may inspect only when one of their previous neighbors was eliminated by the Werewolves last night. Choose Nobody instead.");
            return;
        }

    } else if (targetCount > 1) {

        const selected = Array.from(
            document.querySelectorAll('input[name="nightActionTarget"]:checked')
        );

        if (selected.length !== targetCount) {
            alert(`Please select exactly ${targetCount} players.`);
            return;
        }

        targets = selected.map(input => players[Number(input.value)]);

    }

    if (item.role.action === "Hear") {
        item.neighbors = getSelectedNeighbors();
        if (!item.neighbors) {
            return;
        }
        item.actor.lastLeftNeighbor = item.neighbors[0];
        item.actor.lastRightNeighbor = item.neighbors[1];
    }

    if (targets.some(target => !target)) {
        alert("A selected player could not be found.");
        return;
    }

    if (item.role.action === "WitchChoice") {
        if (nightOneActionMode === "save") {
            targets[0].protected = true;
            targets[0].protectionCauseTonight = "the Witch's save";
            targets[0].nightAttackCauses = [];
            targets[0].werewolfAttackTonight = false;
            targets[0].nonWerewolfAttackTonight = false;
            targets[0].wolfAttackCountsTonight = false;
            targets[0].attackedTonight = false;
        } else {
            targets[0].nightAttackCauses = targets[0].nightAttackCauses || [];
            targets[0].nightAttackCauses.push("Witch attack");
            targets[0].nonWerewolfAttackTonight = true;
            targets[0].attackedTonight = true;
            targets[0].pendingDeathCause = "Witch attack";
            targets[0].pendingDeathPhase = `Night ${currentNight}`;
        }
    }

    executeAction(item.role.action, item.actor, targets);
    if (item.role.action === "CompareTeams") {
        item.actor.mentalistComparedPlayerIds = item.actor.mentalistComparedPlayerIds || [];
        targets.forEach(target => {
            if (!item.actor.mentalistComparedPlayerIds.includes(target.id)) {
                item.actor.mentalistComparedPlayerIds.push(target.id);
            }
        });
    }
    recordNightActionEvent(item, targets);
    item.actor.tookActionTonight = true;

    if (item.role.oncePerGame) {
        item.actor.usedOncePerGameAction = true;
    }

    if (item.role.action === "ProtectPlayer") {
        item.actor.lastProtectedPlayer = targets[0];
    }

    if (item.role.action === "KillPlayer") {
        players
            .filter(player => player.alive && canChooseWerewolfElimination(player))
            .forEach(player => {
                player.tookActionTonight = true;
            });
    }

    drawNightActionResult(item, targets);

}

function drawNightActionResult(item, targets, includeQuestion = false) {

    if (
        !item.skipped &&
        !includeQuestion &&
        !nightActionHasVisibleResult(item.role.action)
    ) {
        advanceNightAction();
        return;
    }

    const result = getNightActionResult(item, targets);
    const isSignalAction = [
        "BecomeSeer",
        "ChangeTeams",
        "CheckRoleModel",
        "RevealAlignment",
        "RevealRole",
        "CompareTeams",
        "Investigate",
        "Hear",
        "RevealSeer",
        "TrackWolf"
    ].includes(
        item.role.action
    );
    const question = includeQuestion ?
        `<p>${readAloud(item.role.question)}</p>` : "";
    const inspectedPlayer = targets[0];
    const isSorceressCheck = item.actor.role === "Sorceress" && item.role.action === "RevealRole";
    const sorceressFinding = isSorceressCheck && roleRuleSettings.sorceressRevealsWerewolf ?
        getSorceressFinding(inspectedPlayer) : null;
    const inspectionAppearsAs = roles.find(role =>
        role.role === inspectedPlayer?.role
    )?.appearsAs || inspectedPlayer?.team || "Villager";
    const signalIsUp = item.role.action === "BecomeSeer" ?
        item.actor.becameSeerTonight :
        item.role.action === "ChangeTeams" ?
            item.actor.becameWerewolfTonight :
        item.role.action === "CheckRoleModel" ?
            item.actor.team === "Werewolf" :
        item.role.action === "RevealRole" ?
            inspectedPlayer?.role === "Seer" :
        item.role.action === "CompareTeams" ?
            targets[0]?.team === targets[1]?.team :
        item.role.action === "Investigate" ?
            [inspectedPlayer, ...(item.neighbors || [])].some(player => playerAppearsWerewolfToPI(player)) :
        item.role.action === "TrackWolf" ?
            trackerSeesWerewolf(inspectedPlayer) :
        item.role.action === "Hear" ?
            (item.neighbors || []).some(player => player?.tookActionTonight) :
            inspectionAppearsAs === "Werewolf";
    const signalText = item.role.action === "RevealAlignment" ?
        readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "RevealRole" ?
            (isSorceressCheck ? "" : readAloud(`${signalIsUp ? "Seer" : "Not the Seer"}.`)) :
        item.role.action === "CompareTeams" ?
            `<span class="moderatorHint">Thumbs up means same team. Thumbs down means different teams.</span>` :
        item.role.action === "Investigate" ?
            `<span class="moderatorHint">Thumbs up means the selected group contains a Werewolf. Thumbs down means it does not.</span>` :
        item.role.action === "Hear" ?
            readAloud(signalIsUp ? "Thumbs up: at least one neighbor took an action." : "Thumbs down: neither neighbor took an action.") :
        item.role.action === "TrackWolf" ?
            `<span class="moderatorHint">Thumbs up means Werewolf. Thumbs down means not a Werewolf.</span>` :
        item.role.action === "CheckRoleModel" ?
            readAloud(signalIsUp ? "Thumbs up: you are now a Werewolf." : "Thumbs down: you remain a Villager.") :
        `Signal: ${signalIsUp ? "Thumbs up" : "Thumbs down"}`;
    const isLargePrivateReveal = item.role.action === "RevealTeam" ||
        item.role.action === "RevealSeer" ||
        (item.role.action === "CopyRole" && isLaterNight);
    const sorceressIcon = sorceressFinding === "Seer" ? "🔮" : sorceressFinding === "Werewolf" ? "🐺" : "●";
    const simpleSorceressSignal = isSorceressCheck && !roleRuleSettings.sorceressRevealsWerewolf;
    const signal = item.skipped ? `<p>${readAloud("No action was taken.")}</p>` : sorceressFinding ? `
        <div class="sorceressResult"><span aria-hidden="true">${sorceressIcon}</span><strong>${sorceressFinding}</strong></div>
    ` : simpleSorceressSignal ? `
        <p style="font-size:3rem; margin:12px 0;">${signalIsUp ? "👍" : "👎"}</p>
    ` : isLargePrivateReveal ? `
        <div class="privateRoleReveal">${escapeHTML(result)}</div>
    ` : isSignalAction ? `
        <p style="font-size:3rem; margin:12px 0;">${signalIsUp ? "👍" : "👎"}</p>
        <p>${signalText}</p>
    ` : `<p>${readAloud(result)}</p>`;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${includeQuestion ? readAloud(`${moderatorRoleName(item.role.role)}, wake up.`) : escapeHTML(moderatorRoleName(item.role.role))}</h2>
        ${question}
        ${signal}
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" onclick="advanceNightAction()">Continue ➜</button>
    `;

}

function getNightActionResult(item, targets) {

    const target = targets[0];

    if (item.skipped) {
        return "No action taken.";
    }

    switch (item.role.action) {

        case "RevealWerewolves":
            return `Werewolves: ${players.filter(player => player.team === "Werewolf").map(player => player.name).join(", ") || "None"}`;

        case "RevealSeer": {
            const seers = players.filter(player =>
                player.alive &&
                player.role === "Seer" &&
                (
                    player.isOriginalSeer ||
                    (player.wasApprenticeSeer && roleRuleSettings.beholderLearnsApprenticeSeer) ||
                    (player.isDoppelganger && roleRuleSettings.beholderLearnsDoppelgangerSeer)
                )
            );
            return seers.length ? `Seer: ${seers.map(player => player.name).join(" and ")}` : "There is no living Seer.";
        }

        case "TrackWolf":
            return trackerSeesWerewolf(target) ? `${target.name} appears to be a Werewolf.` : `${target.name} does not appear to be a Werewolf.`;

        case "BecomeSeer":
            return item.actor.becameSeerTonight ?
                "Signal: thumbs up. You are now the Seer." :
                "Signal: thumbs down. The Seer is still in the game.";

        case "ChangeTeams":
            return item.actor.becameWerewolfTonight ?
                "Signal: thumbs up. You have become a Werewolf." :
                "Signal: thumbs down. You remain on the Villager team.";

        case "RevealAlignment":
            return `${target.name} appears as ${
                roles.find(role => role.role === target.role)?.appearsAs ||
                target.team ||
                "Villager"
            }.`;

        case "RevealRole":
            if (item.actor.role === "Sorceress") {
                return `${target.name}: ${getSorceressFinding(target)}.`;
            }
            return target.role === "Seer" ?
                `${target.name} is the Seer.` :
                `${target.name} is not the Seer.`;

        case "RevealPlayer":
            item.actor.usedOncePerGameAction = true;
            if (target.team === "Werewolf") {
                recordElimination(target, "Revealer", `Night ${currentNight}`);
                return "They are on the Werewolf team and are eliminated.";
            }
            recordElimination(item.actor, "Revealer backlash", `Night ${currentNight}`);
            return "They are on the Villager team. The Revealer is eliminated.";

        case "Investigate":
            return "Investigation complete.";

        case "Hear":
            return (item.neighbors || []).some(player => player.tookActionTonight) ?
                "A neighbor took an action tonight." :
                "Neither neighbor took an action tonight.";

        case "RevealTeam":
            return `${target.name}'s role is ${roleShownToMysticSeer(target)}.`;

        case "CompareTeams":
            return targets[0].team === targets[1].team ? "They are on the same team." : "They are on different teams.";

        case "RevealGroup":
            return `${item.role.role}s: ${players.filter(player => player.role === item.role.role).map(player => player.name).join(", ")}.`;

        case "CopyRole":
            if (!isLaterNight) {
                return `${target.name} selected.`;
            }

            return target.alive ?
                "Doppelganger, this is your role: Doppelganger." :
                `Doppelganger, this is your role: ${target.role}.`;

        case "ConnectToPlayer":
            return `${item.actor.name} is connected to ${target.name}.`;

        case "LinkPlayers":
            return `${targets[0].name} and ${targets[1].name} are linked.`;

        case "ProtectPlayer":
        case "BlessPlayer":
            return `${target.name} is permanently protected from Werewolf attacks.`;

        case "SilencePlayer":
            return `${target.name} is silenced for the next day.`;

        case "ConvertPlayer":
            return `${target.name} was selected for conversion. The result will resolve at dawn.`;

        case "ExileVillager":
            return `${target.name} will miss the next day.`;

        default:
            return "";

    }

}

function getNightActionTargetCount(item) {

    if (item.role.action === "WitchChoice") {
        return nightOneActionMode ? 1 : 0;
    }

    return Number(getActionTargetCount(item.role.action)) || 0;

}

function drawTheatricalNightAction(item) {

    const targetCount = getNightActionTargetCount(item);
    const baseQuestion = item.role.question.replace(/\s*If no one.*$/i, "").trim();
    const theatricalQuestion = targetCount > 0 ?
        `${baseQuestion} Point to someone if so. If no one, go back to sleep.` :
        item.role.question;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        ${item.role.question === "N/A" ? "" : `<p>${readAloud(theatricalQuestion)}</p>`}
        <h3 class="moderatorHeading">Moderator note</h3>
        <div class="moderatorPanel">
            Wait a few extra seconds before continuing, even if the player immediately goes back to sleep. This keeps it unclear whether the ability has already been used.
        </div>
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" onclick="advanceNightAction()">Continue ➜</button>
    `;

}

function drawNeighborSelectors(availablePlayers, roleName, actor = null) {

    const drawOptions = selectedPlayer => availablePlayers.map(player =>
        `<option value="${players.indexOf(player)}"${player === selectedPlayer ? " selected" : ""}>${escapeHTML(player.name)}</option>`
    ).join("");
    const previousLeft = actor?.lastLeftNeighbor?.alive ? actor.lastLeftNeighbor : null;
    const previousRight = actor?.lastRightNeighbor?.alive ? actor.lastRightNeighbor : null;

    return `
        <select id="leftNeighbor"><option value="">Current left neighbor</option>${drawOptions(previousLeft)}</select>
        <select id="rightNeighbor"><option value="">Current right neighbor</option>${drawOptions(previousRight)}</select>
    `;

}

function updateNeighborAvailability() {

    const inspectedValue = document.getElementById("nightActionTarget")?.value;
    ["leftNeighbor", "rightNeighbor"].forEach(id => {
        const select = document.getElementById(id);
        if (!select) {
            return;
        }
        [...select.options].forEach(option => {
            option.disabled = inspectedValue !== "" && option.value === inspectedValue;
        });
        if (select.value === inspectedValue) {
            select.value = "";
        }
    });

}

function getSelectedNeighbors() {

    const left = document.getElementById("leftNeighbor");
    const right = document.getElementById("rightNeighbor");

    if (!left || !right || left.value === "" || right.value === "" || left.value === right.value) {
        alert("Please select two different neighbors.");
        return null;
    }

    return [players[Number(left.value)], players[Number(right.value)]];

}

function drawOptionalNightAction(item) {

    const choices = item.role.action === "WitchChoice" ? `
        <button type="button" onclick="setNightActionMode('save')">👍 Save</button>
        <button type="button" onclick="setNightActionMode('kill')">👎 Eliminate</button>
        <button type="button" onclick="setNightActionMode('skip')">Do nothing</button>
    ` : item.role.action === "ConvertPlayer" ? `
        <button type="button" onclick="setNightActionMode('take')">Turn the Werewolves' target</button>
        <button type="button" onclick="setNightActionMode('skip')">Do not turn the Werewolves' target</button>
    ` : `
        <button type="button" onclick="setNightActionMode('take')">Take action</button>
        <button type="button" onclick="setNightActionMode('skip')">Do not take action</button>
    `;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        <p>${readAloud(item.role.question)}</p>
        ${choices}
    `;

}

function setNightActionMode(mode) {

    const item = nightOneActionOrder[nightOneCurrentAction];
    nightOneActionMode = mode;

    if (mode === "skip") {
        item.skipped = true;
        drawNightActionResult(item, []);
        return;
    }

    if (item.role.action === "ConvertPlayer") {
        const target = players.find(player =>
            player.alive &&
            player !== item.actor &&
            player.wolfTargetTonight
        );

        if (!target) {
            item.skipped = true;
            drawNightActionResult(item, []);
            return;
        }

        executeAction(item.role.action, item.actor, [target]);
        item.actor.tookActionTonight = true;
        if (item.role.oncePerGame) {
            item.actor.usedOncePerGameAction = true;
        }
        drawNightActionResult(item, [target]);
        return;
    }

    drawNightAction();

}

function drawGoToSleep(callbackName) {

    document.getElementById("screen").innerHTML = `
        <h2>${readAloud("Go to sleep.")}</h2>
        <button type="button" onclick="${callbackName}()">Continue</button>
    `;

}

function advanceNightRole() {

    nightOneCurrentRole++;
    drawNightRole();

}

function advanceNightAction() {

    const completedAction = nightOneActionOrder[nightOneCurrentAction];

    if (
        completedAction?.role.action === "BecomeSeer" &&
        completedAction.actor.becameSeerTonight
    ) {
        const seerRole = roles.find(role => role.role === "Seer");

        if (seerRole) {
            nightOneActionOrder.splice(
                nightOneCurrentAction + 1,
                0,
                { role: seerRole, actor: completedAction.actor }
            );
        }
    }

    nightOneCurrentAction++;
    nightOneActionMode = null;
    drawNightAction();

}

// ============================================================
// CONFIRM CURRENT NIGHT ROLE
// ============================================================

function confirmNightRole() {

    const role =
        nightOneWakeOrder[nightOneCurrentRole];


    if (!role) {

        console.error(
            "No role found for current Night 1 position."
        );

        return;

    }


    // ========================================================
    // SINGLE PLAYER
    // ========================================================

    if (role.count === 1) {

        const select =
            document.getElementById(
                "nightPlayerSelect"
            );


        if (
            !select ||
            select.value === ""
        ) {

            alert(
                `Please select who the ${role.role} is.`
            );

            return;

        }


        const playerIndex =
            Number(select.value);


        const player =
            players[playerIndex];


        if (!player) {

            alert(
                "The selected player could not be found."
            );

            return;

        }


        // Make absolutely sure this player hasn't
        // already been assigned.

        if (player.role) {

            alert(
                `${player.name} already has a role.`
            );

            return;

        }


        player.role = role.role;

        player.team = role.team;

        if (role.role === "Seer") {
            player.isOriginalSeer = true;
        }

        if (role.role === "Drunk") {
            player.isOriginalDrunk = true;
        }

        if (role.role === "Shepherd") {
            player.shepherdFlockAlive = true;
        }

    }


    // ========================================================
    // MULTIPLE PLAYERS
    // ========================================================

    else {

        const selected =
            Array.from(
                document.querySelectorAll(
                    'input[name="nightPlayer"]:checked'
                )
            );


        if (
            selected.length !==
            role.count
        ) {

            alert(
                `Please select exactly ${role.count} ${role.role}s.`
            );

            return;

        }


        // ====================================================
        // ASSIGN SELECTED PLAYERS
        // ====================================================

        for (const input of selected) {

            const playerIndex =
                Number(input.value);


            const player =
                players[playerIndex];


            if (!player) {

                alert(
                    "One of the selected players could not be found."
                );

                return;

            }


            if (player.role) {

                alert(
                    `${player.name} already has a role.`
                );

                return;

            }

        }


        // ====================================================
        // SAVE ROLES
        // ====================================================

        selected.forEach(input => {

            const playerIndex =
                Number(input.value);


            const player =
                players[playerIndex];


            player.role = role.role;

            player.team = role.team;

            if (role.role === "Seer") {
                player.isOriginalSeer = true;
            }

            if (role.role === "Drunk") {
                player.isOriginalDrunk = true;
            }

        });

    }


    // ========================================================
    // COMPLETE THIS ROLE'S ACTION WHILE IT IS AWAKE
    // ========================================================

    startNightOneActions(role);

}

// ============================================================
// DAY ONE
// ============================================================

function startNextNight() {

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
        players.filter(player => player.alive && player.role === "Sasquatch").forEach(player => {
            player.role = "Werewolf";
            player.team = "Werewolf";
            recordPhaseEvent(`Day ${currentDay}`, `${player.name}, the Sasquatch, became a Werewolf because the Day ended without an elimination.`, `sasquatch-${player.id}-${currentDay}`);
        });
    }

    isLaterNight = true;
    currentNight = Math.max(currentNight, currentDay) + 1;
    savedVoteCount = 0;
    dayEliminationVoteOccurred = false;
    nightOneActionMode = null;
    nightOneActionOrder = [];
    wolfEliminationsTonight = players.some(player =>
        player.role === "Wolf Cub" &&
        !player.alive &&
        (player.deathCause !== "Kicked" || roleRuleSettings.wolfCubKickActivatesBonus) &&
        !player.wolfCubBonusGranted
    ) ? 2 : 1;

    if (wolfEliminationsTonight === 2) {
        players
            .filter(player =>
                player.role === "Wolf Cub" &&
                !player.alive &&
                (player.deathCause !== "Kicked" || roleRuleSettings.wolfCubKickActivatesBonus)
            )
            .forEach(player => {
                player.wolfCubBonusGranted = true;
            });
    }
    wolvesDisabledTonight = wolvesDisabledNextNight;
    wolvesDisabledNextNight = false;

    players.forEach(player => {
        player.attackedTonight = false;
        player.nightAttackCauses = [];
        player.werewolfAttackTonight = false;
        player.nonWerewolfAttackTonight = false;
        player.protectedFromWerewolvesTonight = false;
        player.bodyguardBlockedWerewolfAttackTonight = false;
        player.bodyguardBlockedOtherAttackTonight = [];
        player.priestBlockedWerewolfAttackTonight = false;
        player.alphaConversionFailedTonight = false;
        player.shepherdFlockSavedTonight = false;
        player.butcherRedirectedTonight = null;
        player.fruitBruteOnlyAttackTonight = false;
        player.magistrateProtectedToday = false;
        player.attackedByWolvesTonight = false;
        player.wolfTargetTonight = false;
        player.wolfAttackCountsTonight = false;
        player.pendingDeathCause = null;
        player.pendingDeathPhase = null;
        player.protected = false;
        player.protectionCauseTonight = null;
        player.silenced = false;
        player.exiledTonight = false;
        player.tookActionTonight = false;
        player.becameWerewolfTonight = false;
        player.alphaConvertedTonight = false;
        player.becameSeerTonight = false;
        player.doppelgangerTransformedTonight = false;
        });

    const drunkCardReveal = currentNight === 3 ? transformDrunk() : null;

    roles
        .map(role => role.role === "Wild Child" && wildChildHasConditionalRules() ? {
            ...role,
            wake: "Every",
            action: "CheckRoleModel",
            question: "Learn whether your role model's death caused you to become a Werewolf."
        } : role)
        .filter(role =>
            (role.wake === "Every" || (
                role.role === "Beholder" &&
                roleRuleSettings.beholderWakesOnFutureNights &&
                players.some(player =>
                    player.alive &&
                    player.role === "Seer" &&
                    !player.isOriginalSeer &&
                    (
                        (player.wasApprenticeSeer && roleRuleSettings.beholderLearnsApprenticeSeer) ||
                        (player.isDoppelganger && roleRuleSettings.beholderLearnsDoppelgangerSeer)
                    )
                )
            )) &&
            (
                role.count > 0 ||
                (
                    role.action === "KillPlayer" &&
                    players.some(player => player.alive && canChooseWerewolfElimination(player))
                )
            )
        )
        .filter(role => hasNightOneAction(role))
        .sort((a, b) => Number(a.priority) - Number(b.priority))
        .forEach(role => {
            const actors = players
                .filter(player =>
                    (role.action === "KillPlayer" ?
                        canChooseWerewolfElimination(player) :
                        role.action === "CheckRoleModel" ?
                            player.isWildChild :
                        role.action === "CopyRole" ?
                            player.isDoppelganger :
                    player.role === role.role) &&
                    player.alive &&
                    !(
                        role.role === "Witch" &&
                        role.oncePerGame &&
                        player.usedOncePerGameAction
                    )
                )
                .slice(0, role.action === "KillPlayer" ? 1 : undefined);

            actors.forEach(actor => {
                const actionCount = role.action === "KillPlayer" ?
                    wolfEliminationsTonight : 1;

                for (let actionIndex = 0; actionIndex < actionCount; actionIndex++) {
                    nightOneActionOrder.push({
                        role,
                        actor,
                        theatricalOnly: role.role !== "Witch" &&
                            role.oncePerGame === true &&
                            actor.usedOncePerGameAction === true
                    });
                }
            });

            if (actors.length === 0 && role.action !== "KillPlayer") {
                const hiddenDeadActor = players.find(player =>
                    !player.alive &&
                    !player.roleRevealed &&
                    (role.action === "CopyRole" ?
                        player.isDoppelganger :
                        player.role === role.role) &&
                    !(
                        role.role === "Witch" &&
                        role.oncePerGame &&
                        player.usedOncePerGameAction
                    )
                );

                if (hiddenDeadActor) {
                    nightOneActionOrder.push({
                        role,
                        actor: hiddenDeadActor,
                        theatricalOnly: true
                    });
                }
            }
        });

    if (
        drunkCardReveal &&
        hasNightOneAction(drunkCardReveal.role) &&
        (drunkCardReveal.role.wake === "1" || drunkCardReveal.role.action === "CopyRole")
    ) {
        nightOneActionOrder.unshift({
            role: drunkCardReveal.role,
            actor: drunkCardReveal.drunk
        });
    }

    nightOneCurrentAction = 0;

    if (drunkCardReveal) {
        drawDrunkCardReveal(drunkCardReveal);
        return;
    }

    drawNightAction();

}

function filterRoleList(searchText) {

    const searchTerm = String(searchText || "").trim().toLowerCase();
    roleSearchTerm = String(searchText || "");
    const roleOptions = Array.from(document.querySelectorAll(".roleOption"));
    let visibleCount = 0;

    roleOptions.forEach(option => {
        const matchesSearch = option.dataset.roleName.includes(searchTerm);
        const matchesTeam = roleTeamFilter === "all" || option.dataset.roleTeam === roleTeamFilter;
        const matchesSelected = !roleSelectedOnly || option.dataset.roleSelected === "true";
        const matches = matchesSearch && matchesTeam && matchesSelected;
        option.style.display = matches ? "flex" : "none";
        visibleCount += matches ? 1 : 0;
    });

    const noResults = document.getElementById("noRoleSearchResults");
    if (noResults) {
        noResults.style.display = visibleCount === 0 ? "block" : "none";
    }

}

function setRoleTeamFilter(value) {
    roleTeamFilter = ["all", "Villager", "Werewolf"].includes(value) ? value : "all";
    filterRoleList(roleSearchTerm);
}

function setRoleSelectedOnly(enabled) {
    roleSelectedOnly = enabled === true;
    filterRoleList(roleSearchTerm);
}

function transformDrunk() {

    const drunk = players.find(player =>
        player.isOriginalDrunk && player.alive && !player.drunkCardReceived
    );

    if (!drunk || !leftoverCardRole) {
        return null;
    }

    drunk.role = leftoverCardRole.role;
    drunk.team = leftoverCardRole.team;
    drunk.drunkCardReceived = true;

    if (leftoverCardRole.role === "Seer") {
        drunk.isOriginalSeer = true;
    }

    return {
        drunk,
        role: leftoverCardRole
    };

}

function drawDrunkCardReveal(reveal) {

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud("Drunk, wake up.")}</h2>
        <p>${readAloud(`Your card is ${reveal.role.role}.`)}</p>
        <button class="actionContinue" type="button" onclick="continueNightAfterDrunkCard()">Continue ➜</button>
    `;

}

function continueNightAfterDrunkCard() {

    drawNightAction();

}

function getNightModeratorDetails() {

    const details = [];
    const wolfTargets = players.filter(player => player.wolfTargetTonight);
    const wolvesChoseNobody = nightOneActionOrder.some(item =>
        item.role?.action === "KillPlayer" && item.skipped
    );

    if (wolvesChoseNobody && wolfTargets.length === 0) {
        details.push("The Werewolves selected Nobody, so no Werewolf attack occurred.");
    } else if (wolvesChoseNobody) {
        details.push("The Werewolves selected Nobody for one of their elimination choices.");
    }

    if (wolvesDisabledTonight && wolfTargets.length) {
        details.push(
            `The Werewolves targeted ${wolfTargets.map(player => player.name).join(", ")}, ` +
            "but the attack did not count because the Diseased was eliminated by the Werewolves the previous night."
        );
    }

    players.filter(player => player.fruitBruteOnlyAttackTonight).forEach(player => {
        details.push(`${player.name} was targeted, but the choice had no effect because the Fruit Brute was the only elimination-capable Werewolf present.`);
    });

    players.filter(player =>
        player.wolfTargetTonight && player.blessedAgainstWerewolves
    ).forEach(player => {
        details.push(
            `${player.name} was targeted by the Werewolves but survived because of the Priest's permanent blessing.`
        );
    });

    players.filter(player => player.bodyguardBlockedWerewolfAttackTonight).forEach(player => {
        const protectionSource = player.protectionCauseTonight || "a protective action";
        details.push(`${player.name} survived the Werewolf attack because of ${protectionSource}.`);
    });

    players.filter(player => player.bodyguardBlockedOtherAttackTonight?.length).forEach(player => {
        details.push(
            `${player.name} survived ${player.bodyguardBlockedOtherAttackTonight.join(" and ")} because the Bodyguard protected them.`
        );
    });

    players.filter(player => player.alphaConversionFailedTonight).forEach(player => {
        details.push(
            `${player.name} resisted the Alpha Wolf's conversion because they were protected from Werewolf attacks. ` +
            "The Alpha Wolf's ability was still used."
        );
    });

    players.filter(player => player.shepherdFlockSavedTonight).forEach(player => {
        details.push(`${player.name}, the Shepherd, survived the Werewolf attack because their flock was eliminated instead.`);
    });

    players.filter(player => player.butcherRedirectedTonight).forEach(player => {
        details.push(`${player.name}, the Butcher, redirected the Werewolf attack to ${player.butcherRedirectedTonight}.`);
    });

    players.filter(player => player.becameWerewolfTonight).forEach(player => {
        details.push(`${player.name} was attacked as the Cursed and became a Werewolf instead of being eliminated.`);
    });

    players.filter(player => player.alphaConvertedTonight).forEach(player => {
        details.push(`${player.name} was turned into a Werewolf by the Alpha Wolf instead of being eliminated by the Werewolves.`);
    });

    players.filter(player => player.toughGuyDeathPending).forEach(player => {
        details.push(
            `${player.name}, the Tough Guy, was attacked and survived tonight. ` +
            "Their delayed elimination will occur during the next Night Update."
        );
    });

    players.filter(player =>
        player.role === "Diseased" &&
        !player.alive &&
        player.wolfAttackCountsTonight
    ).forEach(player => {
        details.push(
            `${player.name}, the Diseased, was eliminated by the Werewolves. ` +
            "The Werewolves' elimination will not count next night."
        );
    });

    players.filter(player =>
        !player.alive && player.deathPhase === `Night ${currentNight}`
    ).forEach(player => {
        details.push(`${player.name} was eliminated by ${player.deathCause || "a night attack"}.`);
    });

    if (!details.length) {
        details.push("No night action caused an elimination or prevented one.");
    }

    return details;

}

function drawDayOne() {

    const isResumingMorning = resumeMorningAfterSpecialResolution;
    resumeMorningAfterSpecialResolution = false;

    if (!isResumingMorning) {
        currentDay = currentNight;

        let diseasedKilledByWolves = false;

        players.filter(player => player.pendingAlphaConversion).forEach(player => {
            const conversionBlocked = roleRuleSettings.werewolfProtectionBlocksAlphaConversion &&
                (player.protectedFromWerewolvesTonight || player.blessedAgainstWerewolves);

            if (conversionBlocked) {
                player.alphaConversionFailedTonight = true;
            } else {
                player.role = "Werewolf";
                player.team = "Werewolf";
                player.alphaConvertedTonight = true;
                player.nightAttackCauses = (player.nightAttackCauses || [])
                    .filter(cause => cause !== "Werewolf attack");
                player.werewolfAttackTonight = false;
                player.wolfAttackCountsTonight = false;
                player.attackedByWolvesTonight = false;
                player.attackedTonight = player.nightAttackCauses.length > 0;
                player.pendingDeathCause = player.nightAttackCauses[0] || null;
            }

            player.pendingAlphaConversion = false;
            player.alphaConversionActorId = null;
        });

        diseasedKilledByWolves = players.some(player =>
            player.role === "Diseased" && player.wolfAttackCountsTonight
        );

        players.filter(player => player.alive && player.role === "Shepherd" && player.shepherdFlockAlive && player.werewolfAttackTonight).forEach(player => {
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            player.shepherdFlockAlive = false;
            player.shepherdFlockSavedTonight = true;
        });

        players.filter(player => player.alive && player.role === "Butcher" && player.werewolfAttackTonight).forEach(player => {
            const replacement = player.butcherRedirectTarget;
            if (!replacement?.alive) return;
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            if (!replacement.blessedAgainstWerewolves && !replacement.protectedFromWerewolvesTonight) {
                replacement.nightAttackCauses = replacement.nightAttackCauses || [];
                replacement.nightAttackCauses.push("Werewolf attack");
                replacement.werewolfAttackTonight = true;
                replacement.wolfAttackCountsTonight = true;
                replacement.attackedTonight = true;
                replacement.pendingDeathPhase = `Night ${currentNight}`;
            }
            player.butcherRedirectedTonight = replacement.name;
        });

        players.forEach(player => {
            if (player.toughGuyDeathPending) {
                recordElimination(
                    player,
                    `Tough Guy delayed death${player.toughGuyDeathCause ? ` (${player.toughGuyDeathCause})` : ""}`,
                    `Night ${currentNight}`
                );
                player.toughGuyDeathPending = false;
            }
        });

        players.forEach(player => {
            let attackCauses = player.nightAttackCauses || [];
            if (player.protectedFromWerewolvesTonight) {
                player.bodyguardBlockedOtherAttackTonight = attackCauses.filter(cause =>
                    (cause === "Witch attack" && roleRuleSettings.bodyguardProtectsWitch) ||
                    (cause === "Huntress attack" && roleRuleSettings.bodyguardProtectsHuntress)
                );
                attackCauses = attackCauses.filter(cause =>
                    !(cause === "Witch attack" && roleRuleSettings.bodyguardProtectsWitch) &&
                    !(cause === "Huntress attack" && roleRuleSettings.bodyguardProtectsHuntress)
                );
            }
            if (attackCauses.length) {
                const nonWerewolfCause = attackCauses.find(cause => cause !== "Werewolf attack");
                if (player.role === "Tough Guy" && !nonWerewolfCause) {
                    player.toughGuyDeathPending = true;
                    player.toughGuyDeathCause = "Werewolf attack";
                    player.attackedTonight = false;
                    player.attackedByWolvesTonight = false;
                } else {
                    recordElimination(
                        player,
                        nonWerewolfCause || "Werewolf attack",
                        player.pendingDeathPhase || `Night ${currentNight}`
                    );
                }
            }
        });

        diseasedKilledByWolves = players.some(player =>
            player.role === "Diseased" && player.wolfAttackCountsTonight
        );
        if (diseasedKilledByWolves) {
            wolvesDisabledNextNight = true;
        }

        updateWildChildren();
    }

    players.filter(player =>
        !player.alive && player.role === "Mad Bomber" && !player.bomberResolved && !madBomberShouldActivate(player)
    ).forEach(player => { player.bomberResolved = true; });

    const nightBomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved &&
        madBomberShouldActivate(player)
    );

    if (nightBomber) {
        nightBomber.resolveDuringMorning = true;
        drawMadBomberResolution(nightBomber);
        return;
    }

    const directlyEliminated = players.filter(player =>
        !player.alive
    );

    let newlyEliminated = directlyEliminated;

    while (newlyEliminated.length) {
        newlyEliminated = players.filter(player =>
            player.alive &&
            newlyEliminated.includes(player.connectedTo)
        );

        newlyEliminated.forEach(player => {
            recordElimination(
                player,
                player.connectionType === "cupid" ? "Cupid lover" : "Dire Wolf connection",
                `Night ${currentNight}`
            );
        });
    }

    updateWildChildren();

    const connectedNightBomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved &&
        madBomberShouldActivate(player)
    );

    if (connectedNightBomber) {
        connectedNightBomber.resolveDuringMorning = true;
        drawMadBomberResolution(connectedNightBomber);
        return;
    }

    players.filter(player =>
        !player.alive && player.role === "Hunter" && !player.hunterRevengeResolved && !hunterShouldActivate(player)
    ).forEach(player => { player.hunterRevengeResolved = true; });

    const nightHunter = players.find(player =>
        !player.alive &&
        player.role === "Hunter" &&
        !player.hunterRevengeResolved &&
        hunterShouldActivate(player)
    );

    if (nightHunter) {
        nightHunter.resolveDuringMorning = true;
        nightHunter.roleRevealed = true;
    }

    if (gameSettings.revealNightRoles) {
        players.filter(player =>
            !player.alive && player.deathPhase === `Night ${currentNight}`
        ).forEach(player => { player.roleRevealed = true; });
    }

    getNightModeratorDetails().forEach((detail, index) => {
        recordPhaseEvent(
            `Night ${currentNight}`,
            detail,
            `night-result-${currentNight}-${index}-${detail}`
        );
    });

    const livingWerewolves = players.filter(player =>
        player.alive && player.team === "Werewolf"
    );
    const livingVillagers = players.filter(player =>
        player.alive && player.team === "Villager"
    );
    const livingMayors = livingVillagers.filter(player => player.role === "Mayor");
    const livingVillagerParityCount = livingVillagers.length + (
        livingVillagers.some(player => player.role !== "Mayor") ? livingMayors.length : 0
    );

    if (
        !nightHunter &&
        ignoreWinConditions &&
        players.every(player => !player.alive)
    ) {
        drawGameResult("All players have been eliminated.");
        return;
    }

    if (
        !nightHunter &&
        !ignoreWinConditions &&
        !livingWerewolves.some(canChooseWerewolfElimination) &&
        !hasUnrevealedEliminationWerewolfDrunk()
    ) {
        drawGameResult(
            "Villagers win! All elimination-capable Werewolves have been eliminated.",
            "morning"
        );
        return;
    }

    if (
        !nightHunter &&
        !ignoreWinConditions &&
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.filter(countsForWerewolfParity).length >= livingVillagerParityCount
    ) {
        drawGameResult(
            getWerewolfVictoryMessage(livingWerewolves),
            "morning"
        );
        return;
    }

    const eliminated = players.filter(player =>
        !player.alive &&
        !player.deathAnnounced
    );
    const silenced = players.filter(player => player.silenced);
    const exiled = players.filter(player => player.exiledTonight);
    const statusRows = [
        ["Left the village", exiled],
        ["Silenced", silenced]
    ].filter(([, affectedPlayers]) => affectedPlayers.length)
        .map(([label, affectedPlayers]) =>
            `<p>${readAloud(`${label}: ${affectedPlayers.map(player => player.name).join(", ")}.`)}</p>`
        ).join("");
    const eliminationRows = eliminated.map(player =>
        `<p>${readAloud(`Eliminated: ${player.name}${player.roleRevealed ? ` — ${player.role}` : ""} — ${player.deathCause || player.pendingDeathCause || "Night attack"}.`)}</p>`
    ).join("");
    const summaryRows = statusRows + eliminationRows;
    const moderatorDetails = getNightModeratorDetails()
        .map(detail => `<li>${escapeHTML(detail)}</li>`)
        .join("");
    getNightModeratorDetails().forEach((detail, index) => {
        recordPhaseEvent(
            `Night ${currentNight}`,
            detail,
            `night-result-${currentNight}-${index}-${detail}`
        );
    });

    const hunterOptions = nightHunter ? players
        .filter(player => player.alive)
        .map(player => `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`)
        .join("") : "";
    const hunterControls = nightHunter ? `
        <hr>
        <h3>Hunter</h3>
        <p>${readAloud("Hunter, choose one player to eliminate, or choose nobody.")}</p>
        <select id="hunterTarget">
            <option value="">Select player</option>
            <option value="nobody">Nobody</option>
            ${hunterOptions}
        </select>
        <button class="actionContinue" type="button" onclick="resolveHunterRevenge(${players.indexOf(nightHunter)})">Continue ➜</button>
    ` : "";

    if (!nightHunter) {
        eliminated.forEach(player => {
            player.deathAnnounced = true;
        });
    }

    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <hr>
        <h3>${readAloud("Everyone, wake up and open your eyes.")}</h3>
        <hr>
        <h3>Night update</h3>
        ${summaryRows || `<p>${readAloud("Nothing happened overnight.")}</p>`}
        ${gameSettings.showModeratorDetails ? `<h3>Moderator details</h3><ul>${moderatorDetails}</ul>` : ""}
        ${hunterControls || `<button type="button" onclick="drawDayOnePlayers()">Start Day ${currentDay}</button>`}
    `;

}

function drawDayOnePlayers() {

    currentScreen = "day1";


    let html = `

        <h2>☀️ Day ${currentDay}</h2>

        <p>
            The players are awake.
        </p>

        <hr>

    `;


    // ========================================================
    // PLAYER LIST
    // ========================================================

    const unavailablePlayers = players.filter(player =>
        !player.alive ||
        player.exiledTonight ||
        !player.alive
    );
    const activePlayers = players.filter(player =>
        !unavailablePlayers.includes(player)
    );

    [...activePlayers, ...unavailablePlayers].forEach(player => {

        const index = players.indexOf(player);
        const unavailable = unavailablePlayers.includes(player);
        const status = !player.alive ?
            `Eliminated${player.deathCause ? ` - ${player.deathCause}` : ""}${player.deathPhase ? `, ${player.deathPhase}` : ""}` :
            "Left the village";
        const displayedRole = !player.alive ?
            `${player.roleRevealed ? "Role revealed" : "Role not revealed"} - ${player.role || "Unknown"}` :
            (player.role || "Unknown");
        const statusBadges = [
            player.team === "Werewolf" ? '<span class="statusBadge wolfBadge">🐺 Werewolf team</span>' : "",
            player.protected ? '<span class="statusBadge">🛡 Protected</span>' : "",
            player.blessedAgainstWerewolves ? '<span class="statusBadge blessedBadge">🙏 Blessed</span>' : "",
            player.silenced ? '<span class="statusBadge">🔇 Silenced</span>' : "",
            player.toughGuyDeathPending ? '<span class="statusBadge warningBadge">⏳ Delayed death</span>' : "",
            !player.alive ? '<span class="statusBadge deathBadge">💀 Eliminated</span>' : "",
            !player.alive && player.roleRevealed ? '<span class="statusBadge">👁 Role revealed</span>' : "",
            !player.alive && !player.roleRevealed ? '<span class="statusBadge">❓ Role hidden</span>' : ""
        ].filter(Boolean).join(" ");
        const voteButton = unavailable ? "" : `
            <button
                type="button"
                onclick="startVote(${index})"
            >
                Vote
            </button>
        `;

        html += `

            <div class="playerRow" style="${unavailable ? "opacity:.5; background:#444; color:#ddd;" : ""}">

                <div>

                    <strong>
                        ${escapeHTML(player.name)}${player.team === "Werewolf" ? " 🐺" : ""}
                    </strong>

                    <br>

                    <span>
                        ${escapeHTML(displayedRole)}
                    </span>

                    ${statusBadges ? `<div class="statusBadges">${statusBadges}</div>` : ""}

                    ${unavailable ? `<br><span>${status}</span>` : ""}

                </div>

                ${voteButton}

            </div>

        `;

    });


    // ========================================================
    // DAY INFORMATION
    // ========================================================

    html += `

        <hr>

        <h3>
            Day Phase
        </h3>

        <p>
            Choose a player to begin a vote.
        </p>

        <button type="button" onclick="startNextNight()">
            Skip to Night
        </button>

        <button type="button" onclick="drawCurrentGameSummary()">
            Current Game Summary
        </button>

        <button type="button" onclick="finishGame()">
            Finish Game
        </button>

    `;


    document.getElementById("screen").innerHTML = html;

}


// ============================================================
// VOTE
// ============================================================

function startVote(index) {

    const player = players[index];

    if (!player || !player.alive || player.exiledTonight) {
        return;
    }

    currentScreen = "vote";

    const eligibleVoters = players.filter(currentPlayer =>
        currentPlayer.alive && !currentPlayer.exiledTonight
    );
    const votesNeeded = Math.floor(eligibleVoters.length / 2) + 1;
    const mayor = players.find(currentPlayer =>
        currentPlayer.role === "Mayor" &&
        currentPlayer.alive &&
        !currentPlayer.exiledTonight
    );
    document.getElementById("screen").innerHTML = `
        <h2>Vote</h2>
        <p>${readAloud(`${player.name} is on trial.`)}</p>
        <p>Votes needed to eliminate: <strong>${votesNeeded}</strong></p>
        ${mayor ? `<div class="moderatorPanel"><strong>Moderator reminder:</strong> ${escapeHTML(mayor.name)} is the Mayor. Their vote counts twice.</div>` : ""}
        ${player.magistrateProtectedToday ? `<p class="infoCallout">The Magistrate has protected this player from today’s elimination vote.</p>` : ""}
        <button type="button" onclick="resolveVote(${index}, true)" ${player.magistrateProtectedToday ? "disabled" : ""}>Eliminate</button>
        <button type="button" onclick="resolveVote(${index}, false)">Spare</button>
        <button type="button" onclick="cancelVote()">Cancel Vote</button>
        <button type="button" onclick="kickPlayer(${index})">Kick</button>
    `;

}

function cancelVote() {

    drawDayOnePlayers();

}

function kickPlayer(index) {

    const player = players[index];

    if (!player || !player.alive) {
        return;
    }

    if (gameSettings.confirmKick) {
        showAppConfirmation(
            `Are you sure you want to kick ${player.name}? ` +
            "They will be eliminated and their role will remain unrevealed.",
            () => completeKick(index)
        );
        return;
    }

    completeKick(index);

}

function completeKick(index) {

    const player = players[index];
    if (!player || !player.alive) {
        return;
    }

    recordElimination(player, "Kicked", `Day ${currentDay}`);
    player.deathAnnounced = true;
    player.roleRevealed = false;

    const winMessage = getWinMessage();

    if (winMessage) {
        drawGameResult(winMessage, ignoreWinConditions ? null : "day");
        return;
    }

    drawDayOnePlayers();

}

function resolveVote(index, eliminate) {

    if (eliminate && players[index]) {
        if (players[index].magistrateProtectedToday) {
            alert("The Magistrate protected this player from today’s elimination vote.");
            return;
        }
        dayEliminationVoteOccurred = true;
        recordElimination(players[index], "Village vote", `Day ${currentDay}`);
        const martyr = players.find(player => player.alive && player.role === "Martyr" && !player.martyrUsed);
        if (martyr) {
            drawMartyrDecision(martyr, players[index]);
            return;
        }
        resolveEliminationConsequences();
        return;
    }

    savedVoteCount++;
    recordPhaseEvent(
        `Day ${currentDay}`,
        `The village spared ${players[index]?.name || "a player"}. Spare vote ${savedVoteCount} of 3.`,
        `day-spare-${currentDay}-${savedVoteCount}`
    );

    if (savedVoteCount >= 3) {
        startNextNight();
        return;
    }

    drawDayOnePlayers();

}

function drawMartyrDecision(martyr, eliminatedPlayer) {
    document.getElementById("screen").innerHTML = `
        <h2>Martyr</h2>
        <p>${readAloud("Would the Martyr like to take this player's role before it is revealed? Do nothing if not.")}</p>
        <div class="moderatorPanel">
            <label class="ruleToggle">
                <input id="martyrTakesRole" type="checkbox">
                <span><strong>The Martyr indicated they want the role</strong><small>Moderator only</small></span>
            </label>
        </div>
        <button type="button" onclick="confirmMartyrDecision(${players.indexOf(martyr)}, ${players.indexOf(eliminatedPlayer)})">Continue</button>`;
}

function confirmMartyrDecision(martyrIndex, eliminatedIndex) {
    resolveMartyrDecision(
        martyrIndex,
        eliminatedIndex,
        document.getElementById("martyrTakesRole")?.checked === true
    );
}

function resolveMartyrDecision(martyrIndex, eliminatedIndex, inheritRole) {
    const martyr = players[martyrIndex];
    const eliminatedPlayer = players[eliminatedIndex];
    if (martyr?.alive && eliminatedPlayer && inheritRole) {
        const inheritedRole = eliminatedPlayer.role;
        martyr.role = eliminatedPlayer.role;
        martyr.team = eliminatedPlayer.team;
        martyr.martyrUsed = true;
        eliminatedPlayer.publicRevealedRole = "Martyr";
        recordPhaseEvent(`Day ${currentDay}`, `${martyr.name}, the Martyr, inherited ${eliminatedPlayer.name}'s role before it was revealed.`, `martyr-${martyr.id}-${currentDay}`);
        document.getElementById("screen").innerHTML = `
            <h2>Martyr</h2>
            <p>${readAloud("Martyr, this is now your role.")}</p>
            <div class="privateRoleReveal">${escapeHTML(inheritedRole)}</div>
            <p class="moderatorPanel">Show this only to ${escapeHTML(martyr.name)}. The eliminated player’s card will be announced as Martyr.</p>
            <button type="button" onclick="finishMartyrDecision()">Continue</button>`;
        return;
    }
    resolveEliminationConsequences();
}

function finishMartyrDecision() {
    resolveEliminationConsequences();
}

function updateWildChildren() {
    players.filter(player =>
        player.alive &&
        player.role === "Wild Child" &&
        player.roleModel &&
        !player.roleModel.alive &&
        (player.roleModel.deathCause !== "Kicked" || roleRuleSettings.wildChildTransformsAfterKick) &&
        (roleDeathWasAtNight(player.roleModel) ?
            roleRuleSettings.wildChildTransformsAfterNightDeath :
            roleRuleSettings.wildChildTransformsAfterDayDeath) &&
        (player.roleModel.roleRevealed || roleRuleSettings.wildChildTransformsIfRoleHidden)
    ).forEach(player => {
        player.role = "Werewolf";
        player.team = "Werewolf";
        recordPhaseEvent(
            player.roleModel.deathPhase || `Day ${currentDay}`,
            `${player.name}, the Wild Child, became a Werewolf after their role model died.`,
            `wild-child-${player.id}-${player.roleModel.deathOrder || currentDay}`
        );
    });
}

function resolveEliminationConsequences() {

    let changed = true;

    while (changed) {
        changed = false;

        players.forEach(player => {
            const connectedPlayer = player.connectedTo;

            if (
                player.alive &&
                player.connectionType === "dire" &&
                connectedPlayer &&
                !connectedPlayer.alive
            ) {
                recordElimination(player, "Dire Wolf connection", `Day ${currentDay}`);
                changed = true;
            }

            if (
                !player.alive &&
                player.connectionType === "cupid" &&
                connectedPlayer?.alive
            ) {
                recordElimination(connectedPlayer, "Cupid lover", `Day ${currentDay}`);
                changed = true;
            }
        });
    }

    updateWildChildren();

    players.filter(player =>
        !player.alive && player.role === "Mad Bomber" && !player.bomberResolved && !madBomberShouldActivate(player)
    ).forEach(player => { player.bomberResolved = true; });

    const bomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved &&
        madBomberShouldActivate(player)
    );

    if (bomber) {
        drawMadBomberResolution(bomber);
        return;
    }

    players.filter(player =>
        !player.alive && player.role === "Hunter" && !player.hunterRevengeResolved && !hunterShouldActivate(player)
    ).forEach(player => { player.hunterRevengeResolved = true; });

    const hunter = players.find(player =>
        !player.alive &&
        player.role === "Hunter" &&
        !player.hunterRevengeResolved &&
        hunterShouldActivate(player)
    );

    if (hunter) {
        drawHunterRevenge(hunter);
        return;
    }

    drawEliminationReveal();

}

function drawMadBomberResolution(bomber) {

    bomber.roleRevealed = true;

    const availablePlayers = players.filter(player => player.alive);
    const options = availablePlayers.map(player =>
        `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`
    ).join("");

    document.getElementById("screen").innerHTML = `
        ${bomber.resolveDuringMorning ? `<h2>☀️ Day ${currentDay}</h2><hr><h3>Night update</h3>` : ""}
        <h2>Mad Bomber</h2>
        <p>${readAloud("The Mad Bomber was eliminated.")}</p>
        <p>Select the players currently seated directly to the Mad Bomber's left and right, or choose nobody.</p>
        <select id="bomberTargetOne"><option value="">Current left neighbor</option>${options}</select>
        <select id="bomberTargetTwo"><option value="">Current right neighbor</option>${options}</select>
        <div class="actionButtons">
            <button type="button" onclick="resolveMadBomber(${players.indexOf(bomber)})">Continue</button>
            <button type="button" onclick="resolveMadBomber(${players.indexOf(bomber)}, true)">Nobody</button>
        </div>
    `;

}

function resolveMadBomber(bomberIndex, chooseNobody = false) {

    const first = document.getElementById("bomberTargetOne");
    const second = document.getElementById("bomberTargetTwo");
    const bomber = players[bomberIndex];

    if (!bomber) {
        return;
    }

    if (!chooseNobody && (!first || !second || first.value === "" || second.value === "" || first.value === second.value)) {
        alert("Please select two different players.");
        return;
    }

    if (!chooseNobody) {
        const eliminationPhase = bomber.resolveDuringMorning ?
            (bomber.deathPhase || `Night ${currentNight}`) :
            `Day ${currentDay}`;
        recordElimination(players[Number(first.value)], "Mad Bomber", eliminationPhase);
        recordElimination(players[Number(second.value)], "Mad Bomber", eliminationPhase);
    } else {
        recordPhaseEvent(
            bomber.deathPhase || `Day ${currentDay}`,
            "The Mad Bomber selected Nobody; no additional players were eliminated.",
            `mad-bomber-nobody-${bomber.id}-${bomber.deathPhase || currentDay}`
        );
    }

    bomber.bomberResolved = true;

    if (bomber.resolveDuringMorning) {
        bomber.resolveDuringMorning = false;
        resumeMorningAfterSpecialResolution = true;
        drawDayOne();
        return;
    }

    resolveEliminationConsequences();

}

function drawHunterRevenge(hunter) {

    hunter.roleRevealed = true;

    const options = players.filter(player => player.alive).map(player =>
        `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`
    ).join("");

    document.getElementById("screen").innerHTML = `
        ${hunter.resolveDuringMorning ? `<h2>☀️ Day ${currentDay}</h2><hr><h3>Night update</h3>` : ""}
        <h2>Hunter</h2>
        <p>The Hunter was eliminated. Choose one player to eliminate.</p>
        <select id="hunterTarget">
            <option value="">Select player</option>
            <option value="nobody">Nobody</option>
            ${options}
        </select>
        <button type="button" onclick="resolveHunterRevenge(${players.indexOf(hunter)})">Continue</button>
    `;

}

function resolveHunterRevenge(hunterIndex) {

    const target = document.getElementById("hunterTarget");

    if (!target || target.value === "") {
        alert("Please select a player.");
        return;
    }

    const hunter = players[hunterIndex];
    const eliminationPhase = hunter.resolveDuringMorning ?
        (hunter.deathPhase || `Night ${currentNight}`) :
        `Day ${currentDay}`;

    if (target.value !== "nobody") {
        recordElimination(players[Number(target.value)], "Hunter", eliminationPhase);
    } else {
        recordPhaseEvent(
            eliminationPhase,
            "The Hunter selected Nobody; no revenge elimination occurred.",
            `hunter-nobody-${hunter.id}-${eliminationPhase}`
        );
    }
    hunter.hunterRevengeResolved = true;

    if (hunter.resolveDuringMorning) {
        hunter.resolveDuringMorning = false;
        resumeMorningAfterSpecialResolution = true;
        drawDayOne();
        return;
    }

    resolveEliminationConsequences();

}

function drawEliminationReveal() {

    const newlyEliminated = players.filter(player =>
        !player.alive && !player.deathAnnounced
    );
    const revealRows = newlyEliminated.map(player =>
        `<li>${readAloud(`${player.name} was the ${player.publicRevealedRole || player.role || "Villager"}.`)}</li>`
    ).join("");

    newlyEliminated.forEach(player => {
        player.deathAnnounced = true;
        player.roleRevealed = true;
    });

    const winMessage = getWinMessage();

    if (winMessage) {
        drawGameResult(winMessage, ignoreWinConditions ? null : "postVote");
        return;
    }

    document.getElementById("screen").innerHTML = `
        <h2>Elimination</h2>
        <p>The following roles are revealed:</p>
        <ul>${revealRows}</ul>
        <button type="button" onclick="drawEveryoneGoToSleep()">Continue</button>
    `;

}

function drawGameResult(message, continuation = null, reviewOnly = false) {

    if (!reviewOnly) {
        gameResultContinuation = continuation;
    }
    sanitizePhaseHistory();

    const livingPlayers = players.filter(player => player.alive);
    const deadPlayers = players
        .filter(player => !player.alive)
        .sort((first, second) =>
            Number(first.deathOrder || Number.MAX_SAFE_INTEGER) -
            Number(second.deathOrder || Number.MAX_SAFE_INTEGER)
        );
    const livingRows = livingPlayers.length ? livingPlayers.map(player => `
        <li>
            <strong>${escapeHTML(player.name)}</strong> —
            ${escapeHTML(player.role || "Unknown")}
        </li>
    `).join("") : "<li>None</li>";
    const eliminatedRosterRows = deadPlayers.length ? deadPlayers.map(player => `
        <li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(player.role || "Unknown")}</li>
    `).join("") : "<li>None</li>";
    const deadGroups = [];

    deadPlayers.forEach(player => {
        const phase = player.deathPhase || "Unknown phase";
        let group = deadGroups.find(currentGroup => currentGroup.phase === phase);

        if (!group) {
            group = { phase, players: [] };
            deadGroups.push(group);
        }

        group.players.push(player);
    });

    const deadRows = deadGroups.length ? deadGroups.map(group => `
        <h3>${escapeHTML(group.phase)}</h3>
        <ul>
            ${group.players.map(player => `
                <li>
                    <strong>${escapeHTML(player.name)}</strong> —
                    ${escapeHTML(player.role || "Unknown")} —
                    ${escapeHTML(player.deathCause || "Unknown cause")}
                </li>
            `).join("")}
        </ul>
    `).join("") : "<p>No players were eliminated.</p>";
    const timelinePhases = [...new Set([
        ...phaseHistory.map(event => event.phase),
        ...deadPlayers.map(player => player.deathPhase || "Unknown phase"),
        ...(reviewOnly && currentDay > 0 ? [`Day ${currentDay}`] : [])
    ])].sort((first, second) => {
        const firstMatch = /^(Night|Day) (\d+)$/.exec(first);
        const secondMatch = /^(Night|Day) (\d+)$/.exec(second);
        if (!firstMatch || !secondMatch) {
            return first.localeCompare(second);
        }
        const numberDifference = Number(firstMatch[2]) - Number(secondMatch[2]);
        return numberDifference || (firstMatch[1] === "Night" ? -1 : 1);
    });
    const timelineRows = timelinePhases.length ? timelinePhases.map(phase => {
        const events = phaseHistory.filter(event => event.phase === phase);
        const recordedDeathOrders = new Set();
        const displayedEventTexts = new Set();
        let eventRows = events.map(event => {
            let displayText = event.text;
            if (event.key?.startsWith("elimination-")) {
                const order = Number(event.key.replace("elimination-", ""));
                recordedDeathOrders.add(order);
                const player = deadPlayers.find(candidate => candidate.deathOrder === order);
                if (player) {
                    displayText = `${player.name} was eliminated by ${player.deathCause || "an unknown cause"}.`;
                }
            }
            if (displayedEventTexts.has(displayText)) {
                return "";
            }
            displayedEventTexts.add(displayText);
            return `<li>${escapeHTML(displayText)}</li>`;
        }).join("");
        eventRows += deadPlayers
            .filter(player =>
                (player.deathPhase || "Unknown phase") === phase &&
                !recordedDeathOrders.has(player.deathOrder)
            )
            .map(player => `<li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(player.role || "Unknown")} — ${escapeHTML(player.deathCause || "Unknown cause")}</li>`)
            .join("");
        const emptyPhaseText = reviewOnly && phase === `Day ${currentDay}` ?
            "<li>Day in progress; no elimination vote has been completed.</li>" :
            "<li>No recorded events.</li>";
        return `<h3>${escapeHTML(phase)}</h3><ul>${eventRows || emptyPhaseText}</ul>`;
    }).join("") : "<p>No game events were recorded.</p>";

    document.getElementById("screen").innerHTML = `
        ${reviewOnly ? "" : `<h2>Game Over</h2><p>${readAloud(message)}</p><hr>`}
        <h2>Game Summary</h2>
        <h3>Still Alive</h3>
        <ul>${livingRows}</ul>
        <h3>Eliminated</h3>
        <ul>${eliminatedRosterRows}</ul>
        <h3>Full Game Timeline</h3>
        ${timelineRows}
        ${reviewOnly ? `<button type="button" onclick="drawDayOnePlayers()">Return to Day ${currentDay}</button>` : `
            ${continuation ? `<button type="button" onclick="continueGame()">Continue Game</button>` : ""}
            <button type="button" onclick="promptToSaveGameSetup()">Save Game</button>
            <button type="button" onclick="newGame()">New Game</button>
        `}
        <button type="button" onclick="downloadGameSummary()">Download Summary (.txt)</button>
    `;

}

function drawCurrentGameSummary() {

    currentScreen = "summaryReview";
    drawGameResult("", null, true);

}

function buildGameSummaryText() {

    sanitizePhaseHistory();
    const livingPlayers = players.filter(player => player.alive);
    const deadPlayers = players
        .filter(player => !player.alive)
        .sort((first, second) =>
            Number(first.deathOrder || Number.MAX_SAFE_INTEGER) -
            Number(second.deathOrder || Number.MAX_SAFE_INTEGER)
        );
    const phases = [...new Set([
        ...phaseHistory.map(event => event.phase),
        ...deadPlayers.map(player => player.deathPhase || "Unknown phase")
    ])].sort((first, second) => {
        const firstMatch = /^(Night|Day) (\d+)$/.exec(first);
        const secondMatch = /^(Night|Day) (\d+)$/.exec(second);
        if (!firstMatch || !secondMatch) {
            return first.localeCompare(second);
        }
        const numberDifference = Number(firstMatch[2]) - Number(secondMatch[2]);
        return numberDifference || (firstMatch[1] === "Night" ? -1 : 1);
    });
    const lines = [
        "Ultimate Werewolf Assistant — Game Summary",
        "",
        "Still Alive",
        ...(livingPlayers.length ? livingPlayers.map(player =>
            `${player.name} - ${player.role || "Unknown"}`
        ) : ["None"]),
        "",
        "Eliminated",
        ...(deadPlayers.length ? deadPlayers.map(player =>
            `${player.name} - ${player.role || "Unknown"}`
        ) : ["None"]),
        "",
        "Full Game Timeline"
    ];

    phases.forEach(phase => {
        lines.push("", phase);
        const events = phaseHistory.filter(event => event.phase === phase);
        const recordedOrders = new Set();
        const writtenEventTexts = new Set();
        events.forEach(event => {
            let displayText = event.text;
            if (event.key?.startsWith("elimination-")) {
                const order = Number(event.key.replace("elimination-", ""));
                recordedOrders.add(order);
                const player = deadPlayers.find(candidate => candidate.deathOrder === order);
                if (player) {
                    displayText = `${player.name} was eliminated by ${player.deathCause || "an unknown cause"}.`;
                }
            }
            if (!writtenEventTexts.has(displayText)) {
                writtenEventTexts.add(displayText);
                lines.push(displayText);
            }
        });
        deadPlayers.filter(player =>
            (player.deathPhase || "Unknown phase") === phase &&
            !recordedOrders.has(player.deathOrder)
        ).forEach(player => {
            lines.push(`${player.name} - ${player.role || "Unknown"} - ${player.deathCause || "Unknown cause"}`);
        });
    });

    return lines.join("\r\n");

}

function downloadGameSummary() {

    const blob = new Blob([buildGameSummaryText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `werewolf-game-summary-day-${Math.max(currentDay, 1)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

}

function continueGame() {

    const continuation = gameResultContinuation;
    ignoreWinConditions = true;
    gameResultContinuation = null;

    if (continuation === "morning") {
        players.forEach(player => {
            if (!player.alive && !player.deathAnnounced) {
                player.deathAnnounced = true;
            }
        });
        drawDayOnePlayers();
        return;
    }

    if (continuation === "postVote") {
        drawEveryoneGoToSleep();
        return;
    }

    drawDayOnePlayers();

}

function finishGame() {

    showAppConfirmation("Finish this game and clear its saved progress?", completeFinishGame);

}

function completeFinishGame() {

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }

    persistenceDisabled = true;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameState = null;
    updateBackButton();
    gameResultContinuation = null;
    drawGameResult("The moderator ended the game.");

}

function newGame() {

    persistenceDisabled = false;
    clearTimeout(saveGameTimer);
    saveGameTimer = null;
    restoringPreviousScreen = false;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameState = null;
    updateBackButton();

    players = players.map(player => ({
        id: player.id,
        name: player.name,
        role: null,
        alive: true,
        connectedTo: null
    }));
    const selectedRoleCounts = new Map(
        roles.map(role => [role.role, Math.max(0, Number(role.count) || 0)])
    );
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: selectedRoleCounts.get(role.role) || 0
    }));
    currentScreen = "players";
    nightOneWakeOrder = [];
    nightOneActionOrder = [];
    nightOneCurrentRole = 0;
    nightOneCurrentAction = 0;
    nightOneActionMode = null;
    isLaterNight = false;
    savedVoteCount = 0;
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;
    wolfEliminationsTonight = 1;
    currentNight = 1;
    currentDay = 0;
    leftoverCardRole = null;
    resumeMorningAfterSpecialResolution = false;
    roleSearchTerm = "";
    eliminationSequence = 0;
    roleSortMode = "alphabetical-asc";
    roleTeamFilter = "all";
    roleSelectedOnly = false;
    ignoreWinConditions = false;
    gameResultContinuation = null;
    phaseHistory = [];
    dayEliminationVoteOccurred = false;
    roleRuleSettings = { ...defaultRoleRuleSettings };
    gameSettings = { ...defaultGameSettings };

    drawPlayerScreen();

}

function getWinMessage() {

    if (ignoreWinConditions) {
        return players.every(player => !player.alive) ?
            "All players have been eliminated." :
            null;
    }

    const livingWerewolves = players.filter(player =>
        player.alive && player.team === "Werewolf"
    );
    const livingVillagers = players.filter(player =>
        player.alive && player.team === "Villager"
    );
    const livingMayors = livingVillagers.filter(player => player.role === "Mayor");
    const livingVillagerParityCount = livingVillagers.length + (
        livingVillagers.some(player => player.role !== "Mayor") ? livingMayors.length : 0
    );

    if (
        !livingWerewolves.some(canChooseWerewolfElimination) &&
        !hasUnrevealedEliminationWerewolfDrunk()
    ) {
        return "Villagers win! All elimination-capable Werewolves have been eliminated.";
    }

    if (
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.filter(countsForWerewolfParity).length >= livingVillagerParityCount
    ) {
        return getWerewolfVictoryMessage(livingWerewolves);
    }

    return null;

}

function getWerewolfVictoryMessage(livingWerewolves) {

    const livingEliminationWolves = livingWerewolves.filter(canChooseWerewolfElimination);
    if (
        livingEliminationWolves.length === 1 &&
        livingEliminationWolves[0].role === "Lone Wolf"
    ) {
        return "Lone-Wolf wins! The Werewolf team now equals or outnumbers the Villager team.";
    }

    return "Werewolves win! They now equal or outnumber the Villager team.";

}

function hasUnrevealedEliminationWerewolfDrunk() {

    return leftoverCardRole?.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(leftoverCardRole.role) &&
        players.some(player =>
        player.isOriginalDrunk && player.alive && !player.drunkCardReceived
    );

}

function drawEveryoneGoToSleep() {

    document.getElementById("screen").innerHTML = `
        <h1>${readAloud("Everyone, go to sleep.")}</h1>
        <p>${readAloud("Everyone, close your eyes.")}</p>
        <button type="button" onclick="startNextNight()">Start Night</button>
    `;

}

// ============================================================
// HTML ESCAPING
// ============================================================

function moderatorRoleName(roleName) {

    return roleName === "Werewolf" ? "Werewolves" : roleName;

}

function recordElimination(player, cause, phase) {

    if (!player) {
        return;
    }

    player.alive = false;

    if (!player.deathCause) {
        player.deathCause = cause;
        player.deathPhase = phase;
        player.deathOrder = ++eliminationSequence;
        player.eliminationEvent = {
            cause,
            phase,
            order: player.deathOrder,
            roleRevealed: player.roleRevealed === true
        };
        recordPhaseEvent(
            phase,
            `${player.name} was eliminated — ${cause}.`,
            `elimination-${player.deathOrder}`
        );
    }

}

function canChooseWerewolfElimination(player) {

    return player.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(player.role);

}

function countsForWerewolfParity(player) {
    if (player.role === "Minion") return roleRuleSettings.minionCountsForWerewolfParity;
    if (player.role === "Fruit Brute") return roleRuleSettings.fruitBruteCountsForWerewolfParity;
    if (player.role === "Sorceress") return roleRuleSettings.sorceressCountsForWerewolfParity;
    return player.team === "Werewolf";
}

function readAloud(text) {

    return `<q>${escapeHTML(text)}</q>`;

}

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.addPlayer = addPlayer;
window.removePlayer = removePlayer;
window.removeAllPlayers = removeAllPlayers;
window.drawPlayerScreen = drawPlayerScreen;
window.drawRoleScreen = drawRoleScreen;
window.filterRoleList = filterRoleList;
window.setRoleSortMode = setRoleSortMode;
window.changeRole = changeRole;
window.removeAllRoles = removeAllRoles;
window.drawGameConfirmation = drawGameConfirmation;
window.startNightOne = startNightOne;
window.confirmLeftoverCard = confirmLeftoverCard;
window.drawNightRole = drawNightRole;
window.confirmNightRole = confirmNightRole;
window.confirmNightAction = confirmNightAction;
window.advanceNightAction = advanceNightAction;
window.advanceNightRole = advanceNightRole;
window.setNightActionMode = setNightActionMode;
window.updateNeighborAvailability = updateNeighborAvailability;
window.drawDayOne = drawDayOne;
window.drawDayOnePlayers = drawDayOnePlayers;
window.startVote = startVote;
window.cancelVote = cancelVote;
window.kickPlayer = kickPlayer;
window.resolveVote = resolveVote;
window.resolveMartyrDecision = resolveMartyrDecision;
window.confirmMartyrDecision = confirmMartyrDecision;
window.finishMartyrDecision = finishMartyrDecision;
window.startNextNight = startNextNight;
window.showRoleInfo = showRoleInfo;
window.showGameGuide = showGameGuide;
window.setRoleRuleOption = setRoleRuleOption;
window.setRoleTeamFilter = setRoleTeamFilter;
window.setRoleSelectedOnly = setRoleSelectedOnly;
window.showGameSettings = showGameSettings;
window.setGameSetting = setGameSetting;
window.resetGameSettings = resetGameSettings;
window.showDesignSettings = showDesignSettings;
window.setDesignSetting = setDesignSetting;
window.resetDesignSettings = resetDesignSettings;
window.showSavedGames = showSavedGames;
window.promptToSaveGameSetup = promptToSaveGameSetup;
window.saveNamedGameSetup = saveNamedGameSetup;
window.loadSavedGameSetup = loadSavedGameSetup;
window.deleteSavedGameSetup = deleteSavedGameSetup;
window.continueNightAfterDrunkCard = continueNightAfterDrunkCard;
window.resolveMadBomber = resolveMadBomber;
window.resolveHunterRevenge = resolveHunterRevenge;
window.drawEveryoneGoToSleep = drawEveryoneGoToSleep;
window.drawCurrentGameSummary = drawCurrentGameSummary;
window.downloadGameSummary = downloadGameSummary;
window.continueGame = continueGame;
window.finishGame = finishGame;
window.goBackOneScreen = goBackOneScreen;
window.newGame = newGame;
