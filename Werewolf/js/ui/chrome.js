// Shared screen chrome and moderator status UI.

function updateBackButton() {

    const screen = document.getElementById("screen");
    const existingButtons = [...screen.querySelectorAll(".screenBackButton")];

    const activeGame = !["players", "roles", "confirmation"].includes(currentScreen);
    if (!backSavedGameStates.length || !activeGame || ["players", "roles", "confirmation"].includes(currentScreen)) {
        existingButtons.forEach(button => button.remove());
        return;
    }

    const actionButton = [...screen.querySelectorAll("button")].find(button =>
        button.textContent.trim().toLowerCase().startsWith("continue")
    ) || [...screen.querySelectorAll("button")].find(button =>
        /^(Take action|Turn the|Save|Start|Return|Next|Skip)/i.test(button.textContent.trim())
    ) || [...screen.querySelectorAll("button")].at(-1);

    if (
        existingButtons.length === 1 &&
        ((actionButton && existingButtons[0].nextElementSibling === actionButton) ||
            (!actionButton && existingButtons[0].parentElement === screen))
    ) {
        return;
    }

    existingButtons.forEach(button => button.remove());
    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "backButton screenBackButton";
    backButton.textContent = "← Back";
    backButton.addEventListener("click", goBackOneScreen);
    if (actionButton) actionButton.insertAdjacentElement("beforebegin", backButton);
    else screen.appendChild(backButton);

}

function updateModeratorChrome() {

    const showSetupUtilities = currentScreen === "roles";
    const gameSettingsButton = document.getElementById("gameSettingsButton");
    const savedGamesButton = document.getElementById("savedGamesButton");
    if (gameSettingsButton) gameSettingsButton.hidden = !showSetupUtilities;
    if (savedGamesButton) savedGamesButton.hidden = !showSetupUtilities;

    const phaseHeader = document.getElementById("phaseHeader");
    const inActiveGame = !["players", "roles", "confirmation"].includes(currentScreen);

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
            const currentRole = !isDay ? nightOneActionOrder[nightOneCurrentAction]?.role?.role : null;
            phaseHeader.textContent = `${phase}${progress}${currentRole ? ` • ${moderatorRoleName(currentRole)}` : ""} • ${alive} Alive`;
            phaseHeader.setAttribute("aria-live", "polite");
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
        if (["Eliminate", "Kick", "End Game", "Remove All Players", "Remove All Roles"].some(text => label.includes(text))) {
            button.classList.add("dangerButton");
        }
    });

}

