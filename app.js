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
}

// Charger les textes au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTextes);

