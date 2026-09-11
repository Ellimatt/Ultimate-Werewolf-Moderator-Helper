// Night setup, wake order, actions, and morning transition.

function startNightOne() {

    currentScreen = "night";
    isLaterNight = false;
    currentNight = !gameSettings.werewolfEliminationOnFirstNight && gameSettings.beginGameOnNightZero ? 0 : 1;
    currentDay = 0;
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;
    bloodWolfBypassesProtectionTonight = false;
    nightTargetRecords = [];
    nightOneDeferredActions = [];
    resolvingNightOneDeferredActions = false;

    const totalCards = getTotalCards();
    const requiredCards = getRequiredCardCount();

    if (totalCards !== requiredCards) {

        alert(
            `Select exactly ${requiredCards} cards for ${players.length} players.`
        );

        return;

    }


    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );
    const thingIsSelected = roles.some(role =>
        role.role === "The Thing" && Number(role.count) > 0
    );

    if ((drunkIsSelected && !leftoverCardRole) || (thingIsSelected && !thingCardRole)) {
        drawLeftoverCardSelection();
        return;
    }

    // ========================================================
    // CREATE NIGHT ONE WAKE ORDER
    // ========================================================
    //
    // Night 1:
    // Wake every selected role EXCEPT Villager.
    //
    // Priority determines the order.
    //
    // After each role is identified, that role completes its
    // night action before the next role wakes up.
    // ========================================================

    nightOneWakeOrder = roles

        .map(role => ({
            ...role,
            count: Number(role.count) - extraAssignedCardCount(role.role)
        }))

        .filter(role => role.count > 0)

        .filter(role =>
            String(role.role).toLowerCase() !== "villager"
        )

        .flatMap(role =>
            gameSettings.werewolfEliminationOnFirstNight && role.role === "Alpha Wolf" ? [
                { ...role, priority: 4.9, action: "N/A", wake: "1", alphaIdentityOnly: true },
                { ...role, alphaActionOnly: true }
            ] : [role]
        )

        .sort((a, b) =>
            Number(a.priority) - Number(b.priority)
        );

    if (thingCardRole && roleHasActiveNightPrompt(thingCardRole) && !nightOneActionIsSuppressed(thingCardRole)) {
        nightOneWakeOrder.push({
            ...thingCardRole,
            count: 0,
            thingSecondaryRole: true
        });
        nightOneWakeOrder.sort((a, b) => Number(a.priority) - Number(b.priority));
    }

    const genericWerewolfSelected = nightOneWakeOrder.some(role =>
        role.role === "Werewolf" && !role.alphaActionOnly
    );
    const anotherEliminationWolfSelected = roles.some(role =>
        Number(role.count) - extraAssignedCardCount(role.role) > 0 &&
        role.team === "Werewolf" &&
        !["Minion", "Sorceress", "Fruit Brute"].includes(role.role) &&
        (role.role !== "The Thing" || roleRuleSettings.thingParticipatesWolfEliminations)
    );
    if (gameSettings.werewolfEliminationOnFirstNight && !genericWerewolfSelected && anotherEliminationWolfSelected) {
        const genericWerewolf = roles.find(role => role.role === "Werewolf");
        nightOneWakeOrder.push({ ...genericWerewolf, count: 0, sharedWolfEliminationOnly: true });
        nightOneWakeOrder.sort((a, b) => Number(a.priority) - Number(b.priority));
    }

    if (leftoverCardRole && leftoverRoleNeedsTheatricalWake(leftoverCardRole)) {
        nightOneWakeOrder.push({
            ...leftoverCardRole,
            count: 0,
            mockLeftoverAction: true
        });
        nightOneWakeOrder.sort((a, b) => Number(a.priority) - Number(b.priority));
    }


    // ========================================================
    // START AT FIRST ROLE
    // ========================================================

    if (!gameSettings.werewolfEliminationOnFirstNight) {
        nightOneWakeOrder.push({ role: "Werewolf", wolfRecognitionOnly: true });
    }
    nightOneCurrentRole = 0;


    // ========================================================
    // SHOW FIRST ROLE
    // ========================================================

    drawNightRole();

}

function leftoverRoleNeedsTheatricalWake(role) {
    return roleHasActiveNightPrompt(role) && !nightOneActionIsSuppressed(role);
}

function roleHasActiveNightPrompt(role) {
    if (!role || role.action === "N/A") return false;
    return ![
        "DelayDeath",
        "RevengeKill",
        "ChangeRole",
        "DisableWolves",
        "Explosion",
        "Prince",
        "ShepherdFlock",
        "RevealBloodscentVictims"
    ].includes(role.action);
}

function nightOneActionIsSuppressed(role) {
    return !gameSettings.werewolfEliminationOnFirstNight && [
        "KillPlayer",
        "NightKill",
        "WitchChoice",
        "RevealPlayer",
        "ConvertPlayer",
        "ProtectPlayer",
        "BarricadePlayer"
    ].includes(role?.action);
}

function removeAllRoles() {

    if (!roles.some(role => Number(role.count) > 0)) {
        return;
    }
    showAppConfirmation("Set every selected role card to zero?", () => {
        roles.forEach(role => {
            role.count = 0;
        });
        drawRoleScreen();
    });

}

