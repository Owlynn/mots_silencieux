const API_URL = 'http://localhost:3001/api/textes';

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
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `texte.html?slug=${texte.slug}`;
        a.textContent = texte.title;
        li.appendChild(a);
        liste.appendChild(li);
    });
}

// Charger les textes au chargement de la page
document.addEventListener('DOMContentLoaded', chargerTextes);

