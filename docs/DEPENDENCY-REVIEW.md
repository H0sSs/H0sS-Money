# Dependency review — 2026-10-10

`npm audit --omit=dev` initially reported 44 entries (25 high, 19 moderate). Entries include parent packages affected by the same underlying advisory; they are not 44 independent flaws.

Compatible overrides fix the underlying advisories in decode-uri-component, image-size, PostCSS and UUID. The URL decoder uses the upstream 0.5.0 implementation with a CommonJS export adapter, retaining its MIT license. The image adapter uses upstream 2.0.4 and reads Metro's file-path inputs into byte buffers. Tests cover Arabic queries, malformed percent sequences, Metro image dimensions for both paths and buffers, and Xcode UUID compatibility.

The final audit reports 28 entries (23 high, 5 moderate), rooted in three packages for which the registry currently exposes no patched release:

| Package | Installed/latest checked | Scope in this app | Remaining advisory |
| --- | --- | --- | --- |
| braces | 3.0.3 | Metro build file globbing | GHSA-vfj7-8cjw-p6xm, stack exhaustion from deeply nested patterns |
| node-forge | 1.4.0 | Expo CLI certificate tooling | GHSA-86w9-cpqp-85rv, RSA signature parsing |
| sprintf-js | 1.0.3 / 1.1.3 | Babel/Jest build tooling | GHSA-hp3w-g68c-fv3c, unbounded precision denial of service |

These paths are build tooling, not the expense storage or AI HTTP clients. Build only trusted source/assets/configuration and do not expose Metro publicly. Recheck upstream fixes before publishing a production release. Do not describe this repository as having a zero-vulnerability dependency audit. Suggested audit downgrades of Expo or unrelated major React Native upgrades are not compatible fixes for the tested SDK 54 build.
