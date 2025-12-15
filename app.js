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

function positionnerFleches() {
    const grille = document.getElementById('liste-textes');
    if (!grille || grille.children.length === 0) return;
    
    // Calculer la position de la 2e ligne
    const premierElement = grille.children[0];
    const rectGrille = grille.getBoundingClientRect();
    const rectPremier = premierElement.getBoundingClientRect();
    const hauteurCarte = rectPremier.height;
    const gap = 20; // gap de la grille
    
    // Position de la 2e ligne (1 ligne de hauteur + gap)
    const topPosition = rectGrille.top + hauteurCarte + gap + (hauteurCarte / 2);
    
    // Mettre à jour la position des flèches
    const flecheGauche = document.querySelector('.nav-arrow-left');
    const flecheDroite = document.querySelector('.nav-arrow-right');
    
    if (flecheGauche) flecheGauche.style.top = `${topPosition}px`;
    if (flecheDroite) flecheDroite.style.top = `${topPosition}px`;
}

function afficherPagination() {
    const totalPages = Math.ceil(tousLesTextes.length / itemsParPage);
    
    // Boutons flèches positionnés de manière fixe
    let navigationContainer = document.getElementById('navigation-container');
    if (!navigationContainer) {
        navigationContainer = document.createElement('div');
        navigationContainer.id = 'navigation-container';
        document.body.appendChild(navigationContainer);
    }
    
    navigationContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        navigationContainer.style.display = 'none';
    } else {
        navigationContainer.style.display = 'block';
        
        // Bouton précédent - affiché seulement si pas sur la première page
        if (pageActuelle > 1) {
            const btnPrev = document.createElement('button');
            btnPrev.className = 'nav-arrow nav-arrow-left';
            btnPrev.innerHTML = '←';
            btnPrev.onclick = () => changerPage(pageActuelle - 1);
            navigationContainer.appendChild(btnPrev);
        }
        
        // Bouton suivant - affiché seulement si pas sur la dernière page
        if (pageActuelle < totalPages) {
            const btnNext = document.createElement('button');
            btnNext.className = 'nav-arrow nav-arrow-right';
            btnNext.innerHTML = '→';
            btnNext.onclick = () => changerPage(pageActuelle + 1);
            navigationContainer.appendChild(btnNext);
        }
        
        // Positionner les flèches après un petit délai pour que le DOM soit rendu
        setTimeout(positionnerFleches, 100);
    }
    
    // Container pour les ronds de pagination
    let pagination = document.getElementById('pagination');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'pagination';
        document.querySelector('main').appendChild(pagination);
    }
    
    pagination.innerHTML = '';
    
    // Petits ronds pour chaque page
    for (let i = 1; i <= totalPages; i++) {
        const dot = document.createElement('button');
        dot.className = `pagination-dot ${i === pageActuelle ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Page ${i}`);
        dot.onclick = () => changerPage(i);
        pagination.appendChild(dot);
    }
}

function changerPage(nouvellePage) {
    if (nouvellePage < 1 || nouvellePage > Math.ceil(tousLesTextes.length / itemsParPage)) return;
    pageActuelle = nouvellePage;
    afficherTextes();
    afficherPagination();
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
        setTimeout(positionnerFleches, 100);
    }, 250);
});

window.addEventListener('scroll', () => {
    positionnerFleches();
});

// Charger les textes au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTextes);

