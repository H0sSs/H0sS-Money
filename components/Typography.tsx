import React, {createContext, useContext, forwardRef, useRef, useCallback} from 'react';
import {Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps} from 'react-native';
import * as Font from 'expo-font';
import {fontForStyle, type AppFont} from '@/lib/typography';
import { FormKeyboardContext } from './FormKeyboardContext';
const FontContext = createContext<AppFont>('ArabicRegular');
export type Text = React.ElementRef<typeof NativeText>;
export type TextInput = React.ElementRef<typeof NativeTextInput>;
export const Text = forwardRef<Text, TextProps>(function AppText({style,children,...props},ref) {
  const inherited = useContext(FontContext);
  const font = fontForStyle(StyleSheet.flatten(style), inherited);
  const resolved = Font.isLoaded(font) ? [style,{fontFamily:font,fontWeight:'normal' as const}] : style;
  return <FontContext.Provider value={font}><NativeText {...props} ref={ref} style={resolved}>{children}</NativeText></FontContext.Provider>;
});
export const TextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput({style,...props},ref) {
  const font = fontForStyle(StyleSheet.flatten(style));
  const resolved = Font.isLoaded(font) ? [style,{fontFamily:font,fontWeight:'normal' as const}] : style;
  const keyboard = useContext(FormKeyboardContext);
  const input = useRef<TextInput | null>(null);
  const assignRef = useCallback((node: TextInput | null) => {
    input.current = node;
    if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
  }, [ref]);
  return <NativeTextInput {...props} ref={assignRef} style={resolved}
    onFocus={event => { props.onFocus?.(event); keyboard?.focus(input.current); }}
    onBlur={event => { props.onBlur?.(event); keyboard?.blur(input.current); }}
    onSelectionChange={event => { props.onSelectionChange?.(event); if (input.current?.isFocused()) keyboard?.focus(input.current); }}/>;
});
