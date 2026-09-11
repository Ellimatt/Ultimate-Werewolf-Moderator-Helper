async function loadRoles() {

    try {

        const response = await fetch(`${window.WEREWOLF_ASSET_BASE || ""}Data/roles.json`);

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
                    data-click="removePlayer(${index})"
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
        <section class="playerEntrySection" aria-labelledby="addPlayerHeading">
            <h3 id="addPlayerHeading">Add another player</h3>
            <p class="setupHint">Enter a name, then press Enter or select Add Player.</p>
            <div class="playerEntryControls">
            <input
                id="playerName"
                type="text"
                placeholder="Player name"
                autocomplete="off"
                aria-label="Player name"
            >
            <button
                type="button"
                class="addPlayerButton"
                data-click="addPlayer()"
            >
                ➕ Add Player
            </button>
            </div>
        </section>

        <section class="playerSetupContinue">
            <div>
                <strong>Finished adding players?</strong>
                <small>${players.length} ${players.length === 1 ? "player" : "players"} currently added</small>
            </div>
            <button
                type="button"
                class="playerSetupNext"
                data-click="drawRoleScreen()"
                ${players.length === 0 ? "disabled" : ""}
            >
                Continue to Role Selection ➜
            </button>
        </section>

        ${players.length ? `
            <div class="removePlayersAction">
                <button type="button" data-click="removeAllPlayers()">Remove All Players</button>
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
    const cards = getTotalCards();
    const requiredCards = getRequiredCardCount();

    let html = `
        <h2>Roles in Game</h2>
        <div class="rolePageActions rolePageActionsTop">
            <button class="primaryAction startGameTop" type="button" data-click="drawGameConfirmation()" ${cards !== requiredCards ? "disabled" : ""}>Start Game</button>
            <button type="button" data-click="promptToSaveGameSetup()" ${cards === 0 ? "disabled" : ""}>Save Loadout</button>
            <button class="quietAction" type="button" data-click="scrollRolePage('bottom')">↓ Bottom</button>
        </div>
        <div class="roleToolbar">
            <input
                id="roleSearch"
                class="roleSearch"
                type="search"
                placeholder="Search roles"
                aria-label="Search roles"
                value="${escapeHTML(roleSearchTerm)}"
                data-input="filterRoleList(this.value)"
            >
            <select aria-label="Sort roles" data-change="setRoleSortMode(this.value)">
                <option value="alphabetical-asc" ${roleSortMode === "alphabetical-asc" ? "selected" : ""}>A–Z</option>
                <option value="alphabetical-desc" ${roleSortMode === "alphabetical-desc" ? "selected" : ""}>Z–A</option>
                <option value="value-asc" ${roleSortMode === "value-asc" ? "selected" : ""}>Value: Low–High</option>
                <option value="value-desc" ${roleSortMode === "value-desc" ? "selected" : ""}>Value: High–Low</option>
            </select>
        </div>
        <div class="roleFilterToolbar">
            <select aria-label="Filter roles" data-change="setRoleCategoryFilter(this.value)">
                <option value="all" ${roleTeamFilter === "all" && roleValueFilter === "all" ? "selected" : ""}>All</option>
                <option value="Werewolf" ${roleTeamFilter === "Werewolf" ? "selected" : ""}>Werewolf Team</option>
                <option value="Villager" ${roleTeamFilter === "Villager" ? "selected" : ""}>Villager Team</option>
                <option value="negative" ${roleValueFilter === "negative" ? "selected" : ""}>Werewolf Benefits (−)</option>
                <option value="positive" ${roleValueFilter === "positive" ? "selected" : ""}>Villager Benefits (+)</option>
            </select>
            <label class="selectedRoleFilter"><input type="checkbox" ${roleSelectedOnly ? "checked" : ""} data-change="setRoleSelectedOnly(this.checked)"> Selected only</label>
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
                data-click="drawPlayerScreen()"
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

            <div class="playerRow roleOption" data-role-name="${escapeHTML(role.role.toLowerCase())}" data-role-team="${escapeHTML(role.team)}" data-role-value="${Number(role.value) < 0 ? "negative" : "positive"}" data-role-wake="${escapeHTML(String(role.wake))}" data-role-selected="${Number(role.count) > 0 ? "true" : "false"}">

                <span>
                    ${escapeHTML(role.role)}
                    <span class="roleValue">${Number(role.value) >= 0 ? "+" : ""}${Number(role.value) || 0}</span>
                    <button class="roleInfoButton ${role.team === "Werewolf" ? "werewolfInfo" : "villagerInfo"}" type="button" aria-label="Information about ${escapeHTML(role.role)}" data-click="showRoleInfo(${index})">i</button>
                </span>

                <div>

                    <button
                        type="button"
                        data-click="changeRole(${index}, -1)"
                    >
                        -
                    </button>

                    <strong style="padding:0 10px;">
                        ${role.count}
                    </strong>

                    <button
                        type="button"
                        data-click="changeRole(${index}, 1)"
                    >
                        +
                    </button>

                </div>

            </div>

        `;

    });


    const drunkIsSelected = roles.some(role =>
        role.role === "Drunk" && Number(role.count) > 0
    );
    const thingIsSelected = roles.some(role =>
        role.role === "The Thing" && Number(role.count) > 0
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
        ${thingIsSelected ? `
            <p style="color:${cards === requiredCards ? "#8fda8f" : "#ff8f8f"}; font-size:.9rem;">
                ${cards === requiredCards ?
                    "The Thing is in play. Its extra secondary card has been selected." :
                    "The Thing is in play. Select one additional secondary card."}
            </p>
        ` : ""}

        <br>

        <div class="rolePageFooter">
            <button class="dangerButton removeRolesButton" type="button" data-click="removeAllRoles()">Remove All Roles</button>
            <div class="rolePageActions">
                <button class="quietAction" type="button" data-click="drawPlayerScreen()">⬅ Back</button>
                <button class="quietAction" type="button" data-click="scrollRolePage('top')">↑ Top</button>
                <button class="primaryAction" type="button" data-click="drawGameConfirmation()" ${cards !== requiredCards ? "disabled" : ""}>Start Game</button>
            </div>
        </div>

    `;


    document.getElementById("screen").innerHTML = html;
    filterRoleList(roleSearchTerm);

}

function scrollRolePage(destination) {
    window.scrollTo({
        top: destination === "bottom" ? document.documentElement.scrollHeight : 0,
        behavior: "smooth"
    });
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
        role.team === "Werewolf" &&
        !["Minion", "Sorceress"].includes(role.role) &&
        (role.role !== "The Thing" || roleRuleSettings.thingParticipatesWolfEliminations)
    );
    if (!hasEliminationWolf) {
        setupWarnings.push("No Werewolf capable of making the shared elimination is selected.");
    }
    if (Math.abs(totalValue) >= 10) {
        setupWarnings.push(`The card-value balance is ${totalValue}, so this setup may strongly favor one team.`);
    }
    if (selectedRoles.some(role => role.role === "Drunk")) setupWarnings.push("The Drunk requires one extra role card.");
    if (selectedRoles.some(role => role.role === "The Thing")) setupWarnings.push("The Thing requires one extra secondary role card.");
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
            data-click="drawRoleScreen()"
        >
            ⬅ Back
        </button>

        <button
            type="button"
            data-click="startNightOne()"
            ${totalCards !== requiredCards || automaticWinMessage ? "disabled" : ""}
        >
            🌙 Start Night 1
        </button>

    `;

}

// ============================================================
// NIGHT ONE - SETUP
// ============================================================