function drawLeftoverCardSelection() {

    const options = roles
        .filter(role => !["Drunk", "The Thing"].includes(role.role) && Number(role.count) > 0)
        .map(role => `<option value="${escapeHTML(role.role)}">${escapeHTML(role.role)}</option>`)
        .join("");
    const drunkIsSelected = roles.some(role => role.role === "Drunk" && Number(role.count) > 0);
    const thingIsSelected = roles.some(role => role.role === "The Thing" && Number(role.count) > 0);

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night 1</h2>
        <h2>Extra Role Cards</h2>
        <p>Identify each extra physical card before assigning roles.</p>
        ${drunkIsSelected ? `<label>Drunk's card<select id="leftoverCardRole"><option value="">Select the Drunk's card</option>${options}</select></label>` : ""}
        ${thingIsSelected ? `<label>The Thing's secondary card<select id="thingCardRole"><option value="">Select The Thing's role</option>${options}</select></label>` : ""}
        <button class="actionContinue" type="button" data-click="confirmLeftoverCard()">Continue ➜</button>
    `;

}

function confirmLeftoverCard() {

    const drunkIsSelected = roles.some(role => role.role === "Drunk" && Number(role.count) > 0);
    const thingIsSelected = roles.some(role => role.role === "The Thing" && Number(role.count) > 0);
    const selectedDrunkRole = drunkIsSelected ? roles.find(role => role.role === document.getElementById("leftoverCardRole")?.value) : null;
    const selectedThingRole = thingIsSelected ? roles.find(role => role.role === document.getElementById("thingCardRole")?.value) : null;
    if ((drunkIsSelected && !selectedDrunkRole) || (thingIsSelected && !selectedThingRole)) {
        alert("Please select every required extra role card.");
        return;
    }
    const selectedCounts = [selectedDrunkRole, selectedThingRole].filter(Boolean).reduce((counts, role) => {
        counts[role.role] = (counts[role.role] || 0) + 1;
        return counts;
    }, {});
    if (Object.entries(selectedCounts).some(([roleName, count]) => count > Number(roles.find(role => role.role === roleName)?.count || 0))) {
        alert("There are not enough selected copies of that role for both extra cards.");
        return;
    }

    leftoverCardRole = selectedDrunkRole;
    thingCardRole = selectedThingRole;
    const automaticWinMessage = getSetupAutomaticWin(selectedDrunkRole?.role, selectedThingRole?.role);
    if (automaticWinMessage) {
        alert(automaticWinMessage);
        drawRoleScreen();
        return;
    }
    startNightOne();

}

// ============================================================
// DRAW CURRENT NIGHT ROLE
// ============================================================

function drawNightRole() {

    // ========================================================
    // NIGHT IS FINISHED
    // ========================================================

    if (
        nightOneCurrentRole >=
        nightOneWakeOrder.length
    ) {

        // ====================================================
        // EVERY PLAYER WHO WAS NOT IDENTIFIED AS ANOTHER ROLE
        // IS A VILLAGER
        // ====================================================

        players.forEach(player => {

            if (!player.role) {

                player.role = "Villager";

                player.team = "Villager";

            }

        });


        if (nightOneDeferredActions.length) {
            nightOneActionOrder = nightOneDeferredActions;
            nightOneDeferredActions = [];
            nightOneCurrentAction = 0;
            resolvingNightOneDeferredActions = true;
            drawNightAction();
        } else {
            drawDayOne();
        }

        return;

    }


    const role =
        nightOneWakeOrder[nightOneCurrentRole];


    if (!role) {

        console.error(
            "No role found for current Night 1 position.",
            {
                currentRole: nightOneCurrentRole,
                wakeOrder: nightOneWakeOrder
            }
        );

        return;

    }

    if (role.wolfRecognitionOnly) {
        if (!players.some(player => player.alive && canChooseWerewolfElimination(player))) {
            advanceNightRole();
            return;
        }
        document.getElementById("screen").innerHTML = `
            <h2>🌙 Night ${currentNight}</h2>
            <h2>${readAloud("All Werewolves, wake up and look at each other.")}</h2>
            <p>${readAloud("There is no Werewolf elimination tonight. Werewolves, go to sleep.")}</p>
            <button type="button" data-click="advanceNightRole()">Continue ➜</button>`;
        return;
    }

    if (role.alphaActionOnly || role.sharedWolfEliminationOnly || role.thingSecondaryRole) {
        startNightOneActions(role);
        return;
    }

    if (role.mockLeftoverAction) {
        document.getElementById("screen").innerHTML = `
            <h2>🌙 Night ${currentNight}</h2>
            <hr>
            <h2>${readAloud(`${moderatorRoleName(role.role)}, wake up.`)}</h2>
            ${role.question === "N/A" ? "" : `<p>${readAloud(role.question)}</p>`}
            <div class="moderatorPanel">Wait a few seconds to maintain secrecy.</div>
            <hr>
            <p>${readAloud(`${moderatorRoleName(role.role)}, go to sleep.`)}</p>
            <hr>
            <button type="button" data-click="advanceNightRole()">Continue ➜</button>
        `;
        return;
    }


    // ========================================================
    // ROLE IDENTIFICATION SCREEN
    // ========================================================

    let html = `

        <h2>🌙 Night ${currentNight}</h2>

        <hr>

        <h2>
            ${readAloud(role.role === "Werewolf" ?
                "Players with the generic Werewolf card, wake up." :
                role.role === "Mason" ?
                    "Masons, wake up and look at each other." :
                `${moderatorRoleName(role.role)}, wake up.`)}
        </h2>

        <p>
            ${role.role === "Werewolf" ?
                "Select every player holding the generic Werewolf card." :
                role.role === "Mason" ?
                    "Select the Masons." :
                `Who is the ${escapeHTML(role.role)}?`}
        </p>
        ${role.role === "The Thing" ? `<p>${readAloud(
            roleRuleSettings.thingParticipatesWolfEliminations ?
                "You are participating in Werewolf eliminations." :
                "You are not participating in Werewolf eliminations."
        )}</p>` : ""}

    `;


    // ========================================================
    // AVAILABLE PLAYERS
    // ========================================================

    const availablePlayers =
        players.filter(player => !player.role);


    // ========================================================
    // SINGLE ROLE
    // ========================================================

    if (role.count === 1) {

        html += `

            <select id="nightPlayerSelect">

                <option value="">
                    Select Player
                </option>

        `;


        availablePlayers.forEach(player => {

            const playerIndex =
                players.indexOf(player);


            html += `

                <option value="${playerIndex}">
                    ${escapeHTML(player.name)}
                </option>

            `;

        });

        html += `

            </select>

        `;

    }


    // ========================================================
    // MULTIPLE COPIES OF ROLE
    // ========================================================

    else {

        html += `

            ${role.role === "Mason" ? "" : `<p>
                Select all ${role.count}
                ${escapeHTML(role.role)}s.
            </p>`}

        `;


        availablePlayers.forEach(player => {

            const playerIndex =
                players.indexOf(player);


            html += `

                <label
                    style="
                        display:block;
                        margin:8px 0;
                    "
                >

                    <input
                        type="checkbox"
                        name="nightPlayer"
                        value="${playerIndex}"
                    >

                    ${escapeHTML(player.name)}

                </label>

            `;

        });

    }


    // ========================================================
    // NEXT
    // ========================================================

    const roleSleepsAfterIdentification = !hasNightOneAction(role);

    html += `

        <hr>

        ${roleSleepsAfterIdentification ? `<p>${readAloud(`${moderatorRoleName(role.role)}, go to sleep.`)}</p><hr>` : ""}

        <button
            type="button"
            data-click="confirmNightRole()"
        >
            Next ➜
        </button>
        <button type="button" data-click="replaceUnidentifiedRoleWithVillager()">Nobody wakes — replace with Villager</button>

    `;


    document.getElementById("screen").innerHTML = html;

}

// ============================================================
// NIGHT ONE - ACTIONS
// ============================================================

function hasNightOneAction(role) {

    const passiveActions = [
        "DelayDeath",
        "RevengeKill",
        "ChangeRole",
        "DisableWolves",
        "Explosion",
        "Prince",
        "ShepherdFlock"
    ];

    return !!role &&
        role.wake !== "Never" &&
        (isLaterNight || !String(role.wake).startsWith("After ")) &&
        role.action !== "N/A" &&
        (isLaterNight || gameSettings.werewolfEliminationOnFirstNight || !["KillPlayer", "NightKill", "WitchChoice", "RevealPlayer"].includes(role.action)) &&
        (isLaterNight || gameSettings.werewolfEliminationOnFirstNight || !["ConvertPlayer", "ProtectPlayer", "BarricadePlayer"].includes(role.action)) &&
        !passiveActions.includes(role.action) &&
        isValidAction(role.action);

}

function getRequiredCardCount() {

    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );
    const thingIsSelected = roles.some(role =>
        role.role === "The Thing" && Number(role.count) > 0
    );

    return players.length + (drunkIsSelected ? 1 : 0) + (thingIsSelected ? 1 : 0);

}

function extraAssignedCardCount(roleName) {
    return (leftoverCardRole?.role === roleName ? 1 : 0) +
        (thingCardRole?.role === roleName ? 1 : 0);
}

function getSetupAutomaticWin(leftoverRoleName = null, thingRoleName = null) {

    let werewolfTeamCount = 0;
    let villagerTeamCount = 0;
    let mayorCount = 0;
    let nonMayorVillagerCount = 0;
    let eliminationWolfCount = 0;

    roles.forEach(role => {
        const dealtCount = Math.max(
            0,
            Number(role.count) - (role.role === leftoverRoleName ? 1 : 0) - (role.role === thingRoleName ? 1 : 0)
        );

        if (role.team === "Werewolf") {
            const countsForParity = role.role === "Minion" ? roleRuleSettings.minionCountsForWerewolfParity :
                role.role === "Fruit Brute" ? roleRuleSettings.fruitBruteCountsForWerewolfParity :
                role.role === "Sorceress" ? roleRuleSettings.sorceressCountsForWerewolfParity : true;
            if (countsForParity) werewolfTeamCount += dealtCount * (role.role === "Big Bad Wolf" ? 2 : 1);

            if (!["Minion", "Sorceress", "The Thing"].includes(role.role)) {
                eliminationWolfCount += dealtCount;
            }
        } else {
            villagerTeamCount += dealtCount;
            if (role.role === "Mayor") {
                mayorCount += dealtCount;
            } else {
                nonMayorVillagerCount += dealtCount;
            }
        }
    });

    if (thingRoleName && roleRuleSettings.thingParticipatesWolfEliminations) {
        eliminationWolfCount++;
    }

    if (nonMayorVillagerCount > 0) {
        villagerTeamCount += mayorCount;
    }

    const leftoverRole = roles.find(role => role.role === leftoverRoleName);
    if (
        leftoverRole?.team === "Werewolf" &&
        !["Minion", "Sorceress", "The Thing"].includes(leftoverRole.role)
    ) {
        eliminationWolfCount++;
    }

    if (eliminationWolfCount === 0) {
        return "The Villagers would win automatically because no Werewolf capable of making the shared elimination would be dealt.";
    }

    if (werewolfTeamCount >= villagerTeamCount) {
        return "The Werewolf team would win automatically because it would equal or outnumber the Villager team.";
    }

    return null;

}

function getPossibleSetupAutomaticWin() {

    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );
    const thingIsSelected = roles.some(role => role.role === "The Thing" && Number(role.count) > 0);

    // The Thing's unknown secondary card changes both the dealt roster and
    // investigative identity, so defer the exact check until that card is set.
    if (thingIsSelected) return null;

    if (!drunkIsSelected) {
        return getSetupAutomaticWin();
    }

    const possibleLeftovers = roles.filter(role =>
        role.role !== "Drunk" && Number(role.count) > 0
    );
    const outcomes = possibleLeftovers.map(role =>
        getSetupAutomaticWin(role.role)
    );

    if (outcomes.length > 0 && outcomes.every(Boolean)) {
        return "Every possible leftover-card setup would produce an automatic win. Adjust the selected roles before starting.";
    }

    return null;

}

function remainingNightOneRoleCount(roleDefinition) {
    const dealtCount = Math.max(
        0,
        Number(roleDefinition?.count || 0) - extraAssignedCardCount(roleDefinition?.role)
    );
    const assignedCount = players.filter(player =>
        (player.nightOneAssignedRole || player.role) === roleDefinition?.role
    ).length;
    return Math.max(0, dealtCount - assignedCount);
}

function remainingNightOneRoles() {
    return roles.filter(role => remainingNightOneRoleCount(role) > 0);
}

function assignGuaranteedNightOneVillagers() {
    const remainingNonVillagers = remainingNightOneRoles().filter(role => role.role !== "Villager");
    if (remainingNonVillagers.length) return false;

    players.filter(player => !player.role).forEach(player => {
        player.role = "Villager";
        player.team = "Villager";
        player.nightOneAssignedRole = "Villager";
    });
    return true;
}

function roleAppearsWerewolfToPI(role) {
    if (role.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToPI;
    if (role.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromPI;
    return role.team === "Werewolf";
}

function nightOneActionHasRequiredInformation(role) {
    if (isLaterNight || !role) return true;

    const exactRoleCheck = role.action === "RevealTeam" ||
        (role.action === "RevealRole" && role.role === "Mystic Wolf");
    if (exactRoleCheck) {
        assignGuaranteedNightOneVillagers();
        return players.every(player => !!player.role);
    }

    const remaining = remainingNightOneRoles();

    if (role.action === "Investigate") {
        return !remaining.some(roleAppearsWerewolfToPI);
    }

    if (role.action === "RevealAlignment") {
        return !remaining.some(candidate => candidate.appearsAs === "Werewolf");
    }

    if (role.action === "RevealRole" && role.role === "Sorceress") {
        return !remaining.some(candidate =>
            candidate.role === "Seer" ||
            (roleRuleSettings.sorceressRevealsWerewolf && candidate.appearsAs === "Werewolf")
        );
    }

    if (role.action === "RevealSeer") {
        return !remaining.some(candidate => candidate.role === "Seer");
    }

    if (role.action === "CompareTeams") {
        return new Set(remaining.map(candidate => candidate.team)).size <= 1;
    }

    return true;
}

function effectiveNightOneTeam(player) {
    if (player?.isThing) return apparentTeam(player);
    if (player?.team) return player.team;
    const remainingTeams = new Set(remainingNightOneRoles().map(role => role.team));
    return remainingTeams.size === 1 ? [...remainingTeams][0] : null;
}

function startNightOneActions(role) {

    nightOneActionOrder = [];
    nightOneActionMode = null;

    if (role?.role === "Werewolf") {
        wolfEliminationsTonight = 1;
        refreshWolfPassiveBonusesForCurrentNight();
    }

    if (
        !hasNightOneAction(role)
    ) {
        advanceNightRole();
        return;
    }

    if (!nightOneActionHasRequiredInformation(role)) {
        players
            .filter(player => player.role === role.role && player.alive)
            .forEach(actor => nightOneDeferredActions.push({ role, actor }));
        drawGoToSleep("advanceNightRole");
        return;
    }

    players
        .filter(player =>
            (role.sharedWolfEliminationOnly ? canChooseWerewolfElimination(player) :
                role.thingSecondaryRole ? player.isThing : player.role === role.role) &&
            player.alive &&
            !(role.oncePerGame && player.usedOncePerGameAction)
        )
        .slice(
            0,
            ["KillPlayer", "RevealGroup"].includes(role.action) ? 1 : undefined
        )
        .forEach(actor => {
            nightOneActionOrder.push({
                role,
                actor,
                continuesIdentificationWake: !isLaterNight && role.action !== "KillPlayer" && !role.alphaActionOnly && !role.sharedWolfEliminationOnly && !role.thingSecondaryRole
            });
        });

    nightOneCurrentAction = 0;

    if (nightOneActionOrder.length === 0) {
        drawGoToSleep("advanceNightRole");
        return;
    }

    drawNightAction();

}

function drawNightAction() {

    if (nightOneCurrentAction >= nightOneActionOrder.length) {
        if (resolvingNightOneDeferredActions) {
            resolvingNightOneDeferredActions = false;
            drawDayOne();
            return;
        }
        if (isLaterNight) {
            isLaterNight = false;
            drawDayOne();
            return;
        }

        nightOneCurrentRole++;
        drawNightRole();
        return;
    }

    const item = nightOneActionOrder[nightOneCurrentAction];
    const action = getAction(item.role.action);
    const previousAction = nightOneActionOrder[nightOneCurrentAction - 1];
    const isSecondWolfTarget = item.role.action === "KillPlayer" &&
        previousAction?.role.action === "KillPlayer";
    const hasResultScreen = nightActionHasVisibleResult(item.role.action);

    if (item.theatricalOnly) {
        drawTheatricalNightAction(item);
        return;
    }

    if (item.actor?.barricadedTonight && item.role.action !== "BarricadePlayer") {
        drawBarricadedNightAction(item);
        return;
    }

    if (!action) {
        nightOneCurrentAction++;
        drawNightAction();
        return;
    }

    const targetCount = getNightActionTargetCount(item);
    const actorMayTargetSelf = item.role.action === "ProtectPlayer" ||
        (item.role.action === "LinkPlayers" && (item.role.role !== "Cupid" || roleRuleSettings.cupidMayLinkSelf)) ||
        (item.role.action === "ExileVillager" && item.role.role === "Old Hag" && roleRuleSettings.oldHagMayTargetSelf) ||
        (item.role.action === "SilencePlayer" && item.role.role === "Shadow Wolf" && roleRuleSettings.blackWolfMaySilenceSelf) ||
        (item.role.action === "SilencePlayer" && item.role.role === "Spellcaster" && roleRuleSettings.spellcasterMaySilenceSelf) ||
        (item.role.action === "RevealAlignment" && item.role.role === "Seer" && roleRuleSettings.seerMayInspectSelf) ||
        (item.role.action === "BarricadePlayer" && roleRuleSettings.locksmithMayTargetSelf) ||
        (item.role.action === "VoodooProtect" && roleRuleSettings.witchDoctorMayTargetSelf) ||
        (item.role.action === "BlockVote" && roleRuleSettings.magistrateMayTargetSelf) ||
        item.role.action === "ExposeRole";
    let availablePlayers = players.filter(player =>
        player.alive && (actorMayTargetSelf || player !== item.actor)
    );

    if (item.role.action === "TrackWolf") {
        drawTrackerNightAction(item, availablePlayers);
        return;
    }

    if (item.role.action === "OracleInspect" && item.actor.oracleUnresolvedWolf?.alive) {
        item.oracleInspectionBlocked = true;
    } else if (item.role.action === "OracleInspect" && item.actor.oracleUnresolvedWolf && !item.actor.oracleUnresolvedWolf.alive) {
        item.actor.oracleUnresolvedWolf = null;
        item.oracleInspectionBlocked = false;
    }

    if (item.role.action === "ProtectPlayer" && roleRuleSettings.bodyguardCannotRepeatTarget) {
        availablePlayers = availablePlayers.filter(player =>
            player !== item.actor.lastProtectedPlayer
        );
    }
    const repeatTargetRule = {
        BarricadePlayer: ["locksmithCannotRepeatTarget", "lastBarricadedPlayer"],
        VoodooProtect: ["witchDoctorCannotRepeatTarget", "lastVoodooPlayer"],
        BlockVote: ["magistrateCannotRepeatTarget", "lastMagistratePlayer"],
        RevealVisitorCount: ["watchmanCannotRepeatTarget", "lastWatchedPlayer"]
    }[item.role.action];
    if (repeatTargetRule && roleRuleSettings[repeatTargetRule[0]]) {
        availablePlayers = availablePlayers.filter(player => player !== item.actor[repeatTargetRule[1]]);
    }
    const roleRepeatRule = {
        "Old Hag": ["oldHagMayRepeatTarget", "lastOldHagTargetId"],
        "Shadow Wolf": ["blackWolfMayRepeatTarget", "lastBlackWolfTargetId"],
        "Spellcaster": ["spellcasterMayRepeatTarget", "lastSpellcasterTargetId"],
        "Seer": ["seerMayRepeatTarget", "lastSeerTargetId"]
    }[item.role.role];
    if (roleRepeatRule && !roleRuleSettings[roleRepeatRule[0]]) {
        availablePlayers = availablePlayers.filter(player => player.id !== item.actor[roleRepeatRule[1]]);
    }

    if (item.role.action === "CompareTeams" && roleRuleSettings.mentalistCannotRepeatPlayers) {
        const previouslyCompared = new Set(item.actor.mentalistComparedPlayerIds || []);
        availablePlayers = availablePlayers.filter(player => !previouslyCompared.has(player.id));
    }

    if (item.role.action === "KillPlayer") {
        availablePlayers = availablePlayers.filter(player =>
            !canChooseWerewolfElimination(player) &&
            (bloodWolfBypassesProtectionTonight || !player.barricadedTonight) &&
            !player.wolfTargetTonight
        );
    }

    if (item.role.action === "ConvertPlayer") {
        availablePlayers = availablePlayers.filter(player => player.wolfTargetTonight);
    }

    if (item.role.action === "WitchChoice" && nightOneActionMode === "save") {
        availablePlayers = availablePlayers.filter(player => player.attackedTonight);
    }

    if (["WitchChoice", "NightKill", "BlessPlayer", "ConvertPlayer", "ForgeArmor"].includes(item.role.action) && !nightOneActionMode) {
        drawOptionalNightAction(item);
        return;
    }

    if (
        targetCount === 0 &&
        ["BecomeSeer", "ChangeTeams", "CheckRoleModel", "RevealWolfVictims", "RevealVisitorCount", "RevealBloodscentVictims"].includes(item.role.action)
    ) {
        executeAction(item.role.action, item.actor, []);
        drawNightActionResult(item, [], true);
        return;
    }

    if (["RevealWerewolves", "RevealGroup"].includes(item.role.action)) {
        executeAction(item.role.action, item.actor, []);
        drawNightActionResult(item, [], true);
        return;
    }

    if (item.role.action === "CopyRole" && isLaterNight && item.actor.doppelgangerTarget) {
        executeAction(item.role.action, item.actor, []);
        if (item.actor.doppelgangerTransformedTonight) {
            queueInheritedRoleContinuation(item.actor);
        }
        drawNightActionResult(item, [item.actor.doppelgangerTarget]);
        return;
    }

    let html = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ?
            escapeHTML(moderatorRoleName(item.role.role)) :
            readAloud(isSecondWolfTarget ? "Werewolves, choose your second target." : `${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        <p>${readAloud(isSecondWolfTarget ? "Whom would you like as your second elimination target?" :
            item.role.action === "Hear" ? "Choose your two neighbors to learn whether either took an action tonight." : item.role.question)}</p>
    `;

    if (targetCount === 1) {

        html += `<select id="nightActionTarget"${["Investigate", "TrackWolf"].includes(item.role.action) ? ' data-change="updateNeighborAvailability()"' : ""}>
            <option value="">Select Player</option>
            <option value="nobody">Nobody</option>
        `;

        availablePlayers.forEach(player => {
            const index = players.indexOf(player);
            html += `<option value="${index}">${escapeHTML(player.name)}</option>`;
        });

        html += `</select>`;

        if (["Investigate", "TrackWolf"].includes(item.role.action)) {
            html += drawNeighborSelectors(availablePlayers, item.role.action === "Investigate" ? "P.I." : "Tracker", item.actor);
        }

    } else if (targetCount > 1) {

        html += `<p>Select exactly ${targetCount} players.</p>`;
        html += `<label style="display:block; margin:8px 0;">
            <input type="checkbox" id="nightActionNobody">
            Nobody
        </label>`;

        availablePlayers.forEach(player => {
            const index = players.indexOf(player);
            html += `
                <label style="display:block; margin:8px 0;">
                    <input type="checkbox" name="nightActionTarget" value="${index}">
                    ${escapeHTML(player.name)}
                </label>
            `;
        });

    }

    if (["Hear", "CheckAdjacentWolves"].includes(item.role.action)) {
        html += drawNeighborSelectors(availablePlayers, "Insomniac", item.actor);
        html += `<label style="display:block; margin:8px 0;">
            <input type="checkbox" id="nightActionNobody">
            Nobody
        </label>`;
    }

    const followingAction = nightOneActionOrder[nightOneCurrentAction + 1];
    const packHasAnotherTarget = item.role.action === "KillPlayer" &&
        followingAction?.role.action === "KillPlayer";

    html += `
        <hr>
        ${packHasAnotherTarget || hasResultScreen ? "" : `<p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p><hr>`}
        <button class="actionContinue" type="button" data-click="confirmNightAction()">Continue ➜</button>
    `;

    document.getElementById("screen").innerHTML = html;

}

function drawBarricadedNightAction(item) {
    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ? escapeHTML(moderatorRoleName(item.role.role)) : readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        ${item.role.question === "N/A" ? "" : `<p>${readAloud(item.role.question)}</p>`}
        <div class="moderatorPanel">This player is barricaded. Give no signal and record no action. Wait a few seconds to maintain secrecy.</div>
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" data-click="advanceBarricadedNightAction()">Continue ➜</button>
    `;
}

function advanceBarricadedNightAction() {
    const item = nightOneActionOrder[nightOneCurrentAction];
    if (item) {
        item.skipped = true;
        recordPhaseEvent(`Night ${currentNight}`, `${item.role.role}'s action was blocked by the Locksmith's barricade.`, `barricade-block-${currentNight}-${item.actor.id}`);
    }
    advanceNightAction();
}

function queueInheritedRoleContinuation(actor) {
    const inheritedDefinition = roles.find(role => role.role === actor.doppelgangerInheritedRole);
    if (!inheritedDefinition || ["Doppelganger", "Drunk"].includes(inheritedDefinition.role)) return;

    const currentPriority = Number(nightOneActionOrder[nightOneCurrentAction]?.role?.priority ?? -Infinity);
    const normalWakeStillAhead = Number(inheritedDefinition.priority) > currentPriority;
    const mayAct = inheritedDefinition.wake === "Every" &&
        inheritedDefinition.action !== "N/A" &&
        !["CopyRole", "KillPlayer"].includes(inheritedDefinition.action) &&
        !(inheritedDefinition.oncePerGame && actor.usedOncePerGameAction);

    if (!normalWakeStillAhead || !mayAct) return;

    removeTheatricalWakesForRole(inheritedDefinition.role, nightOneCurrentAction + 1);

    const continuation = {
        role: inheritedDefinition,
        actor,
        inheritedRoleContinuation: true
    };
    let insertAt = nightOneCurrentAction + 1;
    while (
        insertAt < nightOneActionOrder.length &&
        Number(nightOneActionOrder[insertAt].role.priority) <= Number(inheritedDefinition.priority)
    ) {
        insertAt++;
    }
    nightOneActionOrder.splice(insertAt, 0, continuation);
}

function removeTheatricalWakesForRole(roleName, startIndex = 0) {
    for (let index = nightOneActionOrder.length - 1; index >= startIndex; index--) {
        const queued = nightOneActionOrder[index];
        if (queued.theatricalOnly && queued.role?.role === roleName) {
            nightOneActionOrder.splice(index, 1);
        }
    }
}

function removeRedundantTheatricalWakes() {
    const rolesWithRealWakes = new Set(
        nightOneActionOrder
            .filter(item => !item.theatricalOnly)
            .map(item => item.role?.role)
            .filter(Boolean)
    );

    rolesWithRealWakes.forEach(roleName => removeTheatricalWakesForRole(roleName));
}

function nightActionHasVisibleResult(actionName) {

    return [
        "RevealWerewolves",
        "BecomeSeer",
        "ChangeTeams",
        "CheckRoleModel",
        "RevealAlignment",
        "RevealRole",
        "RevealPlayer",
        "RevealTeam",
        "RevealGroup",
        "CompareTeams",
        "Investigate",
        "Hear",
        "RevealSeer",
        "TrackWolf",
        "OracleInspect",
        "CopyRole",
        "CheckAdjacentWolves",
        "CheckMutualTargets",
        "RevealWolfVictims",
        "RevealVisitorCount",
        "RevealBloodscentVictims"
    ].includes(actionName);

}

function recordPhaseEvent(phase, text, key = null, details = {}) {

    if (!phase || !text) {
        return;
    }

    const eventKey = key || `${phase}:${text}`;
    if (phaseHistory.some(event => event.key === eventKey)) {
        return;
    }

    phaseHistory.push({
        id: details.id || eventKey,
        type: details.type || "note",
        phase,
        text,
        key: eventKey,
        actorId: details.actor?.id ?? details.actorId ?? null,
        targetIds: (details.targets || []).map(target => target.id),
        cause: details.cause || null,
        result: details.result || null,
        blockedBy: details.blockedBy || null
    });

}

function getPhaseInvariantWarnings() {
    const warnings = [];
    players.forEach(player => {
        if (!player.alive && (!player.deathCause || !player.deathPhase)) {
            warnings.push(`${player.name} is eliminated without a complete cause and phase.`);
        }
        if (player.alive && player.deathCause) {
            warnings.push(`${player.name} is alive but still has elimination information.`);
        }
    });
    return warnings;
}

function validatePhaseBeforeAdvance() {
    const warnings = getPhaseInvariantWarnings();
    if (!warnings.length) return true;
    showAppAlert(`The game cannot advance yet. ${warnings.join(" ")}`);
    return false;
}

function sanitizePhaseHistory() {

    phaseHistory = phaseHistory.map(event => {
        if (/^Beholder selected no target\.?$/i.test(event.text)) {
            return { ...event, text: "The Beholder checked for the Seer." };
        }
        const emptySelection = /^(.+?) selected no target\.?$/i.exec(event.text);
        return emptySelection ?
            { ...event, text: `${emptySelection[1]} completed their private night check.` } :
            event;
    });
    const transformedCursedPlayers = new Set();
    const canonicalVillageVotes = new Set(
        phaseHistory
            .filter(event => event.key?.startsWith("elimination-") && /eliminated by Village vote/i.test(event.text))
            .map(event => event.text.match(/^(.+?) was eliminated/i)?.[1])
            .filter(Boolean)
    );
    phaseHistory = phaseHistory.filter(event => {
        const villageVoteMatch = /^(.+?) was eliminated by the village vote\.?$/i.exec(event.text);
        if (!event.key?.startsWith("elimination-") && villageVoteMatch && canonicalVillageVotes.has(villageVoteMatch[1])) {
            return false;
        }
        const match = /^(.+?) was attacked as the Cursed and became a Werewolf/.exec(event.text);
        if (!match) {
            return true;
        }
        const playerName = match[1];
        if (transformedCursedPlayers.has(playerName)) {
            return false;
        }
        transformedCursedPlayers.add(playerName);
        return true;
    });

}

function recordNightActionEvent(item, targets) {

    const roleName = moderatorRoleName(item.role.role);
    const targetNames = targets.map(target => target.name).join(" and ");
    let result = item.skipped ? `${roleName} chose Nobody; no action was taken.` :
        `${roleName} selected ${targetNames || "no target"}.`;

    if (!item.skipped) {
        if (item.role.action === "KillPlayer") {
            result = `Werewolves targeted ${targetNames} for elimination.`;
        } else if (item.role.action === "ProtectPlayer") {
            result = `${item.actor.name}, the ${item.role.role}, protected ${targetNames}.`;
        } else if (item.role.action === "BlessPlayer") {
            result = `${item.actor.name}, the Priest, permanently blessed ${targetNames} against Werewolf attacks.`;
        } else if (item.role.action === "WitchChoice") {
            result = nightOneActionMode === "save" ?
                `The Witch protected ${targetNames}.` :
                `The Witch targeted ${targetNames} for elimination.`;
        } else if (item.role.action === "ConvertPlayer") {
            result = `The Alpha Wolf selected ${targetNames} for conversion.`;
        } else if (item.role.action === "RevealSeer") {
            result = "The Beholder checked for the Seer.";
        } else if (item.role.action === "CheckAdjacentWolves") {
            result = "The Canary checked their adjacent players for Werewolves.";
        } else if (item.role.action === "Hear") {
            result = "The Insomniac checked whether either neighbor took an action.";
        } else if (item.role.action === "RevealWerewolves") {
            result = `${roleName} learned who the Werewolves are.`;
        } else if (!targets.length) {
            result = `${roleName} completed their private night check.`;
        }
    }

    recordPhaseEvent(
        `Night ${currentNight}`,
        result,
        `night-action-${currentNight}-${nightOneCurrentAction}-${item.role.role}`,
        {
            type: "action",
            actor: item.actor,
            targets,
            result: item.skipped ? "skipped" : "completed"
        }
    );

}

function confirmNightAction() {

    const item = nightOneActionOrder[nightOneCurrentAction];
    const targetCount = getNightActionTargetCount(item);
    let targets = [];

    if (item.role.action === "TrackWolf") {
        const previousNeighbors = [item.actor.lastLeftNeighbor, item.actor.lastRightNeighbor].filter(Boolean);
        item.trackerWasTriggered = item.trackerWasTriggered ?? previousNeighbors.some(trackerNeighborWasWolfVictim);
        item.neighbors = getSelectedNeighbors();
        if (!item.neighbors) return;
        item.actor.lastLeftNeighbor = item.neighbors[0];
        item.actor.lastRightNeighbor = item.neighbors[1];

        if (getNightOrdinal(currentNight) === 1 || !item.trackerWasTriggered) {
            item.skipped = true;
            recordPhaseEvent(
                `Night ${currentNight}`,
                getNightOrdinal(currentNight) === 1 ?
                    "The Tracker's initial neighbors were recorded." :
                    "The Tracker had no inspection available because neither previous neighbor was eliminated by the Werewolves.",
                `tracker-status-${currentNight}-${item.actor.id}`,
                { type: "action", actor: item.actor, result: getNightOrdinal(currentNight) === 1 ? "neighbors-recorded" : "not-triggered" }
            );
            advanceNightAction();
            return;
        }
    }

    if (document.getElementById("nightActionNobody")?.checked) {
        item.skipped = true;
        recordNightActionEvent(item, []);
        drawNightActionResult(item, []);
        return;
    }

    if (targetCount === 1) {

        const select = document.getElementById("nightActionTarget");

        if (!select || select.value === "") {
            alert("Please select a player.");
            return;
        }

        if (select.value === "nobody") {
            item.skipped = true;
            recordNightActionEvent(item, []);
            drawNightActionResult(item, []);
            return;
        }

        targets = [players[Number(select.value)]];

        if (item.role.action === "Investigate") {
            item.neighbors = getSelectedNeighbors();
            if (!item.neighbors) {
                return;
            }

            if (item.neighbors.includes(targets[0])) {
                alert("The inspected player cannot also be selected as a neighbor.");
                return;
            }
            item.actor.lastLeftNeighbor = item.neighbors[0];
            item.actor.lastRightNeighbor = item.neighbors[1];
        }

        if (item.role.action === "TrackWolf" && !item.trackerWasTriggered) {
            alert("The Tracker may inspect only when one of their previous neighbors was eliminated by the Werewolves last night. Choose Nobody instead.");
            return;
        }

    } else if (targetCount > 1) {

        const selected = Array.from(
            document.querySelectorAll('input[name="nightActionTarget"]:checked')
        );

        if (selected.length !== targetCount) {
            alert(`Please select exactly ${targetCount} players.`);
            return;
        }

        targets = selected.map(input => players[Number(input.value)]);

    }

    if (["Hear", "CheckAdjacentWolves"].includes(item.role.action)) {
        item.neighbors = getSelectedNeighbors();
        if (!item.neighbors) {
            return;
        }
        item.actor.lastLeftNeighbor = item.neighbors[0];
        item.actor.lastRightNeighbor = item.neighbors[1];
    }

    if (targets.some(target => !target)) {
        alert("A selected player could not be found.");
        return;
    }

    if (item.role.action === "WitchChoice") {
        if (nightOneActionMode === "save") {
            targets[0].protected = true;
            targets[0].protectionCauseTonight = "the Witch's save";
            if (!targets[0].bloodWolfAttackTonight) {
                targets[0].nightAttackCauses = [];
                targets[0].werewolfAttackTonight = false;
                targets[0].nonWerewolfAttackTonight = false;
                targets[0].wolfAttackCountsTonight = false;
                targets[0].attackedTonight = false;
            }
        } else {
            targets[0].nightAttackCauses = targets[0].nightAttackCauses || [];
            targets[0].nightAttackCauses.push("Witch attack");
            targets[0].nonWerewolfAttackTonight = true;
            targets[0].attackedTonight = true;
            targets[0].pendingDeathCause = "Witch attack";
            targets[0].pendingDeathPhase = `Night ${currentNight}`;
        }
    }

    executeAction(item.role.action, item.actor, targets);
    if (item.role.action === "CopyRole") refreshWolfPassiveBonusesForCurrentNight();
    recordNightTargets(item, targets);
    if (item.role.action === "CompareTeams") {
        item.actor.mentalistComparedPlayerIds = item.actor.mentalistComparedPlayerIds || [];
        targets.forEach(target => {
            if (!item.actor.mentalistComparedPlayerIds.includes(target.id)) {
                item.actor.mentalistComparedPlayerIds.push(target.id);
            }
        });
    }
    recordNightActionEvent(item, targets);
    item.actor.tookActionTonight = true;

    if (item.role.oncePerGame) {
        item.actor.usedOncePerGameAction = true;
    }

    if (item.role.action === "ProtectPlayer") {
        item.actor.lastProtectedPlayer = targets[0];
    }
    if (item.role.action === "BarricadePlayer") item.actor.lastBarricadedPlayer = targets[0];
    if (item.role.action === "VoodooProtect") item.actor.lastVoodooPlayer = targets[0];
    if (item.role.action === "BlockVote") item.actor.lastMagistratePlayer = targets[0];
    if (item.role.action === "RevealVisitorCount") item.actor.lastWatchedPlayer = targets[0];
    const roleLastTargetKey = {
        "Old Hag": "lastOldHagTargetId",
        "Shadow Wolf": "lastBlackWolfTargetId",
        "Spellcaster": "lastSpellcasterTargetId",
        "Seer": "lastSeerTargetId"
    }[item.role.role];
    if (roleLastTargetKey && targets[0]) item.actor[roleLastTargetKey] = targets[0].id;

    if (item.role.action === "KillPlayer") {
        players
            .filter(player => player.alive && canChooseWerewolfElimination(player))
            .forEach(player => {
                player.tookActionTonight = true;
            });
    }

    drawNightActionResult(item, targets);

}

function recordNightTargets(item, targets) {
    if (!item?.actor || !targets.length || [
        "CheckMutualTargets",
        "Hear",
        "CheckAdjacentWolves",
        "RevealVisitorCount"
    ].includes(item.role.action)) return;
    nightTargetRecords.push({
        actorId: item.actor.id,
        actorRole: item.role.role,
        action: item.role.action,
        targetIds: targets.map(target => target.id)
    });
}

function drawTrackerNightAction(item, availablePlayers) {
    const previousNeighbors = [item.actor.lastLeftNeighbor, item.actor.lastRightNeighbor].filter(Boolean);
    item.trackerWasTriggered = currentNight > 1 && previousNeighbors.some(trackerNeighborWasWolfVictim);
    const isSetupNight = getNightOrdinal(currentNight) === 1 && previousNeighbors.length < 2;
    const targetOptions = availablePlayers.map(player =>
        `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`
    ).join("");

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ? "Tracker" : readAloud("Tracker, wake up.")}</h2>
        ${isSetupNight ? "" : `<p>${readAloud("If one of your neighbors was eliminated by the Werewolves last night, point to someone to inspect. Otherwise, go back to sleep.")}</p>`}
        <div class="moderatorPanel">
            ${isSetupNight ? "Select the players currently seated directly to the Tracker's left and right." :
                "Confirm the Tracker's current neighbors. Previously selected living neighbors are remembered."}
        </div>
        ${drawNeighborSelectors(availablePlayers, "Tracker", item.actor)}
        ${item.trackerWasTriggered ? `
            <hr>
            <select id="nightActionTarget">
                <option value="">Select player to inspect</option>
                <option value="nobody">Nobody</option>
                ${targetOptions}
            </select>
        ` : `
            <div class="moderatorPanel">Wait a few seconds to maintain secrecy, even though no inspection is available tonight.</div>
        `}
        <hr>
        ${item.trackerWasTriggered ? "" : `<p>${readAloud("Tracker, go to sleep.")}</p><hr>`}
        <button class="actionContinue" type="button" data-click="confirmNightAction()">Continue ➜</button>
    `;
}

function trackerNeighborWasWolfVictim(player) {
    return !player?.alive &&
        player.deathCause === "Werewolf attack" &&
        player.deathPhase === `Night ${currentNight - 1}`;
}

function drawNightActionResult(item, targets, includeQuestion = false) {

    if (
        !item.skipped &&
        !includeQuestion &&
        !nightActionHasVisibleResult(item.role.action)
    ) {
        advanceNightAction();
        return;
    }

    const result = getNightActionResult(item, targets);
    const isSignalAction = [
        "BecomeSeer",
        "ChangeTeams",
        "CheckRoleModel",
        "RevealAlignment",
        "RevealRole",
        "CompareTeams",
        "Investigate",
        "Hear",
        "RevealSeer",
        "TrackWolf",
        ...(item.oracleInspectionBlocked ? [] : ["OracleInspect"]),
        "CheckAdjacentWolves",
        "CheckMutualTargets"
    ].includes(
        item.role.action
    );
    const question = includeQuestion ?
        `<p>${readAloud(item.role.question)}</p>` : "";
    const inspectedPlayer = targets[0];
    const isSorceressCheck = item.actor.role === "Sorceress" && item.role.action === "RevealRole";
    const isNightstalkerCheck = item.actor.role === "Mystic Wolf" && item.role.action === "RevealRole";
    const sorceressFinding = isSorceressCheck && roleRuleSettings.sorceressRevealsWerewolf ?
        getSorceressFinding(inspectedPlayer) : null;
    const inspectionAppearsAs = playerAppearsAs(inspectedPlayer);
    const signalIsUp = item.role.action === "BecomeSeer" ?
        item.actor.becameSeerTonight :
        item.role.action === "ChangeTeams" ?
            item.actor.becameWerewolfTonight :
        item.role.action === "CheckRoleModel" ?
            item.actor.team === "Werewolf" :
        item.role.action === "RevealRole" ?
            inspectedPlayer?.role === "Seer" :
        item.role.action === "CompareTeams" ?
            effectiveNightOneTeam(targets[0]) === effectiveNightOneTeam(targets[1]) :
        item.role.action === "Investigate" ?
            [inspectedPlayer, ...(item.neighbors || [])].some(player => playerAppearsWerewolfToPI(player)) :
        item.role.action === "TrackWolf" ?
            trackerSeesWerewolf(inspectedPlayer) :
        item.role.action === "OracleInspect" ?
            playerAppearsAs(inspectedPlayer) === "Werewolf" :
        item.role.action === "Hear" ?
            (item.neighbors || []).some(player => player?.tookActionTonight) :
        item.role.action === "CheckAdjacentWolves" ?
            (item.neighbors || []).some(canarySeesWerewolf) :
        item.role.action === "CheckMutualTargets" ?
            nightTargetRecords.some(record =>
                (record.actorId === targets[0]?.id && record.targetIds.includes(targets[1]?.id)) ||
                (record.actorId === targets[1]?.id && record.targetIds.includes(targets[0]?.id))
            ) :
            inspectionAppearsAs === "Werewolf";
    const signalText = item.role.action === "RevealAlignment" ?
        readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "RevealRole" ?
            (isSorceressCheck ? "" : readAloud(`${signalIsUp ? "Seer" : "Not the Seer"}.`)) :
        item.role.action === "CompareTeams" ?
            `<span class="moderatorHint">Thumbs up means same team. Thumbs down means different teams.</span>` :
        item.role.action === "Investigate" ?
            `<span class="moderatorHint">Thumbs up means the selected group contains a Werewolf. Thumbs down means it does not.</span>` :
        item.role.action === "Hear" ?
            readAloud(signalIsUp ? "Thumbs up: at least one neighbor took an action." : "Thumbs down: neither neighbor took an action.") :
        item.role.action === "TrackWolf" ?
            readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "OracleInspect" ?
            readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "CheckAdjacentWolves" ?
            readAloud("Thumbs up means a Werewolf is seated beside you. Thumbs down means no Werewolf is seated beside you.") :
        item.role.action === "CheckMutualTargets" ?
            readAloud("Thumbs up means one patrol member targeted the other. Thumbs down means neither targeted the other.") :
        item.role.action === "CheckRoleModel" ?
            readAloud("Thumbs up: you are a Werewolf. Thumbs down: you are not a Werewolf.") :
        `Signal: ${signalIsUp ? "Thumbs up" : "Thumbs down"}`;
    const isLargePrivateReveal = item.role.action === "RevealTeam" ||
        item.role.action === "RevealSeer" ||
        item.role.action === "RevealWolfVictims" ||
        item.role.action === "RevealBloodscentVictims" ||
        item.role.action === "RevealVisitorCount" ||
        isNightstalkerCheck ||
        (item.role.action === "CopyRole" && isLaterNight);
    const sorceressIcon = sorceressFinding === "Seer" ? "🔮" : sorceressFinding === "Werewolf" ? "🐺" : "●";
    const simpleSorceressSignal = isSorceressCheck && !roleRuleSettings.sorceressRevealsWerewolf;
    const isWerewolfRosterReveal = item.role.action === "RevealWerewolves";
    const signal = item.skipped ? `<p>${readAloud("No action was taken.")}</p>` : item.role.action === "OracleInspect" && item.oracleInspectionBlocked ? `
        <div class="moderatorPanel">The Werewolf previously found by the Oracle is still alive. Give no thumbs-up or thumbs-down signal.</div>
    ` : isWerewolfRosterReveal ? `
        <h3 class="moderatorHeading">Moderator note</h3>
        <div class="moderatorPanel">${escapeHTML(result)}</div>
    ` : sorceressFinding ? `
        <div class="sorceressResult"><span aria-hidden="true">${sorceressIcon}</span><strong>${sorceressFinding}</strong></div>
    ` : simpleSorceressSignal ? `
        <p style="font-size:3rem; margin:12px 0;">${signalIsUp ? "👍" : "👎"}</p>
    ` : isLargePrivateReveal ? `
        <div class="privateRoleReveal">${escapeHTML(result)}</div>
    ` : isSignalAction ? `
        <p style="font-size:3rem; margin:12px 0;">${signalIsUp ? "👍" : "👎"}</p>
        <p>${signalText}</p>
    ` : `<p>${readAloud(result)}</p>`;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${includeQuestion && !item.continuesIdentificationWake ? readAloud(`${moderatorRoleName(item.role.role)}, wake up.`) : escapeHTML(moderatorRoleName(item.role.role))}</h2>
        ${question}
        ${signal}
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue preserveUndoSnapshot" type="button" data-click="advanceNightAction()">Continue ➜</button>
    `;

}

