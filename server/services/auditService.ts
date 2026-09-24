import fs from 'fs';
import path from 'path';
import { AuditLogEntry } from '../../src/types';
import { supabaseClient } from './supabaseService';

const dataDir = path.join(process.cwd(), 'server', 'data');
const auditStorePath = path.join(dataDir, 'audit_logs_store.json');

let auditLogsMemory: AuditLogEntry[] = [];

// Seed logs preserving real actions
const defaultSeedLogs: AuditLogEntry[] = [
  {
    id: 'LOG-MU0V547F',
    entityId: 'MPLADS-00045',
    entityType: 'project',
    user: 'NODAL.OFFICER',
    userRole: 'auditor',
    action: 'Verify',
    timestamp: '2026-09-14T06:29:47.019Z',
    remarks: 'Physical verification completed and execution cleared.',
    previousStatus: 'FLAGGED',
    newStatus: 'VERIFIED'
  },
  {
    id: 'LOG-MU0V3QK2',
    entityId: 'MPLADS-00058',
    entityType: 'project',
    user: 'NODAL.OFFICER',
    userRole: 'auditor',
    action: 'Mark False Positive',
    timestamp: '2026-09-14T06:28:42.674Z',
    remarks: 'Procurement exemption documented and false positive cleared.',
    previousStatus: 'FLAGGED',
    newStatus: 'RESOLVED'
  },
  {
    id: 'LOG-SYS-004',
    entityId: 'MPLADS-00002',
    entityType: 'project',
    user: 'NODAL.OFFICER',
    userRole: 'auditor',
    action: 'Verify',
    timestamp: '2026-09-14T06:15:00.000Z',
    remarks: 'On-site quality audit cleared and utilization verified.',
    previousStatus: 'FLAGGED',
    newStatus: 'VERIFIED'
  },
  {
    id: 'LOG-SYS-002',
    entityId: 'MPLADS-00001',
    entityType: 'project',
    user: 'District Magistrate Office',
    userRole: 'nodal_officer',
    action: 'Verify',
    timestamp: '2026-09-14T05:20:26.206Z',
    remarks: 'Physical verification completed and 100% geotagged photos validated.',
    previousStatus: 'FLAGGED',
    newStatus: 'VERIFIED'
  },
  {
    id: 'LOG-SYS-001',
    entityId: 'MPLADS-00005',
    entityType: 'project',
    user: 'Vigilance Admin',
    userRole: 'ministry_admin',
    action: 'Flagged by ML Engine',
    timestamp: '2026-09-14T06:20:26.206Z',
    remarks: 'High-risk anomaly flagged: Project sanctioned without statutory MP recommendation.'
  },
  {
    id: 'LOG-SYS-003',
    entityId: 'MPLADS-03364',
    entityType: 'project',
    user: 'Automated ML Monitor',
    userRole: 'auditor',
    action: 'Flagged by ML Engine',
    timestamp: '2026-09-14T04:20:26.206Z',
    remarks: 'Stalled work trigger: delay exceeding 250 days with low utilization.'
  }
];

export function initAuditLogs(): AuditLogEntry[] {
  if (fs.existsSync(auditStorePath)) {
    try {
      const content = fs.readFileSync(auditStorePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        auditLogsMemory = parsed;
        return auditLogsMemory;
      }
    } catch (err) {
      console.warn('Could not parse audit_logs_store.json, initializing defaults:', err);
    }
  }

  // Initialize with seed
  auditLogsMemory = [...defaultSeedLogs];
  persistAuditLogsToDisk();
  return auditLogsMemory;
}

export function getAllAuditLogs(): AuditLogEntry[] {
  if (auditLogsMemory.length === 0) {
    initAuditLogs();
  }
  return auditLogsMemory;
}

export async function fetchAuditLogsFromSupabase(): Promise<AuditLogEntry[]> {
  if (!supabaseClient) return getAllAuditLogs();
  try {
    const { data, error } = await supabaseClient
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false });

    if (!error && data && data.length > 0) {
      const dbLogs: AuditLogEntry[] = data.map((row: any) => ({
        id: row.id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        user: row.user_name,
        userRole: row.user_role,
        action: row.action,
        timestamp: row.timestamp,
        remarks: row.remarks,
        previousStatus: row.previous_status,
        newStatus: row.new_status
      }));

      const existingIds = new Set(dbLogs.map(l => l.id));
      for (const mem of auditLogsMemory) {
        if (!existingIds.has(mem.id)) {
          dbLogs.push(mem);
        }
      }
      auditLogsMemory = dbLogs;
      return auditLogsMemory;
    }
  } catch (err) {
    console.warn('Could not fetch audit logs from Supabase audit_log table:', err);
  }
  return getAllAuditLogs();
}

export function getAuditLogsForEntity(entityId: string): AuditLogEntry[] {
  return getAllAuditLogs().filter(l => l.entityId === entityId);
}

export async function saveAuditLog(entry: AuditLogEntry): Promise<void> {
  // 1. In-memory & disk persistence (always works)
  if (auditLogsMemory.length === 0) {
    initAuditLogs();
  }
  auditLogsMemory.unshift(entry);
  persistAuditLogsToDisk();

  // 2. Persist to Supabase public.audit_log if configured
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('audit_log')
        .insert({
          id: entry.id,
          entity_id: entry.entityId,
          entity_type: entry.entityType,
          user_name: entry.user,
          user_role: entry.userRole,
          action: entry.action,
          timestamp: entry.timestamp,
          remarks: entry.remarks,
          previous_status: entry.previousStatus || null,
          new_status: entry.newStatus || null
        });

      if (error) {
        console.warn('[Supabase AuditLog Notice]:', error.message);
      } else {
        console.log(`[Supabase AuditLog] Successfully wrote audit log ${entry.id} to public.audit_log`);
      }
    } catch (err: any) {
      console.warn('[Supabase AuditLog Exception]:', err.message);
    }
  }
}

function persistAuditLogsToDisk(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(auditStorePath, JSON.stringify(auditLogsMemory, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write audit logs to disk:', err);
  }
}

// Auto-initialize on module load
initAuditLogs();
fetchAuditLogsFromSupabase().catch(() => {});

