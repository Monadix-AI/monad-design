import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native';

import { createThemedStyles } from '../theme';

const edgeObjects = {
  bag: require('../../../../packages/ui/src/assets/edge-objects/bag.png'),
  brush: require('../../../../packages/ui/src/assets/edge-objects/brush.png'),
  bulb: require('../../../../packages/ui/src/assets/edge-objects/bulb.png'),
  calculator: require('../../../../packages/ui/src/assets/edge-objects/calculator.png'),
  calender: require('../../../../packages/ui/src/assets/edge-objects/calender.png'),
  can: require('../../../../packages/ui/src/assets/edge-objects/can.png'),
  camera: require('../../../../packages/ui/src/assets/edge-objects/camera.png'),
  chess: require('../../../../packages/ui/src/assets/edge-objects/chess.png'),
  clock: require('../../../../packages/ui/src/assets/edge-objects/clock.png'),
  'color-palette': require('../../../../packages/ui/src/assets/edge-objects/color-palette.png'),
  computer: require('../../../../packages/ui/src/assets/edge-objects/computer.png'),
  glass: require('../../../../packages/ui/src/assets/edge-objects/glass.png'),
  headphone: require('../../../../packages/ui/src/assets/edge-objects/headphone.png'),
  key: require('../../../../packages/ui/src/assets/edge-objects/key.png'),
  laptop: require('../../../../packages/ui/src/assets/edge-objects/laptop.png'),
  mic: require('../../../../packages/ui/src/assets/edge-objects/mic.png'),
  mobile: require('../../../../packages/ui/src/assets/edge-objects/mobile.png'),
  notebook: require('../../../../packages/ui/src/assets/edge-objects/notebook.png'),
  'paint-kit': require('../../../../packages/ui/src/assets/edge-objects/paint-kit.png'),
  pencil: require('../../../../packages/ui/src/assets/edge-objects/pencil.png'),
  picture: require('../../../../packages/ui/src/assets/edge-objects/picture.png'),
  scissor: require('../../../../packages/ui/src/assets/edge-objects/scissor.png'),
  'sparkling-water': require('../../../../packages/ui/src/assets/edge-objects/sparkling-water.png'),
  'takeaway-cup': require('../../../../packages/ui/src/assets/edge-objects/takeaway-cup.png'),
  'tea-cup': require('../../../../packages/ui/src/assets/edge-objects/tea-cup.png'),
  travel: require('../../../../packages/ui/src/assets/edge-objects/travel.png'),
  umbrella: require('../../../../packages/ui/src/assets/edge-objects/umbrella.png'),
  wallet: require('../../../../packages/ui/src/assets/edge-objects/wallet.png')
} satisfies Record<string, ImageSourcePropType>;

type EdgeObject = keyof typeof edgeObjects;

interface EdgeSlot {
  anchor: ViewStyle;
  driftX: number;
  driftY: number;
  duration: number;
  enterX: number;
  enterY: number;
  id: string;
  rotation: number;
  scale: number;
  stagger: number;
}

const edgeSlots: EdgeSlot[] = [
  {
    anchor: { left: '9%', top: -32 },
    driftX: 5,
    driftY: 8,
    duration: 12_000,
    enterX: 0,
    enterY: -48,
    id: 'top-left',
    rotation: -13,
    scale: 1,
    stagger: 0
  },
  {
    anchor: { left: '46%', top: -38 },
    driftX: 6,
    driftY: 7,
    duration: 12_100,
    enterX: 0,
    enterY: -46,
    id: 'top-center',
    rotation: 12,
    scale: 0.86,
    stagger: 240
  },
  {
    anchor: { right: '14%', top: -38 },
    driftX: -7,
    driftY: 8,
    duration: 13_400,
    enterX: 0,
    enterY: -50,
    id: 'top-right',
    rotation: 9,
    scale: 1.08,
    stagger: 120
  },
  {
    anchor: { left: -34, top: '22%' },
    driftX: 8,
    driftY: 8,
    duration: 12_800,
    enterX: -48,
    enterY: 0,
    id: 'left-upper',
    rotation: 8,
    scale: 1,
    stagger: 80
  },
  {
    anchor: { left: -30, top: '54%' },
    driftX: 7,
    driftY: 8,
    duration: 13_100,
    enterX: -52,
    enterY: 0,
    id: 'left-lower',
    rotation: -11,
    scale: 0.9,
    stagger: 320
  },
  {
    anchor: { right: -34, top: '27%' },
    driftX: -7,
    driftY: 8,
    duration: 11_900,
    enterX: 48,
    enterY: 0,
    id: 'right-upper',
    rotation: -15,
    scale: 1,
    stagger: 160
  },
  {
    anchor: { right: -28, top: '53%' },
    driftX: -6,
    driftY: 7,
    duration: 12_600,
    enterX: 46,
    enterY: 0,
    id: 'right-center',
    rotation: 14,
    scale: 0.88,
    stagger: 400
  },
  {
    anchor: { bottom: '5%', right: -28 },
    driftX: -5,
    driftY: 8,
    duration: 13_700,
    enterX: 42,
    enterY: 30,
    id: 'right-lower',
    rotation: 13,
    scale: 1,
    stagger: 480
  },
  {
    anchor: { bottom: '4%', left: -38 },
    driftX: 6,
    driftY: 8,
    duration: 14_200,
    enterX: -44,
    enterY: 34,
    id: 'bottom-left',
    rotation: 11,
    scale: 1.14,
    stagger: 360
  },
  {
    anchor: { bottom: -34, left: '31%' },
    driftX: 7,
    driftY: 8,
    duration: 11_700,
    enterX: 0,
    enterY: 48,
    id: 'bottom-center',
    rotation: -18,
    scale: 0.86,
    stagger: 560
  },
  {
    anchor: { bottom: -42, right: '18%' },
    driftX: 8,
    driftY: 8,
    duration: 12_500,
    enterX: 0,
    enterY: 52,
    id: 'bottom-right',
    rotation: -5,
    scale: 0.98,
    stagger: 640
  }
];

