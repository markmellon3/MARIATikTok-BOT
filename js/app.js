// ==========================================
// MARIA TIKTOK LIVE BOT - CENTRAL APP LAYER
// ==========================================

// --- Brand Configuration ---
export const BRAND_CONFIG = {
    name: "MARIA TIKTOK LIVE BOT",
    logoUrl: "", // e.g., "https://example.com/logo.png"
    faviconUrl: "",
    heroImageUrl: "",
    dashboardPreviewImageUrl: "",
    supportUrl: "",
    termsUrl: "terms.html"
};

// --- Backend Configuration ---
export const API_BASE_URL = "https://YOUR-RAILWAY-BACKEND-URL";
export const WS_BASE_URL = "wss://YOUR-RAILWAY-BACKEND-URL/ws";

// --- Token & Session Management ---
const TOKEN_KEY = 'maria_tiktok_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('maria_user_data');
    localStorage.removeItem('maria_theme');
};

// --- API Client ---
export async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data?.error?.message || 'An unexpected network error occurred.';
            const error = new Error(errorMessage);
            error.code = data?.error?.code || 'API_ERROR';
            error.statusCode = response.status;
            throw error;
        }

        return data.data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Network error: Unable to connect to the backend server.');
        }
        throw error;
    }
}

// --- WebSocket Manager ---
export const WebSocketManager = {
    socket: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    listeners: {},

    connect() {
        const token = getToken();
        if (!token) return;

        this.socket = new WebSocket(`${WS_BASE_URL}?token=${token}`);

        this.socket.onopen = () => {
            console.log('WebSocket connected.');
            this.reconnectAttempts = 0;
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.event && this.listeners[message.event]) {
                    this.listeners[message.event].forEach(callback => callback(message.data));
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        this.socket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
                setTimeout(() => this.connect(), delay);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    },

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    },

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    off(event) {
        if (this.listeners[event]) {
            delete this.listeners[event];
        }
    }
};

