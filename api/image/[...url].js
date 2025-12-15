const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, max-age=31536000');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Sur Vercel, avec [...url], le paramètre est dans req.query.url comme tableau
    let imageUrl = '';
    
    if (req.query.url && Array.isArray(req.query.url)) {
      // Rejoindre toutes les parties de l'URL
      imageUrl = req.query.url.join('/');
    } else if (req.query.url) {
      imageUrl = req.query.url;
    } else {
      // Fallback: extraire depuis l'URL de la requête
      const match = req.url.match(/\/api\/image\/(.+)/);
      if (match) {
        imageUrl = decodeURIComponent(match[1].split('?')[0]);
      }
    }
    
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      res.status(400).send('URL invalide: ' + imageUrl);
      return;
    }
    
    const url = new URL(imageUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
      client.get(url.href, (imageRes) => {
        res.setHeader('Content-Type', imageRes.headers['content-type'] || 'image/jpeg');
        imageRes.pipe(res);
        imageRes.on('end', resolve);
        imageRes.on('error', reject);
      }).on('error', (err) => {
        console.error('Erreur image:', err);
        res.status(500).send('Erreur lors du chargement de l\'image');
        reject(err);
      });
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  }
};
