# CommonJS compatibility for decode-uri-component 0.5.0

This is the upstream MIT-licensed 0.5.0 decoder, with only its default export changed to `module.exports`. Expo Router 6 uses query-string 7, which requires a callable CommonJS export. Directly overriding to the upstream ESM package breaks query parsing.

The upstream 0.5.0 decoding fix replaces recursive splitting of malformed UTF-8 with a bounded scan. Keep the upstream LICENSE and review this adapter when upgrading Expo Router/query-string.
