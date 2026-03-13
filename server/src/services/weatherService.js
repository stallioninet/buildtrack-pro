/**
 * Weather service using Open-Meteo API (free, no API key needed).
 * Fetches current weather conditions for a given lat/lng.
 */

const WMO_CODES = {
  0: 'Sunny', 1: 'Sunny', 2: 'Cloudy', 3: 'Cloudy',
  45: 'Foggy', 48: 'Foggy',
  51: 'Rainy', 53: 'Rainy', 55: 'Rainy',
  56: 'Rainy', 57: 'Rainy',
  61: 'Rainy', 63: 'Rainy', 65: 'Rainy',
  66: 'Rainy', 67: 'Rainy',
  71: 'Cold', 73: 'Cold', 75: 'Cold', 77: 'Cold',
  80: 'Rainy', 81: 'Rainy', 82: 'Stormy',
  85: 'Cold', 86: 'Cold',
  95: 'Stormy', 96: 'Stormy', 99: 'Stormy',
};

export async function fetchWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  const data = await res.json();
  const current = data.current;

  const weatherCode = current.weather_code;
  const temp = current.temperature_2m;
  let condition = WMO_CODES[weatherCode] || 'Cloudy';

  // Override based on temperature
  if (temp >= 38) condition = 'Hot';
  else if (temp <= 5) condition = 'Cold';

  return {
    condition,
    temperature: temp,
    humidity: current.relative_humidity_2m,
    wind_speed: current.wind_speed_10m,
    weather_code: weatherCode,
  };
}
