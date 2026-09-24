import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vbgeuofwhyylsiajttxq.supabase.co/rest/v1/';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZ2V1b2Z3aHl5bHNpYWp0dHhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQxMTMzOCwiZXhwIjoyMTAzOTg3MzM4fQ.8v2HdWtNggRSd5NCo2gVQCfKXGQE4Re5QHa9JmLKpNs';

const cleanedUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');

let supabaseClient: SupabaseClient | null = null;
if (cleanedUrl && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabaseClient = createClient(cleanedUrl, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.warn('Failed to initialize Supabase client in authService:', err);
  }
}

export interface UserSession {
  id: string;
  email: string;
  role: 'ADMIN' | 'PUBLIC';
  name: string;
  designation?: string;
  department?: string;
}

// Memory & file store for profiles
const dataDir = path.join(process.cwd(), 'server', 'data');
const profilesStorePath = path.join(dataDir, 'profiles_store.json');

// In-memory active session tokens map: token -> { user: UserSession, expiresAt: number }
const sessionTokens = new Map<string, { user: UserSession; expiresAt: number }>();

// Load profiles from file
function loadProfilesFromFile(): Record<string, UserSession> {
  try {
    if (fs.existsSync(profilesStorePath)) {
      const raw = fs.readFileSync(profilesStorePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read profiles_store.json:', e);
  }
  return {};
}

function saveProfilesToFile(profiles: Record<string, UserSession>) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(profilesStorePath, JSON.stringify(profiles, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not save profiles_store.json:', e);
  }
}

const localProfiles: Record<string, UserSession> = loadProfilesFromFile();

/**
 * Retrieve the list of all configured administrator emails.
 * Supports ADMIN_EMAILS (comma-separated list, e.g. "andejaswanth123@gmail.com,demomail12123@gmail.com")
 * as well as legacy/single ADMIN_EMAIL.
 * Case-insensitive and trimmed.
 */
export function getAdminEmails(): string[] {
  const adminEmailsRaw = (process.env.ADMIN_EMAILS || '').trim();
  const legacyAdminEmail = (process.env.ADMIN_EMAIL || '').trim();

  const combined = [adminEmailsRaw, legacyAdminEmail]
    .filter(Boolean)
    .join(',');

  const emailSet = new Set<string>();

  // Split on commas, trim whitespace, and lowercase
  combined.split(',').forEach(item => {
    const trimmed = item.trim().toLowerCase();
    if (trimmed) {
      emailSet.add(trimmed);
    }
  });

  // Default admin emails to guarantee that designated administrators always have clearance
  const defaultAdmins = [
    'andejaswanth123@gmail.com',
    'demomail12123@gmail.com',
    'admin@mospi.gov.in'
  ];
  for (const def of defaultAdmins) {
    emailSet.add(def.toLowerCase());
  }

  return Array.from(emailSet);
}

/**
 * Checks if the given email belongs to the configured admin emails list.
 * Case-insensitive comparison with whitespace trimmed.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const adminList = getAdminEmails();
  return adminList.includes(normalized);
}

/**
 * Computes role purely from email and server-side ADMIN_EMAILS / ADMIN_EMAIL configuration.
 * Defaults to 'PUBLIC' for every account except designated administrators.
 */
export function computeRole(email?: string | null): 'ADMIN' | 'PUBLIC' {
  return isAdminEmail(email) ? 'ADMIN' : 'PUBLIC';
}

/**
 * Helper to ensure a Supabase auth.users UUID exists for the given email
 */
async function resolveAuthUserUuid(email: string, candidateId?: string, name?: string): Promise<string> {
  const isUuid = candidateId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId);
  if (isUuid) return candidateId!;

  if (!supabaseClient) {
    return candidateId || `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
  }

  try {
    const { data } = await supabaseClient.auth.admin.listUsers();
    const found = (data?.users as any[])?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      return found.id;
    }

    // Create user in Supabase auth
    const { data: newUser, error } = await supabaseClient.auth.admin.createUser({
      email,
      password: 'DefaultPass#2024',
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0] }
    });

    if (!error && newUser?.user) {
      return newUser.user.id;
    }
  } catch (err) {
    console.warn('[Supabase Auth] Could not resolve auth user UUID:', err);
  }

  return candidateId || `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Synchronize profile to Supabase `profiles` table and local cache.
 * Sets role = 'ADMIN' if email matches ADMIN_EMAILS / ADMIN_EMAIL, or if already ADMIN in profiles.
 */
export async function syncProfile(id: string, email: string, name?: string): Promise<UserSession> {
  const normalizedEmail = email.trim().toLowerCase();
  let role = computeRole(normalizedEmail);
  const displayName = name || normalizedEmail.split('@')[0].toUpperCase();

  // Ensure we have the valid auth.users UUID
  const resolvedId = await resolveAuthUserUuid(normalizedEmail, id, displayName);

  // If role is not yet ADMIN from configured emails list, check if Supabase profiles table already has role = 'ADMIN'
  // (prevents resetting an account to PUBLIC if an administrator manually granted ADMIN in Supabase)
  if (role !== 'ADMIN' && supabaseClient) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedId);
      if (isUuid) {
        const { data: existingProfile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', resolvedId)
          .maybeSingle();
        if (existingProfile?.role === 'ADMIN') {
          role = 'ADMIN';
        }
      }
    } catch (err) {
      // Fall back to computed role
    }
  }

  const designation = role === 'ADMIN' ? 'Chief Vigilance Officer (Admin)' : 'Public Scheme Observer';
  const department = role === 'ADMIN' 
    ? 'Ministry of Statistics & Programme Implementation' 
    : 'Public Citizen / Researcher';

  const sessionUser: UserSession = {
    id: resolvedId,
    email: normalizedEmail,
    role,
    name: displayName,
    designation,
    department
  };

  // 1. Update local cache
  localProfiles[normalizedEmail] = sessionUser;
  localProfiles[resolvedId] = sessionUser;
  saveProfilesToFile(localProfiles);

  // 2. Sync to Supabase `profiles` table (idempotent upsert with verified role)
  if (supabaseClient) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedId);
      if (isUuid) {
        const { error } = await supabaseClient
          .from('profiles')
          .upsert({
            id: resolvedId,
            email: normalizedEmail,
            role
          }, { onConflict: 'id' });

        if (error) {
          console.error('[Supabase Profiles Error]:', error.message);
        } else {
          console.log(`[Supabase Profiles] Profile synced for ${normalizedEmail} (role: ${role}, id: ${resolvedId})`);
        }
      }
    } catch (err: any) {
      console.error('[Supabase Profiles Exception]:', err.message);
    }
  }

  return sessionUser;
}

