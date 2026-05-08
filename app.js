document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('club-grid');
    const searchInput = document.getElementById('searchInput');
    const tagButtons = document.querySelectorAll('.tags button');

    let allClubs = [];
    let activeTag = null;

    // Show loading state
    grid.innerHTML = '<p class="loading-text">Loading clubs...</p>';

    // Fetch clubs from API
    try {
        const { data, error } = await window.sbClient
            .from('clubs')
            .select('*')
            .eq('status', 'approved');
            
        if (error) throw error;
        allClubs = data || [];
    } catch (err) {
        console.error('Failed to fetch clubs:', err);
        grid.innerHTML = '<p class="error-text">Failed to load clubs. Please refresh the page.</p>';
        return;
    }

    function renderClubs(clubs) {
        grid.innerHTML = '';

        if (clubs.length === 0) {
            grid.innerHTML = '<p class="empty-text">No clubs found.</p>';
            return;
        }

        clubs.forEach(club => {
            const card = document.createElement('div');
            card.classList.add('club-card');
            card.innerHTML = `
                <img src="${club.image_url || 'https://picsum.photos/400/200?random=' + club.id}" alt="${club.name}">
                <div class="club-content">
                    <h4>${club.name}</h4>
                    <p>${club.description}</p>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `club.html?id=${club.id}`;
            });
            grid.appendChild(card);
        });
    }

    function applyFilters() {
        let filtered = allClubs;
        const searchVal = searchInput ? searchInput.value.toLowerCase() : '';

        if (searchVal) {
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(searchVal) ||
                c.description.toLowerCase().includes(searchVal)
            );
        }

        if (activeTag) {
            filtered = filtered.filter(c =>
                (c.tags || []).includes(activeTag)
            );
        }

        renderClubs(filtered);
    }

    renderClubs(allClubs);

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            if (activeTag === tag) {
                activeTag = null;
                btn.style.fontWeight = 'normal';
            } else {
                activeTag = tag;
                tagButtons.forEach(b => b.style.fontWeight = 'normal');
                btn.style.fontWeight = 'bold';
            }
            applyFilters();
        });
    });
});