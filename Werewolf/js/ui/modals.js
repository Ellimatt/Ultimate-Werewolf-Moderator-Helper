// Accessible modal primitives used throughout the application.

function activateModal(overlay, initialControl, allowEscape = true) {
    const previouslyFocused = document.activeElement;
    const close = () => {
        overlay.remove();
        if (previouslyFocused?.focus) previouslyFocused.focus();
    };
    overlay.addEventListener("keydown", event => {
        if (event.key === "Escape" && allowEscape) {
            event.preventDefault();
            close();
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...overlay.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")]
            .filter(control => !control.disabled && !control.hidden);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    (initialControl || overlay.querySelector("button, input, select"))?.focus();
    return close;
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
    const close = activateModal(overlay, overlay.querySelector("[data-modal-cancel]"));
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", close);
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => {
        close();
        onConfirm();
    });

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
    const close = activateModal(overlay, okButton);
    okButton.addEventListener("click", close);

}

window.alert = showAppAlert;