function getNightActionResult(item, targets) {

    const target = targets[0];

    if (item.skipped) {
        return "No action taken.";
    }

    switch (item.role.action) {

        case "RevealRole":
            return item.actor.role === "Mystic Wolf" ? `${target.name} — ${target.role}` : `${target.name} was checked.`;

        case "RevealWerewolves":
            return `Werewolves: ${players.filter(player => player.alive && isRecognizedWerewolf(player)).map(player => player.name).join(", ") || "None"}`;

        case "RevealSeer": {
            const seers = players.filter(player =>
                player.alive &&
                player.role === "Seer"
            );
            return seers.length ? `Seer: ${seers.map(player => player.name).join(" and ")}` : "There is no living Seer.";
        }

        case "TrackWolf":
            return trackerSeesWerewolf(target) ? `${target.name} appears to be a Werewolf.` : `${target.name} does not appear to be a Werewolf.`;

        case "RevealWolfVictims": {
            const victims = getGraveDiggerVictims();
            return victims.map(player => `${player.name} — ${player.role}`).join("\n") || "No Werewolf victim from last night.";
        }

        case "RevealBloodscentVictims": {
            const victims = players.filter(player =>
                !player.alive && player.deathCause === "Werewolf attack" && player.deathPhase === `Night ${currentNight - 1}`
            );
            return victims.map(player => `${player.name} — ${player.role}`).join("\n") || "No Werewolf victim from last night.";
        }

        case "RevealVisitorCount": {
            const watched = targets[0];
            const count = watched ? nightTargetRecords.reduce((total, record) => {
                if (record.actorId === item.actor.id || !record.targetIds.includes(watched.id)) return total;
                if (record.action === "KillPlayer" && roleRuleSettings.watchmanCountsEachWerewolfVisitor) {
                    return total + players.filter(player =>
                        player.alive && player.tookActionTonight && canChooseWerewolfElimination(player)
                    ).length;
                }
                return total + 1;
            }, 0) : 0;
            return watched ? `${watched.name} had ${count} visitor${count === 1 ? "" : "s"}.` : "No player was watched.";
        }

        case "CheckAdjacentWolves":
            return (item.neighbors || []).some(canarySeesWerewolf) ? "A Werewolf is adjacent." : "No Werewolf is adjacent.";

        case "CheckMutualTargets":
            return "Patrol check complete.";

        case "BecomeSeer":
            return item.actor.becameSeerTonight ?
                "Signal: thumbs up. You are now the Seer." :
                "Signal: thumbs down. The Seer is still in the game.";

        case "ChangeTeams":
            return item.actor.becameWerewolfTonight ?
                "Signal: thumbs up. You have become a Werewolf." :
                "Signal: thumbs down. You remain on the Villager team.";

        case "RevealAlignment":
            return `${target.name} appears as ${
                roles.find(role => role.role === target.role)?.appearsAs ||
                target.team ||
                "Villager"
            }.`;

        case "RevealRole":
            if (item.actor.role === "Sorceress") {
                return `${target.name}: ${getSorceressFinding(target)}.`;
            }
            return target.role === "Seer" ?
                `${target.name} is the Seer.` :
                `${target.name} is not the Seer.`;

        case "RevealPlayer":
            item.actor.usedOncePerGameAction = true;
            if (apparentTeam(target) === "Werewolf") {
                recordElimination(target, "Revealer", `Night ${currentNight}`);
                return "They are on the Werewolf team and are eliminated.";
            }
            recordElimination(item.actor, "Revealer backlash", `Night ${currentNight}`);
            return "They are on the Villager team. The Revealer is eliminated.";

        case "Investigate":
            return "Investigation complete.";

        case "Hear":
            return (item.neighbors || []).some(player => player.tookActionTonight) ?
                "A neighbor took an action tonight." :
                "Neither neighbor took an action tonight.";

        case "RevealTeam":
            return `${target.name}'s role is ${roleShownToMysticSeer(target)}.`;

        case "CompareTeams":
            return effectiveNightOneTeam(targets[0]) === effectiveNightOneTeam(targets[1]) ? "They are on the same team." : "They are on different teams.";

        case "RevealGroup":
            return `${item.role.role}s: ${players.filter(player => player.role === item.role.role).map(player => player.name).join(", ")}.`;

        case "CopyRole":
            if (!isLaterNight) {
                return `${target.name} selected.`;
            }

            return item.actor.doppelgangerInheritedRole ?
                `Doppelganger, this is your role: ${item.actor.doppelgangerInheritedRole}.` :
                "Doppelganger, this is your role: Doppelganger.";

        case "ConnectToPlayer":
            return `${item.actor.name} is connected to ${target.name}.`;

        case "LinkPlayers":
            return `${targets[0].name} and ${targets[1].name} are linked.`;

        case "ProtectPlayer":
        case "BlessPlayer":
            return `${target.name} is permanently protected from Werewolf attacks.`;

        case "ForgeArmor":
            return `${target.name} received armor that will block one Werewolf attack.`;

        case "BarricadePlayer":
            return `${target.name} is barricaded for tonight.`;

        case "VoodooProtect":
            return `${target.name} received the voodoo doll for tonight.`;

        case "MarkLycan":
            return `${target.name} now appears as a Werewolf to investigative roles.`;

        case "ChooseOwner":
            return `${target.name} is the Pet Wolf's owner.`;

        case "ChooseGuardianWard":
            return `${target.name} is under the Guardian's protection.`;

        case "ExposeRole":
            return `${target.name}'s role will be announced when the village wakes.`;

        case "OracleInspect":
            return playerAppearsAs(target) === "Werewolf" ?
                `${target.name} appears to be a Werewolf.` :
                `${target.name} does not appear to be a Werewolf.`;

        case "WatchPlayer":
            return `${item.actor.name} is watching ${target.name}.`;

        case "SilencePlayer":
            return `${target.name} is silenced for the next day.`;

        case "ConvertPlayer":
            return `${target.name} was selected for conversion. The result will resolve at dawn.`;

        case "ExileVillager":
            return `${target.name} will miss the next day.`;

        default:
            return "";

    }

}

