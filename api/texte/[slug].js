const fixtures = require('../../lib/fixtures.json');

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
    return fixtures.filter(item => item && item.title);
  }

  try {
    let allPages = [];
    let cursor = undefined;

    do {
      const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {})
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Notion API error: ${err.message}`);
      }
      const response = await res.json();
      allPages = allPages.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const filteredPages = allPages.filter(page =>
      page.properties?.Tags?.multi_select?.some(tag =>
        tag.name.toLowerCase() === 'publiable'
      )
    );

    const items = (await Promise.all(filteredPages.map(mapNotionPageToItem)))
      .filter(item => item && item.title && item.published !== false);

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
    const slug = req.query.slug;
    const pageId = req.query.id;
    if (!slug) {
      res.status(400).json({ error: 'Slug manquant' });
      return;
    }

    // Fetch direct par ID Notion si disponible (rapide)
    if (pageId) {
      const NOTION_TOKEN = process.env.NOTION_TOKEN;
      const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28'
        }
      });
      if (pageRes.ok) {
        const page = await pageRes.json();
        const texte = await mapNotionPageToItem(page);
        res.status(200).json(texte);
        return;
      }
    }

    // Fallback : recherche par slug dans toute la DB
    const textes = await fetchAllTextes();
    const texte = textes.find(t => t.slug === slug);
    
    if (texte) {
      res.status(200).json(texte);
    } else {
      res.status(404).json({ error: 'Texte non trouvé' });
    }
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  }
};

