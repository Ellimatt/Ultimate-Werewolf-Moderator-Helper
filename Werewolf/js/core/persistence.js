// Game serialization, restore, undo, and saved setup persistence.

function serializePlayer(player) {

    return {
        ...player,
        connectedToIndex: players.indexOf(player.connectedTo),
        doppelgangerTargetIndex: players.indexOf(player.doppelgangerTarget),
        lastLeftNeighborIndex: players.indexOf(player.lastLeftNeighbor),
        lastRightNeighborIndex: players.indexOf(player.lastRightNeighbor),
        roleModelIndex: players.indexOf(player.roleModel),
        butcherRedirectTargetIndex: players.indexOf(player.butcherRedirectTarget),
        watchedPlayerTonightIndex: players.indexOf(player.watchedPlayerTonight),
        lastProtectedPlayerIndex: players.indexOf(player.lastProtectedPlayer),
        lastBarricadedPlayerIndex: players.indexOf(player.lastBarricadedPlayer),
        lastVoodooPlayerIndex: players.indexOf(player.lastVoodooPlayer),
        lastMagistratePlayerIndex: players.indexOf(player.lastMagistratePlayer),
        lastWatchedPlayerIndex: players.indexOf(player.lastWatchedPlayer),
        petOwnerIndex: players.indexOf(player.petOwner),
        guardianWardIndex: players.indexOf(player.guardianWard),
        guardianIndex: players.indexOf(player.guardian),
        exposedPlayerTonightIndex: players.indexOf(player.exposedPlayerTonight),
        exposedByTonightIndex: players.indexOf(player.exposedByTonight),
        oracleUnresolvedWolfIndex: players.indexOf(player.oracleUnresolvedWolf),
        connectedTo: undefined,
        doppelgangerTarget: undefined,
        lastLeftNeighbor: undefined,
        lastRightNeighbor: undefined,
        roleModel: undefined,
        butcherRedirectTarget: undefined,
        watchedPlayerTonight: undefined
        ,lastProtectedPlayer: undefined
        ,lastBarricadedPlayer: undefined
        ,lastVoodooPlayer: undefined
        ,lastMagistratePlayer: undefined
        ,lastWatchedPlayer: undefined
        ,petOwner: undefined
        ,guardianWard: undefined
        ,guardian: undefined
        ,exposedPlayerTonight: undefined
        ,exposedByTonight: undefined
        ,oracleUnresolvedWolf: undefined
    };

}

function serializeActionItem(item) {

    return {
        ...item,
        actorIndex: players.indexOf(item.actor),
        actor: undefined
    };

}

function captureFormState() {

    return [...document.querySelectorAll("input, select, textarea")].map((control, index) => ({
        index,
        value: control.value,
        checked: control.checked
    }));

}

function captureScreenHTML() {

    const screenCopy = document.getElementById("screen").cloneNode(true);
    screenCopy.querySelectorAll(".screenBackButton").forEach(button => button.remove());
    return screenCopy.innerHTML;

}

function getSavedSetups() {
    try {
        const saved = JSON.parse(localStorage.getItem(savedSetupsStorageKey));
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function writeSavedSetups(setups) {
    localStorage.setItem(savedSetupsStorageKey, JSON.stringify(setups));
}

function encodeSavedSetupName(name) {
    return encodeURIComponent(name).replace(/'/g, "%27");
}

function promptToSaveGameSetup() {
    document.querySelector(".appModalOverlay")?.remove();
    const savingLoadout = currentScreen === "roles";
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal" role="dialog" aria-modal="true" aria-labelledby="saveSetupTitle">
        <h2 id="saveSetupTitle">${savingLoadout ? "Save Role Loadout" : "Save Game Setup"}</h2>
        <p>Enter a name for this role setup. Player names will not be saved.</p>
        <input id="savedSetupName" type="text" maxlength="60" placeholder="Loadout name" aria-label="Loadout name">
        <div class="modalActions"><button type="button" data-modal-cancel>Cancel</button><button type="button" data-click="saveNamedGameSetup()">${savingLoadout ? "Save Loadout" : "Save Game"}</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => overlay.remove());
    const input = overlay.querySelector("#savedSetupName");
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") saveNamedGameSetup();
    });
    input.focus();
}

