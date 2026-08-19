# Contributing

H2ELIOS intentionally uses classic browser scripts with no frontend build
step. Please preserve that constraint when making changes.

## Local workflow

1. Create a branch from `main`.
2. Run `npm ci` and `npm start`.
3. Make focused changes without reformatting unrelated files.
4. Run `npm run test:unit` and `npm run test:ui`.
5. Open a pull request describing the user-visible effect and verification.

## Architecture rules

- Files in `js/` are classic scripts sharing one global scope. Their order in
  `index.html` is dependency order; do not convert one file to an ES module in
  isolation.
- Keep generated datasets generated. Do not hand-edit `js/iea-data.js`,
  `js/h2inframap-data.js`, `js/eu-stations-data.js`, or
  `js/breakeven-data.js`.
- Never commit `.env` or `js/config.js`. Update the corresponding example file
  when adding configuration.
- Treat the static datasets as the offline baseline. Live API failures must
  degrade honestly without preventing the application from loading.
- Add regression coverage for behavior changes. Visual changes should be
  checked at both 1440×900 and a compact desktop width.

## Data provenance

Preserve source URLs, provider fields, approximation flags, and attribution
when importing or transforming data. A visualization must not imply precision
that the source does not provide.