function getNightActionTargetCount(item) {

    if (item.role.action === "WitchChoice") {
        return nightOneActionMode ? 1 : 0;
    }

    return Number(getActionTargetCount(item.role.action)) || 0;

}

function drawTheatricalNightAction(item) {

    const targetCount = getNightActionTargetCount(item);
    const baseQuestion = item.role.question.replace(/\s*If no one.*$/i, "").trim();
    const theatricalQuestion = targetCount > 0 ?
        `${baseQuestion} Point to someone if so. If no one, go back to sleep.` :
        item.role.question;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        ${item.role.question === "N/A" ? "" : `<p>${readAloud(theatricalQuestion)}</p>`}
        <h3 class="moderatorHeading">Moderator note</h3>
        <div class="moderatorPanel">
            Wait a few seconds to maintain secrecy.
        </div>
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" data-click="advanceNightAction()">Continue ➜</button>
    `;

}

function drawNeighborSelectors(availablePlayers, roleName, actor = null) {

    const drawOptions = selectedPlayer => availablePlayers.map(player =>
        `<option value="${players.indexOf(player)}"${player === selectedPlayer ? " selected" : ""}>${escapeHTML(player.name)}</option>`
    ).join("");
    const previousLeft = actor?.lastLeftNeighbor?.alive ? actor.lastLeftNeighbor : null;
    const previousRight = actor?.lastRightNeighbor?.alive ? actor.lastRightNeighbor : null;

    return `
        <select id="leftNeighbor"><option value="">Current left neighbor</option>${drawOptions(previousLeft)}</select>
        <select id="rightNeighbor"><option value="">Current right neighbor</option>${drawOptions(previousRight)}</select>
    `;

}

function updateNeighborAvailability() {

    const inspectedValue = document.getElementById("nightActionTarget")?.value;
    ["leftNeighbor", "rightNeighbor"].forEach(id => {
        const select = document.getElementById(id);
        if (!select) {
            return;
        }
        [...select.options].forEach(option => {
            option.disabled = inspectedValue !== "" && option.value === inspectedValue;
        });
        if (select.value === inspectedValue) {
            select.value = "";
        }
    });

}

function getSelectedNeighbors() {

    const left = document.getElementById("leftNeighbor");
    const right = document.getElementById("rightNeighbor");

    if (!left || !right || left.value === "" || right.value === "" || left.value === right.value) {
        alert("Please select two different neighbors.");
        return null;
    }

    return [players[Number(left.value)], players[Number(right.value)]];

}

function drawOptionalNightAction(item) {

    const choices = item.role.action === "WitchChoice" ? `
        <button type="button" data-click="setNightActionMode('save')">👍 Save</button>
        <button type="button" data-click="setNightActionMode('kill')">👎 Eliminate</button>
        <button type="button" data-click="setNightActionMode('skip')">Do nothing</button>
    ` : item.role.action === "ConvertPlayer" ? `
        <button type="button" data-click="setNightActionMode('take')">👍 Turn the target</button>
        <button type="button" data-click="setNightActionMode('skip')">Go to sleep</button>
    ` : `
        <button type="button" data-click="setNightActionMode('take')">Take action</button>
        <button type="button" data-click="setNightActionMode('skip')">Do not take action</button>
    `;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${item.continuesIdentificationWake ? escapeHTML(moderatorRoleName(item.role.role)) : readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        <p>${readAloud(item.role.question)}</p>
        ${choices}
    `;

}

