const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const context = {
    console,
    currentNight: 2,
    wolvesDisabledTonight: false,
    players: [],
    roles: []
};
context.window = context;
vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "js", "actions.js"), "utf8"),
    context
);

function player(role, team = "Villager") {
    return { role, team, alive: true };
}

{
    const wolf = player("Werewolf", "Werewolf");
    const target = player("Villager");
    assert.equal(context.executeAction("KillPlayer", wolf, [target]), true);
    assert.equal(target.pendingDeathCause, "Werewolf attack");
    assert.equal(target.wolfAttackCountsTonight, true);
}

{
    context.wolvesDisabledTonight = true;
    const target = player("Villager");
    context.executeAction("KillPlayer", player("Werewolf", "Werewolf"), [target]);
    assert.equal(target.wolfTargetTonight, true);
    assert.notEqual(target.attackedTonight, true);
    context.wolvesDisabledTonight = false;
}

{
    const cursed = player("Cursed");
    context.executeAction("KillPlayer", player("Werewolf", "Werewolf"), [cursed]);
    context.executeAction("ChangeTeams", cursed, []);
    assert.equal(cursed.role, "Werewolf");
    assert.equal(cursed.alive, true);
    assert.notEqual(cursed.attackedTonight, true);
}

{
    const bodyguard = player("Bodyguard");
    const target = player("Villager");
    context.executeAction("KillPlayer", player("Werewolf", "Werewolf"), [target]);
    context.executeAction("ProtectPlayer", bodyguard, [target]);
    assert.equal(target.protected, true);
    assert.equal(target.protectionCauseTonight, "Bodyguard");
    assert.equal(target.nightAttackCauses.join(","), "");
    assert.equal(target.bodyguardBlockedWerewolfAttackTonight, true);
}

{
    const bodyguard = player("Bodyguard");
    const target = player("Villager");
    context.executeAction("NightKill", player("Huntress"), [target]);
    context.executeAction("ProtectPlayer", bodyguard, [target]);
    assert.equal(target.nightAttackCauses.join(","), "Huntress attack");
    assert.equal(target.attackedTonight, true);
}

{
    const cursed = player("Cursed");
    context.executeAction("KillPlayer", player("Werewolf", "Werewolf"), [cursed]);
    context.executeAction("NightKill", player("Witch"), [cursed]);
    context.executeAction("ChangeTeams", cursed, []);
    assert.equal(cursed.role, "Werewolf");
    assert.equal(cursed.nightAttackCauses.join(","), "Witch attack");
    assert.equal(cursed.attackedTonight, true);
}

{
    const priest = player("Priest");
    const target = player("Villager");
    context.executeAction("BlessPlayer", priest, [target]);
    assert.equal(target.blessedAgainstWerewolves, true);
    context.executeAction("KillPlayer", player("Werewolf", "Werewolf"), [target]);
    assert.equal(target.wolfTargetTonight, true);
    assert.notEqual(target.attackedTonight, true);
}

{
    const fruitBrute = player("Fruit Brute", "Werewolf");
    const target = player("Villager");
    context.players = [fruitBrute, target];
    context.executeAction("KillPlayer", fruitBrute, [target]);
    assert.equal(target.wolfTargetTonight, true);
    assert.equal(target.fruitBruteOnlyAttackTonight, true);
    assert.notEqual(target.attackedTonight, true);
}

{
    const fruitBrute = player("Fruit Brute", "Werewolf");
    const wolf = player("Werewolf", "Werewolf");
    const target = player("Villager");
    context.players = [fruitBrute, wolf, target];
    context.executeAction("KillPlayer", fruitBrute, [target]);
    assert.equal(target.attackedTonight, true);
    assert.equal(target.pendingDeathCause, "Werewolf attack");
}

{
    const doppelganger = player("Doppelganger");
    const seer = player("Seer");
    context.executeAction("CopyRole", doppelganger, [seer]);
    assert.equal(doppelganger.doppelgangerTarget, seer);
    seer.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Seer");
}

console.log("Werewolf regression checks passed.");