function saveNamedGameSetup() {
    const input = document.getElementById("savedSetupName");
    const name = input?.value.trim();
    if (!name) {
        alert("Please enter a game name.");
        return;
    }
    const setup = {
        name,
        minimumPlayers: players.length,
        roleCounts: Object.fromEntries(
            roles.filter(role => Number(role.count) > 0).map(role => [role.role, Number(role.count)])
        ),
        savedAt: Date.now()
    };
    const setups = getSavedSetups();
    const existingIndex = setups.findIndex(saved => saved.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) setups[existingIndex] = setup;
    else setups.push(setup);
    writeSavedSetups(setups);
    document.querySelector(".appModalOverlay")?.remove();
    showAppAlert(`Saved “${name}” for a minimum of ${players.length} players.`);
}

function showSavedGames() {
    document.querySelector(".appModalOverlay")?.remove();
    const setups = getSavedSetups().sort((a, b) => a.name.localeCompare(b.name));
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="savedGamesTitle">
        <h2 id="savedGamesTitle">Saved Games</h2>
        <p>Load a role setup without changing the current player names.</p>
        <div class="savedSetupList">${setups.length ? setups.map(setup => `
            <div class="savedSetupRow">
                <span><strong>${escapeHTML(setup.name)}</strong><small>Minimum ${Number(setup.minimumPlayers) || 0} players</small></span>
                <span><button type="button" data-click="loadSavedGameSetup('${encodeSavedSetupName(setup.name)}')">Load</button><button type="button" class="dangerButton" data-click="deleteSavedGameSetup('${encodeSavedSetupName(setup.name)}')">Delete</button></span>
            </div>`).join("") : "<p>No game setups have been saved yet.</p>"}</div>
        <div class="modalActions"><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", activateModal(overlay, close));
}

function loadSavedGameSetup(encodedName) {
    const name = decodeURIComponent(encodedName);
    const setup = getSavedSetups().find(saved => saved.name === name);
    if (!setup) return;
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: Object.entries(setup.roleCounts || {}).reduce((total, [savedName, count]) =>
            canonicalRoleName(savedName) === role.role ? total + (Number(count) || 0) : total, 0) +
            (role.role === "Sorceress" ? (Number(setup.roleCounts?.Sorcerer) || 0) : 0)
    }));
    const additionalPlayers = Math.max(0, players.length - (Number(setup.minimumPlayers) || 0));
    const villager = roles.find(role => role.role === "Villager");
    if (villager) villager.count += additionalPlayers;
    document.querySelector(".appModalOverlay")?.remove();
    drawRoleScreen();
    if (players.length < Number(setup.minimumPlayers)) {
        showAppAlert(`${name} requires at least ${setup.minimumPlayers} players. Add ${setup.minimumPlayers - players.length} more player${setup.minimumPlayers - players.length === 1 ? "" : "s"}.`);
    }
}

function deleteSavedGameSetup(encodedName) {
    const name = decodeURIComponent(encodedName);
    showAppConfirmation(`Delete the saved game “${name}”?`, () => {
        writeSavedSetups(getSavedSetups().filter(saved => saved.name !== name));
        showSavedGames();
    });
}

function buildGameState() {

    const state = {
        currentScreen,
        players: players.map(serializePlayer),
        roles,
        nightOneWakeOrder,
        nightOneCurrentRole,
        nightOneActionOrder: nightOneActionOrder.map(serializeActionItem),
        nightOneCurrentAction,
        nightOneActionMode,
        nightOneDeferredActions: nightOneDeferredActions.map(serializeActionItem),
        resolvingNightOneDeferredActions,
        isLaterNight,
        savedVoteCount,
        wolvesDisabledNextNight,
        wolvesDisabledTonight,
        wolfEliminationsTonight,
        bloodWolfBypassesProtectionTonight,
        currentNight,
        currentDay,
        leftoverCardRole,
        thingCardRole,
        resumeMorningAfterSpecialResolution,
        roleSearchTerm,
        eliminationSequence,
        roleSortMode,
        roleTeamFilter,
        roleValueFilter,
        roleSelectedOnly,
        ignoreWinConditions,
        gameResultContinuation,
        gameResultMessage,
        phaseHistory,
        dayEliminationVoteOccurred,
        nightTargetRecords,
        lastActionDescription,
        roleRuleSettings,
        gameSettings,
        screenHTML: captureScreenHTML(),
        formState: captureFormState()
    };

    // Undo must be a true point-in-time snapshot. Player attack arrays, the
    // timeline, and queued actions continue changing after this function runs.
    return JSON.parse(JSON.stringify(state));

}

