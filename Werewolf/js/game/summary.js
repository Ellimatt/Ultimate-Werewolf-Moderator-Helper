// Results, summaries, downloads, and game reset flow.

function drawGameResult(message, continuation = null, reviewOnly = false) {

    if (!reviewOnly) {
        gameResultContinuation = continuation;
        gameResultMessage = message;
    }
    sanitizePhaseHistory();

    const livingPlayers = players.filter(player => player.alive);
    const deadPlayers = players
        .filter(player => !player.alive)
        .sort((first, second) =>
            Number(first.deathOrder || Number.MAX_SAFE_INTEGER) -
            Number(second.deathOrder || Number.MAX_SAFE_INTEGER)
        );
    const resultPhase = continuation === "morning" ? `Night ${currentNight}` :
        (["day", "postVote"].includes(continuation) ? `Day ${currentDay}` : null);
    const unannouncedPlayers = deadPlayers.filter(player => !player.deathAnnounced);
    const newlyEliminatedPlayers = unannouncedPlayers.length ? unannouncedPlayers :
        (resultPhase ? deadPlayers.filter(player => player.deathPhase === resultPhase) : []);
    const livingRows = livingPlayers.length ? livingPlayers.map(player => `
        <li>
            <strong>${escapeHTML(player.name)}</strong> —
            ${escapeHTML(summaryRoleName(player))}
        </li>
    `).join("") : "<li>None</li>";
    const eliminatedRosterRows = deadPlayers.length ? deadPlayers.map(player => `
        <li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(summaryRoleName(player))}</li>
    `).join("") : "<li>None</li>";
    const finalEliminationRows = newlyEliminatedPlayers.map(player => `
        <li>${readAloud(`${player.name} was eliminated by ${resultPhase?.startsWith("Night ") ? publicNightEliminationCause(player) : (player.deathCause || "an unknown cause")}.`)}</li>
    `).join("");
    const continuedWinRows = phaseHistory
        .filter(event => event.type === "continued-win")
        .map(event => `<li>${escapeHTML(event.text)}</li>`)
        .join("");
    const deadGroups = [];

    deadPlayers.forEach(player => {
        const phase = player.deathPhase || "Unknown phase";
        let group = deadGroups.find(currentGroup => currentGroup.phase === phase);

        if (!group) {
            group = { phase, players: [] };
            deadGroups.push(group);
        }

        group.players.push(player);
    });

    const deadRows = deadGroups.length ? deadGroups.map(group => `
        <h3>${escapeHTML(group.phase)}</h3>
        <ul>
            ${group.players.map(player => `
                <li>
                    <strong>${escapeHTML(player.name)}</strong> —
                    ${escapeHTML(summaryRoleName(player))} —
                    ${escapeHTML(player.deathCause || "Unknown cause")}
                </li>
            `).join("")}
        </ul>
    `).join("") : "<p>No players were eliminated.</p>";
    const timelinePhases = [...new Set([
        ...phaseHistory.map(event => event.phase),
        ...deadPlayers.map(player => player.deathPhase || "Unknown phase"),
        ...(reviewOnly && currentDay > 0 ? [`Day ${currentDay}`] : [])
    ])].sort((first, second) => {
        const firstMatch = /^(Night|Day) (\d+)$/.exec(first);
        const secondMatch = /^(Night|Day) (\d+)$/.exec(second);
        if (!firstMatch || !secondMatch) {
            return first.localeCompare(second);
        }
        const numberDifference = Number(firstMatch[2]) - Number(secondMatch[2]);
        return numberDifference || (firstMatch[1] === "Night" ? -1 : 1);
    });
    const timelineRows = timelinePhases.length ? timelinePhases.map(phase => {
        const events = phaseHistory.filter(event => event.phase === phase);
        const recordedDeathOrders = new Set();
        const displayedEventTexts = new Set();
        let eventRows = events.map(event => {
            let displayText = event.text;
            if (event.key?.startsWith("elimination-")) {
                const order = Number(event.key.replace("elimination-", ""));
                recordedDeathOrders.add(order);
                const player = deadPlayers.find(candidate => candidate.deathOrder === order);
                if (player) {
                    displayText = `${player.name} was eliminated by ${player.deathCause || "an unknown cause"}.`;
                }
            }
            if (displayedEventTexts.has(displayText)) {
                return "";
            }
            displayedEventTexts.add(displayText);
            return `<li>${escapeHTML(displayText)}</li>`;
        }).join("");
        eventRows += deadPlayers
            .filter(player =>
                (player.deathPhase || "Unknown phase") === phase &&
                !recordedDeathOrders.has(player.deathOrder)
            )
            .map(player => `<li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(summaryRoleName(player))} — ${escapeHTML(player.deathCause || "Unknown cause")}</li>`)
            .join("");
        const emptyPhaseText = reviewOnly && phase === `Day ${currentDay}` ?
            "<li>Day in progress; no elimination vote has been completed.</li>" :
            "<li>No recorded events.</li>";
        return `<h3>${escapeHTML(phase)}</h3><ul>${eventRows || emptyPhaseText}</ul>`;
    }).join("") : "<p>No game events were recorded.</p>";

    document.getElementById("screen").innerHTML = `
        ${reviewOnly ? "" : `<h2>Game Over</h2>${finalEliminationRows ? `<div class="infoCallout"><strong>Just Eliminated</strong><ul>${finalEliminationRows}</ul></div>` : ""}<p>${readAloud(message)}</p><hr>`}
        <h2>Game Summary</h2>
        ${continuedWinRows ? `<div class="infoCallout"><strong>Continued after a win</strong><ul>${continuedWinRows}</ul></div>` : ""}
        <h3>Still Alive</h3>
        <ul>${livingRows}</ul>
        <h3>Eliminated</h3>
        <ul>${eliminatedRosterRows}</ul>
        <h3>Full Game Timeline</h3>
        ${timelineRows}
        ${reviewOnly ? `<button type="button" data-click="drawDayOnePlayers()">Return to Day ${currentDay}</button>` : `
            ${continuation ? `<button type="button" data-click="continueGame()">Continue Game</button>` : ""}
            <button type="button" data-click="promptToSaveGameSetup()">Save Game</button>
            <button type="button" data-click="newGame()">New Game</button>
        `}
        <button type="button" data-click="downloadGameSummary()">Download Summary (.txt)</button>
    `;

}

