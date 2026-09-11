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
// Role descriptions and role-specific defaults live in js/descriptions/.

const defaultGameSettings = {
    revealNightRoles: false,
    showModeratorDetails: true,
    confirmKick: true,
    continueVotingAfterWolfElimination: false,
    werewolfEliminationOnFirstNight: false,
    beginGameOnNightZero: true
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
let backSavedGameStates = [];
let restoringPreviousScreen = false;
let wakeLock = null;

// New code should access shared state through this grouped facade. The accessors
// intentionally bridge the existing variables so the refactor can remain
// backwards-compatible with saved games and focused regression tests.
const gameState = Object.freeze({
    phase: Object.freeze({
        get screen() { return currentScreen; },
        set screen(value) { currentScreen = value; },
        get night() { return currentNight; },
        set night(value) { currentNight = value; },
        get day() { return currentDay; },
        set day(value) { currentDay = value; }
    }),
    setup: Object.freeze({
        get players() { return players; },
        set players(value) { players = value; },
        get roles() { return roles; },
        set roles(value) { roles = value; },
        get leftoverCardRole() { return leftoverCardRole; },
        set leftoverCardRole(value) { leftoverCardRole = value; },
        get thingCardRole() { return thingCardRole; },
        set thingCardRole(value) { thingCardRole = value; }
    }),
    night: Object.freeze({
        get wakeOrder() { return nightOneWakeOrder; },
        get actionOrder() { return nightOneActionOrder; },
        get currentRoleIndex() { return nightOneCurrentRole; },
        set currentRoleIndex(value) { nightOneCurrentRole = value; },
        get currentActionIndex() { return nightOneCurrentAction; },
        set currentActionIndex(value) { nightOneCurrentAction = value; }
    }),
    history: Object.freeze({
        get events() { return phaseHistory; },
        set events(value) { phaseHistory = value; }
    }),
    settings: Object.freeze({
        get roles() { return roleRuleSettings; },
        get game() { return gameSettings; },
        get design() { return designSettings; }
    })
});

// ============================================================
// INITIALIZE APP
// ============================================================
