document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("admin-toggle");
    const approvalSection = document.getElementById("approval");
    const approvalNav = document.getElementById("approval-nav");

    // Funktion zum Aktualisieren des Sichtbarkeitszustands
    function updateVisibility() {
        const visible = toggle.checked;
        approvalSection.style.display = visible ? "block" : "none";
        approvalNav.style.display = visible ? "block" : "none";
    }

    // Beim Laden initial prüfen
    updateVisibility();

    // Wenn der Toggle verändert wird
    toggle.addEventListener("change", updateVisibility);
});

