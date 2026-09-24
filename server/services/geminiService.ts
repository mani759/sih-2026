import { GoogleGenAI } from '@google/genai';
import { Project, Transaction } from '../../src/types';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
  }
  return aiClient;
}

const BANNED_TERMS = [
  /fraud\s+confirmed/gi,
  /fraud\s+detected\s+with\s+certainty/gi,
  /corrupt\s+mp/gi,
  /corrupt\s+officer/gi,
  /fraudulent\s+officer/gi,
  /guilty\s+of\s+fraud/gi
];

function sanitizeExplanation(text: string): string {
  let cleanText = text;
  for (const regex of BANNED_TERMS) {
    cleanText = cleanText.replace(regex, 'potential irregularity requiring review');
  }
  return cleanText;
}

// Approved models according to gemini-api skill (none require paid tier)
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function executeGeminiPrompt(
  prompt: string,
  systemInstruction?: string
): Promise<string | null> {
  const ai = getGenAI();
  if (!ai) return null;

  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json'
          }
        });

        const text = response?.text?.trim();
        if (text) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        if (isTransient && attempt === 1) {
          // Momentary demand spike - brief wait before retry or candidate model switch
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }

        // Move to the next candidate model in the fallback chain
        break;
      }
    }
  }

  if (lastError) {
    const msg = lastError?.message || String(lastError);
    console.info(`Gemini models unavailable (${msg.slice(0, 120)}...), utilizing deterministic audit response.`);
  }

  return null;
}

export async function generateAnomalyExplanation(
  project: Project,
  transaction?: Transaction | null
): Promise<{ explanation: string; recommendations: string[]; confidenceScore: number }> {
  const flags = project.flags || [];
  const riskScore = project.risk_score ?? 50;
  const severity = project.severity || 'medium';

  const systemInstruction = `You are a Senior Vigilance & Financial Audit Expert for the Ministry of Statistics and Programme Implementation (MoSPI), Government of India, analyzing MPLAD Scheme disbursements.
CRITICAL COMPLIANCE AND TERMINOLOGY RULES:
1. You MUST ONLY use approved terminology:
   - "Potential irregularity"
   - "Anomaly detected"
   - "Requires review"
   - "Risk signal"
   - "Flagged for investigation"
2. You are STRICTLY FORBIDDEN from using:
   - "Fraud confirmed"
   - "Fraud detected with certainty"
   - "Corrupt MP"
   - "Fraudulent officer"
   - Any accusation of criminal guilt.
3. Ground your explanation STRICTLY in the provided data, flags, and numbers. NEVER invent external facts, unseen companies, or fictitious audits.
4. Keep the explanation concise (2-3 structured paragraphs), professional, objective, and authoritative. Provide 3 specific audit action recommendations for the Nodal Officer.`;

  const prompt = `Please provide an official audit anomaly explanation and recommendations based on the following verified project & transaction records:

Project ID: ${project.project_id}
Project Name: ${project.project_name}
State: ${project.state}, District: ${project.district}, Constituency: ${project.constituency}
Hon'ble MP: ${project.mp_name}
Work Category: ${project.work_category}
Sanctioned Amount: ₹${(project.sanctioned_amount / 100000).toFixed(2)} Lakhs
Actual Expenditure: ₹${(project.actual_expenditure / 100000).toFixed(2)} Lakhs
Utilization Ratio: ${((project.actual_expenditure / project.sanctioned_amount) * 100).toFixed(1)}%
Status: ${project.status}
Tender on File: ${project.has_tender_on_file ? 'Yes' : 'NO (Missing)'}
MP Signed Recommendation on File: ${project.has_mp_recommendation ? 'Yes' : 'NO (Missing)'}
Start Date: ${project.start_date}, Expected Completion: ${project.expected_completion}, Actual: ${project.actual_completion || 'Incomplete'}
Delay: ${project.delay_days || 0} days

ML Scoring Output:
Risk Score: ${riskScore}/100 (${severity.toUpperCase()})
Rule Engine Flags: ${flags.join(', ') || 'None'}
Model Reason: ${project.reason || 'Standard parameter variance'}

${transaction ? `Associated Disbursed Transaction:
Transaction ID: ${transaction.transaction_id}
Vendor: ${transaction.vendor_name}
Disbursed Amount: ₹${(transaction.amount / 100000).toFixed(2)} Lakhs
Date: ${transaction.date}
Payment Mode: ${transaction.payment_mode || 'PFMS'}
Attached Evidence: ${transaction.evidence_documents.map(d => `${d.name} (${d.documentType})`).join(', ') || 'None'}
` : ''}

Respond with JSON in this structure:
{
  "explanation": "Clear, grounded explanation detailing why this was flagged...",
  "recommendations": [
    "Step 1 recommendation...",
    "Step 2 recommendation...",
    "Step 3 recommendation..."
  ],
  "confidenceScore": 92
}`;

  try {
    const rawJson = await executeGeminiPrompt(prompt, systemInstruction);
    if (rawJson) {
      const parsed = JSON.parse(rawJson);
      return {
        explanation: sanitizeExplanation(parsed.explanation || 'Anomaly detected based on parameter variance.'),
        recommendations: (parsed.recommendations || []).map((r: string) => sanitizeExplanation(r)),
        confidenceScore: Number(parsed.confidenceScore) || 88
      };
    }
  } catch (err: any) {
    // If parsing or execution failed, continue to deterministic fallback
  }

  // Fallback grounded template matching the strict terminology constraints
  const bullets: string[] = [];
  if (!project.has_tender_on_file) {
    bullets.push('Public tender documentation was not located in the Central GeM or State PWD procurement repository for this sanctioned work.');
  }
  if (!project.has_mp_recommendation) {
    bullets.push('Formal signed recommendation letter from the Hon’ble Member of Parliament is pending record verification.');
  }
  if (project.actual_expenditure > project.sanctioned_amount) {
    const overrun = ((project.actual_expenditure - project.sanctioned_amount) / project.sanctioned_amount * 100).toFixed(1);
    bullets.push(`Cumulative disbursements exceed the approved technical sanction by ₹${((project.actual_expenditure - project.sanctioned_amount) / 100000).toFixed(2)} Lakhs (${overrun}% variance) without recorded supplementary administrative approval.`);
  }
  if (project.status === 'Stalled') {
    bullets.push(`Civil works have halted past the scheduled completion date (${project.expected_completion}) with ${project.delay_days || 0} days of operational delay.`);
  }

  return {
    explanation: sanitizeExplanation(
      `An anomaly was detected during automated vigilance screening of ${project.project_id}. ${bullets.join(' ')} This project has been assigned a risk score of ${riskScore}/100 (${severity} risk signal), indicating that physical and procedural verification is warranted before approving further financial disbursements.`
    ),
    recommendations: [
      'Call for physical inspection report and geo-tagged photographic evidence from the District Executive Engineer.',
      'Reconcile running account bills and vendor payment vouchers against the approved Schedule of Rates (SoR).',
      'Verify contractor procurement records on the state e-tender portal to validate compliance with Central Vigilance Commission guidelines.'
    ],
    confidenceScore: 90
  };
}

