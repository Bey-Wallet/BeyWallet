# BUI cards

Open Settings → Advanced → BUI → Cards (`bui-cards`). Five categories: Foundation,
Wallet, Setup, Shelves and Banners. All values and interactions are local synthetic
examples. No permissions, biometrics, authentication, backups, trading, payments,
mint operations or persistence run.

Shared components live in `src/shared/ui/BUI/`:

- `BUICard.tsx`: card shell, row card, warning card; single/first/middle/last positions.
- `BUIWalletCards.tsx`: setup prompts, more-assets previews and hidden-items cards.
- `BUIShelfCards.tsx`: compact/favorite cards, collectible placeholder cards and See all.
- `BUIBannerCard.tsx`: dismissible text/illustration banners with sibling action targets.

`BUICardsScreen.tsx` composes wallet selection, asset states and a summary from
these components and existing BUI rows, avatars, badges, property rows and buttons.
Setup reuses the existing switch visual without installing a second touch target.
The thin route, BUI hub, Settings title catalog and route manifest expose the preview.

Measurements checked against local Android source revision `70abb50`:
`kmp/ui/.../moon/cell/{MoonBundle,MoonCardCell,MoonWarningCell}.kt`, core
`{WalletCell,BannersViewer}.kt`, ramp `AssetCell.kt`, portfolio wallet components
`{FinishSetupCard,MoreAssetsCell,AllAssetsHiddenCell,EarnSection,CollectiblesSection}.kt`,
and trading `ShelvesScreen.kt` (favorite-card geometry/removal).

| Family           | Measurements                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell            | Corners16, horizontal margins16, optional content padding16, card surface, no default border/shadow. First/middle/last positions clip only relevant corners.        |
| Group separators | Overlay0.5/start16 with optional extra inset; no added row height.                                                                                                  |
| Row card         | Minimum76, padding16×8, title16 Medium, subtitle14/native line metrics, leading gap16/trailing gap8/tags gap8.                                                      |
| Warning          | Corners16, padding16×12, body14/20 in primary text/max3 lines, trailing warning16 in secondary icon tone, gap16.                                                    |
| Wallet/asset     | Minimum76, avatar44, selected check28, asset badge18; expanded asset option has navigation chevron16.                                                               |
| Setup            | Corners16, rows padding16, icon circle44/semantic tint12%/glyph28; title14/20; completed title opacity72%, check22; switch50×30; one row-level target.              |
| More items       | Minimum60, padding16×12, max2 previews24/ring2/overlap8, title gap12/chevron gap4.                                                                                  |
| Hidden items     | Minimum76, padding16×12, raised circle44/icon28, text gap0.                                                                                                         |
| Compact shelf    | Width100/corners16, padding10 sides/16 top/14 bottom, avatar44/badge20; text12 Regular, gaps10/2/1.                                                                 |
| Favorite         | Width100/corners12, padding8×16, avatar56/badge20, text12/gaps8/1; removal circle24/glyph16/offset4 with48-point touch area.                                        |
| Collectible      | Width=(viewport−48)/3, corners16, square image placeholder, text padding12×8, label14/collection12; sale badge26/inset8.                                            |
| See all          | Width/height match collectible image, circle44, chevron16, label12/gap8.                                                                                            |
| Banner           | Height90 baseline/corners20/border1 neutral tertiary; label14 Medium/max2 lines, action12 Regular/alpha64%/gap4; illustration slot134; close54×44/circle24/glyph16. |

Favorite removal animates width100→0 and alpha1→0 for300ms, cubic(.4,0,.2,1),
then calls the removal callback. Editing blocks card navigation. Reduced motion
removes immediately. Animation cleanup prevents callbacks after unmount. Close and
remove controls are siblings of card navigation targets. Setup completion becomes
read-only; skip, banner dismissal and shelf removal are resettable in the preview.
Hidden collectibles suppress names in both text and accessibility labels.

BUI uses its approved white/black pages, relative card surfaces, blue primary and
softer light secondary button fills. Raw neutral tertiary fills remain independent
of transparent tertiary buttons. Warning text stays primary as in the source.

Fidelity limits: Inter and Lucide replace source fonts/artwork. Collectible imagery
is a neutral placeholder, with a hidden placeholder rather than bitmap blur. Native
ripple, standalone island press-scale, stacked-banner motion and feature-specific
formatting are not reproduced. Text-only banners reserve room for the close target;
large text may grow the90-point baseline. Summary content is a BUI composition.
This is a measured component preview, not verified pixel-identical Android output.
Android visual, large-text, screen-reader and touch-target review remains necessary.

Specialized domain screens are outside this retained card playground.

Tests cover static/disabled cards, setup completion and single-target switches,
separate banner dismissal, editing/removal with reduced motion, hidden collectible
labels, and both appearances with selection/skip/restore/removal/reset transitions.
