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
    
    // Afficher le texte
    textDiv.innerHTML = `
        <h2>${texte.title}</h2>
        ${texte.date ? `<p>Date: ${texte.date}</p>` : ''}
        <div>${texte.content ? texte.content.replace(/\n/g, '<br>') : ''}</div>
    `;
}

// Charger le texte au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTexte);