function setNightActionMode(mode) {

    const item = nightOneActionOrder[nightOneCurrentAction];
    nightOneActionMode = mode;

    if (mode === "skip") {
        item.skipped = true;
        drawNightActionResult(item, []);
        return;
    }

    if (item.role.action === "ConvertPlayer") {
        const target = players.find(player =>
            player.alive &&
            player !== item.actor &&
            player.wolfTargetTonight
        );

        if (!target) {
            item.skipped = true;
            drawNightActionResult(item, []);
            return;
        }

        executeAction(item.role.action, item.actor, [target]);
        item.actor.tookActionTonight = true;
        if (item.role.oncePerGame) {
            item.actor.usedOncePerGameAction = true;
        }
        drawNightActionResult(item, [target]);
        return;
    }

    drawNightAction();

}

function drawGoToSleep(callbackName) {

    document.getElementById("screen").innerHTML = `
        <h2>${readAloud("Go to sleep.")}</h2>
        <button type="button" data-click="${callbackName}()">Continue</button>
    `;

}

function advanceNightRole() {

    nightOneCurrentRole++;
    drawNightRole();

}

function advanceNightAction() {

    const completedAction = nightOneActionOrder[nightOneCurrentAction];

    if (
        completedAction?.role.action === "BecomeSeer" &&
        completedAction.actor.becameSeerTonight
    ) {
        const seerRole = roles.find(role => role.role === "Seer");

        if (seerRole) {
            removeTheatricalWakesForRole("Seer", nightOneCurrentAction + 1);
            nightOneActionOrder.splice(
                nightOneCurrentAction + 1,
                0,
                { role: seerRole, actor: completedAction.actor }
            );
        }
    }

    nightOneCurrentAction++;
    nightOneActionMode = null;
    drawNightAction();

}

