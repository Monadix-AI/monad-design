import ClipboardCopyIcon from '@hugeicons/core-free-icons/ClipboardCopyIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { createPairingPayload } from '@monaddesign/pairing';
import { AppHeaderFrame } from '@monaddesign/ui/business/live-session/app-frame';
import { useClientTheme } from '@monaddesign/ui/business/live-session/theme';
import { Popover } from 'radix-ui';
import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react';

import { useDesktopApp } from '@/desktop-app-provider';
import { ActionIcon } from './action-icon';

const loadPairingQrCode = () => import('./pairing-qr-code');
const PairingQrCode = lazy(loadPairingQrCode);

export function AppHeader({ center }: { center?: ReactNode }) {
  const { remoteClient } = useDesktopApp();
  const { setTheme, theme } = useClientTheme();
  const [copiedPairingValue, setCopiedPairingValue] = useState<'code' | 'origin' | null>(null);
  const remoteClientOrigin = remoteClient?.addresses[0]
    ? `http://${remoteClient.addresses[0]}:${remoteClient.port}`
    : null;
  const pairingPayload =
    remoteClient && remoteClientOrigin
      ? createPairingPayload({
          origin: remoteClientOrigin,
          pairingCode: remoteClient.pairingCode
        })
      : null;

  useEffect(() => {
    if (!copiedPairingValue) return;
    const timeout = window.setTimeout(() => setCopiedPairingValue(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copiedPairingValue]);

  const copyPairingValue = async (kind: 'code' | 'origin', value: string | null | undefined) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPairingValue(kind);
    } catch {
      setCopiedPairingValue(null);
    }
  };

  return (
    <AppHeaderFrame
      actions={
        <>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                className="header-action"
                disabled={!remoteClient}
                onFocus={() => void loadPairingQrCode()}
                onPointerEnter={() => void loadPairingQrCode()}
                type="button"
              >
                <ActionIcon icon={QrCodeIcon} />
                Pair
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                className="header-popover pairing-popover"
                sideOffset={8}
              >
                <div className="header-popover-heading">
                  <div>
                    <strong>Pair mobile</strong>
                    <span>Same local network</span>
                  </div>
                  <span className="pairing-ready">
                    <span /> Ready
                  </span>
                </div>
                {pairingPayload && (
                  <div
                    aria-label="Pairing QR code"
                    className="pairing-qr"
                    role="img"
                  >
                    <Suspense
                      fallback={
                        <span
                          aria-hidden="true"
                          style={{ display: 'block', height: 156, width: 156 }}
                        />
                      }
                    >
                      <PairingQrCode value={pairingPayload} />
                    </Suspense>
                  </div>
                )}
                <div className="pairing-code-block">
                  <div>
                    <span>PAIRING CODE</span>
                    <strong>{remoteClient?.pairingCode}</strong>
                  </div>
                  <button
                    aria-label={copiedPairingValue === 'code' ? 'Pairing code copied' : 'Copy pairing code'}
                    className="pairing-copy-button"
                    disabled={!remoteClient?.pairingCode}
                    onClick={() => void copyPairingValue('code', remoteClient?.pairingCode)}
                    title={copiedPairingValue === 'code' ? 'Copied' : 'Copy pairing code'}
                    type="button"
                  >
                    <ActionIcon icon={copiedPairingValue === 'code' ? Tick02Icon : ClipboardCopyIcon} />
                  </button>
                </div>
                <div className="pairing-origin-row">
                  <code title={remoteClientOrigin ?? undefined}>
                    {remoteClientOrigin ?? 'Connect this Mac to a local network'}
                  </code>
                  <button
                    aria-label={copiedPairingValue === 'origin' ? 'Client address copied' : 'Copy client address'}
                    className="pairing-copy-button"
                    disabled={!remoteClientOrigin}
                    onClick={() => void copyPairingValue('origin', remoteClientOrigin)}
                    title={copiedPairingValue === 'origin' ? 'Copied' : 'Copy client address'}
                    type="button"
                  >
                    <ActionIcon icon={copiedPairingValue === 'origin' ? Tick02Icon : ClipboardCopyIcon} />
                  </button>
                </div>
                <span
                  aria-live="polite"
                  className="sr-only"
                >
                  {copiedPairingValue === 'code'
                    ? 'Pairing code copied.'
                    : copiedPairingValue === 'origin'
                      ? 'Client address copied.'
                      : ''}
                </span>
                <small>Scan once to browse projects available on this Mac.</small>
                <Popover.Arrow className="header-popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                aria-label="Settings"
                className="header-icon-button"
                title="Settings"
                type="button"
              >
                <ActionIcon icon={Settings02Icon} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                className="header-popover settings-popover"
                sideOffset={8}
              >
                <div className="header-popover-heading">
                  <div>
                    <strong>Settings</strong>
                    <span>Desktop appearance</span>
                  </div>
                </div>
                <fieldset
                  aria-label="Theme"
                  className="theme-options"
                >
                  <button
                    aria-pressed={theme === 'system'}
                    onClick={() => setTheme('system')}
                    type="button"
                  >
                    Auto
                  </button>
                  <button
                    aria-pressed={theme === 'light'}
                    onClick={() => setTheme('light')}
                    type="button"
                  >
                    Light
                  </button>
                  <button
                    aria-pressed={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                    type="button"
                  >
                    Dark
                  </button>
                </fieldset>
                <p>Auto follows macOS. Simulator appearance stays independent.</p>
                <Popover.Arrow className="header-popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </>
      }
      center={center}
    />
  );
}
