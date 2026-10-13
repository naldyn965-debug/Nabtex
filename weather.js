/**
 * Nabtex — Weather proxy (WeatherAPI.com)
 *
 * GET /api/weather?lat=<number>&lon=<number>
 *
 * - المفتاح بيتقرا من متغير البيئة WEATHER_API_KEY على الخادم فقط (Vercel → Settings → Environment Variables).
 *   مفيش أي مكان في الكود أو في الرد بيظهر فيه المفتاح.
 * - بيطلب من WeatherAPI.com (forecast.json, days=3 — بيرجّع كمان كائن `current` الخاص بالطقس الحالي)
 *   وبيحوّل الرد لنفس شكل Open-Meteo اللي الواجهة متعودة عليه، فمنطق التنبيهات والعرض في index.html
 *   مش بيتغيّر: الحرارة والرطوبة والرياح وحالة الطقس والوحدات (°م، %، كم/س، مم) زي ما هي.
 * - ET₀ (التبخر المرجعي) مش متاح في خطط WeatherAPI غير Enterprise، فبيتحسب هنا تقديريًا بمعادلة Hargreaves-Samani (FAO-56) من الحرارة العظمى/الصغرى وخط العرض وتاريخ اليوم.
 *   + رطوبة وغطاء سحب كل ساعة (للتقييم الدقيق للصقيع والرش) + generated_at/local_time (عشان الواجهة تحسب «الآن» صح حتى من الكاش).
 */
'use strict';

const UPSTREAM = 'https://api.weatherapi.com/v1/forecast.json';
const UPSTREAM_TIMEOUT_MS = 4000;

/* WeatherAPI condition.code → كود WMO (نفس الأكواد اللي nbWeatherIcon/nbWeatherDesc متعودة عليها) */
const CLEAR = [1000];
const PARTLY = [1003];
const CLOUDY = [1006, 1009, 1063, 1066, 1069, 1072, 1087]; /* «possible» بتتعامل كغائم عشان منبالغش في المطر */
const FOG = [1030, 1135, 1147];
const LIGHT_RAIN = [1150, 1153, 1168, 1171, 1180, 1183, 1240];
const RAIN = [1186, 1189, 1192, 1195, 1198, 1201, 1243, 1246];
const THUNDER = [1273, 1276, 1279, 1282];
const SNOW_ICE = [1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264];

function wmo(code) {
  const c = Number(code);
  if (CLEAR.includes(c)) return 0;
  if (PARTLY.includes(c)) return 2;
  if (CLOUDY.includes(c)) return 3;
  if (FOG.includes(c)) return 45;
  if (LIGHT_RAIN.includes(c)) return 51;
  if (RAIN.includes(c)) return 63;
  if (THUNDER.includes(c)) return 95;
  if (SNOW_ICE.includes(c)) return 71;
  return 3;
}

/* الإشعاع خارج الغلاف الجوي Ra (ميجاجول/م²/يوم) — FAO-56 معادلة 21 */
function extraRad(latDeg, dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m || !Number.isFinite(latDeg)) return null;
  const J = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(+m[1], 0, 0)) / 86400000);
  const phi = latDeg * Math.PI / 180;
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * J / 365);
  const dl = 0.409 * Math.sin(2 * Math.PI * J / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dl))));
  return (24 * 60 / Math.PI) * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dl) + Math.cos(phi) * Math.cos(dl) * Math.sin(ws));
}

/* ET₀ تقديري (مم/يوم) — Hargreaves-Samani: 0.0023·(Tmean+17.8)·√(Tmax−Tmin)·Ra·0.408 */
function et0Hargreaves(tmax, tmin, latDeg, dateStr) {
  if (tmax == null || tmin == null) return null;
  const ra = extraRad(latDeg, dateStr);
  if (ra == null) return null;
  const v = 0.0023 * ((tmax + tmin) / 2 + 17.8) * Math.sqrt(Math.max(tmax - tmin, 0)) * ra * 0.408;
  return Number.isFinite(v) ? Math.round(Math.max(0, Math.min(15, v)) * 10) / 10 : null;
}

function num(x) {
  const n = typeof x === 'number' ? x : parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

/* "2026-10-13 6:30" | "2026-10-13 06:30" → "2026-10-13T06:30" (نفس صيغة Open-Meteo) */
function isoLocal(s) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/.exec(String(s || ''));
  return m ? m[1] + 'T' + (m[2].length < 2 ? '0' : '') + m[2] + ':' + m[3] : null;
}

