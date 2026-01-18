const API_URL = '/api/texte';

// Références DOM en cache
const elements = {
    loader: null,
    heroSection: null,
    heroTitle: null,
    heroDate: null,
    texteText: null
};

function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

function initElements() {
    elements.loader = document.getElementById('loader');
    elements.heroSection = document.getElementById('hero-section');
    elements.heroTitle = document.getElementById('hero-title');
    elements.heroDate = document.getElementById('hero-date');
    elements.texteText = document.getElementById('texte-text');
}

function showLoader() {
    if (elements.loader && elements.heroSection) {
        elements.loader.classList.add('active');
        elements.heroSection.style.opacity = '0.3';
    }
}

function hideLoader() {
    if (elements.loader && elements.heroSection) {
        elements.loader.classList.remove('active');
        elements.heroSection.style.opacity = '1';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function chargerTexte() {
    const slug = getSlugFromURL();
    if (!slug) {
        if (elements.texteText) {
            elements.texteText.innerHTML = '<p>Slug manquant</p>';
        }
        hideLoader();
        return;
    }

    showLoader();
    let loaderTimeout;

    try {
        const response = await fetch(`${API_URL}/${slug}`);
        if (!response.ok) {
            throw new Error('Texte non trouvé');
        }
        const texte = await response.json();
        
        // Afficher le contenu immédiatement sans attendre l'image
        afficherTexte(texte);
        hideLoader();
        
        // Charger l'image en arrière-plan si elle existe
        // (le navigateur la mettra en cache et l'affichera dès qu'elle sera prête)
        if (texte.image) {
            const imageSrc = `/api/image/${encodeURIComponent(texte.image)}`;
            const img = new Image();
            img.src = imageSrc;
            // L'image se chargera automatiquement et sera affichée dès qu'elle est prête
            // grâce au CSS background-image qui a déjà été défini dans afficherTexte()
        }
    } catch (error) {
        console.error('Erreur lors du chargement du texte:', error);
        if (elements.texteText) {
            elements.texteText.innerHTML = '<p>Erreur lors du chargement du texte</p>';
        }
        hideLoader();
    }
}

function formaterDate(dateString) {
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    
    try {
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) {
            return dateString; // Retourner la date originale si le parsing échoue
        }
        const jour = date.getDate();
        const moisIndex = date.getMonth();
        const annee = date.getFullYear();
        return `le ${jour} ${mois[moisIndex]} ${annee}`;
    } catch (e) {
        return dateString; // Retourner la date originale en cas d'erreur
    }
}

function afficherTexte(texte) {
    if (!elements.heroSection || !elements.heroTitle || !elements.heroDate || !elements.texteText) {
        return;
    }
    
    // Configurer le hero avec l'image en background
    if (texte.image) {
        const imageSrc = `/api/image/${encodeURIComponent(texte.image)}`;
        elements.heroSection.style.backgroundImage = `url('${imageSrc}')`;
        elements.heroSection.style.backgroundSize = 'cover';
        elements.heroSection.style.backgroundPosition = 'center';
        elements.heroSection.style.backgroundRepeat = 'no-repeat';
        elements.heroSection.style.backgroundColor = '';
    } else {
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        elements.heroSection.style.backgroundColor = bgColor || '#dbe7c5';
        elements.heroSection.style.backgroundImage = '';
    }
    
    // Afficher le titre et la date dans le hero (échappé pour sécurité)
    elements.heroTitle.textContent = texte.title || '';
    if (texte.date) {
        const dateFormatee = formaterDate(texte.date);
        elements.heroDate.innerHTML = `<time datetime="${escapeHtml(texte.date)}">${escapeHtml(dateFormatee)}</time>`;
    } else {
        elements.heroDate.innerHTML = '';
    }
    
    // Afficher le contenu du texte (échappé pour sécurité)
    if (texte.content) {
        const contentEscaped = escapeHtml(texte.content).replace(/\n/g, '<br>');
        elements.texteText.innerHTML = `<div>${contentEscaped}</div>`;
    } else {
        elements.texteText.innerHTML = '';
    }
}

// Menu burger et chargement du texte
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    chargerTexte();
    
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

