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
    // Sur mobile, afficher 10 items (2 colonnes × 5 lignes)
    if (window.innerWidth <= 768) {
        itemsParPage = 10;
        return;
    }
    
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cache pour les images déjà en cours de chargement
const imagesEnChargement = new Set();

// Créer une carte pour un texte donné
function creerCarte(texte, imagesPromises, cache = false) {
    const card = document.createElement('a');
    card.href = `texte.html?slug=${encodeURIComponent(texte.slug)}`;
    card.className = texte.image ? 'card' : 'card card-no-image';
    
    // Si c'est pour le cache, marquer la carte comme cachée
    if (cache) {
        card.style.display = 'none';
        card.setAttribute('data-cache', 'true');
    }
    
    const titleEscaped = escapeHtml(texte.title);
    
    if (texte.image) {
        const imageUrl = `/api/image/${encodeURIComponent(texte.image)}`;
        
        // Éviter de charger la même image plusieurs fois
        const imageKey = imageUrl;
        const isImageEnChargement = imagesEnChargement.has(imageKey);
        
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img 
                        src="${imageUrl}" 
                        alt="${titleEscaped}" 
                        loading="${cache ? 'lazy' : 'eager'}"
                        decoding="async"
                    />
                </div>
                <div class="card-back">
                    <div class="card-title">${titleEscaped}</div>
                </div>
            </div>
        `;
        
        const img = card.querySelector('img');
        if (img && !isImageEnChargement) {
            imagesEnChargement.add(imageKey);
            const imgPromise = new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = () => {
                        imagesEnChargement.delete(imageKey);
                        resolve();
                    };
                    img.onerror = () => {
                        imagesEnChargement.delete(imageKey);
                        resolve();
                    };
                }
            });
            imagesPromises.push(imgPromise);
        }
    } else {
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <div class="card-title">${titleEscaped}</div>
                </div>
                <div class="card-back">
                    <div class="card-title">${titleEscaped}</div>
                </div>
            </div>
        `;
    }
    
    return card;
}

function afficherTextes() {
    const liste = document.getElementById('liste-textes');
    const loader = document.getElementById('loader');
    if (!liste || !loader) return;
    
    loader.classList.add('active');
    liste.style.opacity = '0.3';
    liste.innerHTML = '';
    
    const debut = (pageActuelle - 1) * itemsParPage;
    const fin = debut + itemsParPage;
    const finPrechargement = Math.min(debut + itemsParPage * 2, tousLesTextes.length);
    
    // Textes à afficher (page actuelle)
    const textesAPager = tousLesTextes.slice(debut, fin);
    // Textes à précharger (page suivante)
    const textesAPrecharger = tousLesTextes.slice(fin, finPrechargement);
    
    const imagesPromises = [];
    
    // Créer et afficher les cartes de la page actuelle
    textesAPager.forEach(texte => {
        const card = creerCarte(texte, imagesPromises, false);
        liste.appendChild(card);
    });
    
    // Créer et précharger les cartes de la page suivante (cachées)
    textesAPrecharger.forEach(texte => {
        const card = creerCarte(texte, imagesPromises, true);
        liste.appendChild(card);
    });
    
    let loaderTimeout;
    const finishLoading = () => {
        if (loaderTimeout) clearTimeout(loaderTimeout);
        loader.classList.remove('active');
        liste.style.opacity = '1';
        afficherPagination();
        
        // Précharger la page suivante en arrière-plan après affichage
        prechargerPageSuivante();
    };
    
    // Attendre que toutes les images de la page actuelle soient chargées
    Promise.all(imagesPromises).then(finishLoading);
    
    // Timeout de sécurité
    loaderTimeout = setTimeout(finishLoading, 5000);
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
            btnPrev.setAttribute('aria-label', 'Page précédente');
            btnPrev.onclick = () => changerPage(pageActuelle - 1);
            navigationContainer.appendChild(btnPrev);
        }
        
        // Bouton suivant - affiché seulement si pas sur la dernière page
        if (pageActuelle < totalPages) {
            const btnNext = document.createElement('button');
            btnNext.className = 'nav-arrow nav-arrow-right';
            btnNext.innerHTML = '→';
            btnNext.setAttribute('aria-label', 'Page suivante');
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
        dot.setAttribute('aria-label', `Aller à la page ${i}`);
        if (i === pageActuelle) {
            dot.setAttribute('aria-current', 'page');
        }
        dot.onclick = () => changerPage(i);
        pagination.appendChild(dot);
    }
}

