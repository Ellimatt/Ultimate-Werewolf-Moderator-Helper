const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = {
    console,
    setTimeout,
    clearTimeout,
    navigator: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
        addEventListener() {},
        createElement() { return { textContent: "", innerHTML: "" }; }
    }
};
context.window = context;
vm.createContext(context);
for (const filename of [
    "descriptions/role-settings.js",
    "core/state.js",
    "core/utilities.js",
    "app.js",
    "core/persistence.js",
    "core/role-logic.js",
    "ui/chrome.js",
    "ui/modals.js",
    "ui/settings.js",
    "descriptions/role-descriptions.js",
    "setup/role-filters.js",
    "players.js",
    "actions.js",
    "game/night.js",
    "game/day.js",
    "game/eliminations.js",
    "game/summary.js",
    "game/win-conditions.js",
    "ui/events.js",
    "bindings.js"
]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", filename), "utf8"), context);
}

const migrated = vm.runInContext(`migrateSavedGame({
    saveVersion: 3,
    current: {
        players: [], screenHTML: "<p>Saved</p>",
        roleRuleSettings: { hunterActivatesAtNight: true, obsoleteRule: true },
        gameSettings: { confirmKick: false, obsoleteSetting: true },
        phaseHistory: [{ phase: "Night 1", text: "Nothing happened.", key: "legacy-note" }]
    }
})`, context);
assert.equal(migrated.saveVersion, 5);
assert.equal(migrated.current.roleRuleSettings.hunterActivatesAtNight, true);
assert.equal("obsoleteRule" in migrated.current.roleRuleSettings, false);
assert.equal("obsoleteSetting" in migrated.current.gameSettings, false);
assert.equal(migrated.current.gameSettings.beginGameOnNightZero, true);
assert.equal(migrated.current.phaseHistory[0].type, "note");

vm.runInContext(`
    players = [{ id: 1, name: "Kate", role: "Villager", team: "Villager", alive: true }];
    phaseHistory = [];
    eliminationSequence = 0;
    recordElimination(players[0], "Werewolf attack", "Night 2");
`, context);
const elimination = vm.runInContext("phaseHistory[0]", context);
assert.equal(elimination.type, "elimination");
assert.equal(elimination.cause, "Werewolf attack");
assert.deepEqual(Array.from(elimination.targetIds), [1]);

vm.runInContext(`
    roleRuleSettings.hunterActivatesAtNight = true;
    players = [
        { id: 1, name: "Hunter", role: "Hunter", team: "Villager", alive: false, deathPhase: "Night 2" },
        { id: 2, name: "Wolf", role: "Werewolf", team: "Werewolf", alive: true }
    ];
`, context);
assert.equal(vm.runInContext("hasPendingEliminationResolution()", context), true);
assert.equal(vm.runInContext("getWinMessage()", context), null);

assert.equal(vm.runInContext(`leftoverRoleNeedsTheatricalWake({ action: "RevealAlignment" })`, context), true);
assert.equal(vm.runInContext(`leftoverRoleNeedsTheatricalWake({ action: "KillPlayer" })`, context), false);
assert.equal(vm.runInContext(`leftoverRoleNeedsTheatricalWake({ action: "N/A" })`, context), false);
assert.equal(vm.runInContext(`leftoverRoleNeedsTheatricalWake({ action: "DelayDeath" })`, context), false);
assert.equal(vm.runInContext(`nightOneActionIsSuppressed({ action: "ProtectPlayer" })`, context), true);
assert.equal(vm.runInContext(`nightOneActionIsSuppressed({ action: "BarricadePlayer" })`, context), true);
assert.equal(vm.runInContext(`nightOneActionIsSuppressed({ action: "RevealAlignment" })`, context), false);
assert.equal(vm.runInContext(`roleHasActiveNightPrompt({ action: "KillPlayer" })`, context), true);

vm.runInContext(`players = [
    { name: "Original", role: "Martyr", roleBeforeMartyrExchange: "Seer", alive: false },
    { name: "Inheritor", role: "Seer", martyrUsed: true, alive: true },
    { name: "Copy", role: "Seer", isDoppelganger: true, doppelgangerInheritedRole: "Seer", alive: true }
]`, context);
assert.equal(vm.runInContext(`summaryRoleName(players[0])`, context), "Seer");
assert.equal(vm.runInContext(`summaryRoleName(players[1])`, context), "(Martyr): Seer");
vm.runInContext(`players[1].alive = false`, context);
assert.equal(vm.runInContext(`summaryRoleName(players[1])`, context), "(Martyr): Seer");
assert.equal(vm.runInContext(`summaryRoleName(players[2])`, context), "(Doppelganger): Seer");
vm.runInContext(`players[2].alive = false`, context);
assert.equal(vm.runInContext(`summaryRoleName(players[2])`, context), "(Doppelganger): Seer");
assert.equal(vm.runInContext(`summaryRoleName({ role: "Bodyguard", team: "Werewolf", isThing: true, alive: false })`, context), "(The Thing): Bodyguard");

