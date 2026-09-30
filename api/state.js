// Vercel serverless function: GET/POST /api/state
// Stores the whole app state as a single JSON value in an Upstash Redis
// database (installed from the Vercel Marketplace) so every office that
// opens the deployed URL reads and writes the same shared sheet.
//
// One-time setup required in the Vercel dashboard before this works:
//   Project -> Storage -> Marketplace Database Integrations -> search
//   "Upstash" -> install "Upstash Redis" -> connect it to this project.
// (Vercel's own "KV" product was retired; Upstash Redis is its replacement
// and is what the Marketplace offers today.) That step injects REST
// credentials as env vars. Different integration versions have used
// slightly different names over time, so this file accepts either:
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (current default)
//   KV_REST_API_URL        / KV_REST_API_TOKEN          (older / migrated stores)
// Until one of these pairs is present, every call below fails gracefully
// with a clear error instead of crashing.

const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let redisClient = null;
let redisLoadError = null;

function getRedis() {
  if (redisClient || redisLoadError) return redisClient;
  try {
    // Lazy require so a missing/broken dependency doesn't crash the whole
    // function file at import time.
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({ url: REST_URL, token: REST_TOKEN });
  } catch (e) {
    redisLoadError = e;
  }
  return redisClient;
}

const STATE_KEY = 'ghiyab:state';

// Optional password protection: set an APP_PASSWORD environment variable
// in the Vercel project (Settings -> Environment Variables) to require it
// on every read AND write. Leave APP_PASSWORD unset to keep the app fully
// open (the previous, default behavior) — nothing else changes.
const APP_PASSWORD = process.env.APP_PASSWORD;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Password');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (APP_PASSWORD) {
    const given = req.headers['x-app-password'];
    if (given !== APP_PASSWORD) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  if (!REST_URL || !REST_TOKEN) {
    res.status(500).json({
      error:
        'No Redis database is connected to this project yet. In the Vercel dashboard, open the project, go to Storage, install "Upstash Redis" from the Marketplace, connect it to this project, then redeploy.',
    });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res.status(500).json({ error: 'Could not load the @upstash/redis client: ' + String(redisLoadError) });
    return;
  }

  if (req.method === 'GET') {
    try {
      const raw = await redis.get(STATE_KEY);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(raw ? JSON.stringify(raw) : 'null');
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      // Vercel auto-parses a JSON body when Content-Type: application/json,
      // but the frontend here just posts a raw JSON string, so handle both.
      let data = req.body;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      if (!data || typeof data !== 'object') throw new Error('invalid body');
      await redis.set(STATE_KEY, data);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e) });
    }
    return;
  }

  res.status(405).end();
};
