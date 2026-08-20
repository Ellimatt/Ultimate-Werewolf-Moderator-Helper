// ============================================================
// ACTION SYSTEM
// ============================================================

let actionDatabase = [];


// ============================================================
// LOAD ACTION DATABASE
// ============================================================

async function loadActions() {

    try {

        const response =
            await fetch(`${window.WEREWOLF_ASSET_BASE || ""}Data/actions.json`);


        if (!response.ok) {

            throw new Error(
                `Could not load actions.json (${response.status})`
            );

        }


        actionDatabase =
            await response.json();


    }

    catch (error) {

        console.error(
            "Error loading actions:",
            error
        );

    }

}


// ============================================================
// FIND ACTION
// ============================================================

function getAction(actionName) {

    return actionDatabase.find(
        action =>
            action.action === actionName
    );

}


// ============================================================
// CHECK ACTION
// ============================================================

function isValidAction(actionName) {

    return !!getAction(actionName);

}


// ============================================================
// TARGET COUNT
// ============================================================

function getActionTargetCount(actionName) {

    const action =
        getAction(actionName);

    if (!action) {
        return 0;
    }

    return action.targetCount;

}


// ============================================================
// TARGET TYPE
// ============================================================

function getActionTargetType(actionName) {

    const action =
        getAction(actionName);

    if (!action) {
        return "none";
    }

    return action.targetType;

}


// ============================================================
// EXECUTE ACTION
// ============================================================

