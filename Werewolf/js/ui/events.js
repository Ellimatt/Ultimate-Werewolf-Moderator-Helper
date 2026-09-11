// Delegated UI events for markup rendered by the application.
//
// Handler expressions are deliberately limited to named functions with simple
// literal or control-derived arguments. No arbitrary JavaScript is evaluated.

function parseDelegatedArguments(argumentText, control) {
    if (!argumentText.trim()) return [];
    return argumentText.match(/'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[^,]+/g).map(token => {
        const value = token.trim();
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
            return value.slice(1, -1).replace(/\\(['"])/g, "$1");
        }
        if (value === "true") return true;
        if (value === "false") return false;
        if (value === "null") return null;
        if (["this.checked", "value"].includes(value)) return control.checked;
        if (value === "this.value") return control.value;
        if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
        throw new Error(`Unsupported delegated event argument: ${value}`);
    });
}

function runDelegatedHandler(expression, control) {
    expression.split(";").map(statement => statement.trim()).filter(Boolean).forEach(statement => {
        // Checkbox status text used by settings panels is presentation behavior,
        // so it belongs here rather than inside every setting handler.
        if (statement.startsWith("this.nextElementSibling")) {
            const status = control.nextElementSibling?.querySelector("small");
            if (status) {
                status.textContent = statement.includes("'Used'") ?
                    (control.checked ? "Used" : "Unused") :
                    (control.checked ? "On" : "Off");
            }
            return;
        }

        const call = statement.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
        if (!call) throw new Error(`Unsupported delegated event handler: ${statement}`);
        const handler = window[call[1]];
        if (typeof handler !== "function") throw new Error(`Unknown UI action: ${call[1]}`);
        handler(...parseDelegatedArguments(call[2], control));
    });

    if (control.matches('input[type="checkbox"]')) {
        const status = control.nextElementSibling?.querySelector("small");
        if (status && !expression.includes("showGameSettings") && !expression.includes("showDesignSettings")) {
            status.textContent = control.checked ? "On" : "Off";
        }
    }
}

document.addEventListener("click", event => {
    const control = event.target.closest("[data-click]");
    if (control && !control.disabled) runDelegatedHandler(control.dataset.click, control);
});

document.addEventListener("change", event => {
    const control = event.target.closest("[data-change]");
    if (control) runDelegatedHandler(control.dataset.change, control);
});

document.addEventListener("input", event => {
    const control = event.target.closest("[data-input]");
    if (control) runDelegatedHandler(control.dataset.input, control);
});
