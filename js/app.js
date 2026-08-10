// ============================================================
// ULTIMATE WEREWOLF ASSISTANT
// ============================================================

let currentScreen = "players";
let players = [];
let roles = [];


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

// ============================================================
// INITIALIZE APP
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    drawPlayerScreen();

    loadRoles();
    loadActions();

});


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
        }
    });

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
        (item.role.action === "ProtectPlayer" || player !== item.actor)
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
        <p>${readAloud(isSecondWolfTarget ? "Whom would you like as your second elimination target?" : item.role.question)}</p>
    `;

    if (targetCount === 1) {

        html += `<select id="nightActionTarget">
            <option value="">Select Player</option>
            <option value="nobody">Nobody</option>
        `;

        availablePlayers.forEach(player => {
            const index = players.indexOf(player);
            html += `<option value="${index}">${escapeHTML(player.name)}</option>`;
        });

        html += `</select>`;

        if (item.role.action === "Investigate") {
            html += drawNeighborSelectors(availablePlayers);
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
        html += drawNeighborSelectors(availablePlayers);
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
        ${packHasAnotherTarget ? "" : `<p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p><hr>`}
        <button class="actionContinue" type="button" onclick="confirmNightAction()">Continue ➜</button>
    `;

    document.getElementById("screen").innerHTML = html;

}

