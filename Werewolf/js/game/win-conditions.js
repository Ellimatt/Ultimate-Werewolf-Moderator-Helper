// Victory, parity, and pending-resolution checks.

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
        <button type="button" data-click="startNextNight()">Start Night</button>
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


