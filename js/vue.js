import { createApp, ref, computed, onMounted, watch }
            from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js'
        const apiUrl = 'https://projects.sbw.media/'

        createApp({
            setup() {
                /* =========================
                 * 1) BASIS-STATE / STORES
                 * ========================= */
                // Serverdaten
                const timesheetView = ref([])
                const students = ref([])
                const projects = ref([])
                const projectTypes = ref([])
                const customers = ref([])

                // UI-Flags
                const isLoading = ref(false)
                const error = ref(null)

                /* ---------- Login ---------- */
                const selectedYear = ref('')
                const selectedName = ref('')
                const isAdmin = ref(false)
                const isLoggedIn = ref(false)
                const loggedInStudent = ref(null)

                /* ---------- Recording (Timesheet-Dialog) ---------- */
                const showPopupRecord = ref(false)
                const newEntry = ref({ ID: null, ProjectName: '', studentName: '', date: '', hours: '' })
                const isEditing = ref(false)

                /* ---------- Projects (Projekt-Dialog) ---------- */
                const showProjectPopup = ref(false)
                const isEditingProject = ref(false)
                const projectError = ref(null)
                const projectForm = ref({
                    ID: null, ParentID: 0, Number: '', Name: '', Description: '',
                    TypeID: 0, CustomerID: 0, Coach: '', Status: 0
                })

                /* ---------- Approval ---------- */
                const approvalFilter = ref('all') // 'all' | 'pending' | 'approved' | 'rejected'

                /* ---------- Allocation ---------- */
                const roleFilter = ref('student') // 'student' | 'coach'
                const selectedPerson = ref('')    // Fullname des Schülers oder Coach-Name


                /* =====================================
                 * 2) COMPUTEDS: LOGIN & LISTEN-FILTER
                 * ===================================== */
                // Jahr aus Student-Objekt
                function studentYear(s) {
                    const y = Number(s?.Year)
                    return Number.isFinite(y) && y > 0 ? y : null
                }

                // Login-Optionen
                const yearOptions = computed(() => {
                    const set = new Set()
                    for (const s of (students.value || [])) {
                        const y = studentYear(s)
                        if (y !== null) set.add(y)
                    }
                    return Array.from(set).sort((a, b) => a - b)
                })

                const nameOptions = computed(() => {
                    if (selectedYear.value === '') return []
                    const yr = Number(selectedYear.value)
                    return (students.value || [])
                        .filter(s => studentYear(s) === yr)
                        .sort((a, b) => (a.Fullname || '').localeCompare(b.Fullname || '', 'de'))
                })

                // Basiseinschränkung aller Timesheets (Login/Admin)
                const baseTimesheets = computed(() => {
                    let list = timesheetView.value || []
                    if (isLoggedIn.value && !isAdmin.value && loggedInStudent.value) {
                        const id = Number(loggedInStudent.value.ID)
                        const name = loggedInStudent.value.Fullname
                        list = list.filter(x => Number(x.StudentID) === id || x.Fullname === name)
                    }
                    return list
                })

                // Tabellen-spezifische gefilterte Listen
                const timesheetViewFiltered = computed(() => baseTimesheets.value)

                const projectsFiltered = computed(() => {
                    if (!(isLoggedIn.value && !isAdmin.value && loggedInStudent.value)) return projects.value || []
                    const involved = new Set((baseTimesheets.value || []).map(x => x.ProjectName))
                    return (projects.value || []).filter(p => involved.has(p.Name))
                })


                /* ========================================
                 * 3) COMPUTEDS: APPROVAL & DASHBOARD
                 * ======================================== */
                // Approval-Liste (mit Status-Filter)
                const approvalsFiltered = computed(() => {
                    const src = baseTimesheets.value
                    switch (approvalFilter.value) {
                        case 'pending': return src.filter(x => Number(x.Approved) === 2)
                        case 'approved': return src.filter(x => Number(x.Approved) === 1)
                        case 'rejected': return src.filter(x => Number(x.Approved) === 0)
                        default: return src
                    }
                })

                // Dashboard-Kennzahlen
                const sourceTimesheets = computed(() => baseTimesheets.value || (timesheetView.value || []))

                function sumMinutes(list) {
                    return list.reduce((acc, x) => acc + (Number(x.Minutes) || 0), 0)
                }

                const dashboardStats = computed(() => {
                    const list = sourceTimesheets.value
                    const pendingCount = list.filter(x => Number(x.Approved) === 2).length
                    const rejectedCount = list.filter(x => Number(x.Approved) === 0).length
                    const approvedHrs = (sumMinutes(list.filter(x => Number(x.Approved) === 1)) / 60).toFixed(1)
                    const totalHrs = (sumMinutes(list) / 60).toFixed(1)
                    return { pendingCount, rejectedCount, approvedHrs, totalHrs }
                })

                // Dashboard-Extras
                const topProjects = computed(() => {
                    const map = new Map()
                    for (const t of sourceTimesheets.value) {
                        const key = t.ProjectName || '—'
                        map.set(key, (map.get(key) || 0) + (Number(t.Minutes) || 0))
                    }
                    return Array.from(map.entries())
                        .map(([name, minutes]) => ({ name, hours: +(minutes / 60).toFixed(1) }))
                        .sort((a, b) => b.hours - a.hours)
                        .slice(0, 3)
                })

                const monthHours = computed(() => {
                    const now = new Date()
                    const start = new Date(now.getFullYear(), now.getMonth(), 1)
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                    const mins = sourceTimesheets.value.reduce((acc, x) => {
                        const d = new Date(x.Date)
                        return (d >= start && d < end) ? acc + (Number(x.Minutes) || 0) : acc
                    }, 0)
                    return (mins / 60).toFixed(1)
                })


                /* =======================================
                 * 4) COMPUTEDS: ALLOCATION / BETEILIGUNG
                 * ======================================= */
                // Auswahloptionen
                const studentOptions = computed(() =>
                    (students.value || [])
                        .map(s => s.Fullname)
                        .filter(Boolean)
                        .sort((a, b) => a.localeCompare(b, 'de'))
                )

                const coachOptions = computed(() => {
                    const set = new Set()
                    for (const p of (projects.value || [])) {
                        const n = (p.Coach || '').trim()
                        if (n) set.add(n)
                    }
                    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'))
                })

                const personOptions = computed(() => roleFilter.value === 'student' ? studentOptions.value : coachOptions.value)

                // schnelle Lookups
                const projectTypeById = computed(() => {
                    const m = new Map()
                    for (const t of (projectTypes.value || [])) m.set(Number(t.ID), t)
                    return m
                })
                const customerById = computed(() => {
                    const m = new Map()
                    for (const c of (customers.value || [])) m.set(Number(c.ID), c)
                    return m
                })
                const projectByName = computed(() => {
                    const m = new Map()
                    for (const p of (projects.value || [])) m.set(p.Name, p)
                    return m
                })

                // Gruppierung nach Projekt
                function aggregateTimesheets(list) {
                    const map = new Map()
                    for (const ts of list) {
                        const key = ts.ProjectName
                        if (!map.has(key)) {
                            map.set(key, { ProjectName: key, Minutes: 0, Entries: 0, LastDate: null })
                        }
                        const row = map.get(key)
                        row.Minutes += Number(ts.Minutes) || 0
                        row.Entries += 1
                        const d = new Date(ts.Date)
                        if (!isNaN(d)) row.LastDate = (!row.LastDate || d > row.LastDate) ? d : row.LastDate
                    }
                    return Array.from(map.values())
                }

                // Tabellenzeilen für Allocation
                const involvementRows = computed(() => {
                    const person = (selectedPerson.value || '').trim()
                    if (!person) return []

                    if (roleFilter.value === 'student') {
                        const mine = (timesheetView.value || []).filter(x => (x.Fullname || '').trim() === person)
                        const grouped = aggregateTimesheets(mine)
                        return grouped.map(g => {
                            const p = projectByName.value.get(g.ProjectName)
                            const type = p ? projectTypeById.value.get(Number(p.TypeID)) : null
                            const cust = p ? customerById.value.get(Number(p.CustomerID)) : null
                            return {
                                Number: p?.Number || '—',
                                ProjectName: g.ProjectName,
                                Coach: p?.Coach || '—',
                                TypeName: type?.Name || '—',
                                CustomerName: cust?.Name || '—',
                                Minutes: g.Minutes,
                                Entries: g.Entries,
                                LastDate: g.LastDate
                            }
                        }).sort((a, b) => (b.LastDate?.getTime() || 0) - (a.LastDate?.getTime() || 0))
                    }

                    // role = 'coach'
                    const myProjects = (projects.value || []).filter(p => (p.Coach || '').trim() === person)
                    const byProjectName = new Map()
                    for (const p of myProjects) byProjectName.set(p.Name, { Minutes: 0, Entries: 0, LastDate: null })
                    for (const ts of (timesheetView.value || [])) {
                        if (byProjectName.has(ts.ProjectName)) {
                            const cell = byProjectName.get(ts.ProjectName)
                            cell.Minutes += Number(ts.Minutes) || 0
                            cell.Entries += 1
                            const d = new Date(ts.Date)
                            if (!isNaN(d)) cell.LastDate = (!cell.LastDate || d > cell.LastDate) ? d : cell.LastDate
                        }
                    }
                    return myProjects.map(p => {
                        const acc = byProjectName.get(p.Name) || { Minutes: 0, Entries: 0, LastDate: null }
                        const type = projectTypeById.value.get(Number(p.TypeID))
                        const cust = customerById.value.get(Number(p.CustomerID))
                        return {
                            Number: p.Number || '—',
                            ProjectName: p.Name,
                            Coach: p.Coach || '—',
                            TypeName: type?.Name || '—',
                            CustomerName: cust?.Name || '—',
                            Minutes: acc.Minutes,
                            Entries: acc.Entries,
                            LastDate: acc.LastDate
                        }
                    }).sort((a, b) => (b.LastDate?.getTime() || 0) - (a.LastDate?.getTime() || 0))
                })


                /* ============================
                 * 5) ACTIONS / METHODS
                 * ============================ */
                // Login
                function handleLogin() {
                    const yr = Number(selectedYear.value)
                    const nm = String(selectedName.value || '')
                    const s = (students.value || []).find(x => studentYear(x) === yr && x.Fullname === nm)
                    if (!s) { alert('Bitte gültigen Lehrgang und Namen wählen.'); return }
                    loggedInStudent.value = s
                    isLoggedIn.value = true
                    roleFilter.value = 'student'
                    selectedPerson.value = s.Fullname
                }

                function logout() {
                    isLoggedIn.value = false
                    loggedInStudent.value = null
                    selectedYear.value = ''
                    selectedName.value = ''
                    isAdmin.value = false
                }

                watch(selectedYear, () => { selectedName.value = '' })

                // Timesheet-Helfer
                function formatDate(dateString) {
                    const date = new Date(dateString)
                    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-CH')
                }
                function formatHours(minutes) {
                    const val = Number(minutes)
                    return isNaN(val) ? '0.0' : (val / 60).toFixed(1)
                }
                function approvedText(value) {
                    switch (Number(value)) {
                        case 0: return 'Abgelehnt'
                        case 1: return 'Angenommen'
                        case 2: return 'Ausstehend'
                        default: return 'Unbekannt'
                    }
                }

                async function saveTimesheet() {
                    try {
                        const student = students.value.find(s => s.Fullname === newEntry.value.studentName)
                        const project = projects.value.find(p => p.Name === newEntry.value.ProjectName)
                        if (!student || !project) { alert('Bitte gültigen Studenten und ein Projekt wählen'); return }

                        const payload = {
                            ProjectID: project.ID,
                            StudentID: student.ID,
                            Date: newEntry.value.date,
                            Minutes: parseFloat(newEntry.value.hours) * 60,
                            Approved: 2
                        }

                        let response
                        if (isEditing.value && newEntry.value.ID) {
                            response = await fetch(apiUrl + 'Timesheet/' + newEntry.value.ID, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                            })
                        } else {
                            response = await fetch(apiUrl + 'Timesheet', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                            })
                        }

                        if (!response.ok) throw new Error('Fehler beim Speichern')

                        alert(isEditing.value ? 'Eintrag erfolgreich bearbeitet' : 'Zeiterfassung erfolgreich hinzugefügt')
                        showPopupRecord.value = false
                        isEditing.value = false
                        newEntry.value = { ID: null, ProjectName: '', studentName: '', date: '', hours: '' }
                        await fetchData()
                    } catch (err) {
                        alert('Fehler: ' + err.message)
                    }
                }

                function editEntry(item) {
                    newEntry.value = {
                        ID: item.ID,
                        ProjectName: item.ProjectName,
                        studentName: item.Fullname,
                        date: (item.Date || '').split('T')[0],
                        hours: (item.Minutes / 60).toFixed(1)
                    }
                    isEditing.value = true
                    showPopupRecord.value = true
                }

                async function deleteEntry(id) {
                    if (!confirm('Willst du diesen Eintrag wirklich löschen?')) return
                    try {
                        const response = await fetch(apiUrl + 'Timesheet/' + id, { method: 'DELETE' })
                        if (!response.ok) throw new Error('Fehler beim Löschen')
                        timesheetView.value = timesheetView.value.filter(entry => entry.ID !== id)
                        alert('Eintrag erfolgreich gelöscht')
                    } catch (err) {
                        alert('Fehler: ' + err.message)
                    }
                }

                // Approval-Status setzen
                async function setApproval(item, status) {
                    try {
                        const student = students.value.find(s => s.Fullname === item.Fullname)
                        const project = projects.value.find(p => p.Name === item.ProjectName)
                        if (!student || !project) { alert('Fehler: Konnte Student oder Projekt nicht finden.'); return }

                        const dateOnly = (item.Date || '').split('T')[0]
                        const payload = {
                            ProjectID: project.ID,
                            StudentID: student.ID,
                            Date: dateOnly,
                            Minutes: Number(item.Minutes) || 0,
                            Approved: Number(status) // 0/1
                        }

                        const res = await fetch(apiUrl + 'Timesheet/' + item.ID, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                        })
                        if (!res.ok) throw new Error('Fehler beim Aktualisieren')

                        // Optimistisch updaten
                        item.Approved = Number(status)
                    } catch (err) {
                        console.error(err)
                        alert('Fehler: ' + err.message)
                    }
                }

                // Projekthandling
                function typeName(id) {
                    const t = projectTypes.value.find(x => Number(x.ID) === Number(id))
                    return t ? t.Name : '—'
                }
                function customerName(id) {
                    const c = customers.value.find(x => Number(x.ID) === Number(id))
                    return c ? c.Name : '—'
                }

                function openProjectCreate() {
                    isEditingProject.value = false
                    projectError.value = null
                    projectForm.value = {
                        ID: null, ParentID: 0, Number: '', Name: '', Description: '',
                        TypeID: 0, CustomerID: 0, Coach: '', Status: 0
                    }
                    showProjectPopup.value = true
                }

                function editProject(p) {
                    isEditingProject.value = true
                    projectError.value = null
                    projectForm.value = {
                        ID: p.ID,
                        ParentID: p.ParentID ?? 0,
                        Number: p.Number ?? '',
                        Name: p.Name ?? '',
                        Description: p.Description ?? '',
                        TypeID: p.TypeID ?? 0,
                        CustomerID: p.CustomerID ?? 0,
                        Coach: p.Coach ?? '',
                        Status: p.Status ?? 0
                    }
                    showProjectPopup.value = true
                }

                function closeProjectPopup() { showProjectPopup.value = false }

                async function saveProject() {
                    try {
                        projectError.value = null
                        if (!projectForm.value.Name || projectForm.value.Name.trim() === '') {
                            projectError.value = 'Bitte einen Projektnamen angeben.'
                            return
                        }

                        const payload = {
                            ParentID: Number(projectForm.value.ParentID) || 0,
                            Number: projectForm.value.Number || '',
                            Name: projectForm.value.Name,
                            Description: projectForm.value.Description || '',
                            TypeID: Number(projectForm.value.TypeID) || 0,
                            CustomerID: Number(projectForm.value.CustomerID) || 0,
                            Coach: projectForm.value.Coach || '',
                            Status: Number(projectForm.value.Status) || 0
                        }

                        let response
                        if (isEditingProject.value && projectForm.value.ID) {
                            response = await fetch(apiUrl + 'Project/' + projectForm.value.ID, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                            })
                        } else {
                            response = await fetch(apiUrl + 'Project', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                            })
                        }

                        if (!response.ok) throw new Error('Fehler beim Speichern des Projekts')

                        showProjectPopup.value = false
                        isEditingProject.value = false
                        await fetchData()
                        alert('Projekt gespeichert')
                    } catch (err) {
                        projectError.value = err.message
                        console.error('Projekt-API-Fehler:', err)
                    }
                }

                async function deleteProject(id) {
                    if (!confirm('Willst du dieses Projekt wirklich löschen?')) return
                    try {
                        const res = await fetch(apiUrl + 'Project/' + id, { method: 'DELETE' })
                        if (!res.ok) throw new Error('Fehler beim Löschen des Projekts')
                        projects.value = projects.value.filter(p => p.ID !== id)
                        alert('Projekt gelöscht')
                    } catch (err) {
                        projectError.value = err.message
                        console.error('Projekt-API-Fehler:', err)
                    }
                }


                /* ============================
                 * 6) DATENLADEN & NAVIGATION
                 * ============================ */
                async function fetchData() {
                    try {
                        isLoading.value = true
                        const [ts, st, pr, pt, cu] = await Promise.all([
                            fetch(apiUrl + 'TimesheetView'),
                            fetch(apiUrl + 'Student'),
                            fetch(apiUrl + 'Project'),
                            fetch(apiUrl + 'Projecttype'),
                            fetch(apiUrl + 'CustomerView')
                        ])

                        if (!ts.ok || !st.ok || !pr.ok || !pt.ok || !cu.ok) throw new Error('Fehler beim Laden der Daten')

                        const tsData = await ts.json()
                        const stData = await st.json()
                        const prData = await pr.json()
                        const ptData = await pt.json()
                        const cuData = await cu.json()

                        timesheetView.value = tsData.resources || tsData
                        students.value = stData.resources || stData
                        projects.value = prData.resources || prData
                        projectTypes.value = ptData.resources || ptData
                        customers.value = cuData.resources || cuData
                    } catch (err) {
                        error.value = err.message
                        console.error('API-Fehler:', err)
                    } finally {
                        isLoading.value = false
                    }
                }

                // Hash-Navigation
                function initNavigation() {
                    const links = Array.from(document.querySelectorAll('.side-bar-list a'))
                    const sections = Array.from(document.querySelectorAll('main > section'))
                    if (!links.length || !sections.length) return

                    function activate(hash) {
                        const target = hash && hash.startsWith('#') ? hash.slice(1) : 'dashboard'
                        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + target))
                        sections.forEach(sec => sec.classList.toggle('active', sec.id === target))
                    }

                    activate(location.hash || '#dashboard')
                    links.forEach(a => a.addEventListener('click', () => setTimeout(() => activate(location.hash), 0)))
                    window.addEventListener('hashchange', () => activate(location.hash))
                }

                onMounted(() => {
                    fetchData()
                    initNavigation()
                })


                /* ============================
                 * 7) EXPOSE TO TEMPLATE
                 * ============================ */
                return {
                    // Daten
                    timesheetView, students, projects, projectTypes, customers,

                    // UI
                    isLoading, error,

                    // Login
                    selectedYear, selectedName, isAdmin, isLoggedIn, loggedInStudent,
                    yearOptions, nameOptions, handleLogin, logout,

                    // Recording
                    showPopupRecord, newEntry, isEditing, saveTimesheet, editEntry, deleteEntry,

                    // Projects
                    showProjectPopup, isEditingProject, projectError, projectForm,
                    openProjectCreate, editProject, closeProjectPopup, saveProject, deleteProject,

                    // Helpers
                    formatDate, formatHours, approvedText, typeName, customerName,

                    // Approval
                    approvalFilter, approvalsFiltered, setApproval,

                    // Allocation
                    roleFilter, selectedPerson, personOptions, involvementRows,

                    // Gefilterte Listen
                    baseTimesheets, timesheetViewFiltered, projectsFiltered,

                    // Dashboard
                    dashboardStats, topProjects, monthHours,
                }
            }
        }).mount('#app')