// Précharger la page suivante en arrière-plan
function prechargerPageSuivante() {
    const totalPages = Math.ceil(tousLesTextes.length / itemsParPage);
    if (pageActuelle >= totalPages) return; // Pas de page suivante
    
    const pageSuivante = pageActuelle + 1;
    const debut = (pageSuivante - 1) * itemsParPage;
    const fin = Math.min(debut + itemsParPage, tousLesTextes.length);
    const textesPageSuivante = tousLesTextes.slice(debut, fin);
    
    // Vérifier si les cartes sont déjà dans le DOM (préchargées)
    const liste = document.getElementById('liste-textes');
    if (!liste) return;
    
    const cartesCachees = liste.querySelectorAll('[data-cache="true"]');
    const nombreCartesCachees = cartesCachees.length;
    
    // Si on a déjà préchargé assez de cartes, on n'a rien à faire
    if (nombreCartesCachees >= textesPageSuivante.length) {
        return;
    }
    
    // Sinon, précharger les cartes manquantes en arrière-plan
    const imagesPromises = [];
    textesPageSuivante.forEach((texte, index) => {
        // Vérifier si cette carte existe déjà
        const carteExistante = Array.from(liste.children).find(card => {
            return card.href && card.href.includes(encodeURIComponent(texte.slug));
        });
        
        if (!carteExistante) {
            const card = creerCarte(texte, imagesPromises, true);
            liste.appendChild(card);
        }
    });
}

function changerPage(nouvellePage) {
    if (nouvellePage < 1 || nouvellePage > Math.ceil(tousLesTextes.length / itemsParPage)) return;
    
    const liste = document.getElementById('liste-textes');
    if (!liste) return;
    
    // Vérifier si la page demandée est déjà préchargée (c'était la page suivante)
    const debutDemandee = (nouvellePage - 1) * itemsParPage;
    const finDemandee = debutDemandee + itemsParPage;
    const textesPageDemandee = tousLesTextes.slice(debutDemandee, finDemandee);
    
    // Chercher les cartes préchargées pour cette page dans le DOM
    const toutesLesCartes = Array.from(liste.children);
    const cartesPageDemandee = [];
    let toutesLesCartesTrouvees = true;
    
    textesPageDemandee.forEach(texte => {
        const carte = toutesLesCartes.find(card => {
            return card.href && card.href.includes(encodeURIComponent(texte.slug));
        });
        if (carte) {
            cartesPageDemandee.push(carte);
        } else {
            toutesLesCartesTrouvees = false;
        }
    });
    
    // Si toutes les cartes de la page demandée sont déjà dans le DOM (préchargées), les révéler
    if (toutesLesCartesTrouvees && cartesPageDemandee.length === textesPageDemandee.length) {
        // Cacher toutes les cartes
        toutesLesCartes.forEach(card => {
            card.style.display = 'none';
            card.setAttribute('data-cache', 'true');
        });
        
        // Afficher les cartes de la page demandée
        cartesPageDemandee.forEach(card => {
            card.style.display = '';
            card.removeAttribute('data-cache');
        });
        
        // Précharger les cartes suivantes si nécessaire
        const finPrechargement = Math.min(debutDemandee + itemsParPage * 2, tousLesTextes.length);
        const textesAPrecharger = tousLesTextes.slice(finDemandee, finPrechargement);
        const imagesPromises = [];
        
        textesAPrecharger.forEach(texte => {
            // Vérifier si la carte existe déjà
            const carteExistante = toutesLesCartes.find(card => {
                return card.href && card.href.includes(encodeURIComponent(texte.slug));
            });
            
            if (!carteExistante) {
                const card = creerCarte(texte, imagesPromises, true);
                liste.appendChild(card);
            }
        });
        
        pageActuelle = nouvellePage;
        
        // Pas besoin de loader, c'est instantané !
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.remove('active');
        }
        liste.style.opacity = '1';
        
        afficherPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Annoncer le changement de page aux lecteurs d'écran
        const ariaLive = document.getElementById('aria-live-region');
        if (ariaLive) {
            ariaLive.textContent = `Page ${nouvellePage} sur ${Math.ceil(tousLesTextes.length / itemsParPage)}`;
        }
        
        // Précharger la page suivante
        prechargerPageSuivante();
        
        return;
    }
    
    // Sinon, utiliser la méthode normale
    pageActuelle = nouvellePage;
    afficherTextes();
    afficherPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Annoncer le changement de page aux lecteurs d'écran
    const ariaLive = document.getElementById('aria-live-region');
    if (ariaLive) {
        ariaLive.textContent = `Page ${nouvellePage} sur ${Math.ceil(tousLesTextes.length / itemsParPage)}`;
    }
}

