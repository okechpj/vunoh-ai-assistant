/**
 * AIService
 *
 * Responsibilities:
 * - Provide deterministic, reliable AI interactions for downstream systems
 * - Enforce JSON-only outputs where required
 * - Validate / normalize AI outputs
 * - Retry on transient failures (single retry)
 *
 * Design notes:
 * - CommonJS module (project `package.json` uses "type": "commonjs")
 * - Uses `axios` for HTTP calls (already in project deps)
 * - Uses environment variables: AI_API_KEY, AI_PROVIDER ('openai' by default), AI_API_URL (optional)
 * - Prompts are kept in separate functions (no inline prompts in method bodies)
 * - No database or business logic is contained here
 *
 * Important: downstream systems rely on strict shapes. Methods attempt one retry on parsing/validation errors,
 * and fall back to safe defaults as specified in the requirements.
 */

const axios = require('axios');
require('dotenv').config();

// Constants / configuration
const AI_PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase(); // extensible for 'gemini', 'groq', etc.
const AI_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || AI_API_KEY;
const AI_API_URL = process.env.AI_API_URL; // optional override for non-OpenAI providers
const DEFAULT_MODEL = process.env.AI_MODEL || (AI_PROVIDER === 'openai' ? 'gpt-4o' : (AI_PROVIDER === 'groq' ? 'groq-1' : 'llama-3.3-70b-versatile'));
const DEFAULT_TEMPERATURE = 0.2; // low randomness for determinism
const REQUEST_TIMEOUT_MS = 25_000;

// Allowed intents and entity keys (single source of truth)
const ALLOWED_INTENTS = ['send_money', 'hire_service', 'verify_document', 'check_status'];
const ENTITY_KEYS = [
  'amount',
  'recipient',
  'location',
  'service_type',
  'document_type',
  'urgency'
];
const URGENCY_VALUES = ['low', 'medium', 'high'];

// Fallback outputs
const EXTRACT_FALLBACK = { intent: 'unknown', entities: {} };
const STEPS_FALLBACK = ['Task received', 'Processing request', 'Completion pending'];
const MESSAGES_FALLBACK = (task_code) => ({
  whatsapp: `🔔 Task ${task_code} received. We'll follow up soon.`,
  email: `Task ${task_code}\n\nWe received your request and are processing it.\n\nDetails: (not available)\n\nRegards,\nSupport`,
  sms: `Task ${task_code} received. We'll follow up.`
});

// Utilities

function nowIso() {
  return new Date().toISOString();
}

function logAIInteraction(type, input, output, meta = {}) {
  // Minimal structured logging to console; replace with a proper logger in prod
  console.info(JSON.stringify({
    ts: nowIso(),
    service: 'AIService',
    type,
    input,
    output,
    meta
  }));
}

/**
 * Safe JSON parse - trims noise and returns parsed object or throws.
 */
function safeParseJSON(text) {
  if (typeof text !== 'string') throw new Error('safeParseJSON expected string input');
  const cleaned = text.trim()
    .replace(/^\uFEFF/, '') // BOM
    .replace(/^[^\{|\[]+/, '') // strip leading non-json if any (aggressive)
    .replace(/[^\}\]]+$/, ''); // strip trailing non-json (aggressive)
  // Attempt robust parse with fallback attempts
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to recover by locating first JSON substring
    const openIdx = Math.max(cleaned.indexOf('{'), cleaned.indexOf('['));
    const closeIdx = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (openIdx >= 0 && closeIdx > openIdx) {
      const sub = cleaned.substring(openIdx, closeIdx + 1);
      try {
        return JSON.parse(sub);
      } catch (e2) {
        throw new Error('safeParseJSON: invalid JSON after recovery attempts');
      }
    }
    throw new Error('safeParseJSON: invalid JSON');
  }
}

/**
 * Ensure the `intent` is one of the allowed intents.
 */
function validateIntent(intent) {
  return typeof intent === 'string' && ALLOWED_INTENTS.includes(intent);
}

/**
 * Normalize entity values and ensure all keys present with null defaults.
 * - Convert numeric-looking strings to numbers
 * - Remove commas/currency characters when converting
 * - Normalize urgency to allowed values or null
 */
