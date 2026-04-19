/**
 * RiskEngine
 *
 * Deterministic risk scoring per specification.
 * Returns score (0-100), level, and breakdown.
 */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

class RiskEngine {
  constructor() {
    // configuration of buckets (kept as fields for clarity / testability)
    this.financialMax = 40;
    this.fraudMax = 30;
    this.operationalMax = 15;
    this.legalMax = 15;
  }

  calculate(intent, entities = {}, userContext = {}) {
    // ensure deterministic inputs
    const e = Object.assign({}, entities);
    const uc = Object.assign({}, userContext);

    // If entities are missing or incomplete, attempt lightweight extraction from raw text
    const raw = (uc.userInput || uc.rawInput || '').toString();
    this._ensureEntityFromText(e, raw);

    // Financial
    let financial = 0;
    const amount = (typeof e.amount === 'number' && Number.isFinite(e.amount)) ? e.amount : null;
    if (amount != null) {
      if (amount <= 10000) financial += 5;
      else if (amount <= 50000) financial += 15;
      else financial += 30;
    }
    if ((e.urgency || '').toLowerCase() === 'high') financial += 10;
    else if ((e.urgency || '').toLowerCase() === 'medium') financial += 5;
    financial = clamp(financial, 0, this.financialMax);

    // Fraud
    let fraud = 0;
    const recipient = (e.recipient || '').toLowerCase().trim();
    if (!recipient) {
      fraud += 20; // unknown/missing
    } else {
      // close family detection by keyword
      const familyKeywords = ['mother','father','mom','dad','brother','sister','wife','husband','son','daughter','aunt','uncle','grandmother','grandfather','grandma','grandpa'];
      const isFamily = familyKeywords.some(k => recipient.includes(k));
      if (isFamily) fraud += 5;
      else {
        // vague detection
        const vagueKeywords = ['someone','somebody','someone else','friend','vendor','person'];
        const isVague = vagueKeywords.some(k => recipient.includes(k));
        if (isVague) fraud += 15;
      }
    }

    // missing critical entities: for financial intents require amount+recipient
    const financialIntent = intent === 'send_money';
    if (financialIntent) {
      if (!amount || !recipient) {
        fraud += 10;
      }
    }

    // diaspora factor: always +5 (remote trust gap)
    fraud += 5;

    fraud = clamp(fraud, 0, this.fraudMax);

    // Operational
    let operational = 0;
    const service = (e.service_type || '').toLowerCase();
    const simpleServices = ['delivery','cleaning','food','taxi','ride','transport'];
    const specialized = ['legal','medical','construction','engineering','financial_advisory'];
    if (simpleServices.some(s => service.includes(s))) operational += 5;
    else if (specialized.some(s => service.includes(s))) operational += 10;
    // urgent timeline
    if ((e.urgency || '').toLowerCase() === 'high') operational += 5;
    operational = clamp(operational, 0, this.operationalMax);

    // Legal
    let legal = 0;
    const doc = (e.document_type || '').toLowerCase();
    if (doc.includes('land') || doc.includes('title')) legal += 15;
    else if (doc.includes('id') || doc.includes('certificate') || doc.includes('passport')) legal += 10;
    legal = clamp(legal, 0, this.legalMax);

    // User adjustments (VERY IMPORTANT)
    // Deterministic simulation: prefer explicit flags; otherwise use signup_days_ago if present;
    // if no info, treat as new user (+5) to be conservative.
    let adjustment = 0;
    if (uc.trusted_user === true) adjustment -= 10;
    else if (uc.is_new === true) adjustment += 5;
    else if (typeof uc.signup_days_ago === 'number') {
      if (uc.signup_days_ago >= 365) adjustment -= 10; // long-tenured -> trusted
      else if (uc.signup_days_ago <= 7) adjustment += 5; // very new
    } else {
      // no history: conservative default = new user
      adjustment += 5;
    }

    // Aggregate
    let total = financial + fraud + operational + legal + adjustment;
    if (total < 0) total = 0;
    total = clamp(total, 0, 100);

    const level = total < 30 ? 'Low' : (total < 70 ? 'Medium' : 'High');

    const breakdown = {
      financial,
      fraud,
      operational,
      legal
    };

    return {
      risk_score: Math.round(total),
      risk_level: level,
      breakdown
    };
  }

  // Lightweight heuristics to populate missing entities from raw user text
  _ensureEntityFromText(entities, text) {
    if (!text || typeof text !== 'string') return;
    const t = text.toLowerCase();

    // amount: look for numbers with optional currency (kes, ksh, sh, usd) and multipliers (k)
    if (entities.amount == null) {
      const amountMatch = text.match(/(?:kes|ksh|sh\s?)\s?([0-9\,]+(?:\.[0-9]+)?)/i) ||
        text.match(/([0-9\,]+)\s*(?:kes|ksh|sh|usd|dollars)?/i) ||
        text.match(/(\d+(?:\.\d+)?)(k)\b/i);
      if (amountMatch) {
        let raw = amountMatch[1] || amountMatch[0];
        raw = String(raw).replace(/[,\s]/g, '');
        if (/k$/i.test(raw) || (amountMatch[2] && /k/i.test(amountMatch[2]))) {
          // handle 15k -> 15000
          const num = parseFloat(raw.replace(/k$/i, ''));
          if (!Number.isNaN(num)) entities.amount = Math.round(num * 1000);
        } else {
          const num = Number(raw);
          if (!Number.isNaN(num)) entities.amount = num;
        }
      }
    }

    // urgency
    if (!entities.urgency) {
      if (/\burgent\b|\bimmediately\b|\basap\b|\bsame day\b|\btoday\b|\bnow\b/i.test(t)) entities.urgency = 'high';
      else if (/tomorrow|soon|within 24|within 48/i.test(t)) entities.urgency = 'medium';
    }

    // recipient
    if (!entities.recipient) {
      // look for 'to <recipient>' patterns
      const toMatch = text.match(/to\s+(my\s+)?([A-Za-z\s'\.\-]{2,40})(?:\s+in|\s+on|\.|,|$)/i);
      if (toMatch && toMatch[2]) entities.recipient = toMatch[2].trim();
    }

    // service_type
    if (!entities.service_type) {
      if (/clean(ing)?|errand|delivery|food|taxi|ride|transport/i.test(t)) entities.service_type = 'cleaning/errand';
      else if (/lawyer|attorney|legal|agent|broker|consultant|medical|doctor|engineer/i.test(t)) entities.service_type = 'specialized';
    }

    // document_type
    if (!entities.document_type) {
      if (/land title|land_title|deed|title/i.test(t)) entities.document_type = 'land_title';
      else if (/id card|id\b|passport|certificate|cert\b/i.test(t)) entities.document_type = 'id';
    }
  }
}

module.exports = RiskEngine;
