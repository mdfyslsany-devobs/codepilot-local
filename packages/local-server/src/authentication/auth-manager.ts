import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export class AuthManager {
  private token: string;
  private tokenPath: string;

  constructor(customDataDir?: string) {
    const dataDir = customDataDir || join(homedir(), '.codepilot-local');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.tokenPath = join(dataDir, 'auth.token');
    this.token = this.loadOrGenerateToken();
  }

  private loadOrGenerateToken(): string {
    if (existsSync(this.tokenPath)) {
      try {
        const stored = readFileSync(this.tokenPath, 'utf8').trim();
        if (stored.length >= 32) {
          return stored;
        }
      } catch {
        // Fallback to regeneration if read fails
      }
    }

    const generated = randomBytes(32).toString('hex');
    writeFileSync(this.tokenPath, generated, { encoding: 'utf8', mode: 0o600 });
    return generated;
  }

  public getToken(): string {
    return this.token;
  }

  public validateToken(candidate: string): boolean {
    if (!candidate) return false;
    // Constant-time length and value check
    if (candidate.length !== this.token.length) return false;
    let match = true;
    for (let i = 0; i < this.token.length; i++) {
      if (candidate[i] !== this.token[i]) {
        match = false;
      }
    }
    return match;
  }
}