function drawCurrentGameSummary() {

    currentScreen = "summaryReview";
    drawGameResult("", null, true);

}

function buildGameSummaryText() {

    sanitizePhaseHistory();
    const livingPlayers = players.filter(player => player.alive);
    const deadPlayers = players
        .filter(player => !player.alive)
        .sort((first, second) =>
            Number(first.deathOrder || Number.MAX_SAFE_INTEGER) -
            Number(second.deathOrder || Number.MAX_SAFE_INTEGER)
        );
    const phases = [...new Set([
        ...phaseHistory.map(event => event.phase),
        ...deadPlayers.map(player => player.deathPhase || "Unknown phase")
    ])].sort((first, second) => {
        const firstMatch = /^(Night|Day) (\d+)$/.exec(first);
        const secondMatch = /^(Night|Day) (\d+)$/.exec(second);
        if (!firstMatch || !secondMatch) {
            return first.localeCompare(second);
        }
        const numberDifference = Number(firstMatch[2]) - Number(secondMatch[2]);
        return numberDifference || (firstMatch[1] === "Night" ? -1 : 1);
    });
    const lines = [
        "Ultimate Werewolf Assistant — Game Summary",
        "",
        "Still Alive",
        ...(livingPlayers.length ? livingPlayers.map(player =>
            `${player.name} - ${summaryRoleName(player)}`
        ) : ["None"]),
        "",
        "Eliminated",
        ...(deadPlayers.length ? deadPlayers.map(player =>
            `${player.name} - ${summaryRoleName(player)}`
        ) : ["None"]),
        "",
        "Full Game Timeline"
    ];

    phases.forEach(phase => {
        lines.push("", phase);
        const events = phaseHistory.filter(event => event.phase === phase);
        const recordedOrders = new Set();
        const writtenEventTexts = new Set();
        events.forEach(event => {
            let displayText = event.text;
            if (event.key?.startsWith("elimination-")) {
                const order = Number(event.key.replace("elimination-", ""));
                recordedOrders.add(order);
                const player = deadPlayers.find(candidate => candidate.deathOrder === order);
                if (player) {
                    displayText = `${player.name} was eliminated by ${player.deathCause || "an unknown cause"}.`;
                }
            }
            if (!writtenEventTexts.has(displayText)) {
                writtenEventTexts.add(displayText);
                lines.push(displayText);
            }
        });
        deadPlayers.filter(player =>
            (player.deathPhase || "Unknown phase") === phase &&
            !recordedOrders.has(player.deathOrder)
        ).forEach(player => {
            lines.push(`${player.name} - ${summaryRoleName(player)} - ${player.deathCause || "Unknown cause"}`);
        });
    });

    return lines.join("\r\n");

}