export async function processAssistantQuery(
  query: string,
  filteredProjects: Project[],
  filteredTransactions: Transaction[]
): Promise<{ answer: string; relatedProjectIds: string[]; suggestedFilters?: Record<string, string> }> {
  const qLower = query.toLowerCase();

  // Sort projects so the most relevant to the query appear first in the prompt context
  const prioritizedProjects = [...filteredProjects].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.state && qLower.includes(a.state.toLowerCase())) scoreA += 20;
    if (b.state && qLower.includes(b.state.toLowerCase())) scoreB += 20;

    if (qLower.includes('tender') || qLower.includes('procurement') || qLower.includes('gem')) {
      if (!a.has_tender_on_file) scoreA += 15;
      if (!b.has_tender_on_file) scoreB += 15;
    }
    if (qLower.includes('recommendation') || qLower.includes('mp') || qLower.includes('signed')) {
      if (!a.has_mp_recommendation) scoreA += 15;
      if (!b.has_mp_recommendation) scoreB += 15;
    }
    if (qLower.includes('duplicate') || qLower.includes('overlap')) {
      if (a.is_potential_duplicate) scoreA += 15;
      if (b.is_potential_duplicate) scoreB += 15;
    }
    if (qLower.includes('overrun') || qLower.includes('excess') || qLower.includes('budget')) {
      if (a.actual_expenditure > a.sanctioned_amount) scoreA += 15;
      if (b.actual_expenditure > b.sanctioned_amount) scoreB += 15;
    }
    if (qLower.includes('stalled') || qLower.includes('delayed') || qLower.includes('delay')) {
      if (a.status === 'Stalled' || (a.delay_days && a.delay_days > 0)) scoreA += 15;
      if (b.status === 'Stalled' || (b.delay_days && b.delay_days > 0)) scoreB += 15;
    }
    if (a.severity === 'high') scoreA += 5;
    if (b.severity === 'high') scoreB += 5;

    return scoreB - scoreA;
  });

  const summarizedData = prioritizedProjects.slice(0, 20).map(p => ({
    id: p.project_id,
    name: p.project_name,
    state: p.state,
    district: p.district,
    mp: p.mp_name,
    category: p.work_category,
    sanctioned_lakhs: (p.sanctioned_amount / 100000).toFixed(2),
    expenditure_lakhs: (p.actual_expenditure / 100000).toFixed(2),
    tender_on_file: p.has_tender_on_file ? 'Yes' : 'NO',
    mp_recommendation: p.has_mp_recommendation ? 'Yes' : 'NO',
    delay_days: p.delay_days || 0,
    status: p.status,
    risk_score: p.risk_score,
    severity: p.severity,
    flags: p.flags
  }));

  const systemInstruction = `You are the AI Assistant for the MPLAD Scheme Monitoring Portal.
You answer questions for auditors, District Collectors, and Ministry officials.
RULES:
1. ONLY answer based on the real dataset provided in the prompt. NEVER fabricate projects, MPs, or amounts.
2. Comply strictly with terminology rules:
   - Use "Potential irregularity", "Anomaly detected", "Requires review", "Risk signal", "Flagged for investigation"
   - NEVER say "Fraud confirmed", "Fraudulent MP", etc.
3. Keep answers concise, factual, and informative. Reference specific Project IDs and amounts in ₹ Lakhs.`;

  const prompt = `User Query: "${query}"

Current dataset slice (${filteredProjects.length} total matched):
${JSON.stringify(summarizedData, null, 2)}

Respond with JSON:
{
  "answer": "Detailed, factual response addressing the query...",
  "relatedProjectIds": ["id1", "id2"],
  "suggestedFilters": {}
}`;

  try {
    const rawJson = await executeGeminiPrompt(prompt, systemInstruction);
    if (rawJson) {
      const parsed = JSON.parse(rawJson);
      return {
        answer: sanitizeExplanation(parsed.answer || 'Query processed successfully.'),
        relatedProjectIds: Array.isArray(parsed.relatedProjectIds) ? parsed.relatedProjectIds : [],
        suggestedFilters: parsed.suggestedFilters || {}
      };
    }
  } catch (err: any) {
    // If parsing or execution failed, proceed to intelligent intent-based deterministic answer
  }

  // Intent-aware deterministic query engine
  let matchedProjects = [...filteredProjects];
  let topicSummary = '';

  // 1. Detect state mentions in query
  const statesInDataset = Array.from(new Set(filteredProjects.map(p => p.state)));
  const matchedState = statesInDataset.find(s => qLower.includes(s.toLowerCase()));
  if (matchedState) {
    matchedProjects = matchedProjects.filter(p => p.state.toLowerCase() === matchedState.toLowerCase());
    topicSummary += ` in ${matchedState}`;
  }

  // 2. Detect missing tender query
  if (qLower.includes('tender') || qLower.includes('procurement') || qLower.includes('gem')) {
    matchedProjects = matchedProjects.filter(p => !p.has_tender_on_file);
    topicSummary = ` with missing public tender documentation${topicSummary}`;
  }
  // 3. Detect missing MP recommendation
  else if (qLower.includes('recommendation') || qLower.includes('signed') || qLower.includes('nomination')) {
    matchedProjects = matchedProjects.filter(p => !p.has_mp_recommendation);
    topicSummary = ` lacking signed MP recommendation on file${topicSummary}`;
  }
  // 4. Detect duplicate queries
  else if (qLower.includes('duplicate') || qLower.includes('identical') || qLower.includes('overlap')) {
    matchedProjects = matchedProjects.filter(p => p.is_potential_duplicate);
    topicSummary = ` flagged as potential duplicate works${topicSummary}`;
  }
  // 5. Detect cost overrun queries
  else if (qLower.includes('overrun') || qLower.includes('excess') || qLower.includes('overspent')) {
    matchedProjects = matchedProjects.filter(p => p.actual_expenditure > p.sanctioned_amount);
    topicSummary = ` exhibiting expenditure exceeding sanctioned amount${topicSummary}`;
  }
  // 6. Detect stalled or delayed works
  else if (qLower.includes('stalled') || qLower.includes('delayed') || qLower.includes('delay')) {
    matchedProjects = matchedProjects.filter(p => p.status === 'Stalled' || (p.delay_days && p.delay_days > 0));
    topicSummary = ` currently stalled or experiencing execution delays${topicSummary}`;
  }
  // 7. Detect high risk or flagged works
  else if (qLower.includes('high risk') || qLower.includes('flagged') || qLower.includes('anomaly') || qLower.includes('anomalies') || qLower.includes('irregularity')) {
    matchedProjects = matchedProjects.filter(p => p.severity === 'high');
    topicSummary = ` flagged with high-risk signals${topicSummary}`;
  }
  // 8. Under review works
  else if (qLower.includes('under review') || qLower.includes('medium')) {
    matchedProjects = matchedProjects.filter(p => p.severity === 'medium');
    topicSummary = ` under vigilance review${topicSummary}`;
  }

  if (matchedProjects.length === 0) {
    matchedProjects = filteredProjects.filter(p => p.severity === 'high');
  }

  const topItems = matchedProjects.slice(0, 4);
  const sampleDetails = topItems
    .map(p => `${p.project_id} (${p.project_name}, ₹${(p.sanctioned_amount / 100000).toFixed(1)}L sanctioned, ${p.state})`)
    .join('; ');

  const totalSanctionedLakhs = (matchedProjects.reduce((s, p) => s + p.sanctioned_amount, 0) / 100000).toFixed(1);

  return {
    answer: `Analysis of official vigilance records identified ${matchedProjects.length} projects${topicSummary || ' matching your search criteria'}, representing ₹${totalSanctionedLakhs} Lakhs in total technical sanctions. Key priority records requiring administrative verification include: ${sampleDetails || 'None recorded in this scope'}.`,
    relatedProjectIds: topItems.map(p => p.project_id),
    suggestedFilters: matchedState ? { state: matchedState } : {}
  };
}
