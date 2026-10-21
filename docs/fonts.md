# App fonts

Body text and headings use Montserrat with three bundled static weights:

- Medium (500): `Montserrat-Medium.ttf`
- SemiBold (600): `Montserrat-SemiBold.ttf`
- Bold (700): `Montserrat-Bold.ttf`

Existing font sizes, line heights, and accessibility scaling are preserved.

The Tamagui body and heading families share these faces. Existing requests below 500 resolve to
Medium; requests above 700 and `bold` resolve to Bold. Weight tokens `$4`, `$5`, and `$6` select
500, 600, and 700 respectively. No additional Montserrat weights or
italics are downloaded. Existing dedicated monospace text retains its separate `Mono` font.

Runtime loading lives in `src/shared/layout/RootLayout.tsx`; native embedding is configured in
`app.json`. Rebuild the native app to update embedded assets. The public-key sheet's native input
also uses Montserrat Medium.

Plain Tamagui Text explicitly defaults to `$body` (its library default is `unset`). Named text,
input, and toast defaults also select `$body`. React Navigation uses the three registered static
faces, and native bottom-sheet inputs specify Montserrat Medium directly. OS-owned permission
dialogs, share sheets, and keyboards keep the platform font.

Unmodified fonts and license were downloaded from the official
[Montserrat repository at revision 555facfb2a18c72c3c0380f0d9c0f060453a9058](https://github.com/JulietaUla/Montserrat/tree/555facfb2a18c72c3c0380f0d9c0f060453a9058).
Only the three requested static Montserrat weights and the license are bundled. Each file's
weight metadata and upstream Git blob hashes were checked. All three include Bitcoin (`₿`, U+20BF) and Indian rupee (`₹`, U+20B9)
glyphs, verified by the font asset regression tests.
The SIL Open Font License and copyright notice are retained in
`src/assets/fonts/Montserrat-OFL.txt`. The font license remains separate from the application's
Apache 2.0 license.