// Debounce pour le redimensionnement
let resizeTimeout;
const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        calculerItemsParPage();
        pageActuelle = 1;
        afficherTextes();
        setTimeout(positionnerFleches, 100);
    }, 250);
};

// Debounce pour le scroll avec requestAnimationFrame
let scrollAnimationFrame;
const handleScroll = () => {
    if (scrollAnimationFrame) {
        cancelAnimationFrame(scrollAnimationFrame);
    }
    scrollAnimationFrame = requestAnimationFrame(() => {
        positionnerFleches();
    });
};

window.addEventListener('resize', handleResize, { passive: true });
window.addEventListener('scroll', handleScroll, { passive: true });

// Menu burger
document.addEventListener('DOMContentLoaded', () => {
    chargerTextes();
    
    const burgerMenu = document.getElementById('burger-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    function toggleMenu(open) {
        const isOpen = open !== undefined ? open : burgerMenu.classList.contains('active');
        
        if (!isOpen) {
            // Ouvrir le menu
            burgerMenu.classList.add('active');
            sidebar.classList.add('active');
            overlay.classList.add('active');
            burgerMenu.setAttribute('aria-expanded', 'true');
            burgerMenu.setAttribute('aria-label', 'Fermer le menu de navigation');
            // Focus sur le premier lien du menu
            const firstLink = sidebar.querySelector('nav a');
            if (firstLink) {
                setTimeout(() => firstLink.focus(), 100);
            }
            // Empêcher le scroll du body
            document.body.style.overflow = 'hidden';
        } else {
            // Fermer le menu
            burgerMenu.classList.remove('active');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            burgerMenu.setAttribute('aria-expanded', 'false');
            burgerMenu.setAttribute('aria-label', 'Ouvrir le menu de navigation');
            // Restaurer le scroll du body
            document.body.style.overflow = '';
        }
    }
    
    if (burgerMenu && sidebar && overlay) {
        burgerMenu.addEventListener('click', () => toggleMenu());
        overlay.addEventListener('click', () => toggleMenu(true));
        
        // Gérer la touche Escape pour fermer le menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && burgerMenu.classList.contains('active')) {
                toggleMenu(true);
                burgerMenu.focus();
            }
        });
        
        // Trap de focus dans le menu (boucle Tab uniquement dans le menu)
        sidebar.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || !burgerMenu.classList.contains('active')) return;
            
            const focusableElements = sidebar.querySelectorAll('nav a');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        });
        
        // Fermer le menu quand on clique sur un lien
        const sidebarLinks = sidebar.querySelectorAll('nav a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                setTimeout(() => toggleMenu(true), 100);
            });
        });
    }
});