function mapResponse(w) {
  const cur = w && w.current;
  const days = w && w.forecast && w.forecast.forecastday;
  if (!cur || !Array.isArray(days) || !days.length) return null;

  const out = {
    source: 'weatherapi.com',
    generated_at: Date.now(),
    local_time: isoLocal(w.location && w.location.localtime),
    et0_method: 'hargreaves-samani',
    latitude: num(w.location && w.location.lat),
    longitude: num(w.location && w.location.lon),
    current: {
      time: isoLocal(cur.last_updated) || isoLocal(w.location && w.location.localtime),
      temperature_2m: num(cur.temp_c),
      relative_humidity_2m: num(cur.humidity),
      wind_speed_10m: num(cur.wind_kph),
      wind_gusts_10m: num(cur.gust_kph),
      weather_code: wmo(cur.condition && cur.condition.code)
    },
    hourly: { time: [], temperature_2m: [], relative_humidity_2m: [], cloud_cover: [], wind_speed_10m: [], wind_gusts_10m: [], precipitation_probability: [], precipitation: [] },
    daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [], precipitation_probability_max: [], et0_fao_evapotranspiration: [] }
  };

  days.forEach(function (d) {
    const day = d.day || {};
    out.daily.time.push(d.date);
    out.daily.temperature_2m_max.push(num(day.maxtemp_c));
    out.daily.temperature_2m_min.push(num(day.mintemp_c));
    out.daily.precipitation_sum.push(num(day.totalprecip_mm));
    out.daily.precipitation_probability_max.push(num(day.daily_chance_of_rain));
    out.daily.et0_fao_evapotranspiration.push(et0Hargreaves(num(day.maxtemp_c), num(day.mintemp_c), out.latitude, d.date));
    (d.hour || []).forEach(function (h) {
      out.hourly.time.push(isoLocal(h.time));
      out.hourly.temperature_2m.push(num(h.temp_c));
      out.hourly.relative_humidity_2m.push(num(h.humidity));
      out.hourly.cloud_cover.push(num(h.cloud));
      out.hourly.wind_speed_10m.push(num(h.wind_kph));
      out.hourly.wind_gusts_10m.push(num(h.gust_kph));
      out.hourly.precipitation_probability.push(num(h.chance_of_rain));
      out.hourly.precipitation.push(num(h.precip_mm));
    });
  });

  if (!out.current.time || out.current.temperature_2m == null || !out.hourly.time.length) return null;
  return out;
}

function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Object.keys(headers || {}).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.end(JSON.stringify(body));
}

function fail(res, status, error, extra) {
  send(res, status, { error: error }, Object.assign({ 'Cache-Control': 'no-store' }, extra || {}));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method_not_allowed', { Allow: 'GET, HEAD' });

  /* مواقع تانية مالهاش تستخدم الـ proxy ده من متصفح الزائر */
  const site = String((req.headers && req.headers['sec-fetch-site']) || '');
  if (site === 'cross-site') return fail(res, 403, 'forbidden');

  const key = process.env.WEATHER_API_KEY;
  if (!key) { console.error('[weather] WEATHER_API_KEY is not set'); return fail(res, 503, 'not_configured'); }

  let lat, lon;
  try {
    const u = new URL(req.url, 'http://localhost');
    lat = u.searchParams.get('lat'); lon = u.searchParams.get('lon');
  } catch (e) { return fail(res, 400, 'bad_request'); }
  if (lat == null || lon == null || lat.trim() === '' || lon.trim() === '') return fail(res, 400, 'bad_request');
  lat = Number(lat); lon = Number(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail(res, 400, 'bad_request');
  /* دقة منزلتين (~1 كم) = نفس دقة مفتاح الكاش في الواجهة، وبتزوّد فرصة إعادة استخدام الرد */
  const q = lat.toFixed(2) + ',' + lon.toFixed(2);

  const url = UPSTREAM + '?key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(q) + '&days=3&aqi=no&alerts=no';
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, UPSTREAM_TIMEOUT_MS);
  let up, text;
  try {
    up = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    text = await up.text();
  } catch (e) {
    /* مفيش طباعة لـ e.message عشان أي رسالة ممكن تحتوي على الرابط (وفيه المفتاح) */
    console.error('[weather] upstream unreachable:', e && e.name);
    return fail(res, e && e.name === 'AbortError' ? 504 : 502, 'unreachable');
  } finally { clearTimeout(timer); }

  let body = null;
  try { body = JSON.parse(text); } catch (e) { /* غير JSON */ }

  if (!up.ok) {
    const code = body && body.error && body.error.code;
    console.error('[weather] upstream error: http', up.status, 'code', code);
    if (up.status === 429 || code === 2007) return fail(res, 429, 'rate_limited', { 'Retry-After': '600' });
    if (code === 1006) return fail(res, 404, 'no_location');
    return fail(res, 502, 'upstream_error'); /* 1002 / 2006 / 2008 / 2009 / 9999 … */
  }

  const data = body && mapResponse(body);
  if (!data) { console.error('[weather] unexpected upstream payload'); return fail(res, 502, 'bad_payload'); }

  /* كاش على الـ CDN بس (5 دقايق) — المتصفح لا يخزّن؛ الكاش المحلي 30 دقيقة بيتحكم فيه كود الواجهة */
  send(res, 200, data, { 'Cache-Control': 'public, max-age=0, s-maxage=300' });
};

module.exports._mapResponse = mapResponse;
module.exports._wmo = wmo;
module.exports._extraRad = extraRad;
module.exports._et0 = et0Hargreaves;
