import { Elysia } from 'elysia';

import { CoreApiError } from './api-error';

export const localSessionCookieName = 'monad_design_local_session';

const cookieValue = (request: Request, name: string) => {
  const encoded = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)
    ?.slice(1)
    .join('=');
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

const tokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : (new URL(request.url).searchParams.get('accessToken') ??
        new URL(request.url).searchParams.get('pairingCode') ??
        cookieValue(request, localSessionCookieName));
};

export const createPairingAuth = (accessTokens: string | readonly string[]) => {
  const tokens = new Set(typeof accessTokens === 'string' ? [accessTokens] : accessTokens);
  return new Elysia({
    name: 'core.pairing-auth',
    seed: [...tokens].join(':')
  })
    .onBeforeHandle(({ request }) => {
      const token = tokenFromRequest(request);
      if (!token || !tokens.has(token)) {
        throw new CoreApiError(401, 'UNAUTHORIZED', 'The pairing code is invalid.');
      }
    })
    .as('scoped');
};
