// Application bootstrap, saved-state migration, and wake-lock lifecycle.

let appInitializationStarted = false;

async function initializeWerewolfApp() {

    if (appInitializationStarted) return;
    appInitializationStarted = true;

    await Promise.all([loadRoles(), loadActions()]);
    loadDesignSettings();
    loadPersistentRuleSettings();

    if (!restoreSavedGame()) {
        drawPlayerScreen();
    }

    startGamePersistence();
    updateWakeLock();

}

window.initializeWerewolfApp = initializeWerewolfApp;

if (!window.WEREWOLF_DEFER_START) {
    if (!document.readyState || document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeWerewolfApp);
    } else {
        initializeWerewolfApp();
    }
}

function pickKnownSettings(defaults, saved) {
    return Object.fromEntries(Object.keys(defaults).map(key => [
        key,
        saved && Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : defaults[key]
    ]));
}

function migrateSavedGame(savedData) {
    if (!savedData) return null;
    const version = Number(savedData.saveVersion || 1);
    if (version > savedGameVersion) return null;
    const migrated = savedData.current ? { ...savedData } : { current: savedData, back: null };
    [migrated.current, migrated.back, ...(Array.isArray(migrated.history) ? migrated.history : [])].filter(Boolean).forEach(state => {
        const migrateRoleObject = role => {
            if (role?.role) role.role = canonicalRoleName(role.role);
            return role;
        };
        (state.players || []).forEach(player => {
            ["role", "nightOneAssignedRole", "publicRevealedRole", "roleBeforeMartyrExchange", "doppelgangerInheritedRole", "thingSecondaryRole"]
                .forEach(key => {
                    if (player[key]) player[key] = canonicalRoleName(player[key]);
                });
        });
        (state.roles || []).forEach(migrateRoleObject);
        (state.nightOneWakeOrder || []).forEach(migrateRoleObject);
        (state.nightOneActionOrder || []).forEach(item => migrateRoleObject(item.role));
        (state.nightOneDeferredActions || []).forEach(item => migrateRoleObject(item.role));
        migrateRoleObject(state.leftoverCardRole);
        migrateRoleObject(state.thingCardRole);
        state.screenHTML = canonicalizeRoleText(state.screenHTML);
        const legacyAlphaProtection = state.roleRuleSettings?.werewolfProtectionBlocksAlphaConversion;
        state.roleRuleSettings = pickKnownSettings(defaultRoleRuleSettings, state.roleRuleSettings);
        if (typeof legacyAlphaProtection === "boolean") {
            state.roleRuleSettings.bodyguardBlocksAlphaConversion = legacyAlphaProtection;
            state.roleRuleSettings.priestBlessingBlocksAlphaConversion = legacyAlphaProtection;
        }
        state.gameSettings = pickKnownSettings(defaultGameSettings, state.gameSettings);
        state.phaseHistory = (Array.isArray(state.phaseHistory) ? state.phaseHistory : []).map((event, index) => ({
            type: event.type || (event.key?.startsWith("elimination-") ? "elimination" : "note"),
            id: event.id || event.key || `legacy-${index}`,
            ...event,
            text: canonicalizeRoleText(event.text)
        }));
    });
    migrated.saveVersion = savedGameVersion;
    return migrated;
}

async function updateWakeLock() {
    if (!designSettings.keepAwake || !players.some(player => player.role) || !navigator.wakeLock?.request) {
        if (wakeLock) await wakeLock.release().catch(() => {});
        wakeLock = null;
        return;
    }
    if (!wakeLock) {
        try {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => { wakeLock = null; });
        } catch (error) {
            console.warn("The screen could not be kept awake.", error);
        }
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateWakeLock();
});

