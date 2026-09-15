import type { IOSSimulator } from '@monaddesign/client-contract';
import type { SimulatorDeviceGlyphMetrics } from '@monaddesign/device-frame';

import { simulatorDeviceGlyphMetrics } from '@monaddesign/device-frame';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

function ScreenArtwork({ palette }: { palette: SimulatorDeviceGlyphMetrics['artwork']['screen'] }) {
  return (
    <Svg
      height="100%"
      width="100%"
    >
      <Defs>
        <LinearGradient
          id="device-screen-base"
          x1="0%"
          x2="100%"
          y1="0%"
          y2="100%"
        >
          <Stop
            offset="0%"
            stopColor={palette.base}
          />
          <Stop
            offset="48%"
            stopColor={palette.middle}
          />
          <Stop
            offset="71%"
            stopColor={palette.bridge}
          />
          <Stop
            offset="100%"
            stopColor={palette.end}
          />
        </LinearGradient>
        <RadialGradient
          cx="70%"
          cy="24%"
          id="device-screen-glow"
          r="45%"
        >
          <Stop
            offset="0%"
            stopColor={palette.glow}
            stopOpacity="0.9"
          />
          <Stop
            offset="100%"
            stopColor={palette.glow}
            stopOpacity="0"
          />
        </RadialGradient>
        <RadialGradient
          cx="26%"
          cy="76%"
          id="device-screen-bloom"
          r="54%"
        >
          <Stop
            offset="0%"
            stopColor={palette.bloom}
          />
          <Stop
            offset="100%"
            stopColor={palette.bloom}
            stopOpacity="0"
          />
        </RadialGradient>
      </Defs>
      <Rect
        fill="url(#device-screen-base)"
        height="100%"
        width="100%"
      />
      <Rect
        fill="url(#device-screen-glow)"
        height="100%"
        width="100%"
      />
      <Rect
        fill="url(#device-screen-bloom)"
        height="100%"
        width="100%"
      />
    </Svg>
  );
}

function ShellArtwork({ palette }: { palette: SimulatorDeviceGlyphMetrics['artwork']['shell'] }) {
  return (
    <Svg
      height="100%"
      style={StyleSheet.absoluteFill}
      width="100%"
    >
      <Defs>
        <LinearGradient
          id="device-shell"
          x1="0%"
          x2="100%"
          y1="0%"
          y2="100%"
        >
          <Stop
            offset="0%"
            stopColor={palette.start}
          />
          <Stop
            offset="52%"
            stopColor={palette.middle}
          />
          <Stop
            offset="100%"
            stopColor={palette.end}
          />
        </LinearGradient>
      </Defs>
      <Rect
        fill="url(#device-shell)"
        height="100%"
        width="100%"
      />
    </Svg>
  );
}

function DeviceSurface({ metrics }: { metrics: SimulatorDeviceGlyphMetrics }) {
  const { artwork, height, outerRadius, screenRadius, width } = metrics;

  return (
    <View
      style={[
        styles.shell,
        {
          width,
          height,
          borderRadius: metrics.kind === 'watch' ? width * 0.34 : outerRadius
        }
      ]}
    >
      <ShellArtwork palette={artwork.shell} />
      <View
        style={[
          styles.screen,
          {
            borderRadius: metrics.kind === 'watch' ? width * 0.33 : screenRadius
          }
        ]}
      >
        <ScreenArtwork palette={artwork.screen} />
      </View>
    </View>
  );
}

function TelevisionSurface({ metrics }: { metrics: SimulatorDeviceGlyphMetrics }) {
  return (
    <View style={{ width: metrics.width, height: metrics.height }}>
      <View style={[styles.tvPanel, { width: metrics.width, height: metrics.height - 3 }]}>
        <ShellArtwork palette={metrics.artwork.shell} />
        <View style={styles.tvScreen}>
          <ScreenArtwork palette={metrics.artwork.screen} />
        </View>
      </View>
      <View style={styles.tvStand} />
    </View>
  );
}

function WatchSurface({ simulator, metrics }: { simulator: IOSSimulator; metrics: SimulatorDeviceGlyphMetrics }) {
  const chrome = simulator.deviceChrome;
  if (!chrome) {
    return (
      <View style={{ width: metrics.width + 2, height: metrics.height }}>
        <DeviceSurface metrics={metrics} />
        <View style={styles.watchCrown} />
      </View>
    );
  }

  const height = metrics.height;
  const width = (height * chrome.frame.width) / chrome.frame.height;
  const screenWidth = simulator.screen?.width ?? chrome.screen.width;
  const screenHeight = simulator.screen?.height ?? chrome.screen.height;
  const screenX = chrome.body.x + (chrome.body.width - screenWidth) / 2;
  const screenY = chrome.body.y + (chrome.body.height - screenHeight) / 2;
  return (
    <View style={{ width, height }}>
      <View
        style={[
          styles.nativeWatchScreen,
          {
            left: (width * screenX) / chrome.frame.width,
            top: (height * screenY) / chrome.frame.height,
            width: (width * screenWidth) / chrome.frame.width,
            height: (height * screenHeight) / chrome.frame.height
          }
        ]}
      >
        <ScreenArtwork palette={metrics.artwork.screen} />
      </View>
      <Image
        resizeMode="stretch"
        source={{ uri: chrome.image }}
        style={{ width, height }}
      />
    </View>
  );
}

export function SimulatorDeviceGlyph({ simulator }: { simulator: IOSSimulator }) {
  const metrics = simulatorDeviceGlyphMetrics({
    deviceName: simulator.name,
    runtime: simulator.runtime,
    productFamily: simulator.productFamily,
    screen: simulator.screen
  });
  const { height, width } = metrics;
  const surface = <DeviceSurface metrics={metrics} />;

  return (
    <View
      accessible={false}
      style={styles.container}
    >
      {metrics.kind === 'tv' ? (
        <TelevisionSurface metrics={metrics} />
      ) : metrics.kind === 'watch' ? (
        <WatchSurface
          metrics={metrics}
          simulator={simulator}
        />
      ) : simulator.framebufferMask ? (
        <MaskedView
          maskElement={
            <Image
              resizeMode="contain"
              source={{ uri: simulator.framebufferMask }}
              style={{ width, height }}
            />
          }
          style={{ width, height }}
        >
          {surface}
        </MaskedView>
      ) : (
        surface
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  shell: {
    overflow: 'hidden',
    backgroundColor: '#777c84',
    padding: 1,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 0.5,
    shadowOffset: { width: 0, height: 0.5 }
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#081852'
  },
  tvPanel: {
    overflow: 'hidden',
    borderRadius: 2,
    padding: 1,
    backgroundColor: '#777c84'
  },
  tvScreen: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 1
  },
  tvStand: {
    position: 'absolute',
    bottom: 0,
    left: '23%',
    width: '54%',
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#82878e'
  },
  watchCrown: {
    position: 'absolute',
    right: 0,
    top: '30%',
    width: 2,
    height: 5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#7b8088'
  },
  nativeWatchScreen: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 5
  }
});