function saveGameState() {

    if (persistenceDisabled) {
        localStorage.removeItem(savedGameStorageKey);
        return;
    }

    const screen = document.getElementById("screen");

    if (!screen) {
        return;
    }

    const state = buildGameState();

    lastSavedGameState = state;
    updateBackButton();
    updateModeratorChrome();

    try {
        localStorage.setItem(savedGameStorageKey, JSON.stringify({
            saveVersion: savedGameVersion,
            current: state,
            back: backSavedGameStates.at(-1) || null,
            history: backSavedGameStates
        }));
    } catch (error) {
        console.error("Could not save the current game:", error);
    }

}

function scheduleGameSave() {

    clearTimeout(saveGameTimer);
    saveGameTimer = setTimeout(saveGameState, 0);

}

function restoreSavedGame() {

    let savedData;

    try {
        savedData = JSON.parse(localStorage.getItem(savedGameStorageKey));
    } catch (error) {
        console.error("Could not restore the saved game:", error);
        localStorage.removeItem(savedGameStorageKey);
        return false;
    }

    savedData = migrateSavedGame(savedData);
    if (!savedData) {
        localStorage.removeItem(savedGameStorageKey);
        return false;
    }

    const state = savedData?.current || savedData;

    if (!state || !Array.isArray(state.players) || typeof state.screenHTML !== "string") {
        return false;
    }

    lastSavedGameState = state;
    backSavedGameStates = savedData?.current ?
        (Array.isArray(savedData.history) ? savedData.history : (savedData.back ? [savedData.back] : [])) : [];

    players = state.players.map(savedPlayer => {
        const restoredPlayer = { ...savedPlayer };
        delete restoredPlayer.connectedToIndex;
        delete restoredPlayer.doppelgangerTargetIndex;
        delete restoredPlayer.lastLeftNeighborIndex;
        delete restoredPlayer.lastRightNeighborIndex;
        delete restoredPlayer.roleModelIndex;
        delete restoredPlayer.butcherRedirectTargetIndex;
        delete restoredPlayer.watchedPlayerTonightIndex;
        delete restoredPlayer.lastProtectedPlayerIndex;
        delete restoredPlayer.lastBarricadedPlayerIndex;
        delete restoredPlayer.lastVoodooPlayerIndex;
        delete restoredPlayer.lastMagistratePlayerIndex;
        delete restoredPlayer.lastWatchedPlayerIndex;
        delete restoredPlayer.petOwnerIndex;
        delete restoredPlayer.guardianWardIndex;
        delete restoredPlayer.guardianIndex;
        delete restoredPlayer.exposedPlayerTonightIndex;
        delete restoredPlayer.exposedByTonightIndex;
        delete restoredPlayer.oracleUnresolvedWolfIndex;
        return restoredPlayer;
    });
    state.players.forEach((savedPlayer, index) => {
        players[index].connectedTo = players[savedPlayer.connectedToIndex] || null;
        players[index].doppelgangerTarget = players[savedPlayer.doppelgangerTargetIndex] || null;
        players[index].lastLeftNeighbor = players[savedPlayer.lastLeftNeighborIndex] || null;
        players[index].lastRightNeighbor = players[savedPlayer.lastRightNeighborIndex] || null;
        players[index].roleModel = players[savedPlayer.roleModelIndex] || null;
        players[index].butcherRedirectTarget = players[savedPlayer.butcherRedirectTargetIndex] || null;
        players[index].watchedPlayerTonight = players[savedPlayer.watchedPlayerTonightIndex] || null;
        players[index].lastProtectedPlayer = players[savedPlayer.lastProtectedPlayerIndex] || null;
        players[index].lastBarricadedPlayer = players[savedPlayer.lastBarricadedPlayerIndex] || null;
        players[index].lastVoodooPlayer = players[savedPlayer.lastVoodooPlayerIndex] || null;
        players[index].lastMagistratePlayer = players[savedPlayer.lastMagistratePlayerIndex] || null;
        players[index].lastWatchedPlayer = players[savedPlayer.lastWatchedPlayerIndex] || null;
        players[index].petOwner = players[savedPlayer.petOwnerIndex] || null;
        players[index].guardianWard = players[savedPlayer.guardianWardIndex] || null;
        players[index].guardian = players[savedPlayer.guardianIndex] || null;
        players[index].exposedPlayerTonight = players[savedPlayer.exposedPlayerTonightIndex] || null;
        players[index].exposedByTonight = players[savedPlayer.exposedByTonightIndex] || null;
        players[index].oracleUnresolvedWolf = players[savedPlayer.oracleUnresolvedWolfIndex] || null;
    });
    // Older saves could copy Doppelganger identity metadata into a Martyr who
    // inherited the Doppelganger's current role. The Martyr receives the role,
    // not the original player's Doppelganger identity or pending choice.
    players.forEach(player => {
        if (player.martyrUsed && player.role !== "Doppelganger" && player.isDoppelganger) {
            player.isDoppelganger = false;
            player.doppelgangerTarget = null;
            player.doppelgangerInheritedRole = null;
        }
    });

    const savedRoleCounts = new Map();
    (Array.isArray(state.roles) ? state.roles : []).forEach(role => {
        const roleName = canonicalRoleName(role.role);
        savedRoleCounts.set(roleName, (savedRoleCounts.get(roleName) || 0) + (Number(role.count) || 0));
    });
    roles = originalRoleDefinitions.map(role => ({
        ...role,
        count: (savedRoleCounts.get(role.role) || 0) +
            (role.role === "Sorceress" ? (savedRoleCounts.get("Sorcerer") || 0) : 0)
    }));
    currentScreen = state.currentScreen || "players";
    nightOneWakeOrder = (state.nightOneWakeOrder || []).map(role => ({ ...role, role: canonicalRoleName(role.role) }));
    nightOneCurrentRole = Number(state.nightOneCurrentRole) || 0;
    nightOneActionOrder = (state.nightOneActionOrder || []).map(item => ({
        ...item,
        role: item.role ? { ...item.role, role: canonicalRoleName(item.role.role) } : item.role,
        actor: players[item.actorIndex]
    }));
    nightOneCurrentAction = Number(state.nightOneCurrentAction) || 0;
    nightOneActionMode = state.nightOneActionMode ?? null;
    nightOneDeferredActions = (state.nightOneDeferredActions || []).map(item => ({
        ...item,
        role: item.role ? { ...item.role, role: canonicalRoleName(item.role.role) } : item.role,
        actor: players[item.actorIndex]
    }));
    resolvingNightOneDeferredActions = state.resolvingNightOneDeferredActions === true;
    isLaterNight = state.isLaterNight === true;
    savedVoteCount = Number(state.savedVoteCount) || 0;
    wolvesDisabledNextNight = state.wolvesDisabledNextNight === true;
    wolvesDisabledTonight = state.wolvesDisabledTonight === true;
    wolfEliminationsTonight = Number(state.wolfEliminationsTonight) || 1;
    bloodWolfBypassesProtectionTonight = state.bloodWolfBypassesProtectionTonight === true;
    currentNight = Number.isFinite(Number(state.currentNight)) ? Number(state.currentNight) : 1;
    currentDay = Number(state.currentDay) || 0;
    leftoverCardRole = state.leftoverCardRole ? {
        ...state.leftoverCardRole,
        role: canonicalRoleName(state.leftoverCardRole.role)
    } : null;
    thingCardRole = state.thingCardRole ? {
        ...state.thingCardRole,
        role: canonicalRoleName(state.thingCardRole.role)
    } : null;
    resumeMorningAfterSpecialResolution = state.resumeMorningAfterSpecialResolution === true;
    roleSearchTerm = state.roleSearchTerm || "";
    eliminationSequence = Number(state.eliminationSequence) || 0;
    roleSortMode = state.roleSortMode || "alphabetical-asc";
    roleTeamFilter = state.roleTeamFilter || "all";
    roleValueFilter = state.roleValueFilter || "all";
    roleSelectedOnly = state.roleSelectedOnly === true;
    ignoreWinConditions = state.ignoreWinConditions === true;
    gameResultContinuation = state.gameResultContinuation || null;
    gameResultMessage = state.gameResultMessage || null;
    phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
    sanitizePhaseHistory();
    dayEliminationVoteOccurred = state.dayEliminationVoteOccurred === true;
    nightTargetRecords = Array.isArray(state.nightTargetRecords) ? state.nightTargetRecords : [];
    roleRuleSettings = pickKnownSettings(defaultRoleRuleSettings, state.roleRuleSettings);
    gameSettings = pickKnownSettings(defaultGameSettings, state.gameSettings);
    lastActionDescription = state.lastActionDescription || "the last action";

    if (currentScreen === "roles") {
        drawRoleScreen();
    } else {
        document.getElementById("screen").innerHTML = state.screenHTML;
    }
    (currentScreen === "roles" ? [] : (state.formState || [])).forEach(savedControl => {
        const control = document.querySelectorAll("input, select, textarea")[savedControl.index];
        if (control) {
            control.value = savedControl.value;
            control.checked = savedControl.checked;
        }
    });

    const playerNameInput = document.getElementById("playerName");
    if (playerNameInput) {
        playerNameInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addPlayer();
            }
        });
    }

    updateBackButton();

    return true;

}

