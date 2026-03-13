import React, { useState, useEffect, useRef } from "react";

const APP_VERSION = "1.6.0";

// ─── Lightweight analytics (stored locally, exportable) ───
const _evtLog = [];
function trackEvent(name, data = {}) {
  try {
    const evt = { t: Date.now(), e: name, ...data };
    _evtLog.push(evt);
    if (_evtLog.length > 200) _evtLog.shift();
    window.storage?.set("unstuk_analytics", JSON.stringify(_evtLog.slice(-50))).catch(() => {});
  } catch(e) {}
}

// ─── Error boundary (catches render crashes gracefully) ───
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    trackEvent("crash", { msg: (error?.message || "").substring(0, 100) });
  }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", {
        style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", padding: 40, textAlign: "center" }
      },
        React.createElement("p", { style: { fontSize: 14, color: "#78716C", marginBottom: 16 } }, "Something went wrong. Your data is safe."),
        React.createElement("button", {
          onClick: () => this.setState({ hasError: false }),
          style: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "1px solid #D6D3D1", background: "#fff", cursor: "pointer" }
        }, "Reload")
      );
    }
    return this.props.children;
  }
}

// ─── Preset suggestion chips — themed, multi-category ───
// ─── Instant fallback chips (shown immediately while AI loads) ───
const FALLBACK_CHIPS = {
  name: {
    "Strategy": ["Market Expansion Plan", "Pricing Model Overhaul", "AI Integration Roadmap", "Competitive Response Strategy", "Partnership vs Build"],
    "People": ["Head of Growth Hire", "Team Restructure", "Agency vs In-House", "Engineering Lead Selection", "Remote Policy Update"],
    "Operations": ["Tech Stack Migration", "Vendor Evaluation", "Budget Reallocation", "Process Automation", "Data Platform Choice"],
    "Growth": ["New Market Entry", "Product Line Extension", "Channel Strategy Shift", "Customer Segment Focus", "Sustainability Initiative"],
  },
  "qv-name": {
    "Team Decisions": ["Which launch date works best?", "Where should we hold the offsite?", "What should be our Q3 focus?", "Which candidate do you prefer?"],
    "Quick Feedback": ["How should we handle this?", "Which design direction?", "What's blocking progress?", "Which format works best?"],
    "Strategic Polls": ["Should we enter this market?", "Which feature ships first?", "How should we split the budget?", "Build vs buy for this?"],
  },
};

// Topic-specific contextual chips keyed by detected stems in decision name
// Each key can match multiple stems via the _TOPIC_STEMS lookup below
const TOPIC_CHIPS = {
  hire: {
    opt: { "Candidates": ["Internal Promotion", "External Senior Hire", "Contract-to-Hire", "Agency Recruiter", "Referral Candidate"], "Structure": ["Full-Time Role", "Part-Time Role", "Contractor", "Fractional / Advisory", "Interim Appointment"] },
    crit: { "Evaluation": ["Culture Fit", "Technical Skill Match", "Leadership Potential", "Salary Expectations", "Notice Period"], "Strategic": ["Team Gap Coverage", "Growth Trajectory", "Retention Risk", "Onboarding Cost", "Diversity Impact"] },
  },
  pricing: {
    opt: { "Models": ["Freemium", "Tiered Pricing", "Usage-Based", "Flat Rate", "Per-Seat Licensing"], "Strategy": ["Premium Positioning", "Market Penetration", "Competitive Match", "Value-Based Pricing", "Dynamic Pricing"] },
    crit: { "Financial": ["Revenue Impact", "Margin Protection", "Customer Lifetime Value", "Churn Risk", "Cash Flow Effect"], "Market": ["Competitive Positioning", "Market Perception", "Adoption Barrier", "Upsell Potential", "Price Sensitivity"] },
  },
  vendor: {
    opt: { "Vendors": ["Current Incumbent", "Market Leader", "Specialist Provider", "Emerging Challenger", "In-House Build"], "Approach": ["Single Vendor", "Multi-Vendor", "Managed Service", "Open-Source + Support"] },
    crit: { "Capability": ["Feature Completeness", "Integration Ease", "Support Quality", "Uptime SLA", "Security Certification"], "Commercial": ["Total Cost of Ownership", "Contract Flexibility", "Scalability", "Vendor Lock-In Risk", "Reference Quality"] },
  },
  migration: {
    opt: { "Approach": ["Big-Bang Migration", "Phased Rollout", "Parallel Run", "Incremental Migration", "Hybrid Transition"], "Timing": ["Immediate Start", "Next Quarter", "Aligned with Renewal", "Deferred to Next Year"] },
    crit: { "Technical": ["Data Integrity Risk", "Downtime Impact", "Integration Complexity", "Rollback Capability", "Performance Impact"], "Business": ["User Disruption", "Training Requirement", "Cost Overrun Risk", "Compliance Continuity", "Business Continuity"] },
  },
  marketing: {
    opt: { "Channels": ["Paid Social", "Content Marketing", "Email Campaign", "Influencer Partnership", "Events / Webinars"], "Creative": ["Brand Refresh", "New Campaign", "Repositioning", "Co-Marketing", "Guerrilla / Viral"] },
    crit: { "Performance": ["Projected ROI", "Cost Per Lead", "Brand Awareness Lift", "Conversion Rate", "Audience Reach"], "Execution": ["Time to Launch", "Creative Resource Need", "Channel Expertise", "Measurement Clarity", "Scalability"] },
  },
  budget: {
    opt: { "Allocation": ["Increase Investment", "Maintain Current Level", "Reallocate from Other Areas", "Reduce Spend", "Zero-Base Review"], "Funding": ["Revenue Funded", "CapEx Funded", "External Financing", "Phased Funding"] },
    crit: { "Financial": ["Expected ROI", "Payback Period", "Cash Flow Impact", "Opportunity Cost", "Risk-Adjusted Return"], "Strategic": ["Strategic Alignment", "Urgency", "Competitive Pressure", "Revenue Dependency", "Stakeholder Priority"] },
  },
  office: {
    opt: { "Location": ["City Centre", "Suburban Hub", "Remote-First", "Co-Working Space", "Satellite Office"], "Format": ["Open Plan", "Activity-Based", "Hybrid Hot-Desk", "Private Offices", "Fully Remote"] },
    crit: { "Practical": ["Commute Impact", "Lease Cost", "Space Flexibility", "Talent Access", "Client Proximity"], "Culture": ["Collaboration Quality", "Employee Satisfaction", "Brand Image", "Sustainability", "Wellbeing Impact"] },
  },
  product: {
    opt: { "Direction": ["New Feature Build", "Existing Feature Improvement", "Platform Pivot", "Integration Focus", "Technical Debt Paydown"], "Scope": ["MVP Launch", "Full Feature Set", "Phased Delivery", "Beta / Early Access"] },
    crit: { "Product": ["User Demand Signal", "Technical Feasibility", "Time to Market", "Revenue Potential", "Differentiation Value"], "Risk": ["Engineering Complexity", "Dependency Risk", "Market Timing", "Cannibalisation Risk", "Support Burden"] },
  },
  launch: {
    opt: { "Timing": ["Immediate Launch", "Soft Launch First", "Q1 Target", "Event-Aligned Launch", "Competitor-Reactive"], "Scale": ["Global Rollout", "Single Market First", "Key Accounts Only", "Invite-Only Beta", "Regional Pilot"] },
    crit: { "Readiness": ["Product Readiness", "Go-to-Market Plan", "Support Capacity", "Partner Alignment", "Regulatory Clearance"], "Impact": ["Market Timing", "Revenue Opportunity", "Competitive Window", "Brand Perception", "Customer Expectation"] },
  },
  partner: {
    opt: { "Structure": ["Strategic Alliance", "Joint Venture", "Licensing Deal", "Distribution Agreement", "Equity Partnership"], "Partners": ["Industry Leader", "Complementary Startup", "Channel Partner", "Academic Institution", "Government Body"] },
    crit: { "Fit": ["Strategic Alignment", "Cultural Compatibility", "Resource Complementarity", "Market Access", "Brand Association"], "Terms": ["Revenue Share Fairness", "IP Ownership", "Exit Flexibility", "Governance Clarity", "Exclusivity Terms"] },
  },
  restructur: {
    opt: { "Models": ["Functional Restructure", "Matrix Organisation", "Flat Structure", "Business Unit Split", "Shared Services Model"], "Approach": ["Immediate Reorganisation", "Phased Transition", "Pilot Division First", "Consult Then Decide"] },
    crit: { "People": ["Employee Impact", "Key Talent Retention", "Morale Risk", "Communication Clarity", "Change Fatigue"], "Operations": ["Efficiency Gain", "Cost Reduction", "Decision Speed", "Customer Impact", "Implementation Complexity"] },
  },
  tech: {
    opt: { "Solutions": ["Build Custom", "SaaS Platform", "Open-Source Tool", "Enterprise Suite", "Low-Code Solution"], "Approach": ["Replace Entirely", "Augment Existing", "Integrate Best-of-Breed", "Consolidate Tools"] },
    crit: { "Technical": ["Scalability", "Security", "Integration Ease", "Maintenance Burden", "Performance"], "Business": ["Total Cost of Ownership", "Team Adoption", "Vendor Lock-In", "Future Flexibility", "Time to Value"] },
  },
  compliance: {
    opt: { "Approach": ["Full Compliance Programme", "Phased Implementation", "Third-Party Audit", "Self-Assessment First", "Industry Consortium"], "Scope": ["Global Standard", "Regional Compliance", "Minimum Viable Compliance", "Best-in-Class Target"] },
    crit: { "Risk": ["Regulatory Penalty Risk", "Reputational Exposure", "Audit Readiness", "Data Protection Gap", "Incident Response"], "Operational": ["Implementation Cost", "Process Change Scope", "Training Requirement", "Ongoing Monitoring", "Third-Party Dependency"] },
  },
  brand: {
    opt: { "Direction": ["Full Rebrand", "Brand Refresh", "Sub-Brand Creation", "Brand Extension", "Co-Branding"], "Approach": ["Agency-Led", "In-House Creative", "Crowdsourced", "Customer Co-Creation", "Data-Driven Design"] },
    crit: { "Impact": ["Brand Recognition", "Customer Perception", "Internal Alignment", "Market Differentiation", "Emotional Connection"], "Practical": ["Implementation Cost", "Rollout Timeline", "Legal Clearance", "Digital Asset Migration", "Stakeholder Buy-In"] },
  },
  sales: {
    opt: { "Strategy": ["Direct Sales Team", "Channel Partners", "Inside Sales", "Self-Serve Model", "Account-Based Selling"], "Focus": ["New Customer Acquisition", "Upsell Existing", "Market Expansion", "Enterprise Focus", "SMB Volume"] },
    crit: { "Performance": ["Revenue Per Rep", "Sales Cycle Length", "Win Rate Impact", "Customer Acquisition Cost", "Pipeline Quality"], "Execution": ["Team Readiness", "Tool Requirements", "Training Investment", "Territory Coverage", "Quota Achievability"] },
  },
  expansion: {
    opt: { "Markets": ["Adjacent Market", "International Expansion", "New Segment", "Vertical Specialisation", "Geographic Cluster"], "Mode": ["Organic Growth", "Acquisition", "Franchise Model", "Joint Venture", "Licensing"] },
    crit: { "Market": ["Market Size", "Competitive Intensity", "Regulatory Barriers", "Cultural Fit", "Customer Demand Signal"], "Operational": ["Execution Capability", "Capital Requirement", "Time to Revenue", "Risk Level", "Cannibalisation Risk"] },
  },
  remote: {
    opt: { "Models": ["Fully Remote", "Hybrid 3/2", "Hybrid 2/3", "Office-First + Flex", "Remote-First + Hubs"], "Tools": ["Existing Stack", "New Collaboration Suite", "Async-First Tools", "Virtual Office Platform"] },
    crit: { "People": ["Productivity Impact", "Collaboration Quality", "Employee Preference", "Talent Pool Access", "Wellbeing"], "Operations": ["Cost Savings", "Security Compliance", "Management Overhead", "Culture Maintenance", "Onboarding Effectiveness"] },
  },
  crm: {
    opt: { "Platforms": ["Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Custom Build"], "Approach": ["Full Replacement", "Phased Migration", "Integration Layer", "Best-of-Breed Stack"] },
    crit: { "Fit": ["Feature Completeness", "Ease of Use", "Customisability", "Integration Ecosystem", "Mobile Experience"], "Value": ["Total Cost", "Implementation Time", "Training Need", "Data Migration Risk", "Scalability"] },
  },
  invest: {
    opt: { "Options": ["Proceed with Investment", "Reduce Investment Size", "Seek Co-Investors", "Defer to Next Round", "Pass Entirely"], "Structure": ["Equity Stake", "Convertible Note", "Revenue Share", "Debt Financing", "SAFE Agreement"] },
    crit: { "Returns": ["Expected ROI", "Time to Return", "Risk-Adjusted Value", "Market Opportunity", "Exit Potential"], "Risk": ["Capital at Risk", "Market Volatility", "Execution Risk", "Regulatory Risk", "Concentration Risk"] },
  },
  outsourc: {
    opt: { "Models": ["Full Outsource", "Selective Outsource", "Nearshore Team", "Offshore Team", "Keep In-House"], "Partners": ["Large Agency", "Boutique Specialist", "Freelancer Network", "Managed Service", "Hybrid Model"] },
    crit: { "Quality": ["Output Quality", "Communication Ease", "Domain Expertise", "Response Time", "Cultural Alignment"], "Commercial": ["Cost Savings", "Contract Flexibility", "IP Protection", "Scalability", "Transition Risk"] },
  },
  acquisit: {
    opt: { "Targets": ["Target Company A", "Target Company B", "Acqui-Hire Focus", "Technology Acquisition", "Market Access Buy"], "Approach": ["Full Acquisition", "Majority Stake", "Strategic Investment", "Asset Purchase", "Merger of Equals"] },
    crit: { "Value": ["Revenue Synergies", "Cost Synergies", "Technology Value", "Talent Value", "Customer Base"], "Risk": ["Integration Complexity", "Culture Clash Risk", "Valuation Fairness", "Due Diligence Gaps", "Regulatory Approval"] },
  },
  fundrais: {
    opt: { "Routes": ["VC Round", "Angel Investors", "Revenue-Based Financing", "Bank Loan", "Bootstrapping"], "Stage": ["Pre-Seed", "Seed Round", "Series A", "Bridge Round", "Growth Round"] },
    crit: { "Terms": ["Valuation", "Dilution Impact", "Investor Value-Add", "Board Control", "Liquidation Preference"], "Timing": ["Runway Extension", "Time to Close", "Market Conditions", "Traction Required", "Follow-On Potential"] },
  },
  retent: {
    opt: { "Strategies": ["Salary Increase", "Equity / Options Grant", "Role Expansion", "Flexible Working", "Retention Bonus"], "Alternatives": ["Promotion Path", "Lateral Move", "Mentorship Programme", "Sabbatical Offer", "Counter-Offer"] },
    crit: { "Employee": ["Flight Risk Level", "Performance Rating", "Institutional Knowledge", "Replacement Difficulty", "Team Impact"], "Financial": ["Cost of Retention", "Cost of Replacement", "Market Rate Gap", "Budget Availability", "Precedent Set"] },
  },
  rebrand: {
    opt: { "Scope": ["Full Rebrand", "Visual Refresh", "Name Change Only", "Messaging Update", "Sub-Brand Creation"], "Approach": ["Agency-Led", "In-House Team", "Phased Rebrand", "Big Reveal Launch", "Gradual Transition"] },
    crit: { "Impact": ["Brand Recognition Risk", "Customer Confusion", "Market Differentiation", "Employee Buy-In", "Competitive Positioning"], "Execution": ["Budget Required", "Timeline", "Legal / Trademark", "Digital Migration", "Print / Physical Update"] },
  },
  automat: {
    opt: { "Solutions": ["Full Automation", "Partial Automation", "AI-Assisted Workflow", "RPA Implementation", "No-Code Platform"], "Approach": ["Build Custom", "Off-the-Shelf Tool", "Integrate APIs", "Hire Specialist", "Phase Gradually"] },
    crit: { "Value": ["Time Saved", "Error Reduction", "Cost Savings", "Employee Satisfaction", "Scalability"], "Risk": ["Implementation Effort", "Change Management", "System Reliability", "Maintenance Burden", "Job Impact"] },
  },
  supplier: {
    opt: { "Vendors": ["Current Incumbent", "Market Leader", "Specialist Provider", "Emerging Challenger", "In-House Build"], "Approach": ["Single Vendor", "Multi-Vendor", "Managed Service", "Open-Source + Support"] },
    crit: { "Capability": ["Feature Completeness", "Integration Ease", "Support Quality", "Uptime SLA", "Security Certification"], "Commercial": ["Total Cost of Ownership", "Contract Flexibility", "Scalability", "Vendor Lock-In Risk", "Reference Quality"] },
  },
  pivot: {
    opt: { "Direction": ["Market Pivot", "Product Pivot", "Business Model Pivot", "Channel Pivot", "Technology Pivot"], "Scale": ["Full Pivot", "Partial Pivot", "Test & Learn", "Gradual Shift", "Parallel Track"] },
    crit: { "Strategic": ["Market Opportunity Size", "Competitive Advantage", "Team Capability", "Customer Demand Signal", "Revenue Potential"], "Execution": ["Speed to Market", "Capital Required", "Existing Asset Leverage", "Partner Impact", "Risk of Failure"] },
  },
  event: {
    opt: { "Format": ["In-Person Conference", "Virtual Webinar", "Hybrid Event", "Workshop / Masterclass", "Networking Mixer"], "Scale": ["Intimate (< 30)", "Medium (30–100)", "Large (100–500)", "Flagship (500+)"] },
    crit: { "Impact": ["Attendee Value", "Lead Generation", "Brand Visibility", "Speaker Quality", "Content Relevance"], "Logistics": ["Venue Cost", "Planning Timeline", "Team Capacity", "Sponsor Interest", "Travel Burden"] },
  },
  contract: {
    opt: { "Action": ["Renew As-Is", "Renegotiate Terms", "Switch Provider", "Bring In-House", "Let Expire"], "Timing": ["Renew Now", "Negotiate Before Deadline", "Extend Short-Term", "Defer Decision"] },
    crit: { "Value": ["Cost vs Benefit", "Service Quality", "Flexibility of Terms", "Switching Cost", "Market Alternatives"], "Risk": ["Business Continuity", "Data Migration", "Relationship Impact", "Legal Obligations", "Timing Pressure"] },
  },
  culture: {
    opt: { "Initiatives": ["Values Refresh", "Team Rituals", "Communication Overhaul", "Recognition Programme", "Diversity Initiative"], "Approach": ["Top-Down Mandate", "Grassroots Movement", "External Facilitator", "Pulse Surveys First", "Leadership Coaching"] },
    crit: { "Impact": ["Employee Engagement", "Retention Effect", "Productivity Impact", "Brand Alignment", "Inclusion Improvement"], "Feasibility": ["Leadership Buy-In", "Budget Required", "Time Investment", "Measurement Difficulty", "Sustainability"] },
  },
  security: {
    opt: { "Approach": ["Full Security Audit", "Penetration Testing", "Compliance Framework", "Tool Upgrade", "Managed Security Service"], "Scope": ["Infrastructure Focus", "Application Security", "Data Protection", "Identity & Access", "Full Stack"] },
    crit: { "Risk": ["Breach Probability", "Data Sensitivity", "Regulatory Exposure", "Reputational Impact", "Financial Loss Potential"], "Operational": ["Implementation Cost", "Team Expertise", "Business Disruption", "Maintenance Load", "Vendor Dependency"] },
  },
  customer: {
    opt: { "Strategy": ["Premium Support", "Self-Service Portal", "Dedicated Account Manager", "Community-Led", "AI Chatbot First"], "Focus": ["Onboarding Improvement", "Churn Reduction", "Upsell / Expand", "NPS Improvement", "Response Time"] },
    crit: { "Impact": ["Customer Satisfaction", "Retention Rate", "Revenue Per Customer", "Support Cost", "Brand Loyalty"], "Execution": ["Team Capacity", "Tool Requirements", "Training Need", "Implementation Time", "Measurement Clarity"] },
  },
  ai: {
    opt: { "Approach": ["Build Custom AI", "Off-the-Shelf AI Tool", "API Integration", "AI Copilot Layer", "Hire AI Team"], "Strategy": ["Full AI Transformation", "Targeted AI Use Cases", "AI Pilot Programme", "AI-Augmented Workflow", "Wait & Watch"] },
    crit: { "Value": ["Accuracy / Quality", "Time Savings", "Cost per Query", "Hallucination Risk", "Data Privacy"], "Feasibility": ["Integration Complexity", "Training Data Quality", "Team AI Literacy", "Vendor Lock-In", "Regulatory Compliance"] },
  },
  sustainability: {
    opt: { "Scope": ["Carbon Neutral Goal", "ESG Report First", "Supply Chain Audit", "Green Procurement", "Offset Programme"], "Approach": ["Internal Champion", "External Consultant", "Industry Framework", "Customer-Driven", "Regulatory Minimum"] },
    crit: { "Impact": ["Carbon Reduction", "Brand Perception", "Regulatory Compliance", "Cost Savings", "Talent Attraction"], "Execution": ["Measurement Difficulty", "Capital Required", "Timeline to Impact", "Stakeholder Alignment", "Greenwashing Risk"] },
  },
  legal: {
    opt: { "Action": ["Outside Counsel", "In-House Legal Hire", "Legal Tech Platform", "Insurance / Indemnity", "Negotiate Settlement"], "Strategy": ["Aggressive Defence", "Early Settlement", "Mediation", "Ignore & Monitor", "Counter-Claim"] },
    crit: { "Risk": ["Financial Exposure", "Precedent Risk", "Reputation Impact", "Time Drain", "Win Probability"], "Practical": ["Legal Fees", "Timeline", "Discovery Burden", "Insurance Coverage", "Business Disruption"] },
  },
  data: {
    opt: { "Platform": ["Modern Data Stack", "Cloud Warehouse", "Self-Service BI", "Custom Dashboard", "Embedded Analytics"], "Approach": ["Centralise First", "Domain-Driven", "Real-Time Pipeline", "Batch Processing", "Data Mesh"] },
    crit: { "Technical": ["Query Performance", "Data Freshness", "Integration Coverage", "Scalability", "Data Quality"], "Business": ["User Adoption", "Time to Insight", "Cost per Query", "Self-Service Capability", "Governance & Access Control"] },
  },
};
// Stem-to-topic mapping — multiple stems can point to the same topic for fuzzy matching
const _TOPIC_STEMS = {};
const _STEM_ALIASES = {
  hire: ["hire", "hiring", "recruit", "recruitment", "talent", "headcount", "staffing", "employ", "candidate", "onboard"],
  pricing: ["pricing", "price", "rate", "monetis", "monetiz", "subscription", "fee", "tariff", "charge", "billing", "revenue model"],
  vendor: ["vendor", "supplier", "provider", "procurement", "sourcing", "rfp", "shortlist"],
  migration: ["migrat", "switch", "transition", "move to", "moving to", "convert"],
  marketing: ["marketing", "advertis", "promot", "campaign", "outreach", "awareness", "demand gen"],
  budget: ["budget", "spend", "allocat", "fund", "financ", "cost", "expenditure", "capex", "opex"],
  office: ["office", "workspace", "workplace", "headquarter", "location", "premises", "lease", "real estate"],
  product: ["product", "feature", "roadmap", "backlog", "release", "mvp", "prototype", "development", "app", "application", "service"],
  launch: ["launch", "go-to-market", "gtm", "release date", "ship date", "rollout"],
  partner: ["partner", "alliance", "joint venture", "collaborat", "co-brand", "affiliate"],
  restructur: ["restructur", "reorganis", "reorganiz", "reorg", "layoff", "downsiz", "rightsiz"],
  tech: ["tech", "software", "system", "platform", "stack", "infrastructure", "saas", "tool select"],
  compliance: ["compliance", "regulat", "audit", "governance", "gdpr", "sox", "hipaa", "iso", "certif"],
  brand: ["brand", "identity", "logo", "visual identity", "design system", "creative direction"],
  sales: ["sales", "selling", "revenue", "pipeline", "quota", "territory", "account exec"],
  expansion: ["expansion", "expand", "grow", "growth", "scale", "enter market", "new market", "international"],
  remote: ["remote", "hybrid", "work from home", "wfh", "distributed", "flexible work"],
  crm: ["crm", "salesforce", "hubspot", "pipedrive", "dynamics", "customer relationship"],
  invest: ["invest", "funding", "capital", "equity", "stake", "portfolio", "return"],
  outsourc: ["outsourc", "offshoring", "nearshore", "subcontract", "agency hire", "freelanc"],
  acquisit: ["acqui", "takeover", "buyout", "merger", "m&a", "consolidat"],
  fundrais: ["fundrais", "raise capital", "series", "round", "vc", "angel", "seed fund"],
  retent: ["retent", "retain", "keep talent", "counter offer", "flight risk", "turnover"],
  rebrand: ["rebrand", "rename", "reposit"],
  automat: ["automat", "rpa", "workflow", "streamlin", "efficienc", "ai tool", "no-code"],
  pivot: ["pivot", "reposit", "change direction", "new direction", "strategic shift"],
  event: ["event", "conference", "summit", "webinar", "seminar", "workshop", "offsite", "retreat"],
  contract: ["contract", "renewal", "renegotiat", "agreement", "deal", "engagement"],
  culture: ["culture", "values", "engagement", "morale", "wellbeing", "well-being", "team spirit"],
  security: ["security", "cyber", "breach", "penetration", "vulnerability", "infosec", "data protect", "soc2", "soc 2", "pci"],
  customer: ["customer success", "customer experience", "cx", "support model", "churn", "nps", "csat", "onboard customer", "customer service", "help desk", "user experience", "ux"],
  supplier: ["supplier"],
  // Additional coverage for common decision domains
  ai: ["ai", "artificial intelligence", "machine learning", "ml", "llm", "gpt", "chatbot", "copilot", "generative"],
  sustainability: ["sustainab", "esg", "carbon", "green", "environmental", "climate", "net zero"],
  legal: ["legal", "lawsuit", "litigation", "attorney", "lawyer", "patent", "trademark", "ip ", "intellectual property"],
  data: ["data", "analytics", "dashboard", "reporting", "warehouse", "pipeline", "etl", "bi ", "business intelligence"],
};
for (const [topic, stems] of Object.entries(_STEM_ALIASES)) {
  for (const s of stems) _TOPIC_STEMS[s] = topic;
}

const GENERIC_CONTEXTUAL = {
  opt: { "Core Choices": ["Proceed Full Speed", "Modified Approach", "Alternative Path", "Defer & Research", "Quick Pilot First"], "Creative Angles": ["Outsource It", "Partner with Expert", "Hybrid Solution", "Do the Opposite", "Let the Team Decide"] },
  crit: { "Hard Factors": ["Total Cost", "Revenue Impact", "Time to Results", "Payback Period", "Resource Need"], "Soft Factors": ["Team Readiness", "Stakeholder Support", "Cultural Fit", "Learning Curve", "Morale Impact"], "Risk Lens": ["Worst-Case Downside", "Reversibility", "Opportunity Cost", "Competitive Risk", "Reputation Risk"] },
};

// ─── Dynamic chip synthesis — generates chips from decision text itself ───
const _STOP = new Set(["the","a","an","to","for","of","in","on","at","is","it","we","our","my","and","or","vs","with","how","what","which","should","would","could","can","do","does","are","be","been","will","about","this","that","than","from","into","your","their","best","most","new","next","first","make","get","i"]);

