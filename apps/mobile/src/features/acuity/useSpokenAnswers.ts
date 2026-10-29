import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
// whisper.rn only exports subpaths, so the entry is imported as "whisper.rn/index".
import { initWhisper, type WhisperContext } from "whisper.rn/index";
import speechModel from "../../../assets/models/ggml-base-q5_1.bin";
import { matchSpoken, SPEECH_PROMPT, type SpokenAnswer } from "./speech";

export type SpeechStatus = "off" | "loading" | "listening" | "denied" | "unavailable";

/** One short window per try: long enough for a word, short enough to answer quickly. */
export const LISTEN_MS = 2000;

// Whisper reads 16 kHz mono 16-bit WAV.
const WAV_16K: RecordingOptions = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: { outputFormat: "default", audioEncoder: "default" },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

// The model takes a moment to load, so it is loaded once and shared.
let model: Promise<WhisperContext> | null = null;
function loadModel(): Promise<WhisperContext> {
  const loading =
    model ??
    initWhisper({ filePath: speechModel }).catch((error: unknown) => {
      model = null;
      throw error;
    });
  model = loading;
  return loading;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Listens for "дээш / доош / зүүн / баруун / харагдахгүй" while `enabled`, on the phone only:
 * each 2-second recording is transcribed by Whisper and deleted with the app's cache; nothing is
 * saved or sent. A reply heard for an earlier letter (`round`) is dropped.
 */
export function useSpokenAnswers({
  enabled,
  round,
  onAnswer,
}: {
  enabled: boolean;
  round: string;
  onAnswer: (answer: SpokenAnswer) => void;
}): SpeechStatus {
  const recorder = useAudioRecorder(WAV_16K);
  const [status, setStatus] = useState<SpeechStatus>("off");
  const latest = useRef({ round, onAnswer });
  latest.current = { round, onAnswer };

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }
    let active = true;
    (async () => {
      setStatus("loading");
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return active && setStatus("denied");
      const whisper = await loadModel();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (active) setStatus("listening");
      while (active) {
        const heardFor = latest.current.round;
        await recorder.prepareToRecordAsync();
        recorder.record();
        await wait(LISTEN_MS);
        await recorder.stop();
        if (!active || !recorder.uri) break;
        const { promise } = whisper.transcribe(recorder.uri, {
          language: "mn",
          prompt: SPEECH_PROMPT,
        });
        const { result } = await promise;
        const answer = matchSpoken(result);
        if (active && answer !== null && latest.current.round === heardFor) {
          latest.current.onAnswer(answer);
        }
      }
    })().catch(() => {
      if (active) setStatus("unavailable");
    });
    return () => {
      active = false;
      void recorder.stop().catch(() => undefined);
      // Back to playback only, so the voice prompts use the loudspeaker again.
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
        () => undefined,
      );
    };
  }, [enabled, recorder]);

  return status;
}
