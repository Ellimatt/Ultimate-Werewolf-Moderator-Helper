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
let nightOneDeferredActions = [];
let resolvingNightOneDeferredActions = false;
let isLaterNight = false;
let savedVoteCount = 0;
let wolvesDisabledNextNight = false;
let wolvesDisabledTonight = false;
let wolfEliminationsTonight = 1;
let bloodWolfBypassesProtectionTonight = false;
let currentNight = 1;
let currentDay = 0;
let leftoverCardRole = null;
let thingCardRole = null;
let resumeMorningAfterSpecialResolution = false;
let roleSearchTerm = "";
let eliminationSequence = 0;
let roleSortMode = "alphabetical-asc";
let roleTeamFilter = "all";
let roleValueFilter = "all";
let roleSelectedOnly = false;
let ignoreWinConditions = false;
let gameResultContinuation = null;
let gameResultMessage = null;
let phaseHistory = [];
let dayEliminationVoteOccurred = false;
let nightTargetRecords = [];
let lastActionDescription = "the last action";
const legacyRoleNames = {
    "Nightstalker": "Mystic Wolf",
    "Bloodscent": "Death Hound",
    "Black Wolf": "Shadow Wolf",
    "Pack's Hunger": "Ravenous Wolf",
    "Pack's Bond": "Vengeful Wolf",
    "Night Watch": "Sentry",
    "Nightwatch": "Sentry",
    "Watchman": "Sentinel",
    "Blood Wolf": "Crimson Wolf"
};

function canonicalRoleName(roleName) {
    return legacyRoleNames[roleName] || roleName;
}

function canonicalizeRoleText(text) {
    let updatedText = text;
    if (typeof updatedText !== "string") return updatedText;
    Object.entries(legacyRoleNames).forEach(([oldName, newName]) => {
        updatedText = updatedText.split(oldName).join(newName);
    });
    return updatedText;
}
const defaultRoleRuleSettings = {
    bodyguardProtectsWitch: false,
    bodyguardProtectsHuntress: false,
    bodyguardCannotRepeatTarget: true,
    bodyguardBlocksAlphaConversion: true,
    priestBlessingBlocksAlphaConversion: true,
    blacksmithArmorBlocksAlphaConversion: false,
    alphaFailedConversionUsesAbility: true,
    wolfCubKickActivatesBonus: false,
    hunterActivatesAtNight: false,
    lycanAppearsWerewolfToPI: false,
    lycanDisguisesRoleFromMysticSeer: false,
    lycanAppearsWerewolfToCanary: false,
    wolfManHiddenFromPI: false,
    wolfManDisguisesRoleFromMysticSeer: false,
    wolfManHiddenFromCanary: false,
    madBomberActivatesDuringNight: true,
    sorceressRevealsWerewolf: false,
    wildChildTransformsAfterKick: true,
    wildChildTransformsAfterDayDeath: true,
    wildChildTransformsAfterNightDeath: true,
    beholderWakesOnFutureNights: false,
    trackerCountsLycanAsWolf: false,
    trackerHidesWolfMan: false,
    minionCountsForWerewolfParity: true,
    fruitBruteCountsForWerewolfParity: true,
    sorceressCountsForWerewolfParity: true,
    mentalistCannotRepeatPlayers: true,
    graveDiggerLearnsLinkedDeaths: false,
    judgeMayPardonSelf: true,
    watchmanCountsEachWerewolfVisitor: false,
    cupidMayLinkSelf: true,
    oldHagMayTargetSelf: true,
    oldHagMayRepeatTarget: false,
    blackWolfMaySilenceSelf: true,
    blackWolfMayRepeatTarget: false,
    spellcasterMaySilenceSelf: true,
    spellcasterMayRepeatTarget: false,
    seerMayInspectSelf: true,
    seerMayRepeatTarget: false,
    packsHungerCountsShepherdFlock: true,
    voodooDollTargetSurvives: true,
    locksmithMayTargetSelf: false,
    locksmithCannotRepeatTarget: true,
    witchDoctorMayTargetSelf: false,
    witchDoctorCannotRepeatTarget: true,
    magistrateMayTargetSelf: false,
    magistrateCannotRepeatTarget: true,
    watchmanCannotRepeatTarget: true,
    thingParticipatesWolfEliminations: true,
    phantomAppearsWolfToSeer: true,
    phantomAppearsWolfToMysticSeer: true,
    phantomAppearsWolfToPI: true,
    phantomAppearsWolfToTracker: true,
    phantomAppearsWolfToCanary: true,
    phantomAppearsWolfToSorceress: true
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
const roleRulesStorageKey = "ultimateWerewolfAssistant.roleRules";
const gameSettingsStorageKey = "ultimateWerewolfAssistant.gameSettings";
const defaultDesignSettings = { theme: "classic", largeText: false, compactRows: false, keepAwake: false };
let designSettings = { ...defaultDesignSettings };
const savedGameStorageKey = "ultimateWerewolfAssistant.savedGame";
const savedGameVersion = 5;
let persistenceDisabled = false;
let saveGameTimer = null;
let lastSavedGameState = null;
let backSavedGameState = null;
let restoringPreviousScreen = false;
let wakeLock = null;

// ============================================================
// INITIALIZE APP
// ============================================================

let appInitializationStarted = false;

async function initializeWerewolfApp() {

    if (appInitializationStarted) return;
    appInitializationStarted = true;

    await Promise.all([loadRoles(), loadActions()]);
    loadDesignSettings();
    loadPersistentRuleSettings();

    if (!restoreSavedGame()) {
        drawPlayerScreen();
    }

    startGamePersistence();
    updateWakeLock();

}

window.initializeWerewolfApp = initializeWerewolfApp;

if (!window.WEREWOLF_DEFER_START) {
    if (!document.readyState || document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeWerewolfApp);
    } else {
        initializeWerewolfApp();
    }
}

function pickKnownSettings(defaults, saved) {
    return Object.fromEntries(Object.keys(defaults).map(key => [
        key,
        saved && Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : defaults[key]
    ]));
}

function migrateSavedGame(savedData) {
    if (!savedData) return null;
    const version = Number(savedData.saveVersion || 1);
    if (version > savedGameVersion) return null;
    const migrated = savedData.current ? { ...savedData } : { current: savedData, back: null };
    [migrated.current, migrated.back].filter(Boolean).forEach(state => {
        const migrateRoleObject = role => {
            if (role?.role) role.role = canonicalRoleName(role.role);
            return role;
        };
        (state.players || []).forEach(player => {
            ["role", "nightOneAssignedRole", "publicRevealedRole", "roleBeforeMartyrExchange", "doppelgangerInheritedRole", "thingSecondaryRole"]
                .forEach(key => {
                    if (player[key]) player[key] = canonicalRoleName(player[key]);
                });
        });
        (state.roles || []).forEach(migrateRoleObject);
        (state.nightOneWakeOrder || []).forEach(migrateRoleObject);
        (state.nightOneActionOrder || []).forEach(item => migrateRoleObject(item.role));
        (state.nightOneDeferredActions || []).forEach(item => migrateRoleObject(item.role));
        migrateRoleObject(state.leftoverCardRole);
        migrateRoleObject(state.thingCardRole);
        state.screenHTML = canonicalizeRoleText(state.screenHTML);
        const legacyAlphaProtection = state.roleRuleSettings?.werewolfProtectionBlocksAlphaConversion;
        state.roleRuleSettings = pickKnownSettings(defaultRoleRuleSettings, state.roleRuleSettings);
        if (typeof legacyAlphaProtection === "boolean") {
            state.roleRuleSettings.bodyguardBlocksAlphaConversion = legacyAlphaProtection;
            state.roleRuleSettings.priestBlessingBlocksAlphaConversion = legacyAlphaProtection;
        }
        state.gameSettings = pickKnownSettings(defaultGameSettings, state.gameSettings);
        state.phaseHistory = (Array.isArray(state.phaseHistory) ? state.phaseHistory : []).map((event, index) => ({
            type: event.type || (event.key?.startsWith("elimination-") ? "elimination" : "note"),
            id: event.id || event.key || `legacy-${index}`,
            ...event,
            text: canonicalizeRoleText(event.text)
        }));
    });
    migrated.saveVersion = savedGameVersion;
    return migrated;
}

async function updateWakeLock() {
    if (!designSettings.keepAwake || !players.some(player => player.role) || !navigator.wakeLock?.request) {
        if (wakeLock) await wakeLock.release().catch(() => {});
        wakeLock = null;
        return;
    }
    if (!wakeLock) {
        try {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => { wakeLock = null; });
        } catch (error) {
            console.warn("The screen could not be kept awake.", error);
        }
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateWakeLock();
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
        watchedPlayerTonightIndex: players.indexOf(player.watchedPlayerTonight),
        lastProtectedPlayerIndex: players.indexOf(player.lastProtectedPlayer),
        lastBarricadedPlayerIndex: players.indexOf(player.lastBarricadedPlayer),
        lastVoodooPlayerIndex: players.indexOf(player.lastVoodooPlayer),
        lastMagistratePlayerIndex: players.indexOf(player.lastMagistratePlayer),
        lastWatchedPlayerIndex: players.indexOf(player.lastWatchedPlayer),
        petOwnerIndex: players.indexOf(player.petOwner),
        connectedTo: undefined,
        doppelgangerTarget: undefined,
        lastLeftNeighbor: undefined,
        lastRightNeighbor: undefined,
        roleModel: undefined,
        butcherRedirectTarget: undefined,
        watchedPlayerTonight: undefined
        ,lastProtectedPlayer: undefined
        ,lastBarricadedPlayer: undefined
        ,lastVoodooPlayer: undefined
        ,lastMagistratePlayer: undefined
        ,lastWatchedPlayer: undefined
        ,petOwner: undefined
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
            const currentRole = !isDay ? nightOneActionOrder[nightOneCurrentAction]?.role?.role : null;
            phaseHeader.textContent = `${phase}${progress}${currentRole ? ` • ${moderatorRoleName(currentRole)}` : ""} • ${alive} Alive`;
            phaseHeader.setAttribute("aria-live", "polite");
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
        if (["Eliminate", "Kick", "End Game", "Remove All Players", "Remove All Roles"].some(text => label.includes(text))) {
            button.classList.add("dangerButton");
        }
    });

}

function activateModal(overlay, initialControl, allowEscape = true) {
    const previouslyFocused = document.activeElement;
    const close = () => {
        overlay.remove();
        if (previouslyFocused?.focus) previouslyFocused.focus();
    };
    overlay.addEventListener("keydown", event => {
        if (event.key === "Escape" && allowEscape) {
            event.preventDefault();
            close();
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...overlay.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")]
            .filter(control => !control.disabled && !control.hidden);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    (initialControl || overlay.querySelector("button, input, select"))?.focus();
    return close;
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
    const close = activateModal(overlay, overlay.querySelector("[data-modal-cancel]"));
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", close);
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => {
        close();
        onConfirm();
    });

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
    const close = activateModal(overlay, okButton);
    okButton.addEventListener("click", close);

}

window.alert = showAppAlert;

const roleHelpText = {
    "Alpha Wolf": "A Werewolf who may replace one Werewolf elimination with a conversion once per game.",
    "Beholder": "Privately learns who the Seer is. Optional rules can provide updates when another player becomes the Seer.",
    "Shadow Wolf": "A Werewolf who also silences one player each night.",
    "Butcher": "Chooses a player on the first night. If the Werewolves attack the Butcher, the chosen player is eliminated instead.",
    "Apprentice Seer": "Becomes a Seer when the Seer dies.",
    "Bodyguard": "Chooses a player each night to protect from Werewolf attacks.",
    "Cupid": "Links two players on the first night. When either lover dies, the other dies as well.",
    "Cursed": "Begins on the Villager team but becomes a Werewolf when attacked.",
    "Dire Wolf": "Connects themself to a player. If that player dies, the Dire Wolf also dies. The connection does not work in reverse.",
    "Diseased": "If eliminated by the Werewolves, their elimination choice on the following night does not count.",
    "Doppelganger": "Chooses a player and privately checks their role each night. When that player dies, the Doppelganger inherits their role.",
    "Drunk": "Appears and behaves as a Villager until receiving their true role at the start of Night 3.",
    "Hunter": "When eliminated, They may chooses one living player to eliminate as well.",
    "Huntress": "May choose one player to eliminate once per game.",
    "Insomniac": "Learns whether either of the two players currently seated beside them took an action that night.",
    "Lone Wolf": "A wolf who wins when they are the only wolf left in the game.",
    "Lycan": "A Villager who appears as a Werewolf.",
    "Mad Bomber": "When eliminated, they also eliminates the two living players currently seated beside them.",
    "Magistrate": "Chooses one player each night who may not be eliminated by the village vote the following day.",
    "Martyr": "Before a Day-vote role is revealed, they may inherit that role. The village sees the Martyr card in its place.",
    "Mason": "A Villager who identifies the other Masons.",
    "Mayor": "A Villager whose vote counts twice. The moderator tracks the additional vote without revealing the Mayor.",
    "Mentalist": "Compares two selected players and learns whether they are on the same team.",
    "Minion": "Knows the Werewolves and wins with their team, but do not wake with them.",
    "Mystic Seer": "Selects a player and learns that player's exact role.",
    "Old Hag": "Selects a player who must leave the village for the following day.",
    "P.I.": "Checks a player and the players currently seated beside them, learning whether the group contains a Werewolf.",
    "Pacifist": "Always votes to spare the accused player. The moderator accounts for that vote without revealing the Pacifist.",
    "Priest": "Permanently blesses one player against all future Werewolf attacks. Other causes can still eliminate that player.",
    "Prince": "When voted for elimination, the Prince is revealed and remains in the game. The Prince can be eliminated by any other cause.",
    "Revealer": "May reveal a player's role once per game. A Werewolf-team target is eliminated; an incorrect target eliminates the Revealer.",
    "Seer": "Selects a player and learns whether that player appears as a Werewolf.",
    "Sorceress": "Searches for the Seer and wins with the Werewolf team, but does not wake with them. An optional rule can identify Werewolves separately from Other.",
    "Sasquatch": "Begins as a Villager and becomes a Werewolf after a Day ends without an elimination.",
    "Shepherd": "The flock absorbs the first Werewolf attack against the Shepherd. Later Werewolf attacks eliminate the Shepherd normally.",
    "Spellcaster": "Silences one player for the following day.",
    "Tough Guy": "A Werewolf attack does not eliminate the Tough Guy until the following Night. Other deaths are immediate.",
    "Tracker": "When a currently adjacent player is eliminated by the Werewolves, may inspect one player for a Werewolf.",
    "Village Idiot": "Always votes to eliminate the accused player. The moderator accounts for that vote without revealing the Village Idiot.",
    "Villager": "Has no night action and wins with the Villager team.",
    "Werewolf": "Wakes with the other Werewolves and chooses a target each night.",
    "Witch": "Once per game, may save an attacked player or eliminate a player.",
    "Wolf Cub": "If eliminated, the Werewolves receive two elimination choices the following night.",
    "Wolf Man": "A Werewolf who appears as a Villager.",
    "Fruit Brute": "Joins the Werewolf targeting phase. The choice works while another wolf is still alive, but has no effect when the Fruit Brute is alone.",
    "Wild Child": "Chooses a role model and becomes a Werewolf when that player dies, according to the selected death conditions."
    ,"Blacksmith": "Once per game, gives another player armor that blocks one Werewolf attack before breaking."
    ,"Bailiff": "Breaks a tied daytime elimination vote according to the Bailiff's vote."
    ,"Grave Digger": "After a Werewolf elimination, learns that victim's exact role on the following night."
    ,"Locksmith": "Barricades one player each night, blocking Werewolf targeting and that player's own night action."
    ,"Canary": "Learns whether either player currently seated beside them is a Werewolf."
    ,"Judge": "Once per game, may publicly reveal during a daytime vote to pardon the accused player and end the Day."
    ,"Witch Doctor": "Gives a player a temporary voodoo doll. If attacked by a Werewolf that night, the attack is redirected to the closest Werewolf."
    ,"Sentry": "Links two players as a patrol and learns whether either specifically targeted the other that night."
    ,"Sentinel": "Near the end of each night, chooses a player and learns how many night roles visited that player."
    ,"Vengeful Wolf": "When the Vengeful Wolf is the last Werewolf, the Werewolves eliminate two players each night."
    ,"Ravenous Wolf": "If the Werewolves complete two consecutive nights without eliminating anyone, they eliminate two players on the third night."
    ,"Crimson Wolf": "While the Crimson Wolf is alive on Night 3, Werewolf attacks ignore every protection, Tough Guy's delay, and the Diseased penalty."
    ,"Big Bad Wolf": "Counts as two Werewolves when checking Werewolf parity."
    ,"Death Hound": "After the Werewolves eliminate a player, learns that player's exact role on the following night."
    ,"Mystic Wolf": "Wakes with the Werewolves and also inspects one player's exact role each night."
    ,"The Thing": "Secretly joins the Werewolf team while performing and appearing as an additional role card. Its true identity remains hidden until the game ends."
    ,"Phantom Wolf": "Chooses one player on the first night who will appear as a Werewolf to investigative roles."
    ,"Pet Wolf": "Chooses an owner on the first night. If the Pet Wolf is eliminated first, its owner is eliminated as well."
    ,"Twin": "May take the place of a player who was just voted for elimination, dying instead without inheriting that player's role."
    ,"Guardian": "Chooses one player on the first night. The Guardian and that player protect one another from Werewolf attacks in different ways."
    ,"Scribe": "While the Scribe is alive, votes are public. After the Scribe dies, everyone votes anonymously with their eyes closed."
    ,"Exposer": "Chooses a player each night. When the village wakes, that player's role is announced without identifying whom the Exposer selected."
    ,"Silversmith": "Cannot be eliminated by a normal Werewolf attack."
    ,"Oracle": "Inspects players like the Seer. After finding a Werewolf, the Oracle cannot inspect anyone new until that Werewolf is eliminated."
};

function roleWakeDescription(role) {
    if (role.wake === "Every") return "Every night";
    if (String(role.wake) === "1") return "Night 1";
    return role.wake ? String(role.wake) : "Does not wake";
}

function playerAppearsWerewolfToPI(player) {
    if (!player) return false;
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToPI) return true;
    if (player.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToPI;
    if (player.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromPI;
    return basePlayerAppearsAs(player) === "Werewolf";
}

function playerAppearsAs(player) {
    if (!player) return "Villager";
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToSeer) return "Werewolf";
    return basePlayerAppearsAs(player);
}

function basePlayerAppearsAs(player) {
    if (!player) return "Villager";
    return roles.find(role => role.role === player.role)?.appearsAs || player.team || "Villager";
}

function isPhantomMarked(player) {
    return player?.phantomMarked === true || player?.appearsAsWerewolfOverride === true;
}

function apparentTeam(player) {
    if (player?.isThing) {
        return roles.find(role => role.role === player.role)?.team || "Villager";
    }
    return player?.team || "Villager";
}

function roleTeamForInheritance(player) {
    return player?.isThing ? apparentTeam(player) : player?.team;
}

function roleShownToMysticSeer(player) {
    if (!player) return "Villager";
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToMysticSeer) return "Werewolf";
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
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToTracker) return true;
    if (player.role === "Lycan") return roleRuleSettings.trackerCountsLycanAsWolf;
    if (player.role === "Wolf Man") return !roleRuleSettings.trackerHidesWolfMan;
    return basePlayerAppearsAs(player) === "Werewolf";
}

