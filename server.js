const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем запросы с GitHub Pages и отовсюду
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ─── ГЕНЕРАТОР ТЕСТОВЫХ ВИДЕО (ЕСЛИ YOUTUBE НЕ ОТВЕТИЛ) ───
function generateMockVideos(query) {
  console.log(`🤖 YouTube недоступен или ошибка. Отдаем демо-данные для: "${query}"`);
  
  const mockData = [
    { platform: 'YouTube', color: '#ff0033', title: `Результат поиска: ${query} (Демо)`, thumbnail: 'https://picsum.photos/seed/demoyt1/400/225', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', channel: 'Demo Channel', views: '1M просмотров' },
    { platform: 'YouTube', color: '#ff0033', title: 'Как работает YouTube API (Демо)', thumbnail: 'https://picsum.photos/seed/demoyt2/400/225', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', channel: 'Tech Demo', views: '500K просмотров' },
    { platform: 'YouTube', color: '#ff0033', title: 'Топ 10 видео (Демо)', thumbnail: 'https://picsum.photos/seed/demoyt3/400/225', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', channel: 'Top Lists', views: '2M просмотров' },
    { platform: 'YouTube', color: '#ff0033', title: 'Музыка 2024 (Демо)', thumbnail: 'https://picsum.photos/seed/demoyt4/400/225', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', channel: 'Music Hub', views: '10M просмотров' },
    { platform: 'YouTube', color: '#ff0033', title: 'Обзор технологий (Демо)', thumbnail: 'https://picsum.photos/seed/demoyt5/400/225', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', channel: 'Gadget Review', views: '300K просмотров' }
  ];
  
  return mockData;
}

// ─── YOUTUBE SEARCH ───
async function searchYouTube(query) {
  if (!YOUTUBE_API_KEY) return null; // Если ключа нет, идем сразу в фейк

  try {
    console.log(`🔍 YouTube search: "${query}"`);
    
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 12,
        key: YOUTUBE_API_KEY,
        relevanceLanguage: 'ru',
        order: 'relevance'
      }
    });

    if (!res.data.items || res.data.items.length === 0) return null;

    return res.data.items.map(item => ({
      platform: 'YouTube',
      color: '#ff0033',
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      channel: item.snippet.channelTitle,
      views: ''
    }));
  } catch (e) {
    console.error('❌ YouTube API Error (переходим в демо-режим):', e.message);
    return null; // Ошибка -> вызываем фейк
  }
}

// ─── ГЛАВНЫЙ ENDPOINT ───
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Пустой запрос' });

  try {
    // Пробуем получить реальные данные
    let videos = await searchYouTube(query.trim());

    // Если вернул null (ошибка или пусто) -> подставляем демо-данные
    if (!videos) {
      videos = generateMockVideos(query);
    }

    res.json({ videos, total: videos.length, platforms: { youtube: videos.length } });
  } catch (err) {
    console.error('❌ Search crash:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── HEALTH CHECK ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    youtubeKeySet: !!YOUTUBE_API_KEY,
    message: 'Server running. Demo mode active if API fails.',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 YouTube Key: ${YOUTUBE_API_KEY ? '✅ Loaded' : '❌ Missing (using Mock Data)'}`);
});
