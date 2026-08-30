import type { ClientApiError } from './endpoint-helpers';

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const coreApi = createApi({
  reducerPath: 'coreApi',
  baseQuery: fakeBaseQuery<ClientApiError>(),
  tagTypes: ['Health', 'Projects', 'Simulators', 'Simulator', 'AgentSession'],
  endpoints: () => ({})
});
