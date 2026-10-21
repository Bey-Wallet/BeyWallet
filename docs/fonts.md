# App fonts

Body text and headings use standard-width Special Gothic with three bundled static weights:

- Regular (400): `SpecialGothic-Regular.ttf`
- Medium (500): `SpecialGothic-Medium.ttf`
- SemiBold (600): `SpecialGothic-SemiBold.ttf`

`SpecialGothic-Bold.ttf` (700) is retained in the repository at the user's request. It is not
registered in Expo runtime loading, native embedding, or the Tamagui face mappings. Requests for
700 still render using SemiBold (600); activate Bold only when the user requests it.

Existing font sizes, line heights, and accessibility scaling are preserved.

The Tamagui body and heading families share these faces. Existing requests below 400 resolve to
Regular; requests above 600 and `bold` resolve to SemiBold. Weight tokens `$4`, `$5`, and `$6` select
400, 500, and 600 respectively. No additional Special Gothic weights or
italics are downloaded. Existing dedicated monospace text retains its separate `Mono` font.

Runtime loading lives in `src/shared/layout/RootLayout.tsx`; native embedding is configured in
`app.json`. Rebuild the native app to update embedded assets. The public-key sheet's native input
also uses Special Gothic Regular.

Plain Tamagui Text explicitly defaults to `$body` (its library default is `unset`). Named text,
input, and toast defaults also select `$body`. React Navigation uses the three registered static
faces, and native bottom-sheet inputs specify Special Gothic Regular directly. OS-owned permission
dialogs, share sheets, and keyboards keep the platform font.

Unmodified fonts and license were downloaded from the official
[Special Gothic repository at revision 17774cf97eec75a115aebc7ed66a57ce67b88177](https://github.com/AlistairMcCready/Special-Gothic/tree/17774cf97eec75a115aebc7ed66a57ce67b88177).
Only the three active static weights and the license are used by the app; the 700 asset stays inactive. Each file's upstream Git
blob hash and weight metadata were checked. All three include Bitcoin (`₿`, U+20BF) and Indian rupee (`₹`, U+20B9)
glyphs, verified by the font asset regression tests.
The SIL Open Font License and copyright notice are retained in
`src/assets/fonts/SpecialGothic-OFL.txt`. The font license remains separate from the application's
Apache 2.0 license.
