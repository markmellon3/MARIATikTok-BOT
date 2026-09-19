// ==========================================
// MARIA TIKTOK LIVE BOT - DASHBOARD LOGIC
// ==========================================

import { 
    apiRequest, 
    WebSocketManager, 
    logout, 
    showToast, 
    toggleTheme,
    getToken 
} from './app.js';

// --- State Variables ---
let currentSection = 'dashboard-section';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    // 1. Check Auth (Route guard from app.js handles redirect, but we double-check)
    if (!getToken()) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Setup UI Listeners
    setupNavigation();
    setupMobileSidebar();
    setupThemeToggle();
    setupLogout();
    setupLiveControls();
    setupCommandModals();
    setupAutomationModals();
    setupAnnouncementModals();
    setupSettingsForms();

    // 3. Connect WebSocket for real-time updates
    WebSocketManager.connect();
    registerWebSocketEvents();

    // 4. Load initial data
    loadDashboardData();
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar__item[data-section]');
    navItems.forEach(item => {
        const link = item.querySelector('.sidebar__link');
        if (!link) return;

        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');
            switchSection(sectionId);
            
            // Close sidebar on mobile navigation
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('active');
                document.getElementById('sidebar-overlay').classList.remove('active');
            }
        });
    });
}

function switchSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.hidden = true;
    });

    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.hidden = false;
        currentSection = sectionId;
    }

    // Update active nav item
    document.querySelectorAll('.sidebar__item').forEach(navItem => {
        navItem.classList.remove('active');
        if (navItem.getAttribute('data-section') === sectionId) {
            navItem.classList.add('active');
        }
    });

    // Load section-specific data
    loadSectionData(sectionId);
}

// --- Mobile Sidebar ---
function setupMobileSidebar() {
    const toggleBtn = document.getElementById('navbar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

// --- Theme & Logout ---
function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        toggleTheme(newTheme);
        
        // Update settings dropdown if visible
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) themeSelect.value = newTheme;
    });
}

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// --- Data Loading Router ---
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'dashboard-section': loadDashboardData(); break;
        case 'viewers-section': loadViewers(); break;
        case 'comments-section': loadComments(); break;
        case 'events-section': loadEvents(); break;
        case 'commands-section': loadCommands(); break;
        case 'automations-section': loadAutomations(); break;
        case 'announcements-section': loadAnnouncements(); break;
        case 'tasks-section': loadTasks(); break;
        case 'analytics-section': loadAnalytics(); break;
        case 'notifications-section': loadNotifications(); break;
        // Settings & Greetings load on form submit, but we can fetch initial values
        case 'greetings-section': loadGreetings(); break;
    }
}

// --- Dashboard Overview ---
async function loadDashboardData() {
    try {
        // Fetch LIVE status and stats
        const status = await apiRequest('/api/v1/live/status'); // Assuming endpoint returns current session status
        updateLiveStatusUI(status);
    } catch (error) {
        console.warn('Could not fetch live status:', error.message);
        updateLiveStatusUI({ status: 'DISCONNECTED' });
    }
}

function updateLiveStatusUI(status) {
    const indicator = document.getElementById('live-status-indicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.text-sm');
    
    const statLive = document.getElementById('stat-live-status');
    const statTrend = statLive.closest('.stat-card').querySelector('.stat-card__trend');

    if (status.status === 'LIVE' || status.status === 'CONNECTED') {
        dot.className = 'status-dot status-dot--success';
        text.textContent = 'LIVE';
        statLive.textContent = 'LIVE';
        statTrend.textContent = 'Connected';
        statTrend.className = 'stat-card__trend text-success';
        document.getElementById('btn-connect-live').disabled = true;
        document.getElementById('btn-disconnect-live').disabled = false;
        document.getElementById('btn-reconnect-live').disabled = false;
    } else {
        dot.className = 'status-dot';
        text.textContent = 'Disconnected';
        statLive.textContent = 'Offline';
        statTrend.textContent = 'Disconnected';
        statTrend.className = 'stat-card__trend text-warning';
        document.getElementById('btn-connect-live').disabled = false;
        document.getElementById('btn-disconnect-live').disabled = true;
        document.getElementById('btn-reconnect-live').disabled = true;
    }
}

