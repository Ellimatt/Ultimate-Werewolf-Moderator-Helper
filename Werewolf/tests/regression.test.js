const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const context = {
    console,
    currentNight: 2,
    wolvesDisabledTonight: false,
    bloodWolfBypassesProtectionTonight: false,
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
    context.bloodWolfBypassesProtectionTonight = true;
    const target = player("Villager");
    target.blessedAgainstWerewolves = true;
    target.armorCharges = 1;
    target.barricadedTonight = true;
    target.voodooProtectedTonight = true;
    context.players = [player("Blood Wolf", "Werewolf"), target];
    context.wolvesDisabledTonight = true;
    context.executeAction("KillPlayer", context.players[0], [target]);
    assert.equal(target.attackedTonight, true);
    assert.equal(target.bloodWolfAttackTonight, true);
    assert.equal(target.armorCharges, 1);
    context.bloodWolfBypassesProtectionTonight = false;
    context.wolvesDisabledTonight = false;
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
    const blacksmith = player("Blacksmith");
    const wolf = player("Werewolf", "Werewolf");
    const target = player("Villager");
    context.players = [blacksmith, wolf, target];
    context.executeAction("ForgeArmor", blacksmith, [target]);
    assert.equal(target.armorCharges, 1);
    context.executeAction("KillPlayer", wolf, [target]);
    assert.equal(target.armorCharges, 1);
    assert.equal(target.attackedTonight, true);
    context.executeAction("ProtectPlayer", player("Bodyguard"), [target]);
    assert.equal(target.armorCharges, 1);
    assert.notEqual(target.attackedTonight, true);
}

{
    const locksmith = player("Locksmith");
    const wolf = player("Werewolf", "Werewolf");
    const target = player("Seer");
    context.players = [locksmith, wolf, target];
    context.executeAction("BarricadePlayer", locksmith, [target]);
    assert.equal(target.barricadedTonight, true);
    context.executeAction("KillPlayer", wolf, [target]);
    assert.equal(target.barricadeBlockedWerewolfTonight, true);
    assert.notEqual(target.attackedTonight, true);
}

{
    const doctor = player("Witch Doctor");
    const wolf = player("Werewolf", "Werewolf");
    const target = player("Villager");
    context.players = [doctor, wolf, target];
    context.executeAction("VoodooProtect", doctor, [target]);
    context.executeAction("KillPlayer", wolf, [target]);
    assert.equal(target.voodooRedirectedTonight, true);
    assert.notEqual(target.attackedTonight, true);
}

{
    const doctor = player("Witch Doctor");
    const wolf = player("Werewolf", "Werewolf");
    const target = player("Villager");
    context.players = [doctor, wolf, target];
    context.roleRuleSettings = { voodooDollTargetSurvives: false };
    context.executeAction("VoodooProtect", doctor, [target]);
    context.executeAction("KillPlayer", wolf, [target]);
    assert.equal(target.voodooRedirectedTonight, true);
    assert.equal(target.attackedTonight, true);
    assert.equal(target.pendingDeathCause, "Werewolf attack");
    context.roleRuleSettings = { voodooDollTargetSurvives: true };
}

{
    const fruitBrute = player("Fruit Brute", "Werewolf");
    const target = player("Villager");
    target.armorCharges = 1;
    context.players = [fruitBrute, target];
    context.executeAction("KillPlayer", fruitBrute, [target]);
    assert.equal(target.armorCharges, 1);
    assert.notEqual(target.armorBrokeTonight, true);
}

{
    const doppelganger = player("Doppelganger");
    const seer = player("Seer");
    seer.usedOncePerGameAction = true;
    context.executeAction("CopyRole", doppelganger, [seer]);
    assert.equal(doppelganger.doppelgangerTarget, seer);
    seer.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Seer");
    assert.equal(doppelganger.usedOncePerGameAction, true);
    assert.equal(doppelganger.isDoppelganger, true);
    assert.equal(doppelganger.doppelgangerTarget, seer);
}

