# Brand assets

Two masters, kept full-size as the source of truth. Don't reference these
from templates — they're big, and every page would pay for it.

| File                  | Size      | Purpose                                  |
| --------------------- | --------- | ---------------------------------------- |
| `d20-mark-blank.png`  | 1024²     | Master — die with no numeral             |
| `d20-mark.png`        | 512²      | Master — die with the "20"               |
| `drink20.png`         | 3000²     | Master — full lockup, lots of whitespace  |
| `drink20LeftHeader.png` | 3043×1129 | Master — original site header art       |

Derivatives actually used by the site. Regenerate with ImageMagick if a
master changes — `-colors 128` is lossless to the eye on this flat artwork
and cuts file size by 75–97%.

| File                 | Used by                    | Built from            |
| -------------------- | -------------------------- | --------------------- |
| `d20-blank-128.png`  | masthead icon              | `d20-mark-blank.png`  |
| `d20-blank-640.png`  | hero watermark             | `d20-mark-blank.png`  |
| `d20-mark-180.png`   | `apple-touch-icon`         | `d20-mark.png`        |
| `og-default.png`     | default `og:image` card    | `drink20.png`         |
| `favicon.ico`        | favicon                    | —                     |

```bash
magick d20-mark-blank.png -resize 128x128 -strip -colors 128 -define png:compression-level=9 d20-blank-128.png
```

The social card is the lockup centred on the dark-mode background at the
1200×630 size Facebook, Bluesky and Twitter all expect:

```bash
magick -size 1200x630 xc:'#10131a' \( drink20.png -fuzz 2% -trim +repage -resize 820x \) \
  -gravity center -geometry +0-10 -composite -strip -colors 128 og-default.png
```
