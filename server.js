const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Client } = require('@notionhq/client');
const fixtures = require('./lib/fixtures.json');
// Charger .env.local en priorité, puis .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // .env en fallback

const notion = process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID
  ? new Client({ auth: process.env.NOTION_TOKEN })
  : null;

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// ==================== SÉCURITÉ ====================

// Configuration CORS - Liste des origines autorisées
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3001', 'http://localhost:3000', 'https://mots-silencieux.vercel.app'];

// Rate limiting simple (par IP)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requêtes par minute par IP

// Whitelist de domaines autorisés pour les images (optionnel)
const ALLOWED_IMAGE_DOMAINS = process.env.ALLOWED_IMAGE_DOMAINS
  ? process.env.ALLOWED_IMAGE_DOMAINS.split(',').map(d => d.trim())
  : null; // null = pas de restriction (mais IPs privées bloquées)

// Fonction pour obtenir l'IP du client
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.socket.remoteAddress 
    || 'unknown';
}

// Rate limiting
function checkRateLimit(req, res) {
  const ip = getClientIP(req);
  const now = Date.now();
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const record = rateLimitStore.get(ip);
  
  // Réinitialiser si la fenêtre est expirée
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  // Vérifier la limite
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Trop de requêtes. Veuillez réessayer plus tard.' }));
    return false;
  }
  
  record.count++;
  return true;
}

// Nettoyer le store de rate limiting périodiquement
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

// Protection contre le path traversal
function sanitizePath(filePath) {
  // Normaliser le chemin et résoudre les ../
  const normalized = path.normalize(filePath);
  // S'assurer que le chemin résolu est dans le répertoire courant
  const resolved = path.resolve(normalized);
  const root = path.resolve('.');
  
  // Vérifier que le chemin résolu commence par le répertoire racine
  if (!resolved.startsWith(root)) {
    return null; // Chemin invalide, tentative de path traversal
  }
  
  return resolved;
}

// Protection SSRF - Vérifier si l'IP est privée/localhost
function isPrivateIP(hostname) {
  // Liste des domaines/hostnames à bloquer
  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]'
  ];
  
  if (blockedHosts.includes(hostname.toLowerCase())) {
    return true;
  }
  
  // Vérifier les IPs privées (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipPattern);
  
  if (match) {
    const parts = match.slice(1).map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (déjà couvert mais on double vérifie)
    if (parts[0] === 127) return true;
  }
  
  return false;
}

// Valider le Content-Type d'une image
function isValidImageContentType(contentType) {
  if (!contentType) return false;
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ];
  return validTypes.some(type => contentType.toLowerCase().startsWith(type));
}

// Headers de sécurité
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content-Security-Policy (basique)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
}

// Vérifier et configurer CORS
function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 heures
    return true;
  } else if (!origin) {
    // Pas d'origine (requête depuis le même domaine), autoriser
    return true;
  }
  
  // Origine non autorisée
  return false;
}

// Fonction helper pour extraire le texte d'une propriété
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
  // Pour les images/files
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
  
  // Récupérer l'image
  let imageUrl = '';
  const imageProp = findProp(props, 'image', 'Image', 'image webflow', 'Image webflow', 'Cover', 'cover');
  if (imageProp) {
    imageUrl = getText(imageProp);
  }
  // Fallback sur la cover de la page si pas d'image dans les propriétés
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

// Cache simple pour les textes (5 minutes)
let textesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchAllTextes() {
  // Vérifier le cache
  if (textesCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return textesCache;
  }

  if (!notion || !DATABASE_ID) {
    console.log('⚠️ Utilisation des fixtures (Notion non configuré)');
    const result = fixtures.filter(item => item && item.title);
    textesCache = result;
    cacheTimestamp = Date.now();
    return result;
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
    
    const items = (await Promise.all(sortedPages.map(mapNotionPageToItem)))
      .filter(item => item && item.title && item.published !== false);
    
    // Mettre en cache
    textesCache = items;
    cacheTimestamp = Date.now();
    
    console.log('✅ Notion: Récupéré', items.length, 'textes');
    return items;
  } catch (error) {
    console.error('Erreur Notion:', error);
    const result = fixtures.filter(item => item && item.title);
    // En cas d'erreur, utiliser le cache si disponible, sinon les fixtures
    return textesCache || result;
  }
}

