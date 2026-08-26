# Photo archive

`data.js` is the single source for gallery labels and filters. Every photo has one
roll (because it lives inside that roll's image folder), and can have as many subject
categories as you want.

For a new roll:

1. Add originals to `assets/images/<roll-id>/` and matching WebP thumbnails to
   `assets/images/thumbnails/<roll-id>/`.
2. Add a roll object in `data.js`. Give its newest-first position with `sortOrder`.
3. Add every image filename (without `.JPG`) to that roll's `photos` list and choose
   one or more category IDs from the top-level `categories` list.

Example:

```json
{
  "id": "tatras-2026",
  "name": "Tatras 2026",
  "sortOrder": 3,
  "photos": [
    { "file": "000001", "categories": ["landscapes", "nature"] }
  ]
}
```

Keep the `window.ROLLS_ARCHIVE =` prefix and the final semicolon; this lets the
archive work when `index.html` is opened directly from a file browser.

Do not copy files into subject folders: the category filters read the metadata, so an
image can appear under both "Portraits" and "Street" without duplicate files.
