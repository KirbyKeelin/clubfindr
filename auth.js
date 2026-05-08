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
            avatarUrl: profile?.avatar_url || null
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

