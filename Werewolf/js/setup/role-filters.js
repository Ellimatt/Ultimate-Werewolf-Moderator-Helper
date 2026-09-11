// Search, team, value, and selection filters for the role setup screen.

function filterRoleList(searchText) {
    roleSearchTerm = String(searchText || "").trim().toLowerCase();
    let visibleCount = 0;

    document.querySelectorAll(".roleOption").forEach(row => {
        const matchesSearch = !roleSearchTerm || row.dataset.roleName.includes(roleSearchTerm);
        const matchesTeam = roleTeamFilter === "all" || row.dataset.roleTeam === roleTeamFilter;
        const matchesValue = roleValueFilter === "all" || row.dataset.roleValue === roleValueFilter;
        const matchesSelected = !roleSelectedOnly || row.dataset.roleSelected === "true";
        const visible = matchesSearch && matchesTeam && matchesValue && matchesSelected;
        row.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    const emptyMessage = document.getElementById("noRoleSearchResults");
    if (emptyMessage) emptyMessage.style.display = visibleCount ? "none" : "block";
}

function setRoleTeamFilter(value) {
    roleTeamFilter = value || "all";
    filterRoleList(roleSearchTerm);
}

function setRoleValueFilter(value) {
    roleValueFilter = value || "all";
    filterRoleList(roleSearchTerm);
}

function setRoleCategoryFilter(value) {
    if (["Werewolf", "Villager"].includes(value)) {
        roleTeamFilter = value;
        roleValueFilter = "all";
    } else if (["positive", "negative"].includes(value)) {
        roleTeamFilter = "all";
        roleValueFilter = value;
    } else {
        roleTeamFilter = "all";
        roleValueFilter = "all";
    }
    filterRoleList(roleSearchTerm);
}

function setRoleSelectedOnly(enabled) {
    roleSelectedOnly = Boolean(enabled);
    filterRoleList(roleSearchTerm);
}
