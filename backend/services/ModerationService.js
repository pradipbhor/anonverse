const axios = require('axios');
const leoProfanity = require('leo-profanity');
const logger = require('../loaders/logger');

/**
 * ModerationService
 *
 * Two-layer moderation — completely free, no billing required:
 *   Layer 1 — leo-profanity local filter  (zero latency, zero API calls)
 *   Layer 2 — Hugging Face Inference API — unitary/toxic-bert
 *             (free tier, no credit card, just HF account token)
 *
 * Flow:
 *   content -> Layer 1 -> flagged? block immediately
 *           -> Layer 1 passes -> Layer 2 -> flagged? block + log
 *           -> both pass -> allow message
 */
class ModerationService {
  constructor() {
    this._hfEnabled = false;
    this._hfToken = null;
    this._hfModel = 'unitary/toxic-bert';
    this._hfApiUrl = `https://router.huggingface.co/hf-inference/models/${this._hfModel}`;

    // Flag threshold — any label scoring above this is considered harmful
    this._threshold = 0.5;

    // Tracks violations per socketId
    this._flaggedCounts = new Map();
    this.MAX_FLAGS_BEFORE_WARN = 2;
    this.MAX_FLAGS_BEFORE_KICK = 5;

    // Extra blocklist leo-profanity doesn't cover
    this._extraBlocklist = [
      'csam', 'jailbait', 'childporn',
      'kill yourself', 'kys',
      'doxxing', 'dox me', 'dox you'
    ];

    this._init();
  }

  // ─── INIT ────────────────────────────────────────────────────

  _init() {
    const token = process.env.HF_API_TOKEN;

    if (!token) {
      logger.warn('ModerationService: HF_API_TOKEN not set — Layer 2 disabled, Layer 1 (local) still active');
      return;
    }

    this._hfToken = token;
    this._hfEnabled = true;
    logger.info('ModerationService initialized', {
      layer1: 'leo-profanity (local)',
      layer2: `Hugging Face — ${this._hfModel}`
    });
  }

  // ─── MAIN CHECK ──────────────────────────────────────────────

  /**
   * Call this before saving or delivering any message.
   *
   * Returns:
   * {
   *   allowed:    boolean,
   *   flagged:    boolean,
   *   reason:     string | null,
   *   categories: string[],
   *   layer:      'local' | 'huggingface' | null,
   *   action:     'allow' | 'block' | 'warn' | 'kick'
   * }
   */
  async checkMessage(content, socketId) {
    if (!content?.trim()) {
      return this._result(true, null, [], null, 'allow');
    }

    // ── Layer 1: Local filter ──────────────────────────────────
    const localResult = this._localCheck(content);
    if (localResult.flagged) {
      logger.warn('Message blocked by local filter', { socketId, reason: localResult.reason });
      const action = this._trackViolation(socketId);
      return this._result(false, localResult.reason, localResult.categories, 'local', action);
    }

    // ── Layer 2: Hugging Face API ──────────────────────────────
    if (!this._hfEnabled) {
      return this._result(true, null, [], null, 'allow');
    }

    try {
      const hfResult = await this._hfCheck(content);

      if (hfResult.flagged) {
        logger.warn('Message blocked by Hugging Face moderation', {
          socketId,
          label: hfResult.label,
          score: hfResult.score
        });
        const action = this._trackViolation(socketId);
        return this._result(
          false,
          'Content violates community guidelines',
          [hfResult.label],
          'huggingface',
          action
        );
      }

      return this._result(true, null, [], 'huggingface', 'allow');

    } catch (err) {
      logger.error('Hugging Face moderation API error', { error: err.message });

      // Fail open — don't punish users for API issues
      return this._result(true, null, [], null, 'allow');
    }
  }

  async checkContent(content) {
    return this.checkMessage(content, 'api');
  }

  // ─── TRACKING ────────────────────────────────────────────────

  getFlagCount(socketId) {
    return this._flaggedCounts.get(socketId) || 0;
  }

  resetFlagCount(socketId) {
    this._flaggedCounts.delete(socketId);
  }

  isEnabled() {
    return true; // Layer 1 always active
  }

  isHFEnabled() {
    return this._hfEnabled;
  }

  // ─── PRIVATE ─────────────────────────────────────────────────

  _localCheck(content) {
    const lower = content.toLowerCase().trim();

    // Check extra blocklist first
    for (const term of this._extraBlocklist) {
      if (lower.includes(term)) {
        return {
          flagged: true,
          reason: 'Content contains prohibited terms',
          categories: ['prohibited-terms']
        };
      }
    }

    // leo-profanity filter
    if (leoProfanity.check(content)) {
      return {
        flagged: true,
        reason: 'Content contains inappropriate language',
        categories: ['profanity']
      };
    }

    return { flagged: false };
  }

  /**
   * Call Hugging Face unitary/toxic-bert
   *
   * Model returns array of classifications like:
   * [
   *   { label: 'toxic',         score: 0.95 },
   *   { label: 'severe_toxic',  score: 0.02 },
   *   { label: 'obscene',       score: 0.60 },
   *   { label: 'threat',        score: 0.01 },
   *   { label: 'insult',        score: 0.80 },
   *   { label: 'identity_hate', score: 0.01 },
   * ]
   * Flagged if ANY label scores above threshold (default 0.5).
   */
  async _hfCheck(content) {
    const response = await axios.post(
      this._hfApiUrl,
      { inputs: content },
      {
        headers: {
          Authorization: `Bearer ${this._hfToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    // Response is array of arrays — take first result
    const results = Array.isArray(response.data?.[0])
      ? response.data[0]
      : response.data || [];

    if (!results.length) {
      return { flagged: false, label: 'clean', score: 0 };
    }

    // Find the highest scoring label
    const top = results.reduce((best, cur) =>
      cur.score > best.score ? cur : best
    , results[0]);

    // Flag if any label exceeds threshold
    const flagged = top.score >= this._threshold;

    return { flagged, label: top.label, score: top.score };
  }

  _trackViolation(socketId) {
    const count = (this._flaggedCounts.get(socketId) || 0) + 1;
    this._flaggedCounts.set(socketId, count);
    if (count >= this.MAX_FLAGS_BEFORE_KICK) return 'kick';
    if (count >= this.MAX_FLAGS_BEFORE_WARN) return 'warn';
    return 'block';
  }

  _result(allowed, reason, categories, layer, action) {
    return { allowed, flagged: !allowed, reason, categories, layer, action };
  }
}

const moderationService = new ModerationService();
module.exports = moderationService;