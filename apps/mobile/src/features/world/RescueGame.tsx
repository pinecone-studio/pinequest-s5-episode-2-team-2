import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { mascotSources } from "../../components/mascots";
import { Text } from "../../components/ui";
import { useReduceMotion } from "../../components/useReduceMotion";
import { fonts } from "../../theme";
import { rescueCopy as copy } from "./copy";
import { CURTAIN_PRESETS, RESCUE_CHOICES, curtainLight, inZone, type RescueChoice } from "./logic";
import {
  ChoiceCard,
  GameCompletion,
  GameIntro,
  GameShell,
  SpeechBubble,
  useSuccessSound,
  world,
} from "./ui";

type Stage = "intro" | "phone" | "glare" | "rest" | "escape" | "done";
const LEVELS = 3;
const PHONE = { w: 40, h: 64 };
const FILL = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;

/**
 * Нүдхэний аврах ажиллагаа: three gentle puzzles in a magic bedroom teach a comfortable screen
 * distance, less glare and taking breaks. No timers and no failing: a wrong move just gets a hint.
 */
export function RescueGame({
  onComplete,
  onExit,
}: {
  onComplete: () => Promise<string | null>;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<Stage>("intro");
  const [starNote, setStarNote] = useState<string | null>(null);
  const done = { intro: 0, phone: 0, glare: 1, rest: 2, escape: 3, done: 3 }[stage];

  const finish = () => {
    setStage("done");
    void onComplete().then(setStarNote, () => setStarNote(null));
  };

  return (
    <GameShell title={copy.title} onExit={onExit} progress={{ done, total: LEVELS }}>
      {stage === "intro" ? (
        <GameIntro
          pose="thinking"
          story={copy.intro}
          start={copy.start}
          onStart={() => setStage("phone")}
        />
      ) : stage === "done" ? (
        <GameCompletion
          title={copy.finished}
          message={copy.lesson}
          stars={LEVELS}
          starNote={starNote}
          onAgain={() => setStage("phone")}
          onExit={onExit}
        />
      ) : (
        <Room stage={stage} onStage={setStage} onEscaped={finish} />
      )}
    </GameShell>
  );
}

function Room({
  stage,
  onStage,
  onEscaped,
}: {
  stage: Exclude<Stage, "intro" | "done">;
  onStage: (stage: Stage) => void;
  onEscaped: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const success = useSuccessSound();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [message, setMessage] = useState<string>(copy.phone.task);
  const [tone, setTone] = useState<"white" | "mint" | "peach">("white");
  const [wrong, setWrong] = useState<RescueChoice | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // Room layout, all relative to the measured room.
  const { w, h } = size;
  const mascot = Math.min(130, w * 0.34);
  const mascotAt = { x: w * 0.24, y: h * 0.78 - mascot };
  const desk = { x: w * 0.6, y: h * 0.62, w: w * 0.34 };
  const start = { x: mascotAt.x + mascot * 0.5, y: mascotAt.y + mascot * 0.18 };
  const target = { x: desk.x + desk.w / 2 - PHONE.w / 2, y: desk.y - PHONE.h };
  const windowBox = { x: w * 0.58, y: 14, w: w * 0.36, h: h * 0.34 };

  const phone = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const closed = useRef(new Animated.Value(0)).current;
  const closedNow = useRef(0);
  const door = useRef(new Animated.Value(0)).current;
  const walk = useRef(new Animated.Value(0)).current;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // Place the phone at the start (near Нүдхэн's eye) once the room is measured.
  useEffect(() => {
    if (w > 0 && stage === "phone") phone.setValue(start);
  }, [w, h]);

  const move = (to: { x: number; y: number }, then?: () => void) => {
    if (reduceMotion) {
      phone.setValue(to);
      then?.();
      return;
    }
    Animated.spring(phone, { toValue: to, friction: 6, useNativeDriver: false }).start(() =>
      then?.(),
    );
  };

  const phoneDone = () => {
    if (stageRef.current !== "phone") return;
    move(target);
    success();
    setTone("mint");
    setMessage(copy.phone.done);
    setTimeout(() => {
      setTone("white");
      setMessage(copy.glare.task);
      onStage("glare");
    }, 1400);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => stageRef.current === "phone",
        onMoveShouldSetPanResponder: () => stageRef.current === "phone",
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          phone.extractOffset();
        },
        onPanResponderMove: Animated.event([null, { dx: phone.x, dy: phone.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          phone.flattenOffset();
          const dropped = { x: start.x + gesture.dx, y: start.y + gesture.dy };
          if (inZone(dropped, target, Math.max(60, w * 0.16))) phoneDone();
          else {
            setMessage(copy.phone.hint);
            move(start);
          }
        },
      }),
    [w, h],
  );

  const setCurtain = (value: number, animate = true) => {
    const next = Math.max(0, Math.min(1, value));
    closedNow.current = next;
    if (animate && !reduceMotion) {
      Animated.timing(closed, {
        toValue: next,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } else closed.setValue(next);
  };
  const judgeCurtain = () => {
    const light = curtainLight(closedNow.current);
    if (light === "comfy") {
      success();
      setTone("mint");
      setMessage(copy.glare.done);
      setTimeout(() => {
        setTone("white");
        setMessage(copy.rest.task);
        onStage("rest");
      }, 1400);
    } else setMessage(light === "dark" ? copy.glare.tooDark : copy.glare.tooBright);
  };
  const curtainStart = useRef(0);
  const curtainPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => stageRef.current === "glare",
        onMoveShouldSetPanResponder: () => stageRef.current === "glare",
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          curtainStart.current = closedNow.current;
        },
        onPanResponderMove: (_, gesture) =>
          setCurtain(curtainStart.current + gesture.dx / Math.max(1, windowBox.w), false),
        onPanResponderRelease: judgeCurtain,
      }),
    [w, h],
  );

  const choose = (id: RescueChoice) => {
    const choice = RESCUE_CHOICES.find((c) => c.id === id)!;
    if (!choice.good) {
      setWrong(id);
      setTone("peach");
      setMessage(copy.rest.tryOther);
      return;
    }
    success();
    setWrong(null);
    setTone("mint");
    setMessage(copy.rest.done);
    onStage("escape");
    const open = () => {
      onEscaped();
    };
    if (reduceMotion) {
      door.setValue(1);
      walk.setValue(1);
      setTimeout(open, 1200);
      return;
    }
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(door, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(walk, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(400),
    ]).start(open);
  };

  const glareOpacity = closed.interpolate({
    inputRange: [0, 0.4, 0.6, 1],
    outputRange: [0.85, 0.35, 0, 0],
  });
  const darkness = closed.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 0.45] });
  const beam = closed.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.45, 0.05, 0] });
  const standing = stage === "escape";

  return (
    <View style={styles.play}>
      <SpeechBubble
        pose={tone === "mint" ? "celebrate" : tone === "peach" ? "thinking" : "idle_happy"}
        text={message}
        size={76}
        tone={tone}
      />
      <View style={styles.room} onLayout={onLayout}>
        {w > 0 && (
          <>
            {/* Lavender wall, mint floor, a rug and pillows. */}
            <View style={[styles.floor, { top: h * 0.78 }]} />
            <View style={[styles.rug, { left: w * 0.14, top: h * 0.84, width: w * 0.5 }]} />
            <Text style={[styles.toy, { left: w * 0.5, top: h * 0.8 }]}>🧸</Text>
            <Text style={[styles.toy, { left: w * 0.86, top: h * 0.7 }]}>🪴</Text>

            {/* The magic door: it opens at the end. */}
            <View
              style={[
                styles.doorFrame,
                { left: 14, top: h * 0.18, width: w * 0.18, height: h * 0.6 },
              ]}
            >
              <Text style={styles.doorStar}>✨</Text>
              <Animated.View
                style={[
                  styles.door,
                  {
                    transformOrigin: "left",
                    transform: [
                      { scaleX: door.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) },
                    ],
                  },
                ]}
              >
                <View style={styles.knob} />
              </Animated.View>
            </View>

            {/* Window with sun, sunbeam and the curtain. */}
            <View
              style={[
                styles.window,
                { left: windowBox.x, top: windowBox.y, width: windowBox.w, height: windowBox.h },
              ]}
            >
              <Text style={styles.sun}>☀️</Text>
              <Animated.View
                style={[
                  styles.curtain,
                  {
                    transformOrigin: "left",
                    transform: [
                      {
                        scaleX: closed.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            {stage === "glare" && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.beam,
                  {
                    left: desk.x - w * 0.06,
                    top: windowBox.y + windowBox.h,
                    width: w * 0.32,
                    height: h * 0.3,
                    opacity: beam,
                  },
                ]}
              />
            )}
            {stage === "glare" && (
              <Animated.View
                {...curtainPan.panHandlers}
                accessibilityRole="adjustable"
                accessibilityLabel={copy.glare.hint}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(event) => {
                  setCurtain(
                    closedNow.current + (event.nativeEvent.actionName === "increment" ? 0.2 : -0.2),
                  );
                  judgeCurtain();
                }}
                style={[
                  styles.handle,
                  {
                    top: windowBox.y + windowBox.h / 2 - 26,
                    left: windowBox.x - 26,
                    transform: [
                      {
                        translateX: closed.interpolate({
                          inputRange: [0, 1],
                          outputRange: [windowBox.w * 0.08, windowBox.w],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.handleText}>↔</Text>
              </Animated.View>
            )}

            {/* Desk, and the comfortable spot for the phone in level one. */}
            <View style={[styles.desk, { left: desk.x, top: desk.y, width: desk.w }]} />
            <View
              style={[
                styles.deskLeg,
                { left: desk.x + 8, top: desk.y + 14, height: h * 0.78 - desk.y - 14 },
              ]}
            />
            <View
              style={[
                styles.deskLeg,
                { left: desk.x + desk.w - 16, top: desk.y + 14, height: h * 0.78 - desk.y - 14 },
              ]}
            />
            {stage === "phone" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.phone.action}
                onPress={phoneDone}
                style={[styles.spot, { left: target.x - 18, top: target.y - 6 }]}
              >
                <Text style={styles.spotText}>⭐</Text>
              </Pressable>
            )}

            {/* Нүдхэн: sitting, then standing and walking out of the door. */}
            <Animated.Image
              source={mascotSources[standing ? "wave" : "idle_happy"]}
              resizeMode="contain"
              accessible={false}
              style={{
                position: "absolute",
                left: mascotAt.x,
                top: mascotAt.y,
                width: mascot,
                height: mascot,
                transform: [
                  {
                    translateX: walk.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -mascotAt.x + 4],
                    }),
                  },
                  { scale: walk.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
                ],
                opacity: walk.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              }}
            />

            {/* The phone: dragged in level one, glares in level two, put down in level three. */}
            <Animated.View
              {...pan.panHandlers}
              accessible={stage === "phone"}
              accessibilityRole={stage === "phone" ? "button" : undefined}
              accessibilityLabel={copy.phone.action}
              accessibilityActions={stage === "phone" ? [{ name: "activate" }] : undefined}
              onAccessibilityAction={phoneDone}
              style={[
                styles.phone,
                {
                  transform: [
                    ...phone.getTranslateTransform(),
                    { rotate: standing ? "90deg" : "0deg" },
                  ],
                },
              ]}
            >
              <View style={styles.screen} />
              {stage !== "phone" && (
                <Animated.View style={[styles.glare, { opacity: glareOpacity }]} />
              )}
            </Animated.View>

            <Animated.View pointerEvents="none" style={[styles.dark, { opacity: darkness }]} />
          </>
        )}
      </View>

      {stage === "phone" && <Text style={styles.hint}>👆 {copy.phone.hint}</Text>}
      {stage === "glare" && (
        <View style={styles.chips}>
          {(["open", "half", "closed"] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => {
                setCurtain(CURTAIN_PRESETS[key]);
                judgeCurtain();
              }}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.chipText}>{copy.glare[key]}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {(stage === "rest" || stage === "escape") && (
        <View style={styles.choices}>
          {RESCUE_CHOICES.map((choice) => (
            <ChoiceCard
              key={choice.id}
              emoji={choice.emoji}
              label={copy.rest[choice.id]}
              state={
                wrong === choice.id ? "wrong" : stage === "escape" && choice.good ? "right" : "idle"
              }
              onPress={() => stage === "rest" && choose(choice.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, gap: 12 },
  room: {
    flex: 1,
    minHeight: 280,
    maxHeight: 460,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#E6DBFF",
  },
  floor: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: world.mint },
  rug: { position: "absolute", height: 18, borderRadius: 12, backgroundColor: world.peach },
  toy: { position: "absolute", fontSize: 26 },
  doorFrame: {
    position: "absolute",
    borderRadius: 18,
    backgroundColor: "#7C68CF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  doorStar: { fontSize: 26 },
  door: {
    ...FILL,
    borderRadius: 18,
    backgroundColor: world.cream,
    borderWidth: 3,
    borderColor: "#E9DCC6",
  },
  knob: {
    position: "absolute",
    right: 10,
    top: "50%",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: world.gold,
  },
  window: {
    position: "absolute",
    borderRadius: 26,
    backgroundColor: "#CFE9FF",
    borderWidth: 5,
    borderColor: world.cream,
    overflow: "hidden",
  },
  sun: { position: "absolute", right: 10, top: 6, fontSize: 30 },
  curtain: { ...FILL, backgroundColor: "#FFC9B0" },
  beam: {
    position: "absolute",
    backgroundColor: "#FFE98A",
    borderRadius: 40,
    transform: [{ skewX: "-18deg" }],
  },
  handle: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: world.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: world.purple,
  },
  handleText: { fontSize: 22, fontFamily: fonts.black, color: world.purpleDeep },
  desk: {
    position: "absolute",
    height: 16,
    borderRadius: 8,
    backgroundColor: world.cream,
  },
  deskLeg: { position: "absolute", width: 8, borderRadius: 4, backgroundColor: "#EBDCC2" },
  spot: {
    position: "absolute",
    width: PHONE.w + 36,
    height: PHONE.h + 12,
    borderRadius: 20,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: world.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  spotText: { fontSize: 22 },
  phone: {
    position: "absolute",
    left: 0,
    top: 0,
    width: PHONE.w,
    height: PHONE.h,
    borderRadius: 10,
    backgroundColor: world.navy,
    padding: 4,
    overflow: "hidden",
  },
  screen: { flex: 1, borderRadius: 6, backgroundColor: "#9FD8F2" },
  glare: {
    position: "absolute",
    left: -10,
    top: 8,
    width: 70,
    height: 20,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "-35deg" }],
  },
  dark: { ...FILL, backgroundColor: world.navy },
  hint: { fontFamily: fonts.bold, fontSize: 15, color: "#5D5A7A", textAlign: "center" },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: world.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: fonts.extraBold, fontSize: 15, color: world.navy },
  choices: { flexDirection: "row", gap: 8 },
});
