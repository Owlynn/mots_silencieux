const API_URL = '/api/textes';

async function chargerTextes() {
    try {
        const response = await fetch(API_URL);
        const textes = await response.json();
        afficherTextes(textes);
    } catch (error) {
        console.error('Erreur lors du chargement des textes:', error);
        document.getElementById('liste-textes').innerHTML = '<li>Erreur lors du chargement des textes</li>';
    }
}

function afficherTextes(textes) {
    const liste = document.getElementById('liste-textes');
    liste.innerHTML = '';
    
    textes.forEach(texte => {
        const card = document.createElement('a');
        card.href = `texte.html?slug=${texte.slug}`;
        card.style.cssText = 'display: block; position: relative; aspect-ratio: 1; overflow: hidden; text-decoration: none;';
        
        if (texte.image) {
            const imageUrl = `/api/image/${encodeURIComponent(texte.image)}`;
            card.innerHTML = `
                <img 
                    src="${imageUrl}" 
                    alt="${texte.title}" 
                    loading="lazy"
                    decoding="async"
                    style="width: 100%; height: 100%; object-fit: cover; display: block;"
                />
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255, 255, 255, 0.9); color: black; padding: 10px; text-align: center; font-weight: bold; z-index: 1;">
                    ${texte.title}
                </div>
            `;
        } else {
            card.innerHTML = `
                <div style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; position: relative;">
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; background: white; color: black; padding: 10px; text-align: center; font-weight: bold;">
                        ${texte.title}
                    </div>
                </div>
            `;
        }
        
        liste.appendChild(card);
    });
}

// Charger les textes au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTextes);

