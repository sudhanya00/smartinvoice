/**
 * Server-side proxy for Gemini (Vercel serverless function).
 *
 * The browser never sees the Gemini key. It sends the signed-in user's
 * Firebase ID token; this function verifies it, then forwards the request
 * to Gemini with the key held in the server environment.
 *
 * Environment variables:
 *   GEMINI_API_KEY             the Gemini key (server only). The old name,
 *                              REACT_APP_GEMINI_API_KEY, is still accepted
 *                              here so an existing deployment keeps working;
 *                              scripts/build.js keeps it out of the bundle.
 *   GEMINI_MODEL               optional, defaults to DEFAULT_MODEL
 *   REACT_APP_FIREBASE_CONFIG  the same JSON the client uses; only its
 *                              projectId is read here
 */
const crypto = require('crypto');

const DEFAULT_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const CERTS_URL =
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = { certs: null, expiresAt: 0 };

function getProjectId() {
    if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
    try {
        return JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || '{}').projectId || null;
    } catch (e) {
        return null;
    }
}

async function getCerts() {
    if (certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;
    const response = await fetch(CERTS_URL);
    if (!response.ok) throw new Error('Could not load Firebase signing certificates');
    const certs = await response.json();
    const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') || '');
    const ttlMs = (maxAge ? Number(maxAge[1]) : 3600) * 1000;
    certCache = { certs, expiresAt: Date.now() + ttlMs };
    return certs;
}

function decodeSegment(segment) {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * Verify a Firebase ID token: RS256 signature against Google's published
 * certificates, plus audience, issuer, expiry and subject.
 * Returns the token payload, or null if the token is not valid.
 */
async function verifyIdToken(token, projectId) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) return null;

    let header, payload;
    try {
        header = decodeSegment(parts[0]);
        payload = decodeSegment(parts[1]);
    } catch (e) {
        return null;
    }
    if (header.alg !== 'RS256' || !header.kid) return null;

    const certs = await getCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    if (!verifier.verify(cert, parts[2], 'base64url')) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.sub !== 'string' || payload.sub === '') return null;
    return payload;
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;
    const projectId = getProjectId();
    if (!apiKey || !projectId) {
        return res.status(500).json({ error: { message: 'AI is not configured on the server.' } });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let user = null;
    try {
        user = await verifyIdToken(token, projectId);
    } catch (e) {
        console.error('Token verification failed:', e);
        return res.status(503).json({ error: { message: 'Could not verify sign-in. Try again.' } });
    }
    if (!user) {
        return res.status(401).json({ error: { message: 'Please sign in to use AI features.' } });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = null;
        }
    }
    if (!body || !Array.isArray(body.contents) || body.contents.length === 0) {
        return res.status(400).json({ error: { message: 'Request must include contents.' } });
    }

    // Forward only the fields the app uses; the model and key are chosen here.
    const payload = { contents: body.contents };
    if (body.generationConfig && typeof body.generationConfig === 'object') {
        payload.generationConfig = body.generationConfig;
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    try {
        const upstream = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(payload),
        });
        const result = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json(result);
    } catch (e) {
        console.error('Gemini request failed:', e);
        return res.status(502).json({ error: { message: 'Could not reach the AI service.' } });
    }
}

module.exports = handler;
module.exports.verifyIdToken = verifyIdToken;
