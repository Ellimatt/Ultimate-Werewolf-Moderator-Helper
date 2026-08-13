// ============================================================
// ULTIMATE WEREWOLF ASSISTANT
// ============================================================

let currentScreen = "players";
let players = [];
let roles = [];
let originalRoleDefinitions = [];


// ============================================================
// NIGHT ONE STATE
// ============================================================

let nightOneWakeOrder = [];
let nightOneCurrentRole = 0;

let nightOneActionOrder = [];
let nightOneCurrentAction = 0;
let nightOneActionMode = null;
let isLaterNight = false;
let savedVoteCount = 0;
let wolvesDisabledNextNight = false;
let wolvesDisabledTonight = false;
let wolfEliminationsTonight = 1;
let currentNight = 1;
let currentDay = 0;
let leftoverCardRole = null;
let resumeMorningAfterSpecialResolution = false;
let roleSearchTerm = "";
let eliminationSequence = 0;
let roleSortMode = "alphabetical-asc";
let ignoreWinConditions = false;
let gameResultContinuation = null;
let phaseHistory = [];
let dayEliminationVoteOccurred = false;
const savedGameStorageKey = "ultimateWerewolfAssistant.savedGame";
const savedGameVersion = 3;
let persistenceDisabled = false;
let saveGameTimer = null;
let lastSavedGameState = null;
let backSavedGameState = null;
let restoringPreviousScreen = false;

// ============================================================
// INITIALIZE APP
// ============================================================

document.addEventListener("DOMContentLoaded", async function () {

    await Promise.all([loadRoles(), loadActions()]);

    if (!restoreSavedGame()) {
        drawPlayerScreen();
    }

    startGamePersistence();

});

