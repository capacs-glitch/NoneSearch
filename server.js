const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const DAILYMOTION_API_BASE = 'https://api.dailymotion.com';

// ─── YouTube Search ───
async function searchYouTube(query) {
  if (!YOUTUBE_API_KEY) return [];
  
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 10,
        key: YOUTUBE_API_KEY,
        regionCode: 'RU',
        relevanceLanguage: 'ru'
      }
    });

    return response.data.items.map(item => ({
      platform: 'YouTube',
      color: '#ff0033',
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      channel: item.snippet.channelTitle,
      views: '',
      publishedAt: item.snippet.publishedAt
    }));
  } catch (err) {
    console.error('YouTube Error:', err.message);
    return [];
  }
}

// ─── Twitch Search ───
let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    
    twitchToken = response.data.access_token;
    twitchTokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
    return twitchToken;
  } catch (err) {
    console.error('Twitch Token Error:', err.message);
    return null;
  }
}

async function searchTwitch(query) {
  if (!TWITCH_CLIENT_ID) return [];
  
  const token = await getTwitchToken();
  if (!token) return [];

  try {
    // Поиск каналов
    const channels = await axios.get('https://api.twitch.tv/helix/search/channels', {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      },
      params: { query, limit: 5 }
    });

    // Поиск по категориям
    const categories = await axios.get('https://api.twitch.tv/helix/search/categories', {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      },
      params: { query, first: 3 }
    });

    const results = channels.data.data.map(ch => ({
      platform: 'Twitch',
      color: '#9146ff',
      title: `${ch.display_name} — ${ch.game_name || 'Just Chatting'}`,
      thumbnail: ch.thumbnail_url?.replace('{width}', '440').replace('{height}', '248') || '',
      url: `https://twitch.tv/${ch.login}`,
      channel: ch.display_name,
      views: ch.viewer_count ? `${ch.viewer_count} зрителей` : 'Оффлайн',
      isLive: ch.is_live
    }));

    const catResults = categories.data.data.map(cat => ({
      platform: 'Twitch',
      color: '#9146ff',
      title: `Категория: ${cat.name}`,
      thumbnail: '',
      url: `https://twitch.tv/directory/category/${encodeURIComponent(cat.id)}`,
      channel: 'Категория',
      views: `${cat.game_count || 0} стримеров`
    }));

    return [...results, ...catResults];
  } catch (err) {
    console.error('Twitch Search Error:', err.message);
    return [];
  }
}

// ─── VK Video Search ───
async function searchVK(query) {
  if (!VK_ACCESS_TOKEN) return [];
  
  try {
    const response = await axios.get('https://api.vk.com/method/video.search', {
      params: {
        q: query,
        count: 10,
        access_token: VK_ACCESS_TOKEN,
        v: '5.131'
      }
    });

    if (!response.data.response || !response.data.response.items) return [];

    return response.data.response.items.map(video => ({
      platform: 'VK',
      color: '#4a76a8',
      title: video.title || 'Без названия',
      thumbnail: video.image?.length > 0 ? video.image[0].url : '',
      url: video.player || `https://vk.com/video-${video.owner_id}_${video.id}`,
      channel: `ID: ${video.owner_id}`,
      views: video.views ? `${video.views} просмотров` : ''
    }));
  } catch (err) {
    console.error('VK Error:', err.message);
    return [];
  }
}

// ─── Dailymotion Search ───
async function searchDailymotion(query) {
  try {
    const response = await axios.get('https://api.dailymotion.com/videos', {
      params: {
        search: query,
        fields: 'title,thumbnail_url,url,owner,views_total,duration',
        limit: 10,
        family_filter: true
      }
    });

    return response.data.list.map(video => ({
      platform: 'Dailymotion',
      color: '#00aaff',
      title: video.title,
      thumbnail: video.thumbnail_url,
      url: video.url,
      channel: video.owner?.screenname || '',
      views: video.views_total ? `${Math.round(video.views_total / 1000)}K` : ''
    }));
  } catch (err) {
    console.error('Dailymotion Error:', err.message);
    return [];
  }
}

// ─── Vimeo Search ───
async function searchVimeo(query) {
  try {
    const response = await axios.get('https://api.vimeo.com/videos', {
      headers: {
        'Authorization': 'Bearer ' + (process.env.VIMEO_TOKEN || '')
      },
      params: {
        query: query,
        per_page: 10,
        sort: 'relevant'
      }
    });

    return response.data.data.map(video => ({
      platform: 'Vimeo',
      color: '#00adef',
      title: video.name,
      thumbnail: video.pictures?.sizes?.[2]?.link || '',
      url: video.link,
      channel: video.user?.name || '',
      views: video.stats?.plays ? `${video.stats.plays.toLocaleString()}` : ''
    }));
  } catch (err) {
    console.error('Vimeo Error:', err.message);
    return [];
  }
}

// ─── Kick Search ───
async function searchKick(query) {
  try {
    const response = await axios.get(`https://kick.com/api/v2/search/livestreams?query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.data || !response.data.data) return [];

    return response.data.data.map(ch => ({
      platform: 'Kick',
      color: '#53fc18',
      title: `${ch.user?.username} — ${ch.session_title || ''}`,
      thumbnail: ch.thumbnail?.responsive?.medium || '',
      url: `https://kick.com/${ch.channel?.slug}`,
      channel: ch.user?.username || '',
      views: `${ch.viewers} зрителей`
    }));
  } catch (err) {
    console.error('Kick Error:', err.message);
    return [];
  }
}

// ─── Главный endpoint ───
app.post('/api/search', async (req, res) => {
  const { query, platforms = ['youtube', 'twitch', 'vk', 'dailymotion', 'vimeo', 'kick'] } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Запрос не указан' });
  }

  const promises = [];
  
  if (platforms.includes('youtube')) promises.push(searchYouTube(query));
  if (platforms.includes('twitch')) promises.push(searchTwitch(query));
  if (platforms.includes('vk')) promises.push(searchVK(query));
  if (platforms.includes('dailymotion')) promises.push(searchDailymotion(query));
  if (platforms.includes('vimeo')) promises.push(searchVimeo(query));
  if (platforms.includes('kick')) promises.push(searchKick(query));

  try {
    const results = await Promise.all(promises);
    const allVideos = results.flat();
    
    res.json({ videos: allVideos, total: allVideos.length });
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});