function executeAction(
    actionName,
    actor,
    targets = []
) {

    switch (actionName) {


        // ====================================================
        // KILL PLAYER
        // ====================================================

        case "KillPlayer":

            if (!targets.length) {
                return false;
            }


            targets[0].wolfTargetTonight = true;
            targets[0].attackedByWolvesTonight = true;

            if (targets[0].barricadedTonight && !bloodWolfBypassesProtectionTonight) {
                targets[0].barricadeBlockedWerewolfTonight = true;
                return true;
            }

            const hasEffectiveWolf = !["Minion", "Sorceress", "Fruit Brute"].includes(actor.role) || players.some(player =>
                player.alive &&
                player.team === "Werewolf" &&
                !["Minion", "Sorceress", "Fruit Brute"].includes(player.role)
            );

            if (!hasEffectiveWolf) {
                targets[0].fruitBruteOnlyAttackTonight = true;
                return true;
            }

            if (wolvesDisabledTonight && !bloodWolfBypassesProtectionTonight) {
                return true;
            }

            if (!bloodWolfBypassesProtectionTonight && targets[0].blessedAgainstWerewolves) {
                return true;
            }

            if (!bloodWolfBypassesProtectionTonight && targets[0].voodooProtectedTonight) {
                targets[0].voodooRedirectedTonight = true;
                if (typeof roleRuleSettings === "undefined" || roleRuleSettings.voodooDollTargetSurvives !== false) {
                    return true;
                }
            }

            targets[0].nightAttackCauses = targets[0].nightAttackCauses || [];
            targets[0].nightAttackCauses.push("Werewolf attack");
            targets[0].werewolfAttackTonight = true;
            targets[0].attackedTonight = true;
            targets[0].wolfAttackCountsTonight = true;
            targets[0].pendingDeathCause = "Werewolf attack";
            targets[0].pendingDeathPhase = `Night ${currentNight}`;
            targets[0].bloodWolfAttackTonight = bloodWolfBypassesProtectionTonight;

            return true;

        case "NightKill":

            if (!targets.length) {
                return false;
            }

            targets[0].nightAttackCauses = targets[0].nightAttackCauses || [];
            targets[0].nightAttackCauses.push(`${actor.role} attack`);
            targets[0].nonWerewolfAttackTonight = true;
            targets[0].attackedTonight = true;
            targets[0].pendingDeathCause = `${actor.role} attack`;
            targets[0].pendingDeathPhase = `Night ${currentNight}`;

            return true;


        // ====================================================
        // PROTECT PLAYER
        // ====================================================

        case "ProtectPlayer":

            if (!targets.length) {
                return false;
            }


            targets[0].protected = true;
            targets[0].protectedFromWerewolvesTonight = true;
            targets[0].protectionCauseTonight = actor.role ||
                "Protection";
            if (targets[0].bloodWolfAttackTonight) {
                return true;
            }
            if (targets[0].werewolfAttackTonight) {
                targets[0].bodyguardBlockedWerewolfAttackTonight = true;
            }
            targets[0].nightAttackCauses = (targets[0].nightAttackCauses || [])
                .filter(cause => cause !== "Werewolf attack");
            targets[0].werewolfAttackTonight = false;
            targets[0].wolfAttackCountsTonight = false;
            targets[0].attackedTonight = targets[0].nightAttackCauses.length > 0;

            return true;

        case "BlessPlayer":

            if (!targets.length) {
                return false;
            }

            if (targets[0].bloodWolfAttackTonight) {
                targets[0].blessedAgainstWerewolves = true;
                return true;
            }

            if (targets[0].bloodWolfAttackTonight) {
                targets[0].protected = true;
                targets[0].protectionCauseTonight = actor.role || "Protection";
                return true;
            }

            if (targets[0].werewolfAttackTonight) {
                targets[0].priestBlockedWerewolfAttackTonight = true;
            }
            targets[0].blessedAgainstWerewolves = true;

            if (
                targets[0].attackedByWolvesTonight &&
                targets[0].pendingDeathCause === "Werewolf attack"
            ) {
                targets[0].attackedTonight = false;
                targets[0].wolfAttackCountsTonight = false;
                targets[0].pendingDeathCause = null;
                targets[0].pendingDeathPhase = null;
            }
            targets[0].nightAttackCauses = (targets[0].nightAttackCauses || [])
                .filter(cause => cause !== "Werewolf attack");
            targets[0].werewolfAttackTonight = false;
            targets[0].attackedTonight = targets[0].nightAttackCauses.length > 0;

            return true;


        // ====================================================
        // CONNECT PLAYER
        // ====================================================

        case "ConnectToPlayer":

            if (!targets.length) {
                return false;
            }


            actor.connectedTo =
                targets[0];

            actor.connectionType = "dire";

            return true;


        // ====================================================
        // LINK TWO PLAYERS
        // ====================================================

        case "LinkPlayers":

            if (targets.length !== 2) {
                return false;
            }


            targets[0].connectedTo =
                targets[1];

            targets[0].connectionType = "cupid";

            targets[1].connectedTo =
                targets[0];

            targets[1].connectionType = "cupid";

            return true;


        // ====================================================
        // DELAY DEATH
        // ====================================================

        case "DelayDeath":

            actor.delayedDeath = true;

            return true;


        // ====================================================
        // CHANGE A PLAYER'S TEAM
        // ====================================================

        case "ConvertPlayer":

            if (!targets.length) {
                return false;
            }

            targets[0].pendingAlphaConversion = true;
            targets[0].alphaConversionActorId = actor.id;

            return true;


        // ====================================================
        // STATUS EFFECTS
        // ====================================================

        case "SilencePlayer":

            if (!targets.length) {
                return false;
            }

            targets[0].silenced = true;

            return true;

        case "ExileVillager":

            if (!targets.length) {
                return false;
            }

            targets[0].exiledTonight = true;

            return true;

        case "ChooseRoleModel":
            if (!targets.length) return false;
            actor.roleModel = targets[0];
            actor.isWildChild = true;
            return true;

        case "SetButcherTarget":
            if (!targets.length) return false;
            actor.butcherRedirectTarget = targets[0];
            return true;

        case "BlockVote":
            if (!targets.length) return false;
            targets[0].magistrateProtectedToday = true;
            return true;

        case "ShepherdFlock":
            actor.shepherdFlockAlive = true;
            return true;

        case "ForgeArmor":
            if (!targets.length) return false;
            targets[0].armorCharges = 1;
            actor.usedOncePerGameAction = true;
            return true;

        case "BarricadePlayer":
            if (!targets.length) return false;
            targets[0].barricadedTonight = true;
            return true;

        case "VoodooProtect":
            if (!targets.length) return false;
            targets[0].voodooProtectedTonight = true;
            return true;

        case "WatchPlayer":
            if (!targets.length) return false;
            actor.watchedPlayerTonight = targets[0];
            return true;


        // ====================================================
        // INFORMATION AND PASSIVE ACTIONS
        // ====================================================

        case "RevealWerewolves":
        case "RevealAlignment":
        case "RevealRole":
        case "WitchChoice":
        case "RevengeKill":
        case "ChangeRole":
        case "RevealTeam":
        case "RevealGroup":
        case "DisableWolves":
        case "RevealPlayer":
        case "Explosion":
        case "Prince":
        case "CompareTeams":
        case "Investigate":
        case "Hear":
        case "RevealSeer":
        case "TrackWolf":
        case "CheckRoleModel":
        case "RevealWolfVictims":
        case "CheckAdjacentWolves":
        case "CheckMutualTargets":
        case "RevealVisitorCount":
        case "RevealBloodscentVictims":

            // These actions either reveal information in the UI or
            // are triggered later by another game event.
            return true;

        case "CopyRole": {

            if (targets.length) {
                actor.doppelgangerTarget = targets[0];
                actor.isDoppelganger = true;
                return true;
            }

            const copiedPlayer = actor.doppelgangerTarget;

            if (!copiedPlayer) {
                return false;
            }

            if (!copiedPlayer.alive && !actor.doppelgangerInheritedRole) {
                const inheritedRole = copiedPlayer.roleBeforeMartyrExchange || copiedPlayer.role;
                const inheritedTeam = copiedPlayer.teamBeforeMartyrExchange || copiedPlayer.team;
                if (
                    inheritedRole === "Seer" &&
                    players.some(player => player !== actor && player.alive && player.role === "Seer")
                ) {
                    return true;
                }
                const originalDoppelgangerTarget = actor.doppelgangerTarget;
                inheritRoleState(actor, {
                    ...copiedPlayer,
                    role: inheritedRole,
                    team: inheritedTeam
                });
                actor.isDoppelganger = true;
                actor.doppelgangerTarget = originalDoppelgangerTarget;
                actor.doppelgangerInheritedRole = inheritedRole;
                resetDoppelgangerDeathTriggerState(actor);
                actor.doppelgangerTransformedTonight = true;
            }

            return true;

        }


        // ====================================================
        // ROLE CHANGES
        // ====================================================

        case "BecomeSeer": {
            const livingSeer = players.find(player =>
                player !== actor && player.alive && player.role === "Seer"
            );
            const unassignedOriginalSeer = Number(roles.find(role => role.role === "Seer")?.count || 0) > 0 &&
                !players.some(player => player.isOriginalSeer);

            actor.becameSeerTonight = !livingSeer && !unassignedOriginalSeer;

            if (actor.becameSeerTonight) {
                actor.wasApprenticeSeer = true;
                actor.role = "Seer";
                actor.team = "Villager";
            }

            return true;

        }

        case "ChangeTeams":

            actor.becameWerewolfTonight =
                actor.werewolfAttackTonight === true &&
                actor.bloodWolfAttackTonight !== true &&
                actor.protectedFromWerewolvesTonight !== true &&
                actor.blessedAgainstWerewolves !== true;

            if (actor.becameWerewolfTonight) {
                actor.role = "Werewolf";
                actor.team = "Werewolf";
                actor.nightAttackCauses = (actor.nightAttackCauses || [])
                    .filter(cause => cause !== "Werewolf attack");
                actor.werewolfAttackTonight = false;
                actor.wolfAttackCountsTonight = false;
                actor.attackedTonight = actor.nightAttackCauses.length > 0;
            }

            return true;


        // ====================================================
        // DEFAULT
        // ====================================================

        default:

            console.warn(
                "Action not implemented yet:",
                actionName
            );

            return false;

    }

}

