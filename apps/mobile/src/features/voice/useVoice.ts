import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import { VOICE_CLIPS, type VoiceKey } from "./clips";

/** If a new clip has not started by then, ask it to play again. */
export const RETRY_PLAY_MS = 350;

/**
 * Plays recorded voice prompts. `say(a, b)` plays `a` now and `b` when `a` finishes; a new
 * `say` replaces whatever is playing or queued, so the newest instruction always wins.
 *
 * On iOS a `play()` sent while the new clip is still loading is sometimes dropped, so a clip
 * that has not started yet is played again once it has loaded, with a short timer as a backup.
 */
export function useVoice() {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const queue = useRef<VoiceKey[]>([]);
  // True from `say` until the clip is heard to be playing.
  const pending = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = () => {
    if (retry.current) clearTimeout(retry.current);
    retry.current = null;
  };

  const playNow = useCallback(
    (key: VoiceKey) => {
      clearRetry();
      pending.current = true;
      try {
        player.replace(VOICE_CLIPS[key]);
        player.play();
      } catch {
        // A voice line is a bonus; the screen still shows the words.
      }
      retry.current = setTimeout(() => {
        retry.current = null;
        if (!pending.current) return;
        try {
          player.play();
        } catch {
          // Still nothing to do but carry on.
        }
      }, RETRY_PLAY_MS);
    },
    [player],
  );

  // The clip started: nothing left to retry. Loaded but silent: play it now.
  useEffect(() => {
    if (!pending.current) return;
    if (status.playing) {
      pending.current = false;
      clearRetry();
      return;
    }
    if (status.isLoaded && !status.isBuffering) {
      try {
        player.play();
      } catch {
        // The timer above tries once more.
      }
    }
  }, [status.playing, status.isLoaded, status.isBuffering, player]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    const next = queue.current.shift();
    if (next) playNow(next);
  }, [status.didJustFinish, playNow]);

  useEffect(() => clearRetry, []);

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
    pending.current = false;
    clearRetry();
    player.pause();
  }, [player]);

  return { say, stop };
}