function confirmNightAction() {

    const item = nightOneActionOrder[nightOneCurrentAction];
    const targetCount = getNightActionTargetCount(item);
    let targets = [];

    if (document.getElementById("nightActionNobody")?.checked) {
        item.skipped = true;
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
    }

    if (targets.some(target => !target)) {
        alert("A selected player could not be found.");
        return;
    }

    if (item.role.action === "WitchChoice") {
        if (nightOneActionMode === "save") {
            targets[0].protected = true;
        } else {
            targets[0].attackedTonight = true;
            targets[0].pendingDeathCause = "Witch attack";
            targets[0].pendingDeathPhase = `Night ${currentNight}`;
        }
    }

    executeAction(item.role.action, item.actor, targets);
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

    const actionsWithVisibleResults = [
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
    ];

    if (
        item.skipped ||
        (!includeQuestion && !actionsWithVisibleResults.includes(item.role.action))
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
        "Investigate"
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
            inspectionAppearsAs === "Werewolf";
    const signalText = item.role.action === "RevealAlignment" ?
        readAloud(`${signalIsUp ? "Werewolf" : "Not a Werewolf"}.`) :
        item.role.action === "RevealRole" ?
            readAloud(`${signalIsUp ? "Seer" : "Not the Seer"}.`) :
        item.role.action === "CompareTeams" ?
            readAloud(`${signalIsUp ? "Same team" : "Different teams"}.`) :
        item.role.action === "Investigate" ?
        readAloud(`${signalIsUp ? "Werewolf" : "Not a Werewolf"}.`) :
        `Signal: ${signalIsUp ? "Thumbs up" : "Thumbs down"}`;
    const signal = isSignalAction ? `
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
            return `${target.name} is protected tonight.`;

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

    document.getElementById("screen").innerHTML = `
        <h2>🌙 Night ${currentNight}</h2>
        <hr>
        <h2>${readAloud(`${moderatorRoleName(item.role.role)}, wake up.`)}</h2>
        ${item.role.question === "N/A" ? "" : `<p>${readAloud(item.role.question)}</p>`}
        <hr>
        <p>${readAloud(`${moderatorRoleName(item.role.role)}, go to sleep.`)}</p>
        <hr>
        <button class="actionContinue" type="button" onclick="advanceNightAction()">Continue ➜</button>
    `;

}

function drawNeighborSelectors(availablePlayers) {

    const options = availablePlayers.map(player =>
        `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`
    ).join("");

    return `
        <p>Select the two neighbors.</p>
        <select id="leftNeighbor"><option value="">Left neighbor</option>${options}</select>
        <select id="rightNeighbor"><option value="">Right neighbor</option>${options}</select>
    `;

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

    isLaterNight = true;
    currentNight = Math.max(currentNight, currentDay) + 1;
    savedVoteCount = 0;
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
        player.silenced = false;
        player.exiledTonight = false;
        player.tookActionTonight = false;
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
                    !(role.oncePerGame && player.usedOncePerGameAction)
                )
                .slice(0, role.action === "KillPlayer" ? 1 : undefined);

            actors.forEach(actor => {
                const actionCount = role.action === "KillPlayer" ?
                    wolfEliminationsTonight : 1;

                for (let actionIndex = 0; actionIndex < actionCount; actionIndex++) {
                    nightOneActionOrder.push({ role, actor });
                }
            });

            if (actors.length === 0 && role.action !== "KillPlayer") {
                const hiddenDeadActor = players.find(player =>
                    !player.alive &&
                    !player.roleRevealed &&
                    (role.action === "CopyRole" ?
                        player.isDoppelganger :
                        player.role === role.role) &&
                    !(role.oncePerGame && player.usedOncePerGameAction)
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
        drawHunterRevenge(nightHunter);
        return;
    }

    const livingWerewolves = players.filter(player =>
        player.alive && player.team === "Werewolf"
    );
    const livingVillagers = players.filter(player =>
        player.alive && player.team === "Villager"
    );

    if (
        !livingWerewolves.some(canChooseWerewolfElimination) &&
        !hasUnrevealedEliminationWerewolfDrunk()
    ) {
        drawGameResult("Villagers win! All elimination-capable Werewolves have been eliminated.");
        return;
    }

    if (
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.length >= livingVillagers.length
    ) {
        drawGameResult("Werewolves win! They now equal or outnumber the Villager team.");
        return;
    }

    const eliminated = players.filter(player =>
        (!player.alive || (player.attackedTonight && !player.protected)) &&
        !player.deathAnnounced
    );
    const silenced = players.filter(player => player.silenced);
    const exiled = players.filter(player => player.exiledTonight);
    const summaryRows = [
        ["Left the village", exiled],
        ["Silenced", silenced],
        ["Eliminated", eliminated]
    ].filter(([, affectedPlayers]) => affectedPlayers.length)
        .map(([label, affectedPlayers]) =>
            `<p>${readAloud(`${label}: ${affectedPlayers.map(player => player.name).join(", ")}.`)}</p>`
        ).join("");

    eliminated.forEach(player => {
        player.deathAnnounced = true;
    });

    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <hr>
        <h3>Night update</h3>
        ${summaryRows || `<p>${readAloud("Nothing happened overnight.")}</p>`}
        <button type="button" onclick="drawDayOnePlayers()">Start Day ${currentDay}</button>
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

    const confirmed = confirm(
        `Are you sure you want to kick ${player.name}? ` +
        "They will be eliminated and their role will remain unrevealed."
    );

    if (!confirmed) {
        return;
    }

    recordElimination(player, "Kicked", `Day ${currentDay}`);
    player.deathAnnounced = true;
    player.roleRevealed = false;

    const winMessage = getWinMessage();

    if (winMessage) {
        drawGameResult(winMessage);
        return;
    }

    drawDayOnePlayers();

}

function resolveVote(index, eliminate) {

    if (eliminate && players[index]) {
        recordElimination(players[index], "Village vote", `Day ${currentDay}`);
        resolveEliminationConsequences();
        return;
    }

    savedVoteCount++;

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
        <p>Choose two additional players to eliminate, or choose nobody.</p>
        <select id="bomberTargetOne"><option value="">First player</option>${options}</select>
        <select id="bomberTargetTwo"><option value="">Second player</option>${options}</select>
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
        <select id="hunterTarget"><option value="">Select player</option>${options}</select>
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

    recordElimination(players[Number(target.value)], "Hunter", eliminationPhase);
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
        drawGameResult(winMessage);
        return;
    }

    document.getElementById("screen").innerHTML = `
        <h2>Elimination</h2>
        <p>The following roles are revealed:</p>
        <ul>${revealRows}</ul>
        <button type="button" onclick="drawEveryoneGoToSleep()">Continue</button>
    `;

}

function drawGameResult(message) {

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

    document.getElementById("screen").innerHTML = `
        <h2>Game Over</h2>
        <p>${readAloud(message)}</p>
        <hr>
        <h2>Game Summary</h2>
        <h3>Still Alive</h3>
        <ul>${livingRows}</ul>
        <h3>Eliminated — First to Last</h3>
        ${deadRows}
        <button type="button" onclick="newGame()">New Game</button>
    `;

}

function newGame() {

    players = players.map(player => ({
        id: player.id,
        name: player.name,
        role: null,
        alive: true,
        connectedTo: null
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

    drawPlayerScreen();

}

function getWinMessage() {

    const livingWerewolves = players.filter(player =>
        player.alive && player.team === "Werewolf"
    );
    const livingVillagers = players.filter(player =>
        player.alive && player.team === "Villager"
    );

    if (
        !livingWerewolves.some(canChooseWerewolfElimination) &&
        !hasUnrevealedEliminationWerewolfDrunk()
    ) {
        return "Villagers win! All elimination-capable Werewolves have been eliminated.";
    }

    if (
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.length >= livingVillagers.length
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
window.drawPlayerScreen = drawPlayerScreen;
window.drawRoleScreen = drawRoleScreen;
window.filterRoleList = filterRoleList;
window.setRoleSortMode = setRoleSortMode;
window.changeRole = changeRole;
window.drawGameConfirmation = drawGameConfirmation;
window.startNightOne = startNightOne;
window.confirmLeftoverCard = confirmLeftoverCard;
window.drawNightRole = drawNightRole;
window.confirmNightRole = confirmNightRole;
window.confirmNightAction = confirmNightAction;
window.advanceNightAction = advanceNightAction;
window.advanceNightRole = advanceNightRole;
window.setNightActionMode = setNightActionMode;
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
window.newGame = newGame;
