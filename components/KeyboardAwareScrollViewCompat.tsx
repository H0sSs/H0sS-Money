import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
  KeyboardAvoidingView,
  useKeyboardState,
  useWindowDimensions,
} from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps, View, ViewProps } from "react-native";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

function NativeFormScrollView({
  children,
  keyboardShouldPersistTaps = "handled",
  bottomOffset = 24,
  onLayout,
  ...props
}: Props) {
  const ref = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardState(state => state.height);
  const { height: windowHeight } = useWindowDimensions();
  const [coveredSpace, setCoveredSpace] = useState(0);
  const measureViewport = useCallback(() => {
    if (!keyboardHeight) { setCoveredSpace(0); return; }
    ref.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
      if (height > 0) {
        // A modal footer or a shortened sheet can end before the keyboard.
        // Keep the input inside this actual viewport, not just above the IME.
        setCoveredSpace(Math.max(0, windowHeight - keyboardHeight - y - height));
      }
    });
  }, [keyboardHeight, windowHeight]);
  useEffect(() => {
    const frame = requestAnimationFrame(measureViewport);
    const settle = setTimeout(measureViewport, 100);
    return () => { cancelAnimationFrame(frame); clearTimeout(settle); };
  }, [measureViewport]);
  return (
    <KeyboardAwareScrollView
      {...props}
      ref={ref}
      bottomOffset={bottomOffset + coveredSpace}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onLayout={event => { onLayout?.(event); measureViewport(); }}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

export function KeyboardAwareScrollViewCompat({ children, bottomOffset = 24, keyboardShouldPersistTaps = "handled", ...props }: Props) {
  if (Platform.OS === "web") {
    return <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>{children}</ScrollView>;
  }
  return <NativeFormScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>{children}</NativeFormScrollView>;
}

export function KeyboardAvoidingViewCompat({ children, ...props }: ViewProps) {
  if (Platform.OS === "web") return <View {...props}>{children}</View>;
  return <KeyboardAvoidingView behavior="padding" {...props}>{children}</KeyboardAvoidingView>;
}