function normalizeEntities(raw = {}) {
  const out = {};
  ENTITY_KEYS.forEach((k) => {
    out[k] = null;
  });

  if (!raw || typeof raw !== 'object') return out;

  // Helper to parse numbers
  const toNumberOrNull = (v) => {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const s = v.trim().replace(/[$,]/g, '').replace(/\s+/g, '');
      if (s === '') return null;
      // Try parseInt/parseFloat
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  // Map expected keys
  out.amount = toNumberOrNull(raw.amount ?? raw.value ?? raw.amount_string);
  out.recipient = raw.recipient ?? raw.to ?? raw.name ?? null;
  out.location = raw.location ?? raw.address ?? null;
  out.service_type = raw.service_type ?? raw.service ?? null;
  out.document_type = raw.document_type ?? raw.document ?? null;

  // urgency normalization
  const urgRaw = (raw.urgency || (raw.priority ? String(raw.priority) : null));
  if (urgRaw) {
    const normalized = String(urgRaw).toLowerCase();
    if (URGENCY_VALUES.includes(normalized)) out.urgency = normalized;
    else out.urgency = null;
  } else {
    out.urgency = null;
  }

  // Ensure null for empty strings
  Object.keys(out).forEach(k => {
    if (typeof out[k] === 'string' && out[k].trim() === '') out[k] = null;
  });

  return out;
}

/**
 * Generic retry helper: `fn` is async function returning value.
 * `attempts` default 2 (initial + 1 retry).
 */
async function retry(fn, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Log retry attempt
      logAIInteraction('retry', { attempt: i + 1, attempts }, { error: String(err) });
      if (i === attempts - 1) break;
    }
  }
  throw lastErr;
}

// Prompt templates (kept separate functions)
function prompt_extractIntentEntities() {
  return [
    {
      role: 'system',
      content: [
        'You are a deterministic extraction assistant. When given user text, you MUST output JSON only (no commentary).',
        `Allowed intents: ${ALLOWED_INTENTS.join(', ')}`,
        'Entities to extract: amount (number), recipient (string), location (string), service_type (string), document_type (string), urgency (low|medium|high).',
        'Output EXACTLY the JSON object with shape: { "intent": "...", "entities": { "amount": number|null, "recipient": string|null, "location": string|null, "service_type": string|null, "document_type": string|null, "urgency": "low|medium|high"|null } }',
        'If you cannot determine an intent from allowed list, set intent to "unknown" and entities to {}.'
      ].join(' ')
    }
  ];
}

function prompt_generateSteps(intent, entities) {
  return [
    {
      role: 'system',
      content: [
        'You are an assistant that produces concrete, actionable steps tailored to a task intent.',
        'Return JSON only: an array of strings (no markdown, no numbering, no explanation).',
        'Minimum of 3 steps. Steps must be precise and relevant to the provided intent and entities.'
      ].join(' ')
    },
    {
      role: 'user',
      content: `Intent: ${intent}\nEntities: ${JSON.stringify(entities)}\nReturn the ordered steps as JSON array.`
    }
  ];
}

function prompt_generateMessages(taskData) {
  return [
    {
      role: 'system',
      content: [
        'You are a templating assistant that generates channel-specific messages for a task.',
        'Return JSON only with keys: whatsapp, email, sms.',
        'WhatsApp: conversational, may contain line breaks and light emoji.',
        'Email: formal, structured, must include task_code and full details.',
        'SMS: concise <= 160 characters and must include task_code.',
        'Do NOT include extra fields.',
        'Give the message abit more description and details if the risk_score is high, and keep it more generic if the risk_score is low.'
      ].join(' ')
    },
    {
      role: 'user',
      content: `Task: ${JSON.stringify(taskData)}\nReturn JSON only with whatsapp, email, sms values.`
    }
  ];
}

function prompt_generateFollowUpQuestion(intent, missingEntities, currentEntities) {
  return [
    {
      role: 'system',
      content: [
        'You are a concise assistant that asks a single, focused follow-up question to collect missing information.',
        'ONLY return the question text — do NOT return JSON, instructions, or any metadata.',
        'Keep the question brief, polite, and specific to the missing fields. Use natural language.'
      ].join(' ')
    },
    {
      role: 'user',
      content: `Intent: ${intent}\nMissing: ${JSON.stringify(missingEntities)}\nCurrent: ${JSON.stringify(currentEntities)}\nReturn a single follow-up question aimed to obtain the missing fields.`
    }
  ];
}

