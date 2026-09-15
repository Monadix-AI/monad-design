import { ClipboardCopyIcon, QrCodeIcon, Settings02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { createPairingPayload } from '@monaddesign/pairing';
import { AppHeaderFrame } from '@monaddesign/ui/business/live-session/app-frame';
import { useClientTheme } from '@monaddesign/ui/business/live-session/theme';
import { InstrumentButton } from '@monaddesign/ui/primitives/instrument-button';
import { springSwap } from '@monaddesign/ui/primitives/motion';
import { motion, useReducedMotion } from 'motion/react';
import { Popover } from 'radix-ui';
import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react';

import { useDesktopApp } from '@/desktop-app-provider';
import { ActionIcon } from './action-icon';

const loadPairingQrCode = () => import('./pairing-qr-code');
const PairingQrCode = lazy(loadPairingQrCode);

export function AppHeader({ center }: { center?: ReactNode }) {
  const { remoteClient } = useDesktopApp();
  const { setTheme, theme } = useClientTheme();
  const reduceMotion = useReducedMotion();
  const [pairingCopyError, setPairingCopyError] = useState<string | null>(null);
  const [copiedPairingValue, setCopiedPairingValue] = useState<'code' | 'origin' | null>(null);
  const remoteClientOrigin = remoteClient?.addresses[0]
    ? `http://${remoteClient.addresses[0]}:${remoteClient.port}`
    : null;
  const fallbackOrigins =
    remoteClient?.addresses.slice(1).map((address) => `http://${address}:${remoteClient.port}`) ?? [];
  const pairingPayload =
    remoteClient && remoteClientOrigin
      ? createPairingPayload({
          origin: remoteClientOrigin,
          pairingCode: remoteClient.pairingCode,
          fallbackOrigins
        })
      : null;

  useEffect(() => {
    if (!copiedPairingValue) return;
    const timeout = window.setTimeout(() => setCopiedPairingValue(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copiedPairingValue]);

  const copyPairingValue = async (kind: 'code' | 'origin', value: string | null | undefined) => {
    if (!value) return;
    setPairingCopyError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPairingValue(kind);
    } catch {
      setCopiedPairingValue(null);
      setPairingCopyError(
        `Could not copy ${kind === 'code' ? 'pairing code' : 'client address'}. Try again or select and copy the value manually.`
      );
    }
  };

  return (
    <AppHeaderFrame
      actions={
        <>
          <Popover.Root>
            <Popover.Trigger asChild>
              <InstrumentButton
                className="header-action"
                disabled={!remoteClient}
                onFocus={() => void loadPairingQrCode()}
                onPointerEnter={() => void loadPairingQrCode()}
                type="button"
              >
                <ActionIcon icon={QrCodeIcon} />
                Pair
              </InstrumentButton>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                asChild
                sideOffset={8}
              >
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="header-popover pairing-popover"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: -6 }}
                  transition={reduceMotion ? { duration: 0 } : springSwap}
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
                    <InstrumentButton
                      aria-label={copiedPairingValue === 'code' ? 'Pairing code copied' : 'Copy pairing code'}
                      className="pairing-copy-button"
                      disabled={!remoteClient?.pairingCode}
                      onClick={() => void copyPairingValue('code', remoteClient?.pairingCode)}
                      title={copiedPairingValue === 'code' ? 'Copied' : 'Copy pairing code'}
                      type="button"
                    >
                      <ActionIcon icon={copiedPairingValue === 'code' ? Tick02Icon : ClipboardCopyIcon} />
                    </InstrumentButton>
                  </div>
                  <div className="pairing-origin-row">
                    <code title={remoteClientOrigin ?? undefined}>
                      {remoteClientOrigin ?? 'Connect this Mac to a local network'}
                    </code>
                    <InstrumentButton
                      aria-label={copiedPairingValue === 'origin' ? 'Client address copied' : 'Copy client address'}
                      className="pairing-copy-button"
                      disabled={!remoteClientOrigin}
                      onClick={() => void copyPairingValue('origin', remoteClientOrigin)}
                      title={copiedPairingValue === 'origin' ? 'Copied' : 'Copy client address'}
                      type="button"
                    >
                      <ActionIcon icon={copiedPairingValue === 'origin' ? Tick02Icon : ClipboardCopyIcon} />
                    </InstrumentButton>
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
                  {pairingCopyError && (
                    <p
                      className="pairing-copy-error"
                      role="alert"
                    >
                      {pairingCopyError}
                    </p>
                  )}
                  <small>Scan once to browse projects available on this Mac.</small>
                  <Popover.Arrow className="header-popover-arrow" />
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Popover.Root>
            <Popover.Trigger asChild>
              <InstrumentButton
                aria-label="Settings"
                className="header-icon-button"
                title="Settings"
                type="button"
              >
                <ActionIcon icon={Settings02Icon} />
              </InstrumentButton>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                asChild
                sideOffset={8}
              >
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="header-popover settings-popover"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: -6 }}
                  transition={reduceMotion ? { duration: 0 } : springSwap}
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
                    <InstrumentButton
                      aria-pressed={theme === 'system'}
                      onClick={() => setTheme('system')}
                      type="button"
                    >
                      Auto
                    </InstrumentButton>
                    <InstrumentButton
                      aria-pressed={theme === 'light'}
                      onClick={() => setTheme('light')}
                      type="button"
                    >
                      Light
                    </InstrumentButton>
                    <InstrumentButton
                      aria-pressed={theme === 'dark'}
                      onClick={() => setTheme('dark')}
                      type="button"
                    >
                      Dark
                    </InstrumentButton>
                  </fieldset>
                  <p>Auto follows macOS. Simulator appearance stays independent.</p>
                  <Popover.Arrow className="header-popover-arrow" />
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </>
      }
      center={center}
    />
  );
}
