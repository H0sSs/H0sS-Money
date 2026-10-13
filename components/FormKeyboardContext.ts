import { createContext } from 'react';
import type { TextInput } from 'react-native';

export const FormKeyboardContext = createContext<{
  focus: (input: TextInput | null) => void;
  blur: (input: TextInput | null) => void;
} | null>(null);
