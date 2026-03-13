import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { fetchWeather } from '../services/weatherService.js';

const router = Router();

// GET /api/weather?lat=X&lng=Y
router.get('/', requireAuth, async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' });
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  try {
    const weather = await fetchWeather(latitude, longitude);
    res.json(weather);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch weather data', details: err.message });
  }
});

export default router;
