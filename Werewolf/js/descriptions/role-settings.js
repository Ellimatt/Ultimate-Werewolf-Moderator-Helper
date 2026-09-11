// Role-specific rule defaults and settings UI.

const defaultRoleRuleSettings = {
    bodyguardProtectsWitch: false,
    bodyguardProtectsHuntress: false,
    bodyguardCannotRepeatTarget: true,
    bodyguardBlocksAlphaConversion: true,
    priestBlessingBlocksAlphaConversion: true,
    blacksmithArmorBlocksAlphaConversion: false,
    alphaFailedConversionUsesAbility: true,
    wolfCubKickActivatesBonus: false,
    hunterActivatesAtNight: false,
    lycanAppearsWerewolfToPI: false,
    lycanDisguisesRoleFromMysticSeer: false,
    lycanAppearsWerewolfToCanary: false,
    wolfManHiddenFromPI: false,
    wolfManDisguisesRoleFromMysticSeer: false,
    wolfManHiddenFromCanary: false,
    madBomberActivatesDuringNight: true,
    sorceressRevealsWerewolf: false,
    wildChildTransformsAfterKick: true,
    wildChildTransformsAfterDayDeath: true,
    wildChildTransformsAfterNightDeath: true,
    beholderWakesOnFutureNights: false,
    trackerCountsLycanAsWolf: false,
    trackerHidesWolfMan: false,
    minionCountsForWerewolfParity: true,
    fruitBruteCountsForWerewolfParity: true,
    sorceressCountsForWerewolfParity: true,
    mentalistCannotRepeatPlayers: true,
    graveDiggerLearnsLinkedDeaths: false,
    judgeMayPardonSelf: true,
    watchmanCountsEachWerewolfVisitor: false,
    cupidMayLinkSelf: true,
    oldHagMayTargetSelf: true,
    oldHagMayRepeatTarget: false,
    blackWolfMaySilenceSelf: true,
    blackWolfMayRepeatTarget: false,
    spellcasterMaySilenceSelf: true,
    spellcasterMayRepeatTarget: false,
    seerMayInspectSelf: true,
    seerMayRepeatTarget: false,
    packsHungerCountsShepherdFlock: true,
    voodooDollTargetSurvives: true,
    locksmithMayTargetSelf: false,
    locksmithCannotRepeatTarget: true,
    witchDoctorMayTargetSelf: false,
    witchDoctorCannotRepeatTarget: true,
    magistrateMayTargetSelf: false,
    magistrateCannotRepeatTarget: true,
    watchmanCannotRepeatTarget: true,
    thingParticipatesWolfEliminations: true,
    phantomAppearsWolfToSeer: true,
    phantomAppearsWolfToMysticSeer: true,
    phantomAppearsWolfToPI: true,
    phantomAppearsWolfToTracker: true,
    phantomAppearsWolfToCanary: true,
    phantomAppearsWolfToSorceress: true
};
let roleRuleSettings = { ...defaultRoleRuleSettings };