function canarySeesWerewolf(player) {
    if (!player) return false;
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToCanary) return true;
    if (player.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToCanary;
    if (player.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromCanary;
    return basePlayerAppearsAs(player) === "Werewolf";
}

function getGraveDiggerVictims(nightNumber = currentNight - 1) {
    const phase = `Night ${nightNumber}`;
    const directVictims = players.filter(player =>
        !player.alive && player.deathCause === "Werewolf attack" && player.deathPhase === phase
    );
    if (!roleRuleSettings.graveDiggerLearnsLinkedDeaths) return directVictims;
    const linkedVictims = players.filter(player =>
        !player.alive &&
        player.deathPhase === phase &&
        ["Cupid lover", "Dire Wolf connection"].includes(player.deathCause) &&
        directVictims.some(victim => player.connectedTo === victim || victim.connectedTo === player)
    );
    return [...new Set([...directVictims, ...linkedVictims])];
}

function getSorceressFinding(player) {
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToSorceress && roleRuleSettings.sorceressRevealsWerewolf) return "Werewolf";
    if (player?.role === "Seer") return "Seer";
    const appearsAs = basePlayerAppearsAs(player);
    if (appearsAs === "Werewolf" && roleRuleSettings.sorceressRevealsWerewolf) return "Werewolf";
    return "Other";
}

function isRecognizedWerewolf(player) {
    if (player?.isThing) return roleRuleSettings.thingParticipatesWolfEliminations;
    return apparentTeam(player) === "Werewolf" && !["Minion", "Sorceress"].includes(player?.role);
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

function revealedRoleName(player) {
    const roleName = player?.publicRevealedRole || player?.role || "Villager";
    if (player?.isDoppelganger && player?.doppelgangerDeathRoleCanTriggerAgain) {
        return `Doppelganger — inherited ${roleName} — Died Again`;
    }
    return roleName;
}

function summaryRoleName(player) {
    if (!player) return "Unknown";
    if (!player.alive && player.roleBeforeMartyrExchange) return player.roleBeforeMartyrExchange;
    if (player.martyrUsed) return `(Martyr): ${player.role || "Unknown"}`;
    if (player.isThing) return `(The Thing): ${player.role || "Unknown"}`;
    if (player.isDoppelganger && player.doppelgangerInheritedRole) {
        return `(Doppelganger): ${player.role || "Unknown"}`;
    }
    return revealedRoleName(player);
}

function publicNightEliminationCause(player) {
    const cause = player?.deathCause || player?.pendingDeathCause || "Night attack";
    return cause === "Revealer backlash" || cause === "Revealer" ? "Revealer" : cause;
}

function roleOptionMarkup(roleName) {
    const options = [];
    const fixed = [];
    if (roleName === "Bodyguard") {
        fixed.push("Protects against Werewolf attacks");
        options.push(["bodyguardProtectsWitch", "Protects against the Witch"]);
        options.push(["bodyguardProtectsHuntress", "Protects against the Huntress"]);
        options.push(["bodyguardBlocksAlphaConversion", "Protects against Alpha Wolf conversion"]);
        options.push(["bodyguardCannotRepeatTarget", "Cannot protect the same player on consecutive nights"]);
    }
    if (roleName === "Blacksmith") {
        options.push(["blacksmithArmorBlocksAlphaConversion", "Armor blocks Alpha Wolf conversion and then breaks"]);
    }
    if (roleName === "Alpha Wolf") {
        options.push(["alphaFailedConversionUsesAbility", "A failed conversion still uses the Alpha Wolf's attempt"]);
    }
    if (roleName === "Cupid") {
        options.push(["cupidMayLinkSelf", "May include themself in the connection"]);
        fixed.push("Acts only once, so consecutive-night target restrictions do not apply");
    }
    if (roleName === "Old Hag") {
        options.push(["oldHagMayTargetSelf", "May make themself leave the village"]);
        options.push(["oldHagMayRepeatTarget", "May choose the same player on consecutive nights"]);
    }
    if (roleName === "Shadow Wolf") {
        options.push(["blackWolfMaySilenceSelf", "May silence themself"]);
        options.push(["blackWolfMayRepeatTarget", "May choose the same player on consecutive nights"]);
    }
    if (roleName === "Spellcaster") {
        options.push(["spellcasterMaySilenceSelf", "May silence themself"]);
        options.push(["spellcasterMayRepeatTarget", "May choose the same player on consecutive nights"]);
    }
    if (roleName === "Seer") {
        options.push(["seerMayInspectSelf", "May inspect themself"]);
        options.push(["seerMayRepeatTarget", "May choose the same player on consecutive nights"]);
    }
    if (roleName === "Ravenous Wolf") {
        options.push(["packsHungerCountsShepherdFlock", "An eliminated Shepherd flock counts as a Werewolf elimination"]);
    }
    if (roleName === "Priest") {
        fixed.push("Protects against Werewolf attacks");
        options.push(["priestBlessingBlocksAlphaConversion", "Protects against Alpha Wolf conversion"]);
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
        options.push(["lycanAppearsWerewolfToCanary", "Appears as a Werewolf to the Canary"]);
    }
    if (roleName === "Wolf Man") {
        fixed.push("Appears as a Villager to the Seer");
        options.push(["wolfManHiddenFromPI", "Appears as a Villager to the P.I."]);
        options.push(["wolfManDisguisesRoleFromMysticSeer", "Appears as a Villager to the Mystic Seer"]);
        options.push(["trackerHidesWolfMan", "Appears as a Villager to the Tracker"]);
        options.push(["wolfManHiddenFromCanary", "Appears as a Villager to the Canary"]);
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
    }
    if (roleName === "Beholder") {
        fixed.push("Learns the original Seer");
        options.push(["beholderWakesOnFutureNights", "Wakes on future nights when someone has taken the Seer's place"]);
    }
    if (roleName === "Doppelganger") {
        fixed.push("After the chosen player dies, inherits that role, team, existing setup, targets, links, and used abilities");
        fixed.push("Does not repeat first-night setup or restore an ability that has already been used");
    }
    if (roleName === "The Thing") {
        options.push(["thingParticipatesWolfEliminations", "Participates in shared Werewolf eliminations"]);
    }
    if (roleName === "Phantom Wolf") {
        options.push(["phantomAppearsWolfToSeer", "Marked player appears as a Werewolf to the Seer"]);
        options.push(["phantomAppearsWolfToMysticSeer", "Marked player appears as a Werewolf to the Mystic Seer"]);
        options.push(["phantomAppearsWolfToPI", "Marked player appears as a Werewolf to the P.I."]);
        options.push(["phantomAppearsWolfToTracker", "Marked player appears as a Werewolf to the Tracker"]);
        options.push(["phantomAppearsWolfToCanary", "Marked player appears as a Werewolf to the Canary"]);
        options.push(["phantomAppearsWolfToSorceress", "Marked player appears as a Werewolf to the Sorceress"]);
    }
    if (roleName === "Martyr") {
        fixed.push("Takes the eliminated player's role, team, existing setup, targets, links, and used abilities");
        fixed.push("The eliminated player becomes the Martyr and does not trigger the exchanged role's ability");
    }
    if (roleName === "Mentalist") {
        fixed.push("Cannot select themself");
        options.push(["mentalistCannotRepeatPlayers", "Each player may be included in only one comparison per game"]);
    }
    if (roleName === "Grave Digger") {
        options.push(["graveDiggerLearnsLinkedDeaths", "Learns linked deaths caused by a Werewolf attack"]);
    }
    if (roleName === "Judge") {
        options.push(["judgeMayPardonSelf", "May pardon themself"]);
    }
    if (roleName === "Sentinel") {
        options.push(["watchmanCountsEachWerewolfVisitor", "Counts each participating Werewolf as a separate visitor"]);
        options.push(["watchmanCannotRepeatTarget", "Cannot watch the same player on consecutive nights"]);
    }
    if (roleName === "Locksmith") {
        options.push(["locksmithMayTargetSelf", "May barricade themself"]);
        options.push(["locksmithCannotRepeatTarget", "Cannot barricade the same player on consecutive nights"]);
    }
    if (roleName === "Witch Doctor") {
        options.push(["witchDoctorMayTargetSelf", "May give themself the voodoo doll"]);
        options.push(["witchDoctorCannotRepeatTarget", "Cannot choose the same player on consecutive nights"]);
        options.push(["voodooDollTargetSurvives", "The player holding the voodoo doll survives the Werewolf attack"]);
    }
    if (roleName === "Magistrate") {
        options.push(["magistrateMayTargetSelf", "May protect themself from the vote"]);
        options.push(["magistrateCannotRepeatTarget", "Cannot protect the same player on consecutive days"]);
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
    close.addEventListener("click", activateModal(overlay, close));
}

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
        <p>The current game is saved automatically in this browser and restores after a refresh or reopening the app. Back undoes only the most recent recorded screen action. Correct Game State is available during the Day for moderator corrections. <strong>End Game</strong> clears active progress after confirmation and opens the final summary.</p>
        <div class="modalActions gameGuideActions"><button type="button" class="dangerButton" onclick="endGame()">End Game</button><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", activateModal(overlay, close));
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
        ${settingToggle("werewolfEliminationOnFirstNight", "Allow a Werewolf elimination on Night 1", "Also activates Bodyguard, Witch, and other Night 1 attack-dependent actions.")}
        <div class="modalActions"><button type="button" onclick="resetGameSettings(); showGameSettings()">Restore All Defaults</button><button type="button" data-modal-close>Close</button></div>
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
            <button type="button" class="themeChoice ${designSettings.theme === key ? "selected" : ""}" onclick="setDesignSetting('theme', '${key}'); showDesignSettings()">
                <span class="themeSwatch ${key}"></span><strong>${label}</strong><small>${description}</small>
            </button>`).join("")}</div>
        <h3>Display</h3>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.largeText ? "checked" : ""} onchange="setDesignSetting('largeText', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Larger text</strong><small>${designSettings.largeText ? "On" : "Off"}</small></span></label>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.compactRows ? "checked" : ""} onchange="setDesignSetting('compactRows', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Compact player and role rows</strong><small>${designSettings.compactRows ? "On" : "Off"}</small></span></label>
        <label class="ruleToggle"><input type="checkbox" ${designSettings.keepAwake ? "checked" : ""} onchange="setDesignSetting('keepAwake', this.checked); this.nextElementSibling.querySelector('small').textContent=this.checked?'On':'Off'"><span><strong>Keep the screen awake during games</strong><small>${designSettings.keepAwake ? "On" : "Off"}</small></span></label>
        <div class="modalActions"><button type="button" onclick="resetDesignSettings(); showDesignSettings()">Reset</button><button type="button" data-modal-close>Close</button></div>
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
    const savingLoadout = currentScreen === "roles";
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal" role="dialog" aria-modal="true" aria-labelledby="saveSetupTitle">
        <h2 id="saveSetupTitle">${savingLoadout ? "Save Role Loadout" : "Save Game Setup"}</h2>
        <p>Enter a name for this role setup. Player names will not be saved.</p>
        <input id="savedSetupName" type="text" maxlength="60" placeholder="Loadout name" aria-label="Loadout name">
        <div class="modalActions"><button type="button" data-modal-cancel>Cancel</button><button type="button" onclick="saveNamedGameSetup()">${savingLoadout ? "Save Loadout" : "Save Game"}</button></div>
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
    close.addEventListener("click", activateModal(overlay, close));
}

function loadSavedGameSetup(encodedName) {
    const name = decodeURIComponent(encodedName);
    const setup = getSavedSetups().find(saved => saved.name === name);
    if (!setup) return;
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: Object.entries(setup.roleCounts || {}).reduce((total, [savedName, count]) =>
            canonicalRoleName(savedName) === role.role ? total + (Number(count) || 0) : total, 0) +
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

    const state = {
        currentScreen,
        players: players.map(serializePlayer),
        roles,
        nightOneWakeOrder,
        nightOneCurrentRole,
        nightOneActionOrder: nightOneActionOrder.map(serializeActionItem),
        nightOneCurrentAction,
        nightOneActionMode,
        nightOneDeferredActions: nightOneDeferredActions.map(serializeActionItem),
        resolvingNightOneDeferredActions,
        isLaterNight,
        savedVoteCount,
        wolvesDisabledNextNight,
        wolvesDisabledTonight,
        wolfEliminationsTonight,
        bloodWolfBypassesProtectionTonight,
        currentNight,
        currentDay,
        leftoverCardRole,
        thingCardRole,
        resumeMorningAfterSpecialResolution,
        roleSearchTerm,
        eliminationSequence,
        roleSortMode,
        roleTeamFilter,
        roleValueFilter,
        roleSelectedOnly,
        ignoreWinConditions,
        gameResultContinuation,
        gameResultMessage,
        phaseHistory,
        dayEliminationVoteOccurred,
        nightTargetRecords,
        lastActionDescription,
        roleRuleSettings,
        gameSettings,
        screenHTML: captureScreenHTML(),
        formState: captureFormState()
    };

    // Undo must be a true point-in-time snapshot. Player attack arrays, the
    // timeline, and queued actions continue changing after this function runs.
    return JSON.parse(JSON.stringify(state));

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

    savedData = migrateSavedGame(savedData);
    if (!savedData) {
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
        delete restoredPlayer.watchedPlayerTonightIndex;
        delete restoredPlayer.lastProtectedPlayerIndex;
        delete restoredPlayer.lastBarricadedPlayerIndex;
        delete restoredPlayer.lastVoodooPlayerIndex;
        delete restoredPlayer.lastMagistratePlayerIndex;
        delete restoredPlayer.lastWatchedPlayerIndex;
        delete restoredPlayer.petOwnerIndex;
        return restoredPlayer;
    });
    state.players.forEach((savedPlayer, index) => {
        players[index].connectedTo = players[savedPlayer.connectedToIndex] || null;
        players[index].doppelgangerTarget = players[savedPlayer.doppelgangerTargetIndex] || null;
        players[index].lastLeftNeighbor = players[savedPlayer.lastLeftNeighborIndex] || null;
        players[index].lastRightNeighbor = players[savedPlayer.lastRightNeighborIndex] || null;
        players[index].roleModel = players[savedPlayer.roleModelIndex] || null;
        players[index].butcherRedirectTarget = players[savedPlayer.butcherRedirectTargetIndex] || null;
        players[index].watchedPlayerTonight = players[savedPlayer.watchedPlayerTonightIndex] || null;
        players[index].lastProtectedPlayer = players[savedPlayer.lastProtectedPlayerIndex] || null;
        players[index].lastBarricadedPlayer = players[savedPlayer.lastBarricadedPlayerIndex] || null;
        players[index].lastVoodooPlayer = players[savedPlayer.lastVoodooPlayerIndex] || null;
        players[index].lastMagistratePlayer = players[savedPlayer.lastMagistratePlayerIndex] || null;
        players[index].lastWatchedPlayer = players[savedPlayer.lastWatchedPlayerIndex] || null;
        players[index].petOwner = players[savedPlayer.petOwnerIndex] || null;
    });
    // Older saves could copy Doppelganger identity metadata into a Martyr who
    // inherited the Doppelganger's current role. The Martyr receives the role,
    // not the original player's Doppelganger identity or pending choice.
    players.forEach(player => {
        if (player.martyrUsed && player.role !== "Doppelganger" && player.isDoppelganger) {
            player.isDoppelganger = false;
            player.doppelgangerTarget = null;
            player.doppelgangerInheritedRole = null;
        }
    });

    const savedRoleCounts = new Map();
    (Array.isArray(state.roles) ? state.roles : []).forEach(role => {
        const roleName = canonicalRoleName(role.role);
        savedRoleCounts.set(roleName, (savedRoleCounts.get(roleName) || 0) + (Number(role.count) || 0));
    });
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: (savedRoleCounts.get(role.role) || 0) +
            (role.role === "Sorceress" ? (savedRoleCounts.get("Sorcerer") || 0) : 0)
    }));
    currentScreen = state.currentScreen || "players";
    nightOneWakeOrder = (state.nightOneWakeOrder || []).map(role => ({ ...role, role: canonicalRoleName(role.role) }));
    nightOneCurrentRole = Number(state.nightOneCurrentRole) || 0;
    nightOneActionOrder = (state.nightOneActionOrder || []).map(item => ({
        ...item,
        role: item.role ? { ...item.role, role: canonicalRoleName(item.role.role) } : item.role,
        actor: players[item.actorIndex]
    }));
    nightOneCurrentAction = Number(state.nightOneCurrentAction) || 0;
    nightOneActionMode = state.nightOneActionMode ?? null;
    nightOneDeferredActions = (state.nightOneDeferredActions || []).map(item => ({
        ...item,
        role: item.role ? { ...item.role, role: canonicalRoleName(item.role.role) } : item.role,
        actor: players[item.actorIndex]
    }));
    resolvingNightOneDeferredActions = state.resolvingNightOneDeferredActions === true;
    isLaterNight = state.isLaterNight === true;
    savedVoteCount = Number(state.savedVoteCount) || 0;
    wolvesDisabledNextNight = state.wolvesDisabledNextNight === true;
    wolvesDisabledTonight = state.wolvesDisabledTonight === true;
    wolfEliminationsTonight = Number(state.wolfEliminationsTonight) || 1;
    bloodWolfBypassesProtectionTonight = state.bloodWolfBypassesProtectionTonight === true;
    currentNight = Number(state.currentNight) || 1;
    currentDay = Number(state.currentDay) || 0;
    leftoverCardRole = state.leftoverCardRole ? {
        ...state.leftoverCardRole,
        role: canonicalRoleName(state.leftoverCardRole.role)
    } : null;
    thingCardRole = state.thingCardRole ? {
        ...state.thingCardRole,
        role: canonicalRoleName(state.thingCardRole.role)
    } : null;
    resumeMorningAfterSpecialResolution = state.resumeMorningAfterSpecialResolution === true;
    roleSearchTerm = state.roleSearchTerm || "";
    eliminationSequence = Number(state.eliminationSequence) || 0;
    roleSortMode = state.roleSortMode || "alphabetical-asc";
    roleTeamFilter = state.roleTeamFilter || "all";
    roleValueFilter = state.roleValueFilter || "all";
    roleSelectedOnly = state.roleSelectedOnly === true;
    ignoreWinConditions = state.ignoreWinConditions === true;
    gameResultContinuation = state.gameResultContinuation || null;
    gameResultMessage = state.gameResultMessage || null;
    phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
    sanitizePhaseHistory();
    dayEliminationVoteOccurred = state.dayEliminationVoteOccurred === true;
    nightTargetRecords = Array.isArray(state.nightTargetRecords) ? state.nightTargetRecords : [];
    roleRuleSettings = pickKnownSettings(defaultRoleRuleSettings, state.roleRuleSettings);
    gameSettings = pickKnownSettings(defaultGameSettings, state.gameSettings);
    lastActionDescription = state.lastActionDescription || "the last action";

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
        `Undo ${lastActionDescription}? You will return to the previous screen and must perform it again.`,
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
            button.classList.contains("preserveUndoSnapshot") ||
            button.disabled ||
            ["Vote", "Cancel Vote"].includes(button.textContent.trim())
        ) {
            return;
        }

        const label = button.textContent.trim().replace(/\s+/g, " ");
        lastActionDescription = describeActionForUndo(label);
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

function describeActionForUndo(label) {
    const action = nightOneActionOrder[nightOneCurrentAction];
    const roleName = action?.role?.role;
    if (roleName && /^(Continue|Next|Take action|Do not take action|Turn the)/i.test(label)) {
        return `${moderatorRoleName(roleName)}'s current action`;
    }
    if (/Eliminate/i.test(label)) return "this elimination";
    if (/Spare/i.test(label)) return "this Spare vote";
    if (/Skip to Night/i.test(label)) return `ending Day ${currentDay}`;
    return label ? `“${label}”` : "the last action";
}


