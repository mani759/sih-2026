import fs from 'fs';
import path from 'path';

export interface RawProjectRecord {
  project_id: string;
  mp_name: string;
  state: string;
  constituency: string;
  work_category: string;
  implementing_agency: string;
  sanctioned_amount: number;
  actual_expenditure: number;
  payment_count: number;
  start_date: string;
  expected_completion: string;
  actual_completion: string | null;
  status: string;
  has_tender_on_file: boolean;
  has_mp_recommendation: boolean;
  ground_truth_is_anomaly?: boolean;
  ground_truth_anomaly_type?: string | null;
  risk_score?: number | null;
  severity?: 'low' | 'medium' | 'high' | null;
  flags?: string[] | null;
  reason?: string | null;
  workflow_status?: 'FLAGGED' | 'VERIFIED' | 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED' | null;
  cost_estimate?: number;
  scheme?: string;
  financial_year?: string;
  // UI auxiliary fields
  project_name?: string;
  district?: string;
  expenditure_utilization?: number;
  delay_days?: number;
  is_potential_duplicate?: boolean;
}

// Complete 36 States & UTs of India
export const ALL_36_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];

export const IMPLEMENTING_AGENCIES = [
  'District PWD',
  'Gram Panchayat',
  'Zila Parishad',
  'Municipal Corporation',
  'Rural Development Department',
  'Cooperative Society'
];

// Robust CSV Line Parser that handles commas inside quoted fields and escaped quotes
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Search locations where the user or system may place mplads_projects.csv
export function findCsvFilePath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'mplads_projects.csv'),
    path.join(process.cwd(), 'server', 'data', 'mplads_projects.csv'),
    path.join(process.cwd(), 'src', 'data', 'mplads_projects.csv'),
    '/app/applet/mplads_projects.csv',
    '/app/applet/server/data/mplads_projects.csv'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Normalize date strings into clean ISO YYYY-MM-DD format if formatted as DD-MM-YYYY
export function normalizeDate(d: string | null | undefined): string | null {
  if (!d || d.trim() === '') return null;
  const trimmed = d.trim();
  const parts = trimmed.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return trimmed;
}

// Parses real mplads_projects.csv strictly with zero synthetic fallback
export function parseProjectsCsv(csvContent: string): RawProjectRecord[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  // Header row validation
  const headerCols = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const projIdIdx = headerCols.indexOf('project_id');
  const mpNameIdx = headerCols.indexOf('mp_name');
  const stateIdx = headerCols.indexOf('state');
  const constIdx = headerCols.indexOf('constituency');
  const workCatIdx = headerCols.indexOf('work_category');
  const agencyIdx = headerCols.indexOf('implementing_agency');
  const sancAmtIdx = headerCols.indexOf('sanctioned_amount');
  const actExpIdx = headerCols.indexOf('actual_expenditure');
  const payCountIdx = headerCols.indexOf('payment_count');
  const startDateIdx = headerCols.indexOf('start_date');
  const expCompIdx = headerCols.indexOf('expected_completion');
  const actCompIdx = headerCols.indexOf('actual_completion');
  const statusIdx = headerCols.indexOf('status');
  const tenderIdx = headerCols.indexOf('has_tender_on_file');
  const mpRecIdx = headerCols.indexOf('has_mp_recommendation');
  const isAnomalyIdx = headerCols.indexOf('is_anomaly');
  const anomalyTypeIdx = headerCols.indexOf('anomaly_type');

  if (projIdIdx === -1 || sancAmtIdx === -1 || stateIdx === -1) {
    throw new Error('Invalid CSV structure: required columns (project_id, sanctioned_amount, state) missing.');
  }

  const projects: RawProjectRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    const projectId = cols[projIdIdx]?.trim();
    if (!projectId) continue;

    const mpName = cols[mpNameIdx]?.trim() || 'Unknown MP';
    const rawState = cols[stateIdx]?.trim() || 'Unknown State';
    const state = /^the\s+dadra\s+and\s+nagar\s+haveli/i.test(rawState)
      ? 'Dadra and Nagar Haveli and Daman and Diu'
      : rawState;
    const constituency = cols[constIdx]?.trim() || '';
    const workCategory = cols[workCatIdx]?.trim() || 'Other';
    const implementingAgency = cols[agencyIdx]?.trim() || '';
    const sanctionedAmount = parseFloat(cols[sancAmtIdx]?.replace(/[^0-9.-]/g, '')) || 0;
    const actualExpenditure = parseFloat(cols[actExpIdx]?.replace(/[^0-9.-]/g, '')) || 0;
    const paymentCount = parseInt(cols[payCountIdx]?.replace(/[^0-9]/g, ''), 10) || 0;

    const rawStartDate = cols[startDateIdx]?.trim() || '';
    const rawExpComp = cols[expCompIdx]?.trim() || '';
    const rawActComp = actCompIdx !== -1 ? cols[actCompIdx]?.trim() : '';

    const status = cols[statusIdx]?.trim() || 'In Progress';
    const hasTender = tenderIdx !== -1 ? cols[tenderIdx]?.trim().toUpperCase() === 'TRUE' : false;
    const hasMpRec = mpRecIdx !== -1 ? cols[mpRecIdx]?.trim().toUpperCase() === 'TRUE' : false;

    const isAnomaly = isAnomalyIdx !== -1 ? cols[isAnomalyIdx]?.trim().toUpperCase() === 'TRUE' : false;
    const anomalyType = anomalyTypeIdx !== -1 && cols[anomalyTypeIdx]?.trim() !== '' ? cols[anomalyTypeIdx].trim() : null;

    projects.push({
      project_id: projectId,
      mp_name: mpName,
      state: state,
      constituency: constituency,
      work_category: workCategory,
      implementing_agency: implementingAgency,
      sanctioned_amount: sanctionedAmount,
      actual_expenditure: actualExpenditure,
      payment_count: paymentCount,
      start_date: normalizeDate(rawStartDate) || rawStartDate,
      expected_completion: normalizeDate(rawExpComp) || rawExpComp,
      actual_completion: normalizeDate(rawActComp),
      status: status,
      has_tender_on_file: hasTender,
      has_mp_recommendation: hasMpRec,
      ground_truth_is_anomaly: isAnomaly,
      ground_truth_anomaly_type: anomalyType,
      risk_score: null,
      severity: null,
      flags: [],
      reason: null,
      project_name: `${workCategory} - ${constituency || state}`,
      district: constituency
    });
  }

  return projects;
}