function goBackOneScreen() {

    if (!backSavedGameStates.length) {
        return;
    }

    showAppConfirmation(
        `Undo ${lastActionDescription}? You will return to the previous screen and must perform it again.`,
        restorePreviousScreen
    );

}

function restorePreviousScreen() {

    const stateToRestore = backSavedGameStates.pop();
    if (!stateToRestore) {
        return;
    }
    try {
        restoringPreviousScreen = true;
        clearTimeout(saveGameTimer);
        localStorage.setItem(savedGameStorageKey, JSON.stringify({
            saveVersion: savedGameVersion,
            current: stateToRestore,
            back: backSavedGameStates.at(-1) || null,
            history: backSavedGameStates
        }));
        window.location.reload();
    } catch (error) {
        restoringPreviousScreen = false;
        console.error("Could not return to the previous screen:", error);
    }

}

function startGamePersistence() {

    const screen = document.getElementById("screen");
    const observer = new MutationObserver(() => {
        updateModeratorChrome();
        scheduleGameSave();
    });
    observer.observe(screen, { childList: true, subtree: true, characterData: true });
    screen.addEventListener("input", scheduleGameSave);
    screen.addEventListener("change", scheduleGameSave);
    screen.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (
            !button ||
            button.classList.contains("screenBackButton") ||
            button.classList.contains("preserveUndoSnapshot") ||
            button.disabled ||
            ["Vote", "Cancel Vote"].includes(button.textContent.trim())
        ) {
            return;
        }

        const label = button.textContent.trim().replace(/\s+/g, " ");
        lastActionDescription = describeActionForUndo(label);
        backSavedGameStates.push(buildGameState());
        if (backSavedGameStates.length > 25) backSavedGameStates.shift();
        updateBackButton();
    }, true);
    window.addEventListener("beforeunload", () => {
        if (!restoringPreviousScreen) {
            saveGameState();
        }
    });
    scheduleGameSave();

}

function describeActionForUndo(label) {
    const action = nightOneActionOrder[nightOneCurrentAction];
    const roleName = action?.role?.role;
    if (roleName && /^(Continue|Next|Take action|Do not take action|Turn the)/i.test(label)) {
        return `${moderatorRoleName(roleName)}'s current action`;
    }
    if (/Eliminate/i.test(label)) return "this elimination";
    if (/Spare/i.test(label)) return "this Spare vote";
    if (/Skip to Night/i.test(label)) return `ending Day ${currentDay}`;
    return label ? `“${label}”` : "the last action";
}


// ============================================================
// LOAD ROLE DATABASE
// ============================================================