// ============================================================
// LOAD ROLE DATABASE
// ============================================================

async function loadRoles() {

    try {

        const response = await fetch(`${window.WEREWOLF_ASSET_BASE || ""}Data/roles.json`);

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
        <section class="playerEntrySection" aria-labelledby="addPlayerHeading">
            <h3 id="addPlayerHeading">Add another player</h3>
            <p class="setupHint">Enter a name, then press Enter or select Add Player.</p>
            <div class="playerEntryControls">
            <input
                id="playerName"
                type="text"
                placeholder="Player name"
                autocomplete="off"
                aria-label="Player name"
            >
            <button
                type="button"
                class="addPlayerButton"
                onclick="addPlayer()"
            >
                ➕ Add Player
            </button>
            </div>
        </section>

        <section class="playerSetupContinue">
            <div>
                <strong>Finished adding players?</strong>
                <small>${players.length} ${players.length === 1 ? "player" : "players"} currently added</small>
            </div>
            <button
                type="button"
                class="playerSetupNext"
                onclick="drawRoleScreen()"
                ${players.length === 0 ? "disabled" : ""}
            >
                Continue to Role Selection ➜
            </button>
        </section>

        ${players.length ? `
            <div class="removePlayersAction">
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
    const cards = getTotalCards();
    const requiredCards = getRequiredCardCount();

    let html = `
        <h2>Roles in Game</h2>
        <button class="startGameTop" type="button" onclick="drawGameConfirmation()" ${cards !== requiredCards ? "disabled" : ""}>
            Start Game
        </button>
        <button type="button" onclick="promptToSaveGameSetup()" ${cards === 0 ? "disabled" : ""}>
            Save Loadout
        </button>
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
            <select aria-label="Filter roles" onchange="setRoleCategoryFilter(this.value)">
                <option value="all" ${roleTeamFilter === "all" && roleValueFilter === "all" ? "selected" : ""}>All</option>
                <option value="Werewolf" ${roleTeamFilter === "Werewolf" ? "selected" : ""}>Werewolf Team</option>
                <option value="Villager" ${roleTeamFilter === "Villager" ? "selected" : ""}>Villager Team</option>
                <option value="negative" ${roleValueFilter === "negative" ? "selected" : ""}>Werewolf Benefits (−)</option>
                <option value="positive" ${roleValueFilter === "positive" ? "selected" : ""}>Villager Benefits (+)</option>
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

            <div class="playerRow roleOption" data-role-name="${escapeHTML(role.role.toLowerCase())}" data-role-team="${escapeHTML(role.team)}" data-role-value="${Number(role.value) < 0 ? "negative" : "positive"}" data-role-wake="${escapeHTML(String(role.wake))}" data-role-selected="${Number(role.count) > 0 ? "true" : "false"}">

                <span>
                    ${escapeHTML(role.role)}
                    <span class="roleValue">${Number(role.value) >= 0 ? "+" : ""}${Number(role.value) || 0}</span>
                    <button class="roleInfoButton ${role.team === "Werewolf" ? "werewolfInfo" : "villagerInfo"}" type="button" aria-label="Information about ${escapeHTML(role.role)}" onclick="showRoleInfo(${index})">i</button>
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


    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );
    const thingIsSelected = roles.some(role =>
        role.role === "The Thing" && Number(role.count) > 0
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
        ${thingIsSelected ? `
            <p style="color:${cards === requiredCards ? "#8fda8f" : "#ff8f8f"}; font-size:.9rem;">
                ${cards === requiredCards ?
                    "The Thing is in play. Its extra secondary card has been selected." :
                    "The Thing is in play. Select one additional secondary card."}
            </p>
        ` : ""}

        <br>

        <button type="button" onclick="removeAllRoles()">
            Remove All Roles
        </button>

        <button type="button" onclick="promptToSaveGameSetup()" ${cards === 0 ? "disabled" : ""}>
            Save Loadout
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
            Start Game
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
        role.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(role.role) &&
        (role.role !== "The Thing" || roleRuleSettings.thingParticipatesWolfEliminations)
    );
    if (!hasEliminationWolf) {
        setupWarnings.push("No Werewolf capable of making the shared elimination is selected.");
    }
    if (Math.abs(totalValue) >= 10) {
        setupWarnings.push(`The card-value balance is ${totalValue}, so this setup may strongly favor one team.`);
    }
    if (selectedRoles.some(role => role.role === "Drunk")) setupWarnings.push("The Drunk requires one extra role card.");
    if (selectedRoles.some(role => role.role === "The Thing")) setupWarnings.push("The Thing requires one extra secondary role card.");
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
    bloodWolfBypassesProtectionTonight = false;
    nightTargetRecords = [];
    nightOneDeferredActions = [];
    resolvingNightOneDeferredActions = false;

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
    const thingIsSelected = roles.some(role =>
        role.role === "The Thing" && Number(role.count) > 0
    );

    if ((drunkIsSelected && !leftoverCardRole) || (thingIsSelected && !thingCardRole)) {
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
            count: Number(role.count) - extraAssignedCardCount(role.role)
        }))

        .filter(role => role.count > 0)

        .filter(role =>
            String(role.role).toLowerCase() !== "villager"
        )

        .flatMap(role =>
            gameSettings.werewolfEliminationOnFirstNight && role.role === "Alpha Wolf" ? [
                { ...role, priority: 4.9, action: "N/A", wake: "1", alphaIdentityOnly: true },
                { ...role, alphaActionOnly: true }
            ] : [role]
        )

        .sort((a, b) =>
            Number(a.priority) - Number(b.priority)
        );

    if (thingCardRole && roleHasActiveNightPrompt(thingCardRole) && !nightOneActionIsSuppressed(thingCardRole)) {
        nightOneWakeOrder.push({
            ...thingCardRole,
            count: 0,
            thingSecondaryRole: true
        });
        nightOneWakeOrder.sort((a, b) => Number(a.priority) - Number(b.priority));
    }

    const genericWerewolfSelected = nightOneWakeOrder.some(role =>
        role.role === "Werewolf" && !role.alphaActionOnly
    );
    const anotherEliminationWolfSelected = roles.some(role =>
        Number(role.count) - extraAssignedCardCount(role.role) > 0 &&
        role.team === "Werewolf" &&
        !["Minion", "Sorceress", "Fruit Brute"].includes(role.role) &&
        (role.role !== "The Thing" || roleRuleSettings.thingParticipatesWolfEliminations)
    );
    if (gameSettings.werewolfEliminationOnFirstNight && !genericWerewolfSelected && anotherEliminationWolfSelected) {
        const genericWerewolf = roles.find(role => role.role === "Werewolf");
        nightOneWakeOrder.push({ ...genericWerewolf, count: 0, sharedWolfEliminationOnly: true });
        nightOneWakeOrder.sort((a, b) => Number(a.priority) - Number(b.priority));
    }

    if (leftoverCardRole && leftoverRoleNeedsTheatricalWake(leftoverCardRole)) {
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

function leftoverRoleNeedsTheatricalWake(role) {
    return roleHasActiveNightPrompt(role) && !nightOneActionIsSuppressed(role);
}

function roleHasActiveNightPrompt(role) {
    if (!role || role.action === "N/A") return false;
    return ![
        "DelayDeath",
        "RevengeKill",
        "ChangeRole",
        "DisableWolves",
        "Explosion",
        "Prince",
        "ShepherdFlock",
        "RevealBloodscentVictims"
    ].includes(role.action);
}

function nightOneActionIsSuppressed(role) {
    return !gameSettings.werewolfEliminationOnFirstNight && [
        "KillPlayer",
        "NightKill",
        "WitchChoice",
        "RevealPlayer",
        "ConvertPlayer",
        "ProtectPlayer",
        "BarricadePlayer"
    ].includes(role?.action);
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
        .filter(role => !["Drunk", "The Thing"].includes(role.role) && Number(role.count) > 0)
        .map(role => `<option value="${escapeHTML(role.role)}">${escapeHTML(role.role)}</option>`)
        .join("");
    const drunkIsSelected = roles.some(role => role.role === "Drunk" && Number(role.count) > 0);
    const thingIsSelected = roles.some(role => role.role === "The Thing" && Number(role.count) > 0);

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night 1</h2>
        <h2>Extra Role Cards</h2>
        <p>Identify each extra physical card before assigning roles.</p>
        ${drunkIsSelected ? `<label>Drunk's card<select id="leftoverCardRole"><option value="">Select the Drunk's card</option>${options}</select></label>` : ""}
        ${thingIsSelected ? `<label>The Thing's secondary card<select id="thingCardRole"><option value="">Select The Thing's role</option>${options}</select></label>` : ""}
        <button class="actionContinue" type="button" onclick="confirmLeftoverCard()">Continue ➜</button>
    `;

}

function confirmLeftoverCard() {

    const drunkIsSelected = roles.some(role => role.role === "Drunk" && Number(role.count) > 0);
    const thingIsSelected = roles.some(role => role.role === "The Thing" && Number(role.count) > 0);
    const selectedDrunkRole = drunkIsSelected ? roles.find(role => role.role === document.getElementById("leftoverCardRole")?.value) : null;
    const selectedThingRole = thingIsSelected ? roles.find(role => role.role === document.getElementById("thingCardRole")?.value) : null;
    if ((drunkIsSelected && !selectedDrunkRole) || (thingIsSelected && !selectedThingRole)) {
        alert("Please select every required extra role card.");
        return;
    }
    const selectedCounts = [selectedDrunkRole, selectedThingRole].filter(Boolean).reduce((counts, role) => {
        counts[role.role] = (counts[role.role] || 0) + 1;
        return counts;
    }, {});
    if (Object.entries(selectedCounts).some(([roleName, count]) => count > Number(roles.find(role => role.role === roleName)?.count || 0))) {
        alert("There are not enough selected copies of that role for both extra cards.");
        return;
    }

    leftoverCardRole = selectedDrunkRole;
    thingCardRole = selectedThingRole;
    const automaticWinMessage = getSetupAutomaticWin(selectedDrunkRole?.role, selectedThingRole?.role);
    if (automaticWinMessage) {
        alert(automaticWinMessage);
        drawRoleScreen();
        return;
    }
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


        if (nightOneDeferredActions.length) {
            nightOneActionOrder = nightOneDeferredActions;
            nightOneDeferredActions = [];
            nightOneCurrentAction = 0;
            resolvingNightOneDeferredActions = true;
            drawNightAction();
        } else {
            drawDayOne();
        }

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

    if (role.alphaActionOnly || role.sharedWolfEliminationOnly || role.thingSecondaryRole) {
        startNightOneActions(role);
        return;
    }

    if (role.mockLeftoverAction) {
        document.getElementById("screen").innerHTML = `
            <h2>🌙 Night ${currentNight}</h2>
            <hr>
            <h2>${readAloud(`${moderatorRoleName(role.role)}, wake up.`)}</h2>
            ${role.question === "N/A" ? "" : `<p>${readAloud(role.question)}</p>`}
            <div class="moderatorPanel">Wait a few seconds to maintain secrecy.</div>
            <hr>
            <p>${readAloud(`${moderatorRoleName(role.role)}, go to sleep.`)}</p>
            <hr>
            <button type="button" onclick="advanceNightRole()">Continue ➜</button>
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
            ${readAloud(role.role === "Werewolf" ?
                "Players with the generic Werewolf card, wake up." :
                role.role === "Mason" ?
                    "Masons, wake up and look at each other." :
                `${moderatorRoleName(role.role)}, wake up.`)}
        </h2>

        <p>
            ${role.role === "Werewolf" ?
                "Select every player holding the generic Werewolf card." :
                role.role === "Mason" ?
                    "Select the Masons." :
                `Who is the ${escapeHTML(role.role)}?`}
        </p>
        ${role.role === "The Thing" ? `<p>${readAloud(
            roleRuleSettings.thingParticipatesWolfEliminations ?
                "You are participating in Werewolf eliminations." :
                "You are not participating in Werewolf eliminations."
        )}</p>` : ""}

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

            ${role.role === "Mason" ? "" : `<p>
                Select all ${role.count}
                ${escapeHTML(role.role)}s.
            </p>`}

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
        role.wake !== "Never" &&
        (isLaterNight || !String(role.wake).startsWith("After ")) &&
        role.action !== "N/A" &&
        (isLaterNight || gameSettings.werewolfEliminationOnFirstNight || !["KillPlayer", "NightKill", "WitchChoice", "RevealPlayer"].includes(role.action)) &&
        (isLaterNight || gameSettings.werewolfEliminationOnFirstNight || !["ConvertPlayer", "ProtectPlayer", "BarricadePlayer"].includes(role.action)) &&
        !passiveActions.includes(role.action) &&
        isValidAction(role.action);

}

function getRequiredCardCount() {

    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );
    const thingIsSelected = roles.some(role =>
        role.role === "The Thing" && Number(role.count) > 0
    );

    return players.length + (drunkIsSelected ? 1 : 0) + (thingIsSelected ? 1 : 0);

}