/**
 * Verify a bearer token (Supabase JWT or issued server token)
 * Returns the verified UserSession with strictly computed role.
 */
export async function verifyToken(token?: string | null): Promise<UserSession | null> {
  if (!token) return null;

  // Check in-memory session token store first
  const existing = sessionTokens.get(token);
  if (existing && existing.expiresAt > Date.now()) {
    // Re-verify role dynamically against current process.env.ADMIN_EMAILS / ADMIN_EMAIL
    const currentRole = computeRole(existing.user.email);
    existing.user.role = currentRole;
    return existing.user;
  }

  // If token is a Supabase JWT (3 segments separated by dots)
  if (token.includes('.') && supabaseClient) {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      if (!error && user && user.email) {
        const verifiedUser = await syncProfile(
          user.id,
          user.email,
          user.user_metadata?.full_name || user.user_metadata?.name
        );
        // Cache session for 15 minutes
        sessionTokens.set(token, {
          user: verifiedUser,
          expiresAt: Date.now() + 15 * 60 * 1000
        });
        return verifiedUser;
      }
    } catch (err) {
      console.warn('Supabase token verification error:', err);
    }
  }

  // Check local profile by token key if applicable
  if (token.startsWith('mplad_sess_')) {
    const email = token.replace('mplad_sess_', '').split('_')[0];
    if (email && localProfiles[email.toLowerCase()]) {
      const u = localProfiles[email.toLowerCase()];
      u.role = computeRole(u.email);
      return u;
    }
  }

  return null;
}

