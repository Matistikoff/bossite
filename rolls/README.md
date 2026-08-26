# Photo archive

`data.js` is the single source for gallery labels and filters. Every photo has one
roll (because it lives inside that roll's image folder), and can have as many subject
categories as you want.

For a new roll:

1. Add originals to `assets/images/<number>_<roll-name>/`.
2. Run `python rolls/build_archive.py` from the project root. This creates or
   refreshes 3200 px WebP gallery images and smaller WebP thumbnails, then
   rewrites `data.js` from the source folders.
3. Optionally assign subject category IDs to photos in `data.js`. Newly discovered
   photos start uncategorized and remain visible in the roll views.

Example:

```json
{
  "id": "tatras-2026",
  "name": "Tatras 2026",
  "sortOrder": 3,
  "rollCount": 1,
  "photos": [
    { "file": "000001", "categories": ["landscapes", "nature"] }
  ]
}
```

Keep the `window.ROLLS_ARCHIVE =` prefix and the final semicolon if editing the
generated file manually; this lets the archive work when `index.html` is opened
directly from a file browser. Running the build script again replaces manual edits.

Nested image folders are supported and are mirrored beneath the roll's thumbnail
and web-image folders. They remain part of their top-level roll.

High-resolution sources remain local under `assets/images/<number>_*` and are
excluded from Git and deployment. The public lightbox uses the generated files
under `assets/web-images/`.

`rollCount` records how many physical film rolls are represented by a gallery
group. The Indonesia group represents 10 rolls and the Ukraine group represents 2.

Do not copy files into subject folders: the category filters read the metadata, so an
image can appear under both "Portraits" and "Street" without duplicate files.
