const API_URL = '/api/texte';

function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

async function chargerTexte() {
    const slug = getSlugFromURL();
    if (!slug) {
        document.getElementById('texte-content').innerHTML = '<p>Slug manquant</p>';
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
        document.getElementById('texte-content').innerHTML = '<p>Erreur lors du chargement du texte</p>';
    }
}

function afficherTexte(texte) {
    const content = document.getElementById('texte-content');
    content.innerHTML = `
        <h2>${texte.title}</h2>
        ${texte.date ? `<p>Date: ${texte.date}</p>` : ''}
        <div>${texte.content ? texte.content.replace(/\n/g, '<br>') : ''}</div>
    `;
}

// Charger le texte au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTexte);

