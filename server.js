const http = require('http');
const { Client } = require('@notionhq/client');
const fixtures = require('./lib/fixtures.json');
require('dotenv').config();

const notion = process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID
  ? new Client({ auth: process.env.NOTION_TOKEN })
  : null;

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Fonction helper pour extraire le texte d'une propriété
function getText(prop) {
  if (!prop) return '';
  if (prop.type === 'title' && prop.title) {
    return prop.title.map(t => t.plain_text).join('');
  }
  if (prop.type === 'rich_text' && prop.rich_text) {
    return prop.rich_text.map(t => t.plain_text).join('');
  }
  return '';
}

function getDate(prop) {
  if (!prop || prop.type !== 'date' || !prop.date) return null;
  return prop.date.start;
}

function isPublished(prop) {
  if (!prop) return true;
  if (prop.type === 'checkbox') return prop.checkbox === true;
  return true;
}

function findProp(props, ...names) {
  for (const name of names) {
    const keys = Object.keys(props);
    const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
    if (found) return props[found];
  }
  for (const name of names) {
    if (props[name]) return props[name];
  }
  return null;
}

async function mapNotionPageToItem(page) {
  const props = page.properties;
  const publishedProp = findProp(props, 'published', 'Publié', 'publié');
  const published = isPublished(publishedProp);
  
  const title = getText(findProp(props, 'Titre du texte', 'titre du texte', 'Titre'));
  const content = getText(findProp(props, 'Contenu', 'contenu', 'content'));
  
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);
  
  const pageIdPart = page.id ? page.id.replace(/-/g, '') : Math.random().toString(36).substring(2, 10);
  const uniqueSuffix = pageIdPart.slice(0, 12);
  const slug = `${baseSlug}-${uniqueSuffix}`;

  return {
    title: title,
    date: getDate(findProp(props, 'Date d\'écriture', 'Date d\'ecriture', 'date')),
    slug: slug,
    content: content,
    published,
  };
}

async function fetchAllTextes() {
  if (!notion || !DATABASE_ID) {
    console.log('⚠️ Utilisation des fixtures (Notion non configuré)');
    return fixtures.filter(item => item && item.title);
  }

  try {
    const searchResponse = await notion.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: 100
    });
    
    const normalizedDbId = DATABASE_ID.replace(/-/g, '');
    const dbPages = searchResponse.results.filter(page => {
      const pageDbId = page.parent?.database_id?.replace(/-/g, '');
      return pageDbId === normalizedDbId;
    });
    
    let filteredPages = dbPages;
    try {
      const pagesWithTags = dbPages.filter(page => 
        page.properties?.Tags?.multi_select?.some(tag => 
          tag.name.toLowerCase() === 'publiable'
        )
      );
      if (pagesWithTags.length > 0) {
        filteredPages = pagesWithTags;
      }
    } catch (tagError) {
      // Ignorer
    }
    
    const sortedPages = filteredPages.sort((a, b) => {
      const dateA = new Date(a.properties?.['Date d\'écriture']?.date?.start || 0);
      const dateB = new Date(b.properties?.['Date d\'écriture']?.date?.start || 0);
      return dateB - dateA;
    });
    
    let items = (await Promise.all(sortedPages.map(mapNotionPageToItem)))
      .filter(item => item && item.title && item.published !== false);
    
    console.log('✅ Notion: Récupéré', items.length, 'textes');
    return items;
  } catch (error) {
    console.error('Erreur Notion:', error);
    return fixtures.filter(item => item && item.title);
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/textes' && req.method === 'GET') {
    try {
      const textes = await fetchAllTextes();
      res.writeHead(200);
      res.end(JSON.stringify(textes));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/texte/') && req.method === 'GET') {
    try {
      const slug = req.url.split('/api/texte/')[1];
      const textes = await fetchAllTextes();
      const texte = textes.find(t => t.slug === slug);
      if (texte) {
        res.writeHead(200);
        res.end(JSON.stringify(texte));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Texte non trouvé' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}`);
});