// --- UI Utilities ---
export function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast__icon">[${type.charAt(0).toUpperCase()}]</div>
        <div class="toast__content">
            <div class="toast__title">${title}</div>
            <div class="toast__message">${message}</div>
        </div>
        <button class="toast__dismiss">&times;</button>
        <div class="toast__progress"></div>
    `;
    
    container.appendChild(toast);

    const dismissBtn = toast.querySelector('.toast__dismiss');
    const dismiss = () => toast.remove();
    
    dismissBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, 5000);
}

export function toggleTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('maria_theme', theme);
}

// --- Authentication Logic ---
export async function login(email, password) {
    // Mock implementation: Send to backend /api/v1/auth/verify
    const data = await apiRequest('/api/v1/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ idToken: "FIREBASE_ID_TOKEN_OR_CREDENTIAL" }) 
    });
    
    if (data.token) {
        setToken(data.token);
        localStorage.setItem('maria_user_data', JSON.stringify(data.user));
        return true;
    }
    return false;
}

export async function logout() {
    try {
        // Optionally notify backend
    } catch (e) {
        console.warn('Backend logout call failed.');
    } finally {
        WebSocketManager.disconnect();
        clearSession();
        window.location.href = 'index.html';
    }
}

let authMode = 'login';

function setAuthMode(mode) {
    authMode = mode;
    const loginCard = document.getElementById('login-card');
    const signupCard = document.getElementById('signup-card');
    
    if (!loginCard || !signupCard) return; // Not on auth page
    
    if (mode === 'signup') {
        loginCard.hidden = true;
        signupCard.hidden = false;
    } else {
        loginCard.hidden = false;
        signupCard.hidden = true;
    }
    
    // Restart animation on the visible card
    const activeCard = mode === 'signup' ? signupCard : loginCard;
    activeCard.classList.remove('animate-card-enter');
    void activeCard.offsetWidth;
    activeCard.classList.add('animate-card-enter');
    
    // Scroll to auth section smoothly
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Brand Asset Injection ---
function injectBrandAssets() {
    // Logos
    const logoElements = document.querySelectorAll('[data-brand-logo]');
    logoElements.forEach(el => {
        if (BRAND_CONFIG.logoUrl) {
            el.innerHTML = `<img src="${BRAND_CONFIG.logoUrl}" alt="${BRAND_CONFIG.name} Logo" style="height: 32px; width: auto;">`;
        } else {
            el.textContent = BRAND_CONFIG.name;
        }
    });

    // Favicon
    if (BRAND_CONFIG.faviconUrl) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = BRAND_CONFIG.faviconUrl;
    }

    // Hero Image
    const heroContainer = document.getElementById('hero-image-container');
    if (heroContainer) {
        if (BRAND_CONFIG.heroImageUrl) {
            heroContainer.innerHTML = `<img src="${BRAND_CONFIG.heroImageUrl}" alt="Platform Hero Image" class="card">`;
        } else {
            // CSS Mockup fallback
            heroContainer.innerHTML = `
                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">Dashboard Preview</h3>
                        <span class="badge badge--success">LIVE</span>
                    </div>
                    <div class="card__body">
                        <div class="doc-grid">
                            <div class="stat-card">
                                <div class="stat-card__top"><span class="stat-card__label">Viewers</span></div>
                                <div class="stat-card__value">1,204</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-card__top"><span class="stat-card__label">Comments</span></div>
                                <div class="stat-card__value">4,532</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // Dashboard Preview Image
    const dashPreview = document.getElementById('dashboard-preview-container');
    if (dashPreview) {
        if (BRAND_CONFIG.dashboardPreviewImageUrl) {
            dashPreview.innerHTML = `<img src="${BRAND_CONFIG.dashboardPreviewImageUrl}" alt="Dashboard Preview" style="width: 100%; border-radius: 8px;">`;
        } else {
            // CSS Mockup fallback
            dashPreview.innerHTML = `
                <div class="doc-grid">
                    <div class="stat-card">
                        <div class="stat-card__top"><span class="stat-card__label">LIVE Status</span></div>
                        <div class="stat-card__value text-success">Connected</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card__top"><span class="stat-card__label">Active Automations</span></div>
                        <div class="stat-card__value">5</div>
                    </div>
                </div>
                <div class="table-responsive" style="margin-top: 2rem;">
                    <table class="table">
                        <thead><tr><th>Event</th><th>Status</th></tr></thead>
                        <tbody>
                            <tr><td>Greeting Sent</td><td><span class="badge badge--success">Success</span></td></tr>
                            <tr><td>Command Executed</td><td><span class="badge badge--success">Success</span></td></tr>
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
}

// --- Route Guard & Initialization ---
function handleRouting() {
    const path = window.location.pathname.split('/').pop();
    const token = getToken();

    const publicPages = ['index.html', 'terms.html', ''];
    const isPublicPage = publicPages.includes(path);

    if (token) {
        if (path === 'index.html' || path === '') {
            window.location.href = 'dashboard.html';
            return;
        }
    } else {
        if (!isPublicPage) {
            window.location.href = 'index.html';
            return;
        }
    }
}

// --- DOM Event Listeners ---
function initLandingPage() {
    if (window.location.pathname.split('/').pop() !== 'index.html' && window.location.pathname !== '/') return;

    // Inject Brand Assets
    injectBrandAssets();

    // Auth Mode Toggles
    document.querySelectorAll('[data-action="signup"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            setAuthMode('signup');
        });
    });

    document.querySelectorAll('[data-action="login"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            setAuthMode('login');
        });
    });

    // Mobile Navigation
    const navbarToggle = document.getElementById('navbar-toggle');
    const mobileNav = document.getElementById('mobile-nav-menu');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    
    const openMobileNav = () => {
        mobileNav.hidden = false;
        mobileOverlay.hidden = false;
        mobileNav.classList.add('active');
        mobileOverlay.classList.add('active');
    };

    const closeMobileNav = () => {
        mobileNav.hidden = true;
        mobileOverlay.hidden = true;
        mobileNav.classList.remove('active');
        mobileOverlay.classList.remove('active');
    };

    if (navbarToggle) navbarToggle.addEventListener('click', openMobileNav);
    const closeBtn = document.getElementById('close-mobile-nav');
    if (closeBtn) closeBtn.addEventListener('click', closeMobileNav);
    if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileNav);
    
    document.querySelectorAll('[data-close-mobile]').forEach(item => {
        item.addEventListener('click', closeMobileNav);
    });

    // Auth Forms Logic
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const closeForgotModalBtn = document.getElementById('close-forgot-modal');
    const cancelForgotModalBtn = document.getElementById('cancel-forgot-modal');

    const setupPasswordToggle = (toggleId, inputId) => {
        const btn = document.getElementById(toggleId);
        if(!btn) return;
        btn.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });
    };
    setupPasswordToggle('toggle-login-password', 'login-password');
    setupPasswordToggle('toggle-signup-password', 'signup-password');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordModal.hidden = false;
            forgotPasswordModal.classList.add('active');
        });
    }

    const closeModal = () => {
        forgotPasswordModal.hidden = true;
        forgotPasswordModal.classList.remove('active');
    };
    if (closeForgotModalBtn) closeForgotModalBtn.addEventListener('click', closeModal);
    if (cancelForgotModalBtn) cancelForgotModalBtn.addEventListener('click', closeModal);

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-button');
            const spinner = document.getElementById('login-spinner');
            const errorArea = document.getElementById('login-error-area');
            const errorMsg = document.getElementById('login-error-message');
            
            btn.disabled = true;
            spinner.hidden = false;
            errorArea.hidden = true;

            try {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                await login(email, password); 
                window.location.href = 'dashboard.html';
            } catch (error) {
                errorMsg.textContent = error.message;
                errorArea.hidden = false;
                btn.disabled = false;
                spinner.hidden = true;
            }
        });
    }
}

// --- Initialize on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('maria_theme') || 'dark';
    toggleTheme(savedTheme);

    handleRouting();
    initLandingPage();
});