function extraAssignedCardCount(roleName) {
    return (leftoverCardRole?.role === roleName ? 1 : 0) +
        (thingCardRole?.role === roleName ? 1 : 0);
}

function getSetupAutomaticWin(leftoverRoleName = null, thingRoleName = null) {

    let werewolfTeamCount = 0;
    let villagerTeamCount = 0;
    let mayorCount = 0;
    let nonMayorVillagerCount = 0;
    let eliminationWolfCount = 0;

    roles.forEach(role => {
        const dealtCount = Math.max(
            0,
            Number(role.count) - (role.role === leftoverRoleName ? 1 : 0) - (role.role === thingRoleName ? 1 : 0)
        );

        if (role.team === "Werewolf") {
            const countsForParity = role.role === "Minion" ? roleRuleSettings.minionCountsForWerewolfParity :
                role.role === "Fruit Brute" ? roleRuleSettings.fruitBruteCountsForWerewolfParity :
                role.role === "Sorceress" ? roleRuleSettings.sorceressCountsForWerewolfParity : true;
            if (countsForParity) werewolfTeamCount += dealtCount * (role.role === "Big Bad Wolf" ? 2 : 1);

            if (!["Minion", "Sorceress", "The Thing"].includes(role.role)) {
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

    if (thingRoleName && roleRuleSettings.thingParticipatesWolfEliminations) {
        eliminationWolfCount++;
    }

    if (nonMayorVillagerCount > 0) {
        villagerTeamCount += mayorCount;
    }

    const leftoverRole = roles.find(role => role.role === leftoverRoleName);
    if (
        leftoverRole?.team === "Werewolf" &&
        !["Minion", "Sorceress", "The Thing"].includes(leftoverRole.role)
    ) {
        eliminationWolfCount++;
    }

    if (eliminationWolfCount === 0) {
        return "The Villagers would win automatically because no Werewolf capable of making the shared elimination would be dealt.";
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
    const thingIsSelected = roles.some(role => role.role === "The Thing" && Number(role.count) > 0);

    // The Thing's unknown secondary card changes both the dealt roster and
    // investigative identity, so defer the exact check until that card is set.
    if (thingIsSelected) return null;

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

function remainingNightOneRoleCount(roleDefinition) {
    const dealtCount = Math.max(
        0,
        Number(roleDefinition?.count || 0) - extraAssignedCardCount(roleDefinition?.role)
    );
    const assignedCount = players.filter(player =>
        (player.nightOneAssignedRole || player.role) === roleDefinition?.role
    ).length;
    return Math.max(0, dealtCount - assignedCount);
}

function remainingNightOneRoles() {
    return roles.filter(role => remainingNightOneRoleCount(role) > 0);
}

function assignGuaranteedNightOneVillagers() {
    const remainingNonVillagers = remainingNightOneRoles().filter(role => role.role !== "Villager");
    if (remainingNonVillagers.length) return false;

    players.filter(player => !player.role).forEach(player => {
        player.role = "Villager";
        player.team = "Villager";
        player.nightOneAssignedRole = "Villager";
    });
    return true;
}

function roleAppearsWerewolfToPI(role) {
    if (role.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToPI;
    if (role.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromPI;
    return role.team === "Werewolf";
}

function nightOneActionHasRequiredInformation(role) {
    if (isLaterNight || !role) return true;

    const exactRoleCheck = role.action === "RevealTeam" ||
        (role.action === "RevealRole" && role.role === "Mystic Wolf");
    if (exactRoleCheck) {
        assignGuaranteedNightOneVillagers();
        return players.every(player => !!player.role);
    }

    const remaining = remainingNightOneRoles();

    if (role.action === "Investigate") {
        return !remaining.some(roleAppearsWerewolfToPI);
    }

    if (role.action === "RevealAlignment") {
        return !remaining.some(candidate => candidate.appearsAs === "Werewolf");
    }

    if (role.action === "RevealRole" && role.role === "Sorceress") {
        return !remaining.some(candidate =>
            candidate.role === "Seer" ||
            (roleRuleSettings.sorceressRevealsWerewolf && candidate.appearsAs === "Werewolf")
        );
    }

    if (role.action === "RevealSeer") {
        return !remaining.some(candidate => candidate.role === "Seer");
    }

    if (role.action === "CompareTeams") {
        return new Set(remaining.map(candidate => candidate.team)).size <= 1;
    }

    return true;
}

function effectiveNightOneTeam(player) {
    if (player?.isThing) return apparentTeam(player);
    if (player?.team) return player.team;
    const remainingTeams = new Set(remainingNightOneRoles().map(role => role.team));
    return remainingTeams.size === 1 ? [...remainingTeams][0] : null;
}

function startNightOneActions(role) {

    nightOneActionOrder = [];
    nightOneActionMode = null;

    if (role?.role === "Werewolf") {
        wolfEliminationsTonight = 1;
        refreshWolfPassiveBonusesForCurrentNight();
    }

    if (
        !hasNightOneAction(role)
    ) {
        advanceNightRole();
        return;
    }

    if (!nightOneActionHasRequiredInformation(role)) {
        players
            .filter(player => player.role === role.role && player.alive)
            .forEach(actor => nightOneDeferredActions.push({ role, actor }));
        drawGoToSleep("advanceNightRole");
        return;
    }

    players
        .filter(player =>
            (role.sharedWolfEliminationOnly ? canChooseWerewolfElimination(player) :
                role.thingSecondaryRole ? player.isThing : player.role === role.role) &&
            player.alive &&
            !(role.oncePerGame && player.usedOncePerGameAction)
        )
        .slice(
            0,
            ["KillPlayer", "RevealGroup"].includes(role.action) ? 1 : undefined
        )
        .forEach(actor => {
            nightOneActionOrder.push({
                role,
                actor,
                continuesIdentificationWake: !isLaterNight && role.action !== "KillPlayer" && !role.alphaActionOnly && !role.sharedWolfEliminationOnly && !role.thingSecondaryRole
            });
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
        if (resolvingNightOneDeferredActions) {
            resolvingNightOneDeferredActions = false;
            drawDayOne();
            return;
        }
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

    if (item.actor?.barricadedTonight && item.role.action !== "BarricadePlayer") {
        drawBarricadedNightAction(item);
        return;
    }

    if (!action) {
        nightOneCurrentAction++;
        drawNightAction();
        return;
    }

    const targetCount = getNightActionTargetCount(item);
    const actorMayTargetSelf = item.role.action === "ProtectPlayer" ||
        (item.role.action === "LinkPlayers" && (item.role.role !== "Cupid" || roleRuleSettings.cupidMayLinkSelf)) ||
        (item.role.action === "ExileVillager" && item.role.role === "Old Hag" && roleRuleSettings.oldHagMayTargetSelf) ||
        (item.role.action === "SilencePlayer" && item.role.role === "Shadow Wolf" && roleRuleSettings.blackWolfMaySilenceSelf) ||
        (item.role.action === "SilencePlayer" && item.role.role === "Spellcaster" && roleRuleSettings.spellcasterMaySilenceSelf) ||
        (item.role.action === "RevealAlignment" && item.role.role === "Seer" && roleRuleSettings.seerMayInspectSelf) ||
        (item.role.action === "BarricadePlayer" && roleRuleSettings.locksmithMayTargetSelf) ||
        (item.role.action === "VoodooProtect" && roleRuleSettings.witchDoctorMayTargetSelf) ||
        (item.role.action === "BlockVote" && roleRuleSettings.magistrateMayTargetSelf);
    let availablePlayers = players.filter(player =>
        player.alive && (actorMayTargetSelf || player !== item.actor)
    );

    if (item.role.action === "TrackWolf") {
        drawTrackerNightAction(item, availablePlayers);
        return;
    }

    if (item.role.action === "OracleInspect" && item.actor.oracleUnresolvedWolf?.alive) {
        availablePlayers = availablePlayers.filter(player => player === item.actor.oracleUnresolvedWolf);
    } else if (item.role.action === "OracleInspect" && item.actor.oracleUnresolvedWolf && !item.actor.oracleUnresolvedWolf.alive) {
        item.actor.oracleUnresolvedWolf = null;
    }

    if (item.role.action === "ProtectPlayer" && roleRuleSettings.bodyguardCannotRepeatTarget) {
        availablePlayers = availablePlayers.filter(player =>
            player !== item.actor.lastProtectedPlayer
        );
    }
    const repeatTargetRule = {
        BarricadePlayer: ["locksmithCannotRepeatTarget", "lastBarricadedPlayer"],
        VoodooProtect: ["witchDoctorCannotRepeatTarget", "lastVoodooPlayer"],
        BlockVote: ["magistrateCannotRepeatTarget", "lastMagistratePlayer"],
        RevealVisitorCount: ["watchmanCannotRepeatTarget", "lastWatchedPlayer"]
    }[item.role.action];
    if (repeatTargetRule && roleRuleSettings[repeatTargetRule[0]]) {
        availablePlayers = availablePlayers.filter(player => player !== item.actor[repeatTargetRule[1]]);
    }
    const roleRepeatRule = {
        "Old Hag": ["oldHagMayRepeatTarget", "lastOldHagTargetId"],
        "Shadow Wolf": ["blackWolfMayRepeatTarget", "lastBlackWolfTargetId"],
        "Spellcaster": ["spellcasterMayRepeatTarget", "lastSpellcasterTargetId"],
        "Seer": ["seerMayRepeatTarget", "lastSeerTargetId"]
    }[item.role.role];
    if (roleRepeatRule && !roleRuleSettings[roleRepeatRule[0]]) {
        availablePlayers = availablePlayers.filter(player => player.id !== item.actor[roleRepeatRule[1]]);
    }

    if (item.role.action === "CompareTeams" && roleRuleSettings.mentalistCannotRepeatPlayers) {
        const previouslyCompared = new Set(item.actor.mentalistComparedPlayerIds || []);
        availablePlayers = availablePlayers.filter(player => !previouslyCompared.has(player.id));
    }

    if (item.role.action === "KillPlayer") {
        availablePlayers = availablePlayers.filter(player =>
            !canChooseWerewolfElimination(player) &&
            (bloodWolfBypassesProtectionTonight || !player.barricadedTonight) &&
            !player.wolfTargetTonight
        );
    }

    if (item.role.action === "ConvertPlayer") {
        availablePlayers = availablePlayers.filter(player => player.wolfTargetTonight);
    }

    if (item.role.action === "WitchChoice" && nightOneActionMode === "save") {
        availablePlayers = availablePlayers.filter(player => player.attackedTonight);
    }

    if (["WitchChoice", "NightKill", "BlessPlayer", "ConvertPlayer", "ForgeArmor"].includes(item.role.action) && !nightOneActionMode) {
        drawOptionalNightAction(item);
        return;
    }

    if (
        targetCount === 0 &&
        ["BecomeSeer", "ChangeTeams", "CheckRoleModel", "RevealWolfVictims", "RevealVisitorCount", "RevealBloodscentVictims"].includes(item.role.action)
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
            queueInheritedRoleContinuation(item.actor);
        }
        drawNightActionResult(item, [item.actor.doppelgangerTarget]);
        return;
    }

    let html = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ?
            escapeHTML(moderatorRoleName(item.role.role)) :
            readAloud(isSecondWolfTarget ? "Werewolves, choose your second target." : `${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
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

    if (["Hear", "CheckAdjacentWolves"].includes(item.role.action)) {
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

function drawBarricadedNightAction(item) {
    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ? escapeHTML(moderatorRoleName(item.role.role)) : readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        ${item.role.question === "N/A" ? "" : `<p>${readAloud(item.role.question)}</p>`}
        <div class="moderatorPanel">This player is barricaded. Give no signal and record no action. Wait a few seconds to maintain secrecy.</div>
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" onclick="advanceBarricadedNightAction()">Continue ➜</button>
    `;
}

function advanceBarricadedNightAction() {
    const item = nightOneActionOrder[nightOneCurrentAction];
    if (item) {
        item.skipped = true;
        recordPhaseEvent(`Night ${currentNight}`, `${item.role.role}'s action was blocked by the Locksmith's barricade.`, `barricade-block-${currentNight}-${item.actor.id}`);
    }
    advanceNightAction();
}

function queueInheritedRoleContinuation(actor) {
    const inheritedDefinition = roles.find(role => role.role === actor.doppelgangerInheritedRole);
    if (!inheritedDefinition || ["Doppelganger", "Drunk"].includes(inheritedDefinition.role)) return;

    const currentPriority = Number(nightOneActionOrder[nightOneCurrentAction]?.role?.priority ?? -Infinity);
    const normalWakeStillAhead = Number(inheritedDefinition.priority) > currentPriority;
    const mayAct = inheritedDefinition.wake === "Every" &&
        inheritedDefinition.action !== "N/A" &&
        !["CopyRole", "KillPlayer"].includes(inheritedDefinition.action) &&
        !(inheritedDefinition.oncePerGame && actor.usedOncePerGameAction);

    if (!normalWakeStillAhead || !mayAct) return;

    removeTheatricalWakesForRole(inheritedDefinition.role, nightOneCurrentAction + 1);

    const continuation = {
        role: inheritedDefinition,
        actor,
        inheritedRoleContinuation: true
    };
    let insertAt = nightOneCurrentAction + 1;
    while (
        insertAt < nightOneActionOrder.length &&
        Number(nightOneActionOrder[insertAt].role.priority) <= Number(inheritedDefinition.priority)
    ) {
        insertAt++;
    }
    nightOneActionOrder.splice(insertAt, 0, continuation);
}

function removeTheatricalWakesForRole(roleName, startIndex = 0) {
    for (let index = nightOneActionOrder.length - 1; index >= startIndex; index--) {
        const queued = nightOneActionOrder[index];
        if (queued.theatricalOnly && queued.role?.role === roleName) {
            nightOneActionOrder.splice(index, 1);
        }
    }
}

function removeRedundantTheatricalWakes() {
    const rolesWithRealWakes = new Set(
        nightOneActionOrder
            .filter(item => !item.theatricalOnly)
            .map(item => item.role?.role)
            .filter(Boolean)
    );

    rolesWithRealWakes.forEach(roleName => removeTheatricalWakesForRole(roleName));
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
        "CopyRole",
        "CheckAdjacentWolves",
        "CheckMutualTargets",
        "RevealWolfVictims",
        "RevealVisitorCount",
        "RevealBloodscentVictims"
    ].includes(actionName);

}

function recordPhaseEvent(phase, text, key = null, details = {}) {

    if (!phase || !text) {
        return;
    }

    const eventKey = key || `${phase}:${text}`;
    if (phaseHistory.some(event => event.key === eventKey)) {
        return;
    }

    phaseHistory.push({
        id: details.id || eventKey,
        type: details.type || "note",
        phase,
        text,
        key: eventKey,
        actorId: details.actor?.id ?? details.actorId ?? null,
        targetIds: (details.targets || []).map(target => target.id),
        cause: details.cause || null,
        result: details.result || null,
        blockedBy: details.blockedBy || null
    });

}

function getPhaseInvariantWarnings() {
    const warnings = [];
    players.forEach(player => {
        if (!player.alive && (!player.deathCause || !player.deathPhase)) {
            warnings.push(`${player.name} is eliminated without a complete cause and phase.`);
        }
        if (player.alive && player.deathCause) {
            warnings.push(`${player.name} is alive but still has elimination information.`);
        }
    });
    return warnings;
}

function validatePhaseBeforeAdvance() {
    const warnings = getPhaseInvariantWarnings();
    if (!warnings.length) return true;
    showAppAlert(`The game cannot advance yet. ${warnings.join(" ")}`);
    return false;
}

function sanitizePhaseHistory() {

    phaseHistory = phaseHistory.map(event => {
        if (/^Beholder selected no target\.?$/i.test(event.text)) {
            return { ...event, text: "The Beholder checked for the Seer." };
        }
        const emptySelection = /^(.+?) selected no target\.?$/i.exec(event.text);
        return emptySelection ?
            { ...event, text: `${emptySelection[1]} completed their private night check.` } :
            event;
    });
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
        } else if (item.role.action === "CheckAdjacentWolves") {
            result = "The Canary checked their adjacent players for Werewolves.";
        } else if (item.role.action === "Hear") {
            result = "The Insomniac checked whether either neighbor took an action.";
        } else if (item.role.action === "RevealWerewolves") {
            result = `${roleName} learned who the Werewolves are.`;
        } else if (!targets.length) {
            result = `${roleName} completed their private night check.`;
        }
    }

    recordPhaseEvent(
        `Night ${currentNight}`,
        result,
        `night-action-${currentNight}-${nightOneCurrentAction}-${item.role.role}`,
        {
            type: "action",
            actor: item.actor,
            targets,
            result: item.skipped ? "skipped" : "completed"
        }
    );

}

function confirmNightAction() {

    const item = nightOneActionOrder[nightOneCurrentAction];
    const targetCount = getNightActionTargetCount(item);
    let targets = [];

    if (item.role.action === "TrackWolf") {
        const previousNeighbors = [item.actor.lastLeftNeighbor, item.actor.lastRightNeighbor].filter(Boolean);
        item.trackerWasTriggered = item.trackerWasTriggered ?? previousNeighbors.some(trackerNeighborWasWolfVictim);
        item.neighbors = getSelectedNeighbors();
        if (!item.neighbors) return;
        item.actor.lastLeftNeighbor = item.neighbors[0];
        item.actor.lastRightNeighbor = item.neighbors[1];

        if (currentNight === 1 || !item.trackerWasTriggered) {
            item.skipped = true;
            recordPhaseEvent(
                `Night ${currentNight}`,
                currentNight === 1 ?
                    "The Tracker's initial neighbors were recorded." :
                    "The Tracker had no inspection available because neither previous neighbor was eliminated by the Werewolves.",
                `tracker-status-${currentNight}-${item.actor.id}`,
                { type: "action", actor: item.actor, result: currentNight === 1 ? "neighbors-recorded" : "not-triggered" }
            );
            advanceNightAction();
            return;
        }
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

    if (["Hear", "CheckAdjacentWolves"].includes(item.role.action)) {
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
            if (!targets[0].bloodWolfAttackTonight) {
                targets[0].nightAttackCauses = [];
                targets[0].werewolfAttackTonight = false;
                targets[0].nonWerewolfAttackTonight = false;
                targets[0].wolfAttackCountsTonight = false;
                targets[0].attackedTonight = false;
            }
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
    if (item.role.action === "CopyRole") refreshWolfPassiveBonusesForCurrentNight();
    recordNightTargets(item, targets);
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
    if (item.role.action === "BarricadePlayer") item.actor.lastBarricadedPlayer = targets[0];
    if (item.role.action === "VoodooProtect") item.actor.lastVoodooPlayer = targets[0];
    if (item.role.action === "BlockVote") item.actor.lastMagistratePlayer = targets[0];
    if (item.role.action === "RevealVisitorCount") item.actor.lastWatchedPlayer = targets[0];
    const roleLastTargetKey = {
        "Old Hag": "lastOldHagTargetId",
        "Shadow Wolf": "lastBlackWolfTargetId",
        "Spellcaster": "lastSpellcasterTargetId",
        "Seer": "lastSeerTargetId"
    }[item.role.role];
    if (roleLastTargetKey && targets[0]) item.actor[roleLastTargetKey] = targets[0].id;

    if (item.role.action === "KillPlayer") {
        players
            .filter(player => player.alive && canChooseWerewolfElimination(player))
            .forEach(player => {
                player.tookActionTonight = true;
            });
    }

    drawNightActionResult(item, targets);

}

function recordNightTargets(item, targets) {
    if (!item?.actor || !targets.length || [
        "CheckMutualTargets",
        "Hear",
        "CheckAdjacentWolves",
        "RevealVisitorCount"
    ].includes(item.role.action)) return;
    nightTargetRecords.push({
        actorId: item.actor.id,
        actorRole: item.role.role,
        action: item.role.action,
        targetIds: targets.map(target => target.id)
    });
}

function drawTrackerNightAction(item, availablePlayers) {
    const previousNeighbors = [item.actor.lastLeftNeighbor, item.actor.lastRightNeighbor].filter(Boolean);
    item.trackerWasTriggered = currentNight > 1 && previousNeighbors.some(trackerNeighborWasWolfVictim);
    const isSetupNight = currentNight === 1 && previousNeighbors.length < 2;
    const targetOptions = availablePlayers.map(player =>
        `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`
    ).join("");

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ? "Tracker" : readAloud("Tracker, wake up.")}</h2>
        ${isSetupNight ? "" : `<p>${readAloud("If one of your neighbors was eliminated by the Werewolves last night, point to someone to inspect. Otherwise, go back to sleep.")}</p>`}
        <div class="moderatorPanel">
            ${isSetupNight ? "Select the players currently seated directly to the Tracker's left and right." :
                "Confirm the Tracker's current neighbors. Previously selected living neighbors are remembered."}
        </div>
        ${drawNeighborSelectors(availablePlayers, "Tracker", item.actor)}
        ${item.trackerWasTriggered ? `
            <hr>
            <select id="nightActionTarget">
                <option value="">Select player to inspect</option>
                <option value="nobody">Nobody</option>
                ${targetOptions}
            </select>
        ` : `
            <div class="moderatorPanel">Wait a few seconds to maintain secrecy, even though no inspection is available tonight.</div>
        `}
        <hr>
        ${item.trackerWasTriggered ? "" : `<p>${readAloud("Tracker, go to sleep.")}</p><hr>`}
        <button class="actionContinue" type="button" onclick="confirmNightAction()">Continue ➜</button>
    `;
}

function trackerNeighborWasWolfVictim(player) {
    return !player?.alive &&
        player.deathCause === "Werewolf attack" &&
        player.deathPhase === `Night ${currentNight - 1}`;
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
        "TrackWolf",
        "OracleInspect",
        "CheckAdjacentWolves",
        "CheckMutualTargets"
    ].includes(
        item.role.action
    );
    const question = includeQuestion ?
        `<p>${readAloud(item.role.question)}</p>` : "";
    const inspectedPlayer = targets[0];
    const isSorceressCheck = item.actor.role === "Sorceress" && item.role.action === "RevealRole";
    const isNightstalkerCheck = item.actor.role === "Mystic Wolf" && item.role.action === "RevealRole";
    const sorceressFinding = isSorceressCheck && roleRuleSettings.sorceressRevealsWerewolf ?
        getSorceressFinding(inspectedPlayer) : null;
    const inspectionAppearsAs = playerAppearsAs(inspectedPlayer);
    const signalIsUp = item.role.action === "BecomeSeer" ?
        item.actor.becameSeerTonight :
        item.role.action === "ChangeTeams" ?
            item.actor.becameWerewolfTonight :
        item.role.action === "CheckRoleModel" ?
            item.actor.team === "Werewolf" :
        item.role.action === "RevealRole" ?
            inspectedPlayer?.role === "Seer" :
        item.role.action === "CompareTeams" ?
            effectiveNightOneTeam(targets[0]) === effectiveNightOneTeam(targets[1]) :
        item.role.action === "Investigate" ?
            [inspectedPlayer, ...(item.neighbors || [])].some(player => playerAppearsWerewolfToPI(player)) :
        item.role.action === "TrackWolf" ?
            trackerSeesWerewolf(inspectedPlayer) :
        item.role.action === "OracleInspect" ?
            playerAppearsAs(inspectedPlayer) === "Werewolf" :
        item.role.action === "Hear" ?
            (item.neighbors || []).some(player => player?.tookActionTonight) :
        item.role.action === "CheckAdjacentWolves" ?
            (item.neighbors || []).some(canarySeesWerewolf) :
        item.role.action === "CheckMutualTargets" ?
            nightTargetRecords.some(record =>
                (record.actorId === targets[0]?.id && record.targetIds.includes(targets[1]?.id)) ||
                (record.actorId === targets[1]?.id && record.targetIds.includes(targets[0]?.id))
            ) :
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
            readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "OracleInspect" ?
            readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "CheckAdjacentWolves" ?
            readAloud("Thumbs up means a Werewolf is seated beside you. Thumbs down means no Werewolf is seated beside you.") :
        item.role.action === "CheckMutualTargets" ?
            readAloud("Thumbs up means one patrol member targeted the other. Thumbs down means neither targeted the other.") :
        item.role.action === "CheckRoleModel" ?
            readAloud("Thumbs up: you are a Werewolf. Thumbs down: you are not a Werewolf.") :
        `Signal: ${signalIsUp ? "Thumbs up" : "Thumbs down"}`;
    const isLargePrivateReveal = item.role.action === "RevealTeam" ||
        item.role.action === "RevealSeer" ||
        item.role.action === "RevealWolfVictims" ||
        item.role.action === "RevealBloodscentVictims" ||
        item.role.action === "RevealVisitorCount" ||
        isNightstalkerCheck ||
        (item.role.action === "CopyRole" && isLaterNight);
    const sorceressIcon = sorceressFinding === "Seer" ? "🔮" : sorceressFinding === "Werewolf" ? "🐺" : "●";
    const simpleSorceressSignal = isSorceressCheck && !roleRuleSettings.sorceressRevealsWerewolf;
    const isWerewolfRosterReveal = item.role.action === "RevealWerewolves";
    const signal = item.skipped ? `<p>${readAloud("No action was taken.")}</p>` : isWerewolfRosterReveal ? `
        <h3 class="moderatorHeading">Moderator note</h3>
        <div class="moderatorPanel">${escapeHTML(result)}</div>
    ` : sorceressFinding ? `
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
        <h2>${includeQuestion && !item.continuesIdentificationWake ? readAloud(`${moderatorRoleName(item.role.role)}, wake up.`) : escapeHTML(moderatorRoleName(item.role.role))}</h2>
        ${question}
        ${signal}
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue preserveUndoSnapshot" type="button" onclick="advanceNightAction()">Continue ➜</button>
    `;

}

function getNightActionResult(item, targets) {

    const target = targets[0];

    if (item.skipped) {
        return "No action taken.";
    }

    switch (item.role.action) {

        case "RevealRole":
            return item.actor.role === "Mystic Wolf" ? `${target.name} — ${target.role}` : `${target.name} was checked.`;

        case "RevealWerewolves":
            return `Werewolves: ${players.filter(player => player.alive && isRecognizedWerewolf(player)).map(player => player.name).join(", ") || "None"}`;

        case "RevealSeer": {
            const seers = players.filter(player =>
                player.alive &&
                player.role === "Seer"
            );
            return seers.length ? `Seer: ${seers.map(player => player.name).join(" and ")}` : "There is no living Seer.";
        }

        case "TrackWolf":
            return trackerSeesWerewolf(target) ? `${target.name} appears to be a Werewolf.` : `${target.name} does not appear to be a Werewolf.`;

        case "RevealWolfVictims": {
            const victims = getGraveDiggerVictims();
            return victims.map(player => `${player.name} — ${player.role}`).join("\n") || "No Werewolf victim from last night.";
        }

        case "RevealBloodscentVictims": {
            const victims = players.filter(player =>
                !player.alive && player.deathCause === "Werewolf attack" && player.deathPhase === `Night ${currentNight - 1}`
            );
            return victims.map(player => `${player.name} — ${player.role}`).join("\n") || "No Werewolf victim from last night.";
        }

        case "RevealVisitorCount": {
            const watched = targets[0];
            const count = watched ? nightTargetRecords.reduce((total, record) => {
                if (record.actorId === item.actor.id || !record.targetIds.includes(watched.id)) return total;
                if (record.action === "KillPlayer" && roleRuleSettings.watchmanCountsEachWerewolfVisitor) {
                    return total + players.filter(player =>
                        player.alive && player.tookActionTonight && canChooseWerewolfElimination(player)
                    ).length;
                }
                return total + 1;
            }, 0) : 0;
            return watched ? `${watched.name} had ${count} visitor${count === 1 ? "" : "s"}.` : "No player was watched.";
        }

        case "CheckAdjacentWolves":
            return (item.neighbors || []).some(canarySeesWerewolf) ? "A Werewolf is adjacent." : "No Werewolf is adjacent.";

        case "CheckMutualTargets":
            return "Patrol check complete.";

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
            if (apparentTeam(target) === "Werewolf") {
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
            return effectiveNightOneTeam(targets[0]) === effectiveNightOneTeam(targets[1]) ? "They are on the same team." : "They are on different teams.";

        case "RevealGroup":
            return `${item.role.role}s: ${players.filter(player => player.role === item.role.role).map(player => player.name).join(", ")}.`;

        case "CopyRole":
            if (!isLaterNight) {
                return `${target.name} selected.`;
            }

            return item.actor.doppelgangerInheritedRole ?
                `Doppelganger, this is your role: ${item.actor.doppelgangerInheritedRole}.` :
                "Doppelganger, this is your role: Doppelganger.";

        case "ConnectToPlayer":
            return `${item.actor.name} is connected to ${target.name}.`;

        case "LinkPlayers":
            return `${targets[0].name} and ${targets[1].name} are linked.`;

        case "ProtectPlayer":
        case "BlessPlayer":
            return `${target.name} is permanently protected from Werewolf attacks.`;

        case "ForgeArmor":
            return `${target.name} received armor that will block one Werewolf attack.`;

        case "BarricadePlayer":
            return `${target.name} is barricaded for tonight.`;

        case "VoodooProtect":
            return `${target.name} received the voodoo doll for tonight.`;

        case "MarkLycan":
            return `${target.name} now appears as a Werewolf to investigative roles.`;

        case "ChooseOwner":
            return `${target.name} is the Pet Wolf's owner.`;

        case "ChooseGuardianWard":
            return `${target.name} is under the Guardian's protection.`;

        case "ExposeRole":
            return `${target.name}'s role will be announced when the village wakes.`;

        case "OracleInspect":
            return playerAppearsAs(target) === "Werewolf" ?
                `${target.name} appears to be a Werewolf.` :
                `${target.name} does not appear to be a Werewolf.`;

        case "WatchPlayer":
            return `${item.actor.name} is watching ${target.name}.`;

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
            Wait a few seconds to maintain secrecy.
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
        <button type="button" onclick="setNightActionMode('take')">👍 Turn the target</button>
        <button type="button" onclick="setNightActionMode('skip')">Go to sleep</button>
    ` : `
        <button type="button" onclick="setNightActionMode('take')">Take action</button>
        <button type="button" onclick="setNightActionMode('skip')">Do not take action</button>
    `;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ? escapeHTML(moderatorRoleName(item.role.role)) : readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
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
            removeTheatricalWakesForRole("Seer", nightOneCurrentAction + 1);
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
        player.nightOneAssignedRole = role.role;

        if (role.role === "The Thing" && thingCardRole) {
            player.isThing = true;
            player.thingSecondaryRole = thingCardRole.role;
            player.role = thingCardRole.role;
            player.team = "Werewolf";
            if (thingCardRole.role === "Seer") player.isOriginalSeer = true;
            if (thingCardRole.role === "Shepherd") player.shepherdFlockAlive = true;
        }

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
            player.nightOneAssignedRole = role.role;

            if (role.role === "The Thing" && thingCardRole) {
                player.isThing = true;
                player.thingSecondaryRole = thingCardRole.role;
                player.role = thingCardRole.role;
                player.team = "Werewolf";
                if (thingCardRole.role === "Seer") player.isOriginalSeer = true;
                if (thingCardRole.role === "Shepherd") player.shepherdFlockAlive = true;
            }

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

function refreshWolfPassiveBonusesForCurrentNight() {
    const livingEliminationWolves = players.filter(player => player.alive && canChooseWerewolfElimination(player));
    const packBondDoubleKill = livingEliminationWolves.length === 1 && livingEliminationWolves[0].role === "Vengeful Wolf";
    const packHungerDoubleKill = currentNight >= 3 &&
        players.some(player => player.alive && player.role === "Ravenous Wolf") &&
        [currentNight - 1, currentNight - 2].every(night => !werewolfEliminationOccurredOnNight(night));
    if (packBondDoubleKill || packHungerDoubleKill) wolfEliminationsTonight = 2;
    bloodWolfBypassesProtectionTonight = currentNight === 3 &&
        players.some(player => player.alive && player.role === "Crimson Wolf");

    if (packBondDoubleKill) {
        recordPhaseEvent(`Night ${currentNight}`, "The Vengeful Wolf was the last Werewolf, so the Werewolves received two eliminations.", `pack-bond-double-${currentNight}`);
    }
    if (packHungerDoubleKill) {
        recordPhaseEvent(`Night ${currentNight}`, "The Werewolves had gone two consecutive nights without an elimination, so the Ravenous Wolf granted two eliminations.", `pack-hunger-${currentNight}`);
    }
    if (bloodWolfBypassesProtectionTonight) {
        recordPhaseEvent(`Night ${currentNight}`, "The living Crimson Wolf allowed Werewolf attacks to ignore all protection, Tough Guy's delay, and the Diseased penalty on Night 3.", `blood-wolf-${currentNight}`);
    }
}

function werewolfEliminationOccurredOnNight(night) {
    const phase = `Night ${night}`;
    return players.some(player =>
        player.werewolfEliminationCountedNight === night ||
        (roleRuleSettings.packsHungerCountsShepherdFlock && player.shepherdFlockEliminatedNight === night) ||
        (!player.alive && player.deathPhase === phase && (
            player.deathCause === "Werewolf attack" ||
            player.deathCause === "Tough Guy succumbed to Werewolf injuries"
        ))
    );
}

function startNextNight() {

    if (!validatePhaseBeforeAdvance()) return;

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
    nightTargetRecords = [];
    nightOneActionMode = null;
    nightOneActionOrder = [];
    const wolfCubDoubleKill = players.some(player =>
        player.role === "Wolf Cub" &&
        !player.alive &&
        (player.deathCause !== "Kicked" || roleRuleSettings.wolfCubKickActivatesBonus) &&
        !player.wolfCubBonusGranted
    );
    wolfEliminationsTonight = wolfCubDoubleKill ? 2 : 1;
    bloodWolfBypassesProtectionTonight = false;
    refreshWolfPassiveBonusesForCurrentNight();

    if (wolfCubDoubleKill) {
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
        player.barricadedTonight = false;
        player.barricadeBlockedWerewolfTonight = false;
        player.armorBrokeTonight = false;
        player.voodooProtectedTonight = false;
        player.voodooRedirectedTonight = false;
        player.voodooResolvedTonight = false;
        player.bloodWolfAttackTonight = false;
        player.watchedPlayerTonight = null;
        player.exposedByTonight = null;
        player.exposedPlayerTonight = null;
        player.silversmithBlockedWerewolfTonight = false;
        player.guardianProtectedTonight = false;
        player.guardianSacrificedTonightFor = null;
        });

    const drunkCardReveal = currentNight === 3 ? transformDrunk() : null;
    if (drunkCardReveal) refreshWolfPassiveBonusesForCurrentNight();

    roles
        .map(role => role.role === "Wild Child" ? {
            ...role,
            wake: "Every",
            action: "CheckRoleModel",
            question: "Learn whether your role model's death caused you to become a Werewolf."
        } : role)
        .filter(role =>
            (role.wake === "Every" || (
                role.role === "Beholder" &&
                roleRuleSettings.beholderWakesOnFutureNights
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
                        canChooseWerewolfElimination(player) && !player.barricadedTonight :
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

            if (role.action === "KillPlayer" && actors.length === 0) {
                const barricadedWolf = players.find(player =>
                    player.alive && player.barricadedTonight && canChooseWerewolfElimination(player)
                );
                if (barricadedWolf) actors.push(barricadedWolf);
            }

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

    const graveVictims = getGraveDiggerVictims();
    players.filter(player => player.alive && player.role === "Grave Digger" && graveVictims.length).forEach(actor => {
        nightOneActionOrder.push({
            role: { role: "Grave Digger", priority: 996, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealWolfVictims" },
            actor
        });
    });
    const hiddenDeadGraveDigger = players.find(player =>
        !player.alive && !player.roleRevealed && player.role === "Grave Digger"
    );
    if (graveVictims.length && hiddenDeadGraveDigger) {
        nightOneActionOrder.push({
            role: { role: "Grave Digger", priority: 996, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealWolfVictims" },
            actor: hiddenDeadGraveDigger,
            theatricalOnly: true
        });
    }
    const bloodscentVictims = players.filter(player =>
        !player.alive && player.deathCause === "Werewolf attack" && player.deathPhase === `Night ${currentNight - 1}`
    );
    players.filter(player => player.alive && player.role === "Death Hound" && bloodscentVictims.length).forEach(actor => {
        nightOneActionOrder.push({
            role: { role: "Death Hound", priority: 996.5, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealBloodscentVictims" },
            actor
        });
    });
    const hiddenDeadBloodscent = players.find(player =>
        !player.alive && !player.roleRevealed && player.role === "Death Hound"
    );
    if (bloodscentVictims.length && hiddenDeadBloodscent) {
        nightOneActionOrder.push({
            role: { role: "Death Hound", priority: 996.5, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealBloodscentVictims" },
            actor: hiddenDeadBloodscent,
            theatricalOnly: true
        });
    }
    nightOneActionOrder.sort((a, b) => Number(a.role.priority) - Number(b.role.priority));

    const waitingDrunk = players.find(player =>
        player.isOriginalDrunk && player.alive && !player.drunkCardReceived
    );
    const leftoverHasActiveRepresentative = leftoverCardRole?.action === "KillPlayer" ?
        players.some(player => player.alive && canChooseWerewolfElimination(player)) :
        players.some(player => player.alive && player.role === leftoverCardRole?.role);
    if (
        currentNight < 3 &&
        waitingDrunk &&
        !leftoverHasActiveRepresentative &&
        leftoverCardRole?.wake === "Every" &&
        roleHasActiveNightPrompt(leftoverCardRole)
    ) {
        nightOneActionOrder.push({
            role: { ...leftoverCardRole },
            actor: waitingDrunk,
            theatricalOnly: true,
            leftoverTheatrical: true
        });
        nightOneActionOrder.sort((a, b) => Number(a.role.priority) - Number(b.role.priority));
    }

    if (drunkCardReveal && drunkRoleNeedsDelayedSetup(drunkCardReveal.role)) {
        nightOneActionOrder.unshift({
            role: drunkCardReveal.role,
            actor: drunkCardReveal.drunk
        });
    }

    removeRedundantTheatricalWakes();

    nightOneCurrentAction = 0;

    if (drunkCardReveal) {
        drawDrunkCardReveal(drunkCardReveal);
        return;
    }

    drawNightAction();

}

function drunkRoleNeedsDelayedSetup(role) {
    return !!role &&
        hasNightOneAction(role) &&
        (String(role.wake) === "1" || role.action === "CopyRole");
}

function filterRoleList(searchText) {

    const searchTerm = String(searchText || "").trim().toLowerCase();
    roleSearchTerm = String(searchText || "");
    const roleOptions = Array.from(document.querySelectorAll(".roleOption"));
    let visibleCount = 0;

    roleOptions.forEach(option => {
        const matchesSearch = option.dataset.roleName.includes(searchTerm);
        const matchesTeam = roleTeamFilter === "all" || option.dataset.roleTeam === roleTeamFilter;
        const matchesValue = roleValueFilter === "all" || option.dataset.roleValue === roleValueFilter;
        const matchesSelected = !roleSelectedOnly || option.dataset.roleSelected === "true";
        const matches = matchesSearch && matchesTeam && matchesValue && matchesSelected;
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

function setRoleValueFilter(value) {
    roleValueFilter = ["all", "positive", "negative"].includes(value) ? value : "all";
    filterRoleList(roleSearchTerm);
}

function setRoleCategoryFilter(value) {
    if (["Villager", "Werewolf"].includes(value)) {
        roleTeamFilter = value;
        roleValueFilter = "all";
    } else if (["positive", "negative"].includes(value)) {
        roleTeamFilter = "all";
        roleValueFilter = value;
    } else {
        roleTeamFilter = "all";
        roleValueFilter = "all";
    }
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
        <div class="moderatorPanel">
            Hand ${escapeHTML(reveal.drunk.name)} the physical ${escapeHTML(reveal.role.role)} card. Do not announce the role aloud.
        </div>
        <hr>
        <p>${readAloud("Drunk, go to sleep.")}</p>
        <hr>
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

    if (wolvesDisabledTonight && !bloodWolfBypassesProtectionTonight && wolfTargets.length) {
        details.push(
            `The Werewolves targeted ${wolfTargets.map(player => player.name).join(", ")}, ` +
            "but the attack did not count because the Diseased was eliminated by the Werewolves the previous night."
        );
    }

    players.filter(player => player.fruitBruteOnlyAttackTonight).forEach(player => {
        details.push(`${player.name} was targeted, but the choice had no effect because the Fruit Brute was the only Werewolf present.`);
    });

    players.filter(player =>
        player.wolfTargetTonight && player.blessedAgainstWerewolves && !player.bloodWolfAttackTonight
    ).forEach(player => {
        details.push(
            `${player.name} was targeted by the Werewolves but survived because of the Priest's permanent blessing.`
        );
    });

    players.filter(player => player.bodyguardBlockedWerewolfAttackTonight).forEach(player => {
        const protectionSource = player.protectionCauseTonight || "a protective action";
        details.push(`${player.name} survived the Werewolf attack because of ${protectionSource}.`);
    });

    players.filter(player => player.armorBrokeTonight).forEach(player => {
        details.push(`${player.name} survived the Werewolf attack because their armor broke.`);
    });
    players.filter(player => player.silversmithBlockedWerewolfTonight).forEach(player => {
        details.push(`${player.name}, the Silversmith, cannot be eliminated by Werewolf attacks.`);
    });
    players.filter(player => player.guardianProtectedTonight).forEach(player => {
        details.push(`${player.name}, the Guardian, survived because the player they guard is still alive.`);
    });
    players.filter(player => player.guardianSacrificedTonightFor).forEach(player => {
        details.push(`${player.name}, the Guardian, died in place of ${player.guardianSacrificedTonightFor}.`);
    });
    players.filter(player => player.barricadeBlockedWerewolfTonight).forEach(player => {
        details.push(`${player.name} could not be targeted by the Werewolves because the Locksmith barricaded them.`);
    });
    players.filter(player => player.voodooRedirectedTonight).forEach(player => {
        details.push(roleRuleSettings.voodooDollTargetSurvives ?
            `${player.name} survived the Werewolf attack because the voodoo doll redirected it.` :
            `${player.name}'s voodoo doll retaliated against a Werewolf, but ${player.name} was still eliminated.`);
    });
    players.filter(player => player.bloodWolfAttackTonight).forEach(player => {
        details.push(`${player.name} was targeted during the Crimson Wolf's Night 3 attack, so protection did not apply.`);
    });

    players.filter(player => player.bodyguardBlockedOtherAttackTonight?.length).forEach(player => {
        details.push(
            `${player.name} survived ${player.bodyguardBlockedOtherAttackTonight.join(" and ")} because the Bodyguard protected them.`
        );
    });

    players.filter(player => player.alphaConversionFailedTonight).forEach(player => {
        details.push(
            `${player.name} resisted the Alpha Wolf's conversion because they were protected from Werewolf attacks. ` +
            (roleRuleSettings.alphaFailedConversionUsesAbility ?
                "The Alpha Wolf's ability was still used." :
                "The Alpha Wolf may try again on a future night.")
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
        player.wolfAttackCountsTonight &&
        !player.bloodWolfAttackTonight
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

function shouldRecordNightModeratorDetail(detail) {
    // Voodoo retaliation already has one consolidated timeline event plus the
    // affected Werewolf's elimination event. Keep this detail on the moderator
    // update without repeating it again in the saved game timeline.
    return !/voodoo doll (?:redirected|retaliated)/i.test(detail);
}

function drawAlphaConversionSignal(player) {
    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <h3>Alpha Wolf conversion</h3>
        <div class="moderatorPanel">
            Walk once around the group, then quietly tap ${escapeHTML(player.name)} to tell them they are now a Werewolf. Keep everyone else's eyes closed.
        </div>
        <button class="actionContinue" type="button" onclick="finishAlphaConversionSignal(${players.indexOf(player)})">Continue ➜</button>
    `;
}

function finishAlphaConversionSignal(playerIndex) {
    const player = players[playerIndex];
    if (player) player.alphaConversionSignalPending = false;
    drawDayOne();
}

function drawDayOne() {

    const isResumingMorning = resumeMorningAfterSpecialResolution;
    resumeMorningAfterSpecialResolution = false;

    if (!isResumingMorning) {
        currentDay = currentNight;
        let diseasedKilledByWolves = false;

        players.filter(player => player.pendingAlphaConversion).forEach(player => {
            const armorBlockedConversion =
                roleRuleSettings.blacksmithArmorBlocksAlphaConversion && player.armorCharges > 0;
            const conversionBlocked = armorBlockedConversion ||
                (roleRuleSettings.bodyguardBlocksAlphaConversion && player.protectedFromWerewolvesTonight) ||
                (roleRuleSettings.priestBlessingBlocksAlphaConversion && player.blessedAgainstWerewolves);

            if (conversionBlocked) {
                player.alphaConversionFailedTonight = true;
                const alphaActor = players.find(actor => actor.id === player.alphaConversionActorId);
                if (alphaActor && !roleRuleSettings.alphaFailedConversionUsesAbility) {
                    alphaActor.usedOncePerGameAction = false;
                }
                if (armorBlockedConversion) {
                    player.armorCharges--;
                    player.armorBrokeTonight = true;
                }
            } else {
                player.role = "Werewolf";
                player.team = "Werewolf";
                player.alphaConvertedTonight = true;
                player.alphaConversionSignalPending = true;
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

        const convertedPlayerToSignal = players.find(player => player.alphaConversionSignalPending);
        if (convertedPlayerToSignal) {
            drawAlphaConversionSignal(convertedPlayerToSignal);
            return;
        }

        const voodooTarget = players.find(player => player.alive && player.voodooRedirectedTonight && !player.voodooResolvedTonight);
        if (voodooTarget) {
            if (roleRuleSettings.voodooDollTargetSurvives) {
                voodooTarget.nightAttackCauses = (voodooTarget.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
                voodooTarget.werewolfAttackTonight = false;
                voodooTarget.wolfAttackCountsTonight = false;
                voodooTarget.attackedTonight = voodooTarget.nightAttackCauses.length > 0;
                voodooTarget.pendingDeathCause = voodooTarget.nightAttackCauses[0] || null;
            }
            drawVoodooRetaliation(voodooTarget);
            return;
        }

        diseasedKilledByWolves = players.some(player =>
            player.role === "Diseased" && player.wolfAttackCountsTonight && !player.bloodWolfAttackTonight
        );

        players.filter(guardian =>
            guardian.alive &&
            guardian.role === "Guardian" &&
            guardian.guardianWard?.alive &&
            guardian.guardianWard.werewolfAttackTonight &&
            !guardian.guardianWard.bloodWolfAttackTonight
        ).forEach(guardian => {
            const ward = guardian.guardianWard;
            ward.nightAttackCauses = (ward.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            ward.werewolfAttackTonight = false;
            ward.wolfAttackCountsTonight = false;
            ward.attackedTonight = ward.nightAttackCauses.length > 0;
            ward.pendingDeathCause = ward.nightAttackCauses[0] || null;
            guardian.guardianSacrificedTonightFor = ward.name;
            recordElimination(guardian, `Guardian sacrifice for ${ward.name}`, `Night ${currentNight}`);
            guardian.werewolfEliminationCountedNight = currentNight;
        });

        players.filter(guardian =>
            guardian.alive &&
            guardian.role === "Guardian" &&
            guardian.guardianWard?.alive &&
            guardian.werewolfAttackTonight &&
            !guardian.bloodWolfAttackTonight
        ).forEach(guardian => {
            guardian.nightAttackCauses = (guardian.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            guardian.werewolfAttackTonight = false;
            guardian.wolfAttackCountsTonight = false;
            guardian.attackedTonight = guardian.nightAttackCauses.length > 0;
            guardian.pendingDeathCause = guardian.nightAttackCauses[0] || null;
            guardian.guardianProtectedTonight = true;
        });

        players.filter(player => player.alive && player.role === "Shepherd" && player.shepherdFlockAlive && player.werewolfAttackTonight && !player.bloodWolfAttackTonight).forEach(player => {
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            player.shepherdFlockAlive = false;
            player.shepherdFlockSavedTonight = true;
            player.shepherdFlockEliminatedNight = currentNight;
            if (player.armorBrokeTonight && player.armorCharges === 0) {
                player.armorCharges = 1;
                player.armorBrokeTonight = false;
            }
        });

        players.filter(player => player.alive && player.role === "Butcher" && player.werewolfAttackTonight && !player.bloodWolfAttackTonight).forEach(player => {
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

        players.filter(player =>
            player.alive &&
            player.armorCharges > 0 &&
            player.werewolfAttackTonight &&
            !player.bloodWolfAttackTonight
        ).forEach(player => {
            player.armorCharges--;
            player.armorBrokeTonight = true;
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            player.pendingDeathCause = player.nightAttackCauses[0] || null;
        });

        players.forEach(player => {
            if (player.toughGuyDeathPending) {
                recordElimination(
                    player,
                    "Tough Guy succumbed to Werewolf injuries",
                    `Night ${currentNight}`
                );
                player.werewolfEliminationCountedNight = currentNight;
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
                if (player.role === "Tough Guy" && !nonWerewolfCause && !player.bloodWolfAttackTonight) {
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
            player.role === "Diseased" && player.wolfAttackCountsTonight && !player.bloodWolfAttackTonight
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
        const connectionVictims = players.filter(player =>
            player.alive &&
            newlyEliminated.includes(player.connectedTo)
        );
        const petOwnerVictims = newlyEliminated
            .filter(player => player.petOwner && player.deathCause !== "Kicked" && player.petOwner.alive)
            .map(player => player.petOwner);
        newlyEliminated = [...new Set([...connectionVictims, ...petOwnerVictims])];

        newlyEliminated.forEach(player => {
            recordElimination(
                player,
                petOwnerVictims.includes(player) ? "Pet Wolf recognition" :
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

    getNightModeratorDetails().filter(shouldRecordNightModeratorDetail).forEach((detail, index) => {
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
            "Villagers win! All Werewolves have been eliminated.",
            "morning"
        );
        return;
    }

    if (
        !nightHunter &&
        !ignoreWinConditions &&
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.reduce((total, player) => total + getWerewolfParityValue(player), 0) >= livingVillagerParityCount
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
    const exposedRoles = players.filter(player => player.exposedByTonight).map(player =>
        `<p>${readAloud(`The Exposer discovered the ${revealedRoleName(player)}.`)}</p>`
    ).join("");
    const eliminationRows = eliminated.map(player =>
        `<p>${readAloud(`Eliminated: ${player.name}${player.roleRevealed ? ` — ${revealedRoleName(player)}` : ""} — ${publicNightEliminationCause(player)}.`)}</p>`
    ).join("");
    const summaryRows = statusRows + exposedRoles + eliminationRows;
    const moderatorDetails = getNightModeratorDetails()
        .map(detail => `<li>${escapeHTML(detail)}</li>`)
        .join("");
    getNightModeratorDetails().filter(shouldRecordNightModeratorDetail).forEach((detail, index) => {
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
        <h3>${nightHunter.isDoppelganger ? "Doppelganger — Hunter" : "Hunter"}</h3>
        ${nightHunter.isDoppelganger ? `<p>${readAloud("The Doppelganger inherited the Hunter. The Hunter has died again.")}</p>` : ""}
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

function drawVoodooRetaliation(protectedPlayer) {
    const wolves = players.filter(player => player.alive && canChooseWerewolfElimination(player));
    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <h3>Voodoo Doll</h3>
        <div class="moderatorPanel">${escapeHTML(protectedPlayer.name)} had the voodoo doll and was attacked by the Werewolves. ${roleRuleSettings.voodooDollTargetSurvives ? "They survive." : "They are still eliminated."} Select the Werewolf seated physically closest to them.</div>
        <select id="voodooWolfTarget"><option value="">Select closest Werewolf</option><option value="nobody">Nobody</option>${wolves.map(player => `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`).join("")}</select>
        <button class="actionContinue" type="button" onclick="resolveVoodooRetaliation(${players.indexOf(protectedPlayer)})">Continue ➜</button>
    `;
}

function resolveVoodooRetaliation(protectedIndex) {
    const protectedPlayer = players[protectedIndex];
    const selected = document.getElementById("voodooWolfTarget");
    if (protectedPlayer && selected?.value === "nobody") {
        protectedPlayer.voodooResolvedTonight = true;
        recordPhaseEvent(
            `Night ${currentNight}`,
            `${protectedPlayer.name}'s voodoo doll redirected the Werewolf attack, but Nobody was selected for retaliation.${roleRuleSettings.voodooDollTargetSurvives ? ` ${protectedPlayer.name} survived.` : ` ${protectedPlayer.name} was still eliminated.`}`,
            `voodoo-${currentNight}-${protectedPlayer.id}`
        );
        drawDayOne();
        return;
    }
    const wolf = players[Number(selected?.value)];
    if (!protectedPlayer || !selected || selected.value === "" || !wolf?.alive || !canChooseWerewolfElimination(wolf)) {
        alert("Select the closest Werewolf.");
        return;
    }
    protectedPlayer.voodooResolvedTonight = true;
    recordElimination(wolf, "Voodoo doll", `Night ${currentNight}`);
    recordPhaseEvent(
        `Night ${currentNight}`,
        `${protectedPlayer.name}'s voodoo doll redirected the Werewolf attack to ${wolf.name}.${roleRuleSettings.voodooDollTargetSurvives ? ` ${protectedPlayer.name} survived.` : ` ${protectedPlayer.name} was still eliminated.`}`,
        `voodoo-${currentNight}-${protectedPlayer.id}`
    );
    drawDayOne();
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
            `${player.roleRevealed ? "Role revealed" : "Role not revealed"} - ${summaryRoleName(player)}` :
            summaryRoleName(player);
        const linkedPlayer = player.connectedTo;
        const connectionBadge = linkedPlayer && ["cupid", "dire"].includes(player.connectionType) ?
            `<span class="statusBadge linkedBadge">🔗 Linked — ${escapeHTML(linkedPlayer.name)}</span>` : "";
        const statusBadges = [
            player.team === "Werewolf" ? '<span class="statusBadge wolfBadge">🐺 Werewolf team</span>' : "",
            player.protected ? '<span class="statusBadge">🛡 Protected</span>' : "",
            player.blessedAgainstWerewolves ? '<span class="statusBadge blessedBadge">🙏 Blessed</span>' : "",
            player.armorCharges > 0 ? '<span class="statusBadge armorBadge">🛡️ Armor</span>' : "",
            player.role === "Shepherd" && player.shepherdFlockAlive ? '<span class="statusBadge flockBadge">🐑 Flock</span>' : "",
            player.role === "Guardian" && player.guardianWard?.alive ? `<span class="statusBadge linkedBadge">🪽 Guarding — ${escapeHTML(player.guardianWard.name)}</span>` : "",
            isPhantomMarked(player) ? '<span class="statusBadge wolfBadge">👻 Phantom-marked</span>' : "",
            player.petOwner ? `<span class="statusBadge linkedBadge">🐾 Owner — ${escapeHTML(player.petOwner.name)}</span>` : "",
            player.silenced ? '<span class="statusBadge">🔇 Silenced</span>' : "",
            player.toughGuyDeathPending ? '<span class="statusBadge warningBadge">⏳ Delayed death</span>' : "",
            connectionBadge,
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
                        ${escapeHTML(player.name)}${isRecognizedWerewolf(player) ? " 🐺" : ""}
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

        <button type="button" onclick="endDayWithoutElimination()">
            Skip to Night
        </button>

        <button type="button" onclick="drawCurrentGameSummary()">
            Current Game Summary
        </button>

        <button type="button" onclick="showGameStateCorrection()">
            Correct Game State
        </button>

    `;


    document.getElementById("screen").innerHTML = html;

}

function showGameStateCorrection() {
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="correctionTitle">
        <h2 id="correctionTitle">Correct Game State</h2>
        <p>Use this only to correct a moderator mistake. The correction will be included in the timeline.</p>
        <label>Player<select id="correctionPlayer" onchange="loadCorrectionPlayer()">
            ${players.map((player, index) => `<option value="${index}">${escapeHTML(player.name)}</option>`).join("")}
        </select></label>
        <label class="ruleToggle"><input id="correctionAlive" type="checkbox"><span><strong>Player is alive</strong><small>Correct status</small></span></label>
        <label class="ruleToggle"><input id="correctionRevealed" type="checkbox"><span><strong>Role is revealed</strong><small>Correct visibility</small></span></label>
        <label>Cause of death<input id="correctionCause" type="text" placeholder="Leave blank if alive"></label>
        <label>Phase<input id="correctionPhase" type="text" placeholder="For example: Night 3"></label>
        <div class="modalActions"><button type="button" data-modal-cancel>Cancel</button><button type="button" onclick="applyGameStateCorrection()">Apply Correction</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = activateModal(overlay, overlay.querySelector("#correctionPlayer"));
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", close);
    overlay._closeModal = close;
    loadCorrectionPlayer();
}

function loadCorrectionPlayer() {
    const player = players[Number(document.getElementById("correctionPlayer")?.value)];
    if (!player) return;
    document.getElementById("correctionAlive").checked = player.alive;
    document.getElementById("correctionRevealed").checked = player.roleRevealed === true;
    document.getElementById("correctionCause").value = player.deathCause || "";
    document.getElementById("correctionPhase").value = player.deathPhase || "";
}

function applyGameStateCorrection() {
    const index = Number(document.getElementById("correctionPlayer")?.value);
    const player = players[index];
    if (!player) return;
    const alive = document.getElementById("correctionAlive").checked;
    const cause = document.getElementById("correctionCause").value.trim();
    const phase = document.getElementById("correctionPhase").value.trim();
    if (!alive && (!cause || !/^(Night|Day) \d+$/.test(phase))) {
        showAppAlert("An eliminated player needs a cause and a phase such as Night 3 or Day 3.");
        return;
    }
    player.alive = alive;
    player.roleRevealed = document.getElementById("correctionRevealed").checked;
    if (alive) {
        const previousDeathOrder = player.deathOrder;
        if (previousDeathOrder) {
            phaseHistory = phaseHistory.filter(event => event.key !== `elimination-${previousDeathOrder}`);
        }
        player.deathCause = null;
        player.deathPhase = null;
        player.deathOrder = null;
        player.deathAnnounced = false;
    } else {
        player.deathCause = cause;
        player.deathPhase = phase;
        if (!player.deathOrder) player.deathOrder = ++eliminationSequence;
    }
    recordPhaseEvent(
        alive ? `Day ${currentDay}` : phase,
        `Moderator correction: ${player.name} was marked ${alive ? "alive" : `eliminated by ${cause}`}.`,
        `correction-${Date.now()}`,
        { type: "correction", targets: [player], cause: alive ? null : cause, result: alive ? "alive" : "eliminated" }
    );
    document.querySelector(".appModalOverlay")?._closeModal?.();
    drawDayOnePlayers();
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
    const pacifists = players.filter(currentPlayer =>
        currentPlayer.role === "Pacifist" && currentPlayer.alive && !currentPlayer.exiledTonight
    );
    const villageIdiots = players.filter(currentPlayer =>
        currentPlayer.role === "Village Idiot" && currentPlayer.alive && !currentPlayer.exiledTonight
    );
    const bailiff = players.find(currentPlayer => currentPlayer.role === "Bailiff" && currentPlayer.alive && !currentPlayer.exiledTonight);
    const judge = players.find(currentPlayer => currentPlayer.role === "Judge" && currentPlayer.alive && !currentPlayer.exiledTonight && !currentPlayer.judgePardonUsed);
    const livingScribe = players.find(currentPlayer => currentPlayer.role === "Scribe" && currentPlayer.alive && !currentPlayer.exiledTonight);
    const scribeIsInGame = players.some(currentPlayer => currentPlayer.role === "Scribe");
    const votingReminders = [
        mayor ? `${mayor.name} is the Mayor; their vote counts twice.` : "",
        pacifists.length ? `${pacifists.map(player => player.name).join(", ")} ${pacifists.length === 1 ? "is" : "are"} the Pacifist; count each as a Spare vote.` : "",
        villageIdiots.length ? `${villageIdiots.map(player => player.name).join(", ")} ${villageIdiots.length === 1 ? "is" : "are"} the Village Idiot; count each as an Eliminate vote.` : "",
        bailiff ? `${bailiff.name} is the Bailiff; if the vote ties, resolve it according to the Bailiff's vote.` : "",
        judge ? `${judge.name} is the Judge and still has a pardon available.` : "",
        scribeIsInGame ? (livingScribe ?
            `The Scribe is alive, so votes are public.` :
            `The Scribe is dead, so conduct the vote anonymously with everyone's eyes closed.`) : ""
    ].filter(Boolean);
    document.getElementById("screen").innerHTML = `
        <h2>Vote</h2>
        <p>${readAloud(`${player.name} is on trial.`)}</p>
        <p>Votes needed to eliminate: <strong>${votesNeeded}</strong></p>
        ${votingReminders.length ? `<div class="moderatorPanel"><strong>Moderator voting notes:</strong><ul>${votingReminders.map(note => `<li>${escapeHTML(note)}</li>`).join("")}</ul></div>` : ""}
        ${player.magistrateProtectedToday ? `<p class="infoCallout">The Magistrate has protected this player from today’s elimination vote.</p>` : ""}
        <button type="button" onclick="resolveVote(${index}, true)" ${player.magistrateProtectedToday ? "disabled" : ""}>Eliminate</button>
        <button type="button" onclick="resolveVote(${index}, false)" ${player.magistrateProtectedToday ? "disabled" : ""}>Spare</button>
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
        if (players[index].role === "Prince") {
            players[index].roleRevealed = true;
            dayEliminationVoteOccurred = true;
            recordPhaseEvent(
                `Day ${currentDay}`,
                `${players[index].name} was revealed as the Prince and survived the village vote.`,
                `prince-survives-${currentDay}-${players[index].id}`
            );
            drawPrinceVoteReveal(players[index]);
            return;
        }
        const judge = players.find(player =>
            player.alive &&
            player.role === "Judge" &&
            !player.judgePardonUsed &&
            (roleRuleSettings.judgeMayPardonSelf || player !== players[index])
        );
        if (judge) {
            drawJudgeDecision(judge, index);
            return;
        }
        completeVoteElimination(index);
        return;
    }

    dayEliminationVoteOccurred = true;
    savedVoteCount++;
    recordPhaseEvent(
        `Day ${currentDay}`,
        `The village spared ${players[index]?.name || "a player"}. Spare vote ${savedVoteCount} of 3.`,
        `day-spare-${currentDay}-${savedVoteCount}`
    );

    if (savedVoteCount >= 3) {
        endDayWithoutElimination(false);
        return;
    }

    drawDayOnePlayers();
}

function transformSasquatchesAtDayEnd() {
    const transformed = players.filter(player => player.alive && player.role === "Sasquatch");
    transformed.forEach(player => {
        player.role = "Werewolf";
        player.team = "Werewolf";
        recordPhaseEvent(
            `Day ${currentDay}`,
            `${player.name}, the Sasquatch, became a Werewolf because the Day ended without an elimination.`,
            `sasquatch-${player.id}-${currentDay}`
        );
    });
    return transformed;
}

function endDayWithoutElimination(recordNoVote = true) {
    if (recordNoVote) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }
    const transformed = transformSasquatchesAtDayEnd();
    if (!transformed.length) {
        drawEveryoneGoToSleep();
        return;
    }
    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <h3>${readAloud(transformed.length === 1 ?
            "The Sasquatch has become a Werewolf." :
            "The Sasquatches have become Werewolves.")}</h3>
        <button type="button" onclick="drawEveryoneGoToSleep()">Continue ➜</button>
    `;
}

function drawPrinceVoteReveal(prince) {
    document.getElementById("screen").innerHTML = `
        <h2>Prince</h2>
        <p>${readAloud(`${prince.name} is the Prince. The Prince survives the village vote.`)}</p>
        <button type="button" onclick="drawEveryoneGoToSleep()">Continue ➜</button>
    `;
}

function completeVoteElimination(index, twinChecked = false) {
    const accused = players[index];
    const twin = !twinChecked ? players.find(player =>
        player.alive && player.role === "Twin" && player !== accused
    ) : null;
    if (twin) {
        drawTwinDecision(twin, accused, index);
        return;
    }
    dayEliminationVoteOccurred = true;
    recordElimination(accused, "Village vote", `Day ${currentDay}`);
    const martyr = players.find(player => player.alive && player.role === "Martyr" && !player.martyrUsed);
    if (martyr) {
        drawMartyrDecision(martyr, accused);
        return;
    }
    resolveEliminationConsequences();
}

function drawTwinDecision(twin, accused, accusedIndex) {
    document.getElementById("screen").innerHTML = `
        <h2>Twin</h2>
        <p>${readAloud("Twin, would you like to take the accused player's place?")}</p>
        <div class="moderatorPanel">${escapeHTML(twin.name)} may die instead of ${escapeHTML(accused.name)}. The Twin does not inherit the accused player's role.</div>
        <button type="button" onclick="resolveTwinDecision(${players.indexOf(twin)}, ${accusedIndex}, true)">Take Their Place</button>
        <button type="button" onclick="resolveTwinDecision(${players.indexOf(twin)}, ${accusedIndex}, false)">Do Nothing</button>
    `;
}

function resolveTwinDecision(twinIndex, accusedIndex, replace) {
    const twin = players[twinIndex];
    const accused = players[accusedIndex];
    if (!replace || !twin?.alive || twin.role !== "Twin" || !accused?.alive) {
        completeVoteElimination(accusedIndex, true);
        return;
    }
    dayEliminationVoteOccurred = true;
    twin.roleRevealed = true;
    recordElimination(twin, `Twin substitution for ${accused.name}`, `Day ${currentDay}`);
    recordPhaseEvent(
        `Day ${currentDay}`,
        `${twin.name}, the Twin, took ${accused.name}'s place in the village elimination.`,
        `twin-substitution-${currentDay}-${twin.id}`
    );
    resolveEliminationConsequences();
}

function drawJudgeDecision(judge, accusedIndex) {
    document.getElementById("screen").innerHTML = `
        <h2>Judge</h2>
        <p>${readAloud("Judge, would you like to publicly reveal your card and pardon the accused player?")}</p>
        <div class="moderatorPanel">If the Judge pardons, reveal ${escapeHTML(judge.name)} as the Judge. No player is eliminated and the Day ends.</div>
        <button type="button" onclick="resolveJudgeDecision(${players.indexOf(judge)}, ${accusedIndex}, true)">Grant Pardon</button>
        <button type="button" onclick="resolveJudgeDecision(${players.indexOf(judge)}, ${accusedIndex}, false)">Do Not Pardon</button>
    `;
}

function resolveJudgeDecision(judgeIndex, accusedIndex, pardon) {
    const judge = players[judgeIndex];
    if (!judge?.alive || judge.role !== "Judge" || !pardon) {
        completeVoteElimination(accusedIndex);
        return;
    }
    judge.judgePardonUsed = true;
    judge.roleRevealed = true;
    dayEliminationVoteOccurred = true;
    recordPhaseEvent(`Day ${currentDay}`, `${judge.name}, the Judge, revealed their card and pardoned ${players[accusedIndex]?.name || "the accused player"}. No one was eliminated.`, `judge-pardon-${currentDay}-${judge.id}`);
    endDayWithoutElimination(false);
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
        const inheritedTeam = roleTeamForInheritance(eliminatedPlayer);
        const inheritedDoppelgangerTarget = eliminatedPlayer.doppelgangerTarget;
        const inheritedDoppelgangerRole = eliminatedPlayer.doppelgangerInheritedRole;
        inheritRoleState(martyr, { ...eliminatedPlayer, team: inheritedTeam });
        martyr.martyrUsed = true;
        if (inheritedRole === "Doppelganger") {
            martyr.isDoppelganger = true;
            martyr.doppelgangerTarget = inheritedDoppelgangerTarget || null;
            martyr.doppelgangerInheritedRole = inheritedDoppelgangerRole || null;
        } else {
            martyr.isDoppelganger = false;
            martyr.doppelgangerTarget = null;
            martyr.doppelgangerInheritedRole = null;
        }
        eliminatedPlayer.roleBeforeMartyrExchange = inheritedRole;
        eliminatedPlayer.teamBeforeMartyrExchange = inheritedTeam;
        eliminatedPlayer.roleInheritedByMartyrId = martyr.id;
        eliminatedPlayer.petOwner = null;
        eliminatedPlayer.role = "Martyr";
        eliminatedPlayer.team = "Villager";
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
        player.isWildChild &&
        player.roleModel &&
        !player.roleModel.alive &&
        (player.roleModel.deathCause === "Kicked" ?
            roleRuleSettings.wildChildTransformsAfterKick :
            roleDeathWasAtNight(player.roleModel) ?
                roleRuleSettings.wildChildTransformsAfterNightDeath :
                roleRuleSettings.wildChildTransformsAfterDayDeath)
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

            if (
                !player.alive &&
                player.petOwner &&
                player.deathCause !== "Kicked" &&
                player.petOwner?.alive
            ) {
                recordElimination(player.petOwner, "Pet Wolf recognition", `Day ${currentDay}`);
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
        <h2>${bomber.isDoppelganger ? "Doppelganger — Mad Bomber" : "Mad Bomber"}</h2>
        <p>${readAloud(bomber.isDoppelganger ?
            "The Doppelganger inherited the Mad Bomber. The Mad Bomber has died again." :
            "The Mad Bomber was eliminated.")}</p>
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
        <h2>${hunter.isDoppelganger ? "Doppelganger — Hunter" : "Hunter"}</h2>
        <p>${hunter.isDoppelganger ?
            "The Doppelganger inherited the Hunter. The Hunter has died again. Choose one player to eliminate." :
            "The Hunter was eliminated. Choose one player to eliminate."}</p>
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
        `<li>${readAloud(`${player.name} was the ${revealedRoleName(player)}.`)}</li>`
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
        gameResultMessage = message;
    }
    sanitizePhaseHistory();

    const livingPlayers = players.filter(player => player.alive);
    const deadPlayers = players
        .filter(player => !player.alive)
        .sort((first, second) =>
            Number(first.deathOrder || Number.MAX_SAFE_INTEGER) -
            Number(second.deathOrder || Number.MAX_SAFE_INTEGER)
        );
    const resultPhase = continuation === "morning" ? `Night ${currentNight}` :
        (["day", "postVote"].includes(continuation) ? `Day ${currentDay}` : null);
    const unannouncedPlayers = deadPlayers.filter(player => !player.deathAnnounced);
    const newlyEliminatedPlayers = unannouncedPlayers.length ? unannouncedPlayers :
        (resultPhase ? deadPlayers.filter(player => player.deathPhase === resultPhase) : []);
    const livingRows = livingPlayers.length ? livingPlayers.map(player => `
        <li>
            <strong>${escapeHTML(player.name)}</strong> —
            ${escapeHTML(summaryRoleName(player))}
        </li>
    `).join("") : "<li>None</li>";
    const eliminatedRosterRows = deadPlayers.length ? deadPlayers.map(player => `
        <li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(summaryRoleName(player))}</li>
    `).join("") : "<li>None</li>";
    const finalEliminationRows = newlyEliminatedPlayers.map(player => `
        <li>${readAloud(`${player.name} was eliminated by ${resultPhase?.startsWith("Night ") ? publicNightEliminationCause(player) : (player.deathCause || "an unknown cause")}.`)}</li>
    `).join("");
    const continuedWinRows = phaseHistory
        .filter(event => event.type === "continued-win")
        .map(event => `<li>${escapeHTML(event.text)}</li>`)
        .join("");
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
                    ${escapeHTML(summaryRoleName(player))} —
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
            .map(player => `<li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(summaryRoleName(player))} — ${escapeHTML(player.deathCause || "Unknown cause")}</li>`)
            .join("");
        const emptyPhaseText = reviewOnly && phase === `Day ${currentDay}` ?
            "<li>Day in progress; no elimination vote has been completed.</li>" :
            "<li>No recorded events.</li>";
        return `<h3>${escapeHTML(phase)}</h3><ul>${eventRows || emptyPhaseText}</ul>`;
    }).join("") : "<p>No game events were recorded.</p>";

    document.getElementById("screen").innerHTML = `
        ${reviewOnly ? "" : `<h2>Game Over</h2>${finalEliminationRows ? `<div class="infoCallout"><strong>Just Eliminated</strong><ul>${finalEliminationRows}</ul></div>` : ""}<p>${readAloud(message)}</p><hr>`}
        <h2>Game Summary</h2>
        ${continuedWinRows ? `<div class="infoCallout"><strong>Continued after a win</strong><ul>${continuedWinRows}</ul></div>` : ""}
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
            `${player.name} - ${summaryRoleName(player)}`
        ) : ["None"]),
        "",
        "Eliminated",
        ...(deadPlayers.length ? deadPlayers.map(player =>
            `${player.name} - ${summaryRoleName(player)}`
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
            lines.push(`${player.name} - ${summaryRoleName(player)} - ${player.deathCause || "Unknown cause"}`);
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
    const wonDuringPhase = continuation === "morning" ? `Night ${currentNight}` : `Day ${currentDay}`;
    recordPhaseEvent(
        wonDuringPhase,
        `A win condition was reached (${gameResultMessage || "game won"}), but the moderator chose to continue the game.`,
        `continued-win-${Date.now()}`,
        { type: "continued-win", result: "continued" }
    );
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

function endGame() {

    showAppConfirmation("End this game and clear its saved progress?", completeEndGame);

}

function completeEndGame() {

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }

    persistenceDisabled = true;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameState = null;
    updateBackButton();
    gameResultContinuation = null;
    gameResultMessage = null;
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
    nightTargetRecords = [];
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;
    wolfEliminationsTonight = 1;
    bloodWolfBypassesProtectionTonight = false;
    currentNight = 1;
    currentDay = 0;
    leftoverCardRole = null;
    thingCardRole = null;
    resumeMorningAfterSpecialResolution = false;
    roleSearchTerm = "";
    eliminationSequence = 0;
    roleSortMode = "alphabetical-asc";
    roleTeamFilter = "all";
    roleValueFilter = "all";
    roleSelectedOnly = false;
    ignoreWinConditions = false;
    gameResultContinuation = null;
    phaseHistory = [];
    dayEliminationVoteOccurred = false;
    lastActionDescription = "the last action";
    gameResultMessage = null;

    drawPlayerScreen();
    updateWakeLock();

}

function getWinMessage() {

    if (hasPendingEliminationResolution()) return null;

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
        return "Villagers win! All Werewolves have been eliminated.";
    }

    if (
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.reduce((total, player) => total + getWerewolfParityValue(player), 0) >= livingVillagerParityCount
    ) {
        return getWerewolfVictoryMessage(livingWerewolves);
    }

    return null;

}

function hasPendingEliminationResolution() {
    return players.some(player =>
        (player.alive && player.connectedTo && !player.connectedTo.alive &&
            (player.connectionType === "dire" || player.connectedTo.connectionType === "cupid")) ||
        (!player.alive && player.role === "Hunter" && !player.hunterRevengeResolved && hunterShouldActivate(player)) ||
        (!player.alive && player.role === "Mad Bomber" && !player.bomberResolved && madBomberShouldActivate(player))
    );
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
        <div class="moderatorPanel">Moderator Note: Make sure everyone is asleep.</div>
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
            `elimination-${player.deathOrder}`,
            { type: "elimination", targets: [player], cause, result: "eliminated" }
        );
    }

}

function canChooseWerewolfElimination(player) {

    if (player?.isThing) {
        return player.team === "Werewolf" && roleRuleSettings.thingParticipatesWolfEliminations;
    }
    return apparentTeam(player) === "Werewolf" &&
        !["Minion", "Sorceress"].includes(player.role);

}

function countsForWerewolfParity(player) {
    if (player.role === "Minion") return roleRuleSettings.minionCountsForWerewolfParity;
    if (player.role === "Fruit Brute") return roleRuleSettings.fruitBruteCountsForWerewolfParity;
    if (player.role === "Sorceress") return roleRuleSettings.sorceressCountsForWerewolfParity;
    return player.team === "Werewolf";
}

function getWerewolfParityValue(player) {
    if (!countsForWerewolfParity(player)) return 0;
    return player.role === "Big Bad Wolf" ? 2 : 1;
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
window.resolveTwinDecision = resolveTwinDecision;
window.resolveVote = resolveVote;
window.resolveMartyrDecision = resolveMartyrDecision;
window.confirmMartyrDecision = confirmMartyrDecision;
window.finishMartyrDecision = finishMartyrDecision;
window.finishAlphaConversionSignal = finishAlphaConversionSignal;
window.startNextNight = startNextNight;
window.showRoleInfo = showRoleInfo;
window.showGameGuide = showGameGuide;
window.setRoleRuleOption = setRoleRuleOption;
window.setRoleTeamFilter = setRoleTeamFilter;
window.setRoleValueFilter = setRoleValueFilter;
window.setRoleCategoryFilter = setRoleCategoryFilter;
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
window.advanceBarricadedNightAction = advanceBarricadedNightAction;
window.resolveVoodooRetaliation = resolveVoodooRetaliation;
window.resolveJudgeDecision = resolveJudgeDecision;
window.drawEveryoneGoToSleep = drawEveryoneGoToSleep;
window.endDayWithoutElimination = endDayWithoutElimination;
window.drawCurrentGameSummary = drawCurrentGameSummary;
window.downloadGameSummary = downloadGameSummary;
window.continueGame = continueGame;
window.endGame = endGame;
window.showGameStateCorrection = showGameStateCorrection;
window.loadCorrectionPlayer = loadCorrectionPlayer;
window.applyGameStateCorrection = applyGameStateCorrection;
window.goBackOneScreen = goBackOneScreen;
window.newGame = newGame;
