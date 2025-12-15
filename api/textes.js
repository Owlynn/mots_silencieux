const { Client } = require('@notionhq/client');
const fixtures = require('../lib/fixtures.json');

function getText(prop) {
  if (!prop) return '';
  if (prop.type === 'title' && prop.title) {
    return prop.title.map(t => t.plain_text).join('');
  }
  if (prop.type === 'rich_text' && prop.rich_text) {
    return prop.rich_text.map(t => t.plain_text).join('');
  }
  if (prop.type === 'url' && prop.url) {
    return prop.url;
  }
  if (prop.type === 'files' && prop.files && prop.files.length > 0) {
    const file = prop.files[0];
    if (file.type === 'external' && file.external?.url) {
      return file.external.url;
    }
    if (file.type === 'file' && file.file?.url) {
      return file.file.url;
    }
    if (file.url) return file.url;
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
  
  let imageUrl = '';
  const imageProp = findProp(props, 'image', 'Image', 'image webflow', 'Image webflow', 'Cover', 'cover');
  if (imageProp) {
    imageUrl = getText(imageProp);
  }
  if (!imageUrl && page.cover) {
    if (page.cover.type === 'external' && page.cover.external?.url) {
      imageUrl = page.cover.external.url;
    } else if (page.cover.type === 'file' && page.cover.file?.url) {
      imageUrl = page.cover.file.url;
    }
  }
  
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
    image: imageUrl,
    published,
  };
}

async function fetchAllTextes() {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    console.log('⚠️ Utilisation des fixtures (Notion non configuré)');
    return fixtures.filter(item => item && item.title);
  }

  const notion = new Client({ auth: NOTION_TOKEN });

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
    
    const items = (await Promise.all(sortedPages.map(mapNotionPageToItem)))
      .filter(item => item && item.title && item.published !== false);
    
    console.log('✅ Notion: Récupéré', items.length, 'textes');
    return items;
  } catch (error) {
    console.error('Erreur Notion:', error);
    return fixtures.filter(item => item && item.title);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const textes = await fetchAllTextes();
    res.status(200).json(textes);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  }
};

