import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps, View, ViewProps } from "react-native";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  bottomOffset = 24,
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

// Shrink modal forms and their fixed actions above the keyboard on both platforms.
export function KeyboardAvoidingViewCompat({ children, ...props }: ViewProps) {
  if (Platform.OS === "web") return <View {...props}>{children}</View>;
  return <KeyboardAvoidingView behavior="padding" {...props}>{children}</KeyboardAvoidingView>;
}
