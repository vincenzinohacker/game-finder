// script.js

// Ensure gamesData is available
if (typeof gamesData === 'undefined') {
    console.error("Game data not found!");
    alert("Error: Game data could not be loaded.");
}

const elements = {
    gamesGrid: document.getElementById('gamesGrid'),
    playersInput: document.getElementById('playersInput'),
    priceSelect: document.getElementById('priceSelect'),
    categorySelect: document.getElementById('categorySelect'),
    moodSelect: document.getElementById('moodSelect'),
    platformSelect: document.getElementById('platformSelect'),
    findBtn: document.getElementById('findBtn'),
    resultsCount: document.getElementById('resultsCount')
};

// Normalization Rules
const CATEGORY_GROUPS = {
    "Party": ["Party", "Party Mobile", "Party Action", "Social", "Indovina", "Gridare", "Spie"],
    "Social Deduction": ["Social Deduction"],
    "Action / Arcade": ["Arcade", "FPS", "Shooter", "Runner", "Volo", "Fisica", "CTF", "Battle Royale", "Fighting", "Corse", "Sport", "Dungeon", "Tower Defense", "Rhythm"],
    "Strategy / Board": ["Strategia", "Tavolo", "Board", "Carte", "Chess", "Classico", "Turni"],
    "Puzzle / Logic": ["Puzzle", "Logica", "Idle", "Fisica Puzzle", "FPS Puzzle", "Horror Card"],
    "Adventure / RPG": ["Avventura", "RPG", "Survival", "Sandbox", "Exploration", "Horror", "Mistero"],
    "Casual / Creative": ["Disegno", "Parole", "Quiz", "Musica", "Cultura", "Creativo", "Relax"]
};

const MOOD_GROUPS = {
    "Fun & Funny": ["Divertente", "Assurdo", "Umoristico", "Strambo", "Fan", "Nerd", "Passatempo", "Vari"],
    "Competitive": ["Competitivo", "Skill", "Hardcore", "Sfida", "Tattico", "Distruttivo", "Veloce", "Reflessi", "Ranked"],
    "Team & Social": ["Team", "Teamwork", "Social", "Ruolo", "Tradimento", "Bluff", "Gridare", "Spie", "Investigativo", "Adulti"],
    "Relax & Chill": ["Relax", "Casual", "Creativo", "Poetico", "Arte", "Misterioso", "Curioso", "Offline", "Retro", "Nostalgia", "Filosofico", "Spazio 2D", "Mining", "Vampiri", "Pixel", "Zombie", "Audio"],
    "Brainy": ["Mentale", "Logica", "Puzzle", "Quiz", "Educativo", "Matematico", "Cultura", "Scacchi"],
    "Intense": ["Frenetico", "Ansia", "Violento", "Caotico", "Azione", "Survival", "Matrix", "Meta"]
};

// Global Image Error Handler with Fallback Strategy
function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

window.handleImageError = function (img) {
    const originalUrl = img.getAttribute('data-original-url');
    // Track attempts on the element itself
    let attempts = parseInt(img.getAttribute('data-attempts') || '0');

    attempts++;
    img.setAttribute('data-attempts', attempts);

    const domain = getDomain(originalUrl);
    if (!domain) {
        // Fallback immediately if no valid domain
        img.src = 'https://via.placeholder.com/150/1e293b/FFFFFF?text=Game';
        img.onerror = null; // Prevent infinite loop
        return;
    }

    if (attempts === 1) {
        // Attempt 2: Google Favicon
        // Note: We use sz=128 because sz=512 often returns blurry upscaled versions of small icons.
        // 128 is the 'sweet spot' for crispness on this card size.
        img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } else if (attempts === 2) {
        // Attempt 3: Icon Horse (Another reliable source)
        img.src = `https://icon.horse/icon/${domain}`;
    } else {
        // Final Fallback: Generic Placeholder
        img.src = 'https://via.placeholder.com/150/1e293b/FFFFFF?text=Game';
        img.onerror = null; // Stop trying
    }
};

// State
let filteredGames = [];
let hasSearched = false;

// Initialize
function init() {
    processData(); // Normalize data
    console.log(`Loaded ${filteredGames.length} games.`);
    populateFilters();
    // note: We DO NOT render games initially. The user sees only the Hero Search.

    // Event Listeners
    elements.findBtn.addEventListener('click', () => {
        revealResults();
        filterGames();
    });

    // Allow 'Enter' in any input to trigger search
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            revealResults();
            filterGames();
        }
    });
}

function revealResults() {
    if (!hasSearched) {
        hasSearched = true;
        document.querySelector('.app-container').classList.add('results-active');
        // Optional: Scroll to results slightly if needed, but flex layout handles it
    }
}

