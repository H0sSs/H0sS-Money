import React from "react";
import Svg, {
  Path,
  Line,
  Circle,
  Rect,
  Polyline,
  Polygon,
  G,
} from "react-native-svg";

type IconName =
  | "mic" | "square" | "inbox" | "bar-chart-2" | "list" | "settings"
  | "edit-2" | "trash-2" | "x" | "check" | "chevron-right" | "plus"
  | "camera" | "image" | "coffee" | "truck" | "shopping-bag" | "film"
  | "file-text" | "heart" | "wind" | "book" | "more-horizontal"
  | "home" | "zap" | "music" | "globe" | "gift" | "tag" | "tool"
  | "users" | "activity" | "star" | "box" | "alert-circle";

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const ICONS: Record<string, (color: string, sw: number) => React.ReactNode> = {
  mic: (c, sw) => (
    <>
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="19" x2="12" y2="23" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="8" y1="23" x2="16" y2="23" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  square: (c, sw) => (
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  inbox: (c, sw) => (
    <>
      <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "bar-chart-2": (c, sw) => (
    <>
      <Line x1="18" y1="20" x2="18" y2="10" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="20" x2="12" y2="4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6" y1="20" x2="6" y2="14" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  list: (c, sw) => (
    <>
      <Line x1="8" y1="6" x2="21" y2="6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="8" y1="12" x2="21" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="8" y1="18" x2="21" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="3" y1="6" x2="3.01" y2="6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="3" y1="12" x2="3.01" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="3" y1="18" x2="3.01" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  settings: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "edit-2": (c, sw) => (
    <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  "trash-2": (c, sw) => (
    <>
      <Polyline points="3 6 5 6 21 6" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="11" x2="10" y2="17" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="14" y1="11" x2="14" y2="17" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  x: (c, sw) => (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  check: (c, sw) => (
    <Polyline points="20 6 9 17 4 12" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  "chevron-right": (c, sw) => (
    <Polyline points="9 18 15 12 9 6" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  plus: (c, sw) => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  camera: (c, sw) => (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="13" r="4" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  image: (c, sw) => (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke={c} strokeWidth={sw} fill="none" />
      <Circle cx="8.5" cy="8.5" r="1.5" stroke={c} strokeWidth={sw} fill="none" />
      <Polyline points="21 15 16 10 5 21" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  coffee: (c, sw) => (
    <>
      <Path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="6" y1="1" x2="6" y2="4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="10" y1="1" x2="10" y2="4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="14" y1="1" x2="14" y2="4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  truck: (c, sw) => (
    <>
      <Rect x="1" y="3" width="15" height="13" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="16 8 20 8 23 11 23 16 16 16 16 8" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="5.5" cy="18.5" r="2.5" stroke={c} strokeWidth={sw} fill="none" />
      <Circle cx="18.5" cy="18.5" r="2.5" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  "shopping-bag": (c, sw) => (
    <>
      <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="3" y1="6" x2="21" y2="6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M16 10a4 4 0 0 1-8 0" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  film: (c, sw) => (
    <>
      <Rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="7" y1="2" x2="7" y2="22" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="17" y1="2" x2="17" y2="22" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="2" y1="12" x2="22" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="2" y1="7" x2="7" y2="7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="2" y1="17" x2="7" y2="17" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="17" y1="17" x2="22" y2="17" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="17" y1="7" x2="22" y2="7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  "file-text": (c, sw) => (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="14 2 14 8 20 8" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="16" y1="13" x2="8" y2="13" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="16" y1="17" x2="8" y2="17" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Polyline points="10 9 9 9 8 9" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  heart: (c, sw) => (
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  wind: (c, sw) => (
    <>
      <Path d="M9.59 4.59A2 2 0 1 1 11 8H2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12.59 19.41A2 2 0 1 0 14 16H2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  book: (c, sw) => (
    <>
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "more-horizontal": (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="1" fill={c} />
      <Circle cx="19" cy="12" r="1" fill={c} />
      <Circle cx="5" cy="12" r="1" fill={c} />
    </>
  ),
  home: (c, sw) => (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="9 22 9 12 15 12 15 22" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  zap: (c, sw) => (
    <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  music: (c, sw) => (
    <>
      <Path d="M9 18V5l12-2v13" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="6" cy="18" r="3" stroke={c} strokeWidth={sw} fill="none" />
      <Circle cx="18" cy="16" r="3" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  globe: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="2" y1="12" x2="22" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  gift: (c, sw) => (
    <>
      <Polyline points="20 12 20 22 4 22 4 12" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="2" y="7" width="20" height="5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="22" x2="12" y2="7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  tag: (c, sw) => (
    <>
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="7" y1="7" x2="7.01" y2="7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  tool: (c, sw) => (
    <>
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  users: (c, sw) => (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="9" cy="7" r="4" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  activity: (c, sw) => (
    <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  star: (c, sw) => (
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  box: (c, sw) => (
    <>
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="22.08" x2="12" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  upload: (c, sw) => (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="17 8 12 3 7 8" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="3" x2="12" y2="15" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  "alert-circle": (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="12" y1="8" x2="12" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="16" x2="12.01" y2="16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  eye: (c, sw) => (
    <>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  "eye-off": (c, sw) => (
    <>
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="1" y1="1" x2="23" y2="23" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  download: (c, sw) => (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="7 10 12 15 17 10" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="15" x2="12" y2="3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  "volume-2": (c, sw) => (
    <>
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "volume-x": (c, sw) => (
    <>
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="23" y1="9" x2="17" y2="15" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="17" y1="9" x2="23" y2="15" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  lock: (c, sw) => (
    <>
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  fingerprint: (c, sw) => (
    <>
      <Path d="M12 10a2 2 0 0 0-2 2v4" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.29 3.86A8 8 0 0 1 20 12c0 4.42-3.58 8-8 8" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4.35 7.56A8.016 8.016 0 0 0 4 10c0 2.42 1.07 4.59 2.77 6.07" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 16a5 5 0 0 0 5.9.5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 13.5A5 5 0 0 0 9 9.06" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.56 2.75A8 8 0 0 1 12 2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  sun: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="5" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="12" y1="1" x2="12" y2="3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="21" x2="12" y2="23" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="1" y1="12" x2="3" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="21" y1="12" x2="23" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  moon: (c, sw) => (
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  "dollar-sign": (c, sw) => (
    <>
      <Line x1="12" y1="1" x2="12" y2="23" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function Icon({ name, size = 24, color = "#000", strokeWidth = 2 }: IconProps) {
  const renderer = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderer ? renderer(color, strokeWidth) : (
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
      )}
    </Svg>
  );
}
