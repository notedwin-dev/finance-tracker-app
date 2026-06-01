import { useEffect, useRef, useState, useCallback } from "react";
import {
  LONG_PRESS_MS,
  SWIPE_DELTA_X,
  SWIPE_DELTA_Y,
  MOVEMENT_THRESHOLD,
} from "./constants";

interface UseSwipeGestureResult {
  swipedId: string | null;
  setSwipedId: React.Dispatch<React.SetStateAction<string | null>>;
  handlePointerDown: (e: React.PointerEvent, id: string) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent, id: string) => void;
  isGestureActive: React.MutableRefObject<boolean>;
}

export function useSwipeGesture(): UseSwipeGestureResult {
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGestureActive = useRef<boolean>(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      touchStartX.current = e.clientX;
      touchStartY.current = e.clientY;
      isGestureActive.current = false;

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }

      longPressTimer.current = setTimeout(() => {
        if (!isMounted.current) return;
        isGestureActive.current = true;
        if (window.navigator.vibrate) window.navigator.vibrate(20);
      }, LONG_PRESS_MS);
    },
    [],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressTimer.current) return;

    const deltaX = Math.abs(e.clientX - touchStartX.current);
    const deltaY = Math.abs(e.clientY - touchStartY.current);

    if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (isGestureActive.current) return;

      const deltaX = e.clientX - touchStartX.current;
      const deltaY = e.clientY - touchStartY.current;

      if (Math.abs(deltaX) > SWIPE_DELTA_X && Math.abs(deltaY) < SWIPE_DELTA_Y) {
        if (deltaX < 0) {
          setSwipedId(id);
        } else {
          setSwipedId((prev) => (prev === id ? null : prev));
        }
        isGestureActive.current = true;
      }
    },
    [],
  );

  return {
    swipedId,
    setSwipedId,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isGestureActive,
  };
}