function processData() {
    filteredGames = gamesData.map(game => {
        const enhancedGame = { ...game };

        // 1. Normalize Price
        const priceLower = game.price.toLowerCase();
        if (priceLower.includes("gratis") || priceLower.includes("freemium") || priceLower.includes("free")) {
            enhancedGame.normPrice = "Free / Freemium";
        } else {
            enhancedGame.normPrice = "Paid";
        }

        // 2. Normalize Category
        enhancedGame.broadCategory = "Other";
        for (const [group, keywords] of Object.entries(CATEGORY_GROUPS)) {
            if (keywords.includes(game.category) || keywords.some(k => game.category.includes(k))) {
                enhancedGame.broadCategory = group;
                break;
            }
        }

        // 3. Normalize Mood
        enhancedGame.normMood = "Other";
        for (const [group, keywords] of Object.entries(MOOD_GROUPS)) {
            if (keywords.includes(game.mood) || keywords.some(k => game.mood && game.mood.includes(k))) {
                enhancedGame.normMood = group;
                break;
            }
        }

        // 4. Infer Platform
        enhancedGame.platforms = [];
        const combinedInfo = (game.category + " " + game.price + " " + game.url).toLowerCase();

        if (combinedInfo.includes("mobile") || combinedInfo.includes("app") || combinedInfo.includes("ios") || combinedInfo.includes("android")) {
            enhancedGame.platforms.push("Mobile");
        }
        if (combinedInfo.includes("steam") || combinedInfo.includes("windows") || combinedInfo.includes("mac")) {
            enhancedGame.platforms.push("PC");
        }
        // If not specific mobile/steam, assume Web (or if url is standard)
        if (!enhancedGame.platforms.includes("Mobile") && !enhancedGame.platforms.includes("PC")) {
            enhancedGame.platforms.push("Web");
        } else if (combinedInfo.includes("http") && !combinedInfo.includes("steam") && !combinedInfo.includes("app")) {
            // Check for cross-platform web
            if (!enhancedGame.platforms.includes("Web")) enhancedGame.platforms.push("Web");
        }

        return enhancedGame;
    });
}

// Helper to populate select
function populateSelect(element, values) {
    values.sort().forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        element.appendChild(option);
    });
}

// Populate Dropdowns
function populateFilters() {
    // Categories (Broad)
    populateSelect(elements.categorySelect, Object.keys(CATEGORY_GROUPS).sort());

    // Prices (Normalized)
    populateSelect(elements.priceSelect, ["Free / Freemium", "Paid"]);

    // Moods (Normalized)
    populateSelect(elements.moodSelect, Object.keys(MOOD_GROUPS).sort());

    // Platforms
    populateSelect(elements.platformSelect, ["Web", "Mobile", "PC"]);
}

// Filter Logic
function filterGames() {
    const players = parseInt(elements.playersInput.value);
    const price = elements.priceSelect.value;
    const category = elements.categorySelect.value;
    const currentMood = elements.moodSelect.value; // Store current selection
    const platform = elements.platformSelect.value;

    // 1. Calculate matches for "Other" filters (to update Mood dropdown)
    const contextResults = filteredGames.filter(game => {
        // Player filter
        let playersMatch = true;
        if (!isNaN(players)) {
            playersMatch = players >= game.players.min && players <= game.players.max;
        }

        // Price filter
        let priceMatch = price === 'any' || game.normPrice === price;

        // Category filter
        let categoryMatch = category === 'any' || game.broadCategory === category;

        // Platform filter
        let platformMatch = platform === 'any' || game.platforms.includes(platform);

        return playersMatch && priceMatch && categoryMatch && platformMatch;
    });

    // 2. Update Mood Dropdown based on Context Results
    updateMoodDropdown(contextResults, currentMood);

    // 3. Apply Mood Filter to get Final Results
    const finalResults = contextResults.filter(game => {
        return currentMood === 'any' || game.normMood === currentMood;
    });

    renderGames(finalResults);
}

// Helper to update Moods dynamically
function updateMoodDropdown(games, currentSelection) {
    const availableMoods = new Set(games.map(g => g.normMood).filter(Boolean));
    const sortedMoods = [...availableMoods].sort();

    // Clear current options (keep 'Any')
    elements.moodSelect.innerHTML = '<option value="any">Any Mood</option>';

    sortedMoods.forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        if (val === currentSelection) {
            option.selected = true;
        }
        elements.moodSelect.appendChild(option);
    });
}

// Render Grid
function renderGames(games) {
    elements.gamesGrid.innerHTML = '';
    elements.resultsCount.textContent = `${games.length} games found`;

    if (games.length === 0) {
        elements.gamesGrid.innerHTML = '<p class="no-results">No games found matching these criteria.</p>';
        return;
    }

    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';

        // Generate Platform Icons
        const platformIcons = game.platforms.map(p => {
            if (p === 'Mobile') return '📱';
            if (p === 'PC') return '💻';
            return '🌐';
        }).join(' ');

        // Player Text Logic
        const minPlayers = parseInt(game.players.min);
        const maxPlayers = parseInt(game.players.max);
        let playerText = `${minPlayers} - ${maxPlayers}`;
        if (minPlayers === maxPlayers) {
            playerText = minPlayers === 1 ? "1 Player" : `${minPlayers} Players`;
        } else {
            playerText += " Players";
        }

        card.innerHTML = `
            <a href="${game.url}" target="_blank" class="card-link">
                <div class="card-image-container">
                    <img src="${game.image_url}" 
                         data-original-url="${game.url}"
                         alt="${game.name}" 
                         class="card-image" 
                         onerror="handleImageError(this)">
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <h3 class="card-title">${game.name}</h3>
                        <div class="card-tags">
                            <span class="tag category">${game.broadCategory}</span>
                        </div>
                    </div>
                    
                    <div class="card-sub-info">
                        <span class="sub-price">${game.normPrice}</span>
                        <span class="dot">•</span>
                        <span class="sub-mood">${game.normMood}</span>
                    </div>

                    <div class="card-info-row">
                        <div class="card-players">
                            <span>👥</span> ${playerText}
                        </div>
                         <div class="card-platform" title="${game.platforms.join(', ')}">
                            ${platformIcons}
                        </div>
                    </div>
                </div>
            </a>
        `;
        elements.gamesGrid.appendChild(card);
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
