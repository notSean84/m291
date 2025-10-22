document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("admin-toggle");
  const approvalNav = document.getElementById("approval-nav");

  // Funktion zum Aktualisieren des Sichtbarkeitszustands
  function updateVisibility() {
    const visible = toggle.checked;
    approvalNav.style.display = visible ? "block" : "none";
  }

  // Navigiert zur Dashboard-Ansicht und setzt den Link als active
  function goToDashboard() {
    const dashboardLink = document.querySelector('li.side-bar-list-item a[href="#dashboard"]');
    if (!dashboardLink) return;

    // Entferne .active von allen Sidebar-Links
    const sidebarLinks = document.querySelectorAll('li.side-bar-list-item a');
    sidebarLinks.forEach(link => link.classList.remove('active'));

    // Setze Dashboard-Link als aktiv
    dashboardLink.classList.add('active');

    // Navigiere zum Dashboard-Anker (ändert die URL-Hash und scrollt falls nötig)
    // Verwende location.hash statt click, damit kein unerwartetes Seitenevent ausgelöst wird
    location.hash = "#dashboard";
  }

  // Beim Laden initial prüfen
  updateVisibility();

  // Wenn der Toggle verändert wird
  toggle.addEventListener("change", () => {
    updateVisibility();
    if (!toggle.checked) {
      goToDashboard();
    }
  });
});
