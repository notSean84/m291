export function initNavigation() {
    // Alle Sektionen initial ausblenden außer Dashboard
    const sections = document.querySelectorAll('main > section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById('dashboard').style.display = 'block';

    // Navigation Event Listener
    const navItems = document.querySelectorAll('.side-bar-list-item a');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Aktive Klasse entfernen
            navItems.forEach(nav => nav.classList.remove('active'));
            // Aktive Klasse hinzufügen
            e.target.classList.add('active');

            // Alle Sektionen ausblenden
            sections.forEach(section => {
                section.style.display = 'none';
            });

            // Entsprechende Sektion einblenden
            const sectionMap = {
                'Dashboard': 'dashboard',
                'Zeiterfassung': 'time-recording',
                'Bewilligung': 'approval',
                'Projekte': 'projects',
                'Zuweisungen': 'allocation'
            };

            const sectionId = sectionMap[e.target.textContent];
            if (sectionId) {
                document.getElementById(sectionId).style.display = 'block';
            }
        });
    });
}

