import { getConfig, saveConfig } from '../utils/config.js';

const API_BASE = 'https://clawsouls.ai/api/v1';

export async function loginCommand(token: string): Promise<void> {
  if (!token) {
    console.error('Usage: clawsouls login <token>');
    console.error('');
    console.error('Get your token at: https://clawsouls.ai/dashboard');
    process.exit(1);
  }

  if (!token.startsWith('cs_')) {
    console.error('Error: Invalid token format. Token should start with "cs_".');
    process.exit(1);
  }

  // Verify the token
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error('Error: Invalid or expired token.');
      process.exit(1);
    }
    const data = await res.json();
    const username = data.user?.username || data.user?.name || 'unknown';

    saveConfig({ auth: { token } });
    console.log(`✅ Logged in as @${username}`);
    console.log(`   Token saved to ~/.clawsouls/config.json`);
  } catch (err: any) {
    console.error(`Error: ${err.message || 'Network error'}`);
    process.exit(1);
  }
}

export async function logoutCommand(): Promise<void> {
  const config = getConfig();
  if (!config.auth?.token) {
    console.log('Not logged in.');
    return;
  }

  saveConfig({ auth: {} });
  console.log('✅ Logged out. Token removed from config.');
}

export async function whoamiCommand(): Promise<void> {
  const config = getConfig();
  const token = process.env.CLAWSOULS_TOKEN || config.auth?.token;

  if (!token) {
    console.error('Not logged in.');
    console.error('Run: clawsouls login <token>');
    process.exit(1);
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error('Error: Invalid or expired token.');
      process.exit(1);
    }
    const data = await res.json();
    const username = data.user?.username || data.user?.name || 'unknown';
    console.log(`@${username}`);
  } catch (err: any) {
    console.error(`Error: ${err.message || 'Network error'}`);
    process.exit(1);
  }
}
