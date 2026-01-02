/* --- Config & State --- */
const POKEAPI_BASE = 'https://pokeapi.co/api/v2/pokemon';
const TYPE_COLORS = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
    steel: '#B7B7CE', fairy: '#D685AD'
};

let state = {
    offset: 0,
    limit: 51,
    isLoading: false,
    currentData: null
};

/* --- DOM Elements --- */
const grid = document.getElementById('pokeGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('pokemonModal');
const shinyBtn = document.getElementById('shinyBtn');
const soundBtn = document.getElementById('soundBtn');

let isShiny = false;

/* --- Init --- */
document.addEventListener('DOMContentLoaded', () => {
    fetchPokemonBatch();
    generateFilters();
});

/* --- Data Fetching --- */
async function fetchPokemonBatch() {
    if (state.isLoading) return;
    state.isLoading = true;
    loader.classList.remove('hidden');

    try {
        const res = await fetch(`${POKEAPI_BASE}?offset=${state.offset}&limit=${state.limit}`);
        const data = await res.json();
        const detailsPromises = data.results.map(p => fetch(p.url).then(r => r.json()));
        const pokemons = await Promise.all(detailsPromises);

        renderPokemons(pokemons);
        state.offset += state.limit;
    } catch (err) {
        console.error(err);
    } finally {
        state.isLoading = false;
        loader.classList.add('hidden');
    }
}

/* --- Rendering --- */
function renderPokemons(list) {
    list.forEach(poke => {
        const type = poke.types[0].type.name;
        const color = TYPE_COLORS[type];

        const card = document.createElement('div');
        card.className = 'poke-card';
        card.style.setProperty('--card-color', color);
        card.style.setProperty('--card-color-dim', color + '40');

        const imgUrl = poke.sprites.other['official-artwork'].front_default || poke.sprites.front_default;

        card.innerHTML = `
            <span class="poke-id">#${poke.id.toString().padStart(3, '0')}</span>
            <img src="${imgUrl}" loading="lazy" alt="${poke.name}">
            <div class="poke-info">
                <h3 class="poke-name">${poke.name}</h3>
                <div>
                    ${poke.types.map(t => `<span class="type-badge">${t.type.name}</span>`).join('')}
                </div>
            </div>
        `;

        card.addEventListener('mousemove', (e) => handleTilt(e, card));
        card.addEventListener('mouseleave', () => resetTilt(card));
        card.addEventListener('click', () => openModal(poke, color));

        grid.appendChild(card);
    });
}

/* --- 3D Tilt Logic --- */
function handleTilt(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
}
function resetTilt(card) {
    card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale(1)`;
}

/* --- Modal & Features --- */
function openModal(poke, color) {
    state.currentData = poke;
    isShiny = false;
    shinyBtn.textContent = '✨ Shiny';

    document.getElementById('modalName').textContent = poke.name.toUpperCase();
    document.getElementById('modalId').textContent = `#${poke.id}`;
    document.getElementById('modalHeight').textContent = `${poke.height / 10}m`;
    document.getElementById('modalWeight').textContent = `${poke.weight / 10}kg`;

    updateModalImage();

    document.querySelector('.glass-modal').style.setProperty('--modal-glow', color);
    document.getElementById('modalTypes').innerHTML = poke.types.map(t =>
        `<span class="type-badge" style="background:${TYPE_COLORS[t.type.name]}">${t.type.name}</span>`
    ).join('');

    document.getElementById('modalStats').innerHTML = poke.stats.map(s => {
        const val = s.base_stat;
        const width = Math.min((val / 150) * 100, 100);
        return `
            <div class="stat-row">
                <span style="width:50px; font-weight:bold; color:#aaa">${getStatName(s.stat.name)}</span>
                <span style="width:30px; text-align:right">${val}</span>
                <div class="progress-bg"><div class="progress-fill" style="width:${width}%"></div></div>
            </div>`;
    }).join('');

    modal.style.display = 'flex';
}

shinyBtn.onclick = () => {
    isShiny = !isShiny;
    shinyBtn.textContent = isShiny ? 'Normal' : '✨ Shiny';
    updateModalImage();
};

function updateModalImage() {
    const poke = state.currentData;
    const imgEl = document.getElementById('modalImg');
    if (isShiny) {
        imgEl.src = poke.sprites.other['official-artwork'].front_shiny || poke.sprites.front_shiny;
    } else {
        imgEl.src = poke.sprites.other['official-artwork'].front_default;
    }
}

soundBtn.onclick = () => {
    if (state.currentData && state.currentData.cries) {
        const audio = new Audio(state.currentData.cries.latest);
        audio.volume = 0.3;
        audio.play();
    }
};

/* --- Helpers --- */
function getStatName(name) {
    const map = { 'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF', 'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'SPD' };
    return map[name] || name;
}

function generateFilters() {
    const container = document.getElementById('typeFilters');
    Object.keys(TYPE_COLORS).forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = type;
        btn.onclick = () => filterByType(type);
        container.appendChild(btn);
    });
}

async function filterByType(type) {
    grid.innerHTML = '';
    state.isLoading = true;
    loader.classList.remove('hidden');

    const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
    const data = await res.json();
    const list = data.pokemon.map(p => p.pokemon).slice(0, 30);

    const details = await Promise.all(list.map(p => fetch(p.url).then(r => r.json())));
    renderPokemons(details);

    state.isLoading = false;
    loader.classList.add('hidden');
}

document.querySelector('.close-btn').onclick = () => modal.style.display = 'none';
window.onclick = (e) => e.target == modal ? modal.style.display = 'none' : null;

window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        fetchPokemonBatch();
    }
});

/* --- MOBILE MENU LOGIC --- */
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const overlay = document.getElementById('overlay');

function toggleMenu() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeMenu() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMenu);
if (overlay) overlay.addEventListener('click', closeMenu);

// Tip seçiləndə menyunu avtomatik bağla (Mobildə)
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
            closeMenu();
        }
    });
});