// ============================================================
// CONFIRM CURRENT NIGHT ROLE
// ============================================================

function replaceUnidentifiedRoleWithVillager() {
    const role = nightOneWakeOrder[nightOneCurrentRole];
    if (!role || !(role.count > 0) || role.alphaActionOnly || role.sharedWolfEliminationOnly || role.thingSecondaryRole || role.mockLeftoverAction) return;
    const selectedRole = roles.find(candidate => candidate.role === role.role);
    const villager = roles.find(candidate => candidate.role === "Villager");
    if (!selectedRole || !villager) return;
    selectedRole.count = Math.max(0, Number(selectedRole.count) - role.count);
    villager.count = Number(villager.count || 0) + role.count;
    recordPhaseEvent(`Night ${currentNight}`, `${role.count} ${role.role} card(s) replaced with Villager because nobody woke.`, `replace-role-${currentNight}-${nightOneCurrentRole}`);
    nightOneWakeOrder = nightOneWakeOrder.filter((entry, index) => index <= nightOneCurrentRole || !(entry.role === role.role && entry.alphaActionOnly));
    advanceNightRole();
}

function confirmNightRole() {

    const role =
        nightOneWakeOrder[nightOneCurrentRole];


    if (!role) {

        console.error(
            "No role found for current Night 1 position."
        );

        return;

    }


    // ========================================================
    // SINGLE PLAYER
    // ========================================================

    if (role.count === 1) {

        const select =
            document.getElementById(
                "nightPlayerSelect"
            );


        if (
            !select ||
            select.value === ""
        ) {

            alert(
                `Please select who the ${role.role} is.`
            );

            return;

        }


        const playerIndex =
            Number(select.value);


        const player =
            players[playerIndex];


        if (!player) {

            alert(
                "The selected player could not be found."
            );

            return;

        }


        // Make absolutely sure this player hasn't
        // already been assigned.

        if (player.role) {

            alert(
                `${player.name} already has a role.`
            );

            return;

        }


        player.role = role.role;

        player.team = role.team;
        player.nightOneAssignedRole = role.role;

        if (role.role === "The Thing" && thingCardRole) {
            player.isThing = true;
            player.thingSecondaryRole = thingCardRole.role;
            player.role = thingCardRole.role;
            player.team = "Werewolf";
            if (thingCardRole.role === "Seer") player.isOriginalSeer = true;
            if (thingCardRole.role === "Shepherd") player.shepherdFlockAlive = true;
        }

        if (role.role === "Seer") {
            player.isOriginalSeer = true;
        }

        if (role.role === "Drunk") {
            player.isOriginalDrunk = true;
        }

        if (role.role === "Shepherd") {
            player.shepherdFlockAlive = true;
        }

    }


    // ========================================================
    // MULTIPLE PLAYERS
    // ========================================================

    else {

        const selected =
            Array.from(
                document.querySelectorAll(
                    'input[name="nightPlayer"]:checked'
                )
            );


        if (
            selected.length !==
            role.count
        ) {

            alert(
                `Please select exactly ${role.count} ${role.role}s.`
            );

            return;

        }


        // ====================================================
        // ASSIGN SELECTED PLAYERS
        // ====================================================

        for (const input of selected) {

            const playerIndex =
                Number(input.value);


            const player =
                players[playerIndex];


            if (!player) {

                alert(
                    "One of the selected players could not be found."
                );

                return;

            }


            if (player.role) {

                alert(
                    `${player.name} already has a role.`
                );

                return;

            }

        }


        // ====================================================
        // SAVE ROLES
        // ====================================================

        selected.forEach(input => {

            const playerIndex =
                Number(input.value);


            const player =
                players[playerIndex];


            player.role = role.role;

            player.team = role.team;
            player.nightOneAssignedRole = role.role;

            if (role.role === "The Thing" && thingCardRole) {
                player.isThing = true;
                player.thingSecondaryRole = thingCardRole.role;
                player.role = thingCardRole.role;
                player.team = "Werewolf";
                if (thingCardRole.role === "Seer") player.isOriginalSeer = true;
                if (thingCardRole.role === "Shepherd") player.shepherdFlockAlive = true;
            }

            if (role.role === "Seer") {
                player.isOriginalSeer = true;
            }

            if (role.role === "Drunk") {
                player.isOriginalDrunk = true;
            }

        });

    }


    // ========================================================
    // COMPLETE THIS ROLE'S ACTION WHILE IT IS AWAKE
    // ========================================================

    startNightOneActions(role);

}