// --- LIVE Control ---
function setupLiveControls() {
    document.getElementById('btn-connect-live').addEventListener('click', async () => {
        showToast('Connecting...', 'Attempting to start LIVE session.', 'info');
        try {
            await apiRequest('/api/v1/live/start', { method: 'POST', body: JSON.stringify({}) });
            showToast('Success', 'LIVE session started.', 'success');
        } catch (error) {
            showToast('Error', error.message, 'error');
        }
    });

    document.getElementById('btn-disconnect-live').addEventListener('click', async () => {
        try {
            await apiRequest('/api/v1/live/stop', { method: 'POST' });
            showToast('Disconnected', 'LIVE session stopped.', 'warning');
        } catch (error) {
            showToast('Error', error.message, 'error');
        }
    });
}

// --- Viewers ---
async function loadViewers() {
    const tbody = document.getElementById('viewers-table-body');
    tbody.innerHTML = `<tr><td colspan="8" class="text-center"><span class="spinner spinner-sm"></span> Loading viewers...</td></tr>`;
    
    try {
        const viewers = await apiRequest('/api/v1/viewers');
        if (!viewers || viewers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No viewers yet. Start a LIVE to see viewers here.</td></tr>`;
            return;
        }

        tbody.innerHTML = viewers.map(v => `
            <tr>
                <td>${v.username || 'Unknown'}</td>
                <td><span class="badge ${v.isOnline ? 'badge--success' : 'badge--secondary'}">${v.isOnline ? 'Online' : 'Offline'}</span></td>
                <td>${new Date(v.firstSeen).toLocaleString()}</td>
                <td>${new Date(v.lastSeen).toLocaleString()}</td>
                <td>${v.commentCount || 0}</td>
                <td>${v.eventCount || 0}</td>
                <td>${v.labels ? v.labels.map(l => `<span class="badge badge--info">${l}</span>`).join(' ') : 'None'}</td>
                <td><button class="btn-icon btn-icon--outline" data-viewer-id="${v.id}">[i]</button></td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading viewers.</td></tr>`;
    }
}

// --- Comments ---
async function loadComments() {
    const tbody = document.getElementById('comments-table-body');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center"><span class="spinner spinner-sm"></span> Loading comments...</td></tr>`;
    
    try {
        // Assuming /api/v1/events?type=COMMENT or similar endpoint
        const events = await apiRequest('/api/v1/events?type=COMMENT&limit=20');
        if (!events || events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No comments yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = events.map(e => `
            <tr>
                <td>${e.username || 'Unknown'}</td>
                <td>${e.payload.comment}</td>
                <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
                <td><span class="badge badge--info">Viewer</span></td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading comments.</td></tr>`;
    }
}

// --- Events ---
async function loadEvents() {
    const tbody = document.getElementById('events-table-body');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center"><span class="spinner spinner-sm"></span> Loading events...</td></tr>`;
    
    try {
        const events = await apiRequest('/api/v1/events?limit=20');
        if (!events || events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No events recorded.</td></tr>`;
            return;
        }

        tbody.innerHTML = events.map(e => `
            <tr>
                <td><span class="badge badge--info">${e.eventType}</span></td>
                <td>${e.username || 'System'}</td>
                <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
                <td>${JSON.stringify(e.payload).substring(0, 50)}...</td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading events.</td></tr>`;
    }
}

// --- Greetings ---
async function loadGreetings() {
    try {
        const settings = await apiRequest('/api/v1/settings/greetings');
        document.getElementById('enable-greetings').checked = settings.enabled;
        // Populate other fields...
    } catch (error) {
        // Ignore if not configured yet
    }
}

// --- Commands ---
async function loadCommands() {
    const tbody = document.getElementById('commands-table-body');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center"><span class="spinner spinner-sm"></span> Loading commands...</td></tr>`;
    
    try {
        const commands = await apiRequest('/api/v1/commands');
        if (!commands || commands.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No commands created yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = commands.map(c => `
            <tr>
                <td><strong>${c.command}</strong></td>
                <td>${c.response.substring(0, 30)}...</td>
                <td><span class="badge badge--info">${c.permission}</span></td>
                <td>${c.cooldown}s</td>
                <td>${c.enabled ? '<span class="badge badge--success">Active</span>' : '<span class="badge badge--danger">Disabled</span>'}</td>
                <td>
                    <button class="btn-icon btn-icon--outline edit-command-btn" data-id="${c.id}">[E]</button>
                    <button class="btn-icon btn-icon--outline delete-command-btn" data-id="${c.id}">[X]</button>
                </td>
            </tr>
        `).join('');

        // Attach listeners to new buttons
        document.querySelectorAll('.delete-command-btn').forEach(btn => btn.addEventListener('click', () => deleteCommand(btn.dataset.id)));
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading commands.</td></tr>`;
    }
}

function setupCommandModals() {
    document.getElementById('open-add-command-modal').addEventListener('click', () => {
        openGenericModal('Add Command', `
            <form id="command-form">
                <div class="form-group">
                    <label class="form-label">Command</label>
                    <input type="text" class="form-input" id="cmd-name" placeholder="!rules" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Response</label>
                    <textarea class="form-textarea" id="cmd-response" required></textarea>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Permission</label>
                        <select class="form-select" id="cmd-permission">
                            <option>EVERYONE</option>
                            <option>FOLLOWERS</option>
                            <option>VIP</option>
                            <option>MODERATOR</option>
                            <option>STREAMER</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cooldown (s)</label>
                        <input type="number" class="form-input" id="cmd-cooldown" value="0">
                    </div>
                </div>
            </form>
        `, async () => {
            const data = {
                command: document.getElementById('cmd-name').value,
                response: document.getElementById('cmd-response').value,
                permission: document.getElementById('cmd-permission').value,
                cooldown: parseInt(document.getElementById('cmd-cooldown').value),
                enabled: true
            };
            await apiRequest('/api/v1/commands', { method: 'POST', body: JSON.stringify(data) });
            showToast('Success', 'Command added.', 'success');
            loadCommands();
        });
    });
}

async function deleteCommand(id) {
    if(!confirm('Delete this command?')) return;
    try {
        await apiRequest(`/api/v1/commands/${id}`, { method: 'DELETE' });
        showToast('Deleted', 'Command removed.', 'warning');
        loadCommands();
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

// --- Automations ---
async function loadAutomations() {
    const tbody = document.getElementById('automations-table-body');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center"><span class="spinner spinner-sm"></span> Loading automations...</td></tr>`;
    
    try {
        const automations = await apiRequest('/api/v1/automations');
        if (!automations || automations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No automations configured.</td></tr>`;
            return;
        }

        tbody.innerHTML = automations.map(a => `
            <tr>
                <td><strong>${a.name}</strong></td>
                <td>${a.trigger.type}</td>
                <td>${a.trigger.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(', ') || 'None'}</td>
                <td>${a.actions.map(act => act.type).join(', ')}</td>
                <td>${a.enabled ? '<span class="badge badge--success">Active</span>' : '<span class="badge badge--danger">Disabled</span>'}</td>
                <td>
                    <button class="btn-icon btn-icon--outline delete-auto-btn" data-id="${a.id}">[X]</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading automations.</td></tr>`;
    }
}

function setupAutomationModals() {
    document.getElementById('open-add-automation-modal').addEventListener('click', () => {
        openGenericModal('Create Automation', `
            <form id="automation-form">
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-input" id="auto-name" required>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">WHEN (Trigger)</label>
                        <select class="form-select" id="auto-trigger">
                            <option value="VIEWER_JOINED">Viewer Joins</option>
                            <option value="COMMENT">Comment Received</option>
                            <option value="GIFT">Gift Received</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">THEN (Action)</label>
                        <select class="form-select" id="auto-action">
                            <option value="EXECUTE_GREETING">Send Greeting</option>
                            <option value="EXECUTE_COMMAND">Run Command</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">IF (Condition Value - optional)</label>
                    <input type="text" class="form-input" id="auto-cond-value" placeholder="e.g., !help">
                </div>
            </form>
        `, async () => {
            const triggerType = document.getElementById('auto-trigger').value;
            const actionType = document.getElementById('auto-action').value;
            const condValue = document.getElementById('auto-cond-value').value;
            
            const data = {
                name: document.getElementById('auto-name').value,
                enabled: true,
                trigger: {
                    type: triggerType,
                    conditions: condValue ? [{ field: 'payload.comment', operator: 'contains', value: condValue }] : []
                },
                actions: [{ type: actionType, payload: {} }]
            };
            await apiRequest('/api/v1/automations', { method: 'POST', body: JSON.stringify(data) });
            showToast('Success', 'Automation created.', 'success');
            loadAutomations();
        });
    });
}

// --- Announcements ---
async function loadAnnouncements() {
    const list = document.getElementById('announcements-list');
    list.innerHTML = `<p class="text-muted"><span class="spinner spinner-sm"></span> Loading...</p>`;
    try {
        const anns = await apiRequest('/api/v1/announcements');
        if (!anns || anns.length === 0) {
            list.innerHTML = `<p class="text-muted">No announcements created yet.</p>`;
            return;
        }
        list.innerHTML = anns.map(a => `
            <div class="announcement-pill">
                <div class="announcement__badge">${a.type}</div>
                <div>${a.message}</div>
                <button class="btn-icon btn-icon--outline" data-id="${a.id}">[X]</button>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = `<p class="text-danger">Error loading announcements.</p>`;
    }
}

function setupAnnouncementModals() {
    document.getElementById('open-add-announcement-modal').addEventListener('click', () => {
        openGenericModal('Create Announcement', `
            <form id="ann-form">
                <div class="form-group">
                    <label class="form-label">Message</label>
                    <textarea class="form-textarea" id="ann-msg" required></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Interval (minutes)</label>
                    <input type="number" class="form-input" id="ann-interval" value="15">
                </div>
            </form>
        `, async () => {
            const data = {
                message: document.getElementById('ann-msg').value,
                type: 'TIME_BASED',
                interval: parseInt(document.getElementById('ann-interval').value) * 60,
                enabled: true
            };
            await apiRequest('/api/v1/announcements', { method: 'POST', body: JSON.stringify(data) });
            showToast('Success', 'Announcement scheduled.', 'success');
            loadAnnouncements();
        });
    });
}

// --- Tasks ---
async function loadTasks() {
    const tbody = document.getElementById('tasks-table-body');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center"><span class="spinner spinner-sm"></span> Loading tasks...</td></tr>`;
    
    try {
        const tasks = await apiRequest('/api/v1/tasks');
        if (!tasks || tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No tasks found.</td></tr>`;
            return;
        }

        tbody.innerHTML = tasks.map(t => `
            <tr>
                <td>${t.taskId.substring(0,8)}</td>
                <td>${t.type}</td>
                <td><span class="badge ${getStatusBadgeClass(t.status)}">${t.status}</span></td>
                <td>${new Date(t.createdAt).toLocaleString()}</td>
                <td>${t.attempts}/${t.maxAttempts}</td>
                <td>
                    ${t.status === 'FAILED' ? `<button class="btn btn--sm btn--outline retry-task-btn" data-id="${t.taskId}">Retry</button>` : ''}
                    ${t.status === 'QUEUED' ? `<button class="btn btn--sm btn--danger cancel-task-btn" data-id="${t.taskId}">Cancel</button>` : ''}
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.retry-task-btn').forEach(btn => btn.addEventListener('click', () => retryTask(btn.dataset.id)));
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading tasks.</td></tr>`;
    }
}

async function retryTask(id) {
    try {
        await apiRequest(`/api/v1/tasks/${id}/retry`, { method: 'POST' });
        showToast('Retrying', 'Task moved back to queue.', 'info');
        loadTasks();
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'COMPLETED': return 'badge--success';
        case 'FAILED': return 'badge--danger';
        case 'RUNNING': return 'badge--info';
        case 'QUEUED': return 'badge--warning';
        default: return 'badge--secondary';
    }
}

// --- Analytics ---
async function loadAnalytics() {
    try {
        const data = await apiRequest('/api/v1/analytics');
        // Update stat cards if data exists
        if (data) {
            // Assuming data structure matches
        }
    } catch (error) {
        console.warn('Analytics fetch failed:', error.message);
    }
}

// --- Notifications ---
async function loadNotifications() {
    const list = document.getElementById('system-notifications-list');
    list.innerHTML = `<div class="text-muted"><span class="spinner spinner-sm"></span> Loading...</div>`;
    try {
        const notifs = await apiRequest('/api/v1/notifications');
        if (!notifs || notifs.length === 0) {
            list.innerHTML = `<div class="text-muted">No notifications.</div>`;
            return;
        }
        list.innerHTML = notifs.map(n => `
            <div class="card ${!n.read ? 'border-primary' : ''}">
                <div class="card__header">
                    <h3 class="card__title">${n.type}</h3>
                    ${!n.read ? '<span class="badge badge--info">New</span>' : ''}
                </div>
                <div class="card__body">
                    <p>${n.message}</p>
                    <p class="text-sm text-muted">${new Date(n.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = `<div class="text-danger">Error loading notifications.</div>`;
    }
}

// --- Settings ---
function setupSettingsForms() {
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = document.documentElement.getAttribute('data-theme');
        themeSelect.addEventListener('change', (e) => {
            toggleTheme(e.target.value);
        });
    }
}

// --- WebSocket Event Handlers ---
function registerWebSocketEvents() {
    WebSocketManager.on('session.status', (data) => {
        updateLiveStatusUI(data);
        showToast('Session Update', `LIVE session is now ${data.status}`, 'info');
    });

    WebSocketManager.on('viewer.joined', (data) => {
        // Update UI in real-time if viewers section is active
        if (currentSection === 'viewers-section') loadViewers();
        // Update stat card
        const statViewers = document.getElementById('stat-viewers');
        if (statViewers) {
            let current = parseInt(statViewers.textContent) || 0;
            statViewers.textContent = current + 1;
        }
    });

    WebSocketManager.on('comment.received', (data) => {
        if (currentSection === 'comments-section') loadComments();
        const statComments = document.getElementById('stat-comments');
        if (statComments) {
            let current = parseInt(statComments.textContent) || 0;
            statComments.textContent = current + 1;
        }
    });

    WebSocketManager.on('task.failed', (data) => {
        showToast('Task Failed', `Task ${data.type} failed.`, 'error');
        if (currentSection === 'tasks-section') loadTasks();
    });
}

// --- Generic Modal Helper ---
function openGenericModal(title, bodyHTML, onSaveCallback) {
    const modal = document.getElementById('generic-modal');
    const modalTitle = document.getElementById('generic-modal-title');
    const modalBody = document.getElementById('generic-modal-body');
    const saveBtn = document.getElementById('generic-modal-save');

    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modal.hidden = false;
    modal.classList.add('active');

    const closeModal = () => {
        modal.hidden = true;
        modal.classList.remove('active');
        // Clone to remove event listeners
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    };

    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeModal));
    
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener('click', async () => {
        newSaveBtn.disabled = true;
        try {
            await onSaveCallback();
            closeModal();
        } catch (error) {
            showToast('Error', error.message, 'error');
            newSaveBtn.disabled = false;
        }
    });
}