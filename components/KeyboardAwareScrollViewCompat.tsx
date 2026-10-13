import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  KeyboardAwareScrollViewProps,
  KeyboardAvoidingView,
  useKeyboardState,
  useWindowDimensions,
} from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps, StyleSheet, TextInput, View, ViewProps } from "react-native";
import { FormKeyboardContext } from "./FormKeyboardContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fieldScrollDelta } from "@/lib/formViewport";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

function NativeFormScrollView({ children, bottomOffset = 24, keyboardShouldPersistTaps = "handled", contentContainerStyle, onLayout, onScroll, ...props }: Props) {
  const ref = useRef<ScrollView>(null);
  const focused = useRef<TextInput | null>(null);
  const position = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const keyboardHeight = useKeyboardState(state => state.height);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Android native measureInWindow excludes the status bar from its origin.
  const windowOrigin = Platform.OS === "android" ? insets.top : 0;
  const ensureVisible = useCallback(() => {
    const input = focused.current;
    if (!input || !keyboardHeight) return;
    ref.current?.getNativeScrollRef()?.measureInWindow((_x, y, _w, height) => {
      input.measureInWindow((_ix, iy, _iw, ih) => {
        if (focused.current !== input || height <= 0) return;
        const delta = fieldScrollDelta(y, height, iy, ih, windowHeight - keyboardHeight - windowOrigin, bottomOffset);
        if (Math.abs(delta) > 1) ref.current?.scrollTo({ y: Math.max(0, position.current + delta), animated: false });
      });
    });
  }, [keyboardHeight, windowHeight, windowOrigin, bottomOffset]);
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(ensureVisible);
    // Measure again after the keyboard and modal have finished their layout.
    timer.current = setTimeout(ensureVisible, 250);
  }, [ensureVisible]);
  useEffect(() => {
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [schedule]);
  const context = useMemo(() => ({
    focus: (input: TextInput | null) => { focused.current = input; schedule(); },
    blur: (input: TextInput | null) => { if (focused.current === input) focused.current = null; },
  }), [schedule]);
  const padding = StyleSheet.flatten(contentContainerStyle)?.paddingBottom;
  return <FormKeyboardContext.Provider value={context}>
    <ScrollView {...props} ref={ref} keyboardShouldPersistTaps={keyboardShouldPersistTaps} keyboardDismissMode="on-drag" scrollEventThrottle={16}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: (typeof padding === 'number' ? padding : 0) + keyboardHeight }]}
      onScroll={event => { position.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
      onLayout={event => { onLayout?.(event); schedule(); }}>
      {children}
    </ScrollView>
  </FormKeyboardContext.Provider>;
}

export function KeyboardAwareScrollViewCompat({ children, bottomOffset = 24, keyboardShouldPersistTaps = "handled", ...props }: Props) {
  if (Platform.OS === "web") return <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>{children}</ScrollView>;
  return <NativeFormScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>{children}</NativeFormScrollView>;
}

export function KeyboardAvoidingViewCompat({ children, ...props }: ViewProps) {
  if (Platform.OS === "web") return <View {...props}>{children}</View>;
  return <KeyboardAvoidingView behavior="padding" {...props}>{children}</KeyboardAvoidingView>;
}
