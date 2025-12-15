const API_URL = '/api/texte';

function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

function showLoader() {
    const loader = document.getElementById('loader');
    const heroSection = document.getElementById('hero-section');
    if (loader && heroSection) {
        loader.classList.add('active');
        heroSection.style.opacity = '0.3';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    const heroSection = document.getElementById('hero-section');
    if (loader && heroSection) {
        loader.classList.remove('active');
        heroSection.style.opacity = '1';
    }
}

async function chargerTexte() {
    const slug = getSlugFromURL();
    if (!slug) {
        document.getElementById('texte-text').innerHTML = '<p>Slug manquant</p>';
        hideLoader();
        return;
    }

    // Afficher le loader
    showLoader();

    try {
        const response = await fetch(`${API_URL}/${slug}`);
        if (!response.ok) {
            throw new Error('Texte non trouvé');
        }
        const texte = await response.json();
        
        // Afficher le texte immédiatement
        afficherTexte(texte);
        
        // Attendre que l'image soit chargée si elle existe
        if (texte.image) {
            const imageSrc = `/api/image/${encodeURIComponent(texte.image)}`;
            const img = new Image();
            img.onload = () => {
                hideLoader();
            };
            img.onerror = () => {
                hideLoader();
            };
            img.src = imageSrc;
        } else {
            hideLoader();
        }
        
        // Timeout de sécurité au cas où l'image ne se charge pas
        setTimeout(() => {
            hideLoader();
        }, 5000);
    } catch (error) {
        console.error('Erreur lors du chargement du texte:', error);
        document.getElementById('texte-text').innerHTML = '<p>Erreur lors du chargement du texte</p>';
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
    const heroSection = document.getElementById('hero-section');
    const heroTitle = document.getElementById('hero-title');
    const heroDate = document.getElementById('hero-date');
    const textDiv = document.getElementById('texte-text');
    
    // Configurer le hero avec l'image en background
    if (texte.image) {
        const imageSrc = `/api/image/${encodeURIComponent(texte.image)}`;
        heroSection.style.backgroundImage = `url('${imageSrc}')`;
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
        heroSection.style.backgroundRepeat = 'no-repeat';
    } else {
        // Si pas d'image, utiliser la couleur de fond (couleur depuis CSS)
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        heroSection.style.backgroundColor = bgColor || '#dbe7c5';
    }
    
    // Afficher le titre et la date dans le hero
    heroTitle.textContent = texte.title;
    if (texte.date) {
        const dateFormatee = formaterDate(texte.date);
        heroDate.innerHTML = `<time datetime="${texte.date}">${dateFormatee}</time>`;
    } else {
        heroDate.innerHTML = '';
    }
    
    // Afficher uniquement le contenu du texte
    textDiv.innerHTML = `
        <div>${texte.content ? texte.content.replace(/\n/g, '<br>') : ''}</div>
    `;
}

// Menu burger et chargement du texte
document.addEventListener('DOMContentLoaded', () => {
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