const roleSettingsByRole = {
    "Bodyguard": {
        fixed: ["Protects against Werewolf attacks"],
        options: [
            ["bodyguardProtectsWitch", "Protects against the Witch"],
            ["bodyguardProtectsHuntress", "Protects against the Huntress"],
            ["bodyguardBlocksAlphaConversion", "Protects against Alpha Wolf conversion"],
            ["bodyguardCannotRepeatTarget", "Cannot protect the same player on consecutive nights"]
        ]
    },
    "Blacksmith": { options: [["blacksmithArmorBlocksAlphaConversion", "Armor blocks Alpha Wolf conversion and then breaks"]] },
    "Alpha Wolf": { options: [["alphaFailedConversionUsesAbility", "A failed conversion still uses the Alpha Wolf's attempt"]] },
    "Cupid": {
        fixed: ["Acts only once, so consecutive-night target restrictions do not apply"],
        options: [["cupidMayLinkSelf", "May include themself in the connection"]]
    },
    "Old Hag": { options: [
        ["oldHagMayTargetSelf", "May make themself leave the village"],
        ["oldHagMayRepeatTarget", "May choose the same player on consecutive nights"]
    ] },
    "Shadow Wolf": { options: [
        ["blackWolfMaySilenceSelf", "May silence themself"],
        ["blackWolfMayRepeatTarget", "May choose the same player on consecutive nights"]
    ] },
    "Spellcaster": { options: [
        ["spellcasterMaySilenceSelf", "May silence themself"],
        ["spellcasterMayRepeatTarget", "May choose the same player on consecutive nights"]
    ] },
    "Seer": { options: [
        ["seerMayInspectSelf", "May inspect themself"],
        ["seerMayRepeatTarget", "May choose the same player on consecutive nights"]
    ] },
    "Ravenous Wolf": { options: [["packsHungerCountsShepherdFlock", "An eliminated Shepherd flock counts as a Werewolf elimination"]] },
    "Priest": {
        fixed: ["Protects against Werewolf attacks"],
        options: [["priestBlessingBlocksAlphaConversion", "Protects against Alpha Wolf conversion"]]
    },
    "Wolf Cub": {
        fixed: ["All revealed and night deaths activate the bonus"],
        options: [["wolfCubKickActivatesBonus", "Kick activates the Wolf Cub bonus"]]
    },
    "Hunter": {
        fixed: ["Activates after a revealed Day elimination"],
        options: [["hunterActivatesAtNight", "Activates after a Night elimination"]]
    },
    "Lycan": {
        fixed: ["Appears as a Werewolf to the Seer"],
        options: [
            ["lycanAppearsWerewolfToPI", "Appears as a Werewolf to the P.I."],
            ["lycanDisguisesRoleFromMysticSeer", "Appears as a Werewolf to the Mystic Seer"],
            ["trackerCountsLycanAsWolf", "Appears as a Werewolf to the Tracker"],
            ["lycanAppearsWerewolfToCanary", "Appears as a Werewolf to the Canary"]
        ]
    },
    "Wolf Man": {
        fixed: ["Appears as a Villager to the Seer"],
        options: [
            ["wolfManHiddenFromPI", "Appears as a Villager to the P.I."],
            ["wolfManDisguisesRoleFromMysticSeer", "Appears as a Villager to the Mystic Seer"],
            ["trackerHidesWolfMan", "Appears as a Villager to the Tracker"],
            ["wolfManHiddenFromCanary", "Appears as a Villager to the Canary"]
        ]
    },
    "Mad Bomber": {
        fixed: ["Always activates when eliminated during the Day"],
        options: [["madBomberActivatesDuringNight", "Activates when eliminated during the Night"]]
    },
    "Sorceress": {
        fixed: ["Identifies the Seer separately from other roles"],
        options: [
            ["sorceressRevealsWerewolf", "Identifies players who appear as Werewolves separately from Other"],
            ["sorceressCountsForWerewolfParity", "Counts toward Werewolf parity"]
        ]
    },
    "Minion": { options: [["minionCountsForWerewolfParity", "Counts toward Werewolf parity"]] },
    "Fruit Brute": { options: [["fruitBruteCountsForWerewolfParity", "Counts toward Werewolf parity"]] },
    "Wild Child": { options: [
        ["wildChildTransformsAfterDayDeath", "Turns if the role model dies during the Day"],
        ["wildChildTransformsAfterNightDeath", "Turns if the role model dies during the Night"],
        ["wildChildTransformsAfterKick", "Turns if the role model is Kicked"]
    ] },
    "Beholder": {
        fixed: ["Learns the original Seer"],
        options: [["beholderWakesOnFutureNights", "Wakes on future nights when someone has taken the Seer's place"]]
    },
    "Doppelganger": { fixed: [
        "After the chosen player dies, inherits that role, team, existing setup, targets, links, and used abilities",
        "Does not repeat first-night setup or restore an ability that has already been used"
    ] },
    "The Thing": { options: [["thingParticipatesWolfEliminations", "Participates in shared Werewolf eliminations"]] },
    "Phantom Wolf": { options: [
        ["phantomAppearsWolfToSeer", "Marked player appears as a Werewolf to the Seer"],
        ["phantomAppearsWolfToMysticSeer", "Marked player appears as a Werewolf to the Mystic Seer"],
        ["phantomAppearsWolfToPI", "Marked player appears as a Werewolf to the P.I."],
        ["phantomAppearsWolfToTracker", "Marked player appears as a Werewolf to the Tracker"],
        ["phantomAppearsWolfToCanary", "Marked player appears as a Werewolf to the Canary"],
        ["phantomAppearsWolfToSorceress", "Marked player appears as a Werewolf to the Sorceress"]
    ] },
    "Martyr": { fixed: [
        "Takes the eliminated player's role, team, existing setup, targets, links, and used abilities",
        "The eliminated player becomes the Martyr and does not trigger the exchanged role's ability"
    ] },
    "Mentalist": {
        fixed: ["Cannot select themself"],
        options: [["mentalistCannotRepeatPlayers", "Each player may be included in only one comparison per game"]]
    },
    "Grave Digger": { options: [["graveDiggerLearnsLinkedDeaths", "Learns linked deaths caused by a Werewolf attack"]] },
    "Judge": { options: [["judgeMayPardonSelf", "May pardon themself"]] },
    "Sentinel": { options: [
        ["watchmanCountsEachWerewolfVisitor", "Counts each participating Werewolf as a separate visitor"],
        ["watchmanCannotRepeatTarget", "Cannot watch the same player on consecutive nights"]
    ] },
    "Locksmith": { options: [
        ["locksmithMayTargetSelf", "May barricade themself"],
        ["locksmithCannotRepeatTarget", "Cannot barricade the same player on consecutive nights"]
    ] },
    "Witch Doctor": { options: [
        ["witchDoctorMayTargetSelf", "May give themself the voodoo doll"],
        ["witchDoctorCannotRepeatTarget", "Cannot choose the same player on consecutive nights"],
        ["voodooDollTargetSurvives", "The player holding the voodoo doll survives the Werewolf attack"]
    ] },
    "Magistrate": { options: [
        ["magistrateMayTargetSelf", "May protect themself from the vote"],
        ["magistrateCannotRepeatTarget", "Cannot protect the same player on consecutive days"]
    ] }
};

function roleOptionMarkup(roleName) {
    const settings = roleSettingsByRole[roleName];
    if (!settings) return "";

    const fixed = settings.fixed || [];
    const options = settings.options || [];
    return `<hr><h3>Role options</h3>
        ${fixed.map(label => `<div class="fixedRule"><span aria-hidden="true">✓</span><span>${escapeHTML(label)}<small>Always on</small></span></div>`).join("")}
        ${options.map(([key, label]) => `
        <label class="ruleToggle">
            <input type="checkbox" ${roleRuleSettings[key] ? "checked" : ""} data-change="setRoleRuleOption('${key}', value)">
            <span><strong>${escapeHTML(label)}</strong><small>${roleRuleSettings[key] ? "On" : "Off"}</small></span>
        </label>`).join("")}`;
}

