const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ ВАЖНО: Разрешаем запросы с любого источника (GitHub Pages)
app.use(cors({ 
  origin: '*', 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ─── Конфигурация API ключей ───
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ─── YouTube Search ───
async function searchYouTube(query) {
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API Key is missing.');
    return [];
  }
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 15,
        key: YOUTUBE_API_KEY,
        regionCode: 'RU', // Приоритет русскоязычного контента
        relevanceLanguage: 'ru'
      }
    });

    return res.data.items.map(item => ({
      platform: 'YouTube',
      color: '#ff0033',
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      channel: item.snippet.channelTitle,
      views: '', // YouTube Search API не отдает просмотры в этом эндпоинте
      time: ''   // Время тоже нужно получать отдельно, оставляем пустым для простоты
    }));
  } catch (e) {
    console.error('YouTube API Error:', e.response ? e.response.data : e.message);
    return [];
  }
}

// ─── Dailymotion Search ───
async function searchDailymotion(query) {
  try {
    // Используем публичный API без ключа для поиска
    const res = await axios.get('https://api.dailymotion.com/videos', {
      params: {
        search: query,
        fields: 'title,thumbnail_url,url,owner,views_total,duration',
        limit: 15,
        family_filter: true
      }
    });

    if (!res.data.list || res.data.list.length === 0) return [];

    return res.data.list.map(video => ({
      platform: 'Dailymotion',
      color: '#00aaff',
      title: video.title,
      thumbnail: video.thumbnail_url || `https://via.placeholder.com/400x225/00aaff/fff?text=Dailymotion`,
      url: video.url,
      channel: video.owner?.screenname || 'Dailymotion User',
      views: video.views_total ? `${Math.round(video.views_total / 1000)}K` : '',
      time: video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : ''
    }));
  } catch (e) {
    console.error('Dailymotion API Error:', e.message);
    return [];
  }
}

// ─── Rutube Search ───
async function searchRutube(query) {
  try {
    // Rutube имеет публичный endpoint поиска
    const res = await axios.get(`https://rutube.ru/api/search/video/`, {
      params: {
        q: query,
        page: 1,
        page_size: 15
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!res.data.results || res.data.results.length === 0) return [];

    return res.data.results.map(video => {
      // Извлекаем ID видео из ссылки или объекта
      // Обычно ссылка вида https://rutube.ru/video/ID/
      // Но в API ответе есть поле id
      const videoId = video.id; 
      
      return {
        platform: 'Rutube',
        color: '#00a651',
        title: video.title || 'Без названия',
        thumbnail: video.thumbnail?.url || `https://via.placeholder.com/400x225/00a651/fff?text=Rutube`,
        url: `https://rutube.ru/video/${videoId}/`,
        channel: video.author?.name || 'Rutube Channel',
        views: video.views ? `${video.views} просмотров` : '',
        time: video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : ''
      };
    });
  } catch (e) {
    console.error('Rutube API Error:', e.message);
    return [];
  }
}

// ─── VK Video Search (Опционально, требует токен) ───
async function searchVK(query) {
  const VK_TOKEN = process.env.VK_ACCESS_TOKEN;
  if (!VK_TOKEN) return []; // Если токена нет, пропускаем

  try {
    const res = await axios.get('https://api.vk.com/method/video.search', {
      params: {
        q: query,
        count: 15,
        access_token: VK_TOKEN,
        v: '5.131'
      }
    });

    if (!res.data.response || !res.data.response.items) return [];

    return res.data.response.items.map(video => ({
      platform: 'VK',
      color: '#4a76a8',
      title: video.title || 'Без названия',
      thumbnail: video.image?.[0]?.url || '',
      url: video.player || `https://vk.com/video-${video.owner_id}_${video.id}`,
      channel: `ID: ${video.owner_id}`,
      views: video.views ? `${video.views} просмотров` : '',
      time: ''
    }));
  } catch (e) {
    console.error('VK API Error:', e.message);
    return [];
  }
}

// ─── Главный Endpoint Поиска ───
app.post('/api/search', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'Пустой или некорректный запрос' });
  }

  const cleanQuery = query.trim();

  try {
    // Запускаем поиск параллельно для скорости
    const [youtube, dailymotion, rutube, vk] = await Promise.all([
      searchYouTube(cleanQuery),
      searchDailymotion(cleanQuery),
      searchRutube(cleanQuery),
      searchVK(cleanQuery)
    ]);

    // Объединяем результаты
    let allVideos = [
      ...youtube,
      ...dailymotion,
      ...rutube,
      ...vk
    ];

    // Фильтруем пустые результаты на всякий случай
    allVideos = allVideos.filter(v => v && v.title);

    // Перемешиваем результаты, чтобы платформы были равномерно распределены
    allVideos.sort(() => Math.random() - 0.5);

    res.json({
      videos: allVideos,
      total: allVideos.length,
      platforms: {
        youtube: youtube.length,
        dailymotion: dailymotion.length,
        rutube: rutube.length,
        vk: vk.length
      }
    });

  } catch (error) {
    console.error('Global Search Error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при поиске' });
  }
});

// ─── Health Check (Проверка работоспособности) ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platforms: ['YouTube', 'Dailymotion', 'Rutube', 'VK (optional)'],
    message: 'Backend is running and ready to serve requests.'
  });
});

// ─── Запуск Сервера ───
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 YouTube Key: ${YOUTUBE_API_KEY ? 'Set' : 'Missing'}`);
  console.log(`🔑 VK Token: ${process.env.VK_ACCESS_TOKEN ? 'Set' : 'Missing'}`);
});