// AI call abstraction
async function callLLM(messages = [], options = {}) {
  if (!AI_API_KEY) {
    throw new Error('AI_API_KEY not set in environment');
  }

  const model = options.model || DEFAULT_MODEL;
  const temperature = (typeof options.temperature === 'number') ? options.temperature : DEFAULT_TEMPERATURE;
  const timeout = options.timeout || REQUEST_TIMEOUT_MS;

  // Build request based on provider
  if (AI_PROVIDER === 'openai') {
    // Use Chat Completions (OpenAI style)
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model,
      messages,
      temperature,
      max_tokens: options.max_tokens || 512,
      n: 1
    };

    const headers = {
      'Authorization': `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const res = await axios.post(url, body, { headers, timeout });
    const data = res.data;
    // extract content robustly
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.output ??
      JSON.stringify(data);

    logAIInteraction('raw_response', { provider: 'openai', model }, data);
    return String(content);
  }
  // Groq provider support
  if (AI_PROVIDER === 'groq') {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in environment');
    // lazy require to avoid loading when not used
    const Groq = require('groq-sdk');
    const groqClient = new Groq({ apiKey: GROQ_API_KEY });

    try {
      // groq-sdk expects similar shape: model + messages
      const res = await groqClient.chat.completions.create({ model, messages, temperature, max_tokens: options.max_tokens || 512 });
      // SDK returns structured object; attempt common paths
      const content =
        res?.choices?.[0]?.message?.content ??
        res?.output?.[0]?.content ??
        res?.output ??
        JSON.stringify(res);

      logAIInteraction('raw_response', { provider: 'groq', model }, res);
      return String(content);
    } catch (err) {
      // forward the error for retry logic
      throw err;
    }
  }

  // Generic provider: POST to AI_API_URL (developer must set)
  if (!AI_API_URL) {
    throw new Error('AI_API_URL must be set for non-openai/groq providers');
  }

  try {
    const body = {
      model,
      messages,
      temperature,
      max_tokens: options.max_tokens || 512
    };

    const headers = {
      'Authorization': `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const res = await axios.post(AI_API_URL, body, { headers, timeout });
    const data = res.data;

    // attempt common extraction keys
    const content =
      data?.output?.[0]?.content ??
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.text ??
      JSON.stringify(data);

    logAIInteraction('raw_response', { provider: 'generic', model, url: AI_API_URL }, data);
    return String(content);
  } catch (err) {
    // rethrow so callers can retry
    throw err;
  }
}

// AIService class
class AIService {
  constructor(opts = {}) {
    this.provider = AI_PROVIDER;
    this.model = opts.model || DEFAULT_MODEL;
    this.fallbackModel = opts.fallbackModel || process.env.AI_FALLBACK_MODEL || null;
  }

  /**
   * extractIntentEntities(userInput)
   * - returns strict shape or EXTRACT_FALLBACK
   */
  async extractIntentEntities(userInput) {
    const attempt = async () => {
      const messages = [
        ...prompt_extractIntentEntities(),
        { role: 'user', content: String(userInput || '') }
      ];

      const raw = await callLLM(messages, { model: this.model, temperature: DEFAULT_TEMPERATURE });
      logAIInteraction('extract_raw', { userInput }, raw);

      // enforce JSON-only output
      let parsed;
      try {
        parsed = safeParseJSON(String(raw));
      } catch (err) {
        throw new Error('invalid_json');
      }

      // Validate shape
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('invalid_shape');
      }

      const { intent, entities } = parsed;

      if (!validateIntent(intent)) {
        throw new Error('invalid_intent');
      }

      if (!entities || typeof entities !== 'object') {
        throw new Error('invalid_entities');
      }

      // Normalize
      const normalizedEntities = normalizeEntities(entities);

      const result = {
        intent,
        entities: normalizedEntities
      };

      logAIInteraction('extract_parsed', { userInput }, result);
      return result;
    };

