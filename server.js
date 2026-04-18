const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function searchYouTube(query) {
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY не найден в переменных окружения!');
    return [];
  }

  try {
    console.log(`🔍 YouTube search: "${query}"`);
    
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 15,
        key: YOUTUBE_API_KEY,
        relevanceLanguage: 'ru',
        order: 'relevance'
      }
    });

    if (!res.data.items || res.data.items.length === 0) {
      console.log('⚠️ YouTube вернул 0 результатов для этого запроса');
      return [];
    }

    console.log(`✅ Найдено ${res.data.items.length} видео`);
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
    const errMsg = e.response?.data?.error?.message || e.message;
    console.error('❌ YouTube API Error:', errMsg);
    // Если квота превышена или ключ неверный - логируем, но не крашим сервер
    return [];
  }
}

app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Пустой запрос' });

  try {
    const videos = await searchYouTube(query.trim());
    res.json({ videos, total: videos.length, platforms: { youtube: videos.length } });
  } catch (err) {
    console.error('❌ Search crash:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    youtubeKeySet: !!YOUTUBE_API_KEY,
    keyPreview: YOUTUBE_API_KEY ? YOUTUBE_API_KEY.substring(0, 6) + '...' : 'missing',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 YouTube Key: ${YOUTUBE_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
});
