# Des mots silencieux

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

Créez un fichier `.env.local` avec vos identifiants Notion :
```
NOTION_TOKEN=votre_token
NOTION_DATABASE_ID=votre_database_id
```

Si Notion n'est pas configuré, les données de test dans `lib/fixtures.json` seront utilisées.

