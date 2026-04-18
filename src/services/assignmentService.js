/**
 * AssignmentService
 *
 * Deterministic, rule-based assignment of tasks to teams/units based on
 * intent and entities. No AI. Pure function semantics: same input -> same output.
 *
 * Rules implemented per specification.
 */

function safeString(v) {
  if (!v && v !== 0) return '';
  return String(v).toLowerCase().trim();
}

class AssignmentService {
  constructor() {
    // Base mapping from intent -> default team
    this.baseMap = {
      send_money: { team: 'Finance', unit: 'Standard' },
      hire_service: { team: 'Operations', unit: 'General' },
      verify_document: { team: 'Legal', unit: 'Standard Verification' },
      check_status: { team: 'Support', unit: 'Customer Support' }
    };

    // Helpers lists (kept in config for clarity)
    this.simpleServices = ['cleaning', 'errand'];
    this.specializedServices = ['lawyer', 'legal_help', 'legal', 'attorney'];
    this.transportServices = ['transport', 'airport_transfer', 'airport', 'taxi', 'ride'];
  }

  /**
   * assign(intent, entities)
   * Returns { team, unit }
   */
  assign(intent, entities = {}) {
    const intentKey = safeString(intent);
    const e = Object.assign({}, entities || {});

    // Start with base mapping
    const base = this.baseMap[intentKey] || { team: 'Support', unit: 'General' };
    let team = base.team;
    let unit = base.unit;

    // Apply entity-based overrides
    try {
      if (intentKey === 'send_money') {
        const amount = (typeof e.amount === 'number' && Number.isFinite(e.amount)) ? e.amount : null;
        const urgency = safeString(e.urgency);
        if ((amount != null && amount > 50000) || urgency === 'high') {
          team = 'Finance'; unit = 'Priority Desk';
        } else {
          team = 'Finance'; unit = 'Standard';
        }
      } else if (intentKey === 'hire_service') {
        const service = safeString(e.service_type || '');
        if (this.simpleServices.some(s => service.includes(s))) {
          team = 'Operations'; unit = 'Field Team';
        } else if (this.specializedServices.some(s => service.includes(s))) {
          team = 'Legal'; unit = 'Advisory';
        } else if (this.transportServices.some(s => service.includes(s))) {
          team = 'Logistics'; unit = 'Transport Desk';
        } else {
          team = 'Operations'; unit = 'General';
        }
      } else if (intentKey === 'verify_document') {
        const doc = safeString(e.document_type || '');
        if (doc === 'land_title' || doc.includes('land') || doc.includes('title')) {
          team = 'Legal'; unit = 'Senior Verification';
        } else if (['id', 'certificate', 'passport'].some(d => doc.includes(d))) {
          team = 'Legal'; unit = 'Standard Verification';
        } else {
          team = 'Legal'; unit = 'Standard Verification';
        }
      } else if (intentKey === 'check_status') {
        team = 'Support'; unit = 'Customer Support';
      }
    } catch (err) {
      // safest fallback
      team = 'Support'; unit = 'General';
    }

    // final safety: never return empty
    if (!team) team = 'Support';
    if (!unit) unit = 'General';

    return { team, unit };
  }
}

module.exports = AssignmentService;
