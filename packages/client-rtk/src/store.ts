import type { ClientExtra } from './endpoint-helpers';
import type { CoreTreaty } from './treaty-client';

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query/react';

import { coreApi } from './api-slice';

export const createClientStore = (client: CoreTreaty) => {
  const extra: ClientExtra = { client };
  const store = configureStore({
    reducer: { [coreApi.reducerPath]: coreApi.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: extra } }).concat(coreApi.middleware)
  });
  setupListeners(store.dispatch);
  return store;
};

export type ClientStore = ReturnType<typeof createClientStore>;
