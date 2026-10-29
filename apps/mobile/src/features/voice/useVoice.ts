import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import { VOICE_CLIPS, type VoiceKey } from "./clips";

/**
 * Plays recorded voice prompts. `say(a, b)` plays `a` now and `b` when `a` finishes; a new
 * `say` replaces whatever is playing or queued, so the newest instruction always wins.
 */
export function useVoice() {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const queue = useRef<VoiceKey[]>([]);

  const playNow = useCallback(
    (key: VoiceKey) => {
      player.replace(VOICE_CLIPS[key]);
      player.play();
    },
    [player],
  );

  useEffect(() => {
    if (!status.didJustFinish) return;
    const next = queue.current.shift();
    if (next) playNow(next);
  }, [status.didJustFinish, playNow]);

  const say = useCallback(
    (...keys: VoiceKey[]) => {
      const [first, ...rest] = keys;
      if (!first) return;
      queue.current = rest;
      playNow(first);
    },
    [playNow],
  );

  const stop = useCallback(() => {
    queue.current = [];
    player.pause();
  }, [player]);

  return { say, stop };
}
