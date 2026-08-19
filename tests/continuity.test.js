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
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "actions.js"), "utf8"), context);

const migrated = vm.runInContext(`migrateSavedGame({
    saveVersion: 3,
    current: {
        players: [], screenHTML: "<p>Saved</p>",
        roleRuleSettings: { hunterActivatesAtNight: true, obsoleteRule: true },
        gameSettings: { confirmKick: false, obsoleteSetting: true },
        phaseHistory: [{ phase: "Night 1", text: "Nothing happened.", key: "legacy-note" }]
    }
})`, context);
assert.equal(migrated.saveVersion, 4);
assert.equal(migrated.current.roleRuleSettings.hunterActivatesAtNight, true);
assert.equal("obsoleteRule" in migrated.current.roleRuleSettings, false);
assert.equal("obsoleteSetting" in migrated.current.gameSettings, false);
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
assert.equal(vm.runInContext(`nightOneActionIsSuppressed({ action: "RevealAlignment" })`, context), false);
assert.equal(vm.runInContext(`roleHasActiveNightPrompt({ action: "KillPlayer" })`, context), true);

vm.runInContext(`actionDatabase = [{ action: "ConnectToPlayer", targetCount: 1, targetType: "player" }]`, context);
assert.equal(vm.runInContext(`drunkRoleNeedsDelayedSetup({ wake: "1", action: "ConnectToPlayer" })`, context), true);
assert.equal(vm.runInContext(`drunkRoleNeedsDelayedSetup({ wake: "1", action: "N/A" })`, context), false);

vm.runInContext(`currentNight = 3`, context);
assert.equal(vm.runInContext(`trackerNeighborWasWolfVictim({ wolfAttackCountsTonight: true, alive: true })`, context), false);
assert.equal(vm.runInContext(`trackerNeighborWasWolfVictim({ alive: false, deathCause: "Werewolf attack", deathPhase: "Night 2" })`, context), true);
assert.equal(vm.runInContext(`trackerNeighborWasWolfVictim({ alive: false, deathCause: "Cupid lover", deathPhase: "Night 2" })`, context), false);

console.log("Werewolf continuity checks passed.");
