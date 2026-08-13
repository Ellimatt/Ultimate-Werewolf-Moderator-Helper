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
    cursed.attackedTonight = true;
    context.executeAction("ChangeTeams", cursed, []);
    assert.equal(cursed.role, "Werewolf");
    assert.equal(cursed.alive, true);
    assert.notEqual(cursed.attackedTonight, true);
}

{
    const bodyguard = player("Bodyguard");
    const target = player("Villager");
    context.executeAction("ProtectPlayer", bodyguard, [target]);
    assert.equal(target.protected, true);
    assert.equal(target.protectionCauseTonight, "Bodyguard");
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
    const doppelganger = player("Doppelganger");
    const seer = player("Seer");
    context.executeAction("CopyRole", doppelganger, [seer]);
    assert.equal(doppelganger.doppelgangerTarget, seer);
    seer.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Seer");
}

console.log("Werewolf regression checks passed.");
