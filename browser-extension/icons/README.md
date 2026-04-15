# Extension Icons

This directory should contain the extension icons in PNG format:

- `icon16.png` - 16x16px (toolbar)
- `icon48.png` - 48x48px (extension management)
- `icon128.png` - 128x128px (Chrome Web Store)

You can generate these icons using any image editor or online tool. For a quick placeholder, you can use a solid color square or the DCID logo.

## Quick Icon Generation

Using ImageMagick:

```bash
# Create simple placeholder icons
convert -size 16x16 xc:#0d10ec icon16.png
convert -size 48x48 xc:#0d10ec icon48.png
convert -size 128x128 xc:#0d10ec icon128.png
```

Or use an online favicon generator and export different sizes.
