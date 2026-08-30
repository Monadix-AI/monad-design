import { Elysia } from 'elysia';

import { CoreApiError } from './api-error';

const tokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : (new URL(request.url).searchParams.get('accessToken') ?? new URL(request.url).searchParams.get('pairingCode'));
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
