// Linked deaths and role-triggered elimination consequences.

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
        <button type="button" data-click="confirmMartyrDecision(${players.indexOf(martyr)}, ${players.indexOf(eliminatedPlayer)})">Continue</button>`;
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
            <button type="button" data-click="finishMartyrDecision()">Continue</button>`;
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
            <button type="button" data-click="resolveMadBomber(${players.indexOf(bomber)})">Continue</button>
            <button type="button" data-click="resolveMadBomber(${players.indexOf(bomber)}, true)">Nobody</button>
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
        <button type="button" data-click="resolveHunterRevenge(${players.indexOf(hunter)})">Continue</button>
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

    const continueVoting = gameSettings.continueVotingAfterWolfElimination && newlyEliminated.some(player =>
        player.deathCause === "Village vote" && player.deathPhase === `Day ${currentDay}` &&
        (player.teamBeforeMartyrExchange || player.team) === "Werewolf" &&
        !["Minion", "Sorceress"].includes(player.roleBeforeMartyrExchange || player.role)
    );

    newlyEliminated.forEach(player => {
        player.deathAnnounced = true;
        player.roleRevealed = true;
    });

    const winMessage = getWinMessage();

    if (winMessage) {
        drawGameResult(winMessage, ignoreWinConditions ? null : (continueVoting ? "day" : "postVote"));
        return;
    }

    document.getElementById("screen").innerHTML = `
        <h2>Elimination</h2>
        <p>The following roles are revealed:</p>
        <ul>${revealRows}</ul>
        ${continueVoting ? `<p>${readAloud("A wolf was eliminated. The village may vote again.")}</p>` : ""}
        <button type="button" data-click="${continueVoting ? "drawDayOnePlayers()" : "drawEveryoneGoToSleep()"}">${continueVoting ? "Continue Voting" : "Continue"}</button>
    `;

}