// Load dataset strictly from real CSV file or validated persistent store
export function ensureDatasetFile(): RawProjectRecord[] {
  const dataDir = path.join(process.cwd(), 'server', 'data');
  const storePath = path.join(dataDir, 'projects_store.json');

  // Check if store file already exists with full dataset
  if (fs.existsSync(storePath)) {
    try {
      const content = fs.readFileSync(storePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure every project has a workflow_status
        for (const p of parsed) {
          if (!p.workflow_status) {
            p.workflow_status = 'FLAGGED';
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('[CSV Parser] Existing projects_store.json unreadable:', e);
    }
  }

  // Load existing data from storePath if available
  const existingScores = new Map<string, { risk_score: number; severity: any; flags: string[]; reason: string; workflow_status?: any }>();

  // Check if real CSV file is available
  const csvPath = findCsvFilePath();
  if (csvPath) {
    console.log(`[CSV Parser] Reading real MPLADS dataset from ${csvPath}...`);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const projects = parseProjectsCsv(csvContent);
    console.log(`[CSV Parser] Parsed ${projects.length} real projects from CSV.`);

    // Restore any existing ML scores and workflow statuses so they are never lost
    for (const p of projects) {
      const s = existingScores.get(p.project_id);
      if (s) {
        p.risk_score = s.risk_score;
        p.severity = s.severity;
        p.flags = s.flags;
        p.reason = s.reason;
        if (s.workflow_status) {
          p.workflow_status = s.workflow_status;
        }
      }
      if (!p.workflow_status) {
        p.workflow_status = 'FLAGGED';
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(projects, null, 2), 'utf8');
    return projects;
  }

  // Check if store file already exists with previously parsed real data
  if (fs.existsSync(storePath)) {
    try {
      const content = fs.readFileSync(storePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('[CSV Parser] Existing projects_store.json unreadable:', e);
    }
  }

  // STRICT REQUIREMENT: If real file is not present, DO NOT silently fabricate or simulate data!
  const errorMessage = 
    'Real dataset file mplads_projects.csv not found on the filesystem. ' +
    'Please upload mplads_projects.csv directly via the AI Studio Code Editor File Explorer. ' +
    'No synthetic or simulated fallback data will be generated.';
  console.warn(`[CSV Parser] ${errorMessage}`);
  return [];
}
