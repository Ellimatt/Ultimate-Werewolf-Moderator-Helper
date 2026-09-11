// Day screen, corrections, voting, and daytime decisions.

function drawDayOne() {

    const isResumingMorning = resumeMorningAfterSpecialResolution;
    resumeMorningAfterSpecialResolution = false;

    if (!isResumingMorning) {
        currentDay = gameBeginsOnNightZero() ? currentNight + 1 : currentNight;
        let diseasedKilledByWolves = false;

        players.filter(player => player.pendingAlphaConversion).forEach(player => {
            const armorBlockedConversion =
                roleRuleSettings.blacksmithArmorBlocksAlphaConversion && player.armorCharges > 0;
            const conversionBlocked = armorBlockedConversion ||
                (roleRuleSettings.bodyguardBlocksAlphaConversion && player.protectedFromWerewolvesTonight) ||
                (roleRuleSettings.priestBlessingBlocksAlphaConversion && player.blessedAgainstWerewolves);

            if (conversionBlocked) {
                player.alphaConversionFailedTonight = true;
                const alphaActor = players.find(actor => actor.id === player.alphaConversionActorId);
                if (alphaActor && !roleRuleSettings.alphaFailedConversionUsesAbility) {
                    alphaActor.usedOncePerGameAction = false;
                }
                if (armorBlockedConversion) {
                    player.armorCharges--;
                    player.armorBrokeTonight = true;
                }
            } else {
                player.role = "Werewolf";
                player.team = "Werewolf";
                player.alphaConvertedTonight = true;
                player.alphaConversionSignalPending = true;
                player.nightAttackCauses = (player.nightAttackCauses || [])
                    .filter(cause => cause !== "Werewolf attack");
                player.werewolfAttackTonight = false;
                player.wolfAttackCountsTonight = false;
                player.attackedByWolvesTonight = false;
                player.attackedTonight = player.nightAttackCauses.length > 0;
                player.pendingDeathCause = player.nightAttackCauses[0] || null;
            }

            player.pendingAlphaConversion = false;
            player.alphaConversionActorId = null;
        });

        const convertedPlayerToSignal = players.find(player => player.alphaConversionSignalPending);
        if (convertedPlayerToSignal) {
            drawAlphaConversionSignal(convertedPlayerToSignal);
            return;
        }

        const voodooTarget = players.find(player => player.alive && player.voodooRedirectedTonight && !player.voodooResolvedTonight);
        if (voodooTarget) {
            if (roleRuleSettings.voodooDollTargetSurvives) {
                voodooTarget.nightAttackCauses = (voodooTarget.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
                voodooTarget.werewolfAttackTonight = false;
                voodooTarget.wolfAttackCountsTonight = false;
                voodooTarget.attackedTonight = voodooTarget.nightAttackCauses.length > 0;
                voodooTarget.pendingDeathCause = voodooTarget.nightAttackCauses[0] || null;
            }
            drawVoodooRetaliation(voodooTarget);
            return;
        }

        diseasedKilledByWolves = players.some(player =>
            player.role === "Diseased" && player.wolfAttackCountsTonight && !player.bloodWolfAttackTonight
        );

        players.filter(guardian =>
            guardian.alive &&
            guardian.role === "Guardian" &&
            guardian.guardianWard?.alive &&
            guardian.guardianWard.werewolfAttackTonight &&
            !guardian.guardianWard.bloodWolfAttackTonight
        ).forEach(guardian => {
            const ward = guardian.guardianWard;
            ward.nightAttackCauses = (ward.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            ward.werewolfAttackTonight = false;
            ward.wolfAttackCountsTonight = false;
            ward.attackedTonight = ward.nightAttackCauses.length > 0;
            ward.pendingDeathCause = ward.nightAttackCauses[0] || null;
            guardian.guardianSacrificedTonightFor = ward.name;
            recordElimination(guardian, `Guardian sacrifice for ${ward.name}`, `Night ${currentNight}`);
            guardian.werewolfEliminationCountedNight = currentNight;
        });

        players.filter(guardian =>
            guardian.alive &&
            guardian.role === "Guardian" &&
            guardian.guardianWard?.alive &&
            guardian.werewolfAttackTonight &&
            !guardian.bloodWolfAttackTonight
        ).forEach(guardian => {
            guardian.nightAttackCauses = (guardian.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            guardian.werewolfAttackTonight = false;
            guardian.wolfAttackCountsTonight = false;
            guardian.attackedTonight = guardian.nightAttackCauses.length > 0;
            guardian.pendingDeathCause = guardian.nightAttackCauses[0] || null;
            guardian.guardianProtectedTonight = true;
        });

        players.filter(player => player.alive && player.role === "Shepherd" && player.shepherdFlockAlive && player.werewolfAttackTonight && !player.bloodWolfAttackTonight).forEach(player => {
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            player.shepherdFlockAlive = false;
            player.shepherdFlockSavedTonight = true;
            player.shepherdFlockEliminatedNight = currentNight;
            if (player.armorBrokeTonight && player.armorCharges === 0) {
                player.armorCharges = 1;
                player.armorBrokeTonight = false;
            }
        });

        players.filter(player => player.alive && player.role === "Butcher" && player.werewolfAttackTonight && !player.bloodWolfAttackTonight).forEach(player => {
            const replacement = player.butcherRedirectTarget;
            if (!replacement?.alive) return;
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            if (!replacement.blessedAgainstWerewolves && !replacement.protectedFromWerewolvesTonight) {
                replacement.nightAttackCauses = replacement.nightAttackCauses || [];
                replacement.nightAttackCauses.push("Werewolf attack");
                replacement.werewolfAttackTonight = true;
                replacement.wolfAttackCountsTonight = true;
                replacement.attackedTonight = true;
                replacement.pendingDeathPhase = `Night ${currentNight}`;
            }
            player.butcherRedirectedTonight = replacement.name;
        });

        players.filter(player =>
            player.alive &&
            player.armorCharges > 0 &&
            player.werewolfAttackTonight &&
            !player.bloodWolfAttackTonight
        ).forEach(player => {
            player.armorCharges--;
            player.armorBrokeTonight = true;
            player.nightAttackCauses = (player.nightAttackCauses || []).filter(cause => cause !== "Werewolf attack");
            player.werewolfAttackTonight = false;
            player.wolfAttackCountsTonight = false;
            player.attackedTonight = player.nightAttackCauses.length > 0;
            player.pendingDeathCause = player.nightAttackCauses[0] || null;
        });

        players.forEach(player => {
            if (player.toughGuyDeathPending) {
                recordElimination(
                    player,
                    "Tough Guy succumbed to Werewolf injuries",
                    `Night ${currentNight}`
                );
                player.werewolfEliminationCountedNight = currentNight;
                player.toughGuyDeathPending = false;
            }
        });

        players.forEach(player => {
            let attackCauses = player.nightAttackCauses || [];
            if (player.protectedFromWerewolvesTonight) {
                player.bodyguardBlockedOtherAttackTonight = attackCauses.filter(cause =>
                    (cause === "Witch attack" && roleRuleSettings.bodyguardProtectsWitch) ||
                    (cause === "Huntress attack" && roleRuleSettings.bodyguardProtectsHuntress)
                );
                attackCauses = attackCauses.filter(cause =>
                    !(cause === "Witch attack" && roleRuleSettings.bodyguardProtectsWitch) &&
                    !(cause === "Huntress attack" && roleRuleSettings.bodyguardProtectsHuntress)
                );
            }
            if (attackCauses.length) {
                const nonWerewolfCause = attackCauses.find(cause => cause !== "Werewolf attack");
                if (player.role === "Tough Guy" && !nonWerewolfCause && !player.bloodWolfAttackTonight) {
                    player.toughGuyDeathPending = true;
                    player.toughGuyDeathCause = "Werewolf attack";
                    player.attackedTonight = false;
                    player.attackedByWolvesTonight = false;
                } else {
                    recordElimination(
                        player,
                        nonWerewolfCause || "Werewolf attack",
                        player.pendingDeathPhase || `Night ${currentNight}`
                    );
                }
            }
        });

        diseasedKilledByWolves = players.some(player =>
            player.role === "Diseased" && player.wolfAttackCountsTonight && !player.bloodWolfAttackTonight
        );
        if (diseasedKilledByWolves) {
            wolvesDisabledNextNight = true;
        }

        updateWildChildren();
    }

    players.filter(player =>
        !player.alive && player.role === "Mad Bomber" && !player.bomberResolved && !madBomberShouldActivate(player)
    ).forEach(player => { player.bomberResolved = true; });

    const nightBomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved &&
        madBomberShouldActivate(player)
    );

    if (nightBomber) {
        nightBomber.resolveDuringMorning = true;
        drawMadBomberResolution(nightBomber);
        return;
    }

    const directlyEliminated = players.filter(player =>
        !player.alive
    );

    let newlyEliminated = directlyEliminated;

    while (newlyEliminated.length) {
        const connectionVictims = players.filter(player =>
            player.alive &&
            newlyEliminated.includes(player.connectedTo)
        );
        const petOwnerVictims = newlyEliminated
            .filter(player => player.petOwner && player.deathCause !== "Kicked" && player.petOwner.alive)
            .map(player => player.petOwner);
        newlyEliminated = [...new Set([...connectionVictims, ...petOwnerVictims])];

        newlyEliminated.forEach(player => {
            recordElimination(
                player,
                petOwnerVictims.includes(player) ? "Pet Wolf recognition" :
                    player.connectionType === "cupid" ? "Cupid lover" :
                        player.connectionType === "deathLink" ? "Linked death" : "Dire Wolf connection",
                `Night ${currentNight}`
            );
        });
    }

    updateWildChildren();

    const connectedNightBomber = players.find(player =>
        !player.alive &&
        player.role === "Mad Bomber" &&
        !player.bomberResolved &&
        madBomberShouldActivate(player)
    );

    if (connectedNightBomber) {
        connectedNightBomber.resolveDuringMorning = true;
        drawMadBomberResolution(connectedNightBomber);
        return;
    }

    players.filter(player =>
        !player.alive && player.role === "Hunter" && !player.hunterRevengeResolved && !hunterShouldActivate(player)
    ).forEach(player => { player.hunterRevengeResolved = true; });

    const nightHunter = players.find(player =>
        !player.alive &&
        player.role === "Hunter" &&
        !player.hunterRevengeResolved &&
        hunterShouldActivate(player)
    );

    if (nightHunter) {
        nightHunter.resolveDuringMorning = true;
        nightHunter.roleRevealed = true;
    }

    if (gameSettings.revealNightRoles) {
        players.filter(player =>
            !player.alive && player.deathPhase === `Night ${currentNight}`
        ).forEach(player => { player.roleRevealed = true; });
    }

    getNightModeratorDetails().filter(shouldRecordNightModeratorDetail).forEach((detail, index) => {
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
            "Villagers win! All Werewolves have been eliminated.",
            "morning"
        );
        return;
    }

    if (
        !nightHunter &&
        !ignoreWinConditions &&
        livingWerewolves.some(canChooseWerewolfElimination) &&
        livingWerewolves.reduce((total, player) => total + getWerewolfParityValue(player), 0) >= livingVillagerParityCount
    ) {
        drawGameResult(
            getWerewolfVictoryMessage(livingWerewolves),
            "morning"
        );
        return;
    }

    const eliminated = players.filter(player =>
        !player.alive &&
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
    const exposedRoles = players.filter(player => player.exposedByTonight).map(player =>
        `<p>${readAloud(`The Exposer discovered the ${revealedRoleName(player)}.`)}</p>`
    ).join("");
    const eliminationRows = eliminated.map(player =>
        `<p>${readAloud(`Eliminated: ${player.name}${player.roleRevealed ? ` — ${revealedRoleName(player)}` : ""} — ${publicNightEliminationCause(player)}.`)}</p>`
    ).join("");
    const eliminationAnnouncement = eliminationRows || `<p>${readAloud("Nobody was eliminated overnight.")}</p>`;
    const summaryRows = statusRows + exposedRoles + eliminationAnnouncement;
    const moderatorDetails = getNightModeratorDetails()
        .map(detail => `<li>${escapeHTML(detail)}</li>`)
        .join("");
    getNightModeratorDetails().filter(shouldRecordNightModeratorDetail).forEach((detail, index) => {
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
        <h3>${nightHunter.isDoppelganger ? "Doppelganger — Hunter" : "Hunter"}</h3>
        ${nightHunter.isDoppelganger ? `<p>${readAloud("The Doppelganger inherited the Hunter. The Hunter has died again.")}</p>` : ""}
        <p>${readAloud("Hunter, choose one player to eliminate, or choose nobody.")}</p>
        <select id="hunterTarget">
            <option value="">Select player</option>
            <option value="nobody">Nobody</option>
            ${hunterOptions}
        </select>
        <button class="actionContinue" type="button" data-click="resolveHunterRevenge(${players.indexOf(nightHunter)})">Continue ➜</button>
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
        ${gameSettings.showModeratorDetails ? `<h3>Moderator details</h3><ul>${moderatorDetails}</ul>` : ""}
        ${hunterControls || `<button type="button" data-click="drawDayOnePlayers()">Start Day ${currentDay}</button>`}
    `;

}

function drawVoodooRetaliation(protectedPlayer) {
    const wolves = players.filter(player => player.alive && canChooseWerewolfElimination(player));
    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <h3>Voodoo Doll</h3>
        <div class="moderatorPanel">${escapeHTML(protectedPlayer.name)} had the voodoo doll and was attacked by the Werewolves. ${roleRuleSettings.voodooDollTargetSurvives ? "They survive." : "They are still eliminated."} Select the Werewolf seated physically closest to them.</div>
        <select id="voodooWolfTarget"><option value="">Select closest Werewolf</option><option value="nobody">Nobody</option>${wolves.map(player => `<option value="${players.indexOf(player)}">${escapeHTML(player.name)}</option>`).join("")}</select>
        <button class="actionContinue" type="button" data-click="resolveVoodooRetaliation(${players.indexOf(protectedPlayer)})">Continue ➜</button>
    `;
}

function resolveVoodooRetaliation(protectedIndex) {
    const protectedPlayer = players[protectedIndex];
    const selected = document.getElementById("voodooWolfTarget");
    if (protectedPlayer && selected?.value === "nobody") {
        protectedPlayer.voodooResolvedTonight = true;
        recordPhaseEvent(
            `Night ${currentNight}`,
            `${protectedPlayer.name}'s voodoo doll redirected the Werewolf attack, but Nobody was selected for retaliation.${roleRuleSettings.voodooDollTargetSurvives ? ` ${protectedPlayer.name} survived.` : ` ${protectedPlayer.name} was still eliminated.`}`,
            `voodoo-${currentNight}-${protectedPlayer.id}`
        );
        drawDayOne();
        return;
    }
    const wolf = players[Number(selected?.value)];
    if (!protectedPlayer || !selected || selected.value === "" || !wolf?.alive || !canChooseWerewolfElimination(wolf)) {
        alert("Select the closest Werewolf.");
        return;
    }
    protectedPlayer.voodooResolvedTonight = true;
    recordElimination(wolf, "Voodoo doll", `Night ${currentNight}`);
    recordPhaseEvent(
        `Night ${currentNight}`,
        `${protectedPlayer.name}'s voodoo doll redirected the Werewolf attack to ${wolf.name}.${roleRuleSettings.voodooDollTargetSurvives ? ` ${protectedPlayer.name} survived.` : ` ${protectedPlayer.name} was still eliminated.`}`,
        `voodoo-${currentNight}-${protectedPlayer.id}`
    );
    drawDayOne();
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
        !player.alive
    );
    const activePlayers = players.filter(player =>
        !unavailablePlayers.includes(player)
    );

    [...activePlayers, ...unavailablePlayers].forEach(player => {

        const index = players.indexOf(player);
        const unavailable = unavailablePlayers.includes(player);
        const status = !player.alive ?
            `Eliminated${player.deathCause ? ` - ${player.deathCause}` : ""}${player.deathPhase ? `, ${player.deathPhase}` : ""}` :
            "Left the village";
        const displayedRole = !player.alive ?
            `${player.roleRevealed ? "Role revealed" : "Role not revealed"} - ${summaryRoleName(player)}` :
            summaryRoleName(player);
        const linkedPlayer = player.connectedTo;
        const connectionBadge = linkedPlayer && ["cupid", "dire", "deathLink"].includes(player.connectionType) ?
            `<span class="statusBadge linkedBadge">🔗 ${player.connectionType === "deathLink" ? "Dies if" : "Linked —"} ${escapeHTML(linkedPlayer.name)}${player.connectionType === "deathLink" ? " dies" : ""}</span>` : "";
        const statusBadges = [
            player.team === "Werewolf" ? '<span class="statusBadge wolfBadge">🐺 Werewolf team</span>' : "",
            player.protected ? '<span class="statusBadge">🛡 Protected</span>' : "",
            player.blessedAgainstWerewolves ? '<span class="statusBadge blessedBadge">🙏 Blessed</span>' : "",
            player.armorCharges > 0 ? '<span class="statusBadge armorBadge">🛡️ Armor</span>' : "",
            player.role === "Shepherd" && player.shepherdFlockAlive ? '<span class="statusBadge flockBadge">🐑 Flock</span>' : "",
            player.role === "Guardian" && player.guardianWard?.alive ? `<span class="statusBadge linkedBadge">🪽 Guarding — ${escapeHTML(player.guardianWard.name)}</span>` : "",
            isPhantomMarked(player) ? '<span class="statusBadge wolfBadge">👻 Phantom-marked</span>' : "",
            player.petOwner ? `<span class="statusBadge linkedBadge">🐾 Owner — ${escapeHTML(player.petOwner.name)}</span>` : "",
            player.silenced ? '<span class="statusBadge">🔇 Silenced</span>' : "",
            player.toughGuyDeathPending ? '<span class="statusBadge warningBadge">⏳ Delayed death</span>' : "",
            connectionBadge,
            !player.alive ? '<span class="statusBadge deathBadge">💀 Eliminated</span>' : "",
            !player.alive && player.roleRevealed ? '<span class="statusBadge">👁 Role revealed</span>' : "",
            !player.alive && !player.roleRevealed ? '<span class="statusBadge">❓ Role hidden</span>' : ""
        ].filter(Boolean).join(" ");
        const voteButton = unavailable ? "" : `
            <button
                type="button"
                data-click="startVote(${index})"
            >
                Vote
            </button>
        `;

        html += `

            <div class="playerRow" style="${unavailable ? "opacity:.5; background:#444; color:#ddd;" : ""}">

                <div>

                    <strong>
                        ${escapeHTML(player.name)}${isRecognizedWerewolf(player) ? " 🐺" : ""}
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

        <button type="button" data-click="endDayWithoutElimination()">
            Skip to Night
        </button>

        <button type="button" data-click="drawCurrentGameSummary()">
            Current Game Summary
        </button>

        <button type="button" data-click="showGameStateCorrection()">
            Correct Game State
        </button>

    `;


    document.getElementById("screen").innerHTML = html;

}

function showGameStateCorrection() {
    document.querySelector(".appModalOverlay")?.remove();
    const roleOptions = roles.map(role => role.role).sort((a, b) => a.localeCompare(b));
    const phaseOptions = [];
    for (let night = gameBeginsOnNightZero() ? 0 : 1; night <= Math.max(currentNight, 1); night++) phaseOptions.push(`Night ${night}`);
    for (let day = 1; day <= Math.max(currentDay, 1); day++) phaseOptions.push(`Day ${day}`);
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal correctionModal" role="dialog" aria-modal="true" aria-labelledby="correctionTitle">
        <h2 id="correctionTitle">Correct Game State</h2>
        <p>Repair a moderator mistake. Changes are recorded privately in the game timeline and can be undone with Back.</p>
        <label class="correctionPlayerPicker">Player<select id="correctionPlayer" data-change="loadCorrectionPlayer()">
            ${players.map((player, index) => `<option value="${index}">${escapeHTML(player.name)}</option>`).join("")}
        </select></label>

        <fieldset class="correctionGroup"><legend>Identity</legend>
            <div class="correctionGrid">
                <label>Current role<select id="correctionRole" data-change="updateCorrectionRoleTeam(); updateCorrectionPreview()">${roleOptions.map(role => `<option value="${escapeHTML(role)}">${escapeHTML(role)}</option>`).join("")}</select></label>
                <label>Current team<select id="correctionTeam" data-change="updateCorrectionPreview()"><option value="Villager">Villager</option><option value="Werewolf">Werewolf</option></select></label>
            </div>
            <label class="ruleToggle"><input id="correctionRevealed" type="checkbox" data-change="updateCorrectionPreview()"><span><strong>Role is publicly revealed</strong><small>Controls what the village knows</small></span></label>
        </fieldset>

        <fieldset class="correctionGroup"><legend>Life status</legend>
            <label>Status<select id="correctionStatus" data-change="updateCorrectionDeathFields(); updateCorrectionPreview()"><option value="alive">Alive</option><option value="eliminated">Eliminated</option></select></label>
            <div id="correctionDeathFields" class="correctionGrid">
                <label>Cause of death<input id="correctionCause" type="text" list="correctionCauses" placeholder="Werewolf attack" data-input="updateCorrectionPreview()"></label>
                <datalist id="correctionCauses"><option value="Werewolf attack"><option value="Village vote"><option value="Cupid lover"><option value="Dire Wolf connection"><option value="Hunter"><option value="Witch attack"><option value="Huntress attack"><option value="Revealer"><option value="Mad Bomber"><option value="Kicked"></datalist>
                <label>Phase<select id="correctionPhase" data-change="updateCorrectionPreview()">${phaseOptions.map(phase => `<option value="${phase}">${phase}</option>`).join("")}</select></label>
            </div>
        </fieldset>

        <fieldset class="correctionGroup"><legend>Persistent effects</legend>
            <div class="correctionGrid">
                <label>Armor charges<input id="correctionArmor" type="number" min="0" max="9" value="0" data-input="updateCorrectionPreview()"></label>
                <label>If this player dies, I die<select id="correctionConnectedTo" data-change="updateCorrectionPreview()"><option value="">Nobody</option>${players.map((player, index) => `<option value="${index}">${escapeHTML(player.name)}</option>`).join("")}</select></label>
            </div>
            <label class="ruleToggle"><input id="correctionAbilityUsed" type="checkbox" data-change="this.nextElementSibling.querySelector('small').textContent = this.checked ? 'Used' : 'Unused'; updateCorrectionPreview()"><span><strong>One-use ability status</strong><small>Unused</small></span></label>
        </fieldset>

        <div id="correctionPreview" class="moderatorPanel correctionPreview"></div>
        <div class="modalActions"><button type="button" data-modal-cancel>Cancel</button><button type="button" data-click="applyGameStateCorrection()">Apply Correction</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = activateModal(overlay, overlay.querySelector("#correctionPlayer"));
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", close);
    overlay._closeModal = close;
    loadCorrectionPlayer();
}

function loadCorrectionPlayer() {
    const player = players[Number(document.getElementById("correctionPlayer")?.value)];
    if (!player) return;
    document.getElementById("correctionRole").value = player.role || "Villager";
    document.getElementById("correctionTeam").value = player.team || "Villager";
    document.getElementById("correctionStatus").value = player.alive ? "alive" : "eliminated";
    document.getElementById("correctionRevealed").checked = player.roleRevealed === true;
    document.getElementById("correctionCause").value = player.deathCause || "";
    const phase = document.getElementById("correctionPhase");
    if (player.deathPhase && [...phase.options].some(option => option.value === player.deathPhase)) phase.value = player.deathPhase;
    document.getElementById("correctionArmor").value = Math.max(0, Number(player.armorCharges) || 0);
    document.getElementById("correctionAbilityUsed").checked = player.usedOncePerGameAction === true;
    document.getElementById("correctionAbilityUsed").nextElementSibling.querySelector("small").textContent = player.usedOncePerGameAction ? "Used" : "Unused";
    document.getElementById("correctionConnectedTo").value = player.connectedTo ? String(players.indexOf(player.connectedTo)) : "";
    [...document.getElementById("correctionConnectedTo").options].forEach(option => {
        option.disabled = option.value === String(players.indexOf(player));
    });
    updateCorrectionDeathFields();
    updateCorrectionPreview();
}

function applyGameStateCorrection() {
    const index = Number(document.getElementById("correctionPlayer")?.value);
    const player = players[index];
    if (!player) return;
    const alive = document.getElementById("correctionStatus").value === "alive";
    const cause = document.getElementById("correctionCause").value.trim();
    const phase = document.getElementById("correctionPhase").value;
    if (!alive && (!cause || !/^(Night|Day) \d+$/.test(phase))) {
        showAppAlert("An eliminated player needs a cause and a phase such as Night 3 or Day 3.");
        return;
    }
    const connectedIndex = document.getElementById("correctionConnectedTo").value;
    const connectedPlayer = connectedIndex === "" ? null : players[Number(connectedIndex)];
    if (connectedPlayer === player) {
        showAppAlert("Choose a different player for the death link, or select Nobody.");
        return;
    }
    const before = `${summaryRoleName(player)}, ${player.team}, ${player.alive ? "alive" : `eliminated by ${player.deathCause}`}`;
    const previousConnection = player.connectedTo;
    if (previousConnection !== connectedPlayer && player.connectionType === "cupid" && previousConnection?.connectedTo === player) {
        previousConnection.connectedTo = null;
        previousConnection.connectionType = null;
    }

    player.role = document.getElementById("correctionRole").value;
    player.team = document.getElementById("correctionTeam").value;
    player.alive = alive;
    player.roleRevealed = document.getElementById("correctionRevealed").checked;
    player.armorCharges = Math.max(0, Math.min(9, Number(document.getElementById("correctionArmor").value) || 0));
    player.usedOncePerGameAction = document.getElementById("correctionAbilityUsed").checked;

    const connectionUnchanged = connectedPlayer && connectedPlayer === previousConnection;
    player.connectionType = connectedPlayer ? (connectionUnchanged ? player.connectionType : "deathLink") : null;
    player.connectedTo = connectedPlayer;

    const previousDeathOrder = player.deathOrder;
    if (previousDeathOrder) {
        phaseHistory = phaseHistory.filter(event => event.key !== `elimination-${previousDeathOrder}`);
    }
    if (alive) {
        player.deathCause = null;
        player.deathPhase = null;
        player.deathOrder = null;
        player.deathAnnounced = false;
        player.eliminationEvent = null;
    } else {
        player.deathCause = cause;
        player.deathPhase = phase;
        if (!player.deathOrder) player.deathOrder = ++eliminationSequence;
        player.deathAnnounced = true;
        player.eliminationEvent = { cause, phase, order: player.deathOrder, roleRevealed: player.roleRevealed === true };
        recordPhaseEvent(
            phase,
            `${player.name} was eliminated — ${cause}.`,
            `elimination-${player.deathOrder}`,
            { type: "elimination", targets: [player], cause, result: "eliminated" }
        );
    }
    const after = `${summaryRoleName(player)}, ${player.team}, ${alive ? "alive" : `eliminated by ${cause}`}`;
    recordPhaseEvent(
        alive ? `Day ${currentDay}` : phase,
        `Moderator correction for ${player.name}: ${before} → ${after}.`,
        `correction-${Date.now()}`,
        { type: "correction", targets: [player], cause: alive ? null : cause, result: alive ? "alive" : "eliminated" }
    );
    document.querySelector(".appModalOverlay")?._closeModal?.();
    drawDayOnePlayers();
}

function updateCorrectionRoleTeam() {
    const roleName = document.getElementById("correctionRole")?.value;
    const definition = roles.find(role => role.role === roleName);
    if (definition) document.getElementById("correctionTeam").value = definition.team;
}

function updateCorrectionDeathFields() {
    const eliminated = document.getElementById("correctionStatus")?.value === "eliminated";
    const fields = document.getElementById("correctionDeathFields");
    if (fields) {
        fields.hidden = !eliminated;
        fields.querySelectorAll("input, select").forEach(control => { control.disabled = !eliminated; });
    }
}

function updateCorrectionPreview() {
    const player = players[Number(document.getElementById("correctionPlayer")?.value)];
    const preview = document.getElementById("correctionPreview");
    if (!player || !preview) return;
    const role = document.getElementById("correctionRole")?.value || player.role;
    const team = document.getElementById("correctionTeam")?.value || player.team;
    const alive = document.getElementById("correctionStatus")?.value === "alive";
    const effects = [];
    const armor = Number(document.getElementById("correctionArmor")?.value) || 0;
    if (armor) effects.push(`${armor} armor`);
    effects.push(document.getElementById("correctionAbilityUsed")?.checked ? "One-use ability used" : "One-use ability unused");
    const linkedIndex = document.getElementById("correctionConnectedTo")?.value;
    if (linkedIndex !== "" && players[Number(linkedIndex)]) effects.push(`Dies if ${players[Number(linkedIndex)].name} dies`);
    preview.textContent = `${player.name} — ${role} — ${team} — ${alive ? "Alive" : "Eliminated"}${effects.length ? ` — ${effects.join(", ")}` : ""}`;
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
    const pacifists = players.filter(currentPlayer =>
        currentPlayer.role === "Pacifist" && currentPlayer.alive && !currentPlayer.exiledTonight
    );
    const villageIdiots = players.filter(currentPlayer =>
        currentPlayer.role === "Village Idiot" && currentPlayer.alive && !currentPlayer.exiledTonight
    );
    const bailiff = players.find(currentPlayer => currentPlayer.role === "Bailiff" && currentPlayer.alive && !currentPlayer.exiledTonight);
    const judge = players.find(currentPlayer => currentPlayer.role === "Judge" && currentPlayer.alive && !currentPlayer.exiledTonight && !currentPlayer.judgePardonUsed);
    const livingScribe = players.find(currentPlayer => currentPlayer.role === "Scribe" && currentPlayer.alive && !currentPlayer.exiledTonight);
    const scribeIsInGame = players.some(currentPlayer => currentPlayer.role === "Scribe");
    const votingReminders = [
        mayor ? `${mayor.name} is the Mayor; their vote counts twice.` : "",
        pacifists.length ? `${pacifists.map(player => player.name).join(", ")} ${pacifists.length === 1 ? "is" : "are"} the Pacifist; count each as a Spare vote.` : "",
        villageIdiots.length ? `${villageIdiots.map(player => player.name).join(", ")} ${villageIdiots.length === 1 ? "is" : "are"} the Village Idiot; count each as an Eliminate vote.` : "",
        bailiff ? `${bailiff.name} is the Bailiff; if the vote ties, resolve it according to the Bailiff's vote.` : "",
        judge ? `${judge.name} is the Judge and still has a pardon available.` : "",
        scribeIsInGame ? (livingScribe ?
            `The Scribe is alive, so votes are public.` :
            `The Scribe is dead, so conduct the vote anonymously with everyone's eyes closed.`) : ""
    ].filter(Boolean);
    document.getElementById("screen").innerHTML = `
        <h2>Vote</h2>
        <p>${readAloud(`${player.name} is on trial.`)}</p>
        <p>Votes needed to eliminate: <strong>${votesNeeded}</strong></p>
        ${votingReminders.length ? `<div class="moderatorPanel"><strong>Moderator voting notes:</strong><ul>${votingReminders.map(note => `<li>${escapeHTML(note)}</li>`).join("")}</ul></div>` : ""}
        ${player.magistrateProtectedToday ? `<p class="infoCallout">The Magistrate has protected this player from today’s elimination vote.</p>` : ""}
        <button type="button" data-click="resolveVote(${index}, true)" ${player.magistrateProtectedToday ? "disabled" : ""}>Eliminate</button>
        <button type="button" data-click="resolveVote(${index}, false)" ${player.magistrateProtectedToday ? "disabled" : ""}>Spare</button>
        <button type="button" data-click="cancelVote()">Cancel Vote</button>
        <button type="button" data-click="kickPlayer(${index})">Kick</button>
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

    if (gameSettings.confirmKick) {
        showAppConfirmation(
            `Are you sure you want to kick ${player.name}? ` +
            "They will be eliminated and their role will remain unrevealed.",
            () => completeKick(index)
        );
        return;
    }

    completeKick(index);

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
        if (players[index].magistrateProtectedToday) {
            alert("The Magistrate protected this player from today’s elimination vote.");
            return;
        }
        if (players[index].role === "Prince") {
            players[index].roleRevealed = true;
            dayEliminationVoteOccurred = true;
            recordPhaseEvent(
                `Day ${currentDay}`,
                `${players[index].name} was revealed as the Prince and survived the village vote.`,
                `prince-survives-${currentDay}-${players[index].id}`
            );
            drawPrinceVoteReveal(players[index]);
            return;
        }
        const judge = players.find(player =>
            player.alive &&
            player.role === "Judge" &&
            !player.judgePardonUsed &&
            (roleRuleSettings.judgeMayPardonSelf || player !== players[index])
        );
        if (judge) {
            drawJudgeDecision(judge, index);
            return;
        }
        completeVoteElimination(index);
        return;
    }

    dayEliminationVoteOccurred = true;
    savedVoteCount++;
    recordPhaseEvent(
        `Day ${currentDay}`,
        `The village spared ${players[index]?.name || "a player"}. Spare vote ${savedVoteCount} of 3.`,
        `day-spare-${currentDay}-${savedVoteCount}`
    );

    if (savedVoteCount >= 3) {
        endDayWithoutElimination(false);
        return;
    }

    drawDayOnePlayers();
}

function transformSasquatchesAtDayEnd() {
    const transformed = players.filter(player => player.alive && player.role === "Sasquatch");
    transformed.forEach(player => {
        player.role = "Werewolf";
        player.team = "Werewolf";
        recordPhaseEvent(
            `Day ${currentDay}`,
            `${player.name}, the Sasquatch, became a Werewolf because the Day ended without an elimination.`,
            `sasquatch-${player.id}-${currentDay}`
        );
    });
    return transformed;
}

function endDayWithoutElimination(recordNoVote = true) {
    if (recordNoVote) {
        recordPhaseEvent(`Day ${currentDay}`, "No elimination vote was made.", `day-no-vote-${currentDay}`);
    }
    const transformed = transformSasquatchesAtDayEnd();
    if (!transformed.length) {
        drawEveryoneGoToSleep();
        return;
    }
    document.getElementById("screen").innerHTML = `
        <h2>☀️ Day ${currentDay}</h2>
        <h3>${readAloud(transformed.length === 1 ?
            "The Sasquatch has become a Werewolf." :
            "The Sasquatches have become Werewolves.")}</h3>
        <button type="button" data-click="drawEveryoneGoToSleep()">Continue ➜</button>
    `;
}

function drawPrinceVoteReveal(prince) {
    document.getElementById("screen").innerHTML = `
        <h2>Prince</h2>
        <p>${readAloud(`${prince.name} is the Prince. The Prince survives the village vote.`)}</p>
        <button type="button" data-click="drawEveryoneGoToSleep()">Continue ➜</button>
    `;
}

function completeVoteElimination(index, twinChecked = false) {
    const accused = players[index];
    const twin = !twinChecked ? players.find(player =>
        player.alive && player.role === "Twin" && player !== accused
    ) : null;
    if (twin) {
        drawTwinDecision(twin, accused, index);
        return;
    }
    dayEliminationVoteOccurred = true;
    recordElimination(accused, "Village vote", `Day ${currentDay}`);
    const martyr = players.find(player => player.alive && player.role === "Martyr" && !player.martyrUsed);
    if (martyr) {
        drawMartyrDecision(martyr, accused);
        return;
    }
    resolveEliminationConsequences();
}

function drawTwinDecision(twin, accused, accusedIndex) {
    document.getElementById("screen").innerHTML = `
        <h2>Twin</h2>
        <p>${readAloud("Twin, would you like to take the accused player's place?")}</p>
        <div class="moderatorPanel">${escapeHTML(twin.name)} may die instead of ${escapeHTML(accused.name)}. The Twin does not inherit the accused player's role.</div>
        <button type="button" data-click="resolveTwinDecision(${players.indexOf(twin)}, ${accusedIndex}, true)">Take Their Place</button>
        <button type="button" data-click="resolveTwinDecision(${players.indexOf(twin)}, ${accusedIndex}, false)">Do Nothing</button>
    `;
}

function resolveTwinDecision(twinIndex, accusedIndex, replace) {
    const twin = players[twinIndex];
    const accused = players[accusedIndex];
    if (!replace || !twin?.alive || twin.role !== "Twin" || !accused?.alive) {
        completeVoteElimination(accusedIndex, true);
        return;
    }
    dayEliminationVoteOccurred = true;
    twin.roleRevealed = true;
    recordElimination(twin, `Twin substitution for ${accused.name}`, `Day ${currentDay}`);
    recordPhaseEvent(
        `Day ${currentDay}`,
        `${twin.name}, the Twin, took ${accused.name}'s place in the village elimination.`,
        `twin-substitution-${currentDay}-${twin.id}`
    );
    resolveEliminationConsequences();
}

function drawJudgeDecision(judge, accusedIndex) {
    document.getElementById("screen").innerHTML = `
        <h2>Judge</h2>
        <p>${readAloud("Judge, would you like to publicly reveal your card and pardon the accused player?")}</p>
        <div class="moderatorPanel">If the Judge pardons, reveal ${escapeHTML(judge.name)} as the Judge. No player is eliminated and the Day ends.</div>
        <button type="button" data-click="resolveJudgeDecision(${players.indexOf(judge)}, ${accusedIndex}, true)">Grant Pardon</button>
        <button type="button" data-click="resolveJudgeDecision(${players.indexOf(judge)}, ${accusedIndex}, false)">Do Not Pardon</button>
    `;
}

function resolveJudgeDecision(judgeIndex, accusedIndex, pardon) {
    const judge = players[judgeIndex];
    if (!judge?.alive || judge.role !== "Judge" || !pardon) {
        completeVoteElimination(accusedIndex);
        return;
    }
    judge.judgePardonUsed = true;
    judge.roleRevealed = true;
    dayEliminationVoteOccurred = true;
    recordPhaseEvent(`Day ${currentDay}`, `${judge.name}, the Judge, revealed their card and pardoned ${players[accusedIndex]?.name || "the accused player"}. No one was eliminated.`, `judge-pardon-${currentDay}-${judge.id}`);
    endDayWithoutElimination(false);
}