{
    const doppelganger = player("Doppelganger");
    const originalSeer = player("Martyr");
    originalSeer.alive = false;
    originalSeer.roleBeforeMartyrExchange = "Seer";
    originalSeer.teamBeforeMartyrExchange = "Villager";
    const martyrAsSeer = player("Seer");
    martyrAsSeer.martyrUsed = true;
    context.players = [doppelganger, originalSeer, martyrAsSeer];
    context.executeAction("CopyRole", doppelganger, [originalSeer]);
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Doppelganger");
    assert.equal(doppelganger.doppelgangerInheritedRole, undefined);
    martyrAsSeer.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Seer");
    assert.equal(doppelganger.doppelgangerInheritedRole, "Seer");
}

{
    const doppelganger = player("Martyr");
    doppelganger.id = 1;
    doppelganger.isDoppelganger = true;
    doppelganger.doppelgangerInheritedRole = "Martyr";
    const originalTarget = player("Martyr");
    originalTarget.id = 2;
    originalTarget.alive = false;
    originalTarget.roleBeforeMartyrExchange = "Seer";
    originalTarget.teamBeforeMartyrExchange = "Villager";
    originalTarget.roleInheritedByMartyrId = 3;
    const martyrHolder = player("Seer");
    martyrHolder.id = 3;
    martyrHolder.martyrUsed = true;
    doppelganger.doppelgangerTarget = originalTarget;
    context.players = [doppelganger, originalTarget, martyrHolder];
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Doppelganger");
    assert.equal(doppelganger.doppelgangerInheritedRole, null);
    martyrHolder.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Seer");
    assert.equal(doppelganger.doppelgangerInheritedRole, "Seer");
}

{
    const doppelganger = player("Doppelganger");
    const linkedPlayer = player("Villager");
    const direWolf = player("Dire Wolf", "Werewolf");
    direWolf.connectedTo = linkedPlayer;
    direWolf.connectionType = "dire";
    direWolf.usedOncePerGameAction = true;
    context.executeAction("CopyRole", doppelganger, [direWolf]);
    direWolf.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Dire Wolf");
    assert.equal(doppelganger.connectedTo, linkedPlayer);
    assert.equal(doppelganger.connectionType, "dire");
    assert.equal(doppelganger.usedOncePerGameAction, true);
}

{
    const doppelganger = player("Doppelganger");
    const hunter = player("Hunter");
    hunter.hunterRevengeResolved = true;
    context.executeAction("CopyRole", doppelganger, [hunter]);
    hunter.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.hunterRevengeResolved, false);
    assert.equal(doppelganger.doppelgangerDeathRoleCanTriggerAgain, true);
}

{
    const doppelganger = player("Doppelganger");
    const wolfCub = player("Wolf Cub", "Werewolf");
    wolfCub.wolfCubBonusGranted = true;
    context.executeAction("CopyRole", doppelganger, [wolfCub]);
    wolfCub.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.wolfCubBonusGranted, false);
    assert.equal(doppelganger.doppelgangerDeathRoleCanTriggerAgain, true);
}

{
    const martyr = player("Martyr");
    const hunter = player("Hunter");
    hunter.hunterRevengeResolved = false;
    context.inheritRoleState(martyr, hunter);
    assert.equal(martyr.role, "Hunter");
    assert.equal(martyr.hunterRevengeResolved, false);
}

{
    const martyr = player("Martyr");
    const transformedDoppelganger = player("Seer");
    transformedDoppelganger.isDoppelganger = true;
    transformedDoppelganger.doppelgangerInheritedRole = "Seer";
    transformedDoppelganger.doppelgangerTarget = player("Villager");
    context.inheritRoleState(martyr, transformedDoppelganger);
    assert.equal(martyr.role, "Seer");
    assert.notEqual(martyr.isDoppelganger, true);
    assert.equal(martyr.doppelgangerInheritedRole, undefined);
    assert.equal(martyr.doppelgangerTarget, undefined);
}

{
    const doppelganger = player("Doppelganger");
    const toughGuy = player("Tough Guy");
    context.roles = [{ role: "Tough Guy" }];
    context.executeAction("CopyRole", doppelganger, [toughGuy]);
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Doppelganger");
    assert.notEqual(doppelganger.toughGuyDeathPending, true);
    toughGuy.alive = false;
    context.executeAction("CopyRole", doppelganger, []);
    assert.equal(doppelganger.role, "Tough Guy");
    assert.equal(doppelganger.doppelgangerTransformedTonight, true);
}

console.log("Werewolf regression checks passed.");
