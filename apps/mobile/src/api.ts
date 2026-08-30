import type { ClientConnection } from './types';

import { ClientApi as SharedClientApi } from '@monaddesign/client-rtk';

export class ClientApi extends SharedClientApi<ClientConnection & { accessToken: string }> {
  constructor(connection: ClientConnection) {
    super(
      {
        origin: connection.origin,
        accessToken: connection.pairingCode,
        pairingCode: connection.pairingCode
      },
      'companion'
    );
  }
}
