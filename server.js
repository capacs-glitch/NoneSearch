const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ ВАЖНО: Разрешаем запросы с любого сайта (для GitHub Pages)
app.use(cors({ 
  origin: '*',  // Разрешить ВСЕ домены (для разработки)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ... (остальной код поиска YouTube, Dailymotion, Rutube оставь без изменений) ...

// YouTube Search
async function searchYouTube(query) {
  if (!YOUTUBE_API_KEY) return [];
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', q: query, type: 'video', maxResults: 15, key: YOUTUBE_API_KEY, regionCode: 'RU' }
    });
    return res.data.items.map(item => ({
      platform: 'YouTube',
      color: '#ff0033',
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      channel: item.snippet.channelTitle,
      views: ''
    }));
  } catch (e) { console.error('YT:', e.message); return []; }
}

// Dailymotion Search
async function searchDailymotion(query) {
  try {
    const res = await axios.get('https://api.dailymotion.com/videos', {
      params: { search: query, fields: 'title,thumbnail_url,url,owner,views_total', limit: 15 }
    });
    return res.data.list.map(video => ({
      platform: 'Dailymotion',
      color: '#00aaff',
      title: video.title,
      thumbnail: video.thumbnail_url,
      url: video.url,
      channel: video.owner?.screenname || '',
      views: video.views_total ? `${Math.round(video.views_total / 1000)}K` : ''
    }));
  } catch (e) { console.error('DM:', e.message); return []; }
}

// Rutube Search
async function searchRutube(query) {
  try {
    const res = await axios.get('https://rutube.ru/api/search/video/', {
      params: { q: query, page: 1, page_size: 15 }, headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data.results) return [];
    return res.data.results.map(video => ({
      platform: 'Rutube',
      color: '#00a651',
      title: video.title || 'Без названия',
      thumbnail: video.thumbnail?.url || '',
      url: `https://rutube.ru/video/${video.id}/`,
      channel: video.author?.name || '',
      views: video.views ? `${video.views} просмотров` : ''
    }));
  } catch (e) { console.error('Rutube:', e.message); return []; }
}

app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Запрос не указан' });

  const [youtube, dailymotion, rutube] = await Promise.all([
    searchYouTube(query), searchDailymotion(query), searchRutube(query)
  ]);

  const allVideos = [...youtube, ...dailymotion, ...rutube].filter(v => v.title).sort(() => Math.random() - 0.5);
  res.json({ videos: allVideos, total: allVideos.length });
});

app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
