import { QRCodeSVG } from 'qrcode.react';

export default function PairingQrCode({ value }: { value: string }) {
  return (
    <QRCodeSVG
      bgColor="#ffffff"
      fgColor="#0d0d0d"
      level="M"
      marginSize={2}
      size={156}
      value={value}
    />
  );
}