    try {
      return await retry(attempt, 2);
    } catch (err) {
      logAIInteraction('extract_failed', { userInput }, { error: String(err) });
      // Fallback per requirements
      return EXTRACT_FALLBACK;
    }
  }

  /**
   * generateSteps(intent, entities)
   * - returns array of strings (min 3), fallback if necessary
   */
  async generateSteps(intent, entities) {
    if (!validateIntent(intent)) {
      logAIInteraction('generateSteps_invalid_intent', { intent }, null);
      return STEPS_FALLBACK;
    }

    const attempt = async () => {
      const messages = prompt_generateSteps(intent, entities);
      const raw = await callLLM(messages, { model: this.model, temperature: DEFAULT_TEMPERATURE });
      logAIInteraction('steps_raw', { intent, entities }, raw);

      // Expect JSON array
      let parsed;
      try {
        parsed = safeParseJSON(String(raw));
      } catch (err) {
        throw new Error('invalid_json');
      }

      if (!Array.isArray(parsed)) throw new Error('not_array');

      // Clean array: only strings, trim, remove empty, ensure no markdown/numbering
      const cleaned = parsed
        .map(s => (typeof s === 'string' ? s.trim().replace(/^[\d\.\-\)\s]+/, '') : null))
        .filter(Boolean);

      if (cleaned.length < 3) throw new Error('insufficient_steps');

      logAIInteraction('steps_parsed', { intent, entities }, cleaned);
      return cleaned;
    };

    try {
      return await retry(attempt, 2);
    } catch (err) {
      logAIInteraction('generateSteps_failed', { intent, entities }, { error: String(err) });
      return STEPS_FALLBACK;
    }
  }

  /**
   * generateMessages(taskData)
   * - taskData: { task_code, intent, entities, risk_score }
   * - returns { whatsapp, email, sms }
   */
  async generateMessages(taskData) {
    const attempt = async () => {
      const messages = prompt_generateMessages(taskData);
      const raw = await callLLM(messages, { model: this.model, temperature: DEFAULT_TEMPERATURE });
      logAIInteraction('messages_raw', { taskData }, raw);

      let parsed;
      try {
        parsed = safeParseJSON(String(raw));
      } catch (err) {
        throw new Error('invalid_json');
      }

      if (!parsed || typeof parsed !== 'object') throw new Error('invalid_shape');

      // Validate presence of keys
      const whatsapp = typeof parsed.whatsapp === 'string' ? parsed.whatsapp.trim() : null;
      const email = typeof parsed.email === 'string' ? parsed.email.trim() : null;
      const sms = typeof parsed.sms === 'string' ? parsed.sms.trim() : null;

      if (!whatsapp || !email || !sms) throw new Error('missing_channel');

      // Ensure SMS <= 160 chars and contains task_code
      const smsLimit = 160;
      if (sms.length > smsLimit || !String(sms).includes(String(taskData.task_code))) {
        throw new Error('sms_invalid');
      }

      const output = { whatsapp, email, sms };
      logAIInteraction('messages_parsed', { taskData }, output);
      return output;
    };

    try {
      return await retry(attempt, 2);
    } catch (err) {
      logAIInteraction('generateMessages_failed', { taskData }, { error: String(err) });
      // Fallback templated messages
      const t = taskData?.task_code || 'UNKNOWN';
      const fallback = MESSAGES_FALLBACK(t);
      return fallback;
    }
  }

  /**
   * generateFollowUpQuestion(intent, missingEntities, currentEntities)
   * - returns a short natural language question string
   */
  async generateFollowUpQuestion(intent, missingEntities, currentEntities) {
    // Defensive: do not let AI decide control flow — it only generates a question
    const attempt = async () => {
      const messages = prompt_generateFollowUpQuestion(intent, missingEntities, currentEntities);
      const raw = await callLLM(messages, { model: this.model, temperature: 0.3, max_tokens: 80 });
      logAIInteraction('followup_raw', { intent, missingEntities, currentEntities }, raw);

      // AI should return plain text; trim and return
      const text = String(raw || '').trim();
      if (!text) throw new Error('empty_followup');
      // Ensure it's a single question-like sentence (best effort)
      return text.replace(/\s+/g, ' ');
    };

    try {
      return await retry(attempt, 2);
    } catch (err) {
      logAIInteraction('followup_failed', { intent, missingEntities, currentEntities }, { error: String(err) });
      // Safe fallback question
      const fields = Array.isArray(missingEntities) ? missingEntities.join(', ') : String(missingEntities);
      return `Could you please provide the following information: ${fields}?`;
    }
  }
}

module.exports = AIService;