const inheritedRoleStateKeys = [
    "usedOncePerGameAction",
    "connectedTo",
    "connectionType",
    "roleModel",
    "butcherRedirectTarget",
    "shepherdFlockAlive",
    "princeVoteSurvived",
    "judgePardonUsed",
    "wolfCubBonusGranted",
    "mentalistComparedPlayerIds",
    "lastProtectedPlayer",
    "lastBarricadedPlayer",
    "lastVoodooPlayer",
    "lastMagistratePlayer",
    "lastWatchedPlayer",
    "lastOldHagTargetId",
    "lastBlackWolfTargetId",
    "lastSpellcasterTargetId",
    "lastSeerTargetId",
    "hunterRevengeResolved",
    "bomberResolved"
];

function inheritRoleState(inheritor, source) {
    if (!inheritor || !source) return false;

    inheritor.role = source.role;
    inheritor.team = source.team;

    inheritedRoleStateKeys.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            inheritor[key] = Array.isArray(source[key]) ? [...source[key]] : source[key];
        } else {
            delete inheritor[key];
        }
    });

    inheritor.isWildChild = source.role === "Wild Child";
    return true;
}

function resetDoppelgangerDeathTriggerState(actor) {
    const inheritedRole = actor?.role;
    actor.doppelgangerDeathRoleCanTriggerAgain = [
        "Hunter",
        "Mad Bomber",
        "Wolf Cub",
        "Diseased"
    ].includes(inheritedRole);

    if (inheritedRole === "Hunter") actor.hunterRevengeResolved = false;
    if (inheritedRole === "Mad Bomber") actor.bomberResolved = false;
    if (inheritedRole === "Wolf Cub") actor.wolfCubBonusGranted = false;
}


// ============================================================
// MAKE AVAILABLE
// ============================================================

window.loadActions = loadActions;
window.getAction = getAction;
window.isValidAction = isValidAction;
window.getActionTargetCount =
    getActionTargetCount;

window.getActionTargetType =
    getActionTargetType;

window.executeAction =
    executeAction;

window.inheritRoleState =
    inheritRoleState;