vm.runInContext(`
    players = [{ name: "A" }, { name: "B" }, { name: "C" }];
    roles = [
        { role: "Drunk", count: 1 },
        { role: "The Thing", count: 1 },
        { role: "Villager", count: 3 }
    ];
`, context);
assert.equal(vm.runInContext(`getRequiredCardCount()`, context), 5);
assert.equal(vm.runInContext(`apparentTeam({ role: "Seer", team: "Werewolf", isThing: true })`, context), "Villager");
assert.equal(vm.runInContext(`canChooseWerewolfElimination({ role: "Seer", team: "Werewolf", isThing: true })`, context), true);
vm.runInContext(`roles.push({ role: "Werewolf", team: "Werewolf", appearsAs: "Werewolf" })`, context);
vm.runInContext(`roleRuleSettings.thingParticipatesWolfEliminations = false`, context);
assert.equal(vm.runInContext(`canChooseWerewolfElimination({ role: "Seer", team: "Werewolf", isThing: true })`, context), false);
assert.equal(vm.runInContext(`canChooseWerewolfElimination({ role: "Werewolf", team: "Werewolf", isThing: true })`, context), false);
vm.runInContext(`roleRuleSettings.thingParticipatesWolfEliminations = true`, context);
assert.equal(vm.runInContext(`canChooseWerewolfElimination({ role: "Werewolf", team: "Werewolf", isThing: true })`, context), true);

vm.runInContext(`
    roles.push({ role: "Villager", team: "Villager", appearsAs: "Villager" });
    roleRuleSettings.phantomAppearsWolfToSeer = true;
    roleRuleSettings.phantomAppearsWolfToPI = false;
    roleRuleSettings.phantomAppearsWolfToMysticSeer = false;
`, context);
assert.equal(vm.runInContext(`playerAppearsAs({ role: "Villager", team: "Villager", phantomMarked: true })`, context), "Werewolf");
assert.equal(vm.runInContext(`playerAppearsWerewolfToPI({ role: "Villager", team: "Villager", phantomMarked: true })`, context), false);
assert.equal(vm.runInContext(`roleShownToMysticSeer({ role: "Villager", team: "Villager", phantomMarked: true })`, context), "Villager");

const renamedSave = vm.runInContext(`migrateSavedGame({
    saveVersion: 5,
    current: {
        players: [{ role: "Nightstalker", doppelgangerInheritedRole: "Black Wolf" }],
        roles: [{ role: "Pack's Hunger", count: 1 }, { role: "Night Watch", count: 1 }],
        nightOneWakeOrder: [{ role: "Bloodscent" }],
        nightOneActionOrder: [],
        nightOneDeferredActions: [],
        phaseHistory: [],
        screenHTML: "<p>Watchman</p>"
    }
})`, context);
assert.equal(renamedSave.current.players[0].role, "Mystic Wolf");
assert.equal(renamedSave.current.players[0].doppelgangerInheritedRole, "Shadow Wolf");
assert.equal(renamedSave.current.roles[0].role, "Ravenous Wolf");
assert.equal(renamedSave.current.roles[1].role, "Sentry");
assert.equal(renamedSave.current.nightOneWakeOrder[0].role, "Death Hound");
assert.equal(renamedSave.current.screenHTML, "<p>Sentinel</p>");
assert.equal(vm.runInContext(`canonicalRoleName("Blood Wolf")`, context), "Crimson Wolf");
assert.equal(
    vm.runInContext(`shouldRecordNightModeratorDetail("Tony survived the Werewolf attack because the voodoo doll redirected it.")`, context),
    false
);
assert.equal(vm.runInContext(`shouldRecordNightModeratorDetail("Tony was protected by the Bodyguard.")`, context), true);

