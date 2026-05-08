document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('my-clubs-grid');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('searchMyClubs');

    grid.innerHTML = '<p class="loading-text">Loading your clubs...</p>';

    let currentUser = null;
    try { currentUser = await window.ClubFinderAuth.getCurrentUser(); } catch (e) {}

    if (!currentUser) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    let myClubs = [];
    try {
        const { data, error } = await window.sbClient
            .from('club_members')
            .select('clubs(*)')
            .eq('user_id', currentUser.id);
            
        if (error) throw error;
        // Supabase returns an array of objects where 'clubs' contains the club data
        myClubs = (data || []).map(d => d.clubs).filter(c => c !== null);
    } catch (err) {
        console.error('Failed to fetch clubs:', err);
        grid.innerHTML = '<p class="error-text">Failed to load your clubs.</p>';
        return;
    }

    function renderClubs(clubArray) {
        grid.innerHTML = '';
        if (clubArray.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        grid.style.display = '';
        emptyState.style.display = 'none';

        clubArray.forEach(club => {
            const card = document.createElement('div');
            card.classList.add('club-card');
            card.innerHTML = `
                <img src="${club.image_url || 'https://picsum.photos/400/200?random=' + club.id}" alt="${club.name}">
                <div class="club-content">
                    <h4>${club.name}</h4>
                    <p>${club.description}</p>
                </div>
            `;
            card.addEventListener('click', () => { window.location.href = `club.html?id=${club.id}`; });
            grid.appendChild(card);
        });
    }

    renderClubs(myClubs);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            renderClubs(myClubs.filter(c => c.name.toLowerCase().includes(value)));
        });
    }
});