function serializePlayer(player) {

    return {
        ...player,
        connectedToIndex: players.indexOf(player.connectedTo),
        doppelgangerTargetIndex: players.indexOf(player.doppelgangerTarget),
        lastLeftNeighborIndex: players.indexOf(player.lastLeftNeighbor),
        lastRightNeighborIndex: players.indexOf(player.lastRightNeighbor),
        connectedTo: undefined,
        doppelgangerTarget: undefined,
        lastLeftNeighbor: undefined,
        lastRightNeighbor: undefined
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

function updateBackButton() {

    const screen = document.getElementById("screen");
    const existingButtons = [...screen.querySelectorAll(".screenBackButton")];

    if (!backSavedGameState || ["players", "roles", "confirmation", "vote", "summaryReview"].includes(currentScreen)) {
        existingButtons.forEach(button => button.remove());
        return;
    }

    const actionButton = [...screen.querySelectorAll("button")].find(button =>
        button.textContent.trim().toLowerCase().startsWith("continue")
    ) || [...screen.querySelectorAll("button")].find(button =>
        /^(Take action|Turn the|Save|Start|Return|Next|Skip)/i.test(button.textContent.trim())
    ) || [...screen.querySelectorAll("button")].at(-1);

    if (!actionButton) {
        existingButtons.forEach(button => button.remove());
        return;
    }

    if (
        existingButtons.length === 1 &&
        existingButtons[0].nextElementSibling === actionButton
    ) {
        return;
    }

    existingButtons.forEach(button => button.remove());
    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "backButton screenBackButton";
    backButton.textContent = "← Back";
    backButton.addEventListener("click", goBackOneScreen);
    actionButton.insertAdjacentElement("beforebegin", backButton);

}

function updateModeratorChrome() {

    const phaseHeader = document.getElementById("phaseHeader");
    const inActiveGame = currentNight > 0 && players.some(player => player.role);

    if (phaseHeader) {
        phaseHeader.hidden = !inActiveGame;
        if (inActiveGame) {
            const visibleHeading = document.querySelector("#screen h2")?.textContent || "";
            const isNight = visibleHeading.includes("Night");
            const isDay = !isNight && (currentScreen === "day1" || visibleHeading.includes("Day"));
            const phase = isDay ? `☀️ Day ${currentDay}` : `🌙 Night ${currentNight}`;
            const alive = players.filter(player => player.alive).length;
            const progress = !isDay && nightOneActionOrder.length ?
                ` • Action ${Math.min(nightOneCurrentAction + 1, nightOneActionOrder.length)}/${nightOneActionOrder.length}` :
                isDay ? ` • ${savedVoteCount} of 3 Spare votes` : "";
            phaseHeader.textContent = `${phase}${progress} • ${alive} Alive`;
        }
    }

    document.body.classList.toggle("dayTheme", inActiveGame &&
        !document.querySelector("#screen h2")?.textContent.includes("Night") &&
        document.querySelector("#screen h2")?.textContent.includes("Day"));
    document.body.classList.toggle("nightTheme", inActiveGame && !document.body.classList.contains("dayTheme"));

    document.querySelectorAll("#screen h3").forEach(heading => {
        if (heading.textContent.trim() === "Moderator details") {
            heading.classList.add("moderatorHeading");
            heading.nextElementSibling?.classList.add("moderatorPanel");
        }
    });

    document.querySelectorAll("#screen button").forEach(button => {
        const label = button.textContent.trim();
        if (/^(Continue|Start Day|Start Night|Next)/i.test(label)) {
            button.classList.add("primaryAction");
        }
        if (["Eliminate", "Kick", "Finish Game", "Remove All Players", "Remove All Roles"].some(text => label.includes(text))) {
            button.classList.add("dangerButton");
        }
    });

}

function showAppConfirmation(message, onConfirm) {

    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `
        <div class="appModal" role="dialog" aria-modal="true" aria-labelledby="appModalTitle">
            <h2 id="appModalTitle">Are you sure?</h2>
            <p>${escapeHTML(message)}</p>
            <div class="modalActions">
                <button type="button" data-modal-cancel>Cancel</button>
                <button type="button" class="dangerButton" data-modal-confirm>Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => overlay.remove());
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => {
        overlay.remove();
        onConfirm();
    });
    overlay.querySelector("[data-modal-cancel]").focus();

}

function showAppAlert(message) {

    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `
        <div class="appModal" role="alertdialog" aria-modal="true" aria-labelledby="appAlertTitle">
            <h2 id="appAlertTitle">Moderator note</h2>
            <p>${escapeHTML(message)}</p>
            <div class="modalActions">
                <button type="button" data-modal-ok>OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const okButton = overlay.querySelector("[data-modal-ok]");
    okButton.addEventListener("click", () => overlay.remove());
    okButton.focus();

}

window.alert = showAppAlert;

function buildGameState() {

    return {
        currentScreen,
        players: players.map(serializePlayer),
        roles,
        nightOneWakeOrder,
        nightOneCurrentRole,
        nightOneActionOrder: nightOneActionOrder.map(serializeActionItem),
        nightOneCurrentAction,
        nightOneActionMode,
        isLaterNight,
        savedVoteCount,
        wolvesDisabledNextNight,
        wolvesDisabledTonight,
        wolfEliminationsTonight,
        currentNight,
        currentDay,
        leftoverCardRole,
        resumeMorningAfterSpecialResolution,
        roleSearchTerm,
        eliminationSequence,
        roleSortMode,
        ignoreWinConditions,
        gameResultContinuation,
        phaseHistory,
        dayEliminationVoteOccurred,
        screenHTML: captureScreenHTML(),
        formState: captureFormState()
    };

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
            back: backSavedGameState
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

    if (savedData?.saveVersion && savedData.saveVersion > savedGameVersion) {
        localStorage.removeItem(savedGameStorageKey);
        return false;
    }

    const state = savedData?.current || savedData;

    if (!state || !Array.isArray(state.players) || typeof state.screenHTML !== "string") {
        return false;
    }

    lastSavedGameState = state;
    backSavedGameState = savedData?.current ? savedData.back || null : null;

    players = state.players.map(savedPlayer => {
        const restoredPlayer = { ...savedPlayer };
        delete restoredPlayer.connectedToIndex;
        delete restoredPlayer.doppelgangerTargetIndex;
        delete restoredPlayer.lastLeftNeighborIndex;
        delete restoredPlayer.lastRightNeighborIndex;
        return restoredPlayer;
    });
    state.players.forEach((savedPlayer, index) => {
        players[index].connectedTo = players[savedPlayer.connectedToIndex] || null;
        players[index].doppelgangerTarget = players[savedPlayer.doppelgangerTargetIndex] || null;
        players[index].lastLeftNeighbor = players[savedPlayer.lastLeftNeighborIndex] || null;
        players[index].lastRightNeighbor = players[savedPlayer.lastRightNeighborIndex] || null;
    });

    roles = Array.isArray(state.roles) ? state.roles : roles;
    currentScreen = state.currentScreen || "players";
    nightOneWakeOrder = state.nightOneWakeOrder || [];
    nightOneCurrentRole = Number(state.nightOneCurrentRole) || 0;
    nightOneActionOrder = (state.nightOneActionOrder || []).map(item => ({
        ...item,
        actor: players[item.actorIndex]
    }));
    nightOneCurrentAction = Number(state.nightOneCurrentAction) || 0;
    nightOneActionMode = state.nightOneActionMode ?? null;
    isLaterNight = state.isLaterNight === true;
    savedVoteCount = Number(state.savedVoteCount) || 0;
    wolvesDisabledNextNight = state.wolvesDisabledNextNight === true;
    wolvesDisabledTonight = state.wolvesDisabledTonight === true;
    wolfEliminationsTonight = Number(state.wolfEliminationsTonight) || 1;
    currentNight = Number(state.currentNight) || 1;
    currentDay = Number(state.currentDay) || 0;
    leftoverCardRole = state.leftoverCardRole || null;
    resumeMorningAfterSpecialResolution = state.resumeMorningAfterSpecialResolution === true;
    roleSearchTerm = state.roleSearchTerm || "";
    eliminationSequence = Number(state.eliminationSequence) || 0;
    roleSortMode = state.roleSortMode || "alphabetical-asc";
    ignoreWinConditions = state.ignoreWinConditions === true;
    gameResultContinuation = state.gameResultContinuation || null;
    phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
    sanitizePhaseHistory();
    dayEliminationVoteOccurred = state.dayEliminationVoteOccurred === true;

    document.getElementById("screen").innerHTML = state.screenHTML;
    (state.formState || []).forEach(savedControl => {
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

    if (!backSavedGameState) {
        return;
    }

    showAppConfirmation(
        "The last action will be undone and must be performed again.",
        restorePreviousScreen
    );

}

function restorePreviousScreen() {

    const stateToRestore = backSavedGameState;
    if (!stateToRestore) {
        return;
    }
    backSavedGameState = null;

    try {
        restoringPreviousScreen = true;
        clearTimeout(saveGameTimer);
        localStorage.setItem(savedGameStorageKey, JSON.stringify({
            saveVersion: savedGameVersion,
            current: stateToRestore,
            back: null
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
            button.disabled ||
            ["Vote", "Cancel Vote"].includes(button.textContent.trim())
        ) {
            return;
        }

        backSavedGameState = buildGameState();
        updateBackButton();
    }, true);
    window.addEventListener("beforeunload", () => {
        if (!restoringPreviousScreen) {
            saveGameState();
        }
    });
    scheduleGameSave();

}


// ============================================================
// LOAD ROLE DATABASE
// ============================================================

async function loadRoles() {

    try {

        const response = await fetch("Data/roles.json");

        if (!response.ok) {
            throw new Error(
                `Could not load Data/roles.json (${response.status})`
            );
        }

        roles = await response.json();

        roles.forEach(role => {
            role.count = 0;
        });
        originalRoleDefinitions = roles.map(role => ({ ...role }));

    } catch (error) {

        console.error("Could not load roles.json:", error);

        roles = [];

    }

}


// ============================================================
// PLAYER SCREEN
// ============================================================

function drawPlayerScreen() {

    currentScreen = "players";

    const screen = document.getElementById("screen");

    if (!screen) {
        return;
    }

    let html = `
        <h2>Players</h2>
    `;


    // ========================================================
    // EXISTING PLAYERS
    // ========================================================

    players.forEach((player, index) => {

        html += `

            <div class="playerRow">

                <span>
                    ${escapeHTML(player.name)}
                </span>

                <button
                    type="button"
                    onclick="removePlayer(${index})"
                >
                    ❌
                </button>

            </div>

        `;

    });


    // ========================================================
    // ADD PLAYER
    // ========================================================

    html += `

        <div style="margin-top:20px;">

            <input
                id="playerName"
                type="text"
                placeholder="Player Name"
                autocomplete="off"
            >

        </div>

        <div style="margin-top:10px;">

            <button
                type="button"
                onclick="addPlayer()"
            >
                ➕ Add Player
            </button>

            <button
                type="button"
                onclick="drawRoleScreen()"
            >
                Next ➜
            </button>

        </div>

        ${players.length ? `
            <div style="margin-top:18px;">
                <button type="button" onclick="removeAllPlayers()">Remove All Players</button>
            </div>
        ` : ""}

    `;


    screen.innerHTML = html;


    // ========================================================
    // ENTER KEY
    // ========================================================

    const input = document.getElementById("playerName");

    if (input) {

        input.focus();

        input.addEventListener("keydown", function (event) {

            if (event.key === "Enter") {

                event.preventDefault();

                addPlayer();

            }

        });

    }

}


// ============================================================
// ADD PLAYER
// ============================================================

function addPlayer() {

    const input = document.getElementById("playerName");

    if (!input) {
        return;
    }

    const name = input.value.trim();

    if (name === "") {

        input.focus();

        return;

    }


    players.push({

        id: Date.now() + Math.random(),

        name: name,

        role: null,

        alive: true,

        connectedTo: null

    });


    drawPlayerScreen();

}


// ============================================================
// REMOVE PLAYER
// ============================================================

function removePlayer(index) {

    if (
        index < 0 ||
        index >= players.length
    ) {
        return;
    }

    players.splice(index, 1);

    drawPlayerScreen();

}

function removeAllPlayers() {

    if (!players.length) {
        return;
    }
    showAppConfirmation("Remove every player from the list?", () => {
        players = [];
        drawPlayerScreen();
    });

}


// ============================================================
// ROLE SCREEN
// ============================================================

function drawRoleScreen() {

    currentScreen = "roles";

    let html = `
        <h2>Roles in Game</h2>
        <div class="roleToolbar">
            <input
                id="roleSearch"
                class="roleSearch"
                type="search"
                placeholder="Search roles"
                aria-label="Search roles"
                value="${escapeHTML(roleSearchTerm)}"
                oninput="filterRoleList(this.value)"
            >
            <select aria-label="Sort roles" onchange="setRoleSortMode(this.value)">
                <option value="alphabetical-asc" ${roleSortMode === "alphabetical-asc" ? "selected" : ""}>A–Z</option>
                <option value="alphabetical-desc" ${roleSortMode === "alphabetical-desc" ? "selected" : ""}>Z–A</option>
                <option value="value-asc" ${roleSortMode === "value-asc" ? "selected" : ""}>Value: Low–High</option>
                <option value="value-desc" ${roleSortMode === "value-desc" ? "selected" : ""}>Value: High–Low</option>
            </select>
        </div>
        <p id="noRoleSearchResults" style="display:none;">No matching roles found.</p>
    `;


    if (roles.length === 0) {

        html += `

            <p>
                No roles were loaded.
            </p>

            <button
                type="button"
                onclick="drawPlayerScreen()"
            >
                ⬅ Back
            </button>

        `;

        document.getElementById("screen").innerHTML = html;

        return;

    }


    roles
        .map((role, index) => ({ role, index }))
        .sort(compareRoleEntries)
        .forEach(({ role, index }) => {

        html += `

            <div class="playerRow roleOption" data-role-name="${escapeHTML(role.role.toLowerCase())}">

                <span>
                    ${escapeHTML(role.role)}
                    <span class="roleValue">${Number(role.value) >= 0 ? "+" : ""}${Number(role.value) || 0}</span>
                </span>

                <div>

                    <button
                        type="button"
                        onclick="changeRole(${index}, -1)"
                    >
                        -
                    </button>

                    <strong style="padding:0 10px;">
                        ${role.count}
                    </strong>

                    <button
                        type="button"
                        onclick="changeRole(${index}, 1)"
                    >
                        +
                    </button>

                </div>

            </div>

        `;

    });


    const cards = getTotalCards();
    const requiredCards = getRequiredCardCount();
    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );

    const balance = getBalance();


    html += `

        <hr>

        <h3>
            Players: ${players.length}
        </h3>

        <h3>
            Cards Selected:
            ${cards}
            ${cards === requiredCards ? "✅" : "❌"}
        </h3>

        <h3>
            Balance: ${balance}
        </h3>

        ${drunkIsSelected ? `
            <p style="color:${cards === requiredCards ? "#8fda8f" : "#ff8f8f"}; font-size:.9rem;">
                ${cards === requiredCards ?
                    "Drunk is in play. The extra card has been selected." :
                    "Drunk is in play. Select one extra card."}
            </p>
        ` : ""}

        <br>

        <button type="button" onclick="removeAllRoles()">
            Remove All Roles
        </button>

        <button
            type="button"
            onclick="drawPlayerScreen()"
        >
            ⬅ Back
        </button>

        <button
            type="button"
            onclick="drawGameConfirmation()"
            ${cards !== requiredCards ? "disabled" : ""}
        >
            Next ➜
        </button>

    `;


    document.getElementById("screen").innerHTML = html;
    filterRoleList(roleSearchTerm);

}

function compareRoleEntries(first, second) {

    const alphabeticalComparison = first.role.role.localeCompare(
        second.role.role,
        undefined,
        { sensitivity: "base" }
    );

    if (roleSortMode === "alphabetical-desc") {
        return -alphabeticalComparison;
    }

    if (roleSortMode === "value-asc") {
        return Number(first.role.value) - Number(second.role.value) || alphabeticalComparison;
    }

    if (roleSortMode === "value-desc") {
        return Number(second.role.value) - Number(first.role.value) || alphabeticalComparison;
    }

    return alphabeticalComparison;

}

function setRoleSortMode(sortMode) {

    const validModes = [
        "alphabetical-asc",
        "alphabetical-desc",
        "value-asc",
        "value-desc"
    ];

    roleSortMode = validModes.includes(sortMode) ? sortMode : "alphabetical-asc";
    drawRoleScreen();

}


// ============================================================
// CHANGE ROLE
// ============================================================

function changeRole(index, amount) {

    if (!roles[index]) {
        return;
    }

    roles[index].count += amount;

    const canHaveMultiple = ["Villager", "Mason", "Werewolf"].includes(
        roles[index].role
    );

    if (!canHaveMultiple && roles[index].count > 1) {
        roles[index].count = 1;
    }

    if (roles[index].count < 0) {
        roles[index].count = 0;
    }

    drawRoleScreen();

}


// ============================================================
// TOTAL CARDS
// ============================================================

function getTotalCards() {

    let total = 0;

    roles.forEach(role => {

        total += Number(role.count) || 0;

    });

    return total;

}


// ============================================================
// BALANCE
// ============================================================

function getBalance() {

    let total = 0;

    roles.forEach(role => {

        total +=
            (Number(role.value) || 0) *
            (Number(role.count) || 0);

    });

    return total;

}


// ============================================================
// GAME CONFIRMATION
// ============================================================

function drawGameConfirmation() {

    currentScreen = "confirmation";

    const totalCards = getTotalCards();
    const requiredCards = getRequiredCardCount();

    const totalValue = getBalance();
    const automaticWinMessage = getPossibleSetupAutomaticWin();
    const setupWarnings = [];
    const selectedRoles = roles.filter(role => Number(role.count) > 0);
    const hasEliminationWolf = selectedRoles.some(role =>
        role.team === "Werewolf" && !["Minion", "Sorceress"].includes(role.role)
    );
    if (!hasEliminationWolf) {
        setupWarnings.push("No elimination-capable Werewolf is selected.");
    }
    if (Math.abs(totalValue) >= 10) {
        setupWarnings.push(`The card-value balance is ${totalValue}, so this setup may strongly favor one team.`);
    }
    if (selectedRoles.some(role => role.role === "Drunk") && totalCards !== players.length + 1) {
        setupWarnings.push("The Drunk requires one extra role card.");
    }
    const setupWarningHTML = setupWarnings.length ? `
        <div class="setupWarnings">
            <h3>Setup notes</h3>
            <ul>${setupWarnings.map(warning => `<li>${escapeHTML(warning)}</li>`).join("")}</ul>
        </div>
    ` : "";


    // ========================================================
    // COUNT TEAMS
    // ========================================================

    const teams = {};

    roles.forEach(role => {

        if (role.count > 0) {

            const team = role.team || "Unknown";

            if (!teams[team]) {
                teams[team] = 0;
            }

            teams[team] += role.count;

        }

    });


    // ========================================================
    // TEAM HTML
    // ========================================================

    let teamHTML = "";

    Object.entries(teams).forEach(([team, count]) => {

        teamHTML += `

            <div class="playerRow">

                <span>
                    ${escapeHTML(team)}
                </span>

                <strong>
                    ${count}
                </strong>

            </div>

        `;

    });


    // ========================================================
    // ROLE HTML
    // ========================================================

    let roleHTML = "";

    roles.forEach(role => {

        if (role.count > 0) {

            roleHTML += `

                <div class="playerRow">

                    <span>
                        ${escapeHTML(role.role)}
                    </span>

                    <strong>
                        × ${role.count}
                    </strong>

                </div>

            `;

        }

    });


    // ========================================================
    // CONFIRMATION SCREEN
    // ========================================================

    document.getElementById("screen").innerHTML = `

        <h2>Confirm Game</h2>

        <p>
            Review the game before starting.
        </p>

        <hr>

        <h3>Game Summary</h3>

        <div class="playerRow">
            <span>Players</span>
            <strong>${players.length}</strong>
        </div>

        <div class="playerRow">
            <span>Cards Selected</span>
            <strong>
                ${totalCards} / ${requiredCards}
            </strong>
        </div>

        <div class="playerRow">
            <span>Total Value</span>
            <strong>${totalValue}</strong>
        </div>

        <hr>

        <h3>Teams</h3>

        ${teamHTML}

        <hr>

        <h3>Roles</h3>

        ${roleHTML}

        ${automaticWinMessage ? `<p style="color:#ff9b9b;">${escapeHTML(automaticWinMessage)}</p>` : ""}
        ${setupWarningHTML}

        <hr>

        <button
            type="button"
            onclick="drawRoleScreen()"
        >
            ⬅ Back
        </button>

        <button
            type="button"
            onclick="startNightOne()"
            ${totalCards !== requiredCards || automaticWinMessage ? "disabled" : ""}
        >
            🌙 Start Night 1
        </button>

    `;

}

// ============================================================
// NIGHT ONE - SETUP
// ============================================================

function startNightOne() {

    isLaterNight = false;
    currentNight = 1;
    currentDay = 0;
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;

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

    if (drunkIsSelected && !leftoverCardRole) {
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
            count: Number(role.count) - (leftoverCardRole?.role === role.role ? 1 : 0)
        }))

        .filter(role => role.count > 0)

        .filter(role =>
            String(role.role).toLowerCase() !== "villager"
        )

        .sort((a, b) =>
            Number(a.priority) - Number(b.priority)
        );

    if (leftoverCardRole && leftoverCardRole.role !== "Villager") {
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

    nightOneCurrentRole = 0;


    // ========================================================
    // SHOW FIRST ROLE
    // ========================================================

    drawNightRole();

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
        .filter(role => role.role !== "Drunk" && Number(role.count) > 0)
        .map(role => `<option value="${escapeHTML(role.role)}">${escapeHTML(role.role)}</option>`)
        .join("");

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night 1</h2>
        <h2>Leftover Card</h2>
        <p>Which role card was left over after dealing?</p>
        <select id="leftoverCardRole">
            <option value="">Select the leftover card</option>
            ${options}
        </select>
        <button class="actionContinue" type="button" onclick="confirmLeftoverCard()">Continue ➜</button>
    `;

}

function confirmLeftoverCard() {

    const select = document.getElementById("leftoverCardRole");
    const selectedRole = roles.find(role => role.role === select?.value);

    if (!selectedRole || selectedRole.role === "Drunk" || Number(selectedRole.count) < 1) {
        alert("Please select the leftover role card.");
        return;
    }

    const automaticWinMessage = getSetupAutomaticWin(selectedRole.role);
    if (automaticWinMessage) {
        alert(automaticWinMessage);
        drawRoleScreen();
        return;
    }

    leftoverCardRole = selectedRole;
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


        drawDayOne();

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

    if (role.mockLeftoverAction) {
        document.getElementById("screen").innerHTML = `
            <h2>🌙 Night ${currentNight}</h2>
            <hr>
            <h2>${readAloud(`${moderatorRoleName(role.role)}, wake up.`)}</h2>
            ${role.question === "N/A" ? "" : `<p>${readAloud(role.question)}</p>`}
            <button type="button" onclick="advanceNightRole()">Go to Sleep</button>
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
            ${readAloud(`${moderatorRoleName(role.role)}, wake up.`)}
        </h2>

        <p>
            Who is the ${escapeHTML(role.role)}?
        </p>

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

            <p>
                Select all ${role.count}
                ${escapeHTML(role.role)}s.
            </p>

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
            onclick="confirmNightRole()"
        >
            Next ➜
        </button>

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
        "Prince"
    ];

    return !!role &&
        role.action !== "N/A" &&
        (isLaterNight || !["KillPlayer", "NightKill", "WitchChoice", "RevealPlayer"].includes(role.action)) &&
        (isLaterNight || !["ConvertPlayer", "ProtectPlayer"].includes(role.action)) &&
        !passiveActions.includes(role.action) &&
        isValidAction(role.action);

}

function getRequiredCardCount() {

    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );

    return players.length + (drunkIsSelected ? 1 : 0);

}

function getSetupAutomaticWin(leftoverRoleName = null) {

    let werewolfTeamCount = 0;
    let villagerTeamCount = 0;
    let mayorCount = 0;
    let nonMayorVillagerCount = 0;
    let eliminationWolfCount = 0;

    roles.forEach(role => {
        const dealtCount = Math.max(
            0,
            Number(role.count) - (role.role === leftoverRoleName ? 1 : 0)
        );

        if (role.team === "Werewolf") {
            werewolfTeamCount += dealtCount;

            if (!["Minion", "Sorceress"].includes(role.role)) {
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

    if (nonMayorVillagerCount > 0) {
        villagerTeamCount += mayorCount;
    }

    const leftoverRole = roles.find(role => role.role === leftoverRoleName);
    if (
        leftoverRole?.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(leftoverRole.role)
    ) {
        eliminationWolfCount++;
    }

    if (eliminationWolfCount === 0) {
        return "The Villagers would win automatically because no elimination-capable Werewolf would be dealt.";
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

function startNightOneActions(role) {

    nightOneActionOrder = [];
    nightOneActionMode = null;

    if (
        !hasNightOneAction(role)
    ) {
        advanceNightRole();
        return;
    }

    players
        .filter(player =>
            player.role === role.role &&
            player.alive &&
            !(role.oncePerGame && player.usedOncePerGameAction)
        )
        .slice(
            0,
            ["KillPlayer", "RevealGroup"].includes(role.action) ? 1 : undefined
        )
        .forEach(actor => {
            nightOneActionOrder.push({ role, actor });
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

    if (!action) {
        nightOneCurrentAction++;
        drawNightAction();
        return;
    }

    const targetCount = getNightActionTargetCount(item);
    let availablePlayers = players.filter(player =>
        player.alive &&
        (["ProtectPlayer", "LinkPlayers"].includes(item.role.action) || player !== item.actor)
    );

    if (item.role.action === "ProtectPlayer") {
        availablePlayers = availablePlayers.filter(player =>
            player !== item.actor.lastProtectedPlayer
        );
    }

    if (item.role.action === "KillPlayer") {
        availablePlayers = availablePlayers.filter(player =>
            !canChooseWerewolfElimination(player) &&
            !player.wolfTargetTonight
        );
    }

    if (item.role.action === "ConvertPlayer") {
        availablePlayers = availablePlayers.filter(player => player.wolfTargetTonight);
    }

    if (item.role.action === "WitchChoice" && nightOneActionMode === "save") {
        availablePlayers = availablePlayers.filter(player => player.attackedTonight);
    }

    if (["WitchChoice", "NightKill", "BlessPlayer", "ConvertPlayer"].includes(item.role.action) && !nightOneActionMode) {
        drawOptionalNightAction(item);
        return;
    }

    if (
        targetCount === 0 &&
        ["BecomeSeer", "ChangeTeams"].includes(item.role.action)
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
        drawNightActionResult(item, [item.actor.doppelgangerTarget]);
        return;
    }

    let html = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(isSecondWolfTarget ? "Werewolves, choose your second target." : `${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        <p>${readAloud(isSecondWolfTarget ? "Whom would you like as your second elimination target?" :
            item.role.action === "Hear" ? "Choose your two neighbors to learn whether either took an action tonight." : item.role.question)}</p>
    `;

    if (targetCount === 1) {

        html += `<select id="nightActionTarget"${item.role.action === "Investigate" ? ' onchange="updateNeighborAvailability()"' : ""}>
            <option value="">Select Player</option>
            <option value="nobody">Nobody</option>
        `;

        availablePlayers.forEach(player => {
            const index = players.indexOf(player);
            html += `<option value="${index}">${escapeHTML(player.name)}</option>`;
        });

        html += `</select>`;

        if (item.role.action === "Investigate") {
            html += drawNeighborSelectors(availablePlayers, "P.I.");
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

    if (item.role.action === "Hear") {
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
        <button class="actionContinue" type="button" onclick="confirmNightAction()">Continue ➜</button>
    `;

    document.getElementById("screen").innerHTML = html;

}

function nightActionHasVisibleResult(actionName) {

    return [
        "RevealWerewolves",
        "BecomeSeer",
        "ChangeTeams",
        "RevealAlignment",
        "RevealRole",
        "RevealPlayer",
        "RevealTeam",
        "RevealGroup",
        "CompareTeams",
        "Investigate",
        "Hear",
        "CopyRole"
    ].includes(actionName);

}

function recordPhaseEvent(phase, text, key = null) {

    if (!phase || !text) {
        return;
    }

    const eventKey = key || `${phase}:${text}`;
    if (phaseHistory.some(event => event.key === eventKey)) {
        return;
    }

    phaseHistory.push({ phase, text, key: eventKey });

}

function sanitizePhaseHistory() {

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
        }
    }

    recordPhaseEvent(
        `Night ${currentNight}`,
        result,
        `night-action-${currentNight}-${nightOneCurrentAction}-${item.role.role}`
    );

}

function confirmNightAction() {

    const item = nightOneActionOrder[nightOneCurrentAction];
    const targetCount = getNightActionTargetCount(item);
    let targets = [];

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

    if (item.role.action === "Hear") {
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
        } else {
            targets[0].attackedTonight = true;
            targets[0].pendingDeathCause = "Witch attack";
            targets[0].pendingDeathPhase = `Night ${currentNight}`;
        }
    }

    executeAction(item.role.action, item.actor, targets);
    recordNightActionEvent(item, targets);
    item.actor.tookActionTonight = true;

    if (item.role.oncePerGame) {
        item.actor.usedOncePerGameAction = true;
    }

    if (item.role.action === "ProtectPlayer") {
        item.actor.lastProtectedPlayer = targets[0];
    }

    if (item.role.action === "KillPlayer") {
        players
            .filter(player => player.alive && canChooseWerewolfElimination(player))
            .forEach(player => {
                player.tookActionTonight = true;
            });
    }

    drawNightActionResult(item, targets);

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
        "RevealAlignment",
        "RevealRole",
        "CompareTeams",
        "Investigate",
        "Hear"
    ].includes(
        item.role.action
    );
    const question = includeQuestion ?
        `<p>${readAloud(item.role.question)}</p>` : "";
    const inspectedPlayer = targets[0];
    const inspectionAppearsAs = roles.find(role =>
        role.role === inspectedPlayer?.role
    )?.appearsAs || inspectedPlayer?.team || "Villager";
    const signalIsUp = item.role.action === "BecomeSeer" ?
        item.actor.becameSeerTonight :
        item.role.action === "ChangeTeams" ?
            item.actor.becameWerewolfTonight :
        item.role.action === "RevealRole" ?
            inspectedPlayer?.role === "Seer" :
        item.role.action === "CompareTeams" ?
            targets[0]?.team === targets[1]?.team :
        item.role.action === "Investigate" ?
            [inspectedPlayer, ...(item.neighbors || [])].some(player => player?.team === "Werewolf") :
        item.role.action === "Hear" ?
            (item.neighbors || []).some(player => player?.tookActionTonight) :
            inspectionAppearsAs === "Werewolf";
    const signalText = item.role.action === "RevealAlignment" ?
        readAloud("Thumbs up means Werewolf. Thumbs down means not a Werewolf.") :
        item.role.action === "RevealRole" ?
            readAloud(`${signalIsUp ? "Seer" : "Not the Seer"}.`) :
        item.role.action === "CompareTeams" ?
            readAloud(`${signalIsUp ? "Same team" : "Different teams"}.`) :
        item.role.action === "Investigate" ?
            readAloud(`${signalIsUp ? "Werewolf" : "Not a Werewolf"}.`) :
        item.role.action === "Hear" ?
            readAloud(signalIsUp ? "Thumbs up: at least one neighbor took an action." : "Thumbs down: neither neighbor took an action.") :
        `Signal: ${signalIsUp ? "Thumbs up" : "Thumbs down"}`;
    const isLargePrivateReveal = item.role.action === "RevealTeam" ||
        (item.role.action === "CopyRole" && isLaterNight);
    const signal = item.skipped ? `<p>${readAloud("No action was taken.")}</p>` : isLargePrivateReveal ? `
        <div class="privateRoleReveal">${escapeHTML(result)}</div>
    ` : isSignalAction ? `
        <p style="font-size:3rem; margin:12px 0;">${signalIsUp ? "👍" : "👎"}</p>
        <p>${signalText}</p>
    ` : `<p>${readAloud(result)}</p>`;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${includeQuestion ? readAloud(`${moderatorRoleName(item.role.role)}, wake up.`) : escapeHTML(moderatorRoleName(item.role.role))}</h2>
        ${question}
        ${signal}
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" onclick="advanceNightAction()">Continue ➜</button>
    `;

}

function getNightActionResult(item, targets) {

    const target = targets[0];

    if (item.skipped) {
        return "No action taken.";
    }

    switch (item.role.action) {

        case "RevealWerewolves":
            return `Werewolves: ${players.filter(player => player.team === "Werewolf").map(player => player.name).join(", ") || "None"}`;

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
            return target.role === "Seer" ?
                `${target.name} is the Seer.` :
                `${target.name} is not the Seer.`;

        case "RevealPlayer":
            item.actor.usedOncePerGameAction = true;
            if (target.team === "Werewolf") {
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
            return `${target.name}'s role is ${target.role || "Villager"}.`;

        case "CompareTeams":
            return targets[0].team === targets[1].team ? "They are on the same team." : "They are on different teams.";

        case "RevealGroup":
            return `${item.role.role}s: ${players.filter(player => player.role === item.role.role).map(player => player.name).join(", ")}.`;

        case "CopyRole":
            if (!isLaterNight) {
                return `${target.name} selected.`;
            }

            return target.alive ?
                "Doppelganger, this is your role: Doppelganger." :
                `Doppelganger, this is your role: ${target.role}.`;

        case "ConnectToPlayer":
            return `${item.actor.name} is connected to ${target.name}.`;

        case "LinkPlayers":
            return `${targets[0].name} and ${targets[1].name} are linked.`;

        case "ProtectPlayer":
        case "BlessPlayer":
            return `${target.name} is permanently protected from Werewolf attacks.`;

        case "SilencePlayer":
            return `${target.name} is silenced for the next day.`;

        case "ConvertPlayer":
            return `${target.name} is now on the Werewolf team.`;

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
            Wait a few extra seconds before continuing, even if the player immediately goes back to sleep. This keeps it unclear whether the ability has already been used.
        </div>
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" onclick="advanceNightAction()">Continue ➜</button>
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
        <button type="button" onclick="setNightActionMode('save')">👍 Save</button>
        <button type="button" onclick="setNightActionMode('kill')">👎 Eliminate</button>
        <button type="button" onclick="setNightActionMode('skip')">Do nothing</button>
    ` : item.role.action === "ConvertPlayer" ? `
        <button type="button" onclick="setNightActionMode('take')">Turn the Werewolves' target</button>
        <button type="button" onclick="setNightActionMode('skip')">Do not turn the Werewolves' target</button>
    ` : `
        <button type="button" onclick="setNightActionMode('take')">Take action</button>
        <button type="button" onclick="setNightActionMode('skip')">Do not take action</button>
    `;

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
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
        <button type="button" onclick="${callbackName}()">Continue</button>
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

        if (role.role === "Seer") {
            player.isOriginalSeer = true;
        }

        if (role.role === "Drunk") {
            player.isOriginalDrunk = true;
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

function startNextNight() {

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }

    isLaterNight = true;
    currentNight = Math.max(currentNight, currentDay) + 1;
    savedVoteCount = 0;
    dayEliminationVoteOccurred = false;
    nightOneActionMode = null;
    nightOneActionOrder = [];
    wolfEliminationsTonight = players.some(player =>
        player.role === "Wolf Cub" &&
        !player.alive &&
        !player.wolfCubBonusGranted
    ) ? 2 : 1;

    if (wolfEliminationsTonight === 2) {
        players
            .filter(player => player.role === "Wolf Cub" && !player.alive)
            .forEach(player => {
                player.wolfCubBonusGranted = true;
            });
    }
    wolvesDisabledTonight = wolvesDisabledNextNight;
    wolvesDisabledNextNight = false;

    players.forEach(player => {
        player.attackedTonight = false;
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
        player.becameSeerTonight = false;
        });

    const drunkCardReveal = currentNight === 3 ? transformDrunk() : null;

    roles
        .filter(role =>
            role.wake === "Every" &&
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
                        canChooseWerewolfElimination(player) :
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

    if (
        drunkCardReveal &&
        hasNightOneAction(drunkCardReveal.role) &&
        (drunkCardReveal.role.wake === "1" || drunkCardReveal.role.action === "CopyRole")
    ) {
        nightOneActionOrder.unshift({
            role: drunkCardReveal.role,
            actor: drunkCardReveal.drunk
        });
    }

    nightOneCurrentAction = 0;

    if (drunkCardReveal) {
        drawDrunkCardReveal(drunkCardReveal);
        return;
    }

    drawNightAction();

}

function filterRoleList(searchText) {

    const searchTerm = String(searchText || "").trim().toLowerCase();
    roleSearchTerm = String(searchText || "");
    const roleOptions = Array.from(document.querySelectorAll(".roleOption"));
    let visibleCount = 0;

    roleOptions.forEach(option => {
        const matches = option.dataset.roleName.includes(searchTerm);
        option.style.display = matches ? "flex" : "none";
        visibleCount += matches ? 1 : 0;
    });

    const noResults = document.getElementById("noRoleSearchResults");
    if (noResults) {
        noResults.style.display = visibleCount === 0 ? "block" : "none";
    }

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
        <p>${readAloud(`Your card is ${reveal.role.role}.`)}</p>
        <button class="actionContinue" type="button" onclick="continueNightAfterDrunkCard()">Continue ➜</button>
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

    if (wolvesDisabledTonight && wolfTargets.length) {
        details.push(
            `The Werewolves targeted ${wolfTargets.map(player => player.name).join(", ")}, ` +
            "but the attack did not count because the Diseased was eliminated by the Werewolves the previous night."
        );
    }

    players.filter(player =>
        player.wolfTargetTonight && player.blessedAgainstWerewolves
    ).forEach(player => {
        details.push(
            `${player.name} was targeted by the Werewolves but survived because of the Priest's permanent blessing.`
        );
    });

    players.filter(player => player.protected && player.attackedTonight).forEach(player => {
        const protectionSource = player.protectionCauseTonight || "a protective action";
        details.push(`${player.name} was attacked but survived because of ${protectionSource}.`);
    });

    players.filter(player => player.becameWerewolfTonight).forEach(player => {
        details.push(`${player.name} was attacked as the Cursed and became a Werewolf instead of being eliminated.`);
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
        !player.protected
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

function drawDayOne() {

    const isResumingMorning = resumeMorningAfterSpecialResolution;
    resumeMorningAfterSpecialResolution = false;

    if (!isResumingMorning) {
        currentDay = currentNight;

        const diseasedKilledByWolves = players.some(player =>
            player.role === "Diseased" &&
            player.wolfAttackCountsTonight &&
            !player.protected
        );

        players.forEach(player => {
            if (player.toughGuyDeathPending) {
                recordElimination(
                    player,
                    `Tough Guy delayed death${player.toughGuyDeathCause ? ` (${player.toughGuyDeathCause})` : ""}`,
                    `Night ${currentNight}`
                );
                player.toughGuyDeathPending = false;
            }
        });

        players.forEach(player => {
            if (player.attackedTonight && !player.protected) {
                if (player.role === "Tough Guy") {
                    player.toughGuyDeathPending = true;
                    player.toughGuyDeathCause = player.pendingDeathCause;
                    player.attackedTonight = false;
                    player.attackedByWolvesTonight = false;
                } else {
                    recordElimination(
                        player,
                        player.pendingDeathCause || "Night attack",
                        player.pendingDeathPhase || `Night ${currentNight}`
                    );
                }
            }
        });

        if (diseasedKilledByWolves) {
            wolvesDisabledNextNight = true;
        }
    }

    const nightBomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved
    );

    if (nightBomber) {
        nightBomber.resolveDuringMorning = true;
        drawMadBomberResolution(nightBomber);
        return;
    }

    const directlyEliminated = players.filter(player =>
        !player.alive || (player.attackedTonight && !player.protected)
    );

    let newlyEliminated = directlyEliminated;

    while (newlyEliminated.length) {
        newlyEliminated = players.filter(player =>
            player.alive &&
            newlyEliminated.includes(player.connectedTo)
        );

        newlyEliminated.forEach(player => {
            recordElimination(
                player,
                player.connectionType === "cupid" ? "Cupid lover" : "Dire Wolf connection",
                `Night ${currentNight}`
            );
        });
    }

    const connectedNightBomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved
    );

    if (connectedNightBomber) {
        connectedNightBomber.resolveDuringMorning = true;
        drawMadBomberResolution(connectedNightBomber);
        return;
    }

    const nightHunter = players.find(player =>
        !player.alive &&
        player.role === "Hunter" &&
        !player.hunterRevengeResolved
    );

    if (nightHunter) {
        nightHunter.resolveDuringMorning = true;
        nightHunter.roleRevealed = true;
    }

    getNightModeratorDetails().forEach((detail, index) => {
        recordPhaseEvent(
            `Night ${currentNight}`,
            detail,
            `night-result-${currentNight}-${index}-${detail}`
        );
    });

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
        !nightHunter &&
        ignoreWinConditions &&
        players.every(player => !player.alive)
    ) {
        drawGameResult("All players have been eliminated.");
        return;
    }

    if (
        !nightHunter &&
        !ignoreWinConditions &&
        !livingWerewolves.some(canChooseWerewolfElimination) &&
        !hasUnrevealedEliminationWerewolfDrunk()
    ) {
        drawGameResult(
            "Villagers win! All elimination-capable Werewolves have been eliminated.",
            "morning"
        );
        return;
    }

    if (
        !nightHunter &&
        !ignoreWinConditions &&
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.length >= livingVillagerParityCount
    ) {
        drawGameResult(
            "Werewolves win! They now equal or outnumber the Villager team.",
            "morning"
        );
        return;
    }

    const eliminated = players.filter(player =>
        (!player.alive || (player.attackedTonight && !player.protected)) &&
        !player.deathAnnounced
    );
    const silenced = players.filter(player => player.silenced);
    const exiled = players.filter(player => player.exiledTonight);
    const statusRows = [
        ["Left the village", exiled],
        ["Silenced", silenced]
    ].filter(([, affectedPlayers]) => affectedPlayers.length)
        .map(([label, affectedPlayers]) =>
            `<p>${readAloud(`${label}: ${affectedPlayers.map(player => player.name).join(", ")}.`)}</p>`
        ).join("");
    const eliminationRows = eliminated.map(player =>
        `<p>${readAloud(`Eliminated: ${player.name} — ${player.deathCause || player.pendingDeathCause || "Night attack"}.`)}</p>`
    ).join("");
    const summaryRows = statusRows + eliminationRows;
    const moderatorDetails = getNightModeratorDetails()
        .map(detail => `<li>${escapeHTML(detail)}</li>`)
        .join("");
    getNightModeratorDetails().forEach((detail, index) => {
        recordPhaseEvent(
            `Night ${currentNight}`,
            detail,
            `night-result-${currentNight}-${index}-${detail}`
        );
    });

    const hunterOptions = nightHunter ? players
        .filter(player => player.alive)
        .map(player => `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`)
        .join("") : "";
    const hunterControls = nightHunter ? `
        <hr>
        <h3>Hunter</h3>
        <p>${readAloud("Hunter, choose one player to eliminate, or choose nobody.")}</p>
        <select id="hunterTarget">
            <option value="">Select player</option>
            <option value="nobody">Nobody</option>
            ${hunterOptions}
        </select>
        <button class="actionContinue" type="button" onclick="resolveHunterRevenge(${players.indexOf(nightHunter)})">Continue ➜</button>
    ` : "";

    if (!nightHunter) {
        eliminated.forEach(player => {
            player.deathAnnounced = true;
        });
    }

    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <hr>
        <h3>${readAloud("Everyone, wake up and open your eyes.")}</h3>
        <hr>
        <h3>Night update</h3>
        ${summaryRows || `<p>${readAloud("Nothing happened overnight.")}</p>`}
        <h3>Moderator details</h3>
        <ul>${moderatorDetails}</ul>
        ${hunterControls || `<button type="button" onclick="drawDayOnePlayers()">Start Day ${currentDay}</button>`}
    `;

}

function drawDayOnePlayers() {

    currentScreen = "day1";


    let html = `

        <h2>☀️ Day ${currentDay}</h2>

        <p>
            The players are awake.
        </p>

        <hr>

    `;


    // ========================================================
    // PLAYER LIST
    // ========================================================

    const unavailablePlayers = players.filter(player =>
        !player.alive ||
        player.exiledTonight ||
        (player.attackedTonight && !player.protected)
    );
    const activePlayers = players.filter(player =>
        !unavailablePlayers.includes(player)
    );

    [...activePlayers, ...unavailablePlayers].forEach(player => {

        const index = players.indexOf(player);
        const unavailable = unavailablePlayers.includes(player);
        const status = !player.alive ||
            (player.attackedTonight && !player.protected) ?
            `Eliminated${player.deathCause ? ` - ${player.deathCause}` : ""}${player.deathPhase ? `, ${player.deathPhase}` : ""}` :
            "Left the village";
        const displayedRole = !player.alive ?
            `${player.roleRevealed ? "Role revealed" : "Role not revealed"} - ${player.role || "Unknown"}` :
            (player.role || "Unknown");
        const statusBadges = [
            player.team === "Werewolf" ? '<span class="statusBadge wolfBadge">🐺 Werewolf team</span>' : "",
            player.protected ? '<span class="statusBadge">🛡 Protected</span>' : "",
            player.blessedAgainstWerewolves ? '<span class="statusBadge blessedBadge">🙏 Blessed</span>' : "",
            player.silenced ? '<span class="statusBadge">🔇 Silenced</span>' : "",
            player.toughGuyDeathPending ? '<span class="statusBadge warningBadge">⏳ Delayed death</span>' : "",
            !player.alive ? '<span class="statusBadge deathBadge">💀 Eliminated</span>' : "",
            !player.alive && player.roleRevealed ? '<span class="statusBadge">👁 Role revealed</span>' : "",
            !player.alive && !player.roleRevealed ? '<span class="statusBadge">❓ Role hidden</span>' : ""
        ].filter(Boolean).join(" ");
        const voteButton = unavailable ? "" : `
            <button
                type="button"
                onclick="startVote(${index})"
            >
                Vote
            </button>
        `;

        html += `

            <div class="playerRow" style="${unavailable ? "opacity:.5; background:#444; color:#ddd;" : ""}">

                <div>

                    <strong>
                        ${escapeHTML(player.name)}${player.team === "Werewolf" ? " 🐺" : ""}
                    </strong>

                    <br>

                    <span>
                        ${escapeHTML(displayedRole)}
                    </span>

                    ${statusBadges ? `<div class="statusBadges">${statusBadges}</div>` : ""}

                    ${unavailable ? `<br><span>${status}</span>` : ""}

                </div>

                ${voteButton}

            </div>

        `;

    });


    // ========================================================
    // DAY INFORMATION
    // ========================================================

    html += `

        <hr>

        <h3>
            Day Phase
        </h3>

        <p>
            Choose a player to begin a vote.
        </p>

        <button type="button" onclick="startNextNight()">
            Skip to Night
        </button>

        <button type="button" onclick="drawCurrentGameSummary()">
            Current Game Summary
        </button>

        <button type="button" onclick="finishGame()">
            Finish Game
        </button>

    `;


    document.getElementById("screen").innerHTML = html;

}


// ============================================================
// VOTE
// ============================================================

function startVote(index) {

    const player = players[index];

    if (!player || !player.alive || player.exiledTonight) {
        return;
    }

    currentScreen = "vote";

    const eligibleVoters = players.filter(currentPlayer =>
        currentPlayer.alive && !currentPlayer.exiledTonight
    );
    const votesNeeded = Math.floor(eligibleVoters.length / 2) + 1;
    const mayor = players.find(currentPlayer =>
        currentPlayer.role === "Mayor" &&
        currentPlayer.alive &&
        !currentPlayer.exiledTonight
    );

    document.getElementById("screen").innerHTML = `
        <h2>Vote</h2>
        <p>${readAloud(`${player.name} is on trial.`)}</p>
        <p>Votes needed to eliminate: <strong>${votesNeeded}</strong></p>
        ${mayor ? `<p>Mayor: <strong>${escapeHTML(mayor.name)}</strong></p>` : ""}
        <button type="button" onclick="resolveVote(${index}, true)">Eliminate</button>
        <button type="button" onclick="resolveVote(${index}, false)">Spare</button>
        <button type="button" onclick="cancelVote()">Cancel Vote</button>
        <button type="button" onclick="kickPlayer(${index})">Kick</button>
    `;

}

function cancelVote() {

    drawDayOnePlayers();

}

function kickPlayer(index) {

    const player = players[index];

    if (!player || !player.alive) {
        return;
    }

    showAppConfirmation(
        `Are you sure you want to kick ${player.name}? ` +
        "They will be eliminated and their role will remain unrevealed.",
        () => completeKick(index)
    );

}

function completeKick(index) {

    const player = players[index];
    if (!player || !player.alive) {
        return;
    }

    recordElimination(player, "Kicked", `Day ${currentDay}`);
    player.deathAnnounced = true;
    player.roleRevealed = false;

    const winMessage = getWinMessage();

    if (winMessage) {
        drawGameResult(winMessage, ignoreWinConditions ? null : "day");
        return;
    }

    drawDayOnePlayers();

}

function resolveVote(index, eliminate) {

    if (eliminate && players[index]) {
        dayEliminationVoteOccurred = true;
        recordElimination(players[index], "Village vote", `Day ${currentDay}`);
        resolveEliminationConsequences();
        return;
    }

    savedVoteCount++;
    recordPhaseEvent(
        `Day ${currentDay}`,
        `The village spared ${players[index]?.name || "a player"}. Spare vote ${savedVoteCount} of 3.`,
        `day-spare-${currentDay}-${savedVoteCount}`
    );

    if (savedVoteCount >= 3) {
        startNextNight();
        return;
    }

    drawDayOnePlayers();

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
        });
    }

    const bomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved
    );

    if (bomber) {
        drawMadBomberResolution(bomber);
        return;
    }

    const hunter = players.find(player =>
        !player.alive &&
        player.role === "Hunter" &&
        !player.hunterRevengeResolved
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
        <h2>Mad Bomber</h2>
        <p>${readAloud("The Mad Bomber was eliminated.")}</p>
        <p>Select the players currently seated directly to the Mad Bomber's left and right, or choose nobody.</p>
        <select id="bomberTargetOne"><option value="">Current left neighbor</option>${options}</select>
        <select id="bomberTargetTwo"><option value="">Current right neighbor</option>${options}</select>
        <div class="actionButtons">
            <button type="button" onclick="resolveMadBomber(${players.indexOf(bomber)})">Continue</button>
            <button type="button" onclick="resolveMadBomber(${players.indexOf(bomber)}, true)">Nobody</button>
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
        <h2>Hunter</h2>
        <p>The Hunter was eliminated. Choose one player to eliminate.</p>
        <select id="hunterTarget">
            <option value="">Select player</option>
            <option value="nobody">Nobody</option>
            ${options}
        </select>
        <button type="button" onclick="resolveHunterRevenge(${players.indexOf(hunter)})">Continue</button>
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
        `<li>${readAloud(`${player.name} was the ${player.role || "Villager"}.`)}</li>`
    ).join("");

    newlyEliminated.forEach(player => {
        player.deathAnnounced = true;
        player.roleRevealed = true;
    });

    const winMessage = getWinMessage();

    if (winMessage) {
        drawGameResult(winMessage, ignoreWinConditions ? null : "postVote");
        return;
    }

    document.getElementById("screen").innerHTML = `
        <h2>Elimination</h2>
        <p>The following roles are revealed:</p>
        <ul>${revealRows}</ul>
        <button type="button" onclick="drawEveryoneGoToSleep()">Continue</button>
    `;

}

function drawGameResult(message, continuation = null, reviewOnly = false) {

    if (!reviewOnly) {
        gameResultContinuation = continuation;
    }
    sanitizePhaseHistory();

    const livingPlayers = players.filter(player => player.alive);
    const deadPlayers = players
        .filter(player => !player.alive)
        .sort((first, second) =>
            Number(first.deathOrder || Number.MAX_SAFE_INTEGER) -
            Number(second.deathOrder || Number.MAX_SAFE_INTEGER)
        );
    const livingRows = livingPlayers.length ? livingPlayers.map(player => `
        <li>
            <strong>${escapeHTML(player.name)}</strong> —
            ${escapeHTML(player.role || "Unknown")}
        </li>
    `).join("") : "<li>None</li>";
    const eliminatedRosterRows = deadPlayers.length ? deadPlayers.map(player => `
        <li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(player.role || "Unknown")}</li>
    `).join("") : "<li>None</li>";
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
                    ${escapeHTML(player.role || "Unknown")} —
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
            .map(player => `<li><strong>${escapeHTML(player.name)}</strong> — ${escapeHTML(player.role || "Unknown")} — ${escapeHTML(player.deathCause || "Unknown cause")}</li>`)
            .join("");
        const emptyPhaseText = reviewOnly && phase === `Day ${currentDay}` ?
            "<li>Day in progress; no elimination vote has been completed.</li>" :
            "<li>No recorded events.</li>";
        return `<h3>${escapeHTML(phase)}</h3><ul>${eventRows || emptyPhaseText}</ul>`;
    }).join("") : "<p>No game events were recorded.</p>";

    document.getElementById("screen").innerHTML = `
        ${reviewOnly ? "" : `<h2>Game Over</h2><p>${readAloud(message)}</p><hr>`}
        <h2>Game Summary</h2>
        <h3>Still Alive</h3>
        <ul>${livingRows}</ul>
        <h3>Eliminated</h3>
        <ul>${eliminatedRosterRows}</ul>
        <h3>Full Game Timeline</h3>
        ${timelineRows}
        ${reviewOnly ? `<button type="button" onclick="drawDayOnePlayers()">Return to Day ${currentDay}</button>` : `
            ${continuation ? `<button type="button" onclick="continueGame()">Continue Game</button>` : ""}
            <button type="button" onclick="newGame()">New Game</button>
        `}
        <button type="button" onclick="downloadGameSummary()">Download Summary (.txt)</button>
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
            `${player.name} - ${player.role || "Unknown"}`
        ) : ["None"]),
        "",
        "Eliminated",
        ...(deadPlayers.length ? deadPlayers.map(player =>
            `${player.name} - ${player.role || "Unknown"}`
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
            lines.push(`${player.name} - ${player.role || "Unknown"} - ${player.deathCause || "Unknown cause"}`);
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

function finishGame() {

    showAppConfirmation("Finish this game and clear its saved progress?", completeFinishGame);

}

function completeFinishGame() {

    if (currentDay > 0 && !dayEliminationVoteOccurred) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }

    persistenceDisabled = true;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameState = null;
    updateBackButton();
    gameResultContinuation = null;
    drawGameResult("The moderator ended the game.");

}

function newGame() {

    persistenceDisabled = false;
    clearTimeout(saveGameTimer);
    saveGameTimer = null;
    restoringPreviousScreen = false;
    localStorage.removeItem(savedGameStorageKey);
    lastSavedGameState = null;
    backSavedGameState = null;
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
    wolvesDisabledNextNight = false;
    wolvesDisabledTonight = false;
    wolfEliminationsTonight = 1;
    currentNight = 1;
    currentDay = 0;
    leftoverCardRole = null;
    resumeMorningAfterSpecialResolution = false;
    roleSearchTerm = "";
    eliminationSequence = 0;
    roleSortMode = "alphabetical-asc";
    ignoreWinConditions = false;
    gameResultContinuation = null;
    phaseHistory = [];
    dayEliminationVoteOccurred = false;

    drawPlayerScreen();

}

function getWinMessage() {

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
        return "Villagers win! All elimination-capable Werewolves have been eliminated.";
    }

    if (
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.length >= livingVillagerParityCount
    ) {
        return "Werewolves win! They now equal or outnumber the Villager team.";
    }

    return null;

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
        <p>${readAloud("Everyone, close your eyes.")}</p>
        <button type="button" onclick="startNextNight()">Start Night</button>
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
            `elimination-${player.deathOrder}`
        );
    }

}

function canChooseWerewolfElimination(player) {

    return player.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(player.role);

}

function readAloud(text) {

    return `<q>${escapeHTML(text)}</q>`;

}

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.addPlayer = addPlayer;
window.removePlayer = removePlayer;
window.removeAllPlayers = removeAllPlayers;
window.drawPlayerScreen = drawPlayerScreen;
window.drawRoleScreen = drawRoleScreen;
window.filterRoleList = filterRoleList;
window.setRoleSortMode = setRoleSortMode;
window.changeRole = changeRole;
window.removeAllRoles = removeAllRoles;
window.drawGameConfirmation = drawGameConfirmation;
window.startNightOne = startNightOne;
window.confirmLeftoverCard = confirmLeftoverCard;
window.drawNightRole = drawNightRole;
window.confirmNightRole = confirmNightRole;
window.confirmNightAction = confirmNightAction;
window.advanceNightAction = advanceNightAction;
window.advanceNightRole = advanceNightRole;
window.setNightActionMode = setNightActionMode;
window.updateNeighborAvailability = updateNeighborAvailability;
window.drawDayOne = drawDayOne;
window.drawDayOnePlayers = drawDayOnePlayers;
window.startVote = startVote;
window.cancelVote = cancelVote;
window.kickPlayer = kickPlayer;
window.resolveVote = resolveVote;
window.startNextNight = startNextNight;
window.continueNightAfterDrunkCard = continueNightAfterDrunkCard;
window.resolveMadBomber = resolveMadBomber;
window.resolveHunterRevenge = resolveHunterRevenge;
window.drawEveryoneGoToSleep = drawEveryoneGoToSleep;
window.drawCurrentGameSummary = drawCurrentGameSummary;
window.downloadGameSummary = downloadGameSummary;
window.continueGame = continueGame;
window.finishGame = finishGame;
window.goBackOneScreen = goBackOneScreen;
window.newGame = newGame;