vm.runInContext(`isLaterNight = true`, context);
assert.equal(
    vm.runInContext(`getNightActionResult({ role: { action: "CopyRole" }, actor: { doppelgangerInheritedRole: null } }, [{ alive: false, role: "Martyr" }])`, context),
    "Doppelganger, this is your role: Doppelganger."
);
assert.equal(
    vm.runInContext(`getNightActionResult({ role: { action: "CopyRole" }, actor: { doppelgangerInheritedRole: "Seer" } }, [{ alive: false, role: "Martyr" }])`, context),
    "Doppelganger, this is your role: Seer."
);
assert.equal(
    vm.runInContext(`publicNightEliminationCause({ deathCause: "Revealer backlash" })`, context),
    "Revealer"
);
assert.equal(
    vm.runInContext(`publicNightEliminationCause({ deathCause: "Werewolf attack" })`, context),
    "Werewolf attack"
);
assert.equal(vm.runInContext(`isRecognizedWerewolf({ role: "Werewolf", team: "Werewolf" })`, context), true);
assert.equal(vm.runInContext(`isRecognizedWerewolf({ role: "Fruit Brute", team: "Werewolf" })`, context), true);
assert.equal(vm.runInContext(`isRecognizedWerewolf({ role: "Minion", team: "Werewolf" })`, context), false);
assert.equal(vm.runInContext(`isRecognizedWerewolf({ role: "Sorceress", team: "Werewolf" })`, context), false);

vm.runInContext(`players = [
    { name: "Minion", role: "Minion", team: "Werewolf", alive: true },
    { name: "Sorceress", role: "Sorceress", team: "Werewolf", alive: true },
    { name: "Were", role: "Werewolf", team: "Werewolf", alive: true },
    { name: "Fruit", role: "Fruit Brute", team: "Werewolf", alive: true }
]`, context);
assert.equal(
    vm.runInContext(`getNightActionResult({ role: { action: "RevealWerewolves" } }, [])`, context),
    "Werewolves: Were, Fruit"
);

vm.runInContext(`
    roles = [{ role: "Seer", priority: 12, wake: "Every", action: "RevealAlignment" }];
    nightOneCurrentAction = 0;
    nightOneActionOrder = [
        { role: { role: "Doppelganger", priority: 0, action: "CopyRole" }, actor: { id: 1 } },
        { role: { role: "Seer", priority: 12, action: "RevealAlignment" }, actor: { id: 2 }, theatricalOnly: true }
    ];
    queueInheritedRoleContinuation({ id: 1, doppelgangerInheritedRole: "Seer" });
`, context);
assert.equal(vm.runInContext(`nightOneActionOrder.length`, context), 2);
assert.equal(vm.runInContext(`nightOneActionOrder[1].inheritedRoleContinuation`, context), true);
assert.equal(vm.runInContext(`nightOneActionOrder[1].theatricalOnly === true`, context), false);

vm.runInContext(`
    nightOneActionOrder = [
        { role: { role: "Grave Digger" }, actor: { id: 1 } },
        { role: { role: "Grave Digger" }, actor: { id: 2 }, theatricalOnly: true },
        { role: { role: "Death Hound" }, actor: { id: 3 } },
        { role: { role: "Death Hound" }, actor: { id: 4 }, theatricalOnly: true },
        { role: { role: "Hunter" }, actor: { id: 5 }, theatricalOnly: true }
    ];
    removeRedundantTheatricalWakes();
`, context);
assert.deepEqual(
    Array.from(vm.runInContext(`nightOneActionOrder.map(item => item.role.role)`, context)),
    ["Grave Digger", "Death Hound", "Hunter"]
);
assert.equal(vm.runInContext(`nightOneActionOrder[2].theatricalOnly`, context), true);

vm.runInContext(`
    roles = [{ role: "Seer", priority: 12, wake: "Every", action: "RevealAlignment" }];
    nightOneCurrentAction = 0;
    nightOneActionOrder = [
        { role: { role: "Apprentice Seer", action: "BecomeSeer" }, actor: { id: 1, becameSeerTonight: true } },
        { role: { role: "Seer", action: "RevealAlignment" }, actor: { id: 2 }, theatricalOnly: true }
    ];
    nightOneActionMode = null;
    drawNightAction = function() {};
    advanceNightAction();
`, context);
assert.equal(vm.runInContext(`nightOneActionOrder.length`, context), 2);
assert.equal(vm.runInContext(`nightOneActionOrder[1].role.role`, context), "Seer");
assert.equal(vm.runInContext(`nightOneActionOrder[1].theatricalOnly === true`, context), false);

vm.runInContext(`actionDatabase = [{ action: "ConnectToPlayer", targetCount: 1, targetType: "player" }]`, context);
assert.equal(vm.runInContext(`drunkRoleNeedsDelayedSetup({ wake: "1", action: "ConnectToPlayer" })`, context), true);
assert.equal(vm.runInContext(`drunkRoleNeedsDelayedSetup({ wake: "1", action: "N/A" })`, context), false);

