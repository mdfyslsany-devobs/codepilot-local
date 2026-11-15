import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthManager } from '../authentication/auth-manager.js';
import { ErrorCode } from '@codepilot/shared';

const ALLOWED_HOST_PATTERNS = [
  /^localhost(:\d+)?$/,
  /^127\.0\.0\.1(:\d+)?$/
];

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^tauri:\/\/localhost$/,
  /^vscode-webview:\/\/.*$/
];

export function createSecurityHooks(authManager: AuthManager) {
  return {
    validateHostAndOrigin: async (request: FastifyRequest, reply: FastifyReply) => {
      const host = request.headers.host;
      if (!host || !ALLOWED_HOST_PATTERNS.some((p) => p.test(host))) {
        return reply.status(403).send({
          success: false,
          error: ErrorCode.FORBIDDEN,
          message: 'Invalid Host header. Only localhost/127.0.0.1 allowed.'
        });
      }

      const origin = request.headers.origin;
      if (origin && !ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))) {
        return reply.status(403).send({
          success: false,
          error: ErrorCode.FORBIDDEN,
          message: 'Invalid Origin header. Cross-origin access blocked.'
        });
      }
    },

    requireAuthentication: async (request: FastifyRequest, reply: FastifyReply) => {
      // Allow health probe without authentication for liveness monitors
      if (request.url.startsWith('/api/v1/health')) {
        return;
      }

      const authHeader = request.headers.authorization;
      const apiKeyHeader = request.headers['x-api-key'];

      let token = '';
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (typeof apiKeyHeader === 'string') {
        token = apiKeyHeader.trim();
      }

      if (!token || !authManager.validateToken(token)) {
        return reply.status(401).send({
          success: false,
          error: ErrorCode.UNAUTHORIZED,
          message: 'Missing or invalid authentication token.'
        });
      }
    }
  };
}