// ============================================================
// DAY ONE
// ============================================================

function refreshWolfPassiveBonusesForCurrentNight() {
    const livingEliminationWolves = players.filter(player => player.alive && canChooseWerewolfElimination(player));
    const packBondDoubleKill = livingEliminationWolves.length === 1 && livingEliminationWolves[0].role === "Vengeful Wolf";
    const ravenousTallyCanTrigger = getNightOrdinal(currentNight) >= 3;
    const packHungerDoubleKill = ravenousTallyCanTrigger &&
        players.some(player => player.alive && player.role === "Ravenous Wolf") &&
        [currentNight - 1, currentNight - 2].every(night =>
            werewolfEliminationWasAvailableOnNight(night) && !werewolfEliminationOccurredOnNight(night)
        );
    if (packBondDoubleKill || packHungerDoubleKill) wolfEliminationsTonight = 2;
    bloodWolfBypassesProtectionTonight = getNightOrdinal(currentNight) === 3 &&
        players.some(player => player.alive && player.role === "Crimson Wolf");

    if (packBondDoubleKill) {
        recordPhaseEvent(`Night ${currentNight}`, "The Vengeful Wolf was the last Werewolf, so the Werewolves received two eliminations.", `pack-bond-double-${currentNight}`);
    }
    if (packHungerDoubleKill) {
        recordPhaseEvent(`Night ${currentNight}`, "The Werewolves had gone two consecutive nights without an elimination, so the Ravenous Wolf granted two eliminations.", `pack-hunger-${currentNight}`);
    }
    if (bloodWolfBypassesProtectionTonight) {
        recordPhaseEvent(`Night ${currentNight}`, "The living Crimson Wolf allowed Werewolf attacks to ignore all protection, Tough Guy's delay, and the Diseased penalty on Night 3.", `blood-wolf-${currentNight}`);
    }
}

function gameBeginsOnNightZero() {
    return !gameSettings.werewolfEliminationOnFirstNight && gameSettings.beginGameOnNightZero;
}

function getNightOrdinal(night) {
    return Number(night) + (gameBeginsOnNightZero() ? 1 : 0);
}

function werewolfEliminationWasAvailableOnNight(night) {
    const firstNightLabel = gameBeginsOnNightZero() ? 0 : 1;
    return gameSettings.werewolfEliminationOnFirstNight || Number(night) !== firstNightLabel;
}

function werewolfEliminationOccurredOnNight(night) {
    const phase = `Night ${night}`;
    return players.some(player =>
        player.werewolfEliminationCountedNight === night ||
        (roleRuleSettings.packsHungerCountsShepherdFlock && player.shepherdFlockEliminatedNight === night) ||
        (!player.alive && player.deathPhase === phase && (
            player.deathCause === "Werewolf attack" ||
            player.deathCause === "Tough Guy succumbed to Werewolf injuries"
        ))
    );
}