function extractSubject(text) {
  const words = text.replace(/[?.,!:;'"()]/g, "").split(/\s+/).filter(w => w.length > 1 && !_STOP.has(w.toLowerCase()));
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function synthesizeOptChips(dName, decisionType, existingOpts) {
  const name = (dName || "").toLowerCase();
  const subject = extractSubject(dName);
  const existingNames = (existingOpts || []).map(o => (o.name || o).toLowerCase()).filter(Boolean);
  // Strip action verbs from subject so we get the OBJECT not the action
  const actionWords = new Set(["hire","recruit","staff","choose","select","pick","migrate","switch","move","transition","replace","launch","release","ship","deploy","invest","fund","spend","allocate","build","develop","create","design","implement","close","shut","exit","expand","grow","scale","improve","optimise","optimize","enhance","upgrade","refine","negotiate","renegotiate","renew","review","evaluate","assess","plan","decide","consider","determine","figure","finding","need","want","looking"]);
  const obj = subject.filter(w => !actionWords.has(w.toLowerCase()));
  const objStr = obj.slice(0, 3).join(" ") || subject.slice(0, 2).join(" ");
  // Filter out already-picked options
  const filterExisting = (chips) => {
    const result = {};
    for (const [cat, arr] of Object.entries(chips)) {
      const filtered = arr.filter(c => !existingNames.includes(c.toLowerCase()));
      if (filtered.length > 0) result[cat] = filtered;
    }
    return Object.keys(result).length > 0 ? result : chips;
  };

  // Detect "X vs Y" or "X or Y" patterns
  const vsMatch = name.match(/(.+?)\s+(?:vs\.?|versus|or)\s+(.+)/i);
  if (vsMatch) {
    const sideA = vsMatch[1].trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const sideB = vsMatch[2].trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return filterExisting({ "Core Choices": [sideA, sideB, `Hybrid ${sideA} + ${sideB}`, "Neither — Third Option", "Defer Decision"], "Variations": [`${sideA} Now, ${sideB} Later`, `${sideB} Now, ${sideA} Later`, `Pilot Both`, `Let the Team Decide`] });
  }

  // Multi-word phrase detection for specific entities
  const entityPhrases = name.match(/\b(salesforce|hubspot|slack|notion|asana|jira|shopify|stripe|aws|azure|gcp|google cloud|wordpress|squarespace|figma|sketch|react|angular|vue|node|python|django|rails|kubernetes|docker|terraform|datadog|splunk|snowflake|databricks|tableau|power bi|monday\.com|clickup|trello|zendesk|intercom|mailchimp|sendgrid|twilio|airtable|zapier|segment|amplitude|mixpanel|looker|dbt|airflow|kafka|redis|postgres|mysql|mongodb|elasticsearch|github|gitlab|bitbucket|vercel|netlify|heroku|digital ocean|cloudflare|fastly)\b/gi);
  if (entityPhrases && entityPhrases.length >= 1) {
    const entities = [...new Set(entityPhrases.map(e => e.charAt(0).toUpperCase() + e.slice(1)))];
    if (entities.length >= 2) {
      return filterExisting({ "Platforms": entities.slice(0, 5), "Strategy": [`Start with ${entities[0]}`, `Start with ${entities[1]}`, `Use Both`, `Neither — Find Alternative`, `Build Custom`] });
    }
  }

  // Decision type-specific generation for binary
  if (decisionType === "binary" && obj.length > 0) {
    return filterExisting({
      [objStr]: [`Yes — ${objStr}`, `No — Don't ${objStr}`, `${objStr} with Conditions`, `${objStr} — Modified Version`],
      "Framing": [`Proceed with ${objStr}`, `Defer ${objStr}`, `${objStr} Pilot First`, `Alternative to ${objStr}`]
    });
  }

  // Action-based synthesis: detect action, use object (not action) in chips
  const actions = [
    { test: /\b(hire|recruit|staff|talent|headcount)\b/i, chips: () => ({ [`${objStr}`]: [`External Senior Hire`, `Internal Promotion`, `Contract / Freelance`, `Agency / Headhunter`, `Restructure the Role`, `Hire Two Junior Instead`], "Timing": ["Hire Immediately", "Hire Next Quarter", "Trial Period First", "Defer Until Budget"], "Source": [`LinkedIn Sourcing`, `Recruiter Partnership`, `Internal Referral`, `University Pipeline`] }) },
    { test: /\b(choose|select|pick|which)\b/i, chips: () => ({ [`${objStr} Choices`]: obj.length > 1 ? [`${obj[0]} Focus`, `${obj[1] || obj[0]} Focus`, `Combine Both`, `None — Keep Current`, `Research More`] : [`${objStr} — Version A`, `${objStr} — Version B`, `Modified ${objStr}`, `Keep Status Quo`, `Pilot Test First`] }) },
    { test: /\b(migrat|switch|move|transition|replac)\b/i, chips: () => ({ [`${objStr} Migration`]: [`Full ${objStr} Migration`, `Phased ${objStr} Rollout`, `Parallel Run`, `Partial Switch Only`, `Stay with Current`], "Timeline": ["Start This Month", "Start Next Quarter", "Plan & Prep Only", "Wait for Renewal"], "Risk Mitigation": [`${objStr} Pilot Group`, `Rollback Plan First`, `Migrate Non-Critical First`] }) },
    { test: /\b(launch|release|ship|go.?live|deploy)\b/i, chips: () => ({ [`${objStr} Launch`]: [`${objStr} — Launch Now`, `${objStr} — Soft Launch`, `Beta with Key Clients`, `Delay for Polish`, `Scrap & Rethink`], "Scale": ["Full Market", "Single Segment", "Internal Only First", "Partner Preview"], "De-risk": [`${objStr} Feature Flag`, `A/B Test First`, `Waitlist Launch`, `Invite-Only`] }) },
    { test: /\b(invest|fund|financ|spend|allocat|budget)\b/i, chips: () => ({ [`${objStr} Investment`]: [`Full Investment in ${objStr}`, `Reduce ${objStr} Investment`, "Reallocate Budget", "Seek External Funding", "Defer Spending"], "Level": ["Aggressive Spend", "Moderate Budget", "Minimum Viable", "Zero Budget"], "Structure": [`One-Time ${objStr} Spend`, `Recurring ${objStr} Budget`, `Milestone-Based Funding`] }) },
    { test: /\b(build|develop|create|design|implement)\b/i, chips: () => ({ [`${objStr} Build`]: [`${objStr} — In-House`, `${objStr} — Off-the-Shelf`, "Partner / White Label", "Open Source + Customise", "Outsource Development"], "Scope": ["Full Feature Set", "MVP Only", "Phased Build", "Prototype First"], "Approach": [`${objStr} — Agile Sprints`, `${objStr} — Waterfall`, `${objStr} — Design Sprint`] }) },
    { test: /\b(close|shut|exit|divest|discontinu|kill|sunset)\b/i, chips: () => ({ [`${objStr} Exit`]: [`Close ${objStr} Immediately`, `Wind Down ${objStr} Gradually`, "Sell / Divest", "Pivot to Adjacent", "Pause & Reassess"], "Timing": ["This Month", "End of Quarter", "End of Year", "No Fixed Date"] }) },
    { test: /\b(expand|grow|scale|enter|open)\b/i, chips: () => ({ [`${objStr} Growth`]: [`Aggressive ${objStr} Push`, `Steady ${objStr} Build`, "Test Market First", "Strategic Partnership", "Organic Only"], "Focus": ["Revenue Growth", "User Growth", "Geographic Growth", "Product Expansion"], "Method": [`${objStr} Acquisition`, `${objStr} Partnership`, `${objStr} Organic Build`] }) },
    { test: /\b(improv|optimis|optimiz|enhanc|upgrad|refin)\b/i, chips: () => ({ [`${objStr} Improvements`]: [`Full ${objStr} Overhaul`, `Incremental ${objStr} Tweaks`, "Targeted Quick Wins", "Benchmark Then Decide", "Outsource Improvement"], "Priority": ["Highest Impact First", "Lowest Effort First", "Customer-Facing First", "Internal Process First"] }) },
    { test: /\b(negotiate|renegotiat|deal|contract|renew)\b/i, chips: () => ({ [`${objStr} Terms`]: [`Accept Current ${objStr} Terms`, `Push for Better ${objStr} Terms`, "Walk Away", "Extend Short-Term", "Competitive Tender"], "Leverage": ["Hard Negotiate", "Collaborative Discussion", "Bring Alternatives", "Escalate to Senior"] }) },
    { test: /\b(evaluat|assess|review|audit|analys|compar)\b/i, chips: () => ({ [`${objStr} Review`]: [`Continue with Current ${objStr}`, `Overhaul ${objStr}`, `Benchmark ${objStr}`, `Get External ${objStr} Audit`, `Defer ${objStr} Review`], "Depth": ["Full Deep Dive", "High-Level Scan", "Peer Comparison", "Data-Driven Audit"] }) },
    { test: /\b(reduc|cut|eliminat|minimis|minimiz|lower|decreas)\b/i, chips: () => ({ [`${objStr} Reduction`]: [`Cut ${objStr} by 25%`, `Cut ${objStr} by 50%`, `Eliminate ${objStr} Entirely`, `Restructure ${objStr}`, `Find ${objStr} Alternative`], "Speed": ["Immediate Cuts", "Gradual Reduction", "One-Time Restructure", "Ongoing Optimisation"] }) },
    { test: /\b(automat|streamlin|digitis|digitiz|ai|machine learn)\b/i, chips: () => ({ [`${objStr} Automation`]: [`Full ${objStr} Automation`, `Partial ${objStr} Automation`, `AI-Assisted ${objStr}`, `Manual with Better Tools`, `Outsource ${objStr}`], "Platform": ["Custom Build", "No-Code Platform", "AI / LLM Solution", "Off-the-Shelf SaaS", "RPA Tool"] }) },
    { test: /\b(pric|charg|monetis|monetiz|subscription|fee)\b/i, chips: () => ({ [`${objStr} Pricing`]: ["Freemium Model", "Tiered Pricing", "Usage-Based", "Flat Rate", "Per-Seat"], "Position": ["Premium Pricing", "Market Rate", "Undercut Competitors", "Value-Based", "Dynamic Pricing"] }) },
    { test: /\b(rebrand|reposit|messag|identity|logo)\b/i, chips: () => ({ [`${objStr}`]: ["Full Rebrand", "Visual Refresh Only", "Messaging Update", "Sub-Brand", "Co-Brand"], "Approach": ["Agency-Led", "In-House Creative", "Customer Research First", "Competitive Analysis First"] }) },
    { test: /\b(retain|keep|prevent.*leav|churn|loyalty)\b/i, chips: () => ({ [`${objStr} Retention`]: ["Salary Increase", "Equity / Options", "Role Expansion", "Flexible Working", "Retention Bonus"], "Preventive": ["Career Path Discussion", "Mentor Assignment", "Project of Choice", "Counter-Offer Package"] }) },
  ];

  for (const a of actions) {
    if (a.test.test(name)) return filterExisting(a.chips());
  }

  // No action detected — generate from the object words themselves
  if (obj.length >= 2) {
    return filterExisting({
      [objStr]: [`Proceed with ${obj[0]}`, `Alternative ${obj[1]}`, `Combined Approach`, `Defer ${objStr}`, `Pilot ${obj[0]} First`],
      "Approach": ["Full Commitment", "Phased Rollout", "Limited Trial", "More Research Needed"],
      "Variations": [`${obj[0]}-Led Strategy`, `${obj[1]}-Led Strategy`, `Balanced ${objStr}`]
    });
  }
  if (obj.length === 1) {
    return filterExisting({
      [objStr + " Options"]: [`${objStr} — Option A`, `${objStr} — Option B`, `Modified ${objStr}`, `No ${objStr}`, `Defer Decision`],
      "Scale": ["Full Commitment", "Phased Approach", "Limited Trial", "Explore Alternatives"]
    });
  }
  return GENERIC_CONTEXTUAL.opt;
}

function synthesizeCritChips(dName, opts, existingCrits) {
  const name = (dName || "").toLowerCase();
  const subject = extractSubject(dName);
  const subjectStr = subject.slice(0, 2).join(" ");
  const optNames = (opts || []).map(o => (o.name || o)).filter(Boolean);
  const critLower = (existingCrits || []).map(c => (c.name || c).toLowerCase());
  const filterUsed = (chips) => {
    const r = {};
    for (const [cat, arr] of Object.entries(chips)) {
      const f = arr.filter(c => !critLower.includes(c.toLowerCase()));
      if (f.length > 0) r[cat] = f;
    }
    return Object.keys(r).length > 0 ? r : chips;
  };

  const result = {};

  // Generate option-comparative criteria when options exist
  if (optNames.length >= 2) {
    const a = optNames[0].length > 20 ? optNames[0].substring(0, 18) + "…" : optNames[0];
    const b = optNames[1].length > 20 ? optNames[1].substring(0, 18) + "…" : optNames[1];
    result["Head-to-Head"] = [
      `${a} vs ${b} Cost`,
      `${a} vs ${b} Risk`,
      `${a} vs ${b} Speed`,
      `Which Scales Better`,
      `Long-Term Flexibility`,
      `Team Preference`,
    ].filter(c => !critLower.includes(c.toLowerCase()));

    // Per-option criteria
    for (const opt of optNames.slice(0, 3)) {
      const short = opt.length > 20 ? opt.substring(0, 18) + "…" : opt;
      result["About " + short] = [
        `${short} — Total Cost`,
        `${short} — Implementation Time`,
        `${short} — Risk Level`,
        `${short} — Quality / Fit`,
        `${short} — Learning Curve`,
      ].filter(c => !critLower.includes(c.toLowerCase()));
    }
  }

  // Subject-derived criteria — expanded with more patterns
  const critActions = [
    { test: /\b(hire|recruit|talent|staff|headcount)\b/i, crits: { "Person Fit": ["Technical Skill Match", "Culture & Values Fit", "Leadership Potential", "Salary vs Budget", "Growth Trajectory"], "Role Impact": ["Team Gap Filled", "Retention Likelihood", "Onboarding Speed", "Diversity Contribution", "Manager Fit"] } },
    { test: /\b(tech|software|platform|system|tool|crm|saas|app)\b/i, crits: { "Technical Fit": ["Integration with Current Stack", "Learning Curve", "Performance at Scale", "Security & Compliance", "API & Extensibility", "Mobile Experience"], "Business Value": ["Cost per User", "Time to Deploy", "Vendor Reliability", "Migration Effort", "Lock-In Risk", "Support Quality"] } },
    { test: /\b(marketing|campaign|brand|advertis|promot|awareness)\b/i, crits: { "Performance": ["Expected ROI", "Cost per Acquisition", "Audience Reach Quality", "Brand Alignment", "Conversion Potential"], "Execution": ["Creative Resource Need", "Time to Launch", "Measurement Clarity", "Channel Expertise Required", "Scalability"] } },
    { test: /\b(vendor|supplier|provider|partner|agency|consultant)\b/i, crits: { "Capability": ["Relevant Track Record", "Domain Expertise Depth", "Support Responsiveness", "Scalability", "Security Posture", "References"], "Commercial": ["Total Cost of Ownership", "Contract Flexibility", "Payment Terms", "SLA Guarantees", "Exit Clause Fairness"] } },
    { test: /\b(invest|fund|budget|spend|financ|capital)\b/i, crits: { "Returns": ["Expected ROI", "Payback Period", "Revenue Uplift", "Cost Avoidance", "Strategic Value"], "Risk": ["Capital at Risk", "Downside Scenario", "Opportunity Cost", "Cash Flow Impact", "Reversibility", "Market Timing"] } },
    { test: /\b(product|feature|roadmap|build|launch|ship)\b/i, crits: { "Product": ["User Demand Strength", "Technical Feasibility", "Competitive Differentiation", "Revenue Potential", "Time to Ship"], "Risk": ["Engineering Complexity", "Maintenance Burden", "Market Timing Risk", "Cannibalisation Risk", "Dependency Risk"] } },
    { test: /\b(office|remote|hybrid|workspace|location|relocat)\b/i, crits: { "People": ["Employee Preference", "Commute Impact", "Collaboration Quality", "Talent Pool Access", "Wellbeing Effect"], "Business": ["Lease / Cost Impact", "Client Accessibility", "Brand Perception", "Productivity Impact"] } },
    { test: /\b(pric|monetis|monetiz|subscription|revenue model)\b/i, crits: { "Revenue": ["Revenue Per User", "Customer Lifetime Value", "Conversion Rate Impact", "Churn Risk", "Upsell Potential"], "Market": ["Competitive Positioning", "Price Sensitivity", "Willingness to Pay", "Market Perception", "Adoption Barrier"] } },
    { test: /\b(migrat|switch|transition|replac|mov)\b/i, crits: { "Migration": ["Data Integrity Risk", "Downtime Window", "Training Requirement", "Rollback Difficulty", "Integration Breakage"], "Business": ["User Disruption", "Productivity Dip Duration", "Cost of Transition", "Timeline Certainty", "Compliance Continuity"] } },
    { test: /\b(expand|enter|market|international|geograph)\b/i, crits: { "Market": ["Market Size", "Competitive Landscape", "Regulatory Complexity", "Cultural Fit", "Customer Demand"], "Execution": ["Local Talent Availability", "Distribution Capability", "Capital Required", "Time to Revenue", "Cannibalisation Risk"] } },
    { test: /\b(automat|streamlin|efficien|process|workflow)\b/i, crits: { "Value": ["Time Saved per Week", "Error Rate Reduction", "Cost Savings", "Employee Satisfaction", "Scalability Gain"], "Feasibility": ["Implementation Effort", "Change Management Risk", "System Reliability", "Maintenance Burden", "Training Need"] } },
    { test: /\b(restructur|reorganis|reorganiz|reorg|team)\b/i, crits: { "People": ["Key Talent Retention", "Morale Impact", "Communication Clarity", "Manager Span of Control", "Career Path Impact"], "Business": ["Efficiency Gain", "Decision Speed", "Customer Impact", "Cost Reduction", "Implementation Disruption"] } },
    { test: /\b(secur|protect|privac|complian|regulat|gdpr|soc2)\b/i, crits: { "Risk": ["Breach Probability", "Data Sensitivity Level", "Regulatory Penalty Risk", "Reputational Damage", "Third-Party Exposure"], "Implementation": ["Compliance Gap Size", "Implementation Cost", "Ongoing Monitoring Load", "Team Expertise Gap", "Timeline Pressure"] } },
    { test: /\b(customer|client|user|support|service|experience)\b/i, crits: { "Customer Impact": ["Customer Satisfaction", "NPS Impact", "Retention Rate", "Support Volume", "Time to Resolution"], "Business": ["Revenue per Customer", "Churn Reduction", "Upsell Opportunity", "Brand Loyalty", "Referral Potential"] } },
  ];

  for (const a of critActions) {
    if (a.test.test(name)) { Object.assign(result, a.crits); return filterUsed(result); }
  }

  // Smarter generic — use option names in category labels
  if (optNames.length > 0 && Object.keys(result).length <= 2) {
    result["Overall"] = ["Strategic Alignment", "Team Readiness", "Stakeholder Buy-In", "Reversibility", "Opportunity Cost"];
    result["Practical"] = ["Total Cost", "Implementation Time", "Quality of Outcome", "Risk Level", "Dependencies"];
  } else if (optNames.length === 0) {
    result[subjectStr + " Factors"] = ["Total Cost", "Time to Deliver", "Quality of Outcome", "Risk Level", "Strategic Alignment"];
    result["Execution"] = ["Implementation Effort", "Team Readiness", "Stakeholder Buy-In", "Reversibility", "Dependencies"];
    result["Impact"] = ["Revenue Impact", "Customer Impact", "Team Impact", "Competitive Impact"];
  }
  return filterUsed(result);
}

function synthesizeQvOptChips(question, existingOpts) {
  const q = (question || "").toLowerCase();
  const subject = extractSubject(question);
  const subjectStr = subject.slice(0, 2).join(" ");
  const optNames = (existingOpts || []).map(o => (o.name || o).toLowerCase()).filter(Boolean);

  // Run the scored pattern matching first (existing deriveQvOptChips logic)
  const patternResult = deriveQvOptChips(question, { opts: existingOpts });

  // Check if the pattern result is just the generic fallback
  const isGeneric = Object.values(patternResult).flat().includes("Option A");
  if (!isGeneric) return patternResult;

  // Generate from question structure
  const qActions = [
    { test: /\bhow (many|much|often)\b/i, chips: (s) => ({ "Amount": ["1–2", "3–5", "5–10", "10+", "Depends on Context"], "Frequency": ["Daily", "Weekly", "Monthly", "Quarterly", "As Needed"] }) },
    { test: /\bwho (should|will|can|is)\b/i, chips: (s) => ({ "Person / Team": [`${s} Lead`, "Cross-Functional Team", "External Consultant", "Entire Team", "Leadership Only"], "Ownership": ["I'll Do It", "Delegate to Team", "Hire for It", "No One Yet"] }) },
    { test: /\bwhy (should|do|did|are|is)\b/i, chips: (s) => ({ "Reasoning": ["Revenue Growth", "Cost Reduction", "Customer Demand", "Competitive Pressure", "Team Request"], "Conviction": ["Strong Evidence", "Some Evidence", "Gut Feeling", "Need More Data", "Not Convinced"] }) },
    { test: /\bwhat (should|do|is|are|would)\b/i, chips: (s) => ({ [s + " Options"]: [`${subject[0] || "Primary"} Focus`, `${subject[1] || "Secondary"} Focus`, "Combination", "None of These", "Need More Discussion"] }) },
    { test: /\b(rate|rank|score|evaluat|assess)\b/i, chips: (s) => ({ "Rating": ["Excellent", "Good", "Adequate", "Needs Work", "Poor"], "Priority": ["Critical", "High", "Medium", "Low", "Not Relevant"] }) },
    { test: /\b(prefer|favourite|favorite|like|enjoy)\b/i, chips: (s) => ({ "Preference": [`Strongly Prefer ${subject[0] || "A"}`, `Prefer ${subject[1] || "B"}`, "No Preference", "Dislike Both", "Need More Options"] }) },
    { test: /\b(ready|prepared|confident|comfortable)\b/i, chips: (s) => ({ "Readiness": ["Fully Ready", "Almost Ready", "Needs More Time", "Not Ready", "Need Clarity First"], "Confidence": ["Very Confident", "Somewhat Confident", "Unsure", "Concerned", "Need Support"] }) },
  ];

  for (const a of qActions) {
    if (a.test.test(q)) return a.chips(subjectStr);
  }

  // Build from the question's key nouns
  if (subject.length >= 2) {
    return {
      [subjectStr]: [`${subject[0]}`, `${subject[1]}`, `Both ${subject[0]} & ${subject[1]}`, "Neither", "Something Else"],
      "Stance": ["Strongly For", "Leaning For", "Neutral", "Leaning Against", "Strongly Against"]
    };
  }
  if (subject.length === 1) {
    return {
      [subject[0]]: [`${subject[0]} — Yes`, `${subject[0]} — No`, `${subject[0]} — Modified`, `Need More Info`, `Not a Priority`],
      "Confidence": ["Very Confident", "Somewhat Confident", "Unsure", "Concerned"]
    };
  }

  return patternResult;
}

function deriveQvOptChips(questionText, aiContext) {
  const q = questionText.toLowerCase();
  const existingOpts = (aiContext?.opts || []).map(o => (o.name || o).toLowerCase());
  // Score each pattern — pick the BEST match, not first match
  const patterns = [
    { score: 0, keywords: ["when", "date", "deadline", "timeline", "schedule"], chips: { "Timing": ["This Week", "Next Week", "End of Month", "Next Quarter", "No Fixed Date"], "Urgency": ["ASAP", "Within 2 Weeks", "End of Quarter", "Flexible"] } },
    { score: 0, keywords: ["launch date", "launch"], chips: { "Launch Window": ["Immediate Launch", "2-Week Sprint", "End of Month", "Next Quarter", "Align with Event"], "Readiness": ["Ready Now", "Almost Ready", "Needs More Work", "Not Ready"] } },
    { score: 0, keywords: ["where", "location", "venue", "offsite", "office", "space"], chips: { "Location": ["Main Office", "Remote / Virtual", "Off-Site Venue", "Co-Working Space", "Client Site"], "Format": ["In-Person Only", "Hybrid Mix", "Fully Virtual", "Rotating Locations"] } },
    { score: 0, keywords: ["how much", "budget", "spend", "cost", "allocat", "invest", "funding"], chips: { "Range": ["Under $10K", "$10K–$50K", "$50K–$100K", "$100K+", "Variable"], "Approach": ["Increase Budget", "Maintain Current", "Reallocate Internally", "Reduce Spend", "Need More Data"] } },
    { score: 0, keywords: ["priority", "important", "focus", "urgent", "critical", "rank"], chips: { "Priority": ["Critical / P0", "High Priority", "Medium Priority", "Low Priority", "Not a Priority"], "Timeframe": ["Immediate", "This Quarter", "This Year", "Backlog"] } },
    { score: 0, keywords: ["vendor", "shortlist", "provider", "supplier", "platform", "tool", "software", "system"], chips: { "Evaluation": ["Current Provider", "Market Leader", "Best Value", "Specialist Niche", "New Entrant"], "Next Step": ["Shortlist Top 3", "Deep Dive Top 2", "Go with Recommendation", "Extend Search", "Run RFP"] } },
    { score: 0, keywords: ["feature", "ship", "roadmap", "build", "develop", "release"], chips: { "Priority": ["Ship Now", "Next Sprint", "This Quarter", "Backlog", "Deprioritise"], "Approach": ["Full Build", "MVP First", "Iterate Existing", "Partner Integration", "Buy Not Build"] } },
    { score: 0, keywords: ["candidate", "hire", "recruit", "who should", "applicant", "role"], chips: { "Decision": ["Candidate A", "Candidate B", "Candidate C", "Re-Open Search", "Restructure Role"], "Timing": ["Offer Now", "Second Round", "Reference Check", "Delay Decision"] } },
    { score: 0, keywords: ["design", "direction", "creative", "style", "look", "visual", "brand", "logo"], chips: { "Direction": ["Direction A", "Direction B", "Direction C", "Combine Elements", "Start Fresh"], "Feedback": ["Love It", "Good with Tweaks", "Neutral", "Has Concerns", "Wrong Direction"] } },
    { score: 0, keywords: ["meeting", "format", "structure", "cadence", "standup", "sync"], chips: { "Format": ["Weekly Standup", "Biweekly Deep-Dive", "Monthly Review", "Async Only", "Ad-Hoc"], "Length": ["15 Minutes", "30 Minutes", "45 Minutes", "60 Minutes"] } },
    { score: 0, keywords: ["block", "challenge", "problem", "issue", "obstacle", "bottleneck", "stuck"], chips: { "Blocker": ["Resource Constraints", "Unclear Requirements", "Technical Debt", "External Dependencies", "Stakeholder Alignment"], "Response": ["Escalate Now", "Find Workaround", "Pause & Reassess", "Request Resource", "Reduce Scope"] } },
    { score: 0, keywords: ["market", "enter", "expand", "grow", "territory", "region", "international"], chips: { "Decision": ["Enter Now", "Pilot First", "Partner Entry", "Wait for Signal", "Focus Elsewhere"], "Scale": ["Full Commitment", "Staged Entry", "Single Market Test", "Digital-First Entry"] } },
    { score: 0, keywords: ["strategy", "plan", "approach", "direction", "path", "way forward"], chips: { "Approach": ["Aggressive Growth", "Steady Build", "Pivot Direction", "Consolidate First", "Wait & Watch"], "Commitment": ["Full Commitment", "Phased Rollout", "Pilot Only", "More Research Needed"] } },
    { score: 0, keywords: ["lunch", "food", "eat", "restaurant", "catering", "meal", "dinner", "coffee"], chips: { "Cuisine": ["Italian", "Japanese / Sushi", "Mexican", "Thai / Asian", "Mediterranean"], "Format": ["Sit-Down Restaurant", "Casual / Fast", "Catering to Office", "Potluck", "Food Court"] } },
    { score: 0, keywords: ["team", "event", "activity", "bonding", "outing", "celebration", "social"], chips: { "Activity": ["Team Dinner", "Outdoor Activity", "Workshop", "Escape Room", "Volunteering"], "Format": ["Half-Day Event", "Full-Day Event", "Evening Only", "Virtual Event", "Weekend Retreat"] } },
    { score: 0, keywords: ["name", "title", "call", "rebrand", "naming"], chips: { "Style": ["Descriptive Name", "Abstract / Creative", "Acronym", "Founder-Based", "Geographic"], "Tone": ["Professional", "Playful", "Bold", "Classic", "Modern / Techy"] } },
    { score: 0, keywords: ["colour", "color", "theme", "palette"], chips: { "Palette": ["Blue / Corporate", "Green / Natural", "Bold / Vibrant", "Neutral / Minimal", "Dark / Premium"], "Style": ["Modern Flat", "Gradient", "Monochrome", "Earth Tones", "Brand Aligned"] } },
    { score: 0, keywords: ["client", "customer", "account", "deal", "contract", "renewal"], chips: { "Action": ["Renew As-Is", "Renegotiate Terms", "Expand Scope", "Reduce Scope", "Let Expire"], "Urgency": ["Immediate Action", "This Week", "Before Renewal", "No Rush", "Needs Discussion"] } },
    { score: 0, keywords: ["process", "workflow", "automat", "efficien", "improve", "streamline"], chips: { "Approach": ["Automate Fully", "Partial Automation", "Redesign Process", "Keep Current", "Outsource"], "Scope": ["Quick Win First", "Full Overhaul", "Phased Improvement", "Pilot Department"] } },
    { score: 0, keywords: ["train", "learn", "develop", "skill", "upskill", "course", "certification"], chips: { "Format": ["Online Course", "In-Person Workshop", "Mentoring Programme", "Conference", "Self-Directed"], "Investment": ["Under $500", "$500–$2K", "$2K–$5K", "$5K+", "Company Budget"] } },
    { score: 0, keywords: ["content", "campaign", "channel", "social media", "advertis", "promot"], chips: { "Channel": ["LinkedIn", "Instagram", "Email Marketing", "Google Ads", "Content / Blog"], "Approach": ["Organic Focus", "Paid Focus", "Mixed Strategy", "Influencer-Led", "Community-Led"] } },
    { score: 0, keywords: ["should we", "do you think", "agree", "consensus", "opinion", "vote"], chips: { "Agreement": ["Definitely Yes", "Leaning Yes", "Unsure — Need Info", "Leaning No", "Definitely No"] } },
    { score: 0, keywords: ["how", "approach", "handle", "deal with", "respond", "tackle", "address"], chips: { "Response": ["Act Immediately", "Plan Then Act", "Delegate to Team", "Escalate to Leadership", "Gather More Input"], "Style": ["Direct Approach", "Collaborative Discussion", "Formal Process", "External Advice"] } },
  ];
  // Score each pattern by keyword match count and specificity
  for (const p of patterns) {
    for (const kw of p.keywords) {
      if (q.includes(kw)) p.score += kw.length; // longer keywords = more specific = higher score
    }
  }
  const best = patterns.sort((a, b) => b.score - a.score)[0];
  if (best.score > 0) return best.chips;
  // No keyword match — extract key nouns from question for category label
  const words = q.replace(/[?.,!]/g, "").split(/\s+/).filter(w => w.length > 3 && !["what", "which", "should", "would", "could", "does", "have", "this", "that", "with", "from", "your", "about", "best", "most", "team"].includes(w));
  const topic = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { [topic || "Options"]: ["Option A", "Option B", "Option C", "None of These", "Need More Discussion"], "Position": ["Strongly For", "Moderately For", "Neutral", "Moderately Against", "Strongly Against"] };
}

function getContextualFallbacks(storageKey, aiContext) {
  if (storageKey === "name" || storageKey === "qv-name") return FALLBACK_CHIPS[storageKey] || {};
  const ctx = (aiContext?.dName || "").toLowerCase();
  const decType = aiContext?.decisionType || "";
  const existingOpts = (aiContext?.opts || []).map(o => (o.name || o)).filter(Boolean);
  const existingCrits = (aiContext?.crits || []).map(cr => (cr.name || cr)).filter(Boolean);

  // QV options — use enhanced synthesis
  if (storageKey === "qv-opt") return synthesizeQvOptChips(aiContext?.dName || "", aiContext?.opts || []);

  if (!ctx || ctx.length < 3) return GENERIC_CONTEXTUAL[storageKey] || {};

  // Stem-based matching: find all topic matches via alias stems
  const matchedTopics = new Set();
  for (const [stem, topic] of Object.entries(_TOPIC_STEMS)) {
    if (ctx.includes(stem)) matchedTopics.add(topic);
  }
  const merged = {};
  let matched = false;
  for (const topic of matchedTopics) {
    const data = TOPIC_CHIPS[topic];
    if (data && data[storageKey]) {
      matched = true;
      for (const [cat, chips] of Object.entries(data[storageKey])) {
        if (!merged[cat]) merged[cat] = [];
        for (const c of chips) { if (!merged[cat].includes(c)) merged[cat].push(c); }
      }
    }
  }

  // ALWAYS enhance with synthesis — merge topic chips + synthesized chips
  if (storageKey === "opt") {
    const synth = synthesizeOptChips(aiContext?.dName || "", decType, existingOpts);
    for (const [cat, chips] of Object.entries(synth)) {
      if (!merged[cat]) merged[cat] = [];
      for (const c of chips) { if (!merged[cat].includes(c)) merged[cat].push(c); }
    }
    return merged;
  }
  if (storageKey === "crit") {
    const synth = synthesizeCritChips(aiContext?.dName || "", existingOpts, existingCrits);
    for (const [cat, chips] of Object.entries(synth)) {
      if (!merged[cat]) merged[cat] = [];
      for (const c of chips) { if (!merged[cat].includes(c)) merged[cat].push(c); }
    }
    return merged;
  }

  if (matched) return merged;
  return GENERIC_CONTEXTUAL[storageKey] || {};
}

async function fetchAiChipSuggestions({ step, picked, context, count = 10, history = [] }) {
  try {
    const dName = context.dName || "";
    const decisionType = context.decisionType || "";
    const decisionCtx = dName ? `Decision: "${dName}"` : "";
    const typeCtx = decisionType ? `\nDecision type: ${decisionType === "binary" ? "Binary (exactly 2 options — suggest opposing/contrasting choices)" : decisionType === "qv" ? "Quick Poll (team vote — suggest concrete, short answers)" : "Multi-option (3-6 distinct alternatives)"}` : "";
    const optsCtx = context.opts && context.opts.length ? `\nOptions already chosen: ${context.opts.map(o => o.name || o).join(", ")}` : "";
    const critsCtx = context.crits && context.crits.length ? `\nCriteria already chosen: ${context.crits.map(cr => cr.name || cr).join(", ")}` : "";
    const alreadyPicked = picked && picked.length ? `\nDo NOT repeat these: ${picked.join(", ")}` : "";
    const typedCtx = context.typed && context.typed.trim()
      ? `\nUser is currently typing: "${context.typed.trim()}"\nCRITICAL: The first 3-4 suggestions MUST be intelligent completions of what they're typing. Predict what they intend. If typing "sal" for a CRM decision, suggest "Salesforce Enterprise", "Sales Team Training", etc. Remaining suggestions should be complementary alternatives they haven't thought of.`
      : "";
    const historyCtx = history.length > 0 ? `\nUser's past decisions: ${history.slice(0, 5).join(", ")}. Include 1-2 suggestions that build on patterns from their history (e.g. if they often decide about hiring, suggest team-related angles).` : "";

    // Enhanced step-specific prompts with deeper intelligence
    const typeHint = step === "name"
      ? `decision names — specific, actionable business decisions. Mix: 3 common decisions people face, 3 strategic/unusual decisions, 2 inspired by current business trends (AI adoption, remote work, sustainability). Format: 3-6 words, Title Case. E.g. "Q2 Engineering Headcount Plan", "AI Customer Support Rollout", "Series B Term Sheet Review"`
      : step === "opt" && decisionType === "binary"
      ? `exactly ${count} options for binary decision "${dName}". First 2 must be the most natural YES/NO or A/B framing. Next 2 should be smart alternatives (hybrid, conditional, phased). Remaining should be creative reframes a consultant would suggest. Each must be a REAL choice — never "Option A/B".`
      : step === "opt"
      ? `exactly ${count} concrete options for "${dName}". Think like a McKinsey consultant: what are the 3 obvious choices, 3 creative alternatives, and 2 reframes? Include one "status quo" option and one contrarian option. Each must be specific enough that a reader could guess the decision. E.g. for "CRM Platform": "Salesforce Enterprise", "HubSpot Pro", "Build Custom CRM", "Keep Spreadsheets", "Outsource to Agency".`
      : step === "qv-name"
      ? `poll questions for business teams. Mix: 3 strategic ("What should be our top Q3 priority?"), 3 operational ("Which meeting format works best?"), 2 team culture ("How should we celebrate the launch?"). Each must be a complete question ending with "?".`
      : step === "qv-opt"
      ? `short poll answers (2-4 words) that are SPECIFIC answers to "${dName}". Each must be something a real person would vote for. Include 1 creative/unexpected option. NOT generic scales like "Agree/Disagree" — actual choices.${optsCtx}`
      : `evaluation criteria for deciding "${dName}" with options [${(context.opts||[]).map(o=>o.name||o).join(", ")}]. Think like a decision analyst: include 3 quantitative factors (cost, time, ROI), 3 qualitative factors (team fit, risk, strategic alignment), and 2 often-overlooked factors unique to this specific decision. Each must be a real factor — not generic jargon.`;

    const prompt = `You are a world-class business strategist and decision advisor. Generate exactly ${count} ${typeHint}.\n${decisionCtx}${typeCtx}${optsCtx}${critsCtx}${alreadyPicked}${typedCtx}${historyCtx}\n\nRules:\n- Hyper-specific to this exact context — a reader should immediately understand the decision from suggestions alone\n- 2-5 words, Title Case, professional\n- Mutually exclusive — zero overlap between suggestions\n- Order by relevance: most likely picks first\n- Mix obvious and creative — include at least 2 suggestions the user wouldn't think of on their own\nJSON only: {"chips":["item1","item2",...]}`;

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed.chips) ? parsed.chips.slice(0, count) : [];
  } catch(e) { return []; }
}

function ChipPicker({ onPick, usedNames = [], storageKey, aiContext, focusNext, collapsed = false }) {
  const [chips, setChips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickedChip, setPickedChip] = useState(null);
  const [refreshSpin, setRefreshSpin] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const mountedRef = useRef(true);
  const debounceRef = useRef(null);
  const lastContextRef = useRef(null);
  const chipCountRef = useRef(0);

  // Load user history for personalisation
  const [history, setHistory] = useState([]);
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const h = await window.storage.get("unstuk_history");
        const arr = JSON.parse(h.value || "[]");
        setHistory(arr.map(d => d.name).filter(Boolean).slice(0, 8));
      } catch(e) {}
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const load = async (pickedSoFar = []) => {
    if (!mountedRef.current) return;
    setLoading(true);
    chipCountRef.current += 1;
    const suggestions = await fetchAiChipSuggestions({
      step: storageKey,
      picked: [...(usedNames || []), ...pickedSoFar],
      context: aiContext || { dName: "", opts: [], crits: [] },
      count: 10,
      history,
    });
    if (mountedRef.current) {
      setChips(suggestions);
      setLoading(false);
    }
  };

  // Responsive: reload on every context change with short debounce
  useEffect(() => {
    const ctxKey = JSON.stringify({
      dName: aiContext?.dName || "",
      opts: (aiContext?.opts || []).map(o => o.name || o).join(","),
      crits: (aiContext?.crits || []).map(cr => cr.name || cr).join(","),
      typed: aiContext?.typed || "",
    });
    if (ctxKey === lastContextRef.current) return;
    lastContextRef.current = ctxKey;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const isFirst = chips.length === 0 && !loading;
    const typed = (aiContext?.typed || "").trim();
    debounceRef.current = setTimeout(() => { load(); }, isFirst ? 0 : typed.length > 2 ? 250 : 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [aiContext?.dName, aiContext?.typed, (aiContext?.opts||[]).length, (aiContext?.crits||[]).length]);

  const handlePick = (name) => {
    setPickedChip(name);
    setTimeout(() => {
      setPickedChip(null);
      onPick(name);
      load([name]);
      if (focusNext) {
        setTimeout(() => {
          const el = typeof focusNext === "string" ? document.getElementById(focusNext) : null;
          if (el) { el.focus(); el.style.borderColor = C.sage; el.style.boxShadow = `0 0 0 3px ${C.sage}20`; setTimeout(() => { el.style.borderColor = C.border; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }, 1800); }
        }, 60);
      }
    }, 220);
  };

  const handleRefresh = () => {
    setRefreshSpin(true);
    load();
    setTimeout(() => setRefreshSpin(false), 600);
  };

  const usedLower = usedNames.map(n => n.toLowerCase());
  const aiChips = chips.filter(ch => !usedLower.includes(ch.toLowerCase()));
  const typed = (aiContext?.typed || "").trim().toLowerCase();

  // Intelligent relevance scoring — rank chips by match quality
  const scoreChip = (chip) => {
    const cl = chip.toLowerCase();
    if (!typed || typed.length < 2) return 0;
    if (cl.startsWith(typed)) return 100;
    if (cl.includes(typed)) return 70;
    // Word-level matching
    const words = typed.split(/\s+/);
    let wordScore = 0;
    for (const w of words) { if (w.length > 1 && cl.includes(w)) wordScore += 30; }
    return wordScore;
  };

  // Build sections: AI chips replace fallbacks when available
  const sections = [];
  const [manualExpand, setManualExpand] = useState(false);
  const skipTypedFilter = manualExpand && collapsed;

  if (aiChips.length > 0) {
    // Split AI chips: best matches first when user is typing
    if (typed.length >= 2) {
      const scored = aiChips.map(ch => ({ chip: ch, score: scoreChip(ch) }));
      const matches = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.chip);
      const rest = scored.filter(s => s.score === 0).map(s => s.chip);
      if (matches.length > 0) {
        sections.push({ label: "Best matches", chips: matches, isAi: true, highlight: true });
        if (rest.length > 0) sections.push({ label: "More suggestions", chips: rest, isAi: true });
      } else {
        sections.push({ label: "Suggested for you", chips: aiChips, isAi: true });
      }
    } else {
      sections.push({ label: "Suggested for you", chips: aiChips, isAi: true });
    }
  } else {
    const fallbackData = getContextualFallbacks(storageKey, aiContext);
    Object.keys(fallbackData).forEach(cat => {
      const filtered = fallbackData[cat].filter(c => {
        if (usedLower.includes(c.toLowerCase())) return false;
        if (!skipTypedFilter && typed.length > 1) return c.toLowerCase().includes(typed);
        return true;
      });
      if (filtered.length > 0) sections.push({ label: cat, chips: filtered });
    });
  }

  const isCollapsed = collapsed && !manualExpand;
  useEffect(() => { if (!collapsed) setManualExpand(false); }, [collapsed]);

  // Contextual hint based on step
  const stepHints = { name: "What decision are you facing?", opt: "What are your choices?", crit: "What factors matter most?", "qv-name": "What do you want to ask?", "qv-opt": "What can people vote for?" };
  const hint = stepHints[storageKey] || "Tap to add";

  if (isCollapsed) {
    // Show mini preview chips in collapsed state
    const previewChips = aiChips.slice(0, 3);
    return (
      <div onClick={() => setManualExpand(true)} style={{
        marginTop: 8, marginBottom: 2, padding: "8px 12px", borderRadius: 10,
        background: `linear-gradient(135deg, ${C.sageSoft}80, ${C.taupeSoft}60)`,
        border: `1px solid ${C.sage}15`, cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${C.sageSoft}, ${C.taupeSoft})`; e.currentTarget.style.borderColor = `${C.sage}30`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${C.sageSoft}80, ${C.taupeSoft}60)`; e.currentTarget.style.borderColor = `${C.sage}15`; }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
            <span style={{ fontFamily: F.b, fontSize: 9, color: C.sage, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Suggestions</span>
            {previewChips.length > 0 && (
              <div style={{ display: "flex", gap: 4, overflow: "hidden" }}>
                {previewChips.map(ch => (
                  <span key={ch} style={{ fontFamily: F.b, fontSize: 9, color: C.muted, padding: "2px 8px", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}80`, whiteSpace: "nowrap", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{ch}</span>
                ))}
              </div>
            )}
          </div>
          <span style={{ fontFamily: F.b, fontSize: 10, color: C.sage, fontWeight: 500, opacity: 0.8, whiteSpace: "nowrap", marginLeft: 8 }}>Show ›</span>
        </div>
      </div>
    );
  }

  // Determine which categories are expanded (default: first 2 open)
  const getExpanded = (label, idx) => {
    if (expandedCats[label] !== undefined) return expandedCats[label];
    return idx < 2;
  };

  return (
    <div style={{ marginTop: 10, marginBottom: 4 }}>
      <style>{`
        @keyframes ustk-dot-pulse { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); } 40% { opacity: 1; transform: scale(1); } }
        @keyframes ustk-chip-in { from { opacity: 0; transform: translateY(6px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ustk-chip-pick { 0% { transform: scale(1); } 50% { transform: scale(0.88); opacity: 0.5; } 100% { transform: scale(0.8); opacity: 0; } }
        @keyframes ustk-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ustk-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* Header with collapse button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: 0, fontWeight: 600, letterSpacing: "0.04em" }}>
          {typed.length > 2 ? `Matching "${typed}"` : hint}
        </p>
        {collapsed && manualExpand && (
          <button onClick={() => setManualExpand(false)} style={{
            fontFamily: F.b, fontSize: 9, color: C.taupe, background: "none", border: "none", cursor: "pointer", padding: "2px 6px", opacity: 0.7,
          }}>Hide</button>
        )}
      </div>

      {/* Sections */}
      {sections.length > 0 && sections.map((sec, secIdx) => {
        const isOpen = getExpanded(sec.label, secIdx);
        const maxVisible = isOpen ? sec.chips.length : 0;
        const hasMany = sec.chips.length > 6;

        return (
          <div key={sec.label} style={{ marginBottom: 10 }}>
            {/* Section header — collapsible */}
            <button onClick={() => setExpandedCats(prev => ({ ...prev, [sec.label]: !isOpen }))}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "2px 0", margin: "0 0 6px", width: "100%" }}>
              <span style={{
                fontFamily: F.b, fontSize: 9, color: sec.highlight ? C.sage : sec.isAi ? C.sage : C.taupe,
                textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
              }}>{sec.label}</span>
              <span style={{ fontFamily: F.b, fontSize: 8, color: C.border, transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>{"\u25BE"}</span>
              {sec.isAi && <span style={{ fontFamily: F.b, fontSize: 8, color: C.taupe, opacity: 0.6 }}>({sec.chips.length})</span>}
              <div style={{ flex: 1 }} />
              {sec.isAi && isOpen && (
                <button onClick={(e) => { e.stopPropagation(); handleRefresh(); }} title="Refresh" aria-label="Refresh suggestions"
                  style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 12, border: `1px solid ${C.border}50`,
                    background: "transparent", color: C.taupe, cursor: "pointer",
                    animation: refreshSpin ? "ustk-refresh-spin 0.6s ease" : "none",
                    transition: "color 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.sage; e.currentTarget.style.borderColor = C.sage + "50"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.taupe; e.currentTarget.style.borderColor = C.border + "50"; }}
                >{"\u21BB"}</button>
              )}
            </button>

            {/* Chips container with smooth expand/collapse */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
              maxHeight: isOpen ? 400 : 0, overflow: "hidden",
              transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s",
              opacity: isOpen ? 1 : 0,
            }}>
              {sec.chips.slice(0, maxVisible).map((chip, chipIdx) => {
                const isPicked = pickedChip === chip;
                const isMatch = typed.length >= 2 && chip.toLowerCase().includes(typed);
                return (
                  <button key={chip} className="ustk-touch" onClick={() => handlePick(chip)}
                    style={{
                      fontFamily: F.b, fontSize: 11, padding: "7px 14px", borderRadius: 22,
                      border: `1.5px solid ${isMatch ? C.sage + "60" : C.border}`,
                      background: isMatch ? `linear-gradient(135deg, ${C.sageSoft}, #fff)` : "#fff",
                      color: isMatch ? C.sage : C.text,
                      cursor: "pointer", lineHeight: 1.2,
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: isMatch ? `0 2px 8px ${C.sage}15` : "0 1px 3px rgba(0,0,0,0.04)",
                      animation: isPicked ? "ustk-chip-pick 0.22s ease forwards" : `ustk-chip-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${chipIdx * 0.04}s both`,
                      fontWeight: isMatch ? 500 : 400,
                    }}
                    onMouseEnter={e => {
                      if (!isPicked) {
                        e.currentTarget.style.borderColor = C.sage;
                        e.currentTarget.style.background = `linear-gradient(135deg, ${C.sageSoft}, #fff)`;
                        e.currentTarget.style.color = C.sage;
                        e.currentTarget.style.boxShadow = `0 2px 10px ${C.sage}20`;
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isPicked) {
                        e.currentTarget.style.borderColor = isMatch ? C.sage + "60" : C.border;
                        e.currentTarget.style.background = isMatch ? `linear-gradient(135deg, ${C.sageSoft}, #fff)` : "#fff";
                        e.currentTarget.style.color = isMatch ? C.sage : C.text;
                        e.currentTarget.style.boxShadow = isMatch ? `0 2px 8px ${C.sage}15` : "0 1px 3px rgba(0,0,0,0.04)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                    onTouchStart={e => { e.currentTarget.style.transform = "scale(0.95)"; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {sections.length === 0 && !loading && (
        <div style={{ padding: "10px 0" }}>
          <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "4px 0" }}>
            {typed.length > 2 ? `No matches for "${typed}" \u2014 try different words or clear to see all` : "Type above to get tailored suggestions"}
          </p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[70, 90, 60, 80, 55, 75].map((w, i) => (
              <div key={i} style={{
                width: w, height: 28, borderRadius: 22,
                background: `linear-gradient(90deg, ${C.border}30 25%, ${C.border}50 50%, ${C.border}30 75%)`,
                backgroundSize: "200% 100%",
                animation: `ustk-shimmer 1.5s ease infinite ${i * 0.12}s`,
              }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, paddingLeft: 2 }}>
            <span style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, marginRight: 4 }}>Tailoring to your context</span>
            {[0, 0.18, 0.36].map((delay, i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: C.sage, opacity: 0.2, animation: `ustk-dot-pulse 1.1s ease-in-out ${delay}s infinite` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ─── Helpers ───
const uid = () => Math.random().toString(36).slice(2, 10);
const secureCode = (len = 6) => { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const arr = new Uint8Array(len); crypto.getRandomValues(arr); return Array.from(arr, b => chars[b % chars.length]).join(""); };
const pct = (v, t) => { const r = t === 0 ? 0 : Math.round((v / t) * 100); return Number.isFinite(r) ? r : 0; };

const IMPORTANCE = [
  { label: "Low", value: 1 },
  { label: "Moderate", value: 2 },
  { label: "High", value: 3 },
];
const BIN_ADV = [
  { label: "Slight", value: 1 },
  { label: "Moderate", value: 2 },
  { label: "Strong", value: 3 },
];
const MULTI_ADV = [
  { label: "Major disadvantage", value: -3 },
  { label: "Moderate disadvantage", value: -2 },
  { label: "Minor disadvantage", value: -1 },
  { label: "Same", value: 0 },
  { label: "Minor advantage", value: 1 },
  { label: "Moderate advantage", value: 2 },
  { label: "Major advantage", value: 3 },
];

// ─── Content safety filter ───
const BLOCKED_TERMS = [
  "murder", "rape", "molest", "terrorist attack", "child abuse",
  "sex trafficking", "genocide", "ethnic cleansing",
];

function isBlockedContent(text) {
  const lower = text.toLowerCase();
  return BLOCKED_TERMS.some((t) => lower.includes(t));
}

// ─── Colour palette: warm stone, ink, sage ───
const C = {
  bg: "#F5F3EE",        // warm linen
  card: "#FFFFFF",
  text: "#1C1917",       // warm ink
  muted: "#78716C",      // stone
  accent: "#292524",     // dark stone
  accentLt: "#E7E5E4",  // light stone
  border: "#D6D3D1",    // stone border
  sage: "#4A6741",       // muted sage green
  sageSoft: "#ECF0EB",
  taupe: "#A3937B",      // warm taupe
  taupeSoft: "#F5F0EA",
  error: "#9A3412",
  errorSoft: "#FFF7ED",
};

const F = {
  d: "'Cormorant Garamond', Georgia, serif",
  b: "'DM Sans', 'Helvetica Neue', sans-serif",
};

// ─── Persistent storage ───
async function loadHistory() {
  try {
    const r = await window.storage.get("unstuk_history");
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return [];
}

async function saveHistory(list) {
  try {
    const cutoff = Date.now() - 60 * 86400000;
    const cleaned = list.filter((x) => x.timestamp > cutoff);
    await window.storage.set("unstuk_history", JSON.stringify(cleaned));
    return cleaned;
  } catch (e) {
    return list;
  }
}

// ─── Components ───

function FadeIn({ children, delay = 0 }) {
  const [v, setV] = useState(false);
  useEffect(() => { const t = setTimeout(() => setV(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.45s ease, transform 0.45s ease" }}>{children}</div>;
}

function Btn({ children, onClick, v = "primary", disabled, style = {}, ariaLabel }) {
  const base = { fontFamily: F.b, fontSize: 14, fontWeight: 500, letterSpacing: "0.015em", border: "none", borderRadius: 8, cursor: disabled ? "default" : "pointer", padding: "12px 28px", transition: "opacity 0.15s", opacity: disabled ? 0.35 : 1 };
  const vs = {
    primary: { background: C.accent, color: "#fff" },
    secondary: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.muted, padding: "8px 12px", fontSize: 13 },
    sage: { background: C.sage, color: "#fff" },
  };
  return <button onClick={disabled ? undefined : onClick} aria-label={ariaLabel} style={{ ...base, ...vs[v], ...style }}>{children}</button>;
}

function Card({ children, style = {} }) {
  return <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "28px 28px", ...style }}>{children}</div>;
}

// Micro-reward — inline progress element with gentle completion feedback
// Shows step count, and the number briefly glows sage on each advance
function InlineReward({ show }) {
  if (!show) return null;
  return (
    <span style={{
      fontFamily: "'DM Sans'", fontSize: 11,
      color: "#9a8a72", marginLeft: 6, verticalAlign: "middle",
    }}>{"\u2713"}</span>
  );
}

function MicroReward({ tick, current, total }) {
  const [flash, setFlash] = useState(false);
  const prevTick = useRef(0);
  useEffect(() => {
    if (tick > 0 && tick !== prevTick.current) {
      prevTick.current = tick;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [tick]);
  if (total <= 0) return null;
  const done = current;
  const nearEnd = done >= total - 1;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 8 }}>
      {/* Thin progress track */}
      <div style={{ flex: 1, maxWidth: 120, height: 2, borderRadius: 1, background: C.accentLt, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 1,
          width: `${Math.min((done / total) * 100, 100)}%`,
          background: C.sage,
          transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      {/* Step counter */}
      <span style={{
        fontFamily: F.b, fontSize: 11, fontWeight: 600,
        color: flash ? C.sage : C.border,
        transition: "all 0.3s ease",
        letterSpacing: "0.02em",
        textShadow: flash ? `0 0 8px ${C.sage}50` : "none",
        transform: flash ? "scale(1.15)" : "scale(1)",
        display: "inline-block",
      }}>
        {done}/{total} {flash && "\u2713"}
      </span>
      {/* Near-completion encouragement — appears at last 2 steps */}
      {nearEnd && done > 0 && done < total && (
        <span style={{
          fontFamily: F.b, fontSize: 10, color: C.sage,
          opacity: flash ? 1 : 0.6,
          transition: "opacity 0.3s ease",
        }}>
          {done === total - 1 ? "Last one" : "Almost there"}
        </span>
      )}
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontFamily: F.b, fontSize: 11, fontWeight: 500, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{children}</div>;
}

function H({ children, size = "lg" }) {
  const s = { xl: { fontSize: 32, lineHeight: 1.2 }, lg: { fontSize: 22, lineHeight: 1.3 }, md: { fontSize: 17, lineHeight: 1.4 } };
  return <h2 style={{ fontFamily: F.d, fontWeight: 600, color: C.text, margin: 0, ...s[size] }}>{children}</h2>;
}

function Sub({ children }) {
  return <p style={{ fontFamily: F.b, fontSize: 13, color: C.muted, margin: "6px 0 18px", lineHeight: 1.5 }}>{children}</p>;
}

function sanitize(v) { return v.replace(/<[^>]*>/g, "").replace(/[<>]/g, ""); }
function TxtIn({ value, onChange, onSubmit, onFocus, placeholder, autoFocus = true, maxLen = null, inputId = null }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus && ref.current) {
      const t = setTimeout(() => ref.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);
  const handleChange = (e) => {
    const v = sanitize(e.target.value);
    if (maxLen && v.length > maxLen) return;
    onChange(v);
  };
  const hasClear = value.trim().length > 0;
  const rightPad = maxLen ? (hasClear ? 84 : 48) : (hasClear ? 52 : 16);
  return (
    <div style={{ position: "relative" }}>
      <input ref={ref} id={inputId || undefined} type="text" value={value} onChange={handleChange}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit?.(); }}
        placeholder={placeholder}
        maxLength={maxLen || undefined}
        style={{ width: "100%", boxSizing: "border-box", fontFamily: F.b, fontSize: 13, padding: "13px 16px", paddingRight: rightPad, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", background: "#ffffff", color: C.text, transition: "border-color 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        onFocus={(e) => { e.target.style.borderColor = C.accent; onFocus?.(); }}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
      />
      {hasClear && (
        <button onClick={() => { onChange(""); ref.current?.focus(); }} aria-label="Remove text" style={{ position: "absolute", right: maxLen ? 44 : 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: C.muted, fontFamily: F.b, fontSize: 9, letterSpacing: "0.02em", cursor: "pointer", padding: "3px 6px", borderRadius: 4, transition: "color 0.15s, background 0.15s", opacity: 0.6 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = C.border + "20"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "transparent"; }}>remove</button>
      )}
      {maxLen && value.length > 0 && (
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontFamily: F.b, fontSize: 10, color: value.length >= maxLen ? C.taupe : C.border }}>
          {maxLen - value.length}
        </span>
      )}
    </div>
  );
}

function ImportancePills({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {IMPORTANCE.map((o) => {
        const sel = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{ fontFamily: F.b, fontSize: 13, fontWeight: sel ? 600 : 400, padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${sel ? C.accent : C.border}`, background: sel ? C.accent : "transparent", color: sel ? "#fff" : C.text, cursor: "pointer", transition: "all 0.15s" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Completely flat — no hover, no highlight, no selected state
function FlatBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ fontFamily: F.b, fontSize: 14, padding: "14px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.text, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box" }}>
      {label}
    </button>
  );
}

function FlatGrid({ options, onSelect, cols = null }) {
  const c = cols || Math.min(options.length, 3);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${c}, 1fr)`, gap: 8 }}>
      {options.map((o) => (
        <button key={o.value ?? o.label} onClick={() => onSelect(o.value)}
          style={{ fontFamily: F.b, fontSize: 13, padding: "13px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.text, cursor: "pointer" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Dots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{
            width: active ? 20 : 6, height: 6, borderRadius: 3,
            background: done ? C.sage : active ? C.accent : C.accentLt,
            boxShadow: done ? `0 0 5px ${C.sage}35` : "none",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
          }} />
        );
      })}
    </div>
  );
}

function Tip({ text }) {
  const [s, setS] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <span onClick={() => setS(!s)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: `1px solid ${C.border}`, fontSize: 10, fontFamily: F.b, color: C.muted, cursor: "pointer", userSelect: "none" }}>?</span>
      {s && (
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.accent, color: "#fff", fontFamily: F.b, fontSize: 12, lineHeight: 1.5, padding: "10px 14px", borderRadius: 8, width: 240, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,0.12)" }}>
          {text}
        </div>
      )}
    </span>
  );
}

function BackBtn({ onClick, label = "Back" }) {
  return (
    <button onClick={onClick} style={{ fontFamily: F.b, fontSize: 13, fontWeight: 500, color: C.taupe, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.01em", opacity: 0.85, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = 0.85}>
      <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>‹</span>{label}
    </button>
  );
}

function CritRows({ items, onRemove, lastAddedId }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((cr) => (
        <div key={cr.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: lastAddedId === cr.id ? C.sageSoft + "60" : C.bg, border: `1px solid ${lastAddedId === cr.id ? C.sage + "30" : C.border}`, fontFamily: F.b, fontSize: 13, transition: "all 0.3s ease" }}>
          <span>{cr.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastAddedId === cr.id && <span style={{ fontSize: 11, color: "#9a8a72" }}>{"\u2713"}</span>}
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
              color: cr.importance === 3 ? C.sage : cr.importance === 2 ? C.taupe : C.muted }}>
              {IMPORTANCE.find((x) => x.value === cr.importance)?.label}
            </span>
            {onRemove && <button onClick={() => onRemove(cr.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontSize: 11, padding: "2px 8px", lineHeight: 1, opacity: 0.6, transition: "opacity 0.2s", letterSpacing: "0.02em", fontWeight: 500 }} onMouseEnter={(e) => e.target.style.opacity="1"} onMouseLeave={(e) => e.target.style.opacity="0.6"}>remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OptRows({ items, onRemove, lastAddedId }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((o, i) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: lastAddedId === o.id ? C.sageSoft + "60" : C.bg, border: `1px solid ${lastAddedId === o.id ? C.sage + "30" : C.border}`, fontFamily: F.b, fontSize: 13, transition: "all 0.3s ease" }}>
          <span><span style={{ color: C.muted, marginRight: 6 }}>{i + 1}.</span>{o.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {lastAddedId === o.id && <span style={{ fontSize: 11, color: "#9a8a72" }}>{"\u2713"}</span>}
            {onRemove && <button onClick={() => onRemove(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontSize: 11, padding: "2px 8px", lineHeight: 1, opacity: 0.6, transition: "opacity 0.2s", letterSpacing: "0.02em", fontWeight: 500 }} onMouseEnter={(e) => e.target.style.opacity="1"} onMouseLeave={(e) => e.target.style.opacity="0.6"}>remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Animated Logo for Results ───
function UnstukAnim({ tie, skip }) {
  // Timing: hold 0.8s → gap opens over 1.2s → pause 0.3s → ball rises over 1s
  const [gapDeg, setGapDeg] = useState(0);
  const [ballUp, setBallUp] = useState(false);
  const startRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (skip && !tie) {
      setGapDeg(30);
      setBallUp(true);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [skip, tie]);

  useEffect(() => {
    if (tie || skip) return;

    const holdTimer = setTimeout(() => {
      startRef.current = performance.now();
      const animate = (now) => {
        const elapsed = now - startRef.current;
        const progress = Math.min(elapsed / 1200, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setGapDeg(eased * 30);
        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    }, 800);

    const ballTimer = setTimeout(() => setBallUp(true), 2300);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(ballTimer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [tie]);

  const cx = 30, cy = 30, r = 22;
  const toRad = (d) => (d * Math.PI) / 180;

  // Arc endpoints from exact 12 o'clock
  const rAngle = toRad(-90 + gapDeg);
  const lAngle = toRad(-90 - gapDeg);
  const px = (a) => (cx + r * Math.cos(a)).toFixed(3);
  const py = (a) => (cy + r * Math.sin(a)).toFixed(3);

  const arcD = gapDeg > 0.5
    ? `M ${px(rAngle)} ${py(rAngle)} A ${r} ${r} 0 1 1 ${px(lAngle)} ${py(lAngle)}`
    : `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${(cx - 0.001).toFixed(3)} ${cy - r}`;

  // Ball: centre of circle → centre of open space above gap
  // Open space above: from top of circle (cy-r=8) to top of viewbox (0), middle = 4
  // Offset from centre: cy - 4 = 26px up
  const ballOffset = (tie || !ballUp) ? 0 : -(cy - 4);

  return (
    <div style={{ width: 60, height: 60, margin: "0 auto 18px" }}>
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
        <path
          d={arcD}
          stroke={C.accent}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <g style={{
          transform: `translateY(${ballOffset}px)`,
          transition: ballUp ? "transform 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)" : "none",
        }}>
          <circle cx={cx} cy={cy} r="4" fill={C.sage} />
        </g>
      </svg>
    </div>
  );
}

// ─── Results ───
function ResultsView({ results, dName, critCount, onDone, onBack, onImmediate, onGroup, groupErr, setGroupExpiry, groupExpiryVal, setGroupHideIndiv, groupHideIndivVal, groupRequireCode, setGroupRequireCode, onOpenShareSheet, gutDoneExternal, setGutDoneExternal, groupCreatedExternal, setGroupCreatedExternal }) {
  const [showGroupSetup, setShowGroupSetup] = useState(false);
  const groupCreated = groupCreatedExternal || false;
  const setGroupCreated = setGroupCreatedExternal || (() => {});
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [ph, setPh] = useState(0);
  const [copied, setCopied] = useState(false);
  const gutDone = gutDoneExternal || false;
  const setGutDone = setGutDoneExternal || (() => {});
  const [gutVisible, setGutVisible] = useState(false);
  const [gutPicked, setGutPicked] = useState(null);
  const timersRef = useRef([]);
  const skipAnim = () => { timersRef.current.forEach(clearTimeout); setPh(2); };
  useEffect(() => {
    const a = setTimeout(() => setPh(1), 200);
    const b = setTimeout(() => setPh(2), 3500);
    timersRef.current = [a, b];
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  // Gut section appears immediately with results
  useEffect(() => {
    if (ph >= 1 && !gutDone) setGutVisible(true);
  }, [ph, gutDone]);
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;

  // Strength of result
  const gap = tie ? 0 : sorted.length > 1 ? sorted[0].pct - sorted[1].pct : 100;
  const strength = tie ? "tie" : gap >= 30 ? "clear" : gap >= 10 ? "moderate" : "close";
  const strengthMsg = { clear: "This is a clear result.", moderate: "A meaningful difference, though not overwhelming.", close: "This is a close call \u2014 see the strategies below.", tie: null };

  // Shareable summary — two versions
  const bar = (pct) => {
    const filled = Math.round(pct / 5);
    return "\u2593".repeat(filled) + "\u2591".repeat(20 - filled);
  };
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const shareText = [
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "  Unstuk \u00b7 Decision Analysis",
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "",
    "  " + (dName || "Decision"),
    "  " + (critCount || 0) + " criteria compared \u00b7 " + dateStr,
    "",
    ...sorted.map((r, i) =>
      "  " + (i === 0 && !tie ? "\u25b6 " : "  ") + r.name + "  " + r.pct + "%\n  " + "  " + bar(r.pct)
    ),
    "",
    tie
      ? "  Result: Too close to call"
      : strength === "close"
        ? "  Result: Close call \u2014 " + sorted[0].name + " edges ahead"
        : strength === "moderate"
          ? "  Result: " + sorted[0].name + " is the stronger choice"
          : "  Result: " + sorted[0].name + " is the clear winner",
    "",
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "  Think to get unstuk — try it free.",
    "  https://unstuk.app",
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  ].join("\n");

  const saveText = [
    (dName || "Decision") + " \u2014 Unstuk Analysis",
    dateStr,
    "",
    ...sorted.map((r) => r.name + ": " + r.pct + "%"),
    "",
    "Based on " + (critCount || 0) + " criteria.",
    tie ? "Result: Tie." : "Result: " + sorted[0].name + " (" + sorted[0].pct + "%).",
  ].join("\n");

  const [shareMode, setShareMode] = useState(null); // null | "share" | "save"
  const copyText = (text) => {
    const doFallback = () => { try { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch(e) {} };
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(doFallback); } else { doFallback(); }
  };

  return (
    <FadeIn>
      <div style={{ textAlign: "center", padding: "16px 0" }} onClick={ph < 2 ? skipAnim : undefined}>
        <div style={{ textAlign: "left" }}><BackBtn onClick={onBack} /></div>
        <div style={{ opacity: ph >= 1 ? 1 : 0, transform: ph >= 1 ? "scale(1)" : "scale(0.6)", transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <UnstukAnim tie={tie} skip={ph >= 2} />
        </div>
        {ph < 2 && <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "0 0 12px", cursor: "pointer" }}>tap to skip</p>}
        <H size="xl">{tie ? "It\u2019s a tie" : sorted[0].name}</H>
        {!tie && <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, marginTop: 6 }}>is the stronger choice — your thinking, your call</p>}

        {strengthMsg[strength] && (
          <p style={{ fontFamily: F.b, fontSize: 12, color: strength === "clear" ? C.sage : C.taupe, marginTop: 10, fontStyle: "italic" }}>
            {strengthMsg[strength]}
          </p>
        )}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((r, i) => (
            <FadeIn key={r.name} delay={200 + i * 120}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 10, background: i === 0 && !tie ? C.sageSoft : C.bg, border: `1px solid ${i === 0 && !tie ? C.sage + "30" : C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 26, fontWeight: 700, color: i === 0 && !tie ? C.sage : C.text, minWidth: 56, textAlign: "right" }}>{r.pct}%</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.b, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 5 }}>{r.name}</div>
                  <div style={{ height: 5, borderRadius: 3, background: C.accentLt, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: ph >= 2 ? `${Math.max(r.pct, 6)}%` : "0%", borderRadius: 3, background: i === 0 && !tie ? C.sage : C.muted, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {ph >= 2 && (
          <>
            <p style={{ fontFamily: F.b, fontSize: 10, fontStyle: "italic", color: C.taupe, lineHeight: 1.5, margin: "16px 0 0", textAlign: "center" }}>
              {tie ? "A tie means your criteria weighted both options equally — your instinct or a casting vote may be the tiebreaker."
                : gap <= 10 ? "A narrow margin means this is genuinely close. Small changes in criteria or weighting could flip the result."
                : gap <= 30 ? "A moderate margin suggests a real difference, but consider whether any missing criteria could change things."
                : "A strong margin. This result is robust across your criteria."}
            </p>

            {/* Result confidence & analysis */}
            <FadeIn delay={400}>
              <div style={{ marginTop: 20, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px", fontWeight: 600 }}>Analysis Breakdown</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: gap >= 20 ? C.sage : C.taupe }}>{gap}%</div>
                    <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>Gap</div>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: C.text }}>{critCount || 0}</div>
                    <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>Criteria</div>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: strength === "clear" ? C.sage : strength === "close" ? C.taupe : C.text }}>
                      {strength === "clear" ? "High" : strength === "moderate" ? "Med" : strength === "close" ? "Low" : "—"}
                    </div>
                    <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>Confidence</div>
                  </div>
                </div>

                {/* Sensitivity note */}
                {!tie && (
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px" }}>
                    <p style={{ fontFamily: F.b, fontSize: 11, color: C.text, margin: 0, lineHeight: 1.6 }}>
                      {strength === "clear"
                        ? `${sorted[0].name} dominates across your criteria. Even re-weighting wouldn't change this.`
                        : strength === "moderate"
                          ? `${sorted[0].name} leads, but adjusting 1-2 criteria weights could narrow the gap.`
                          : `This is razor-thin — ${sorted[0].name} and ${sorted[1].name} are nearly tied. One missing criterion could flip the result.`}
                    </p>
                  </div>
                )}
              </div>
            </FadeIn>

            {/* What to do next */}
            <FadeIn delay={600}>
              <div style={{ marginTop: 10, background: C.sageSoft, borderRadius: 10, border: `1px solid ${C.sage}20`, padding: "14px 16px" }}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontWeight: 600 }}>Recommended next step</p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>
                  {tie ? "Sleep on it. When the analysis can't separate options, your instinct — plus one new piece of information — is the tiebreaker."
                    : strength === "close" ? "Pressure-test this: if you had to defend picking " + sorted[1].name + " instead, what argument would you make? If it's strong, you may be missing a criterion."
                    : strength === "moderate" ? "Commit and set a 3-day growth checkpoint. When you reflect on this decision, you'll build your instinct for next time."
                    : "Move fast. A clear result means your criteria aligned strongly. Trust the analysis and execute."}
                </p>
              </div>
            </FadeIn>
          </>
        )}

        {/* ── Gut pulse — minimal, high-contrast, instant ── */}
        {!gutDone && gutVisible && !groupCreated && (
          <div style={{ marginTop: 32 }}>
            <style>{`
              @keyframes ustk-gut-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes ustk-gut-confirm {
                0% { transform: scale(1); }
                50% { transform: scale(1.08); }
                100% { transform: scale(1); }
              }
            `}</style>
            <div style={{
              animation: "ustk-gut-in 0.4s ease forwards",
              borderTop: `1px solid ${C.border}`,
              paddingTop: 20,
            }}>
              <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px", fontWeight: 600 }}>
                Gut pulse
              </p>
              <p style={{ fontFamily: F.d, fontSize: 19, fontWeight: 600, color: C.text, margin: "0 0 16px", lineHeight: 1.3 }}>
                How does this feel?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "Confident", value: "confident", accent: "#2e7d32", soft: "#f0f7f0" },
                  { label: "Uncertain", value: "uncertain", accent: "#b45309", soft: "#fdf8f0" },
                  { label: "Uneasy",    value: "uneasy",    accent: "#9a3412", soft: "#fdf4f2" },
                ].map((o) => {
                  const picked = gutPicked === o.value;
                  const faded  = gutPicked && !picked;
                  return (
                    <button key={o.value} onClick={() => {
                      setGutPicked(o.value);
                      setTimeout(() => { setGutDone(true); onImmediate && onImmediate(o.value); trackEvent("gut", { v: o.value }); }, 900);
                    }}
                      className="ustk-touch"
                      style={{
                        flex: 1,
                        fontFamily: F.b,
                        fontSize: 12,
                        fontWeight: picked ? 700 : 500,
                        padding: "13px 8px",
                        borderRadius: 10,
                        border: `2px solid ${picked ? o.accent : C.border}`,
                        background: picked ? o.accent : "#fff",
                        color: picked ? "#fff" : C.text,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                        transform: picked ? "scale(1.04)" : faded ? "scale(0.96)" : "scale(1)",
                        opacity: faded ? 0.35 : 1,
                        animation: picked ? "ustk-gut-confirm 0.3s ease" : "none",
                        boxShadow: picked ? `0 4px 16px ${o.accent}30` : "0 1px 3px rgba(0,0,0,0.06)",
                        letterSpacing: "0.01em",
                      }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {gutPicked && (
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: "10px 0 0", letterSpacing: "0.02em" }}>
                  ✓ Recorded — your growth checkpoint is in 3 days.
                </p>
              )}
            </div>
          </div>
        )}

        {gutDone && !emailSaved && !groupCreated && (
          <FadeIn>
            <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { setEmailSaved(true); try { window.storage.set("unstuk_remind", "1"); } catch(e) {} }}
                  style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: C.sage, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: 18, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </button>
                <div>
                  <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: 0 }}>Set a 3-day growth checkpoint</p>
                  <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "3px 0 0", lineHeight: 1.4 }}>
                    Your reflection will appear in Decision Growth. Research shows this improves accuracy by 20-50%.
                  </p>
                  <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 0", fontStyle: "italic" }}>
                    — Philip Tetlock, <em>Superforecasting</em> (2015)
                  </p>
                </div>
              </div>
              <button onClick={() => { setEmailSaved(true); try { window.storage.set("unstuk_remind", "0"); } catch(e) {} }}
                style={{ fontFamily: F.b, fontSize: 10, color: C.border, background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>No thanks, skip reminder</button>
            </div>
          </FadeIn>
        )}
        {emailSaved && (
          <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: "10px 0 0", textAlign: "center" }}>
            {"\u2713"} Growth checkpoint set — reflect in 3 days.
          </p>
        )}


        {!groupCreated && <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => { setShareMode(shareMode === "share" ? null : "share"); setCopied(false); }} style={{ fontFamily: F.b, fontSize: 11, color: shareMode === "share" ? C.sage : C.muted, background: shareMode === "share" ? C.sageSoft : C.bg, border: `1px solid ${shareMode === "share" ? C.sage + "40" : C.border}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", transition: "all 0.2s" }}>
            Share result
          </button>
          <button onClick={() => { setShareMode(shareMode === "save" ? null : "save"); setCopied(false); }} style={{ fontFamily: F.b, fontSize: 11, color: shareMode === "save" ? C.sage : C.muted, background: shareMode === "save" ? C.sageSoft : C.bg, border: `1px solid ${shareMode === "save" ? C.sage + "40" : C.border}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", transition: "all 0.2s" }}>
            Save for myself
          </button>
        </div>}

        {shareMode && !groupCreated && (
          <FadeIn>
            <Card style={{ marginTop: 14, textAlign: "left", padding: 16 }}>
              <pre style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 11, color: C.text, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", background: C.bg, padding: 12, borderRadius: 6, border: `1px solid ${C.border}` }}>{shareMode === "share" ? shareText : saveText}</pre>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={() => copyText(shareMode === "share" ? shareText : saveText)} style={{ fontFamily: F.b, fontSize: 12, color: "#fff", background: C.sage, border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", flex: 1 }}>
                  {copied ? "\u2713 Copied" : "Copy to clipboard"}
                </button>
              </div>

            </Card>
          </FadeIn>
        )}

        {(tie || strength === "close") && <TieBox />}

        <div style={{ marginTop: 24 }}>

          {onGroup && (
            <div style={{ marginTop: 30, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <Btn v="sage" onClick={() => setShowGroupSetup(s => !s)} style={{ width: "100%", padding: "13px 28px", fontSize: 13 }}>
                {"\uD83D\uDC65"} Make this a Team Decision
              </Btn>
              {showGroupSetup && (
                <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: C.sageSoft + "40", border: `1px solid ${C.sage}30` }}>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "0 0 4px" }}>Time limit:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[{ label: "15m", val: 0.25 }, { label: "30m", val: 0.5 }, { label: "1h", val: 1 }, { label: "6h", val: 6 }, { label: "24h", val: 24 }, { label: "3d", val: 72 }, { label: "1w", val: 168 }].map((t) => (
                        <button key={t.val} onClick={() => setGroupExpiry(groupExpiryVal === t.val ? null : t.val)} style={{
                          fontFamily: F.b, fontSize: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                          border: `1px solid ${groupExpiryVal === t.val ? C.sage : C.border}`,
                          background: groupExpiryVal === t.val ? C.sageSoft : "#fff",
                          color: groupExpiryVal === t.val ? C.sage : C.text,
                          fontWeight: groupExpiryVal === t.val ? 600 : 400,
                        }}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
                    onClick={() => { if (setGroupRequireCode) setGroupRequireCode(r => !r); }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, position: "relative", flexShrink: 0,
                      background: groupRequireCode ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2,
                        left: groupRequireCode ? 16 : 2, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                    </div>
                    <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted }}>Require join code (optional)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}
                    onClick={() => { if (setGroupHideIndiv) setGroupHideIndiv(h => !h); }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, position: "relative", flexShrink: 0,
                      background: groupHideIndivVal ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2,
                        left: groupHideIndivVal ? 16 : 2, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                    </div>
                    <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted }}>Hide individual scores</span>
                  </div>
                  <Btn v="sage" onClick={async () => { if (onGroup) { await onGroup(); setGroupCreated(true); setGutDone(true); setShowGroupSetup(false); } }} style={{ width: "100%", padding: "11px 20px", fontSize: 12 }}>
                    Create & share
                  </Btn>
                </div>
              )}
              {groupErr && <p style={{ fontFamily: F.b, fontSize: 11, color: C.error, margin: "8px 0 0" }}>{groupErr}</p>}
            </div>
          )}
          <Btn onClick={onDone} style={{ width: "100%", padding: "15px 28px", fontSize: 15, fontWeight: 600, marginTop: 8 }}>Done</Btn>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={onDone} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              ⌂ &nbsp;Home
            </button>
          </div>
        </div>

        {/* How it works + Decision principles — minimal, barely visible */}
        <HowItWorks />
      </div>
    </FadeIn>
  );
}

function HowItWorks() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${C.border}40` }}>
      <button onClick={() => setShow(!show)} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.03em" }}>
        {show ? "Hide" : "How Unstuk works ›"}
      </button>
      {show && (
        <FadeIn>
          <div style={{ textAlign: "left", marginTop: 14, fontFamily: F.b, fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600, color: C.text, fontSize: 12 }}>How scores are calculated</p>
            <p style={{ margin: "0 0 10px" }}>Unstuk uses a weighted scoring method. Each criterion you add carries an importance level you set. When you compare options, your choices are multiplied by these weights, then normalised into percentages. Options that perform well on the things you said matter most score higher.</p>
            <p style={{ margin: "0 0 10px" }}>This approach is used in decision science, consulting, and strategic planning. Unstuk makes it accessible without spreadsheets.</p>

            <p style={{ margin: "20px 0 12px", fontWeight: 600, color: C.text, fontSize: 12 }}>Principles of good decisions</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Separate the decision from the outcome. A good decision can still lead to a bad result. Judge your process, not the luck.</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Name what matters before you compare. Choosing criteria first prevents you from retrofitting reasons to justify an instinctive preference.</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Weight honestly. If salary matters more than commute, say so. Pretending everything is equally important produces useless results.</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Close calls are information. If two options score within 10%, the data is telling you both are viable. Use other signals — reversibility, timing, energy — to break it.</p>
            <p style={{ margin: "0 0 0" }}><span style={{ color: C.sage }}>&#9679;</span> Decide, then commit. Research shows that people who commit fully to a choice report higher satisfaction than those who keep second-guessing, even when the choices are identical.</p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function TieBox() {
  const [s, setS] = useState(false);
  return (
    <FadeIn delay={500}>
      <div style={{ marginTop: 20 }}>
        <button onClick={() => setS(!s)} style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, background: C.taupeSoft, border: `1px solid ${C.taupe}30`, borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
          {s ? "Hide advice" : "What to do when it's a tie"}
        </button>
        {s && (
          <Card style={{ marginTop: 12, textAlign: "left", padding: 20 }}>
            <div style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 14px" }}><strong>Pre-mortem test.</strong> Imagine you chose Option A and it went badly. Why did it fail? Repeat for Option B. The option whose failure scenario feels more avoidable is often the better bet. (Research by Gary Klein shows pre-mortems uncover risks that standard analysis misses.)</p>
              <p style={{ margin: "0 0 14px" }}><strong>Reversibility test.</strong> When two options score equally, lean toward the one that is harder to undo. Reversible choices can be corrected later, but irreversible ones deserve the benefit of the doubt now. (Based on the asymmetry principle in decision theory.)</p>
              <p style={{ margin: "0 0 14px" }}><strong>Scout mindset.</strong> Ask yourself: am I looking for reasons to confirm what I already want, or am I genuinely trying to find the truth? A tie often means one option feels emotionally right but can't justify itself on the criteria. Name that feeling. Then decide whether to trust it or override it. (From Julia Galef's work on epistemic rationality.)</p>
              <p style={{ margin: "0 0 14px" }}><strong>Expected value under uncertainty.</strong> For each option, estimate the best realistic outcome and the worst realistic outcome. Multiply each by its rough probability. The option with the higher expected value across scenarios is the more rational choice, even when criteria scores are equal. (Core principle of rational decision-making.)</p>
              <p style={{ margin: "0" }}><strong>Sleep on it — but set a deadline.</strong> Unconscious processing genuinely helps with complex decisions (research by Ap Dijksterhuis). Give yourself 48 hours, not longer. Unlimited time breeds overthinking, not clarity.</p>
            </div>
          </Card>
        )}
      </div>
    </FadeIn>
  );
}

// ─── Universal Share Sheet (WhatsApp, SMS, Email, Teams, Facebook, Copy) ───
function ShareSheet({ text, title, onClose }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(text);
  const hasNative = typeof navigator !== "undefined" && !!navigator.share;
  const nativeShare = async () => {
    try { await navigator.share({ text, title: title || "Unstuk" }); onClose(); } catch(e) {}
  };
  const channels = [
    { label: "WhatsApp", icon: "\uD83D\uDCAC", href: `https://wa.me/?text=${encoded}`, bg: "#25D36612" },
    { label: "SMS", icon: "\uD83D\uDCF1", href: `sms:?&body=${encoded}`, bg: "#5B8DEF12" },
    { label: "Email", icon: "\u2709\uFE0F", href: `mailto:?subject=${encodeURIComponent(title || "Unstuk")}&body=${encoded}%0A%0AGet%20Unstuk%20Now%20%E2%86%92%20https%3A%2F%2Funstuk.app`, bg: "#EA433512" },
    { label: "Teams", icon: "\uD83D\uDCBC", href: `https://teams.microsoft.com/share?msgText=${encoded}`, bg: "#6264A712" },
    { label: "Telegram", icon: "\u2708", href: `https://t.me/share/url?text=${encoded}`, bg: "#229ED912" },
    { label: "X", icon: "\uD835\uDD4F", href: `https://twitter.com/intent/tweet?text=${encoded}`, bg: "#14171A12" },
    { label: "Facebook", icon: "\uD83D\uDC4D", href: `https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, bg: "#1877F212" },
    { label: "LinkedIn", icon: "\uD83D\uDCE2", href: `https://www.linkedin.com/sharing/share-offsite/?url=https://unstuk.app&summary=${encoded}`, bg: "#0A66C212" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", maxWidth: 440, width: "100%", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", animation: "ustk-sheet-up 0.25s ease" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px", opacity: 0.5 }} />
        <p style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text, margin: "0 0 4px", textAlign: "center" }}>{title || "Share"}</p>
        <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: "0 0 14px", textAlign: "center", letterSpacing: "0.04em", fontStyle: "italic" }}>Get thinking. Get unstuk.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {channels.map(ch => (
            <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 400)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 4px", borderRadius: 12, border: `1px solid ${C.border}20`, background: ch.bg, textDecoration: "none", cursor: "pointer", transition: "all 0.15s" }}>
              <span style={{ fontSize: 20 }}>{ch.icon}</span>
              <span style={{ fontFamily: F.b, fontSize: 9, color: C.muted }}>{ch.label}</span>
            </a>
          ))}
        </div>
        <button onClick={() => { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;"; document.body.appendChild(ta); ta.focus(); ta.select(); try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch(e) {} document.body.removeChild(ta); }}
          style={{ fontFamily: F.b, fontSize: 13, padding: "13px 20px", borderRadius: 10, border: `1.5px solid ${copied ? C.sage : C.border}`, background: copied ? C.sageSoft : "#fff", color: copied ? C.sage : C.text, cursor: "pointer", width: "100%", fontWeight: 500, transition: "all 0.2s" }}>
          {copied ? "\u2713 Copied to clipboard" : "Copy to clipboard"}
        </button>
        <button onClick={onClose} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", marginTop: 10, width: "100%", padding: 6 }}>Cancel</button>
      </div>
      <style>{`@keyframes ustk-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

// PrivacyModal removed — content merged into Privacy Policy and Terms & Legal screens

// ─── Content blocked message ───
function BlockedMsg({ onBack }) {
  return (
    <FadeIn>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <H size="md">This isn't what Unstuk is for</H>
        <p style={{ fontFamily: F.b, fontSize: 13, color: C.muted, margin: "12px 0 24px", lineHeight: 1.6 }}>
          Unstuk helps with everyday decisions — career choices, purchases, planning, and similar matters. It cannot be used for decisions involving harm, violence, or illegal activity.
        </p>
        <Btn onClick={onBack}>Start over</Btn>
      </div>
    </FadeIn>
  );
}

// ─── App ───

function UnstukInner() {
  const [history, setHistory] = useState([]);
  const [histLoaded, setHistLoaded] = useState(false);
  // Paywall verification — hash-based so not trivially bypassed via console
  // In production, replace with StoreKit/Google Play receipt validation
  const UNLOCK_SALT = "unstuk_v3_" + (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 20) : "x");
  const makeUnlockToken = () => {
    let h = 0;
    for (let i = 0; i < UNLOCK_SALT.length; i++) { h = ((h << 5) - h) + UNLOCK_SALT.charCodeAt(i); h |= 0; }
    return "utk_" + Math.abs(h).toString(36) + "_paid";
  };
  const verifyUnlock = (token) => token === makeUnlockToken();
  const [unlocked, setUnlocked] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState(null); // 0=Sun..6=Sat
  const [weeklyTime, setWeeklyTime] = useState(null); // "morning"/"afternoon"/"evening"
  const [weeklyGoal, setWeeklyGoal] = useState(1); // decisions per week target
  const [showSchedule, setShowSchedule] = useState(false);
  const [weeklyTitle, setWeeklyTitle] = useState("");
  const [tempDay, setTempDay] = useState(1);
  const [tempTime, setTempTime] = useState("Morning");
  const [tempGoal, setTempGoal] = useState(1);
  const [blocked, setBlocked] = useState(false);
  const [seenOnboard, setSeenOnboard] = useState(true);
  const [seenWhatsNew, setSeenWhatsNew] = useState(true);
  const [onboardPage, setOnboardPage] = useState(0);
  const [tutSlide, setTutSlide] = useState(0);
  const [reflectId, setReflectId] = useState(null);
  const [reflectStep, setReflectStep] = useState(0);
  const [reflectAnswers, setReflectAnswers] = useState({});
  const [expandedDec, setExpandedDec] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [groupCode, setGroupCode] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupData, setGroupData] = useState(null);
  const [joinErr, setJoinErr] = useState(null);
  const [joinNameInput, setJoinNameInput] = useState("");
  const [groupCopied, setGroupCopied] = useState(false);

  const copyToClipboard = (text, setFlag) => {
    const doFallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setFlag(true); setTimeout(() => setFlag(false), 2000);
      } catch(e) {}
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => { setFlag(true); setTimeout(() => setFlag(false), 2000); }).catch(doFallback);
    } else { doFallback(); }
  };
  const [groupExpiry, setGroupExpiry] = useState(24);
  const [groupHideIndiv, setGroupHideIndiv] = useState(false);
  const [groupSubmitErr, setGroupSubmitErr] = useState(null);
  const [resultsGutDone, setResultsGutDone] = useState(false);
  const [resultsGroupCreated, setResultsGroupCreated] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false); // true when user started via "Team Decision" button
  const [isParticipant, setIsParticipant] = useState(false);
  const [gsCreating, setGsCreating] = useState(false); // true when joined someone else's group/poll
  const [groupRequireCode, setGroupRequireCode] = useState(false); // optional code for group decisions
  const [shareSheetData, setShareSheetData] = useState(null); // { text, title }

  // Load history, onboarding flag, and unlock status from persistent storage on mount
  useEffect(() => {
    loadHistory().then((h) => { setHistory(h); setHistLoaded(true); });
    (async () => {
      try {
        const r = await window.storage.get("unstuk_onboarded");
        if (!r || !r.value) setSeenOnboard(false);
      } catch (e) { setSeenOnboard(false); }
      try {
        const w = await window.storage.get("unstuk_whatsnew_v2");
        if (!w || !w.value) setSeenWhatsNew(false);
      } catch (e) { setSeenWhatsNew(false); }
      try {
        const gc = await window.storage.get("unstuk_active_groupCode");
        if (gc && gc.value) setGroupCode(gc.value);
      } catch(e) {}
      try {
        const qc = await window.storage.get("unstuk_active_qvCode");
        if (qc && qc.value) setQvCode(qc.value);
      } catch(e) {}
      try {
        const u = await window.storage.get("unstuk_unlocked");
        try { const wd = await window.storage.get("unstuk_weekly"); if (wd) { const wp = JSON.parse(wd.value); setWeeklyDay(wp.day); setWeeklyTime(wp.time); setWeeklyGoal(wp.goal || 1); } } catch(e) {}
        try { const al = await window.storage.get("unstuk_analytics"); if (al) { const parsed = JSON.parse(al.value); if (Array.isArray(parsed)) parsed.forEach(e => _evtLog.push(e)); } } catch(e) {}
        if (u && verifyUnlock(u.value)) setUnlocked(true);
      } catch (e) { /* not unlocked */ }

      // Deep linking: ?join=CODE goes straight to group join, ?poll=CODE goes straight to quick poll vote
      try {
        const params = new URLSearchParams(window.location.search);
        const joinParam = params.get("join");
        const pollParam = params.get("poll");
        if (joinParam && joinParam.length >= 4) {
          setJoinCode(joinParam.toUpperCase());
          setScreen("joingroup");
          // Clean URL without reload
          window.history.replaceState({}, "", window.location.pathname);
        } else if (pollParam && pollParam.length >= 4) {
          setQvJoinCode(pollParam.toUpperCase());
          setScreen("qv_vote");
          // Clean URL without reload
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch(e) {}
    })();
  }, []);

  const saveDec = (d) => {
    setHistory((prev) => {
      const next = [d, ...prev.filter((x) => x.id !== d.id)];
      saveHistory(next); // persist
      return next;
    });
  };

  const [screen, _setScreen] = useState("home");
  const prevScreenRef = useRef("home");
  const setScreen = (s) => { prevScreenRef.current = screen; _setScreen(s); };

  // ─── Persistent floating home button (all screens except home) ───
  useEffect(() => {
    const id = "ustk-floating-home";
    let el = document.getElementById(id);
    if (screen === "home") {
      if (el) el.style.display = "none";
      return;
    }
    if (!el) {
      el = document.createElement("button");
      el.id = id;
      el.innerHTML = '<span style="font-size:14px;line-height:1">⌂</span> Home';
      Object.assign(el.style, {
        position: "fixed", top: "14px", right: "14px", zIndex: "999",
        fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: "500", letterSpacing: "0.03em",
        color: "#57534E", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
        border: "1px solid #D6D3D1", borderRadius: "10px", padding: "8px 14px",
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px",
        opacity: "0.75", transition: "opacity 0.15s",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      });
      el.addEventListener("mouseenter", () => el.style.opacity = "1");
      el.addEventListener("mouseleave", () => el.style.opacity = "0.75");
      document.body.appendChild(el);
    }
    el.style.display = "inline-flex";
    el.onclick = () => setScreen("home");
    return () => { if (el && el.parentNode) { el.parentNode.removeChild(el); } };
  }, [screen]);

  const [dName, setDName] = useState("");
  const [dType, setDType] = useState(null);
  const [opts, setOpts] = useState([]);
  const [newOpt, setNewOpt] = useState("");
  const [crits, setCrits] = useState([]);
  const [newCrit, setNewCrit] = useState("");
  const [newImp, setNewImp] = useState(null);

  const [bo1, setBo1] = useState("");
  const [bo2, setBo2] = useState("");
  const [bIdx, setBIdx] = useState(0);
  const [bCh, setBCh] = useState([]);
  const [bPick, setBPick] = useState(null);
  const [advPicked, setAdvPicked] = useState(null);
  const [mAdvPicked, setMAdvPicked] = useState(null);

  const [baseOpt, setBaseOpt] = useState(null);
  const [mIdx, setMIdx] = useState(0);
  const [mCo, setMCo] = useState([]);
  const [mPairs, setMPairs] = useState([]);

  const [step, setStep] = useState("name");
  const [commitDone, setCommitDone] = useState(false); // tracks if user has seen commitment prompt this session
  const [commitChecked, setCommitChecked] = useState(false);
  const [res, setRes] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [rewardTick, setRewardTick] = useState(0);
  const [selPulse, setSelPulse] = useState(false);
  const [lastReward, setLastReward] = useState(null);
  const [lastAddedOpt, setLastAddedOpt] = useState(null);
  const [lastAddedCrit, setLastAddedCrit] = useState(null);
  const triggerPulse = () => { setSelPulse(true); setTimeout(() => setSelPulse(false), 400); };
  const showReward = (t) => { setLastReward(t); setTimeout(() => setLastReward(null), 1200); };
  const [addFlash, setAddFlash] = useState(null); // brief feedback on add: "option" | "criteria" | null // increments on each comparison completion to trigger MicroReward

  // ─── Quick Poll / Pulse Survey ───
  // qvScreen merged into main screen state: qv_create, qv_share, qv_vote, qv_results
  const [qvQuestion, setQvQuestion] = useState("");
  const [qvFocusArea, setQvFocusArea] = useState("question"); // "question" | "options"
  const [qvOptions, setQvOptions] = useState(["", ""]);
  const [qvCode, setQvCode] = useState(null);
  const [qvJoinCode, setQvJoinCode] = useState("");
  const [qvVoted, setQvVoted] = useState(null);
  const [qvResults, setQvResults] = useState(null);
  const [qvCopied, setQvCopied] = useState(false);
  const [qvErr, setQvErr] = useState(null);
  const [qvLoading, setQvLoading] = useState(false);
  const [qvExpiry, setQvExpiry] = useState(24); // hours, 0 = no limit
  const [qvRequireCode, setQvRequireCode] = useState(false); // optional code security
  const [checkoutMsg, setCheckoutMsg] = useState(null);

  const createQuickVote = async () => {
    const opts = qvOptions.map(o => o.trim()).filter(Boolean);
    if (!qvQuestion.trim() || opts.length < 2) return;
    if (isBlockedContent(qvQuestion) || opts.some(isBlockedContent)) { setBlocked(true); return; }
    const code = secureCode(6);
    const qv = { question: sanitize(qvQuestion.trim()), options: opts.map(sanitize), votes: {}, created: Date.now(), expiry: qvExpiry, requireCode: true };
    try { await window.storage.set("unstuk_qv_" + code, JSON.stringify(qv)); } catch(e) {}
    setQvCode(code);
    try { await window.storage.set("unstuk_active_qvCode", code); } catch(e) {}
    trackEvent("quickvote_create");
    const exL = qvExpiry === 0 ? "No time limit" : qvExpiry < 1 ? `${Math.round(qvExpiry * 60)} mins` : qvExpiry <= 1 ? "1 hour" : qvExpiry <= 24 ? `${qvExpiry} hours` : `${Math.round(qvExpiry / 24)} days`;
    const qvShareText = `📊 Quick Poll: ${sanitize(qvQuestion.trim())}\n\nOptions:\n${opts.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nVote here: https://unstuk.app?poll=${code}${qvExpiry > 0 ? `\n\nCloses in: ${exL}` : ""}`;
    setShareSheetData({ text: qvShareText, title: "Share Quick Poll", afterClose: () => setScreen("home") });
    setScreen("qv_share");
  };

  const joinQuickVote = async (code) => {
    try {
      const d = await window.storage.get("unstuk_qv_" + String(code).toUpperCase());
      if (!d) { setQvErr("Vote not found. Check the code."); return null; }
      return JSON.parse(d.value);
    } catch(e) { setQvErr("Could not load vote."); return null; }
  };

  const submitQuickVote = async (code, optionIdx) => {
    try {
      // Prevent duplicate voting — check if this device already voted
      const voteKey = "unstuk_qv_voted_" + code;
      try { const already = await window.storage.get(voteKey); if (already) { setQvVoted(parseInt(already.value, 10)); return; } } catch(e) { /* not voted yet */ }
      const d = await window.storage.get("unstuk_qv_" + code);
      if (!d) return;
      const qv = JSON.parse(d.value);
      if (qv.expiry > 0 && Date.now() > qv.created + qv.expiry * 3600000) { setQvErr("This poll has closed."); return; }
      const voterId = "v_" + secureCode(6);
      qv.votes[voterId] = optionIdx;
      await window.storage.set("unstuk_qv_" + code, JSON.stringify(qv));
      await window.storage.set(voteKey, String(optionIdx));
      setQvVoted(optionIdx);
      setQvResults(qv);
      trackEvent("quickvote_vote");
    } catch(e) {}
  };

  const loadQuickVoteResults = async (code) => {
    if (!code) return null;
    const upperCode = String(code).toUpperCase();
    try {
      const d = await window.storage.get("unstuk_qv_" + upperCode);
      if (!d || !d.value) return null;
      const parsed = JSON.parse(d.value);
      return { ...parsed, code: upperCode };
    } catch(e) { return null; }
  };

  useEffect(() => {
    if (res && !savedId && !savingRef.current) {
      savingRef.current = true;
      const id = uid();
      saveDec({
        id, name: dName, type: dType,
        ...(dType === "binary" ? { binaryOption1: bo1, binaryOption2: bo2, comparisons: bCh } : { options: opts, baseOption: baseOpt, comparisons: mCo }),
        criteria: crits, results: res, timestamp: Date.now(), groupCode: groupCode || undefined,
      });
      setSavedId(id);
      trackEvent("complete", { type: dType, crits: crits.length });
      savingRef.current = false;
      // Auto-submit to group if active
      if (groupCode && groupName) {
        setIsParticipant(false);
        submitToGroup(groupCode, groupName || "Creator", res).then((ok) => {
          if (!ok) setGroupSubmitErr("Couldn't submit to group. Your name may already be taken, or the group is full. Your results are saved locally.");
        });
      }
    }
  }, [res, savedId]);

  const saveImmediate = async (feeling) => {
    if (!savedId) return;
    const updated = history.map((d) =>
      d.id === savedId ? { ...d, immediate: { feeling, timestamp: Date.now() } } : d
    );
    setHistory(updated);
    saveHistory(updated);
    // No navigation — user stays on results page and uses Done button to proceed
  };

  // ─── Team Decision Helpers ───
  // Architecture: each participant writes to their OWN shared key.
  // No read-modify-write cycle = no race conditions = no backend needed.
  //   grp:{code}:meta  → decision definition (created once by creator)
  //   grp:{code}:p:{name} → individual participant results (one key per person)
  // Reading: list all keys with prefix grp:{code}:p: to aggregate.

  const genCode = () => secureCode(6);
  const safeName = (n) => String(n || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().substring(0, 30) || "User";

  const createGroup = async (decisionData, results, userName, expiryHours) => {
    const code = genCode();
    const name = safeName(userName) || "Creator";
    const meta = {
      decision: { name: decisionData.name, type: decisionData.type, criteria: decisionData.criteria,
        ...(decisionData.type === "binary" ? { binaryOption1: decisionData.binaryOption1, binaryOption2: decisionData.binaryOption2 } : { options: decisionData.options, baseOption: decisionData.baseOption }) },
      created: Date.now(), maxParticipants: 8, expiresAt: Date.now() + (expiryHours || 24) * 3600000, hideIndividual: groupHideIndiv,
    };
    try {
      await window.storage.set("grp:" + code + ":meta", JSON.stringify(meta));
      await window.storage.set("grp:" + code + ":p:" + name, JSON.stringify({ name, results, timestamp: Date.now() }));
    } catch (e) { return null; }
    return code;
  };

  const joinGroup = async (code) => {
    try {
      const r = await window.storage.get("grp:" + code.toUpperCase() + ":meta");
      if (r && r.value) {
        const meta = JSON.parse(r.value);
        if (meta.expiresAt && Date.now() > meta.expiresAt) return { ...meta, expired: true, participantCount: 0 };
        const keys = await window.storage.list("grp:" + code.toUpperCase() + ":p:");
        const count = keys && keys.keys ? keys.keys.length : 0;
        return { ...meta, participantCount: count, hideIndividual: meta.hideIndividual || false };
      }
    } catch (e) {}
    return null;
  };

  const cancelGroup = async (code) => {
    try {
      await window.storage.delete("grp:" + code + ":meta");
      const keys = await window.storage.list("grp:" + code + ":p:");
      if (keys && keys.keys) { for (const k of keys.keys) await window.storage.delete(k); }
      return true;
    } catch (e) { return false; }
  };

  const submitToGroup = async (code, userName, results) => {
    try {
      const sName = safeName(userName);
      const keys = await window.storage.list("grp:" + code + ":p:");
      const count = keys && keys.keys ? keys.keys.length : 0;
      if (count >= 8) return false;
      try {
        await window.storage.get("grp:" + code + ":p:" + sName);
        return false;
      } catch (e) { /* key doesn't exist = good */ }
      const safeResults = results.map(r => ({ name: r.name, score: r.score, pct: r.pct }));
      await window.storage.set("grp:" + code + ":p:" + sName, JSON.stringify({ name: sName, results: safeResults, timestamp: Date.now() }));
      return true;
    } catch (e) { return false; }
  };

  // Prevent double-click on save
  const savingRef = useRef(false);

  const loadGroupResults = async (code) => {
    try {
      const metaR = await window.storage.get("grp:" + code + ":meta");
      if (!metaR || !metaR.value) return null;
      const meta = JSON.parse(metaR.value);
      const participants = [];
      try {
        const keys = await window.storage.list("grp:" + code + ":p:");
        if (keys && keys.keys && keys.keys.length > 0) {
          for (const key of keys.keys) {
            try {
              const pr = await window.storage.get(key);
              if (pr && pr.value) participants.push(JSON.parse(pr.value));
            } catch (e) { /* skip */ }
          }
        }
      } catch(listErr) { /* no participants yet — still return meta */ }
      return { ...meta, participants, code };
    } catch (e) {}
    return null;
  };


  const prevStep = useRef([]);
  const goStep = (s) => { prevStep.current.push(step); setStep(s); };
  const goBack = () => {
    if (prevStep.current.length > 0) {
      setStep(prevStep.current.pop());
    } else {
      setScreen("home");
    }
  };

  const resetFull = (p = null) => {
    setDName(p?.name || ""); setDType(p?.type || null);
    setOpts(p?.options || []); setNewOpt("");
    setCrits(p?.criteria || []); setNewCrit(""); setNewImp(null);
    setBo1(p?.binaryOption1 || ""); setBo2(p?.binaryOption2 || "");
    setBIdx(0); setBCh([]); setBPick(null);
    setBaseOpt(p?.baseOption || null); setMIdx(0); setMCo([]); setMPairs([]);
    setRes(null); setSavedId(null); setBlocked(false);
    if (p?.groupCode) setGroupCode(p.groupCode);
    // Note: groupCode and qvCode are NOT cleared here — they persist until
    // the user explicitly ends/cancels that session from results or home screen
    setRewardTick(0);
    prevStep.current = [];
    setResultsGutDone(false); setResultsGroupCreated(false);
    setCommitDone(false);
    setCommitChecked(false);
  };

  const scoreBin = () => {
    if (crits.length === 0) return [{ name: bo1, score: 0, pct: 50 }, { name: bo2, score: 0, pct: 50 }];
    const maxBase = crits.reduce((sum, cr) => sum + cr.importance * 3, 0);
    let sa = maxBase, sb = maxBase;
    bCh.forEach((c) => {
      const cr = crits.find((x) => x.id === c.cId);
      if (!cr) return;
      const w = cr.importance * c.adv;
      if (c.opt === 1) { sa += w; sb -= w; }
      else if (c.opt === 2) { sb += w; sa -= w; }
    });
    sa = Math.max(0, sa); sb = Math.max(0, sb);
    const t = sa + sb || 1;
    let pa = pct(sa, t), pb = pct(sb, t);
    // Ensure minimum 5% — a total shutout feels wrong and discourages trust
    if (pa > 0 && pa < 5) { pa = 5; pb = 95; }
    if (pb > 0 && pb < 5) { pb = 5; pa = 95; }
    if (pa === 0 && pb > 0) { pa = 3; pb = 97; }
    if (pb === 0 && pa > 0) { pb = 3; pa = 97; }
    return [{ name: bo1, score: sa, pct: pa }, { name: bo2, score: sb, pct: pb }];
  };

  const scoreMul = () => {
    if (crits.length === 0 || opts.length === 0) return opts.map((o) => ({ name: o.name, score: 0, pct: Math.round(100 / (opts.length || 1)) }));
    const maxBase = crits.reduce((sum, cr) => sum + cr.importance * 3, 0);
    const scores = {}; opts.forEach((o) => (scores[o.id] = maxBase));
    mCo.forEach((mc) => { const cr = crits.find((x) => x.id === mc.cId); if (!cr) return; scores[mc.oId] += cr.importance * mc.adv; });
    opts.forEach((o) => (scores[o.id] = Math.max(0, scores[o.id])));
    const t = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    let results = opts.map((o) => ({ name: o.name, score: scores[o.id], pct: pct(scores[o.id], t) })).sort((a, b) => b.pct - a.pct);
    results = results.map((r) => ({ ...r, pct: Math.max(2, r.pct) }));
    const pctTotal = results.reduce((s, r) => s + r.pct, 0);
    if (pctTotal !== 100 && results.length > 0) { results[0].pct -= (pctTotal - 100); }
    return results;
  };

  const addCrit = () => {
    if (newCrit.trim() && newImp !== null) {
      if (isBlockedContent(newCrit)) { setBlocked(true); return false; }
      const cid = uid();
      setCrits((p) => [...p, { id: cid, name: newCrit.trim(), importance: newImp }]);
      setNewCrit(""); setNewImp(null); setRewardTick((t) => t + 1);
      setAddFlash("criteria"); setTimeout(() => setAddFlash(null), 800);
      setLastAddedCrit(cid); setTimeout(() => setLastAddedCrit(null), 1500);
      return true;
    }
    return false;
  };

  const goFromCrits = (pendingCount = 0) => {
    if (crits.length + pendingCount === 0) return;
    if (newCrit.trim() !== "" && newImp === null && pendingCount === 0) return;
    if (isGroupMode) { goStep("groupsetup"); return; }
    if (dType === "binary") { setBIdx(0); setBCh([]); setBPick(null); goStep("compare"); }
    else goStep("base");
  };

  // ─── GLOBAL STYLES for touch feedback ───
  const touchStyle = `
    .ustk-touch { transition: background 0.15s ease, transform 0.1s ease; }
    .ustk-touch:active { background: ${C.sageSoft} !important; transform: scale(0.97); }
    @keyframes ustk-sel-flash {
      0% { box-shadow: 0 0 0 0 ${C.sage}40; }
      50% { box-shadow: 0 0 12px 4px ${C.sage}25; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    .ustk-sel-active { animation: ustk-sel-flash 0.4s ease-out; }
    @keyframes ustk-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.9; }
    }
  `;

  // ─── ONBOARDING ───
  const onboardPages = [
    { title: "Think carefully, faster", body: "Unstuk gives your thinking real structure: clear options, weighted criteria, honest comparison, clear result. Research by Hammond, Keeney & Raiffa (Harvard Business Review) shows that structured decision-making consistently outperforms intuition alone — especially under pressure. In under two minutes, Unstuk makes it happen." },
    { title: "A proven framework — you're in charge", body: "Unstuk uses Multi-Criteria Decision Analysis (MCDA) — the same method used by McKinsey, the WHO, and government policy teams worldwide. You define the options, set the criteria, weight what matters, and compare honestly. Every call is yours. Unstuk holds the framework so nothing gets missed." },
    { title: "Reflect, learn, sharpen your edge", body: "Tetlock's Superforecasting research found that people who systematically review their decisions improve accuracy by 20–50% within a year. After each decision, capture your instinct. Reflect three days later. Over time, you'll see exactly when structured thinking was right — and get sharper every time." },
  ];

  // ─── QUICK VOTE / PULSE SURVEY (renders above all other screens) ───
  // ─── QUICK VOTE: CREATE ───
  if (screen === "qv_create") {
      const validOpts = qvOptions.filter(o => o.trim()).length;
      const canCreate = qvQuestion.trim() && validOpts >= 2;
      return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 40px" }}>
        <div style={{ width: "100%", maxWidth: 480, padding: "24px 20px 0" }}>
          <BackBtn onClick={() => setScreen("home")} />
          <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 6px" }}>Quick Poll — Get thinking, get unstuk</p>
          <H size="md" style={{ margin: "0 0 20px" }}>Ask your team</H>
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 16px", marginBottom: 12 }}>
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", fontWeight: 600 }}>Question</p>
            <TxtIn value={qvQuestion} onChange={setQvQuestion} placeholder="e.g. Which vendor should we shortlist?" maxLen={100} autoFocus={false} />
            <div style={{ marginTop: 10 }}>
              <ChipPicker storageKey="qv-name" usedNames={qvQuestion ? [qvQuestion] : []} onPick={(name) => { setQvQuestion(name); setTimeout(() => { const el = document.getElementById("qvopt-0"); if (el) { el.focus(); el.style.borderColor = C.accent; el.style.boxShadow = `0 0 0 3px ${C.accent}25`; setTimeout(() => { el.style.borderColor = C.border; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }, 1800); } }, 150); }} aiContext={{ dName: "quick poll question", opts: [], crits: [], typed: qvQuestion, decisionType: "qv" }} collapsed={!!qvQuestion.trim()} />
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 16px", marginBottom: 12 }}>
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", fontWeight: 600 }}>Options</p>
            {qvOptions.map((opt, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${opt.trim() ? C.sage : C.border}`, background: opt.trim() ? C.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                  <span style={{ fontFamily: F.b, fontSize: 10, color: opt.trim() ? "#fff" : C.muted, fontWeight: 700 }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <TxtIn value={opt} onChange={(v) => { const n = [...qvOptions]; n[i] = v; setQvOptions(n); }} autoFocus={false} placeholder={i < 2 ? "Required" : "Optional"} maxLen={30} inputId={`qvopt-${i}`} />
                </div>
                {i >= 2 && <button onClick={() => setQvOptions(qvOptions.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: C.error, fontSize: 16, lineHeight: 1, padding: "4px", opacity: 0.6 }}>×</button>}
              </div>
            ))}
            {qvOptions.length < 6 && (
              <button onClick={() => setQvOptions([...qvOptions, ""])} style={{ fontFamily: F.b, fontSize: 11, color: C.sage, background: "none", border: `1px dashed ${C.sage}60`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", marginTop: 4, width: "100%" }}>+ Add option</button>
            )}
            <div style={{ marginTop: 12 }}>
              <ChipPicker storageKey="qv-opt" usedNames={qvOptions.filter(Boolean)} onPick={(name) => {
                const emptyIdx = qvOptions.findIndex(o => !o.trim());
                if (emptyIdx !== -1) { const n = [...qvOptions]; n[emptyIdx] = name; setQvOptions(n); }
                else if (qvOptions.length < 6) setQvOptions([...qvOptions, name]);
              }} aiContext={{ dName: qvQuestion || "poll options", opts: qvOptions.filter(Boolean).map(o => ({name: o})), crits: [], typed: qvOptions.find(o => o && !o.trim()) || qvOptions[qvOptions.length - 1] || "", decisionType: "qv" }} focusNext={`qvopt-${qvOptions.findIndex(o => !o.trim()) !== -1 ? qvOptions.findIndex(o => !o.trim()) : qvOptions.length}`} />
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 16px", marginBottom: 12 }}>
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", fontWeight: 600 }}>Settings</p>
            <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "0 0 8px" }}>Time limit</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[{ label: "None", v: 0 }, { label: "1h", v: 1 }, { label: "4h", v: 4 }, { label: "24h", v: 24 }, { label: "3d", v: 72 }].map(t => (
                <button key={t.v} onClick={() => setQvExpiry(t.v)} style={{ fontFamily: F.b, fontSize: 11, padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${qvExpiry === t.v ? C.sage : C.border}`, background: qvExpiry === t.v ? C.sage : "transparent", color: qvExpiry === t.v ? "#fff" : C.text, cursor: "pointer", transition: "all 0.15s", fontWeight: qvExpiry === t.v ? 600 : 400 }}>{t.label}</button>
              ))}
            </div>
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.taupe, margin: "14px 0 0", fontStyle: "italic" }}>Your poll will be ready to share instantly</p>
          </div>
          <Btn onClick={() => createQuickVote()} disabled={!canCreate} style={{ width: "100%", fontSize: 14, padding: "15px 20px" }}>
            {canCreate ? "Create & Share Poll →" : "Add 2 options to create"}
          </Btn>
        </div>
      </div>
      );
    }

    if (screen === "qv_share") {
      const expiryLabel = qvExpiry === 0 ? "No time limit" : qvExpiry < 1 ? `${Math.round(qvExpiry * 60)} mins` : qvExpiry <= 1 ? "1 hour" : qvExpiry <= 24 ? `${qvExpiry} hours` : `${Math.round(qvExpiry / 24)} days`;
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u2705"}</div>
              <H size="md">Vote Created</H>
              <Sub>Share this with anyone — they can vote instantly</Sub>
              <div style={{ margin: "20px 0", padding: "18px 24px", background: C.taupeSoft, borderRadius: 12, border: `1px solid ${C.taupe}20` }}>
                <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: "0 0 6px", fontWeight: 500 }}>{qvQuestion}</p>
                <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: 0 }}>{qvOptions.filter(Boolean).length} options · {qvExpiry > 0 ? expiryLabel : "No time limit"}</p>
              </div>
              {qvExpiry > 0 && <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "8px 0" }}>Closes in {expiryLabel}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Btn v="sage" onClick={() => {
                  const text = `\uD83D\uDCA1 Quick Poll: ${qvQuestion}\n\nOptions:\n${qvOptions.filter(Boolean).map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nVote here: https://unstuk.app?poll=${qvCode}`;
                  setShareSheetData({ text, title: "Share Quick Poll" });
                }} style={{ flex: 1 }}>Share vote</Btn>
                <Btn onClick={async () => {
                  const data = await loadQuickVoteResults(qvCode);
                  if (data) { setQvResults(data); setTimeout(() => setScreen("qv_results"), 0); }
                }} style={{ flex: 1 }}>See results</Btn>
              </div>
              <button onClick={() => { setScreen("home"); setQvQuestion(""); setQvOptions(["", ""]); }} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", marginTop: 16 }}>Done</button>
            </div>
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── QUICK VOTE: JOIN/VOTE ───
  if (screen === "qv_vote") {
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <BackBtn onClick={() => { setScreen("home"); setQvResults(null); setQvVoted(null); setQvErr(null); }} />
            {!qvResults ? (
              <>
                <H size="md">Join a Quick Poll</H>
                <Sub>Enter the code you were given</Sub>
                <div style={{ marginTop: 16 }}>
                  <TxtIn value={qvJoinCode} onChange={(v) => { setQvJoinCode(v.toUpperCase()); setQvErr(null); }} placeholder="6-letter code" maxLen={6} />
                </div>
                {qvErr && <p style={{ fontFamily: F.b, fontSize: 11, color: C.error, margin: "8px 0 0" }}>{qvErr}</p>}
                <div style={{ marginTop: 14 }}>
                  <Btn onClick={async () => {
                    const data = await joinQuickVote(qvJoinCode);
                  if (data) { setIsParticipant(true); try { await window.storage.set("unstuk_active_qvCode", qvJoinCode); } catch(e) {} }
                    if (data) { setQvResults(data); }
                  }} disabled={qvJoinCode.length < 6} style={{ width: "100%", padding: "14px 28px", fontSize: 14 }}>Join</Btn>
                </div>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "14px 0 0", textAlign: "center", lineHeight: 1.5 }}>You can only see and vote on this question. No other content is accessible.</p>
              </>
            ) : qvVoted === null ? (
              <>
                <H size="md">{qvResults.question}</H>
                <Sub>Tap your choice</Sub>
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {qvResults.options.map((opt, i) => (
                    <button key={i} onClick={() => submitQuickVote(qvJoinCode || qvCode, i)} className="ustk-touch"
                      style={{ fontFamily: F.b, fontSize: 14, padding: "16px 20px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { e.target.style.borderColor = C.sage; e.target.style.background = C.sageSoft; }}
                      onMouseLeave={(e) => { e.target.style.borderColor = C.border; e.target.style.background = C.card; }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <H size="md">Results</H>
                <Sub>{qvResults.question}</Sub>
                <div style={{ marginTop: 16 }}>
                  {qvResults.options.map((opt, i) => {
                    const total = Object.keys(qvResults.votes).length;
                    const count = Object.values(qvResults.votes).filter(v => v === i).length;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isWinner = pct === Math.max(...qvResults.options.map((_, j) => { const c2 = Object.values(qvResults.votes).filter(v => v === j).length; return total > 0 ? Math.round((c2 / total) * 100) : 0; }));
                    const isYours = i === qvVoted;
                    return (
                      <div key={i} style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 10, border: `1.5px solid ${isYours ? C.sage : C.border}40`, background: isYours ? C.sageSoft : C.card }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: isWinner ? 600 : 400 }}>{opt}{isYours ? " (you)" : ""}</span>
                          <span style={{ fontFamily: F.b, fontSize: 13, color: isWinner ? C.sage : C.muted, fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", background: isWinner ? C.sage : C.taupe, borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "4px 0 0" }}>{count} vote{count !== 1 ? "s" : ""}</p>
                      </div>
                    );
                  })}
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, textAlign: "center", margin: "8px 0 0" }}>{Object.keys(qvResults.votes).length} total vote{Object.keys(qvResults.votes).length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <Btn v="sage" onClick={async () => {
                    const data = await loadQuickVoteResults(qvJoinCode || qvCode);
                    if (data) setQvResults(data);
                  }} style={{ flex: 1 }}>Refresh</Btn>
                  <Btn onClick={() => { setIsParticipant(false); setScreen("home"); setQvResults(null); setQvVoted(null); setQvJoinCode(""); setQvQuestion(""); setQvOptions(["", ""]); }} style={{ flex: 1 }}>Done</Btn>
                </div>
              </>
            )}
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── QUICK VOTE: RESULTS ───
  if (screen === "qv_results" && qvResults) {
      const total = Object.keys(qvResults.votes).length;
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <H size="md">Vote Results</H>
            <Sub>{qvResults.question}</Sub>
            <div style={{ marginTop: 16 }}>
              {qvResults.options.map((opt, i) => {
                const count = Object.values(qvResults.votes).filter(v => v === i).length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isWinner = pct === Math.max(...qvResults.options.map((_, j) => { const c2 = Object.values(qvResults.votes).filter(v => v === j).length; return total > 0 ? Math.round((c2 / total) * 100) : 0; }));
                return (
                  <div key={i} style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 10, border: `1.5px solid ${isWinner ? C.sage : C.border}40`, background: isWinner ? C.sageSoft : C.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: isWinner ? 600 : 400 }}>{opt}</span>
                      <span style={{ fontFamily: F.b, fontSize: 13, color: isWinner ? C.sage : C.muted, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: isWinner ? C.sage : C.taupe, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                    <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "4px 0 0" }}>{count} vote{count !== 1 ? "s" : ""}</p>
                  </div>
                );
              })}
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, textAlign: "center", margin: "8px 0 0" }}>{total} total vote{total !== 1 ? "s" : ""}</p>
            </div>
            <Lbl style={{ marginTop: 8 }}>Analytics</Lbl>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 100, padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: C.sage }}>{total}</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>Total votes</div>
              </div>
              {(() => { const winIdx = qvResults.options.reduce((wi, _, i) => { const cnt = Object.values(qvResults.votes).filter(v => v === i).length; return cnt > Object.values(qvResults.votes).filter(v => v === wi).length ? i : wi; }, 0); const winPct = total > 0 ? Math.round((Object.values(qvResults.votes).filter(v => v === winIdx).length / total) * 100) : 0; const wLabel = qvResults.options[winIdx]; return (
                <div style={{ flex: 2, minWidth: 140, padding: "12px 14px", borderRadius: 10, background: C.sageSoft, border: `1px solid ${C.sage}30` }}>
                  <div style={{ fontFamily: F.d, fontSize: 18, fontWeight: 700, color: C.sage, lineHeight: 1.2 }}>{wLabel.length > 18 ? wLabel.slice(0,17)+"…" : wLabel}</div>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.sage, marginTop: 2 }}>{total > 0 ? `Leading at ${winPct}%` : "No votes yet"}</div>
                </div>
              ); })()}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn v="secondary" onClick={async () => {
                const data = await loadQuickVoteResults(qvResults.code || qvCode);
                if (data) setQvResults(data);
              }} style={{ flex: 1 }}>Refresh</Btn>
              <Btn v="sage" onClick={() => {
                const total = Object.keys(qvResults.votes).length;
                const lines = qvResults.options.map((opt, i) => {
                  const count = Object.values(qvResults.votes).filter(v => v === i).length;
                  const p = total > 0 ? Math.round((count / total) * 100) : 0;
                  return `${opt}: ${p}% (${count} vote${count !== 1 ? "s" : ""})`;
                }).join("\n");
                setShareSheetData({ text: `Quick Poll: ${qvResults.question}\n\n${lines}\n\n${total} total vote${total !== 1 ? "s" : ""}\n\nGet thinking, get unstuk \u2014 unstuk.app`, title: "Share Poll Results" });
              }} style={{ flex: 1 }}>Share results</Btn>
              <Btn onClick={() => { setScreen("home"); setQvResults(null); setQvCode(null); try { window.storage.delete("unstuk_active_qvCode"); } catch(e) {} setQvQuestion(""); setQvOptions(["", ""]); }} style={{ flex: 1 }}>Done</Btn>
            </div>
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  if (!seenOnboard) {
    const pg = onboardPages[onboardPage];
    const isLast = onboardPage === onboardPages.length - 1;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <FadeIn key={onboardPage}>
            <Dots current={onboardPage} total={onboardPages.length} />
            <Card style={{ marginTop: 20 }}>
              <H size="md">{pg.title}</H>
              <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>{pg.body}</p>
            </Card>
          </FadeIn>
          <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
            {onboardPage > 0 && <Btn v="secondary" onClick={() => setOnboardPage(onboardPage - 1)}>Back</Btn>}
            <Btn onClick={() => {
              if (isLast) {
                setSeenOnboard(true);
                try { window.storage.set("unstuk_onboarded", "1"); } catch (e) {}
              } else {
                setOnboardPage(onboardPage + 1);
              }
            }} style={{ minWidth: 100 }}>{isLast ? "Get started" : "Next"}</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ─── HOME ───
  // Participants should never see the home screen
  if (screen === "home" && isParticipant) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, padding: 32, textAlign: "center" }}>
          <p style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 12 }}>You're participating in a decision</p>
          <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>Return to your comparison to finish scoring, then submit your results.</p>
          <Btn onClick={() => setScreen("flow")}>Return to comparison</Btn>
        </div>
      </div>
    );
  }

  if (screen === "home") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <style>{touchStyle}</style>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              {/* ── The Opening ── */}
              <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none" style={{ marginBottom: 10, opacity: 0.3 }}>
                <path d="M 476 248 A 272 272 0 1 0 548 248" stroke={C.accent} strokeWidth="16" fill="none" strokeLinecap="round" />
                <circle cx="512" cy="240" r="14" fill={C.sage} />
              </svg>
              <div style={{ fontFamily: F.d, fontSize: 42, fontWeight: 600, color: C.text, letterSpacing: "-0.01em", marginBottom: 10 }}>Unstuk</div>
              <p style={{ fontFamily: F.d, fontSize: 20, color: C.sage, fontWeight: 500, letterSpacing: "0.01em", margin: "0 0 8px", fontStyle: "italic" }}>
                Think carefully, faster.
              </p>
              <p style={{ fontFamily: F.b, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.7 }}>
                Get thinking. Get unstuk.
              </p>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.taupe, fontWeight: 400, lineHeight: 1.6, margin: "10px 0 0" }}>
                Built for executives, managers, boards, teams and committees — structured thinking for the decisions that matter.
              </p>
            </div>
          </FadeIn>

          {/* What's new — dismissible */}
          {!seenWhatsNew && (
            <FadeIn delay={100}>
              <div style={{ background: C.card, border: `1px solid ${C.sage}20`, borderRadius: 12, padding: "16px 18px", marginBottom: 24, position: "relative" }}>
                <button onClick={() => { setSeenWhatsNew(true); try { window.storage.set("unstuk_whatsnew_v2", "1"); } catch(e) {} }}
                  style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", cursor: "pointer", fontFamily: F.b, fontSize: 14, color: C.border, lineHeight: 1 }}>{"\u00D7"}</button>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontWeight: 600 }}>What's new</p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.6, margin: "0 0 6px" }}>
                  <strong>Think to get unstuk.</strong> Weighted criteria, honest comparison, structured analysis — your thinking made fast. In under two minutes.
                </p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.6, margin: "0 0 6px" }}>
                  <strong>Quick Poll.</strong> Ask a question. Share a code. Get instant results. Your team's thinking, collected fast.
                </p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.6, margin: "0 0 6px" }}>
                  <strong>Team Decisions.</strong> Everyone thinks through the same options independently. See where the team aligns — and where it doesn't.
                </p>
                <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                  The more you think through it, the faster you get unstuk.
                </p>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={150}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* ── Pillar 1: Individual Decision ── */}
              <Btn onClick={() => {
                resetFull(); setIsGroupMode(false); setStep("name"); setScreen("flow"); trackEvent("start");
              }} style={{ width: "100%", padding: "16px 28px", fontSize: 15 }}>New Decision</Btn>

              {/* ── Pillar 2: Team Decision ── */}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="sage" onClick={() => {
                  resetFull(); setIsGroupMode(true); setStep("name"); setScreen("flow"); trackEvent("start_group");
                }} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>
                  {"\uD83D\uDC65"} Team Decision
                </Btn>
                <Btn v="sage" onClick={() => setScreen("joingroup")} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>Join with Code</Btn>
              </div>

              {/* ── Pillar 3: Quick Poll ── */}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="secondary" onClick={() => { setQvQuestion(""); setQvOptions(["", ""]); setQvExpiry(0); setQvRequireCode(false); setScreen("qv_create"); trackEvent("qv_start"); }} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>
                  {"\u26A1"} Quick Poll
                </Btn>
                <Btn v="secondary" onClick={() => { setScreen("qv_vote"); }} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>
                  Join Vote
                </Btn>
              </div>

              {/* Team Decision Results — always shown, enabled only when active */}
              <Btn v={groupCode ? "sage" : "secondary"}
                onClick={async () => {
                  // If state lost (e.g. after reload), try restoring from storage
                  let activeCode = groupCode;
                  if (!activeCode) {
                    try { const s = await window.storage.get("unstuk_active_groupCode"); if (s?.value) { activeCode = s.value; setGroupCode(s.value); } } catch(e) {}
                  }
                  if (!activeCode) return;
                  const data = await loadGroupResults(activeCode);
                  if (data) { setGroupData(data); setScreen("groupresults"); }
                  else setScreen("groupcreated");
                }}
                style={{ width: "100%", padding: "13px 12px", fontSize: 13, opacity: groupCode ? 1 : 0.6 }}>
                👥 {groupCode ? "View Team Decision Results" : "Team Decision Results"}
              </Btn>
              {/* Quick Poll Results — always shown, enabled only when active */}
              <Btn v={qvCode ? "secondary" : "secondary"}
                onClick={async () => {
                  if (qvLoading) return;
                  setQvLoading(true);
                  // If state lost (e.g. after reload), try restoring from storage
                  let activeCode = qvCode;
                  if (!activeCode) {
                    try { const s = await window.storage.get("unstuk_active_qvCode"); if (s?.value) { activeCode = s.value; setQvCode(s.value); } } catch(e) {}
                  }
                  if (!activeCode) { setQvLoading(false); return; }
                  const data = await loadQuickVoteResults(activeCode);
                  setQvLoading(false);
                  if (data) { setQvResults(data); setTimeout(() => setScreen("qv_results"), 0); }
                  else { setQvCode(null); try { window.storage.delete("unstuk_active_qvCode"); } catch(e) {} }
                }}
                style={{ width: "100%", padding: "13px 12px", fontSize: 13, opacity: qvCode ? 1 : 0.6 }}>
                {qvLoading ? "Loading…" : qvCode ? "⚡ View Quick Poll Results" : "⚡ Quick Poll Results"}
              </Btn>

              {history.length > 0 && (() => {
                const now = Date.now();
                const readyToReflect = history.filter(d => !d.reflection && (now - d.timestamp) > 3 * 86400000);
                const reflected = history.filter(d => d.reflection);
                return (
                  <div style={{ background: C.sageSoft, borderRadius: 12, border: `1px solid ${C.sage}25`, padding: "14px 16px", marginTop: 4 }}>
                    {/* Growth checkpoint alert - integrated */}
                    {readyToReflect.length > 0 && (
                      <button onClick={() => { const d = readyToReflect[0]; setReflectId(d.id); setReflectStep(0); setReflectAnswers({}); setScreen("reflect"); trackEvent("reflect"); }}
                        style={{ width: "100%", background: C.card, border: `1px solid ${C.taupe}30`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "left", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontFamily: F.b, fontSize: 11, fontWeight: 600, color: C.taupe }}>{readyToReflect.length} growth checkpoint{readyToReflect.length === 1 ? "" : "s"} ready</div>
                          <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 1 }}>"{readyToReflect[0].name}" — 30 sec</div>
                        </div>
                        <span style={{ fontFamily: F.b, fontSize: 12, color: C.sage, fontWeight: 600 }}>Reflect ›</span>
                      </button>
                    )}
                    {/* History & Growth buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                      <Btn v="sage" onClick={() => setScreen("history")} style={{ flex: 1, padding: "15px 16px", fontSize: 14 }}>History</Btn>
                      <Btn v="sage" onClick={() => setScreen("growth")} style={{ flex: 1, padding: "15px 16px", fontSize: 14 }}>
                        Growth{reflected.length > 0 ? ` (${reflected.length})` : ""}
                      </Btn>
                    </div>
                  </div>
                );
              })()}
            </div>

          </FadeIn>

          {/* Weekly decision time */}
          {weeklyDay === null && !showSchedule && history.length >= 2 && (
            <FadeIn delay={200}>
              <button onClick={() => setShowSchedule(true)} style={{ background: "none", border: "none", cursor: "pointer", marginTop: 16, padding: 0, display: "block", width: "100%" }}>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, textAlign: "center" }}>Set a weekly decision time {"›"}</p>
              </button>
            </FadeIn>
          )}
          {weeklyDay === null && showSchedule && (
            <FadeIn delay={100}>
              <Card style={{ marginTop: 20, padding: "18px 20px" }}>
                <H size="sm">Your weekly decision time</H>
                <Sub style={{ marginBottom: 10 }}>Pick a regular time. Consistency builds the habit.</Sub>
                <div style={{ marginBottom: 12 }}>
                  <Lbl>Day</Lbl>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <button key={d} onClick={() => setTempDay(i)} className="ustk-touch"
                        style={{ fontFamily: F.b, fontSize: 11, padding: "8px 12px", borderRadius: 20, border: tempDay === i ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: tempDay === i ? C.sageSoft : "#fff", color: tempDay === i ? C.sage : C.text, cursor: "pointer", transition: "all 0.15s", fontWeight: tempDay === i ? 600 : 400 }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Lbl>Time of day</Lbl>
                  <div style={{ display: "flex", gap: 10 }}>
                    {["Morning", "Afternoon", "Evening"].map((t) => (
                      <button key={t} onClick={() => setTempTime(t)} className="ustk-touch"
                        style={{ fontFamily: F.b, fontSize: 11, padding: "10px 14px", borderRadius: 20, border: tempTime === t ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: tempTime === t ? C.sageSoft : "#fff", color: tempTime === t ? C.sage : C.text, cursor: "pointer", flex: 1, transition: "all 0.15s", fontWeight: tempTime === t ? 600 : 400 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <Lbl>Weekly goal</Lbl>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[1, 2, 3].map((n) => (
                      <button key={n} onClick={() => setTempGoal(n)} className="ustk-touch"
                        style={{ fontFamily: F.b, fontSize: 11, padding: "10px 14px", borderRadius: 20, border: tempGoal === n ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: tempGoal === n ? C.sageSoft : "#fff", color: tempGoal === n ? C.sage : C.text, cursor: "pointer", flex: 1, transition: "all 0.15s", fontWeight: tempGoal === n ? 600 : 400 }}>
                        {n} decision{n > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => {
                    setWeeklyDay(tempDay); setWeeklyTime(tempTime); setWeeklyGoal(tempGoal);
                    try { window.storage.set("unstuk_weekly", JSON.stringify({ day: tempDay, time: tempTime, goal: tempGoal })); } catch(e) {}
                    trackEvent("weekly_set", { day: tempDay });
                    setShowSchedule(false);
                  }} style={{ flex: 1 }}>Set schedule</Btn>
                  <Btn v="ghost" onClick={() => setShowSchedule(false)}>Cancel</Btn>
                </div>
              </Card>
            </FadeIn>
          )}
          {weeklyDay !== null && (() => {
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const todayNum = new Date().getDay();
            const isDecisionDay = todayNum === weeklyDay;
            const wkStart = new Date(); wkStart.setDate(wkStart.getDate() - ((wkStart.getDay() + 6) % 7)); wkStart.setHours(0, 0, 0, 0);
            const thisWeekCount = history.filter((d) => d.timestamp >= wkStart.getTime()).length;
            const goalMet = thisWeekCount >= weeklyGoal;
            return (
              <FadeIn delay={200}>
                <div style={{ background: isDecisionDay ? C.sageSoft : C.card, border: `1px solid ${isDecisionDay ? C.sage + "30" : C.border}`, borderRadius: 12, padding: "14px 18px", marginTop: 20 }}>
                  {isDecisionDay && !goalMet ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text }}>{"\u2728"} Decision time — {thisWeekCount}/{weeklyGoal} this week</div>
                          <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>{dayNames[weeklyDay]} {weeklyTime.toLowerCase()}</div>
                        </div>
                        <Btn v="sage" onClick={() => { resetFull(); setStep("name"); setScreen("flow"); }} style={{ padding: "8px 14px", fontSize: 11, flexShrink: 0 }}>Go</Btn>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontFamily: F.b, fontSize: 11, color: goalMet ? C.sage : C.muted, fontWeight: 500 }}>
                          {goalMet ? "\u2713 Goal met — " + thisWeekCount + " this week" : thisWeekCount + "/" + weeklyGoal + " decisions this week"}
                        </div>
                        <div style={{ fontFamily: F.b, fontSize: 10, color: C.border, marginTop: 2 }}>Next: {dayNames[weeklyDay]} {weeklyTime.toLowerCase()}</div>
                      </div>
                      <button onClick={() => { setTempDay(weeklyDay); setTempTime(weeklyTime); setTempGoal(weeklyGoal); setWeeklyDay(null); setShowSchedule(true); }}
                        style={{ fontFamily: F.b, fontSize: 9, color: C.sage, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", opacity: 0.6 }}>edit</button>
                    </div>
                  )}
                </div>
              </FadeIn>
            );
          })()}


          {/* Reflection nudge and growth link now integrated into History/Growth section above */}

          <FadeIn delay={300}>
            <button onClick={() => {
              setShareSheetData({ text: "I\u2019ve been using Unstuk to make better decisions \u2014 and I think you\u2019d find it useful too.\n\nIt structures your thinking with weighted criteria so you can cut through the noise and decide with confidence. Takes about 2 minutes.\n\nTry it free: https://unstuk.app", title: "Gift Unstuk to a friend" });
            }} style={{
              width: "100%", marginTop: 36, padding: "16px 18px", borderRadius: 12,
              background: `linear-gradient(135deg, ${C.sageSoft}, ${C.card})`,
              border: `1px solid ${C.sage}25`, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{"\uD83C\uDF81"}</span>
              <div>
                <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Gift Unstuk to a friend</div>
                <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>Know someone stuck? Share the app free — get them thinking, get them unstuk.</div>
              </div>
              <span style={{ fontFamily: F.b, fontSize: 18, color: C.sage, flexShrink: 0 }}>{"›"}</span>
            </button>
          </FadeIn>

          {/* ── Upgrade / Pro ── */}
          <FadeIn delay={380}>
            <button onClick={() => setScreen("upgrade")} style={{
              width: "100%", marginTop: 10, padding: "14px 18px", borderRadius: 12,
              background: `linear-gradient(135deg, ${C.sageSoft}, #fff)`, border: `1px solid ${C.sage}25`, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{"\u2728"}</span>
              <div>
                <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text }}>Upgrade to Pro — $30/mo</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, lineHeight: 1.4 }}>Unlimited decisions after your 10 free of each type</div>
              </div>
              <span style={{ fontFamily: F.b, fontSize: 18, color: C.sage, flexShrink: 0 }}>{"›"}</span>
            </button>
          </FadeIn>

          {/* ── Footer links ── */}
          <FadeIn delay={400}>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 14 }}>
              <button onClick={() => { setTutSlide(0); setScreen("tutorial"); }} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.02em" }}>How it works</button>
              <span style={{ color: C.border, fontSize: 10 }}>·</span>
              <button onClick={() => setScreen("privacy")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.02em" }}>Privacy</button>
              <span style={{ color: C.border, fontSize: 10 }}>·</span>
              <button onClick={() => setScreen("legal")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.02em" }}>Terms & Legal</button>
            </div>
          </FadeIn>
        </div>
        {showShare && <ShareSheet text={"Get thinking, get unstuk \u2014 I\u2019ve been using Unstuk for business decisions. Weighted analysis in 2 minutes, team alignment built in. Your thinking, structured.\n\nTry it free: unstuk.app"} title="Share Unstuk" onClose={() => setShowShare(false)} />}
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── PRIVACY POLICY ───
  if (screen === "privacy") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <FadeIn>
            <BackBtn onClick={() => setScreen("home")} />
            <H size="lg">Privacy Policy</H>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginBottom: 24 }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

            <Card style={{ padding: "24px 20px", marginBottom: 16 }}>
              <div style={{ fontFamily: F.b, fontSize: 14, color: C.text, lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>1. Local-Only Data Storage</p>
                <p style={{ margin: "0 0 18px" }}>All your decision data is stored locally on your device using localStorage. Your decisions, reflections, and preferences never leave your device unless you explicitly choose to share them.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>2. No Personal Data Collection</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk does not collect, store, or transmit personal data to third parties. We do not require account creation, email addresses, or any personally identifiable information.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>3. AI-Powered Suggestions</p>
                <p style={{ margin: "0 0 18px" }}>When AI suggestions are generated, queries are processed via API. However, no user data is retained by the AI service after processing. Queries are not used for training or stored in any identifiable form.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>4. Payment Processing</p>
                <p style={{ margin: "0 0 18px" }}>All payment processing is handled entirely by Stripe, a PCI DSS Level 1 certified payment processor. Unstuk never sees, stores, or has access to your full payment card details.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>5. Data Deletion</p>
                <p style={{ margin: "0 0 18px" }}>You can delete all your data at any time from the History screen. Uninstalling the app removes all locally stored data. Decision history is automatically purged after 60 days.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>6. No Tracking Cookies</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk does not use cookies for tracking purposes. Minimal analytics are stored locally on your device and are never transmitted externally.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>7. GDPR & CCPA Compliance</p>
                <p style={{ margin: "0 0 18px" }}>Our local-first architecture is designed to comply with GDPR and CCPA principles. Since we do not collect or process personal data on external servers, your data rights are inherently protected. You maintain full control over your data at all times.</p>

                <p style={{ margin: "0 0 8px", fontWeight: 600, color: C.sage }}>8. Contact</p>
                <p style={{ margin: 0 }}>For privacy-related enquiries, contact us at <span style={{ color: C.sage }}>privacy@unstuk.app</span></p>
              </div>
            </Card>

            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "12px 16px", display: "block", margin: "0 auto" }}>Back to home</button>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── TERMS & LEGAL ───
  if (screen === "legal") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <FadeIn>
            <BackBtn onClick={() => setScreen("home")} />
            <H size="lg">Terms & Legal</H>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginBottom: 24 }}>Please read carefully before using Unstuk.</p>

            <Card style={{ padding: "24px 20px", marginBottom: 16 }}>
              <div style={{ fontFamily: F.b, fontSize: 14, color: C.text, lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>1. Acceptable Use</p>
                <p style={{ margin: "0 0 18px" }}>You will use Unstuk solely for lawful, personal or business decision-making purposes. You will not use Unstuk to plan, facilitate, or evaluate any activity that is illegal, harmful, violent, abusive, discriminatory, or that may cause harm to any person, animal, property, or entity. Prohibited uses include decisions involving violence, criminal activity, harassment, exploitation, self-harm, abuse, fraud, or any activity that violates applicable law. We reserve the right to implement content filtering to enforce these terms. Violation may result in termination of access.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>2. Decision-Support Tool Only</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk is a decision-support tool designed to help structure your thinking. It does not provide professional advice of any kind. All outputs are informational aids, not recommendations.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>3. Not Professional Advice</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk is not a substitute for legal, financial, medical, psychological, or any other form of professional advice. If your decision requires professional expertise, consult a qualified professional in the relevant field.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>4. No Guarantee of Outcomes</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk does not guarantee any particular outcome. All decisions and their consequences remain entirely the responsibility of the user. Past results or analyses do not predict future outcomes.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>5. Limitation of Liability</p>
                <p style={{ margin: "0 0 18px" }}>To the maximum extent permitted by applicable law, Unstuk and its creators accept no liability for any business losses, damages, or adverse outcomes arising from decisions made using this tool. This includes, without limitation, loss of revenue, profit, anticipated savings, business opportunity, goodwill, or data.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>6. Service Provided "As Is"</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk is provided "as is" and "as available" without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, accuracy, or non-infringement.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>7. User Due Diligence</p>
                <p style={{ margin: "0 0 18px" }}>Users are responsible for conducting their own due diligence before acting on any analysis produced by Unstuk. You should independently verify any information and consider all relevant factors before making important decisions.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>8. Indemnification</p>
                <p style={{ margin: "0 0 18px" }}>By using Unstuk, you agree to indemnify and hold harmless its creators, developers, and distributors from any and all claims, liabilities, damages, costs, and expenses (including legal fees) arising from or in connection with your use of this application or any decisions made based on its outputs.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>9. Intellectual Property</p>
                <p style={{ margin: "0 0 18px" }}>Unstuk, its name, design, and methodology are the property of their respective owners. You may not copy, modify, distribute, reverse-engineer, or create derivative works without prior written consent.</p>

                <p style={{ margin: "0 0 14px", fontWeight: 600, color: C.sage }}>10. Governing Law</p>
                <p style={{ margin: "0 0 18px" }}>These terms are governed by applicable law in your jurisdiction. We may update these terms at any time. Continued use constitutes acceptance of any changes. Any disputes shall be subject to the exclusive jurisdiction of the courts in that jurisdiction.</p>

                <p style={{ margin: 0, color: C.muted, fontSize: 11 }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · © {new Date().getFullYear()} Unstuk.</p>
              </div>
            </Card>

            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "12px 16px", display: "block", margin: "0 auto" }}>Back to home</button>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── TUTORIAL ───
  if (screen === "tutorial") {
    const slides = [
      { icon: "\u270F\uFE0F", title: "Name your decision", body: "Getting unstuk starts with one thing: thinking clearly. Start by naming what you're actually deciding.\n\n\"CRM platform choice\" works better than \"software stuff\". Clarity now means speed later." },
      { icon: "\u2696\uFE0F", title: "Choose your type", body: "Binary is for two options. Multi is for three or more.\n\nMost real decisions are binary \u2014 even if it doesn't feel that way at first. Naming the real choice is half the work." },
      { icon: "\uD83C\uDFAF", title: "Add what matters", body: "Criteria are the things that genuinely matter in this decision. Salary, location, growth, risk \u2014 whatever is real for you.\n\nRate each one honestly: Low, Moderate, or High. This is where your thinking does its work." },
      { icon: "\uD83D\uDD0D", title: "Compare, one factor at a time", body: "For each criterion, you compare your options head to head.\n\nInstead of holding everything at once, you focus on one thing at a time. This is thinking at its most effective \u2014 and it's what gets you unstuk fast." },
      { icon: "\uD83D\uDCCA", title: "See your result", body: "Unstuk multiplies your comparisons by your importance ratings, then normalises into percentages.\n\nA clear gap means your thinking agrees with itself. A close call means both options are genuinely viable \u2014 that's useful too. You decide." },
      { icon: "\u2728", title: "Get thinking. Get unstuk.", body: "Every decision you complete is saved locally for 60 days.\n\nNo account. No cloud. No one sees your thinking.\n\nTap below to start \u2014 and get unstuk." },
    ];
    const sl = slides[tutSlide];
    const isLast = tutSlide === slides.length - 1;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px", textAlign: "center", userSelect: "none" }}>
          <FadeIn key={tutSlide}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>{sl.icon}</div>
            <H size="lg">{sl.title}</H>
            <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.8, margin: "16px 0 32px", whiteSpace: "pre-line" }}>{sl.body}</p>
          </FadeIn>

          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
            {slides.map((_, i) => (
              <div key={i} style={{ width: i === tutSlide ? 18 : 6, height: 6, borderRadius: 3, background: i === tutSlide ? C.sage : C.border, transition: "all 0.3s" }} />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isLast ? (
              <>
                <Btn onClick={() => {
                  setTutSlide(0);
                  resetFull(); setStep("name"); setScreen("flow");
                }}>Start a decision</Btn>
                <Btn v="secondary" onClick={() => { setTutSlide(0); setScreen("home"); }}>Back to home</Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => setTutSlide(tutSlide + 1)}>Next</Btn>
                {tutSlide > 0 && <Btn v="secondary" onClick={() => setTutSlide(tutSlide - 1)}>Back</Btn>}
                {tutSlide === 0 && <Btn v="secondary" onClick={() => { setTutSlide(0); setScreen("home"); }}>Back to home</Btn>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  
  
  
  
  // ─── JOIN GROUP ───
  if (screen === "joingroup") {
    const doJoin = async () => {
      if (joinCode.length !== 6 || !joinNameInput.trim()) return;
      setGroupName(joinNameInput.trim());
      const data = await joinGroup(joinCode);
      if (!data) { setJoinErr("Code not found. Check and try again."); return; }
      if (data.expired) { setJoinErr("This group has closed. The time limit has passed."); return; }
      if (data.participantCount >= (data.maxParticipants || 8)) { setJoinErr("This group is full (max 8 participants)."); return; }
      setGroupData(data); setGroupCode(joinCode); setJoinErr(null); setScreen("groupjoin"); trackEvent("group_join");
      try { await window.storage.set("unstuk_active_groupCode", joinCode); } catch(e) {}
    };
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => { setJoinErr(null); setScreen("home"); }} />
          <FadeIn>
            <H size="lg">Join a team decision</H>
            <Sub>Someone shared a code with you? Enter it below. You'll compare the same options independently, then see how everyone scored.</Sub>
            <Lbl>Your name</Lbl>
            <TxtIn value={joinNameInput} onChange={setJoinNameInput} placeholder="How others will see you" maxLen={20} onSubmit={() => {}} />
            <div style={{ marginTop: 16 }}>
              <Lbl>Decision code</Lbl>
              <TxtIn value={joinCode} onChange={(v) => { setJoinCode(v.toUpperCase()); setJoinErr(null); }} placeholder="e.g. A3K9XP" maxLen={6} onSubmit={doJoin} />
            </div>
            {joinErr && <p style={{ fontFamily: F.b, fontSize: 12, color: C.error, marginTop: 8 }}>{joinErr}</p>}
            <div style={{ marginTop: 20 }}>
              <Btn onClick={doJoin} disabled={joinCode.length !== 6 || !joinNameInput.trim()}>Join</Btn>
            </div>
            <div style={{ marginTop: 32, padding: "16px 18px", background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, lineHeight: 1.6, margin: 0 }}>
                {"\uD83D\uDC65"} Up to 8 people can join. Everyone compares the same options using the same criteria. You'll see how each person scored, plus the group average.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── GROUP JOIN (preview decision then start comparisons) ───
  if (screen === "groupjoin" && groupData) {
    const d = groupData.decision;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("joingroup")} />
          <FadeIn>
            <Lbl>Team Decision</Lbl>
            <H size="lg">{d.name}</H>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "8px 0 20px" }}>
              {groupData.participantCount || 0} participant{(groupData.participantCount || 0) === 1 ? "" : "s"} so far · Code: {groupCode}
            </p>
            <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
              <Lbl>Options</Lbl>
              {d.type === "binary" ? (
                <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: 0 }}>{d.binaryOption1} vs {d.binaryOption2}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {d.options.map((o, i) => <p key={i} style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: 0 }}>{i + 1}. {o.name}</p>)}
                </div>
              )}
            </Card>
            <Card style={{ padding: "16px 18px", marginBottom: 24 }}>
              <Lbl>Criteria ({d.criteria.length})</Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {d.criteria.map((c) => (
                  <span key={c.id} style={{ fontFamily: F.b, fontSize: 12, padding: "4px 10px", borderRadius: 6, background: C.accentLt, color: C.text }}>{c.name}</span>
                ))}
              </div>
            </Card>
            <Btn onClick={() => {
              // Load the group decision into the flow
              setDName(d.name); setDType(d.type); setCrits(d.criteria);
              if (d.type === "binary") { setBo1(d.binaryOption1); setBo2(d.binaryOption2); setBIdx(0); setBCh([]); setBPick(null); }
              else { setOpts(d.options); setBaseOpt(d.baseOption);
                const pairs = []; d.options.filter((x) => x.id !== d.baseOption).forEach((op) => { d.criteria.forEach((cr) => { pairs.push({ oId: op.id, cId: cr.id }); }); });
                setMPairs(pairs); setMIdx(0); setMCo([]);
              }
              setRes(null); setSavedId(null); prevStep.current = [];
              setIsParticipant(true);
              setStep("compare"); setScreen("flow");
            }} style={{ width: "100%" }}>Start my comparisons</Btn>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── GROUP CREATED (show code to share) ───
  if (screen === "groupcreated" && groupCode) {
    const expiryLabel = groupExpiry < 1 ? `${Math.round(groupExpiry * 60)} mins` : groupExpiry <= 1 ? "1 hour" : groupExpiry <= 24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry / 24)} days`;
    const shareMsg = `Get thinking, get unstuk \u2014 Join our team decision on Unstuk!\n\nCode: ${groupCode}\n\nTap to join: https://unstuk.app?join=${groupCode}\n\nDeadline: ${expiryLabel}`;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <FadeIn>
            <div style={{ textAlign: "left", marginBottom: 10 }}><BackBtn onClick={() => { setIsGroupMode(false); setScreen("home"); }} /></div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{"\uD83D\uDC65"}</div>
            <H size="lg">Group created</H>
            <Sub>Share the invite and others can weigh in on the same decision independently. You'll see all scores side by side.</Sub>

            {/* Code display */}
            {groupRequireCode && (
              <div style={{ background: C.card, borderRadius: 12, border: `2px solid ${C.sage}40`, padding: "24px 20px", marginBottom: 16, marginTop: 20, cursor: "pointer" }}
                onClick={() => copyToClipboard(groupCode, setGroupCopied)}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Team code — tap to copy</p>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 36, fontWeight: 700, color: groupCopied ? C.sage : C.text, letterSpacing: "0.15em", transition: "color 0.2s" }}>{groupCode}</div>
                <p style={{ fontFamily: F.b, fontSize: 11, color: groupCopied ? C.sage : C.border, margin: "8px 0 0", transition: "color 0.2s" }}>{groupCopied ? "✓ Copied!" : `Closes in ${expiryLabel}`}</p>
              </div>
            )}
            {!groupRequireCode && (
              <div style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 16, marginTop: 20 }}>
                <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.6 }}>Closes in <strong>{expiryLabel}</strong>. The invite message contains everything participants need.</p>
              </div>
            )}

            {/* How to share */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 16, textAlign: "left" }}>
              <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 10px" }}>Group settings</p>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "0 0 6px" }}>Time limit for responses:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {[{ label: "15 mins", val: 0.25 }, { label: "30 mins", val: 0.5 }, { label: "1 hour", val: 1 }, { label: "6 hours", val: 6 }, { label: "24 hours", val: 24 }, { label: "3 days", val: 72 }, { label: "1 week", val: 168 }].map((t) => (
                  <button key={t.val} onClick={async () => {
                    const newVal = groupExpiry === t.val ? null : t.val;
                    setGroupExpiry(newVal);
                    if (!newVal) return;
                    try { const meta = await window.storage.get("grp:" + groupCode + ":meta");
                      if (meta) { const d = JSON.parse(meta.value); d.expiresAt = Date.now() + newVal * 3600000; await window.storage.set("grp:" + groupCode + ":meta", JSON.stringify(d)); }
                    } catch(e) {}
                  }}
                    style={{
                      fontFamily: F.b, fontSize: 11, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${groupExpiry === t.val ? C.sage : C.border}`,
                      background: groupExpiry === t.val ? C.sageSoft : "#fff",
                      color: groupExpiry === t.val ? C.sage : C.text,
                      fontWeight: groupExpiry === t.val ? 600 : 400,
                      transition: "all 0.2s",
                    }}>{t.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={async () => {
                  setGroupHideIndiv(h => {
                    const nv = !h;
                    (async () => { try { const meta = await window.storage.get("grp:" + groupCode + ":meta");
                      if (meta) { const d = JSON.parse(meta.value); d.hideIndividual = nv; await window.storage.set("grp:" + groupCode + ":meta", JSON.stringify(d)); }
                    } catch(e) {} })();
                    return nv;
                  });
                }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                  background: groupHideIndiv ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2,
                    left: groupHideIndiv ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Hide individual scores (group average only)</span>
              </div>
            </div>


            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="sage" onClick={() => setShareSheetData({ text: shareMsg, title: "Invite to Team Decision" })} style={{ flex: 1 }}>
                Share invite
              </Btn>
            </div>
            <div style={{ marginTop: 10 }}>
              <Btn v="secondary" onClick={async () => { const data = await loadGroupResults(groupCode); if (data) { setGroupData(data); setScreen("groupresults"); } }} style={{ width: "100%" }}>
                View group results
              </Btn>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
              <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Done</button>
              <button onClick={async () => {
                await cancelGroup(groupCode); setGroupCode(null); setScreen("home");
              }} style={{ fontFamily: F.b, fontSize: 12, color: C.error, background: "none", border: "none", cursor: "pointer" }}>Cancel group</button>
            </div>
          </FadeIn>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── GROUP RESULTS ───
  if (screen === "groupresults" && !groupData) { return (<div style={{minHeight:"100vh",background:C.bg,fontFamily:F.b}}><div style={{maxWidth:440,margin:"0 auto",padding:"36px 24px"}}><BackBtn onClick={() => setScreen("home")} /><p style={{fontFamily:F.b,fontSize:13,color:C.muted}}>Results not available. The session may have expired.</p></div></div>); }
  if (screen === "groupresults" && groupData) {
    const d = groupData.decision;
    const parts = groupData.participants;
    const activeCode = groupData.code || groupCode;
    const optNames = d.type === "binary" ? [d.binaryOption1, d.binaryOption2] : d.options.map((o) => o.name);

    // Compute group average
    const avgScores = {};
    optNames.forEach((name) => {
      const scores = parts.filter(p => p.results && Array.isArray(p.results)).map((p) => { const r = p.results.find((x) => x.name === name); return r ? r.pct : 0; });
      avgScores[name] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    });
    const sortedAvg = Object.entries(avgScores).sort((a, b) => b[1] - a[1]);

    // Agreement score: how close are all participants
    const maxSpread = optNames.reduce((max, name) => {
      const scores = parts.filter(p => p.results && Array.isArray(p.results)).map((p) => { const r = p.results.find((x) => x.name === name); return r ? r.pct : 0; });
      const spread = Math.max(...scores) - Math.min(...scores);
      return Math.max(max, spread);
    }, 0);
    const agreement = Math.max(0, 100 - maxSpread);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, opacity: 0.75, transition: "opacity 0.15s", padding: "4px 0" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.75}>
              <span style={{ fontSize: 15 }}>‹</span> Home
            </button>
            <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.5 }}>Team Results</span>
          </div>
          <FadeIn>
            <Lbl>Team Decision · {parts.length} participant{parts.length === 1 ? "" : "s"}</Lbl>
            <H size="lg">{d.name}</H>
            <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "6px 0 4px" }}>Code: {groupCode}</p>

            {/* Agreement indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 24px", padding: "12px 16px", borderRadius: 8, background: agreement >= 70 ? C.sageSoft : agreement >= 40 ? C.taupeSoft : C.errorSoft, border: `1px solid ${agreement >= 70 ? C.sage : agreement >= 40 ? C.taupe : C.error}20` }}>
              <div style={{ fontFamily: F.d, fontSize: 24, fontWeight: 700, color: agreement >= 70 ? C.sage : agreement >= 40 ? C.taupe : C.error }}>{agreement}%</div>
              <div style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>
                {agreement >= 70 ? "Strong alignment — the group largely agrees." : agreement >= 40 ? "Partial agreement — some differences in priorities." : "Low alignment — the group sees this differently."}
              </div>
            </div>

            {/* Group average results */}
            <Lbl>Group Average</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {sortedAvg.map(([name, avg], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: i === 0 ? C.sageSoft : C.card, border: `1px solid ${i === 0 ? C.sage + "30" : C.border}` }}>
                  <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: i === 0 ? C.sage : C.text, minWidth: 44, textAlign: "right" }}>{avg}%</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 500, color: C.text }}>{name}</div>
                    <div style={{ height: 4, borderRadius: 2, background: C.accentLt, overflow: "hidden", marginTop: 4 }}>
                      <div style={{ height: "100%", width: `${Math.max(avg, 4)}%`, borderRadius: 2, background: i === 0 ? C.sage : C.muted }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Individual scores */}
            {!(groupData && groupData.hideIndividual) && <Lbl>Individual Scores</Lbl>}
            {!(groupData && groupData.hideIndividual) ? <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {parts.map((p) => {
                if (!p.results || !Array.isArray(p.results)) return null;
                const sorted = [...p.results].sort((a, b) => b.pct - a.pct);
                return (
                  <Card key={p.name} style={{ padding: "14px 16px" }}>
                    <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{p.name}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sorted.map((r) => (
                        <span key={r.name} style={{ fontFamily: F.b, fontSize: 11, padding: "3px 8px", borderRadius: 4, background: r === sorted[0] ? C.sageSoft : C.bg, color: r === sorted[0] ? C.sage : C.muted, border: `1px solid ${r === sorted[0] ? C.sage + "30" : C.border}` }}>
                          {r.name} {r.pct}%
                        </span>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div> : <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "0 0 24px", textAlign: "center" }}>Individual scores are hidden for this group.</p>}

            {/* Analytics */}
            <Lbl style={{ marginTop: 8 }}>Analytics</Lbl>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: C.sage }}>{parts.filter(p => p.results && Array.isArray(p.results)).length}</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>Responses submitted</div>
              </div>
              <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: agreement >= 70 ? C.sage : agreement >= 40 ? C.taupe : C.error }}>{agreement}%</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>Team alignment</div>
              </div>
              {sortedAvg[0] && (
                <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10, background: C.sageSoft, border: `1px solid ${C.sage}30` }}>
                  <div style={{ fontFamily: F.d, fontSize: 18, fontWeight: 700, color: C.sage, lineHeight: 1.2 }}>{sortedAvg[0][0].length > 14 ? sortedAvg[0][0].slice(0,13)+"…" : sortedAvg[0][0]}</div>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.sage, marginTop: 2 }}>Leading option ({sortedAvg[0][1]}%)</div>
                </div>
              )}
            </div>
            {/* Refresh and share */}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="secondary" onClick={async (e) => {
                const btn = e.currentTarget; btn.textContent = "Refreshing…"; btn.disabled = true;
                try {
                  const data = await loadGroupResults(activeCode);
                  if (data) { setGroupData(data); btn.textContent = "✓ Refreshed"; }
                  else { btn.textContent = "No new data"; }
                } catch(err) { btn.textContent = "Retry"; }
                btn.disabled = false;
                setTimeout(() => { try { btn.textContent = "Refresh"; } catch(e) {} }, 2000);
              }} style={{ flex: 1 }}>Refresh</Btn>
              <Btn v="sage" onClick={() => { const text = `Team Decision: ${d.name}\n\n${sortedAvg.map(([n, a]) => `${n}: ${a}%`).join("\n")}\n\n${parts.length} participant${parts.length !== 1 ? "s" : ""} · ${agreement}% alignment\n\nunstuk.app`; setShareSheetData({ text, title: "Share Team Results" }); }} style={{ flex: 1 }}>Share results</Btn>
            </div>
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", marginTop: 16, padding: "8px 0", letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.5, transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              <span style={{ fontSize: 13 }}>⌂</span> Home
            </button>
          </FadeIn>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }


  // ─── HISTORY ───
  if (screen === "history") {
    const now = Date.now();
    const reflected = history.filter((d) => d.reflection);
    const readyToReflect = history.filter((d) => !d.reflection && (now - d.timestamp) > 3 * 86400000);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("home")} />
          <H size="lg">Decision History</H>
          <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: "8px 0 12px" }}>Tap any decision below to see full results and actions.</p>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 6px" }}>What you can do:</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "0 0 4px", lineHeight: 1.7 }}><strong style={{ color: C.sage }}>Edit & redo</strong> — Go back and change options or criteria, then re-run the comparison from scratch.</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "0 0 4px", lineHeight: 1.7 }}><strong style={{ color: C.sage }}>Re-compare</strong> — Same setup, but redo all comparisons with fresh eyes.</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.7 }}><strong style={{ color: C.error }}>Delete</strong> — Permanently removes this decision. Cannot be undone.</p>
          </div>
          {history.length > 0 && (
            <button onClick={() => {
              const exp = { decisions: history.map((d) => ({ name: d.name, type: d.type, date: new Date(d.timestamp).toISOString().slice(0, 10),
                results: d.results?.map((r) => ({ option: r.name, score: r.pct + "%" })),
                criteria: d.criteria?.map((cr) => ({ name: cr.name, importance: cr.importance === 3 ? "High" : cr.importance === 2 ? "Moderate" : "Low" })),
                gutFeeling: d.immediate?.feeling || null,
                reflection: d.reflection ? { outcome: d.reflection.outcome, gutAccurate: d.reflection.gutAccurate, lesson: d.reflection.lesson } : null })), analytics: _evtLog.slice(-200), version: APP_VERSION };
              const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "unstuk-decisions.json"; a.click(); URL.revokeObjectURL(url);
            }} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", width: "100%", marginBottom: 20 }}>
              Download my data (JSON)
            </button>
          )}

          {/* Delete all + Analytics */}
          {history.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {!confirmDeleteAll ? (
                <button onClick={() => setConfirmDeleteAll(true)}
                  style={{ fontFamily: F.b, fontSize: 11, color: C.error, background: C.bg, border: `1px solid ${C.error}40`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", flex: 1 }}>
                  Delete all decisions
                </button>
              ) : (
                <div style={{ flex: 1, background: C.errorSoft, border: `1px solid ${C.error}40`, borderRadius: 8, padding: "14px 16px" }}>
                  <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.error, margin: "0 0 6px" }}>Delete all {history.length} decisions?</p>
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.text, margin: "0 0 12px", lineHeight: 1.5 }}>This permanently removes all your decisions, reflections, and instinct tracking data. This cannot be undone.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={async () => {
                      setHistory([]); await saveHistory([]);
                      setConfirmDeleteAll(false); trackEvent("delete_all");
                    }} style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: C.error, color: "#fff", cursor: "pointer", flex: 1 }}>
                      Yes, delete everything
                    </button>
                    <button onClick={() => setConfirmDeleteAll(false)}
                      style={{ fontFamily: F.b, fontSize: 12, padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.text, cursor: "pointer", flex: 1 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => setShowAnalytics(!showAnalytics)}
                style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap" }}>
                {showAnalytics ? "Hide stats" : "Usage stats"}
              </button>
            </div>
          )}

          {/* Analytics panel */}
          {showAnalytics && (
            <FadeIn>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px", fontWeight: 600 }}>Dashboard</p>
                {(() => {
                  const events = _evtLog;
                  const starts = events.filter(e => e.e === "start").length;
                  const completes = events.filter(e => e.e === "complete").length;
                  const reflects = events.filter(e => e.e === "reflect" || e.e === "reflect_done").length;
                  const guts = events.filter(e => e.e === "gut").length;
                  const groups = events.filter(e => e.e === "group" || e.e === "group_join").length;
                  const qvs = events.filter(e => e.e === "quickvote_create" || e.e === "quickvote_vote").length;
                  const completionRate = starts > 0 ? Math.round((completes / starts) * 100) : 0;
                  const reflectRate = completes > 0 ? Math.round((reflects / completes) * 100) : 0;

                  // Decision pattern analysis from history
                  const gutAccurate = history.filter(d => d.reflection && d.reflection.gutAccurate === true).length;
                  const gutTotal = history.filter(d => d.reflection && d.reflection.gutAccurate != null).length;
                  const gutRate = gutTotal > 0 ? Math.round((gutAccurate / gutTotal) * 100) : null;
                  const binaryCount = history.filter(d => d.type === "binary").length;
                  const multiCount = history.filter(d => d.type === "multi").length;
                  const avgCriteria = history.length > 0 ? (history.reduce((s, d) => s + (d.criteria ? d.criteria.length : 0), 0) / history.length).toFixed(1) : 0;

                  // Streak: consecutive days with a decision
                  const daySet = new Set(history.map(d => new Date(d.timestamp).toDateString()));
                  let streak = 0;
                  const today = new Date();
                  for (let i = 0; i < 365; i++) {
                    const dd = new Date(today); dd.setDate(dd.getDate() - i);
                    if (daySet.has(dd.toDateString())) streak++; else break;
                  }

                  // Time of day pattern
                  const hours = history.map(d => new Date(d.timestamp).getHours());
                  const morning = hours.filter(h => h >= 5 && h < 12).length;
                  const afternoon = hours.filter(h => h >= 12 && h < 17).length;
                  const evening = hours.filter(h => h >= 17 || h < 5).length;
                  const peak = morning >= afternoon && morning >= evening ? "Morning" : afternoon >= evening ? "Afternoon" : "Evening";

                  const Bar = ({ pct, good }) => (
                    <div style={{ height: 5, background: C.bg, borderRadius: 3, overflow: "hidden", marginTop: 3 }}>
                      <div style={{ height: "100%", width: Math.min(pct, 100) + "%", background: good ? C.sage : C.taupe, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                  );

                  return (
                    <>
                      {/* Key metrics row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                        {[
                          { n: history.length, label: "Decisions" },
                          { n: reflects, label: "Reflections" },
                          { n: streak, label: streak === 1 ? "Day streak" : "Day streak" },
                        ].map((s, i) => (
                          <div key={i} style={{ textAlign: "center", padding: "12px 6px", background: C.bg, borderRadius: 10 }}>
                            <div style={{ fontFamily: F.d, fontSize: 26, fontWeight: 700, color: C.sage }}>{s.n}</div>
                            <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress bars */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                        {[
                          { label: "Completion rate", value: completionRate, good: completionRate >= 70 },
                          { label: "Reflection rate", value: reflectRate, good: reflectRate >= 40 },
                          ...(gutRate !== null ? [{ label: "Instinct accuracy", value: gutRate, good: gutRate >= 60 }] : []),
                        ].map((r, i) => (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.b, fontSize: 11, marginBottom: 1 }}>
                              <span style={{ color: C.muted }}>{r.label}</span>
                              <span style={{ color: r.good ? C.sage : C.text, fontWeight: 600 }}>{r.value}%</span>
                            </div>
                            <Bar pct={r.value} good={r.good} />
                          </div>
                        ))}
                      </div>

                      {/* Insights */}
                      {history.length >= 2 && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                          <p style={{ fontFamily: F.b, fontSize: 9, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", fontWeight: 600 }}>Insights</p>
                          <div style={{ fontFamily: F.b, fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                            {binaryCount > 0 && multiCount > 0 && <p style={{ margin: "0 0 4px" }}>Split: {binaryCount} binary, {multiCount} multi-option.</p>}
                            <p style={{ margin: "0 0 4px" }}>Average criteria: {avgCriteria} per decision.</p>
                            {history.length >= 3 && <p style={{ margin: "0 0 4px" }}>You tend to decide in the {peak.toLowerCase()}.</p>}
                            {gutRate !== null && gutRate >= 70 && <p style={{ margin: "0 0 4px", color: C.sage }}>Your gut is well-calibrated ({gutRate}% match with data).</p>}
                            {gutRate !== null && gutRate < 50 && gutRate > 0 && <p style={{ margin: "0 0 4px", color: C.accent }}>Instinct and analysis often disagree ({gutRate}% match). The analysis may catch things instinct misses.</p>}
                            {(() => {
                              const reflectedH = history.filter(d => d.reflection);
                              const betterCount = reflectedH.filter(d => d.reflection.outcome === "Better than expected").length;
                              if (reflectedH.length >= 3 && betterCount / reflectedH.length >= 0.5) return <p style={{ margin: "0 0 4px", color: C.sage }}>Over half your reflected decisions beat expectations. You're making good calls.</p>;
                              return null;
                            })()}
                            {(() => {
                              const avgOpts = history.length > 0 ? (history.reduce((s, d) => s + (d.options?.length || (d.type === "binary" ? 2 : 0)), 0) / history.length).toFixed(1) : 0;
                              return avgOpts > 0 ? <p style={{ margin: 0 }}>Average options considered: {avgOpts}.</p> : null;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Activity counts */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {[
                          { label: "Instinct surveys", value: guts },
                          { label: "Group decisions", value: groups },
                          { label: "Quick votes", value: qvs },
                          { label: "Events this session", value: events.length },
                        ].map((r, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: F.b, fontSize: 11, padding: "3px 0" }}>
                            <span style={{ color: C.muted }}>{r.label}</span>
                            <span style={{ fontWeight: 500 }}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontFamily: F.b, fontSize: 8, color: C.border, margin: "10px 0 0", lineHeight: 1.5 }}>
                        All data stored locally on your device. Included in JSON export.
                      </p>
                    </>
                  );
                })()}
              </div>
            </FadeIn>
          )}

          {/* Growth summary strip */}
          {reflected.length > 0 && (
            <FadeIn>
              <button onClick={() => setScreen("growth")} style={{ width: "100%", background: C.sageSoft, border: `1px solid ${C.sage}25`, borderRadius: 10, padding: "14px 18px", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.sage }}>Decision Growth</div>
                  <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 2 }}>{reflected.length} reflection{reflected.length === 1 ? "" : "s"} · {reflected.filter(d => d.reflection?.outcome === "Better than expected").length} beat expectations</div>
                </div>
                <span style={{ fontFamily: F.b, fontSize: 16, color: C.sage }}>›</span>
              </button>
            </FadeIn>
          )}

          {readyToReflect.length > 0 && (
            <FadeIn>
              <button onClick={() => { const d = readyToReflect[0]; setReflectId(d.id); setReflectStep(0); setReflectAnswers({}); setScreen("reflect"); trackEvent("reflect"); }}
                style={{ width: "100%", background: C.taupeSoft, border: `1px solid ${C.taupe}25`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.taupe }}>
                  {readyToReflect.length} growth checkpoint{readyToReflect.length === 1 ? "" : "s"} ready
                </div>
                <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 3 }}>Tap to reflect on "{readyToReflect[0].name}" — 30 seconds to sharpen your instinct.</div>
              </button>
            </FadeIn>
          )}

          {history.filter((d) => d && d.name && d.timestamp).length === 0 ? (
            <Card><p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, textAlign: "center", margin: 0 }}>No decisions yet.</p></Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((d) => {
                const days = Math.floor((now - d.timestamp) / 86400000);
                const when = days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
                const w = d.results ? [...d.results].sort((a, b) => b.score - a.score)[0] : null;
                const canReflect = !d.reflection && days >= 3;
                const hasReflection = !!d.reflection;
                const isExpanded = expandedDec === d.id;
                const sortedR = d.results ? [...d.results].sort((a, b) => b.score - a.score) : [];
                return (
                  <Card key={d.id} style={{ padding: "16px 20px", transition: "all 0.2s ease" }}>
                    <button onClick={() => setExpandedDec(isExpanded ? null : d.id)}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F.b, fontSize: 14, fontWeight: 600, color: C.text }}>{d.name}</div>
                        <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 3 }}>
                          {when} · {d.type === "binary" ? "Binary" : `${d.options?.length || 0} options`}{w ? ` · ${w.name} (${w.pct}%)` : ""}
                          {hasReflection && <span style={{ color: C.sage }}> · Reflected</span>}
                          {d.groupCode && <span style={{ color: C.taupe }}> · Group</span>}
                          
                        </div>
                      </div>
                      <span style={{ fontFamily: F.b, fontSize: 14, color: C.border, transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s ease", flexShrink: 0, marginLeft: 8, marginTop: 2 }}>{"\u203A"}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                        {/* Results summary */}
                        {sortedR.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                            {sortedR.map((r, i) => (
                              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ fontFamily: F.d, fontSize: 16, fontWeight: 700, color: i === 0 ? C.sage : C.muted, minWidth: 36, textAlign: "right" }}>{r.pct}%</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: F.b, fontSize: 12, color: C.text, marginBottom: 3 }}>{r.name}</div>
                                  <div style={{ height: 3, borderRadius: 2, background: C.accentLt, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.max(r.pct, 4)}%`, borderRadius: 2, background: i === 0 ? C.sage : C.muted }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Criteria summary with importance */}
                        {d.criteria && (
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Criteria ({d.criteria.length})</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {d.criteria.map(c => (
                                <span key={c.id || c.name} style={{ fontFamily: F.b, fontSize: 10, color: c.importance >= 3 ? C.sage : C.muted, background: c.importance >= 3 ? C.sageSoft : C.bg, border: `1px solid ${c.importance >= 3 ? C.sage + "30" : C.border}`, borderRadius: 4, padding: "3px 8px" }}>
                                  {c.name}{c.importance >= 3 ? " ★" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reflection summary if available */}
                        {hasReflection && (
                          <div style={{ background: C.sageSoft, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span style={{ fontFamily: F.b, fontSize: 10, color: C.sage, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reflection</span>
                                <p style={{ fontFamily: F.b, fontSize: 11, color: C.text, margin: "3px 0 0" }}>
                                  Chose: {d.reflection.chose} · {d.reflection.outcome}
                                </p>
                              </div>
                              <span style={{ fontFamily: F.b, fontSize: 18, color: d.reflection.outcome === "Better than expected" ? C.sage : d.reflection.outcome === "Worse than expected" ? C.error : C.muted }}>
                                {d.reflection.outcome === "Better than expected" ? "↑" : d.reflection.outcome === "Worse than expected" ? "↓" : "→"}
                              </span>
                            </div>
                          </div>
                        )}
                        {/* Comparison choices */}
                        {d.comparisons && d.comparisons.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Your comparisons</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {d.comparisons.map((comp, ci) => {
                                const criterion = d.criteria?.find((c) => c.id === comp.cId);
                                const cName = criterion?.name || "?";
                                if (d.type === "binary") {
                                  const picked = comp.opt === 1 ? d.binaryOption1 : comp.opt === 2 ? d.binaryOption2 : null;
                                  const advLabel = comp.adv === 0 ? "Same" : comp.adv === 1 ? "Slight" : comp.adv === 2 ? "Moderate" : "Strong";
                                  return (
                                    <div key={ci} style={{ fontFamily: F.b, fontSize: 11, color: C.text, padding: "4px 0", display: "flex", gap: 6 }}>
                                      <span style={{ color: C.muted, minWidth: 70, flexShrink: 0 }}>{cName}</span>
                                      <span>{picked ? `${picked} (${advLabel})` : "No difference"}</span>
                                    </div>
                                  );
                                } else {
                                  const option = d.options?.find((o) => o.id === comp.oId);
                                  const oName = option?.name || "?";
                                  const advLabel = comp.adv === 0 ? "Same" : comp.adv > 0 ? `+${comp.adv}` : `${comp.adv}`;
                                  return (
                                    <div key={ci} style={{ fontFamily: F.b, fontSize: 11, color: C.text, padding: "4px 0", display: "flex", gap: 6 }}>
                                      <span style={{ color: C.muted, minWidth: 70, flexShrink: 0 }}>{cName}</span>
                                      <span>{oName}: {advLabel}</span>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                        {/* Action row */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <Btn v="secondary" onClick={() => {
                            const p = { name: d.name, type: d.type, criteria: d.criteria, groupCode: d.groupCode };
                            if (d.type === "binary") { p.binaryOption1 = d.binaryOption1; p.binaryOption2 = d.binaryOption2; }
                            else { p.options = d.options; p.baseOption = d.baseOption; }
                            resetFull(p);
                            setStep("name"); setScreen("flow");
                          }} style={{ fontSize: 11, padding: "7px 14px" }}>Edit & redo</Btn>
                          <Btn v="sage" onClick={() => {
                            const p = { name: d.name, type: d.type, criteria: d.criteria, groupCode: d.groupCode };
                            if (d.type === "binary") { p.binaryOption1 = d.binaryOption1; p.binaryOption2 = d.binaryOption2; }
                            else { p.options = d.options; p.baseOption = d.baseOption; }
                            resetFull(p);
                            if (d.type === "multi" && d.baseOption) {
                              const pairs = [];
                              (d.options || []).filter((x) => x.id !== d.baseOption).forEach((op) => {
                                (d.criteria || []).forEach((cr) => { pairs.push({ oId: op.id, cId: cr.id }); });
                              });
                              setMPairs(pairs); setMIdx(0); setMCo([]);
                              setStep("compare"); setScreen("flow");
                            } else if (d.type === "multi") {
                              setStep("base"); setScreen("flow");
                            } else {
                              setStep("compare"); setScreen("flow");
                            }
                          }} style={{ fontSize: 11, padding: "7px 14px" }}>Re-compare</Btn>
                          {canReflect && (
                            <Btn v="sage" onClick={() => { setReflectId(d.id); setReflectStep(0); setReflectAnswers({}); setScreen("reflect"); }} style={{ fontSize: 11, padding: "7px 14px" }}>Reflect</Btn>
                          )}

                          {hasReflection && (
                            <Btn v="ghost" onClick={() => { setReflectId(d.id); setScreen("insight"); }} style={{ fontSize: 11, color: C.sage, padding: "7px 14px" }}>Insight</Btn>
                          )}

                          {d.groupCode && (
                            <Btn v="ghost" onClick={async () => { const data = await loadGroupResults(d.groupCode); if (data) { setGroupData(data); setGroupCode(d.groupCode); setScreen("groupresults"); } }} style={{ fontSize: 11, color: C.taupe, padding: "7px 14px" }}>{"\uD83D\uDC65"} Group</Btn>
                          )}
                          <Btn v="ghost" onClick={(e) => { e.stopPropagation(); const next = history.filter((x) => x.id !== d.id); setHistory(next); saveHistory(next); setExpandedDec(null); }} style={{ fontSize: 11, color: C.error, padding: "7px 14px" }}>Delete</Btn>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  // ─── REFLECT ───
  if (screen === "reflect") {
    const dec = history.find((d) => d.id === reflectId);
    if (!dec) { setScreen("home"); return null; }
    const _rc = history.filter((d) => d.reflection).length;
    if (_rc >= 10 && !unlocked) { trackEvent("paywall"); setScreen("upgrade"); return null; }
    const w = dec.results ? [...dec.results].sort((a, b) => b.score - a.score)[0] : null;
    const daysSince = Math.floor((Date.now() - dec.timestamp) / 86400000);

    const questions = [
      { key: "chose", q: "What did you end up choosing?", hint: dec.results ? `Unstuk suggested: ${w?.name}` : null,
        options: dec.type === "binary"
          ? [dec.binaryOption1, dec.binaryOption2, "Something else entirely"]
          : [...(dec.options || []).map((o) => o.name), "Something else entirely"]
      },
      { key: "outcome", q: "How did it turn out?",
        options: ["Better than expected", "About as expected", "Worse than expected", "Too early to tell"]
      },
      { key: "followedApp", q: "Did you follow Unstuk's suggestion?",
        options: ["Yes", "No, I went with my instinct", "Partly — it influenced me"]
      },
      { key: "lesson", q: "If you could go back, what would you do differently?",
        options: ["Nothing — I'd decide the same way", "I'd weigh different criteria", "I'd consider more options", "I'd decide faster", "I'd get more information first"]
      },
    ];

    const answers = reflectAnswers;
    const q = questions[reflectStep];
    const allDone = reflectStep >= questions.length;

    // Generate insight based on answers — expanded with gut cross-reference
    const generateInsight = () => {
      const a = answers;
      const insights = [];
      const tips = [];
      const imm = dec.immediate?.feeling;

      // Core outcome × followedApp matrix (expanded)
      if (a.outcome === "Better than expected" && a.followedApp === "Yes") {
        insights.push("Your analysis aligned with reality. The criteria you chose captured what actually mattered.");
        if (imm === "confident") tips.push("Your instinct agreed with the analysis and both were right. For decisions like this, you can move faster next time.");
        else if (imm === "uneasy") tips.push("Interesting — you felt uneasy despite good results. Sometimes anxiety is about the process, not the outcome.");
        else tips.push("For similar decisions, you can move faster — your instinct for criteria is good.");
      } else if (a.outcome === "Worse than expected" && a.followedApp === "Yes") {
        insights.push("The analysis pointed one way, but reality went another. There were factors your criteria didn't capture.");
        if (imm === "uneasy") tips.push("Your instinct sensed something the analysis missed. Next time that feeling shows up, pause and ask: what am I not measuring?");
        else if (imm === "confident") tips.push("Confidence plus a bad outcome often means a missing criterion. What surprised you? That's your hidden factor.");
        else tips.push("Next time, ask: what could go wrong that I'm not measuring?");
      } else if (a.outcome === "Better than expected" && a.followedApp === "No, I went with my instinct") {
        insights.push("You overrode the analysis and it worked out. Your intuition picked up on something the structured criteria missed.");
        if (imm === "confident") tips.push("Strong instinct + good outcome = real signal. Consider what what your instinct was responding to — it might deserve to be a criterion.");
        else tips.push("Pay attention to what what your instinct was responding to — it might be a criterion worth adding explicitly next time.");
      } else if (a.outcome === "Worse than expected" && a.followedApp === "No, I went with my instinct") {
        insights.push("Your instinct led you away from the analysis, and the outcome was disappointing. The criteria you set might have been wiser than the feeling in the moment.");
        if (imm === "confident") tips.push("You felt confident going against the analysis, but it didn't work out. Overconfidence in instinct decisions is a common pattern — the analysis exists to challenge exactly this.");
        else tips.push("When instinct and analysis disagree, try adding the instinct as an explicit criterion and re-running the comparison.");
      } else if (a.outcome === "About as expected" && a.followedApp === "Yes") {
        insights.push("The outcome matched your expectations and you followed the analysis. Your mental model of this decision was accurate.");
        tips.push("This kind of predictability means your criteria selection was on point.");
      } else if (a.outcome === "About as expected" && a.followedApp === "No, I went with my instinct") {
        insights.push("You went with your instinct and the outcome was about what you expected. The analysis and your intuition may have been closer than you thought.");
        tips.push("Check if the analysis actually agreed with your gut. If it did, you can trust both channels.");
      } else if (a.outcome === "About as expected" && a.followedApp === "Partly \u2014 it influenced me") {
        insights.push("You blended analysis with intuition and got a predictable result. This balanced approach often produces the most consistent outcomes.");
        tips.push("Blending structured and intuitive thinking is a strength. Keep doing it.");
      } else if (a.outcome === "Better than expected" && a.followedApp === "Partly \u2014 it influenced me") {
        insights.push("You took the analysis as input rather than gospel, and it paid off. The best decisions often combine structure with judgement.");
        tips.push("This approach — analysis as input, not answer — is how experts make decisions.");
      } else if (a.outcome === "Worse than expected" && a.followedApp === "Partly \u2014 it influenced me") {
        insights.push("A mixed approach led to a disappointing result. It's worth asking: did you override the right parts or the wrong parts of the analysis?");
        tips.push("Review which criteria you weighed differently in your head vs in the app. That gap is where the lesson lives.");
      } else {
        insights.push("It's still early — outcomes aren't clear yet. That's OK. Revisit this reflection in a few weeks.");
        tips.push("Bookmark this decision mentally. The real lesson often emerges later.");
      }

      // Lesson-specific additions
      if (a.lesson === "I'd weigh different criteria") {
        insights.push("Recognising that you'd weight things differently is one of the most valuable decision skills. Each reflection sharpens your criteria instinct for next time.");
      } else if (a.lesson === "I'd decide faster") {
        insights.push("Analysis paralysis is real. You've identified that your decision process might be too slow for the stakes involved.");
        tips.push("Set a time limit before you start. Match decision speed to decision importance.");
      } else if (a.lesson === "I'd get more information first") {
        insights.push("Information gaps hurt. But perfect information never exists — the skill is knowing when you have enough.");
        tips.push("Before your next decision, list what you'd need to know and how long it would take. If it's under a day, get it. If it's a week, decide without it.");
      } else if (a.lesson === "I'd consider more options") {
        insights.push("Feeling like you missed an option suggests the framing was too narrow. Good decisions start with good option generation.");
        tips.push("Spend 5 minutes brainstorming options before you commit to comparing them. Often the best choice is one you almost didn't consider.");
      }

      return { insights, tips };
    };

    if (allDone) {
      // Don't save during render — trigger save via effect in insight screen
      // Redirect immediately
      if (screen === "reflect") {
        const { insights, tips } = generateInsight();
        const updatedHistory = history.map((d) =>
          d.id === reflectId ? { ...d, reflection: { ...answers, insights, tips, timestamp: Date.now() } } : d
        );
        // Use setTimeout to avoid setting state during render
        setTimeout(() => {
          setHistory(updatedHistory);
          saveHistory(updatedHistory);
          setScreen("insight"); trackEvent("reflect_done", { outcome: answers.outcome });
        }, 0);
        return (
          <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FadeIn><p style={{ fontFamily: F.b, fontSize: 14, color: C.muted }}>Generating your insight...</p></FadeIn>
          </div>
        );
      }
    }

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => reflectStep > 0 ? setReflectStep(reflectStep - 1) : setScreen("home")} />
          <FadeIn key={reflectStep}>
            <Dots current={reflectStep} total={questions.length} />
            <div style={{ marginBottom: 8 }}>
              {reflectStep === 0 && (
                <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "0 0 8px", lineHeight: 1.5 }}>
                  {"\u2022"} This takes about 30 seconds. Research by Philip Tetlock found that people who systematically review their predictions improve accuracy by 20-50% within a year.
                </p>
              )}
              <p style={{ fontFamily: F.b, fontSize: 9, color: C.sage, fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Growth · Reflection</p>
              <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: 600, margin: 0 }}>{dec.name}</p>
            </div>
            <H size="md">{q.q}</H>
            {q.hint && <p style={{ fontFamily: F.b, fontSize: 11, color: C.sage, margin: "6px 0 0", fontStyle: "italic" }}>{q.hint}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 18 }}>
              {q.options.map((opt, i) => {
                const isFirst = i === 0;
                const isLast = i === q.options.length - 1;
                return (
                  <button key={opt} onClick={() => {
                    setReflectAnswers({ ...answers, [q.key]: opt });
                    setReflectStep(reflectStep + 1);
                  }}
                    className="ustk-touch" style={{
                      fontFamily: F.b, fontSize: 13, padding: "14px 18px", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer",
                      border: `1px solid ${C.border}`, borderTop: isFirst ? `1px solid ${C.border}` : "none",
                      borderRadius: isFirst ? "8px 8px 0 0" : isLast ? "0 0 8px 8px" : "0",
                      background: "#fff", color: C.text,
                    }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── INSIGHT (single decision reflection result) ───
  if (screen === "insight") {
    const dec = history.find((d) => d.id === reflectId);
    if (!dec?.reflection) { setScreen("home"); return null; }
    const r = dec.reflection;
    const w = dec.results ? [...dec.results].sort((a, b) => b.score - a.score)[0] : null;
    const reflected = history.filter((d) => d.reflection);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("home")} />
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.sageSoft, border: `2px solid ${C.sage}30`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>&#9670;</span>
              </div>
              <p style={{ fontFamily: F.b, fontSize: 9, color: C.sage, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>Growth · Insight</p>
              <H size="lg">Insight earned</H>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                You just closed the loop on a real decision. This is how expert-level judgment is built — one reflection at a time.
              </p>
              <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, fontWeight: 500, marginTop: 6 }}>{dec.name}</p>
            </div>

            {/* What happened */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "12px 14px" }}>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Chose</div>
                <div style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: 500 }}>{r.chose}</div>
              </div>
              <div style={{ flex: 1, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "12px 14px" }}>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Outcome</div>
                <div style={{ fontFamily: F.b, fontSize: 13, color: r.outcome === "Better than expected" ? C.sage : r.outcome === "Worse than expected" ? C.error : C.text, fontWeight: 500 }}>{r.outcome}</div>
              </div>
            </div>

            {/* Immediate vs Reflected comparison */}
            {dec.immediate && (
              <FadeIn delay={150}>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Your instinct vs outcome</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{dec.immediate.feeling === "confident" ? "\uD83D\uDFE2" : dec.immediate.feeling === "uncertain" ? "\uD83D\uDFE1" : "\uD83D\uDD34"}</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted }}>Day 0</div>
                      <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text }}>{dec.immediate.feeling.charAt(0).toUpperCase() + dec.immediate.feeling.slice(1)}</div>
                    </div>
                    <div style={{ fontFamily: F.b, fontSize: 18, color: C.border }}>{"\u2192"}</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{r.outcome === "Better than expected" ? "\uD83D\uDFE2" : r.outcome === "Worse than expected" ? "\uD83D\uDD34" : "\uD83D\uDFE1"}</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted }}>Day 3+</div>
                      <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text }}>{r.outcome.split(" ")[0]}</div>
                    </div>
                  </div>
                  {/* Instinct accuracy insight */}
                  {(() => {
                    const gutRight = (dec.immediate.feeling === "confident" && r.outcome === "Better than expected") ||
                      (dec.immediate.feeling === "uneasy" && r.outcome === "Worse than expected");
                    const gutWrong = (dec.immediate.feeling === "confident" && r.outcome === "Worse than expected") ||
                      (dec.immediate.feeling === "uneasy" && r.outcome === "Better than expected");
                    if (gutRight) return <p style={{ fontFamily: F.b, fontSize: 12, color: C.sage, margin: "12px 0 0", textAlign: "center", fontStyle: "italic" }}>Your instinct was right. It picked up on something real.</p>;
                    if (gutWrong) return <p style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, margin: "12px 0 0", textAlign: "center", fontStyle: "italic" }}>Your instinct misread this one. The criteria may have been wiser.</p>;
                    return <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "12px 0 0", textAlign: "center", fontStyle: "italic" }}>Mixed signals — both instinct and outcome were ambiguous here.</p>;
                  })()}
                </div>
              </FadeIn>
            )}

            {/* Insights */}
            {r.insights.map((insight, i) => (
              <FadeIn key={i} delay={200 + i * 150}>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.sage}20`, padding: "16px 18px", marginBottom: 10 }}>
                  <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{insight}</p>
                </div>
              </FadeIn>
            ))}

            {/* Tips */}
            {r.tips.length > 0 && (
              <FadeIn delay={600}>
                <div style={{ background: C.sageSoft, borderRadius: 10, padding: "16px 18px", marginTop: 10, marginBottom: 24 }}>
                  <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontWeight: 600 }}>Next time</p>
                  {r.tips.map((tip, i) => (
                    <p key={i} style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.7, margin: i < r.tips.length - 1 ? "0 0 8px" : 0 }}>{tip}</p>
                  ))}
                </div>
              </FadeIn>
            )}

            {/* Growth progress */}
            <FadeIn delay={800}>
              <div style={{ background: C.sageSoft, borderRadius: 12, padding: "18px 20px", marginTop: 10, border: `1px solid ${C.sage}20` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.sage, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Growth</div>
                  <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: C.sage }}>{reflected.length}</div>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: C.card, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(reflected.length * 10, 100)}%`, borderRadius: 3, background: C.sage, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontFamily: F.b, fontSize: 9, color: C.muted }}>{reflected.length} reflection{reflected.length === 1 ? "" : "s"}</span>
                  <span style={{ fontFamily: F.b, fontSize: 9, color: C.muted }}>{reflected.length >= 10 ? "Expert level" : reflected.length >= 5 ? "Building skill" : reflected.length >= 3 ? "Patterns emerging" : "Keep going"}</span>
                </div>
              </div>
            </FadeIn>

            <div style={{ marginTop: 16 }}>
              <Btn onClick={() => setScreen("growth")} style={{ width: "100%" }}>View my growth</Btn>
              <Btn v="secondary" onClick={() => setScreen("home")} style={{ width: "100%", marginTop: 8 }}>Back to home</Btn>
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── GROWTH ───
  if (screen === "growth") {
    const _rc2 = history.filter((d) => d.reflection).length;
    if (_rc2 >= 10 && !unlocked) { setScreen("upgrade"); return null; }
    // Growth screen renders below
    const reflected = history.filter((d) => d.reflection).sort((a, b) => a.timestamp - b.timestamp);
    const total = reflected.length;
    const followed = reflected.filter((d) => d.reflection.followedApp === "Yes").length;
    const betterThanExpected = reflected.filter((d) => d.reflection.outcome === "Better than expected").length;
    const wouldChangeSomething = reflected.filter((d) => d.reflection.lesson !== "Nothing — I'd decide the same way").length;

    // Instinct accuracy: compare immediate feeling to actual outcome
    const withImmediate = reflected.filter((d) => d.immediate);
    const gutCorrect = withImmediate.filter((d) => {
      const f = d.immediate.feeling;
      const o = d.reflection.outcome;
      return (f === "confident" && o === "Better than expected") || (f === "confident" && o === "About as expected") || (f === "uneasy" && o === "Worse than expected");
    }).length;
    const gutAccuracy = withImmediate.length >= 3 ? Math.round((gutCorrect / withImmediate.length) * 100) : null;

    // Pattern detection — require minimum data to avoid meaningless stats
    const patterns = [];
    if (total >= 3) {
      if (followed / total >= 0.7) patterns.push({ icon: "\u25C6", text: "You tend to follow structured analysis. This correlates with more predictable outcomes.", tone: "sage" });
      else if (followed / total <= 0.3) patterns.push({ icon: "\u2663", text: "You often override the analysis. Your intuition is strong — consider adding instinct as an explicit criterion.", tone: "taupe" });

      if (betterThanExpected / total >= 0.5) patterns.push({ icon: "\u25B2", text: "More than half your decisions exceeded expectations. Your criteria selection is working.", tone: "sage" });
      if (wouldChangeSomething / total >= 0.6) patterns.push({ icon: "\u21BA", text: "You frequently identify room for improvement. This growth mindset is your biggest asset.", tone: "sage" });

      const recentTwo = reflected.slice(-2);
      if (recentTwo.length === 2 && recentTwo[0].reflection.outcome === "Worse than expected" && recentTwo[1].reflection.outcome !== "Worse than expected") {
        patterns.push({ icon: "\u25B4", text: "Your most recent decision went better than the one before. You're learning.", tone: "sage" });
      }
    }

    if (gutAccuracy !== null) {
      if (gutAccuracy >= 70) patterns.push({ icon: "\uD83C\uDFAF", text: `Your instinct has been accurate ${gutAccuracy}% of the time. You read situations well — trust it when the analysis is close.`, tone: "sage" });
      else if (gutAccuracy <= 30) patterns.push({ icon: "\u26A0\uFE0F", text: `Your initial instinct has only matched outcomes ${gutAccuracy}% of the time. The structured analysis may be a better guide for you.`, tone: "taupe" });
      else patterns.push({ icon: "\u25CF", text: `Your instinct accuracy sits at ${gutAccuracy}%. Neither reliable nor unreliable — keep collecting data.`, tone: "muted" });
    }

    if (patterns.length === 0 && total >= 1) {
      patterns.push({ icon: "\u25CF", text: `${total} reflection${total === 1 ? "" : "s"} so far. Patterns emerge after 3 — keep going.`, tone: "muted" });
    }

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen(prevScreenRef.current === "insight" || prevScreenRef.current === "history" ? prevScreenRef.current : "home")} />
          <FadeIn>
            <H size="lg">Your Decision Growth</H>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "8px 0 6px" }}>How your decision-making is evolving — powered by your 3-day reflections.</p>

            {/* Pending reflections CTA */}
            {(() => {
              const now2 = Date.now();
              const pendingReflections = history.filter(d => !d.reflection && (now2 - d.timestamp) > 3 * 86400000);
              if (pendingReflections.length === 0) return null;
              return (
                <div style={{ background: C.taupeSoft, border: `1px solid ${C.taupe}25`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, marginTop: 14 }}>
                  <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.taupe, marginBottom: 6 }}>
                    {pendingReflections.length} reflection{pendingReflections.length === 1 ? "" : "s"} waiting
                  </div>
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
                    Each reflection sharpens your instinct accuracy and builds your decision profile. Takes 30 seconds.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {pendingReflections.slice(0, 3).map(d => (
                      <button key={d.id} onClick={() => { setReflectId(d.id); setReflectStep(0); setReflectAnswers({}); setScreen("reflect"); trackEvent("reflect"); }}
                        className="ustk-touch" style={{ fontFamily: F.b, fontSize: 12, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{d.name}</span>
                        <span style={{ fontFamily: F.b, fontSize: 10, color: C.sage }}>Reflect ›</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Decision Quality Score */}
            {total >= 2 && (() => {
              // Composite score: 40% outcome, 25% instinct accuracy, 20% no-regrets, 15% reflection rate
              const outcomeScore = total > 0 ? (betterThanExpected / total) * 100 : 0;
              const instinctScore = gutAccuracy !== null ? gutAccuracy : 50;
              const regretScore = total > 0 ? ((total - wouldChangeSomething) / total) * 100 : 0;
              const reflectRatio = history.length > 0 ? (total / history.length) * 100 : 0;
              const qualityScore = Math.round(outcomeScore * 0.4 + instinctScore * 0.25 + regretScore * 0.2 + Math.min(reflectRatio, 100) * 0.15);
              const level = qualityScore >= 80 ? "Exceptional" : qualityScore >= 65 ? "Strong" : qualityScore >= 50 ? "Developing" : "Early";
              const levelColor = qualityScore >= 80 ? C.sage : qualityScore >= 65 ? C.sage : qualityScore >= 50 ? C.taupe : C.muted;
              return (
                <FadeIn delay={50}>
                  <div style={{ background: `linear-gradient(135deg, ${C.sageSoft}, ${C.card})`, borderRadius: 12, border: `1px solid ${C.sage}20`, padding: "20px 22px", marginBottom: 16, textAlign: "center" }}>
                    <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Decision Quality Score</div>
                    <div style={{ fontFamily: F.d, fontSize: 44, fontWeight: 700, color: levelColor, lineHeight: 1 }}>{qualityScore}</div>
                    <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: levelColor, marginTop: 4 }}>{level}</div>
                    <div style={{ height: 6, borderRadius: 3, background: C.accentLt, overflow: "hidden", marginTop: 12, maxWidth: 200, margin: "12px auto 0" }}>
                      <div style={{ height: "100%", width: `${qualityScore}%`, borderRadius: 3, background: levelColor, transition: "width 0.8s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, maxWidth: 200, margin: "10px auto 0" }}>
                      {[{ l: "Outcomes", v: Math.round(outcomeScore) }, { l: "Instinct", v: Math.round(instinctScore) }, { l: "No regrets", v: Math.round(regretScore) }].map(s => (
                        <div key={s.l} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: F.d, fontSize: 14, fontWeight: 700, color: C.text }}>{s.v}%</div>
                          <div style={{ fontFamily: F.b, fontSize: 8, color: C.muted }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              );
            })()}

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: gutAccuracy !== null ? 10 : 28 }}>
              {[
                { n: total, label: "Reflected" },
                { n: betterThanExpected, label: "Beat expectations" },
                { n: total - wouldChangeSomething, label: "No regrets" },
              ].map((s, i) => (
                <FadeIn key={i} delay={i * 100}>
                  <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.d, fontSize: 28, fontWeight: 700, color: C.sage }}>{s.n}</div>
                    <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Instinct accuracy trend */}
            {gutAccuracy !== null && (
              <FadeIn delay={350}>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Instinct accuracy</div>
                    <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: gutAccuracy >= 60 ? C.sage : gutAccuracy <= 40 ? C.taupe : C.muted }}>{gutAccuracy}%</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.accentLt, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${gutAccuracy}%`, borderRadius: 3, background: gutAccuracy >= 60 ? C.sage : gutAccuracy <= 40 ? C.taupe : C.muted, transition: "width 0.8s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    {withImmediate.map((d, i) => {
                      const f = d.immediate.feeling;
                      const o = d.reflection.outcome;
                      const match = (f === "confident" && (o === "Better than expected" || o === "About as expected")) || (f === "uneasy" && o === "Worse than expected");
                      return (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: match ? C.sage : C.error + "80" }} title={d.name} />
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Based on {withImmediate.length} decision{withImmediate.length === 1 ? "" : "s"} where you recorded an immediate reaction.
                  </p>
                </div>
              </FadeIn>
            )}

            {/* Patterns */}
            {patterns.length > 0 && (
              <>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Patterns</div>
                {patterns.map((p, i) => (
                  <FadeIn key={i} delay={300 + i * 150}>
                    <div style={{ background: p.tone === "sage" ? C.sageSoft : p.tone === "taupe" ? C.taupeSoft : C.card, borderRadius: 10, border: `1px solid ${p.tone === "sage" ? C.sage : p.tone === "taupe" ? C.taupe : C.border}20`, padding: "14px 16px", marginBottom: 8 }}>
                      <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>
                        <span style={{ marginRight: 8, color: p.tone === "sage" ? C.sage : p.tone === "taupe" ? C.taupe : C.muted }}>{p.icon}</span>
                        {p.text}
                      </p>
                    </div>
                  </FadeIn>
                ))}
              </>
            )}

            {/* ── Insights & Reports ── */}
            {history.length >= 2 && (
              <FadeIn delay={450}>
                <div style={{ marginTop: 28 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Insights & Reports</div>

                  {/* Decision velocity */}
                  {(() => {
                    const sortedH = [...history].sort((a, b) => a.timestamp - b.timestamp);
                    const gaps = [];
                    for (let i = 1; i < sortedH.length; i++) gaps.push((sortedH[i].timestamp - sortedH[i-1].timestamp) / 86400000);
                    const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length * 10) / 10 : null;
                    const recentGap = gaps.length >= 2 ? gaps[gaps.length - 1] : null;
                    const trend = recentGap !== null && avgGap !== null ? (recentGap < avgGap * 0.7 ? "accelerating" : recentGap > avgGap * 1.5 ? "slowing" : "steady") : null;
                    return avgGap !== null ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: 0 }}>Decision velocity</p>
                            <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "3px 0 0" }}>
                              One decision every {avgGap <= 1 ? "day" : `${avgGap} days`} on average
                            </p>
                          </div>
                          <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: trend === "accelerating" ? C.sage : trend === "slowing" ? C.taupe : C.muted }}>
                            {trend === "accelerating" ? "\u2191" : trend === "slowing" ? "\u2193" : "\u2192"}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Criteria analysis */}
                  {(() => {
                    const allCrits = {};
                    history.forEach(d => { if (d.criteria) d.criteria.forEach(c => { allCrits[c.name] = (allCrits[c.name] || 0) + 1; }); });
                    const sorted = Object.entries(allCrits).sort((a, b) => b[1] - a[1]).slice(0, 5);
                    return sorted.length > 0 ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Your top criteria</p>
                        {sorted.map(([name, count], i) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted, width: 16, textAlign: "right" }}>{i + 1}.</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>{name}</div>
                              <div style={{ height: 4, background: C.accentLt, borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
                                <div style={{ height: "100%", width: `${(count / history.length) * 100}%`, background: C.sage, borderRadius: 2 }} />
                              </div>
                            </div>
                            <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted }}>{count}x</span>
                          </div>
                        ))}
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "6px 0 0" }}>These are the things that matter most to you across all your decisions.</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Outcome distribution */}
                  {reflected.length >= 2 && (() => {
                    const outcomes = { "Better than expected": 0, "About as expected": 0, "Worse than expected": 0 };
                    reflected.forEach(d => { if (d.reflection?.outcome && outcomes[d.reflection.outcome] !== undefined) outcomes[d.reflection.outcome]++; });
                    return (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Outcome distribution</p>
                        <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden" }}>
                          {Object.entries(outcomes).map(([label, count]) => {
                            const pct = reflected.length > 0 ? (count / reflected.length) * 100 : 0;
                            const color = label === "Better than expected" ? C.sage : label === "Worse than expected" ? C.error + "80" : C.taupe;
                            return pct > 0 ? (
                              <div key={label} style={{ width: `${pct}%`, background: color, display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.6s ease" }}>
                                {pct >= 20 && <span style={{ fontFamily: F.b, fontSize: 9, color: "#fff", fontWeight: 600 }}>{Math.round(pct)}%</span>}
                              </div>
                            ) : null;
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                          {[{ l: "Better", c: C.sage }, { l: "As expected", c: C.taupe }, { l: "Worse", c: C.error + "80" }].map(({ l, c }) => (
                            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                              <span style={{ fontFamily: F.b, fontSize: 9, color: C.muted }}>{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Analysis vs gut track record */}
                  {reflected.length >= 3 && (() => {
                    const followedData = reflected.filter(d => d.reflection?.followedApp === "Yes");
                    const overrodeData = reflected.filter(d => d.reflection?.followedApp === "No");
                    const followedGood = followedData.filter(d => d.reflection?.outcome !== "Worse than expected").length;
                    const overrodeGood = overrodeData.filter(d => d.reflection?.outcome !== "Worse than expected").length;
                    const fRate = followedData.length > 0 ? Math.round((followedGood / followedData.length) * 100) : null;
                    const oRate = overrodeData.length > 0 ? Math.round((overrodeGood / overrodeData.length) * 100) : null;
                    return fRate !== null || oRate !== null ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Analysis vs instinct: track record</p>
                        <div style={{ display: "flex", gap: 10 }}>
                          {fRate !== null && (
                            <div style={{ flex: 1, background: C.sageSoft, borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
                              <div style={{ fontFamily: F.d, fontSize: 24, fontWeight: 700, color: C.sage }}>{fRate}%</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>good outcomes when following analysis</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.border, marginTop: 2 }}>({followedData.length} decisions)</div>
                            </div>
                          )}
                          {oRate !== null && (
                            <div style={{ flex: 1, background: C.taupeSoft, borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
                              <div style={{ fontFamily: F.d, fontSize: 24, fontWeight: 700, color: C.taupe }}>{oRate}%</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>good outcomes when going with gut</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.border, marginTop: 2 }}>({overrodeData.length} decisions)</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Learning velocity — improvement over time */}
                  {reflected.length >= 4 && (() => {
                    const half = Math.floor(reflected.length / 2);
                    const firstHalf = reflected.slice(0, half);
                    const secondHalf = reflected.slice(half);
                    const firstBetter = firstHalf.filter(d => d.reflection?.outcome === "Better than expected").length / firstHalf.length;
                    const secondBetter = secondHalf.filter(d => d.reflection?.outcome === "Better than expected").length / secondHalf.length;
                    const improving = secondBetter > firstBetter;
                    const delta = Math.round(Math.abs(secondBetter - firstBetter) * 100);
                    const firstRegrets = firstHalf.filter(d => d.reflection?.lesson !== "Nothing — I'd decide the same way").length / firstHalf.length;
                    const secondRegrets = secondHalf.filter(d => d.reflection?.lesson !== "Nothing — I'd decide the same way").length / secondHalf.length;
                    const lessRegrets = secondRegrets < firstRegrets;
                    return (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Learning velocity</p>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1, background: improving ? C.sageSoft : C.bg, borderRadius: 8, padding: "10px" }}>
                            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: improving ? C.sage : C.muted }}>
                              {improving ? "↑" : delta === 0 ? "→" : "↓"} {delta}%
                            </div>
                            <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>
                              {improving ? "More outcomes beating expectations" : delta === 0 ? "Consistent outcomes" : "Outcomes dipped — keep reflecting"}
                            </div>
                          </div>
                          <div style={{ flex: 1, background: lessRegrets ? C.sageSoft : C.bg, borderRadius: 8, padding: "10px" }}>
                            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: lessRegrets ? C.sage : C.muted }}>
                              {lessRegrets ? "↑" : "→"}
                            </div>
                            <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>
                              {lessRegrets ? "Fewer regrets over time" : "Regret rate stable"}
                            </div>
                          </div>
                        </div>
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "8px 0 0" }}>Comparing your first {half} reflections to your last {reflected.length - half}.</p>
                      </div>
                    );
                  })()}

                  {/* Personalised improvement recommendations */}
                  {reflected.length >= 3 && (() => {
                    const recs = [];
                    const lessonCounts = {};
                    reflected.forEach(d => { const l = d.reflection?.lesson; if (l && l !== "Nothing — I'd decide the same way") lessonCounts[l] = (lessonCounts[l] || 0) + 1; });
                    const topLesson = Object.entries(lessonCounts).sort((a, b) => b[1] - a[1])[0];

                    if (topLesson) {
                      const tips = {
                        "I'd weigh different criteria": { title: "Sharpen your criteria", tip: "Before your next decision, list criteria FIRST — before looking at options. This reduces bias from anchoring on a favourite." },
                        "I'd decide faster": { title: "Speed up your process", tip: "Set a time cap before starting. Most decisions don't improve with more deliberation — they improve with better criteria upfront." },
                        "I'd get more information first": { title: "Close information gaps", tip: "Before deciding, ask: 'What would change my mind?' If you can find that info in under a day, get it. Otherwise, decide now." },
                        "I'd consider more options": { title: "Expand your option set", tip: "Spend 5 minutes brainstorming before committing to options. Ask 'What would [someone I respect] consider?' to break your frame." },
                      };
                      const rec = tips[topLesson[0]];
                      if (rec) recs.push({ ...rec, count: topLesson[1] });
                    }

                    if (gutAccuracy !== null && gutAccuracy < 50) recs.push({ title: "Calibrate your instinct", tip: "Your gut and reality disagree often. After each decision, write down your confidence level (1-10). Tracking this builds awareness.", count: null });
                    if (gutAccuracy !== null && gutAccuracy >= 75) recs.push({ title: "Trust your instinct more", tip: "Your gut is well-calibrated. For low-stakes decisions, consider going with your instinct to save time and energy.", count: null });

                    const overrodeCount = reflected.filter(d => d.reflection?.followedApp === "No, I went with my instinct").length;
                    const overrodeBad = reflected.filter(d => d.reflection?.followedApp === "No, I went with my instinct" && d.reflection?.outcome === "Worse than expected").length;
                    if (overrodeCount >= 2 && overrodeBad / overrodeCount > 0.5) recs.push({ title: "Lean into the analysis", tip: "When you override the structured analysis, outcomes tend to be worse. Try following the analysis for 3 decisions and see what happens.", count: overrodeBad });

                    if (recs.length === 0) return null;
                    return (
                      <div style={{ background: C.sageSoft, borderRadius: 10, border: `1px solid ${C.sage}20`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.sage, margin: "0 0 10px" }}>Your improvement plan</p>
                        {recs.slice(0, 3).map((r, i) => (
                          <div key={i} style={{ marginBottom: i < recs.length - 1 ? 10 : 0 }}>
                            <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 3px" }}>
                              {r.title}{r.count ? ` (${r.count}x)` : ""}
                            </p>
                            <p style={{ fontFamily: F.b, fontSize: 11, color: C.text, margin: 0, lineHeight: 1.6 }}>{r.tip}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Decision complexity trend */}
                  {history.length >= 3 && (() => {
                    const recent5 = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
                    const avgCrit = recent5.reduce((s, d) => s + (d.criteria?.length || 0), 0) / recent5.length;
                    const avgOpts = recent5.reduce((s, d) => s + (d.options?.length || (d.type === "binary" ? 2 : 0)), 0) / recent5.length;
                    const allAvgCrit = history.reduce((s, d) => s + (d.criteria?.length || 0), 0) / history.length;
                    const critTrend = avgCrit > allAvgCrit * 1.2 ? "increasing" : avgCrit < allAvgCrit * 0.8 ? "decreasing" : "stable";
                    return (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Decision complexity</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: C.text }}>{avgCrit.toFixed(1)}</div>
                            <div style={{ fontFamily: F.b, fontSize: 8, color: C.muted }}>Avg criteria</div>
                          </div>
                          <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: C.text }}>{avgOpts.toFixed(1)}</div>
                            <div style={{ fontFamily: F.b, fontSize: 8, color: C.muted }}>Avg options</div>
                          </div>
                          <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 700, color: critTrend === "increasing" ? C.sage : C.muted }}>
                              {critTrend === "increasing" ? "↑" : critTrend === "decreasing" ? "↓" : "→"}
                            </div>
                            <div style={{ fontFamily: F.b, fontSize: 8, color: C.muted }}>Trend</div>
                          </div>
                        </div>
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
                          {critTrend === "increasing" ? "You're using more criteria lately — a sign of more thorough analysis." : critTrend === "decreasing" ? "Fewer criteria recently — either decisions are simpler, or you're getting more efficient." : "Consistent depth of analysis across your decisions."}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Decision type breakdown with outcomes */}
                  {reflected.length >= 2 && (() => {
                    const types = {};
                    reflected.forEach(d => {
                      const t = d.type === "binary" ? "Binary" : "Multi-option";
                      if (!types[t]) types[t] = { total: 0, better: 0, worse: 0 };
                      types[t].total++;
                      if (d.reflection?.outcome === "Better than expected") types[t].better++;
                      if (d.reflection?.outcome === "Worse than expected") types[t].worse++;
                    });
                    return Object.keys(types).length > 1 ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Outcomes by decision type</p>
                        {Object.entries(types).map(([type, data]) => {
                          const successRate = Math.round((data.better / data.total) * 100);
                          return (
                            <div key={type} style={{ marginBottom: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontFamily: F.b, fontSize: 11, color: C.text }}>{type} ({data.total})</span>
                                <span style={{ fontFamily: F.b, fontSize: 11, color: successRate >= 50 ? C.sage : C.muted, fontWeight: 600 }}>{successRate}% beat expectations</span>
                              </div>
                              <div style={{ height: 5, borderRadius: 3, background: C.accentLt, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${successRate}%`, borderRadius: 3, background: successRate >= 50 ? C.sage : C.taupe }} />
                              </div>
                            </div>
                          );
                        })}
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "6px 0 0" }}>
                          {(() => {
                            const entries = Object.entries(types);
                            if (entries.length < 2) return "";
                            const [typeA, dataA] = entries[0];
                            const [typeB, dataB] = entries[1];
                            const rateA = dataA.better / dataA.total;
                            const rateB = dataB.better / dataB.total;
                            if (Math.abs(rateA - rateB) < 0.15) return "Similar success rates across both types.";
                            return rateA > rateB ? `You perform better with ${typeA} decisions.` : `You perform better with ${typeB} decisions.`;
                          })()}
                        </p>
                      </div>
                    ) : null;
                  })()}

                  {/* Blind spots — criteria that correlate with worse outcomes */}
                  {reflected.length >= 3 && (() => {
                    const critOutcomes = {};
                    reflected.forEach(d => {
                      if (!d.criteria) return;
                      d.criteria.forEach(c => {
                        if (!critOutcomes[c.name]) critOutcomes[c.name] = { total: 0, worse: 0, better: 0 };
                        critOutcomes[c.name].total++;
                        if (d.reflection?.outcome === "Worse than expected") critOutcomes[c.name].worse++;
                        if (d.reflection?.outcome === "Better than expected") critOutcomes[c.name].better++;
                      });
                    });
                    const blindSpots = Object.entries(critOutcomes)
                      .filter(([_, d]) => d.total >= 2 && d.worse / d.total >= 0.5)
                      .sort((a, b) => b[1].worse / b[1].total - a[1].worse / a[1].total)
                      .slice(0, 3);
                    const strengths = Object.entries(critOutcomes)
                      .filter(([_, d]) => d.total >= 2 && d.better / d.total >= 0.6)
                      .sort((a, b) => b[1].better / b[1].total - a[1].better / a[1].total)
                      .slice(0, 3);
                    if (blindSpots.length === 0 && strengths.length === 0) return null;
                    return (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Criteria performance</p>
                        {strengths.length > 0 && (
                          <div style={{ marginBottom: blindSpots.length > 0 ? 12 : 0 }}>
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Strong criteria</p>
                            {strengths.map(([name, data]) => (
                              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                                <span style={{ fontFamily: F.b, fontSize: 11, color: C.text }}>{name}</span>
                                <span style={{ fontFamily: F.b, fontSize: 10, color: C.sage }}>{Math.round(data.better / data.total * 100)}% good outcomes</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {blindSpots.length > 0 && (
                          <div>
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.taupe, fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Potential blind spots</p>
                            {blindSpots.map(([name, data]) => (
                              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                                <span style={{ fontFamily: F.b, fontSize: 11, color: C.text }}>{name}</span>
                                <span style={{ fontFamily: F.b, fontSize: 10, color: C.taupe }}>{Math.round(data.worse / data.total * 100)}% worse outcomes</span>
                              </div>
                            ))}
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
                              Decisions using these criteria tend to disappoint. Consider whether you're weighting them correctly.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Confidence calibration chart */}
                  {withImmediate.length >= 3 && (() => {
                    const buckets = { confident: { total: 0, good: 0 }, uncertain: { total: 0, good: 0 }, uneasy: { total: 0, good: 0 } };
                    withImmediate.forEach(d => {
                      const f = d.immediate.feeling;
                      if (buckets[f]) {
                        buckets[f].total++;
                        if (d.reflection?.outcome !== "Worse than expected") buckets[f].good++;
                      }
                    });
                    const data = Object.entries(buckets).filter(([_, d]) => d.total > 0).map(([feeling, d]) => ({
                      feeling: feeling.charAt(0).toUpperCase() + feeling.slice(1),
                      total: d.total,
                      goodRate: Math.round((d.good / d.total) * 100),
                      color: feeling === "confident" ? C.sage : feeling === "uneasy" ? C.error + "80" : C.taupe,
                    }));
                    return (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Confidence calibration</p>
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>When you felt confident, how often were you actually right?</p>
                        {data.map(d => (
                          <div key={d.feeling} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontFamily: F.b, fontSize: 11, color: C.text }}>{d.feeling} ({d.total}x)</span>
                              <span style={{ fontFamily: F.b, fontSize: 11, color: d.goodRate >= 70 ? C.sage : d.goodRate <= 40 ? C.error : C.muted, fontWeight: 600 }}>{d.goodRate}% good outcomes</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 3, background: C.accentLt, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${d.goodRate}%`, borderRadius: 3, background: d.color }} />
                            </div>
                          </div>
                        ))}
                        {(() => {
                          const conf = buckets.confident;
                          const uneasy = buckets.uneasy;
                          if (conf.total >= 2 && uneasy.total >= 1) {
                            const confRate = conf.good / conf.total;
                            const uneasyRate = uneasy.total > 0 ? uneasy.good / uneasy.total : 0;
                            if (confRate < 0.5) return <p style={{ fontFamily: F.b, fontSize: 10, color: C.taupe, margin: "6px 0 0", lineHeight: 1.5 }}>Your confidence often outpaces reality. Slow down when you feel most certain — that's when hidden risks lurk.</p>;
                            if (confRate > 0.8) return <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: "6px 0 0", lineHeight: 1.5 }}>Your confidence is well-calibrated — when you feel good about a decision, you're usually right.</p>;
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })()}

                  {/* Outcome streak */}
                  {reflected.length >= 3 && (() => {
                    const recent = [...reflected].sort((a, b) => b.timestamp - a.timestamp);
                    let streak = 0;
                    let streakType = null;
                    for (const d of recent) {
                      const o = d.reflection?.outcome;
                      if (streakType === null) streakType = o === "Worse than expected" ? "bad" : "good";
                      if ((streakType === "good" && o !== "Worse than expected") || (streakType === "bad" && o === "Worse than expected")) streak++;
                      else break;
                    }
                    if (streak < 2) return null;
                    return (
                      <div style={{ background: streakType === "good" ? C.sageSoft : C.taupeSoft, borderRadius: 10, border: `1px solid ${streakType === "good" ? C.sage : C.taupe}20`, padding: "14px 16px", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontFamily: F.d, fontSize: 28, fontWeight: 700, color: streakType === "good" ? C.sage : C.taupe }}>{streak}</div>
                          <div>
                            <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: 0 }}>
                              {streakType === "good" ? "Decision win streak" : "Decisions needing improvement"}
                            </p>
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "2px 0 0" }}>
                              {streakType === "good" ? `Your last ${streak} decisions met or beat expectations.` : `Your last ${streak} decisions fell short. Time to review your approach.`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Share your stats */}
                  <div style={{ marginTop: 8 }}>
                    <Btn v="secondary" onClick={() => {
                      const stats = [
                        `\u{1F4CA} My Unstuk Decision Report`,
                        ``,
                        `${history.length} decisions made`,
                        `${reflected.length} reflected on`,
                        gutAccuracy !== null ? `${gutAccuracy}% instinct accuracy` : null,
                        betterThanExpected > 0 ? `${betterThanExpected}/${reflected.length} beat expectations` : null,
                        total - wouldChangeSomething > 0 ? `${total - wouldChangeSomething}/${total} no regrets` : null,
                        ``,
                        `Make better decisions at unstuk.app`,
                      ].filter(Boolean).join("\n");
                      setShareSheetData({ text: stats, title: "Share My Stats" });
                    }} style={{ width: "100%", fontSize: 12 }}>Share my decision report</Btn>
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Timeline */}
            {reflected.length > 0 && (
              <FadeIn delay={500}>
                <div style={{ marginTop: 28 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Timeline</div>
                  {reflected.map((d, i) => {
                    const r = d.reflection;
                    const outcomeColor = r.outcome === "Better than expected" ? C.sage : r.outcome === "Worse than expected" ? C.error : C.muted;
                    return (
                      <div key={d.id} style={{ display: "flex", gap: 14, marginBottom: i < reflected.length - 1 ? 0 : 0 }}>
                        {/* Vertical line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: outcomeColor, flexShrink: 0, marginTop: 5 }} />
                          {i < reflected.length - 1 && <div style={{ width: 1, flex: 1, background: C.border, minHeight: 30 }} />}
                        </div>
                        <div style={{ paddingBottom: 16 }}>
                          <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 500, color: C.text }}>{d.name}</div>
                          <div style={{ fontFamily: F.b, fontSize: 11, color: outcomeColor, marginTop: 2 }}>{r.outcome}</div>
                          <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 2 }}>Chose: {r.chose} · {r.followedApp === "Yes" ? "Followed analysis" : r.followedApp === "Partly — it influenced me" ? "Partly followed" : "Went with instinct"}</div>
                          {r.lesson && r.lesson !== "Nothing — I'd decide the same way" && (
                            <div style={{ fontFamily: F.b, fontSize: 10, color: C.taupe, marginTop: 3, fontStyle: "italic" }}>Lesson: {r.lesson}</div>
                          )}
                          <div style={{ fontFamily: F.b, fontSize: 9, color: C.border, marginTop: 3 }}>{new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{d.criteria ? ` · ${d.criteria.length} criteria` : ""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </FadeIn>
            )}

            <div style={{ marginTop: 24 }}>
              <Btn onClick={() => setScreen("home")} style={{ width: "100%" }}>Back to home</Btn>
            </div>
          </FadeIn>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── 30-DAY REVIEW ───
  if (screen === "review30") {
    if (history.filter((d) => d.reflection).length >= 10 && !unlocked) { setScreen("upgrade"); return null; }
    const dec = history.find((d) => d.id === reflectId);
    if (!dec?.reflection) { setScreen("home"); return null; }
    const w = dec.results ? [...dec.results].sort((a, b) => b.score - a.score)[0] : null;
    const r = dec.reflection;

    const reviewQs = [
      { key: "stillGood", q: "Looking back after a month — how do you feel about this decision now?",
        options: ["It was the right call", "Mixed feelings", "I wish I'd chosen differently", "Still too early to say"]
      },
      { key: "whatLearned", q: "What's the biggest thing you've learned from this decision?",
        options: ["Trust the analysis more", "Trust my instinct more", "I need better criteria", "Speed matters more than I thought", "Nothing new — it confirmed what I knew"]
      },
    ];

    const q = reviewQs[reflectStep];
    if (reflectStep >= reviewQs.length) {
      // Save review
      const updatedHistory = history.map((d) =>
        d.id === reflectId ? { ...d, review30: { ...reflectAnswers, timestamp: Date.now() } } : d
      );
      setTimeout(() => {
        setHistory(updatedHistory);
        saveHistory(updatedHistory);
        setScreen("home");
      }, 0);
      return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FadeIn><div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{"✨"}</div>
            <p style={{ fontFamily: F.d, fontSize: 20, fontWeight: 600, color: C.text }}>Review saved</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginTop: 6 }}>One month wiser.</p>
          </div></FadeIn>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => reflectStep > 0 ? setReflectStep(reflectStep - 1) : setScreen("home")} />
          <FadeIn key={reflectStep}>
            <Dots current={reflectStep} total={reviewQs.length} />
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.taupe, fontWeight: 500, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>30-day review</p>
              <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: 600, margin: 0 }}>{dec.name}</p>
              {w && <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "4px 0 0" }}>Original result: {w.name} ({w.pct}%) · 3-day: {r.outcome}</p>}
            </div>
            <H size="md">{q.q}</H>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 18 }}>
              {q.options.map((opt, i) => {
                const isFirst = i === 0;
                const isLast = i === q.options.length - 1;
                return (
                  <button key={opt} onClick={() => {
                    setReflectAnswers({ ...reflectAnswers, [q.key]: opt });
                    setReflectStep(reflectStep + 1);
                  }} className="ustk-touch" style={{
                      fontFamily: F.b, fontSize: 13, padding: "14px 18px", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer",
                      border: `1px solid ${C.border}`, borderTop: isFirst ? `1px solid ${C.border}` : "none",
                      borderRadius: isFirst ? "8px 8px 0 0" : isLast ? "0 0 8px 8px" : "0",
                      background: "#fff", color: C.text,
                    }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── UPGRADE ───
  const startCheckout = async () => {
    setCheckoutMsg(null);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      });
      if (!res.ok) throw new Error("not available");
      const data = await res.json();
      if (data.url && data.url.startsWith("https://checkout.stripe.com/")) window.location.href = data.url;
      else throw new Error("no url");
    } catch(e) {
      setCheckoutMsg("Payment system coming soon. We\u2019re finalising Stripe integration.");
      trackEvent("checkout_fail");
    }
  };

  if (screen === "upgrade") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <FadeIn>
            <BackBtn onClick={() => setScreen("home")} />
            <div style={{ fontSize: 40, marginBottom: 20 }}>&#10024;</div>
            <H size="lg">You've used your free decision</H>
            <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "16px 0 8px" }}>
              Every Unstuk user gets 10 decisions of each type free — so you can experience the full process before committing. Upgrade to Pro for unlimited access.
            </p>

            <Card style={{ padding: "20px 20px 10px", marginBottom: 18, textAlign: "left" }}>
              <div style={{ fontFamily: F.b, fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: 12 }}>
                <div style={{ marginBottom: 2 }}><span style={{ marginRight: 8 }}>—</span>Free: 10 binary, 10 multi-option, 10 quick poll, 10 reflections</div>
                <div><span style={{ marginRight: 8 }}>—</span>Pro: unlimited everything, forever</div>
              </div>
            </Card>

            <Card style={{ padding: "24px 20px", marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontFamily: F.d, fontSize: 32, fontWeight: 700, color: C.text, marginBottom: 4, textAlign: "center" }}>$30</div>
              <div style={{ fontFamily: F.b, fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 18 }}>per month</div>
              <div style={{ fontFamily: F.b, fontSize: 14, color: C.text, lineHeight: 2 }}>
                <div style={{ marginBottom: 4 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Unlimited decisions & analyses</div>
                <div style={{ marginBottom: 4 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>AI-powered suggestions & insights</div>
                <div style={{ marginBottom: 4 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Team collaboration & quick polls</div>
                <div style={{ marginBottom: 4 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Full decision history & reflection tracking</div>
                <div style={{ marginBottom: 4 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Growth insights & instinct accuracy</div>
                <div><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Priority support & data export</div>
              </div>
            </Card>

            <p style={{ fontFamily: F.b, fontSize: 12, color: C.sage, fontStyle: "italic", margin: "0 0 20px", lineHeight: 1.5 }}>
              McKinsey research shows better decisions can lift returns by 20%+. That's worth far more than $30 a month.
            </p>

            <Btn onClick={() => { trackEvent("checkout_start"); startCheckout(); }} style={{ width: "100%", padding: "16px 28px", fontSize: 15, marginBottom: 12 }}>
              Subscribe — $30/month
            </Btn>

            {checkoutMsg && (
              <div style={{ fontFamily: F.b, fontSize: 12, color: C.sage, background: C.sageSoft, border: `1px solid ${C.sage}25`, borderRadius: 8, padding: "12px 16px", margin: "8px 0 12px", lineHeight: 1.5 }}>
                {checkoutMsg}
              </div>
            )}

            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "8px 16px" }}>
              Back to home
            </button>
            <p style={{ fontFamily: F.b, fontSize: 11, color: C.border, marginTop: 28, lineHeight: 1.6 }}>
              Payments processed securely by Stripe. Cancel anytime. No data leaves your device.
            </p>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── FLOW ───
  const renderStep = () => {
    if (blocked) return <BlockedMsg onBack={() => { resetFull(); setStep("name"); setScreen("flow"); }} />;

    if (step === "name") {
      return (
        <FadeIn key="name">
          <BackBtn onClick={() => setScreen("home")} />
          <Lbl>Your Decision</Lbl>
          <H size="md">What decision are you making?</H>
          <Sub>30 characters max. Pick a suggestion below or type your own.</Sub>
          <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "4px 0 2px", lineHeight: 1.5, fontStyle: "italic" }}>
            Naming a decision clearly is the first step to thinking it through. Hammond, Keeney & Raiffa call this "framing" — it shapes everything that follows.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1 }}>
            <TxtIn value={dName} onChange={setDName} placeholder="" maxLen={30}
            onSubmit={() => {
              if (!dName.trim()) return;
              if (isBlockedContent(dName)) { setBlocked(true); return; }
              goStep("type");
            }} />
            </div>
            <Btn onClick={() => {
              if (!dName.trim()) return;
              if (isBlockedContent(dName)) { setBlocked(true); return; }
              goStep("type");
            }} disabled={!dName.trim()} style={{ padding: "12px 20px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>Next</Btn>
          </div>
          <ChipPicker storageKey="name" usedNames={dName ? [dName] : []} aiContext={{ dName, opts, crits, typed: dName, decisionType: dType || "" }} onPick={(name) => setDName(name)}
            collapsed={!!dName.trim()} />
        </FadeIn>
      );
    }

    if (step === "type") {
      return (
        <FadeIn key="type">
          <BackBtn onClick={goBack} />
          <Lbl>Decision Type</Lbl>
          <H size="md">How many options?</H>
          <Sub>Binary has two options. Otherwise, three or more.</Sub>
          <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 6px" }}>
            {"\u2022"} Most decisions are binary at their core. If in doubt, start with two options.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => { setDType("binary"); setLastReward("binary"); setTimeout(() => goStep("binaryopts"), 500); }}
              className="ustk-touch" style={{ fontFamily: F.b, fontSize: 14, padding: "15px 20px", borderRadius: 10, border: dType === "binary" ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: dType === "binary" ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
              Binary — Two options
              {dType === "binary" && lastReward && <InlineReward show={true} />}
            </button>
            <button onClick={() => { setDType("multi"); setLastReward("multi"); setTimeout(() => goStep("options"), 500); }}
              className="ustk-touch" style={{ fontFamily: F.b, fontSize: 14, padding: "15px 20px", borderRadius: 10, border: dType === "multi" ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: dType === "multi" ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
              Three or more — Multiple options
              {dType === "multi" && lastReward && <InlineReward show={true} />}
            </button>
          </div>
        </FadeIn>
      );
    }

    /* commit step removed — flow goes directly to options */

    if (step === "options") {
      const add = () => { if (newOpt.trim() && opts.length < 6) { if (isBlockedContent(newOpt)) { setBlocked(true); return; } const nid = uid(); setOpts((p) => [...p, { id: nid, name: newOpt.trim() }]); setNewOpt(""); setRewardTick((t) => t + 1); setAddFlash("option"); setTimeout(() => setAddFlash(null), 800); setLastAddedOpt(nid); setTimeout(() => setLastAddedOpt(null), 2500); setTimeout(() => document.getElementById("multiOpt")?.focus(), 50); } };
      const atMax = opts.length >= 6;
      return (
        <FadeIn key="opts">
          <BackBtn onClick={goBack} />
          <Lbl>Options {opts.length > 0 && <span style={{ color: C.sage, fontWeight: 600, transition: "all 0.3s ease", display: "inline-block", transform: addFlash === "option" ? "scale(1.2)" : "scale(1)" }}>{opts.length}/6</span>}</Lbl>
          <H size="md">What are your options?</H>
          <Sub>30 characters max. Pick a suggestion or type your own.</Sub>
          <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "4px 0 2px", lineHeight: 1.5, fontStyle: "italic" }}>
            Well-defined options are critical. Nutt (2002, <em>Why Decisions Fail</em>) found that 70% of business decisions fail because leaders don't consider enough alternatives.
          </p>
          {opts.length > 0 && <div style={{ marginBottom: 14 }}><OptRows items={opts} onRemove={(id) => setOpts(opts.filter((x) => x.id !== id))} lastAddedId={lastAddedOpt} /></div>}
          {opts.length >= 2 && opts.length <= 3 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "0 0 8px" }}>
              {"\u2022"} Try including one option you wouldn't normally consider.
            </p>
          )}
          {!atMax && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1 }}><TxtIn value={newOpt} onChange={setNewOpt} placeholder="" onSubmit={add} maxLen={30} inputId="multiOpt" /></div>
                <Btn v="sage" onClick={add} disabled={!newOpt.trim()} style={{ padding: "12px 18px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>+ Add</Btn>
                {opts.length >= 3 && <div style={{ width: 6 }} />}
                {opts.length >= 3 && <Btn onClick={() => {
                  if (newOpt.trim()) { if (isBlockedContent(newOpt)) { setBlocked(true); return; } const nid = uid(); setOpts((p) => [...p, { id: nid, name: newOpt.trim() }]); setNewOpt(""); setTimeout(() => goStep("criteria"), 50); } else { goStep("criteria"); }
                }} style={{ padding: "12px 18px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>Next</Btn>}
              </div>
              {opts.length === 2 && (
                <Btn onClick={() => {
                  if (!newOpt.trim()) return;
                  if (isBlockedContent(newOpt)) { setBlocked(true); return; }
                  const nid = uid(); setOpts((p) => [...p, { id: nid, name: newOpt.trim() }]); setNewOpt("");
                  setTimeout(() => goStep("criteria"), 50);
                }} disabled={!newOpt.trim()} style={{ width: "100%", fontSize: 14, padding: "13px 28px", marginTop: 10 }}>Next →</Btn>
              )}
              <ChipPicker storageKey="opt" usedNames={[...opts.map((o) => o.name), newOpt].filter(Boolean)} aiContext={{ dName, opts, crits: [], typed: newOpt, decisionType: "multi" }} onPick={(name) => {
                if (opts.length < 6) { const nid = uid(); setOpts((p) => [...p, { id: nid, name }]); setRewardTick((t) => t + 1); setAddFlash("option"); setTimeout(() => setAddFlash(null), 800); setLastAddedOpt(nid); setTimeout(() => setLastAddedOpt(null), 2500); }
              }}
                focusNext="multiOpt" />
            </>
          )}
          {atMax && <p style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, margin: "4px 0" }}>Maximum 6 options. Remove one to add another.</p>}
          {atMax && <div style={{ marginTop: 10 }}><Btn onClick={() => goStep("criteria")} style={{ width: "100%", fontSize: 15, padding: "14px 28px" }}>Next</Btn></div>}
          {opts.length < 3 && opts.length > 0 && <p style={{ fontFamily: F.b, fontSize: 11, color: C.taupe, marginTop: 6 }}>Add at least 3 options to continue</p>}

        </FadeIn>
      );
    }

    if (step === "binaryopts") {
      return (
        <FadeIn key="bn">
          <BackBtn onClick={goBack} />
          <Lbl>Your Two Options</Lbl>
          <H size="md">Name your two options</H>
          <Sub>30 characters max. Pick a suggestion or type your own.</Sub>
          <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "4px 0 2px", lineHeight: 1.5, fontStyle: "italic" }}>
            Clear, distinct options prevent ambiguity. Kahneman's <em>Thinking, Fast and Slow</em> shows that vague framing leads to inconsistent choices.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><Lbl>Option A</Lbl><TxtIn value={bo1} onChange={setBo1} placeholder="" inputId="binA" onSubmit={() => { document.getElementById("binB")?.focus(); }} maxLen={30} /></div>
              <div><Lbl>Option B</Lbl><TxtIn value={bo2} onChange={setBo2} placeholder="" inputId="binB" autoFocus={false} onSubmit={() => { if (bo1.trim() && bo2.trim()) { if (isBlockedContent(bo1) || isBlockedContent(bo2)) { setBlocked(true); return; } goStep("criteria"); } }} maxLen={30} /></div>
              <Btn onClick={() => { if (isBlockedContent(bo1) || isBlockedContent(bo2)) { setBlocked(true); return; } goStep("criteria"); }} disabled={!bo1.trim() || !bo2.trim()} style={{ width: "100%", fontSize: 13, padding: "13px 28px", marginTop: 4 }}>Next</Btn>
            </div>
          </div>
          <ChipPicker storageKey="opt" usedNames={[bo1, bo2].filter(Boolean)} aiContext={{ dName, opts: [{name: bo1}, {name: bo2}].filter(o => o.name), crits, typed: !bo1.trim() ? bo1 : bo2, decisionType: "binary" }} onPick={(name) => {
            if (!bo1.trim()) { setBo1(name); setTimeout(() => { const el = document.getElementById("binB"); if (el) { el.focus(); el.style.borderColor = C.accent; el.style.boxShadow = `0 0 0 3px ${C.accent}25`; setTimeout(() => { el.style.borderColor = C.border; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }, 1800); } }, 150); }
            else if (!bo2.trim()) setBo2(name);
          }}
            collapsed={!!bo1.trim() && !!bo2.trim()} />
        </FadeIn>
      );
    }

    if (step === "criteria") {
      const atMax = crits.length >= 10;
      const canAdd = newCrit.trim() && newImp !== null && !atMax;
      const has = crits.length > 0;
      // Next is blocked if: no criteria added, OR pending text with no importance selected
      const pendingIncomplete = newCrit.trim() !== "" && newImp === null;
      const nextBlocked = !has || pendingIncomplete;
      const showCont = has; // require at least 1 fully-added criterion to continue
      return (
        <FadeIn key="crits">
          <BackBtn onClick={goBack} />
          <Lbl>Criteria {has && <span style={{ color: C.sage, fontWeight: 600, transition: "all 0.3s ease", display: "inline-block", transform: addFlash === "criteria" ? "scale(1.2)" : "scale(1)" }}>{crits.length}/10</span>}</Lbl>
          <H size="md">{!has ? "Criteria for this decision" : "Add more or continue"}</H>
          <Sub>{!has ? "30 characters max. Pick suggestions or type your own." : atMax ? "You've reached the maximum." : "Add another, or continue."}</Sub>
          {!has && <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "4px 0 2px", lineHeight: 1.5, fontStyle: "italic" }}>
            Explicit criteria eliminate hidden biases. Keeney (<em>Value-Focused Thinking</em>, Cambridge Press) showed that teams who define criteria before evaluating options make significantly better decisions.
          </p>}
          {!has && (
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.accent, margin: "6px 0 2px", fontWeight: 500 }}>
              Add at least one criterion and select its importance to continue.
            </p>
          )}
          {has && crits.length <= 2 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "4px 0 6px" }}>
              {"\u2022"} 3–6 criteria is the sweet spot.
            </p>
          )}
          {has && <div style={{ marginBottom: 16 }}><CritRows items={crits} onRemove={(id) => setCrits(crits.filter((c) => c.id !== id))} lastAddedId={lastAddedCrit} /></div>}
          {!atMax && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <TxtIn value={newCrit} onChange={setNewCrit} placeholder="" onSubmit={() => { if (canAdd) addCrit(); }} maxLen={30} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {IMPORTANCE.map((o) => {
                      const sel = newImp === o.value;
                      return (
                        <button key={o.value} onClick={() => setNewImp(o.value)}
                          style={{ fontFamily: F.b, fontSize: 11, fontWeight: sel ? 600 : 400, padding: "7px 0", borderRadius: 6, border: `1.5px solid ${sel ? C.accent : C.border}`, background: sel ? C.accent : "transparent", color: sel ? "#fff" : C.text, cursor: "pointer", transition: "all 0.15s", flex: 1 }}>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: F.b, fontSize: 8, color: C.muted, margin: "3px 0 0", opacity: 0.6 }}>High = dealbreaker · Low = nice-to-have</p>
                  {pendingIncomplete && <p style={{ fontFamily: F.b, fontSize: 10, color: C.error, margin: "5px 0 0" }}>Select an importance level to add this criterion.</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, paddingTop: 1 }}>
                  <Btn v="sage" onClick={() => addCrit()} disabled={!canAdd} style={{ padding: "12px 16px", fontSize: 13, whiteSpace: "nowrap" }}>
                    + Add
                  </Btn>
                  {showCont && (
                    <Btn onClick={() => { if (nextBlocked) return; const added = canAdd ? addCrit() : false; goFromCrits(added ? 1 : 0); }} disabled={nextBlocked} style={{ padding: "12px 16px", fontSize: 13, whiteSpace: "nowrap" }}>
                      Next
                    </Btn>
                  )}
                </div>
              </div>
              <ChipPicker storageKey="crit" usedNames={[...crits.map((cr) => cr.name), newCrit].filter(Boolean)} aiContext={{ dName, opts, crits, typed: newCrit, decisionType: dType || "multi" }} onPick={(name) => { if (newImp !== null && crits.length < 10) { const cid = uid(); setCrits((p) => [...p, { id: cid, name: name.trim(), importance: newImp }]); setNewCrit(""); setRewardTick((t) => t + 1); setAddFlash("criteria"); setTimeout(() => setAddFlash(null), 800); setLastAddedCrit(cid); setTimeout(() => setLastAddedCrit(null), 1500); } else { setNewCrit(name); } }}
                />
            </>
          )}
          {atMax && <p style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, margin: "4px 0" }}>Maximum 10 criteria. Remove one to add another.</p>}
          {atMax && showCont && (
            <div style={{ marginTop: 12 }}>
              <Btn onClick={() => { if (!nextBlocked) goFromCrits(); }} disabled={nextBlocked} style={{ width: "100%", fontSize: 15, padding: "14px 28px", fontWeight: 600 }}>
                Start comparing
              </Btn>
            </div>
          )}

        </FadeIn>
      );
    }

    // ─── GROUP SETUP (only in group mode, between criteria and compare) ───
    if (step === "groupsetup") {
      const doCreateNow = async () => {
        setGsCreating(true);
        const decisionData = dType === "binary"
          ? { name: dName, type: "binary", criteria: crits, binaryOption1: bo1, binaryOption2: bo2 }
          : { name: dName, type: "multi", criteria: crits, options: opts, baseOption: baseOpt };
        const code = await createGroup(decisionData, null, "Creator", groupExpiry);
        setGsCreating(false);
        if (!code) return;
        setGroupCode(code);
        try { await window.storage.set("unstuk_active_groupCode", code); } catch(e) {}
        setIsGroupMode(false);
        trackEvent("group");
        const exL = groupExpiry < 1 ? `${Math.round(groupExpiry*60)} mins` : groupExpiry <= 1 ? "1 hour" : groupExpiry <= 24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry/24)} days`;
        const msg = `Get thinking, get unstuk \u2014 You're invited to a team decision on Unstuk!\n\nDecision: ${dName}\nCode: ${code}\n\nTap to join: https://unstuk.app?join=${code}\n\nDeadline: ${exL}`;
        setShareSheetData({ text: msg, title: "Invite to Team Decision", afterClose: () => setScreen("home") });
      };
      return (
        <FadeIn key="groupsetup">
          <BackBtn onClick={goBack} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: C.sageSoft, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>{"\uD83D\uDC65"}</span>
            <span style={{ fontFamily: F.b, fontSize: 11, fontWeight: 600, color: C.sage }}>Team Decision</span>
          </div>
          <H size="md">Create team decision</H>
          <Sub>Set a deadline and share with your team. Everyone scores independently.</Sub>

          <div style={{ marginTop: 20 }}>
            <Lbl>Response deadline</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[{ label: "15 min", val: 0.25 }, { label: "1 hour", val: 1 }, { label: "6 hours", val: 6 }, { label: "24 hours", val: 24 }, { label: "3 days", val: 72 }, { label: "1 week", val: 168 }].map((t) => (
                <button key={t.val} onClick={() => setGroupExpiry(t.val)}
                  style={{ fontFamily: F.b, fontSize: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${groupExpiry === t.val ? C.sage : C.border}`, background: groupExpiry === t.val ? C.sageSoft : "#fff", color: groupExpiry === t.val ? C.sage : C.text, fontWeight: groupExpiry === t.val ? 600 : 400, transition: "all 0.15s" }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setGroupRequireCode(r => !r)}>
            <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0, background: groupRequireCode ? C.sage : C.accentLt, transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: groupRequireCode ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
            <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Require code to join</span>
          </div>
          {!groupRequireCode && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.muted, margin: "4px 0 0 46px", lineHeight: 1.4 }}>Anyone with the invite link can participate. Their data is completely isolated — they cannot see your history, analytics, or any other content.</p>
          )}

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setGroupHideIndiv(h => !h)}>
            <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0, background: groupHideIndiv ? C.sage : C.accentLt, transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: groupHideIndiv ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
            <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Hide individual scores (group average only)</span>
          </div>

          <div style={{ marginTop: 20 }}>
            <Btn v="sage" onClick={doCreateNow} disabled={gsCreating} style={{ width: "100%", padding: "14px 28px", fontSize: 14 }}>
              {gsCreating ? "Creating…" : "Create & get share link →"}
            </Btn>
          </div>
        </FadeIn>
      );
    }

    if (step === "compare" && dType === "binary") {
      const cur = crits[bIdx];
      if (!cur) {
        if (!res) { setTimeout(() => setRes(scoreBin()), 0); return null; }
        /* Results ready */
                return <ResultsView results={res} dName={dName} critCount={crits.length} onDone={isGroupMode && groupCode ? async () => { const data = await loadGroupResults(groupCode); if (data) { setGroupData(data); setScreen("groupresults"); } else setScreen("home"); } : () => { setIsGroupMode(false); setScreen("home"); }} onBack={() => { setRes(null); setSavedId(null); setBCh((prev) => prev.slice(0, -1)); setBIdx(crits.length - 1); setBPick(null); }} onImmediate={saveImmediate} gutDoneExternal={resultsGutDone} setGutDoneExternal={setResultsGutDone} groupCreatedExternal={resultsGroupCreated} setGroupCreatedExternal={setResultsGroupCreated} groupErr={groupSubmitErr} setGroupExpiry={setGroupExpiry} groupExpiryVal={groupExpiry} setGroupHideIndiv={setGroupHideIndiv} groupHideIndivVal={groupHideIndiv} onOpenShareSheet={setShareSheetData} onGroup={!groupCode ? async () => { const code = await createGroup({ name: dName, type: "binary", criteria: crits, binaryOption1: bo1, binaryOption2: bo2 }, res, "Creator", groupExpiry); if (code) { setGroupCode(code); try { await window.storage.set("unstuk_active_groupCode", code); } catch(e) {} setIsGroupMode(false); trackEvent("group"); const exL = groupExpiry < 1 ? `${Math.round(groupExpiry*60)} mins` : groupExpiry<=1 ? "1 hour" : groupExpiry<=24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry/24)} days`; const msg = groupRequireCode ? `Get thinking, get unstuk \u2014 You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\nJoin code: ${code}\n\nTap to join: https://unstuk.app?join=${code}\n\nDeadline: ${exL}` : `Get thinking, get unstuk \u2014 You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\n\nTap to join: https://unstuk.app?join=${code}\n\nDeadline: ${exL}`; setShareSheetData({ text: msg, title: "Invite to Team Decision" }); } } : null} />;

      }
      if (bPick === null) {
        return (
          <FadeIn key={`bc${bIdx}`}>
            <BackBtn onClick={goBack} />
            <Dots current={bIdx} total={crits.length} />
            <MicroReward tick={rewardTick} current={bIdx} total={crits.length} />
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: C.accentLt, marginBottom: 10 }}>
              <span style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.accent }}>{cur.name}</span>
            </div>
            <H size="md">Which is better for this?</H>
            <Sub>Or choose same if there's no difference.</Sub>
            {bIdx === 0 && (
              <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "2px 0 6px", lineHeight: 1.5, fontStyle: "italic" }}>
                Comparing one criterion at a time reduces cognitive overload. Saaty's Analytic Hierarchy Process (used by Fortune 500 firms and the US Department of Defense) proves pairwise comparison produces more consistent, reliable results than holistic judgement.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
              <button onClick={() => { setBPick(1); triggerPulse(); }} className="ustk-touch"
                style={{ fontFamily: F.b, fontSize: 14, padding: "14px 20px", borderRadius: "8px 8px 0 0", border: bPick === 1 ? `2px solid ${C.sage}` : `1px solid ${C.border}`, borderBottom: "none", background: bPick === 1 ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box", transition: "all 0.15s" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{bo1}{bPick === 1 && <InlineReward show={true} />}</span>
              </button>
              <button onClick={() => {
                setBCh([...bCh, { cId: cur.id, opt: 0, adv: 0 }]);
                setAdvPicked("same"); setTimeout(() => { setBPick(null); setBIdx(bIdx + 1); setRewardTick((t) => t + 1); triggerPulse(); setAdvPicked(null); }, 500);
              }}
                className="ustk-touch" style={{ fontFamily: F.b, fontSize: 12, padding: "10px 20px", border: advPicked === "same" ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: advPicked === "same" ? C.sageSoft : C.bg, color: C.muted, cursor: "pointer", textAlign: "center", width: "100%", boxSizing: "border-box", letterSpacing: "0.04em", transition: "all 0.15s" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>Same — no difference{advPicked === "same" && <InlineReward show={true} />}</span>
              </button>
              <button onClick={() => { setBPick(2); triggerPulse(); }} className="ustk-touch"
                style={{ fontFamily: F.b, fontSize: 14, padding: "14px 20px", borderRadius: "0 0 8px 8px", border: bPick === 2 ? `2px solid ${C.sage}` : `1px solid ${C.border}`, borderTop: "none", background: bPick === 2 ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box", transition: "all 0.15s" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{bo2}{bPick === 2 && <InlineReward show={true} />}</span>
              </button>
            </div>
            <button onClick={() => { setBIdx(0); setBCh([]); setBPick(null); setStep("binaryopts"); }} style={{ fontFamily: F.b, fontSize: 11, color: C.border, background: "none", border: "none", cursor: "pointer", marginTop: 14, display: "block" }}>Edit criteria or options</button>
          </FadeIn>
        );
      }
      return (
        <FadeIn key={`ba${bIdx}`}>
          <BackBtn onClick={() => setBPick(null)} />
          <Dots current={bIdx} total={crits.length} />
          <MicroReward tick={rewardTick} current={bIdx} total={crits.length} />
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: C.accentLt, marginBottom: 10 }}>
            <span style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.accent }}>{cur.name}</span>
          </div>
          <H size="md">{(bPick === 1 ? bo1 : bo2)} is better</H>
          <Sub>By how much?</Sub>
          {bIdx === 0 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 4px" }}>
              {"\u2022"} Slight = marginal. Strong = hard to justify the other on this alone.
            </p>
          )}
          <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
            {BIN_ADV.map((o, i) => (
              <button key={o.value} onClick={() => { setAdvPicked(o.value); setTimeout(() => { setBCh([...bCh, { cId: cur.id, opt: bPick, adv: o.value }]); setBPick(null); setBIdx(bIdx + 1); setRewardTick((t) => t + 1); triggerPulse(); setAdvPicked(null); }, 500); }}
                style={{
                  flex: 1, fontFamily: F.b, fontSize: 13, padding: "16px 8px",
                  borderLeft: i === 0 ? `1px solid ${C.border}` : "none",
                  borderRadius: i === 0 ? "8px 0 0 8px" : i === BIN_ADV.length - 1 ? "0 8px 8px 0" : "0",
                  background: advPicked === o.value ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "center",
                  border: advPicked === o.value ? `2px solid ${C.sage}` : `1px solid ${C.border}`,
                  transition: "all 0.15s ease",
                }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{o.label}{advPicked === o.value && <InlineReward show={true} />}</span>
              </button>
            ))}
          </div>
        </FadeIn>
      );
    }

    if (step === "base") {
      return (
        <FadeIn key="base">
          <BackBtn onClick={goBack} />
          <Lbl>Starting point</Lbl>
          <H size="md">Which option is your default?</H>
          <Sub>Pick the option you'd go with right now, or the one requiring least change. Everything else gets compared against it.</Sub>
          <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "4px 0 2px", lineHeight: 1.5, fontStyle: "italic" }}>
            Anchoring to a reference option reduces decision fatigue. This is a core principle in MCDA (Multi-Criteria Decision Analysis), widely used by McKinsey and the World Bank for high-stakes decisions.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opts.map((o, i) => (
              <FlatBtn key={o.id} label={<span style={{ display: "flex", alignItems: "center", gap: 6 }}>{o.name}{i === 0 ? " (suggested)" : ""}{baseOpt === o.id && <InlineReward show={true} />}</span>} onClick={() => {
                setBaseOpt(o.id);
                const pairs = []; opts.filter((x) => x.id !== o.id).forEach((op) => { crits.forEach((cr) => { pairs.push({ oId: op.id, cId: cr.id }); }); });
                setMPairs(pairs); setMIdx(0); setMCo([]); setTimeout(() => goStep("compare"), 500);
              }} />
            ))}
          </div>
        </FadeIn>
      );
    }

    if (step === "compare" && dType === "multi") {
      if (mIdx >= mPairs.length) {
        if (!res) { setTimeout(() => setRes(scoreMul()), 0); return null; }
        /* Multi results ready */
                return <ResultsView results={res} dName={dName} critCount={crits.length} onDone={isGroupMode && groupCode ? async () => { const data = await loadGroupResults(groupCode); if (data) { setGroupData(data); setScreen("groupresults"); } else setScreen("home"); } : () => { setIsGroupMode(false); setScreen("home"); }} onBack={() => { setRes(null); setSavedId(null); setMCo((prev) => prev.slice(0, -1)); setMIdx(mPairs.length - 1); }} onImmediate={saveImmediate} gutDoneExternal={resultsGutDone} setGutDoneExternal={setResultsGutDone} groupCreatedExternal={resultsGroupCreated} setGroupCreatedExternal={setResultsGroupCreated} groupErr={groupSubmitErr} setGroupExpiry={setGroupExpiry} groupExpiryVal={groupExpiry} setGroupHideIndiv={setGroupHideIndiv} groupHideIndivVal={groupHideIndiv} onOpenShareSheet={setShareSheetData} onGroup={!groupCode ? async () => { const code = await createGroup({ name: dName, type: "multi", criteria: crits, options: opts, baseOption: baseOpt }, res, "Creator", groupExpiry); if (code) { setGroupCode(code); try { await window.storage.set("unstuk_active_groupCode", code); } catch(e) {} setIsGroupMode(false); trackEvent("group"); const exL = groupExpiry < 1 ? `${Math.round(groupExpiry*60)} mins` : groupExpiry<=1 ? "1 hour" : groupExpiry<=24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry/24)} days`; const msg = groupRequireCode ? `Get thinking, get unstuk \u2014 You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\nJoin code: ${code}\n\nTap to join: https://unstuk.app?join=${code}\n\nDeadline: ${exL}` : `Get thinking, get unstuk \u2014 You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\n\nTap to join: https://unstuk.app?join=${code}\n\nDeadline: ${exL}`; setShareSheetData({ text: msg, title: "Invite to Team Decision" }); } } : null} />;
      }
      const pair = mPairs[mIdx];
      const op = opts.find((o) => o.id === pair.oId);
      const cr = crits.find((c) => c.id === pair.cId);
      const bo = opts.find((o) => o.id === baseOpt);
      return (
        <FadeIn key={`mc${mIdx}`}>
          <BackBtn onClick={goBack} />
          <Dots current={mIdx} total={mPairs.length} />
          <MicroReward tick={rewardTick} current={mIdx} total={mPairs.length} />
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: C.accentLt, marginBottom: 10 }}>
            <span style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.accent }}>{cr.name}</span>
          </div>
          <H size="md">{op.name} vs {bo.name}</H>
          <Sub>How does the first compare to the second?</Sub>
          {mIdx === 0 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.taupe, margin: "2px 0 4px", lineHeight: 1.5, fontStyle: "italic" }}>
              Comparing one factor at a time is the core of structured decision analysis. Isolating criteria prevents the "halo effect" — where one strong attribute biases your view of everything else (Kahneman, <em>Thinking, Fast and Slow</em>).
            </p>
          )}
          {/* Scale header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4, marginTop: 20 }}>
            <div style={{ maxWidth: "42%", textAlign: "left" }}>
              <div style={{ fontFamily: F.b, fontSize: 9, color: C.error, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Disadvantage</div>
              <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{op.name}</div>
            </div>
            <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, textAlign: "center" }}>Same</div>
            <div style={{ maxWidth: "42%", textAlign: "right" }}>
              <div style={{ fontFamily: F.b, fontSize: 9, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Advantage</div>
              <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{op.name}</div>
            </div>
          </div>
          {/* Dot track */}
          <div style={{ position: "relative", marginTop: 6 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 10, height: 2, background: `linear-gradient(to right, ${C.error}50, ${C.border}40, ${C.sage}50)`, borderRadius: 1 }} />
            <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {MULTI_ADV.map((o) => {
                const picked = mAdvPicked === o.value;
                const isCentre = o.value === 0;
                const size = isCentre ? 14 : 20;
                const dotColor = picked ? C.sage : o.value < 0 ? `${C.error}60` : o.value > 0 ? `${C.sage}60` : C.border;
                const shortLabel = o.value === -3 ? "Major" : o.value === -2 ? "Mod." : o.value === -1 ? "Minor" : o.value === 0 ? "Same" : o.value === 1 ? "Minor" : o.value === 2 ? "Mod." : "Major";
                return (
                  <div key={o.value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
                    <button onClick={() => { setMAdvPicked(o.value); setTimeout(() => { setMCo([...mCo, { oId: pair.oId, cId: pair.cId, adv: o.value }]); setMIdx(mIdx + 1); setRewardTick((t) => t + 1); triggerPulse(); setMAdvPicked(null); }, 500); }}
                      style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${picked ? C.sage : dotColor}`, background: picked ? C.sage : o.value < 0 ? `${C.error}15` : o.value > 0 ? `${C.sage}15` : "#fff", cursor: "pointer", padding: 0, flexShrink: 0, boxShadow: picked ? `0 0 0 4px ${C.sage}20` : "none", transition: "all 0.15s ease", position: "relative", zIndex: 1, marginTop: isCentre ? 3 : 0 }} />
                    <span style={{ fontFamily: F.b, fontSize: 8, color: picked ? C.sage : o.value < 0 ? C.error : o.value > 0 ? C.sage : C.muted, opacity: picked ? 1 : 0.6, transition: "all 0.15s", textAlign: "center", lineHeight: 1.1, fontWeight: picked ? 600 : 400 }}>{shortLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ textAlign: "center", minHeight: 22, marginTop: 8 }}>
            {mAdvPicked !== null
              ? <span style={{ fontFamily: F.b, fontSize: 12, color: C.sage, fontWeight: 600 }}>{MULTI_ADV.find(o => o.value === mAdvPicked)?.label} for {op.name} <InlineReward show={true} /></span>
              : <span style={{ fontFamily: F.b, fontSize: 10, color: C.border }}>Tap a dot to score</span>}
          </div>
          <button onClick={() => { setMIdx(0); setMCo([]); setStep("criteria"); }} style={{ fontFamily: F.b, fontSize: 11, color: C.border, background: "none", border: "none", cursor: "pointer", marginTop: 14, display: "block" }}>Edit criteria or options</button>
        </FadeIn>
      );
    }

    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          {!isParticipant ? (
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.d, fontSize: 20, fontWeight: 600, color: C.text, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="10" height="10" viewBox="0 0 1024 1024" fill="none" style={{ opacity: 0.25 }}>
                <path d="M 476 248 A 272 272 0 1 0 548 248" stroke={C.accent} strokeWidth="16" fill="none" strokeLinecap="round" />
                <circle cx="512" cy="240" r="14" fill={C.sage} />
              </svg>
              Unstuk
            </button>
          ) : (
            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 600, color: C.text, opacity: 0.5 }}>Unstuk</div>
          )}
          {!isParticipant && (
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.55, transition: "opacity 0.15s", padding: "4px 0" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.55}>
              <span style={{ fontSize: 13 }}>⌂</span> Home
            </button>
          )}
        </div>
        {step !== "name" && dName && (
          <div style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>{dName}</div>
        )}
        <style>{touchStyle}</style>
        <Card style={selPulse ? { boxShadow: `0 0 16px ${C.sage}20`, borderColor: `${C.sage}30`, transition: "all 0.3s ease" } : { transition: "all 0.3s ease" }}>{renderStep()}</Card>
      </div>
      {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
    </div>
  );
}

export default function Unstuk() {
  return React.createElement(ErrorBoundary, null, React.createElement(UnstukInner));
}