const shuffle = <T,>(items: readonly T[]) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as T, shuffled[index] as T];
  }
  return shuffled;
};

const selectEdgeObjects = (): EdgeObject[] => {
  const beverages: EdgeObject[] = ['can', 'glass', 'sparkling-water', 'takeaway-cup', 'tea-cup'];
  const beverage = beverages[Math.floor(Math.random() * beverages.length)] as EdgeObject;
  const guaranteed: EdgeObject[] = ['laptop', 'mobile', beverage];
  const candidates = (Object.keys(edgeObjects) as EdgeObject[]).filter((object) => !guaranteed.includes(object));
  return shuffle([...guaranteed, ...shuffle(candidates).slice(0, edgeSlots.length - guaranteed.length)]);
};

function EdgeObjectView({
  active,
  object,
  reducedMotion,
  size,
  slot
}: {
  active: boolean;
  object: EdgeObject;
  reducedMotion: boolean;
  size: number;
  slot: EdgeSlot;
}) {
  const local = useLocal();
  const entrance = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const entered = useRef(false);

  useEffect(() => {
    entrance.stopAnimation();
    float.stopAnimation();
    if (reducedMotion) {
      entrance.setValue(1);
      float.setValue(0);
      return;
    }
    if (!active) return;

    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          duration: slot.duration / 2,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(float, {
          duration: slot.duration / 2,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );
    if (entered.current) {
      drift.start();
      return () => drift.stop();
    }

    entrance.setValue(0);
    const arrival = Animated.timing(entrance, {
      delay: 260 + slot.stagger,
      duration: 720,
      easing: Easing.bezier(0.22, 0.78, 0.2, 1),
      toValue: 1,
      useNativeDriver: true
    });
    arrival.start(({ finished }) => {
      if (!finished) return;
      entered.current = true;
      drift.start();
    });
    return () => {
      arrival.stop();
      drift.stop();
    };
  }, [active, entrance, float, reducedMotion, slot.duration, slot.stagger]);

  const outerStyle: StyleProp<ViewStyle> = {
    opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 0.88] }),
    transform: [
      { translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [slot.enterX, 0] }) },
      { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [slot.enterY, -slot.driftY / 2] }) },
      { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.84, 0.98] }) }
    ]
  };
  const innerStyle: StyleProp<ViewStyle> = {
    transform: [
      { translateX: float.interpolate({ inputRange: [0, 1], outputRange: [0, slot.driftX] }) },
      { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, slot.driftY * 1.5] }) },
      {
        rotate: float.interpolate({
          inputRange: [0, 1],
          outputRange: [`${slot.rotation}deg`, `${slot.rotation + 3}deg`]
        })
      },
      { scale: float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.046] }) }
    ]
  };

  return (
    <Animated.View
      style={[local.object, slot.anchor, { height: size * slot.scale, width: size * slot.scale }, outerStyle]}
    >
      <Animated.View style={[local.objectInner, innerStyle]}>
        <Image
          source={edgeObjects[object]}
          style={local.image}
        />
      </Animated.View>
    </Animated.View>
  );
}

export function EdgeAtmosphere({ children }: { children: ReactNode }) {
  const local = useLocal();
  const { width } = useWindowDimensions();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const [reducedMotion, setReducedMotion] = useState(true);
  const objects = useMemo(selectEdgeObjects, []);
  const size = Math.max(58, Math.min(92, width * 0.095));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const appSubscription = AppState.addEventListener('change', (state) => setAppIsActive(state === 'active'));
    return () => {
      mounted = false;
      motionSubscription.remove();
      appSubscription.remove();
    };
  }, []);

  return (
    <View style={local.root}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={local.atmosphere}
      >
        {edgeSlots.map((slot, index) => (
          <EdgeObjectView
            active={appIsActive}
            key={slot.id}
            object={objects[index] as EdgeObject}
            reducedMotion={reducedMotion}
            size={size}
            slot={slot}
          />
        ))}
      </View>
      <View style={local.content}>{children}</View>
    </View>
  );
}

const useLocal = createThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
    atmosphere: { position: 'absolute', inset: 0 },
    content: { flex: 1, zIndex: 1 },
    object: {
      position: 'absolute',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.24,
      shadowRadius: 12
    },
    objectInner: { flex: 1 },
    image: { width: '100%', height: '100%', resizeMode: 'contain' }
  })
);
