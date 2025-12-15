const API_URL = '/api/texte';

function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

async function chargerTexte() {
    const slug = getSlugFromURL();
    if (!slug) {
        document.getElementById('texte-text').innerHTML = '<p>Slug manquant</p>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${slug}`);
        if (!response.ok) {
            throw new Error('Texte non trouvé');
        }
        const texte = await response.json();
        afficherTexte(texte);
    } catch (error) {
        console.error('Erreur lors du chargement du texte:', error);
        document.getElementById('texte-text').innerHTML = '<p>Erreur lors du chargement du texte</p>';
    }
}

function afficherTexte(texte) {
    const imageDiv = document.getElementById('texte-image');
    const textDiv = document.getElementById('texte-text');
    
    // Afficher l'image si elle existe
    if (texte.image) {
        // Utiliser le proxy pour accélérer le chargement
        const imageSrc = `/api/image/${encodeURIComponent(texte.image)}`;
        imageDiv.innerHTML = `
            <div style="width: 200px;">
                <img 
                    src="${imageSrc}" 
                    alt="${texte.title}" 
                    loading="lazy"
                    decoding="async"
                    onerror="this.style.display='none'"
                />
            </div>
        `;
    } else {
        imageDiv.innerHTML = '';
    }
    
    // Afficher le texte (h1 pour la hiérarchie des titres)
    textDiv.innerHTML = `
        <h1>${texte.title}</h1>
        ${texte.date ? `<p><time datetime="${texte.date}">Date: ${texte.date}</time></p>` : ''}
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

