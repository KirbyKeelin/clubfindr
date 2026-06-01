/*  ================================================
    ClubFinder — Auth (Supabase) & Global Scripts
    ================================================  */

// Global Dark Mode Persistence
if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
}

(function () {
    const ALLOWED_DOMAIN = 'scrprep.org';

    /* ---------- Public API ---------- */

    async function registerUser(email, password, displayName) {
        email = email.trim().toLowerCase();
        displayName = displayName.trim();

        if (!email || !password || !displayName) {
            return { success: false, message: 'All fields are required.' };
        }

        if (password.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters.' };
        }

        if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
            return { success: false, message: 'You must use a @' + ALLOWED_DOMAIN + ' email address.' };
        }

        const { data, error } = await window.sbClient.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName }
            }
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true };
    }

    async function loginUser(email, password) {
        email = email.trim().toLowerCase();

        if (!email || !password) {
            return { success: false, message: 'Email and password are required.' };
        }

        const { data, error } = await window.sbClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true };
    }

    async function getCurrentUser() {
        const { data: { session } } = await window.sbClient.auth.getSession();
        if (!session) return null;

        const user = session.user;

        // Fetch profile from our profiles table
        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return {
            id: user.id,
            email: user.email,
            displayName: profile?.display_name || user.email.split('@')[0],
            username: profile?.username || user.email.split('@')[0],
            bio: profile?.bio || '',
            avatarUrl: profile?.avatar_url || null,
            isAdmin: profile?.is_admin || false
        };
    }

    async function logout() {
        await window.sbClient.auth.signOut();
        window.location.href = 'signin.html';
    }

    async function getAccessToken() {
        const { data: { session } } = await window.sbClient.auth.getSession();
        return session?.access_token || null;
    }

    async function authHeaders() {
        const token = await getAccessToken();
        return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    /* ---------- Auth Guard ---------- */

    const path = window.location.pathname.replace(/^.*[/\\]/, '').toLowerCase();
    const isSignInPage = path === 'signin.html';
    const isSetupProfilePage = path === 'setup-profile.html';

    // We use DOMContentLoaded so body/document is ready if we need it,
    // but we can start the session check immediately.
    window.sbClient.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) {
            if (!isSignInPage) {
                window.location.href = 'signin.html';
            }
        } else {
            // User is authenticated
            const { data: profile } = await window.sbClient
                .from('profiles')
                .select('display_name')
                .eq('id', session.user.id)
                .single();

            const hasDisplayName = profile && profile.display_name && profile.display_name.trim().length > 0;

            if (!hasDisplayName && !isSetupProfilePage && !isSignInPage) {
                // Needs profile setup, but isn't on setup page
                window.location.href = 'setup-profile.html';
            } else if (hasDisplayName && isSetupProfilePage) {
                // Has profile setup, shouldn't be on setup page
                window.location.href = 'index.html';
            } else if (isSignInPage) {
                // If they are on signin but already have a session, send them to the appropriate place
                window.location.href = hasDisplayName ? 'index.html' : 'setup-profile.html';
            }

            // Inject Admin link if user is admin
            if (profile?.is_admin && !isSignInPage && !isSetupProfilePage) {
                const addAdminLink = () => {
                    const sidebarNav = document.querySelector('.sidebar-left nav');
                    if (sidebarNav && !sidebarNav.querySelector('a[href="admin.html"]')) {
                        const adminLink = document.createElement('a');
                        adminLink.href = 'admin.html';
                        adminLink.className = 'menu-item';
                        adminLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span style="color:#ef4444; font-weight:bold;">Admin Panel</span>`;
                        sidebarNav.appendChild(adminLink);
                    }
                };
                
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', addAdminLink);
                } else {
                    addAdminLink();
                }
            }
        }
    });

    /* ---------- Wire up Sign Out links + Mobile Sidebar ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        // Sign out
        document.querySelectorAll('[data-action="sign-out"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        });

        // Mobile sidebar — inject hamburger on non-signin pages
        const sidebar = document.querySelector('.sidebar-left');
        if (sidebar && !isSignInPage) {
            const hamburger = document.createElement('button');
            hamburger.className = 'mobile-hamburger';
            hamburger.setAttribute('aria-label', 'Open menu');
            hamburger.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>';
            document.body.appendChild(hamburger);

            const overlay = document.createElement('div');
            overlay.className = 'mobile-overlay';
            document.body.appendChild(overlay);

            function openSidebar() {
                sidebar.classList.add('mobile-open');
                overlay.classList.add('active');
            }

            function closeSidebar() {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
            }

            hamburger.addEventListener('click', openSidebar);
            overlay.addEventListener('click', closeSidebar);

            sidebar.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', closeSidebar);
            });
        }

        // Notification Center
        if (!isSignInPage && !isSetupProfilePage) {
            const notifContainer = document.createElement('div');
            notifContainer.id = 'notif-container';
            notifContainer.innerHTML = `
                <style>
                    #notif-bell-btn {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        z-index: 1000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.2s;
                    }
                    #notif-bell-btn:hover { transform: scale(1.05); }
                    body.dark-mode #notif-bell-btn { background: #2563eb; }
                    #notif-badge {
                        position: absolute;
                        top: -2px;
                        right: -2px;
                        background: #ef4444;
                        color: white;
                        font-size: 11px;
                        font-weight: bold;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid white;
                    }
                    body.dark-mode #notif-badge { border-color: #1f2937; }
                    #notif-dropdown {
                        position: fixed;
                        bottom: 80px;
                        right: 20px;
                        width: 320px;
                        max-height: 400px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                        z-index: 1000;
                        display: none;
                        flex-direction: column;
                        overflow-y: auto;
                        border: 1px solid #ddd;
                    }
                    body.dark-mode #notif-dropdown { background: #1f2937; border-color: #374151; color: white; }
                    .notif-header {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-weight: bold;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        background: white;
                    }
                    body.dark-mode .notif-header { border-bottom-color: #374151; background: #1f2937; }
                    .notif-item {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                    }
                    body.dark-mode .notif-item { border-bottom-color: #374151; }
                    .notif-item:hover { background: #f9fafb; }
                    body.dark-mode .notif-item:hover { background: #374151; }
                    .notif-item.unread { background: #eff6ff; }
                    body.dark-mode .notif-item.unread { background: #1e3a8a; }
                    .notif-title { font-weight: bold; margin-bottom: 5px; font-size: 14px; }
                    body.dark-mode .notif-title { color: #f9fafb; }
                    .notif-msg { font-size: 13px; color: #555; margin-bottom: 8px; }
                    body.dark-mode .notif-msg { color: #f3f4f6; }
                    .notif-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888; }
                    body.dark-mode .notif-footer { color: #aaa; }
                    .notif-club { font-weight: bold; color: #3b82f6; }
                    body.dark-mode .notif-club { color: #60a5fa; }
                    .notif-actions { display: flex; gap: 8px; }
                    .notif-action-btn { background: none; border: none; font-size: 11px; cursor: pointer; color: #888; padding: 2px 4px; border-radius: 4px; }
                    .notif-action-btn:hover { background: #eee; color: #333; }
                    body.dark-mode .notif-action-btn:hover { background: #374151; color: #fff; }
                    .notif-action-btn.delete-btn:hover { color: #ef4444; }
                    .mark-all-btn { font-size: 12px; color: #3b82f6; cursor: pointer; border:none; background:none; margin-left: 10px; }
                    .clear-all-btn { font-size: 12px; color: #ef4444; cursor: pointer; border:none; background:none; }
                    .header-actions { display: flex; gap: 5px; }
                    /* Scrollbar for dropdown */
                    #notif-dropdown::-webkit-scrollbar { width: 8px; }
                    #notif-dropdown::-webkit-scrollbar-track { background: transparent; }
                    #notif-dropdown::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                    body.dark-mode #notif-dropdown::-webkit-scrollbar-thumb { background: #4b5563; }
                </style>
                <button id="notif-bell-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    <div id="notif-badge">0</div>
                </button>
                <div id="notif-dropdown">
                    <div class="notif-header">
                        <span>Notifications</span>
                        <div class="header-actions">
                            <button class="mark-all-btn" id="notif-mark-read">Mark Read</button>
                            <button class="clear-all-btn" id="notif-clear-all">Clear All</button>
                        </div>
                    </div>
                    <div id="notif-list"></div>
                </div>
            `;
            document.body.appendChild(notifContainer);

            const bellBtn = document.getElementById('notif-bell-btn');
            const dropdown = document.getElementById('notif-dropdown');
            const badge = document.getElementById('notif-badge');
            const list = document.getElementById('notif-list');
            const markAllBtn = document.getElementById('notif-mark-read');
            const clearAllBtn = document.getElementById('notif-clear-all');

            let unreadIds = [];

            // Helper for relative time
            function timeAgo(dateInput) {
                const date = new Date(dateInput);
                const now = new Date();
                const seconds = Math.round((now - date) / 1000);
                const minutes = Math.round(seconds / 60);
                const hours = Math.round(minutes / 60);
                const days = Math.round(hours / 24);

                if (seconds < 60) return 'Just now';
                if (minutes === 1) return '1 min ago';
                if (minutes < 60) return minutes + ' mins ago';
                if (hours === 1) return '1 hour ago';
                if (hours < 24) return hours + ' hours ago';
                if (days === 1) return '1 day ago';
                return days + ' days ago';
            }

            bellBtn.addEventListener('click', () => {
                dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
                if(dropdown.style.display === 'flex') {
                    fetchNotifications();
                }
            });

            markAllBtn.addEventListener('click', async () => {
                if(unreadIds.length === 0) return;
                await window.sbClient.from('notifications').update({is_read: true}).in('id', unreadIds);
                await fetchNotifications();
            });

            clearAllBtn.addEventListener('click', async () => {
                const user = await getCurrentUser();
                if(!user) return;
                if(confirm('Are you sure you want to delete all notifications?')) {
                    await window.sbClient.from('notifications').delete().eq('user_id', user.id);
                    await fetchNotifications();
                }
            });

            window.markNotifRead = async function(id) {
                await window.sbClient.from('notifications').update({is_read: true}).eq('id', id);
                await fetchNotifications();
            };

            window.deleteNotif = async function(id) {
                await window.sbClient.from('notifications').delete().eq('id', id);
                await fetchNotifications();
            };

            async function fetchNotifications() {
                try {
                    const user = await getCurrentUser();
                    if(!user) return;
                    
                    const { data } = await window.sbClient
                        .from('notifications')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(20);
                    
                    if(data) {
                        const unread = data.filter(n => !n.is_read);
                        unreadIds = unread.map(n => n.id);
                        
                        if(unread.length > 0) {
                            badge.style.display = 'flex';
                            badge.textContent = unread.length;
                        } else {
                            badge.style.display = 'none';
                        }

                        if(data.length === 0) {
                            list.innerHTML = '<div style="padding:15px; text-align:center; color:#777; font-size:14px;">No notifications</div>';
                        } else {
                            list.innerHTML = data.map(n => `
                                <div class="notif-item ${n.is_read ? '' : 'unread'}">
                                    <div class="notif-title">${n.title}</div>
                                    <div class="notif-msg">${n.message}</div>
                                    <div class="notif-footer">
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            ${n.club_name ? `<span class="notif-club">${n.club_name}</span>` : ''}
                                            <span class="notif-time">${timeAgo(n.created_at)}</span>
                                        </div>
                                        <div class="notif-actions">
                                            ${!n.is_read ? `<button class="notif-action-btn" onclick="window.markNotifRead('${n.id}')">Mark Read</button>` : ''}
                                            <button class="notif-action-btn delete-btn" onclick="window.deleteNotif('${n.id}')">✕</button>
                                        </div>
                                    </div>
                                </div>
                            `).join('');
                        }
                    }
                } catch(e) {}
            }

            fetchNotifications();
            setInterval(fetchNotifications, 30000);
        }

        // ==========================================
        // GLOBAL TOAST NOTIFICATION SYSTEM
        // ==========================================
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);

        const toastStyles = document.createElement('style');
        toastStyles.innerHTML = `
            #toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .toast {
                min-width: 250px;
                background: white;
                color: #333;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                transform: translateX(120%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                border-left: 5px solid #3b82f6;
            }
            .toast.show {
                transform: translateX(0);
                opacity: 1;
            }
            body.dark-mode .toast {
                background: #1f2937;
                color: #f9fafb;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .toast.success { border-left-color: #10b981; }
            .toast.error { border-left-color: #ef4444; }
        `;
        document.head.appendChild(toastStyles);

        window.showToast = function(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icon = type === 'success' ? '✅' : '⚠️';
            toast.innerHTML = `<span>${icon}</span><span style="flex:1; font-size:14px;">${message}</span>`;
            
            toastContainer.appendChild(toast);
            
            // Trigger animation
            setTimeout(() => toast.classList.add('show'), 10);
            
            // Remove after 3.5s
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        };
    });

    /* ---------- Expose globally ---------- */
    window.ClubFinderAuth = {
        registerUser,
        loginUser,
        getCurrentUser,
        logout,
        getAccessToken,
        authHeaders
    };
})();