vm.runInContext(`currentNight = 3`, context);
assert.equal(vm.runInContext(`trackerNeighborWasWolfVictim({ wolfAttackCountsTonight: true, alive: true })`, context), false);
assert.equal(vm.runInContext(`trackerNeighborWasWolfVictim({ alive: false, deathCause: "Werewolf attack", deathPhase: "Night 2" })`, context), true);
assert.equal(vm.runInContext(`trackerNeighborWasWolfVictim({ alive: false, deathCause: "Cupid lover", deathPhase: "Night 2" })`, context), false);

vm.runInContext(`gameSettings.werewolfEliminationOnFirstNight = false; gameSettings.beginGameOnNightZero = true`, context);
assert.equal(vm.runInContext(`getNightOrdinal(0)`, context), 1);
assert.equal(vm.runInContext(`werewolfEliminationWasAvailableOnNight(0)`, context), false);
assert.equal(vm.runInContext(`werewolfEliminationWasAvailableOnNight(1)`, context), true);
vm.runInContext(`gameSettings.werewolfEliminationOnFirstNight = true`, context);
assert.equal(vm.runInContext(`getNightOrdinal(1)`, context), 1);
assert.equal(vm.runInContext(`werewolfEliminationWasAvailableOnNight(1)`, context), true);
assert.equal(vm.runInContext(`nightActionHasVisibleResult("OracleInspect")`, context), true);

assert.equal(vm.runInContext(`roleSettingsByRole["Bodyguard"].options.length`, context), 4);
assert.equal(vm.runInContext(`roleSettingsByRole["Doppelganger"].fixed.length`, context), 2);
vm.runInContext(`gameState.phase.night = 7`, context);
assert.equal(vm.runInContext(`currentNight`, context), 7);
assert.deepEqual(
    Array.from(vm.runInContext(`parseDelegatedArguments("'save', true, -1", { checked: false, value: "" })`, context)),
    ["save", true, -1]
);
vm.runInContext(`
    delegatedTestResult = null;
    window.delegatedTestAction = (...args) => { delegatedTestResult = args; };
    runDelegatedHandler("delegatedTestAction('guide', true, -1)", {
        checked: false,
        value: "",
        matches() { return false; }
    });
`, context);
assert.deepEqual(Array.from(vm.runInContext(`delegatedTestResult`, context)), ["guide", true, -1]);

console.log("Werewolf continuity checks passed.");

// Moderator recovery and optional consecutive village eliminations.
vm.runInContext(`
    document.getElementById = () => testScreen;
    var testScreen = { innerHTML: "" };
    readAloud = text => text;
    roles = [{ role: "Seer", count: 1 }, { role: "Villager", count: 2 }];
    players = [];
    phaseHistory = [];
    nightOneWakeOrder = [{ role: "Seer", count: 1 }, { role: "Werewolf", wolfRecognitionOnly: true }];
    nightOneCurrentRole = 0;
    var originalDrawNightRole = drawNightRole;
    drawNightRole = () => {};
    replaceUnidentifiedRoleWithVillager();
`, context);
assert.equal(vm.runInContext('roles[0].count', context), 0);
assert.equal(vm.runInContext('roles[1].count', context), 3);
assert.equal(vm.runInContext('nightOneCurrentRole', context), 1);
vm.runInContext(`
    drawNightRole = originalDrawNightRole;
    players = [{ role: "Werewolf", team: "Werewolf", alive: true }];
    drawNightRole();
`, context);
assert.match(vm.runInContext('testScreen.innerHTML', context), /wake up and look at each other/);
assert.doesNotMatch(vm.runInContext('testScreen.innerHTML', context), /confirmNightAction/);
for (const [enabled, role, team, cause, expected] of [
    [true, 'Werewolf', 'Werewolf', 'Village vote', 'drawDayOnePlayers()'],
    [false, 'Werewolf', 'Werewolf', 'Village vote', 'drawEveryoneGoToSleep()'],
    [true, 'Villager', 'Villager', 'Village vote', 'drawEveryoneGoToSleep()'],
    [true, 'Minion', 'Werewolf', 'Village vote', 'drawEveryoneGoToSleep()'],
    [true, 'Werewolf', 'Werewolf', 'Hunter', 'drawEveryoneGoToSleep()']
]) {
    context.voteCase = { enabled, role, team, cause };
    vm.runInContext(`
        gameSettings.continueVotingAfterWolfElimination = voteCase.enabled;
        players = [{ name: "Target", role: voteCase.role, team: voteCase.team, alive: false,
            deathCause: voteCase.cause, deathPhase: 'Day ' + currentDay, deathAnnounced: false }];
        getWinMessage = () => null;
        drawEliminationReveal();
    `, context);
    assert.ok(vm.runInContext('testScreen.innerHTML', context).includes(expected));
}
console.log('New moderator rule checks passed.');
