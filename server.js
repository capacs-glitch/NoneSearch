const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ─── YouTube Search ───
async function searchYouTube(query) {
  if (!YOUTUBE_API_KEY) {
    console.error('⚠️ YouTube API Key is missing! Set YOUTUBE_API_KEY in Railway Variables');
    return [];
  }
  
  try {
    console.log(`🔍 Searching YouTube for: "${query}"`);
    
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 20,
        key: YOUTUBE_API_KEY,
        regionCode: 'RU',
        relevanceLanguage: 'ru',
        videoEmbeddable: 'true',
        videoSyndicated: 'true'
      }
    });

    console.log(`✅ Found ${res.data.items.length} YouTube videos`);

    return res.data.items.map(item => ({
      platform: 'YouTube',
      color: '#ff0033',
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      channel: item.snippet.channelTitle,
      views: '',
      time: ''
    }));
  } catch (e) {
    console.error('❌ YouTube API Error:', e.response?.data || e.message);
    return [];
  }
}

// ─── Главный Endpoint ───
app.post('/api/search', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'Пустой запрос' });
  }

  try {
    const youtube = await searchYouTube(query.trim());
    
    res.json({
      videos: youtube,
      total: youtube.length,
      platforms: { youtube: youtube.length }
    });
  } catch (error) {
    console.error('❌ Search Error:', error);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platforms: ['YouTube'],
    youtubeKeySet: !!YOUTUBE_API_KEY,
    message: YOUTUBE_API_KEY ? 'YouTube API ready' : '⚠️ YouTube API Key is missing!'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🔑 YouTube API Key: ${YOUTUBE_API_KEY ? '✅ Set' : '❌ Missing!'}`);
  console.log(` Test: https://your-domain.up.railway.app/api/health`);
});

const cats = [
  { id: 'rec', title: 'Рекомендации', icon: '🔥', query: 'популярное видео', filter: 'mix' },
  { id: 'music', title: 'Музыка', icon: '🎵', query: 'музыка хиты 2024', filter: 'mix' },
  { id: 'games', title: 'Игры', icon: '🎮', query: 'игры геймплей', filter: 'mix' },
  { id: 'edu', title: 'Образование', icon: '📚', query: 'наука образование', filter: 'mix' }
];