function startNextNight() {

    if (!validatePhaseBeforeAdvance()) return;
    currentScreen = "night";

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
        players.filter(player => player.alive && player.role === "Sasquatch").forEach(player => {
            player.role = "Werewolf";
            player.team = "Werewolf";
            recordPhaseEvent(`Day ${currentDay}`, `${player.name}, the Sasquatch, became a Werewolf because the Day ended without an elimination.`, `sasquatch-${player.id}-${currentDay}`);
        });
    }

    isLaterNight = true;
    currentNight = gameBeginsOnNightZero() ? currentDay : currentDay + 1;
    savedVoteCount = 0;
    dayEliminationVoteOccurred = false;
    nightTargetRecords = [];
    nightOneActionMode = null;
    nightOneActionOrder = [];
    const wolfCubDoubleKill = players.some(player =>
        player.role === "Wolf Cub" &&
        !player.alive &&
        (player.deathCause !== "Kicked" || roleRuleSettings.wolfCubKickActivatesBonus) &&
        !player.wolfCubBonusGranted
    );
    wolfEliminationsTonight = wolfCubDoubleKill ? 2 : 1;
    bloodWolfBypassesProtectionTonight = false;
    refreshWolfPassiveBonusesForCurrentNight();

    if (wolfCubDoubleKill) {
        players
            .filter(player =>
                player.role === "Wolf Cub" &&
                !player.alive &&
                (player.deathCause !== "Kicked" || roleRuleSettings.wolfCubKickActivatesBonus)
            )
            .forEach(player => {
                player.wolfCubBonusGranted = true;
            });
    }
    wolvesDisabledTonight = wolvesDisabledNextNight;
    wolvesDisabledNextNight = false;

    players.forEach(player => {
        player.attackedTonight = false;
        player.nightAttackCauses = [];
        player.werewolfAttackTonight = false;
        player.nonWerewolfAttackTonight = false;
        player.protectedFromWerewolvesTonight = false;
        player.bodyguardBlockedWerewolfAttackTonight = false;
        player.bodyguardBlockedOtherAttackTonight = [];
        player.priestBlockedWerewolfAttackTonight = false;
        player.alphaConversionFailedTonight = false;
        player.shepherdFlockSavedTonight = false;
        player.butcherRedirectedTonight = null;
        player.fruitBruteOnlyAttackTonight = false;
        player.magistrateProtectedToday = false;
        player.attackedByWolvesTonight = false;
        player.wolfTargetTonight = false;
        player.wolfAttackCountsTonight = false;
        player.pendingDeathCause = null;
        player.pendingDeathPhase = null;
        player.protected = false;
        player.protectionCauseTonight = null;
        player.silenced = false;
        player.exiledTonight = false;
        player.tookActionTonight = false;
        player.becameWerewolfTonight = false;
        player.alphaConvertedTonight = false;
        player.becameSeerTonight = false;
        player.doppelgangerTransformedTonight = false;
        player.barricadedTonight = false;
        player.barricadeBlockedWerewolfTonight = false;
        player.armorBrokeTonight = false;
        player.voodooProtectedTonight = false;
        player.voodooRedirectedTonight = false;
        player.voodooResolvedTonight = false;
        player.bloodWolfAttackTonight = false;
        player.watchedPlayerTonight = null;
        player.exposedByTonight = null;
        player.exposedPlayerTonight = null;
        player.silversmithBlockedWerewolfTonight = false;
        player.guardianProtectedTonight = false;
        player.guardianSacrificedTonightFor = null;
        });

    const drunkCardReveal = getNightOrdinal(currentNight) === 3 ? transformDrunk() : null;
    if (drunkCardReveal) refreshWolfPassiveBonusesForCurrentNight();

    roles
        .map(role => role.role === "Wild Child" ? {
            ...role,
            wake: "Every",
            action: "CheckRoleModel",
            question: "Learn whether your role model's death caused you to become a Werewolf."
        } : role)
        .filter(role =>
            (role.wake === "Every" || (
                role.role === "Beholder" &&
                roleRuleSettings.beholderWakesOnFutureNights
            )) &&
            (
                role.count > 0 ||
                (
                    role.action === "KillPlayer" &&
                    players.some(player => player.alive && canChooseWerewolfElimination(player))
                )
            )
        )
        .filter(role => hasNightOneAction(role))
        .sort((a, b) => Number(a.priority) - Number(b.priority))
        .forEach(role => {
            const actors = players
                .filter(player =>
                    (role.action === "KillPlayer" ?
                        canChooseWerewolfElimination(player) && !player.barricadedTonight :
                        role.action === "CheckRoleModel" ?
                            player.isWildChild :
                        role.action === "CopyRole" ?
                            player.isDoppelganger :
                    player.role === role.role) &&
                    player.alive &&
                    !(
                        role.role === "Witch" &&
                        role.oncePerGame &&
                        player.usedOncePerGameAction
                    )
                )
                .slice(0, role.action === "KillPlayer" ? 1 : undefined);

            if (role.action === "KillPlayer" && actors.length === 0) {
                const barricadedWolf = players.find(player =>
                    player.alive && player.barricadedTonight && canChooseWerewolfElimination(player)
                );
                if (barricadedWolf) actors.push(barricadedWolf);
            }

            actors.forEach(actor => {
                const actionCount = role.action === "KillPlayer" ?
                    wolfEliminationsTonight : 1;

                for (let actionIndex = 0; actionIndex < actionCount; actionIndex++) {
                    nightOneActionOrder.push({
                        role,
                        actor,
                        theatricalOnly: role.role !== "Witch" &&
                            role.oncePerGame === true &&
                            actor.usedOncePerGameAction === true
                    });
                }
            });

            if (actors.length === 0 && role.action !== "KillPlayer") {
                const hiddenDeadActor = players.find(player =>
                    !player.alive &&
                    !player.roleRevealed &&
                    (role.action === "CopyRole" ?
                        player.isDoppelganger :
                        player.role === role.role) &&
                    !(
                        role.role === "Witch" &&
                        role.oncePerGame &&
                        player.usedOncePerGameAction
                    )
                );

                if (hiddenDeadActor) {
                    nightOneActionOrder.push({
                        role,
                        actor: hiddenDeadActor,
                        theatricalOnly: true
                    });
                }
            }
        });

    const graveVictims = getGraveDiggerVictims();
    players.filter(player => player.alive && player.role === "Grave Digger" && graveVictims.length).forEach(actor => {
        nightOneActionOrder.push({
            role: { role: "Grave Digger", priority: 996, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealWolfVictims" },
            actor
        });
    });
    const hiddenDeadGraveDigger = players.find(player =>
        !player.alive && !player.roleRevealed && player.role === "Grave Digger"
    );
    if (graveVictims.length && hiddenDeadGraveDigger) {
        nightOneActionOrder.push({
            role: { role: "Grave Digger", priority: 996, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealWolfVictims" },
            actor: hiddenDeadGraveDigger,
            theatricalOnly: true
        });
    }
    const bloodscentVictims = players.filter(player =>
        !player.alive && player.deathCause === "Werewolf attack" && player.deathPhase === `Night ${currentNight - 1}`
    );
    players.filter(player => player.alive && player.role === "Death Hound" && bloodscentVictims.length).forEach(actor => {
        nightOneActionOrder.push({
            role: { role: "Death Hound", priority: 996.5, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealBloodscentVictims" },
            actor
        });
    });
    const hiddenDeadBloodscent = players.find(player =>
        !player.alive && !player.roleRevealed && player.role === "Death Hound"
    );
    if (bloodscentVictims.length && hiddenDeadBloodscent) {
        nightOneActionOrder.push({
            role: { role: "Death Hound", priority: 996.5, question: "Learn the exact roles of players eliminated by the Werewolves last night.", action: "RevealBloodscentVictims" },
            actor: hiddenDeadBloodscent,
            theatricalOnly: true
        });
    }
    nightOneActionOrder.sort((a, b) => Number(a.role.priority) - Number(b.role.priority));

    const waitingDrunk = players.find(player =>
        player.isOriginalDrunk && player.alive && !player.drunkCardReceived
    );
    const leftoverHasActiveRepresentative = leftoverCardRole?.action === "KillPlayer" ?
        players.some(player => player.alive && canChooseWerewolfElimination(player)) :
        players.some(player => player.alive && player.role === leftoverCardRole?.role);
    if (
        currentNight < 3 &&
        waitingDrunk &&
        !leftoverHasActiveRepresentative &&
        leftoverCardRole?.wake === "Every" &&
        roleHasActiveNightPrompt(leftoverCardRole)
    ) {
        nightOneActionOrder.push({
            role: { ...leftoverCardRole },
            actor: waitingDrunk,
            theatricalOnly: true,
            leftoverTheatrical: true
        });
        nightOneActionOrder.sort((a, b) => Number(a.role.priority) - Number(b.role.priority));
    }

    if (drunkCardReveal && drunkRoleNeedsDelayedSetup(drunkCardReveal.role)) {
        nightOneActionOrder.unshift({
            role: drunkCardReveal.role,
            actor: drunkCardReveal.drunk
        });
    }

    removeRedundantTheatricalWakes();

    nightOneCurrentAction = 0;

    if (drunkCardReveal) {
        drawDrunkCardReveal(drunkCardReveal);
        return;
    }

    drawNightAction();

}

function drunkRoleNeedsDelayedSetup(role) {
    return !!role &&
        hasNightOneAction(role) &&
        (String(role.wake) === "1" || role.action === "CopyRole");
}

function transformDrunk() {

    const drunk = players.find(player =>
        player.isOriginalDrunk && player.alive && !player.drunkCardReceived
    );

    if (!drunk || !leftoverCardRole) {
        return null;
    }

    drunk.role = leftoverCardRole.role;
    drunk.team = leftoverCardRole.team;
    drunk.drunkCardReceived = true;

    if (leftoverCardRole.role === "Seer") {
        drunk.isOriginalSeer = true;
    }

    return {
        drunk,
        role: leftoverCardRole
    };

}

function drawDrunkCardReveal(reveal) {

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud("Drunk, wake up.")}</h2>
        <div class="moderatorPanel">
            Hand ${escapeHTML(reveal.drunk.name)} the physical ${escapeHTML(reveal.role.role)} card. Do not announce the role aloud.
        </div>
        <hr>
        <p>${readAloud("Drunk, go to sleep.")}</p>
        <hr>
        <button class="actionContinue" type="button" data-click="continueNightAfterDrunkCard()">Continue ➜</button>
    `;

}

function continueNightAfterDrunkCard() {

    drawNightAction();

}

function getNightModeratorDetails() {

    const details = [];
    const wolfTargets = players.filter(player => player.wolfTargetTonight);
    const wolvesChoseNobody = nightOneActionOrder.some(item =>
        item.role?.action === "KillPlayer" && item.skipped
    );

    if (wolvesChoseNobody && wolfTargets.length === 0) {
        details.push("The Werewolves selected Nobody, so no Werewolf attack occurred.");
    } else if (wolvesChoseNobody) {
        details.push("The Werewolves selected Nobody for one of their elimination choices.");
    }

    if (wolvesDisabledTonight && !bloodWolfBypassesProtectionTonight && wolfTargets.length) {
        details.push(
            `The Werewolves targeted ${wolfTargets.map(player => player.name).join(", ")}, ` +
            "but the attack did not count because the Diseased was eliminated by the Werewolves the previous night."
        );
    }

    players.filter(player => player.fruitBruteOnlyAttackTonight).forEach(player => {
        details.push(`${player.name} was targeted, but the choice had no effect because the Fruit Brute was the only Werewolf present.`);
    });

    players.filter(player =>
        player.wolfTargetTonight && player.blessedAgainstWerewolves && !player.bloodWolfAttackTonight
    ).forEach(player => {
        details.push(
            `${player.name} was targeted by the Werewolves but survived because of the Priest's permanent blessing.`
        );
    });

    players.filter(player => player.bodyguardBlockedWerewolfAttackTonight).forEach(player => {
        const protectionSource = player.protectionCauseTonight || "a protective action";
        details.push(`${player.name} survived the Werewolf attack because of ${protectionSource}.`);
    });

    players.filter(player => player.armorBrokeTonight).forEach(player => {
        details.push(`${player.name} survived the Werewolf attack because their armor broke.`);
    });
    players.filter(player => player.silversmithBlockedWerewolfTonight).forEach(player => {
        details.push(`${player.name}, the Silversmith, cannot be eliminated by Werewolf attacks.`);
    });
    players.filter(player => player.guardianProtectedTonight).forEach(player => {
        details.push(`${player.name}, the Guardian, survived because the player they guard is still alive.`);
    });
    players.filter(player => player.guardianSacrificedTonightFor).forEach(player => {
        details.push(`${player.name}, the Guardian, died in place of ${player.guardianSacrificedTonightFor}.`);
    });
    players.filter(player => player.barricadeBlockedWerewolfTonight).forEach(player => {
        details.push(`${player.name} could not be targeted by the Werewolves because the Locksmith barricaded them.`);
    });
    players.filter(player => player.voodooRedirectedTonight).forEach(player => {
        details.push(roleRuleSettings.voodooDollTargetSurvives ?
            `${player.name} survived the Werewolf attack because the voodoo doll redirected it.` :
            `${player.name}'s voodoo doll retaliated against a Werewolf, but ${player.name} was still eliminated.`);
    });
    players.filter(player => player.bloodWolfAttackTonight).forEach(player => {
        details.push(`${player.name} was targeted during the Crimson Wolf's Night 3 attack, so protection did not apply.`);
    });

    players.filter(player => player.bodyguardBlockedOtherAttackTonight?.length).forEach(player => {
        details.push(
            `${player.name} survived ${player.bodyguardBlockedOtherAttackTonight.join(" and ")} because the Bodyguard protected them.`
        );
    });

    players.filter(player => player.alphaConversionFailedTonight).forEach(player => {
        details.push(
            `${player.name} resisted the Alpha Wolf's conversion because they were protected from Werewolf attacks. ` +
            (roleRuleSettings.alphaFailedConversionUsesAbility ?
                "The Alpha Wolf's ability was still used." :
                "The Alpha Wolf may try again on a future night.")
        );
    });

    players.filter(player => player.shepherdFlockSavedTonight).forEach(player => {
        details.push(`${player.name}, the Shepherd, survived the Werewolf attack because their flock was eliminated instead.`);
    });

    players.filter(player => player.butcherRedirectedTonight).forEach(player => {
        details.push(`${player.name}, the Butcher, redirected the Werewolf attack to ${player.butcherRedirectedTonight}.`);
    });

    players.filter(player => player.becameWerewolfTonight).forEach(player => {
        details.push(`${player.name} was attacked as the Cursed and became a Werewolf instead of being eliminated.`);
    });

    players.filter(player => player.alphaConvertedTonight).forEach(player => {
        details.push(`${player.name} was turned into a Werewolf by the Alpha Wolf instead of being eliminated by the Werewolves.`);
    });

    players.filter(player => player.toughGuyDeathPending).forEach(player => {
        details.push(
            `${player.name}, the Tough Guy, was attacked and survived tonight. ` +
            "Their delayed elimination will occur during the next Night Update."
        );
    });

    players.filter(player =>
        player.role === "Diseased" &&
        !player.alive &&
        player.wolfAttackCountsTonight &&
        !player.bloodWolfAttackTonight
    ).forEach(player => {
        details.push(
            `${player.name}, the Diseased, was eliminated by the Werewolves. ` +
            "The Werewolves' elimination will not count next night."
        );
    });

    players.filter(player =>
        !player.alive && player.deathPhase === `Night ${currentNight}`
    ).forEach(player => {
        details.push(`${player.name} was eliminated by ${player.deathCause || "a night attack"}.`);
    });

    if (!details.length) {
        details.push("No night action caused an elimination or prevented one.");
    }

    return details;

}

function shouldRecordNightModeratorDetail(detail) {
    // Voodoo retaliation already has one consolidated timeline event plus the
    // affected Werewolf's elimination event. Keep this detail on the moderator
    // update without repeating it again in the saved game timeline.
    return !/voodoo doll (?:redirected|retaliated)/i.test(detail);
}

function drawAlphaConversionSignal(player) {
    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <h3>Alpha Wolf conversion</h3>
        <div class="moderatorPanel">
            Walk once around the group, then quietly tap ${escapeHTML(player.name)} to tell them they are now a Werewolf. Keep everyone else's eyes closed.
        </div>
        <button class="actionContinue" type="button" data-click="finishAlphaConversionSignal(${players.indexOf(player)})">Continue ➜</button>
    `;
}

function finishAlphaConversionSignal(playerIndex) {
    const player = players[playerIndex];
    if (player) player.alphaConversionSignalPending = false;
    drawDayOne();
}

