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
            await fetch("Data/actions.json");


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

            if (!wolvesDisabledTonight && !targets[0].blessedAgainstWerewolves) {
                targets[0].attackedTonight = true;
                targets[0].wolfAttackCountsTonight = true;
                targets[0].pendingDeathCause = "Werewolf attack";
                targets[0].pendingDeathPhase = `Night ${currentNight}`;
            }

            return true;

        case "NightKill":

            if (!targets.length) {
                return false;
            }

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
            targets[0].protectionCauseTonight = actor.role ||
                "Protection";

            return true;

        case "BlessPlayer":

            if (!targets.length) {
                return false;
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

            targets[0].role = "Werewolf";
            targets[0].team = "Werewolf";
            targets[0].attackedTonight = false;
            targets[0].attackedByWolvesTonight = false;
            targets[0].wolfAttackCountsTonight = false;
            targets[0].wolfTargetTonight = false;
            targets[0].pendingDeathCause = null;
            targets[0].pendingDeathPhase = null;

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

            if (!copiedPlayer.alive) {
                actor.role = copiedPlayer.role;
                actor.team = copiedPlayer.team;
            }

            return true;

        }


        // ====================================================
        // ROLE CHANGES
        // ====================================================

        case "BecomeSeer": {

            const assignedSeer = players.find(player =>
                player !== actor && player.isOriginalSeer
            );

            const seerIsSelected = Number(
                roles.find(role => role.role === "Seer")?.count
            ) > 0;

            actor.becameSeerTonight = assignedSeer ?
                !assignedSeer.alive :
                !seerIsSelected;

            if (actor.becameSeerTonight) {
                actor.role = "Seer";
                actor.team = "Villager";
            }

            return true;

        }

        case "ChangeTeams":

            actor.becameWerewolfTonight =
                actor.attackedTonight === true &&
                actor.protected !== true;

            if (actor.becameWerewolfTonight) {
                actor.role = "Werewolf";
                actor.team = "Werewolf";
                actor.attackedTonight = false;
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
