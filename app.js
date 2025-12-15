const API_URL = '/api/textes';
let tousLesTextes = [];
let pageActuelle = 1;
let itemsParPage = 12; // Par défaut, sera ajusté dynamiquement

async function chargerTextes() {
    try {
        const response = await fetch(API_URL);
        tousLesTextes = await response.json();
        calculerItemsParPage();
        afficherTextes();
    } catch (error) {
        console.error('Erreur lors du chargement des textes:', error);
        document.getElementById('liste-textes').innerHTML = '<li>Erreur lors du chargement des textes</li>';
    }
}

function calculerItemsParPage() {
    // Calculer le nombre de colonnes basé sur la largeur de la grille
    const grille = document.getElementById('liste-textes');
    if (!grille) return;
    
    const style = window.getComputedStyle(grille);
    const gap = parseInt(style.gap) || 20;
    const padding = parseInt(style.paddingLeft) + parseInt(style.paddingRight) || 40;
    const largeurDisponible = grille.clientWidth - padding;
    const largeurCarte = 200; // minmax(200px, 1fr)
    const nombreColonnes = Math.floor((largeurDisponible + gap) / (largeurCarte + gap));
    
    // 3 lignes de cartes
    itemsParPage = Math.max(nombreColonnes * 3, 9); // Minimum 9 items
}

function afficherTextes() {
    const liste = document.getElementById('liste-textes');
    liste.innerHTML = '';
    
    const debut = (pageActuelle - 1) * itemsParPage;
    const fin = debut + itemsParPage;
    const textesAPager = tousLesTextes.slice(debut, fin);
    
    textesAPager.forEach(texte => {
        const card = document.createElement('a');
        card.href = `texte.html?slug=${texte.slug}`;
        card.className = texte.image ? 'card' : 'card card-no-image';
        
        if (texte.image) {
            const imageUrl = `/api/image/${encodeURIComponent(texte.image)}`;
            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <img 
                            src="${imageUrl}" 
                            alt="${texte.title}" 
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                    <div class="card-back">
                        <div class="card-title">
                            ${texte.title}
                        </div>
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <div class="card-title">
                            ${texte.title}
                        </div>
                    </div>
                    <div class="card-back">
                        <div class="card-title">
                            ${texte.title}
                        </div>
                    </div>
                </div>
            `;
        }
        
        liste.appendChild(card);
    });
    
    afficherPagination();
}

function afficherPagination() {
    const totalPages = Math.ceil(tousLesTextes.length / itemsParPage);
    
    let pagination = document.getElementById('pagination');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'pagination';
        document.querySelector('main').appendChild(pagination);
    }
    
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Bouton précédent
    const btnPrev = document.createElement('button');
    btnPrev.className = 'pagination-btn';
    btnPrev.textContent = '←';
    btnPrev.disabled = pageActuelle === 1;
    btnPrev.onclick = () => changerPage(pageActuelle - 1);
    pagination.appendChild(btnPrev);
    
    // Numéros de pages
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= pageActuelle - 1 && i <= pageActuelle + 1)) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${i === pageActuelle ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => changerPage(i);
            pagination.appendChild(btn);
        } else if (i === pageActuelle - 2 || i === pageActuelle + 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            span.className = 'pagination-dots';
            pagination.appendChild(span);
        }
    }
    
    // Bouton suivant
    const btnNext = document.createElement('button');
    btnNext.className = 'pagination-btn';
    btnNext.textContent = '→';
    btnNext.disabled = pageActuelle === totalPages;
    btnNext.onclick = () => changerPage(pageActuelle + 1);
    pagination.appendChild(btnNext);
}

function changerPage(nouvellePage) {
    if (nouvellePage < 1 || nouvellePage > Math.ceil(tousLesTextes.length / itemsParPage)) return;
    pageActuelle = nouvellePage;
    afficherTextes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Recalculer lors du redimensionnement
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        calculerItemsParPage();
        pageActuelle = 1;
        afficherTextes();
    }, 250);
});

// Charger les textes au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTextes);

