// Small shared browser and formatting utilities.

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

