// Shared role identity, appearance, and inheritance helpers.

function playerAppearsWerewolfToPI(player) {
    if (!player) return false;
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToPI) return true;
    if (player.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToPI;
    if (player.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromPI;
    return basePlayerAppearsAs(player) === "Werewolf";
}

function playerAppearsAs(player) {
    if (!player) return "Villager";
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToSeer) return "Werewolf";
    return basePlayerAppearsAs(player);
}

function basePlayerAppearsAs(player) {
    if (!player) return "Villager";
    return roles.find(role => role.role === player.role)?.appearsAs || player.team || "Villager";
}

function isPhantomMarked(player) {
    return player?.phantomMarked === true || player?.appearsAsWerewolfOverride === true;
}

function apparentTeam(player) {
    if (player?.isThing) {
        return roles.find(role => role.role === player.role)?.team || "Villager";
    }
    return player?.team || "Villager";
}

function roleTeamForInheritance(player) {
    return player?.isThing ? apparentTeam(player) : player?.team;
}

function roleShownToMysticSeer(player) {
    if (!player) return "Villager";
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToMysticSeer) return "Werewolf";
    if (player.role === "Lycan" && roleRuleSettings.lycanDisguisesRoleFromMysticSeer) {
        return "Werewolf";
    }
    if (player.role === "Wolf Man" && roleRuleSettings.wolfManDisguisesRoleFromMysticSeer) {
        return "Villager";
    }
    return player.role || "Villager";
}

function trackerSeesWerewolf(player) {
    if (!player) return false;
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToTracker) return true;
    if (player.role === "Lycan") return roleRuleSettings.trackerCountsLycanAsWolf;
    if (player.role === "Wolf Man") return !roleRuleSettings.trackerHidesWolfMan;
    return basePlayerAppearsAs(player) === "Werewolf";
}

function canarySeesWerewolf(player) {
    if (!player) return false;
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToCanary) return true;
    if (player.role === "Lycan") return roleRuleSettings.lycanAppearsWerewolfToCanary;
    if (player.role === "Wolf Man") return !roleRuleSettings.wolfManHiddenFromCanary;
    return basePlayerAppearsAs(player) === "Werewolf";
}

function getGraveDiggerVictims(nightNumber = currentNight - 1) {
    const phase = `Night ${nightNumber}`;
    const directVictims = players.filter(player =>
        !player.alive && player.deathCause === "Werewolf attack" && player.deathPhase === phase
    );
    if (!roleRuleSettings.graveDiggerLearnsLinkedDeaths) return directVictims;
    const linkedVictims = players.filter(player =>
        !player.alive &&
        player.deathPhase === phase &&
        ["Cupid lover", "Dire Wolf connection"].includes(player.deathCause) &&
        directVictims.some(victim => player.connectedTo === victim || victim.connectedTo === player)
    );
    return [...new Set([...directVictims, ...linkedVictims])];
}

function getSorceressFinding(player) {
    if (isPhantomMarked(player) && roleRuleSettings.phantomAppearsWolfToSorceress && roleRuleSettings.sorceressRevealsWerewolf) return "Werewolf";
    if (player?.role === "Seer") return "Seer";
    const appearsAs = basePlayerAppearsAs(player);
    if (appearsAs === "Werewolf" && roleRuleSettings.sorceressRevealsWerewolf) return "Werewolf";
    return "Other";
}

function isRecognizedWerewolf(player) {
    if (player?.isThing) return roleRuleSettings.thingParticipatesWolfEliminations;
    return apparentTeam(player) === "Werewolf" && !["Minion", "Sorceress"].includes(player?.role);
}

function roleDeathWasAtNight(player) {
    return String(player?.deathPhase || "").startsWith("Night ");
}

function madBomberShouldActivate(player) {
    return roleDeathWasAtNight(player) ?
        roleRuleSettings.madBomberActivatesDuringNight :
        true;
}

function hunterShouldActivate(player) {
    if (roleDeathWasAtNight(player)) {
        return roleRuleSettings.hunterActivatesAtNight;
    }
    return player?.deathCause === "Village vote" || player?.roleRevealed === true;
}

function revealedRoleName(player) {
    const roleName = player?.publicRevealedRole || player?.role || "Villager";
    if (player?.isDoppelganger && player?.doppelgangerDeathRoleCanTriggerAgain) {
        return `Doppelganger — inherited ${roleName} — Died Again`;
    }
    return roleName;
}

function summaryRoleName(player) {
    if (!player) return "Unknown";
    if (!player.alive && player.roleBeforeMartyrExchange) return player.roleBeforeMartyrExchange;
    if (player.martyrUsed) return `(Martyr): ${player.role || "Unknown"}`;
    if (player.isThing) return `(The Thing): ${player.role || "Unknown"}`;
    if (player.isDoppelganger && player.doppelgangerInheritedRole) {
        return `(Doppelganger): ${player.role || "Unknown"}`;
    }
    return revealedRoleName(player);
}

function publicNightEliminationCause(player) {
    const cause = player?.deathCause || player?.pendingDeathCause || "Night attack";
    if (String(cause).startsWith("Guardian sacrifice")) return "Werewolf attack";
    return cause === "Revealer backlash" || cause === "Revealer" ? "Revealer" : cause;
}

function showRoleInfo(index) {
    const role = roles[index];
    if (!role) return;
    document.querySelector(".appModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "appModalOverlay";
    overlay.innerHTML = `<div class="appModal infoModal" role="dialog" aria-modal="true" aria-labelledby="roleInfoTitle">
        <div class="infoModalHeading"><h2 id="roleInfoTitle">${escapeHTML(role.role)}</h2><span class="roleValue">${Number(role.value) >= 0 ? "+" : ""}${Number(role.value) || 0}</span></div>
        <p>${escapeHTML(roleHelpText[role.role] || role.question || "No additional role description is available.")}</p>
        <dl class="roleFacts">
            <div><dt>Team</dt><dd>${escapeHTML(role.team || "Unknown")}</dd></div>
            <div><dt>Appears as</dt><dd>${escapeHTML(role.appearsAs || role.team || "Unknown")}</dd></div>
            <div><dt>Wakes</dt><dd>${escapeHTML(roleWakeDescription(role))}</dd></div>
            <div><dt>Ability</dt><dd>${escapeHTML(role.action === "N/A" ? "Passive role" : role.action || "None")}</dd></div>
        </dl>
        ${role.oncePerGame ? '<p class="infoCallout">This ability may be used once per game.</p>' : ""}
        ${roleOptionMarkup(role.role)}
        <div class="modalActions"><button type="button" data-modal-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = overlay.querySelector("[data-modal-close]");
    close.addEventListener("click", activateModal(overlay, close));
}

