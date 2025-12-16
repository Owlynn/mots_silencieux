# Des mots silencieux

🌐 **Site en ligne :** [https://mots-silencieux.vercel.app/](https://mots-silencieux.vercel.app/)

Site simple en HTML/JS pour afficher des textes récupérés depuis Notion.

## Installation

```bash
npm install
```

## Utilisation

1. Démarrer le serveur :
```bash
npm start
```

2. Ouvrir `index.html` dans votre navigateur

## Configuration

Créez un fichier `.env.local` avec vos identifiants Notion (voir `.env.example` pour un exemple complet) :
```
NOTION_TOKEN=votre_token
NOTION_DATABASE_ID=votre_database_id
```

### Variables d'environnement optionnelles

- `ALLOWED_ORIGINS` : Liste des origines autorisées pour CORS (séparées par des virgules)
- `ALLOWED_IMAGE_DOMAINS` : Liste des domaines autorisés pour le proxy d'images (optionnel)
- `PORT` : Port du serveur (défaut: 3001)

Si Notion n'est pas configuré, les données de test dans `lib/fixtures.json` seront utilisées.

## Sécurité

Le serveur inclut plusieurs mesures de sécurité :

- ✅ Protection contre le path traversal
- ✅ Protection SSRF pour le proxy d'images (blocage des IPs privées)
- ✅ Rate limiting (100 requêtes/minute par IP)
- ✅ Headers de sécurité HTTP (X-Content-Type-Options, X-Frame-Options, etc.)
- ✅ CORS configurable par liste blanche
- ✅ Validation du Content-Type des images
- ✅ Limitation de taille des fichiers images (10MB)