function downloadGameSummary() {

    const blob = new Blob([buildGameSummaryText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `werewolf-game-summary-day-${Math.max(currentDay, 1)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

}

function continueGame() {

    const continuation = gameResultContinuation;
    const wonDuringPhase = continuation === "morning" ? `Night ${currentNight}` : `Day ${currentDay}`;
    recordPhaseEvent(
        wonDuringPhase,
        `A win condition was reached (${gameResultMessage || "game won"}), but the moderator chose to continue the game.`,
        `continued-win-${Date.now()}`,
        { type: "continued-win", result: "continued" }
    );
    ignoreWinConditions = true;
    gameResultContinuation = null;

    if (continuation === "morning") {
        players.forEach(player => {
            if (!player.alive && !player.deathAnnounced) {
                player.deathAnnounced = true;
            }
        });
        drawDayOnePlayers();
        return;
    }

    if (continuation === "postVote") {
        drawEveryoneGoToSleep();
        return;
    }

    drawDayOnePlayers();

}

function endGame() {

    showAppConfirmation("End this game and clear its saved progress?", completeEndGame);

}

function completeEndGame() {

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }

    persistenceDisabled = true;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameStates = [];
    updateBackButton();
    gameResultContinuation = null;
    gameResultMessage = null;
    drawGameResult("The moderator ended the game.");

}

function newGame() {

    persistenceDisabled = false;
    clearTimeout(saveGameTimer);
    saveGameTimer = null;
    restoringPreviousScreen = false;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameStates = [];
    updateBackButton();

    players = players.map(player => ({
        id: player.id,
        name: player.name,
        role: null,
        alive: true,
        connectedTo: null
    }));
    const selectedRoleCounts = new Map(
        roles.map(role => [role.role, Math.max(0, Number(role.count) || 0)])
    );
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: selectedRoleCounts.get(role.role) || 0
    }));
    currentScreen = "players";
    nightOneWakeOrder = [];
    nightOneActionOrder = [];
    nightOneCurrentRole = 0;
    nightOneCurrentAction = 0;
    nightOneActionMode = null;
    isLaterNight = false;
    savedVoteCount = 0;
    nightTargetRecords = [];
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;
    wolfEliminationsTonight = 1;
    bloodWolfBypassesProtectionTonight = false;
    currentNight = 1;
    currentDay = 0;
    leftoverCardRole = null;
    thingCardRole = null;
    resumeMorningAfterSpecialResolution = false;
    roleSearchTerm = "";
    eliminationSequence = 0;
    roleSortMode = "alphabetical-asc";
    roleTeamFilter = "all";
    roleValueFilter = "all";
    roleSelectedOnly = false;
    ignoreWinConditions = false;
    gameResultContinuation = null;
    phaseHistory = [];
    dayEliminationVoteOccurred = false;
    lastActionDescription = "the last action";
    gameResultMessage = null;

    drawPlayerScreen();
    updateWakeLock();

}