const server = http.createServer(async (req, res) => {
  // Appliquer les headers de sécurité à toutes les réponses
  setSecurityHeaders(res);
  
  // Rate limiting (sauf pour OPTIONS)
  if (req.method !== 'OPTIONS' && !checkRateLimit(req, res)) {
    return; // Réponse déjà envoyée par checkRateLimit
  }
  
  // CORS headers pour les requêtes API
  if (req.url.startsWith('/api/')) {
    if (!setCORSHeaders(req, res)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origine non autorisée' }));
      return;
    }
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Routes API
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
      const slug = req.url.split('/api/texte/')[1].split('?')[0];
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

  // Proxy pour les images (pour accélérer le chargement)
  if (req.url.startsWith('/api/image/') && req.method === 'GET') {
    try {
      const imageUrl = decodeURIComponent(req.url.split('/api/image/')[1].split('?')[0]);
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('URL invalide');
        return;
      }
      
      const url = new URL(imageUrl);
      
      // Protection SSRF : bloquer les IPs privées et localhost
      if (isPrivateIP(url.hostname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Accès interdit à cette ressource');
        return;
      }
      
      // Vérifier si le domaine est dans la whitelist (si configurée)
      if (ALLOWED_IMAGE_DOMAINS && !ALLOWED_IMAGE_DOMAINS.includes(url.hostname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Domaine non autorisé');
        return;
      }
      
      const client = url.protocol === 'https:' ? https : http;
      
      // Limiter la taille de la réponse (10MB max pour les images)
      const maxSize = 10 * 1024 * 1024; // 10MB
      let receivedBytes = 0;
      
      client.get(url.href, (imageRes) => {
        // Vérifier le Content-Type avant de servir
        const contentType = imageRes.headers['content-type'] || '';
        if (!isValidImageContentType(contentType)) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Type de contenu non valide');
          imageRes.destroy();
          return;
        }
        
        // Vérifier la taille du contenu
        const contentLength = parseInt(imageRes.headers['content-length'] || '0');
        if (contentLength > maxSize) {
          res.writeHead(413, { 'Content-Type': 'text/plain' });
          res.end('Fichier trop volumineux');
          imageRes.destroy();
          return;
        }
        
        res.writeHead(imageRes.statusCode, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // Cache 1 an
          'X-Content-Type-Options': 'nosniff'
        });
        
        imageRes.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (receivedBytes > maxSize) {
            res.writeHead(413, { 'Content-Type': 'text/plain' });
            res.end('Fichier trop volumineux');
            imageRes.destroy();
            return;
          }
          res.write(chunk);
        });
        
        imageRes.on('end', () => {
          res.end();
        });
        
        imageRes.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Erreur lors du chargement de l\'image');
          }
        });
      }).on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erreur lors du chargement de l\'image');
      });
      return;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  // Servir les fichiers statiques (HTML, JS)
  // Extraire le chemin sans les query parameters
  const urlPath = req.url.split('?')[0];
  let filePath = '.' + urlPath;
  if (filePath === './') {
    filePath = './index.html';
  }
  
  // Protection contre le path traversal
  const sanitizedPath = sanitizePath(filePath);
  if (!sanitizedPath) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('403 - Accès interdit', 'utf-8');
    return;
  }
  
  // Vérifier que le fichier existe et est un fichier (pas un répertoire)
  fs.stat(sanitizedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('404 - File Not Found', 'utf-8');
      return;
    }
    
    // Liste blanche des extensions autorisées
    const extname = String(path.extname(sanitizedPath)).toLowerCase();
    const allowedExtensions = ['.html', '.js', '.json', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    
    if (!allowedExtensions.includes(extname)) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end('403 - Type de fichier non autorisé', 'utf-8');
      return;
    }
    
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(sanitizedPath, (error, content) => {
      if (error) {
        if (error.code == 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('404 - File Not Found', 'utf-8');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('Server Error: ' + error.code, 'utf-8');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}`);
});