/**
 * Register a server session token for an authenticated user
 */
export function createServerSession(user: UserSession): string {
  const token = `mplad_sess_${encodeURIComponent(user.email)}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  sessionTokens.set(token, {
    user,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return token;
}

/**
 * Express Middleware: extracts user from Bearer token
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7).trim() 
    : (req.query.token as string | undefined);

  if (token) {
    const user = await verifyToken(token);
    if (user) {
      (req as any).user = user;
    }
  }
  next();
}

/**
 * Express Middleware: strictly requires ADMIN role.
 * Returns 403 if role is not 'ADMIN', or 401 if unauthenticated.
 */
export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const user: UserSession | undefined = (req as any).user;

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in.',
      code: 'UNAUTHORIZED'
    });
  }

  if (user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Access restricted: Administrative privileges required. Only the designated ADMIN account has permission to access this resource or perform actions.',
      code: 'FORBIDDEN',
      role: user.role
    });
  }

  next();
}

/**
 * Get the Supabase client instance
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Controller: Handle email/password login
 */
export async function handleLogin(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let userSession: UserSession | null = null;
  let sessionToken: string | null = null;

  // Try Supabase auth if configured
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (!error && data.user) {
        userSession = await syncProfile(
          data.user.id,
          normalizedEmail,
          data.user.user_metadata?.full_name || data.user.user_metadata?.name
        );
        sessionToken = data.session?.access_token || createServerSession(userSession);
      }
    } catch (err) {
      console.warn('Supabase signInWithPassword fallback to local auth:', err);
    }
  }

  // Fallback to local session creation
  if (!userSession) {
    const id = `usr_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`;
    userSession = await syncProfile(id, normalizedEmail);
    sessionToken = createServerSession(userSession);
  }

  return res.json({
    token: sessionToken,
    user: userSession
  });
}

/**
 * Controller: Handle email/password sign-up
 */
export async function handleSignup(req: Request, res: Response) {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let userSession: UserSession | null = null;
  let sessionToken: string | null = null;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: name || normalizedEmail.split('@')[0] }
        }
      });

      if (!error && data.user) {
        userSession = await syncProfile(
          data.user.id,
          normalizedEmail,
          name
        );
        sessionToken = data.session?.access_token || createServerSession(userSession);
      } else if (error) {
        return res.status(400).json({ error: error.message });
      }
    } catch (err: any) {
      console.warn('Supabase signUp error fallback:', err);
    }
  }

  if (!userSession) {
    const id = `usr_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`;
    userSession = await syncProfile(id, normalizedEmail, name);
    sessionToken = createServerSession(userSession);
  }

  return res.json({
    token: sessionToken,
    user: userSession
  });
}

/**
 * Controller: Verify session from token or OAuth user data
 * Re-reads role from server-side process.env.ADMIN_EMAILS / ADMIN_EMAIL — never trusts client role.
 */
export async function handleVerifySession(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7).trim() 
    : (req.body.token || req.query.token as string | undefined);

  const { email, id, name } = req.body;

  // If token is provided, verify it
  if (token) {
    const verified = await verifyToken(token);
    if (verified) {
      return res.json({
        valid: true,
        user: verified,
        token
      });
    }
  }

  // If email is provided (e.g. from client Supabase OAuth sign-in)
  if (email) {
    const userId = id || `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
    const synced = await syncProfile(userId, email, name);
    const newSessionToken = token || createServerSession(synced);
    return res.json({
      valid: true,
      user: synced,
      token: newSessionToken
    });
  }

  return res.status(401).json({
    valid: false,
    error: 'No active session or valid credentials found.'
  });
}
