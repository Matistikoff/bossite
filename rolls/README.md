# Photo archive

`data.js` is the single source for gallery labels, filters, and hero photos. Every
photo has one roll (because it lives inside that roll's image folder), and can have
as many subject categories as you want.

## Change a roll hero

Edit that roll in `data.js` and set its `hero` value to a photo's `file` value
(without `.webp`). This does not require the original images or the build script.

```json
{
  "id": "11_Macedonsko25",
  "name": "Macedónsko",
  "sortOrder": 11,
  "rollCount": 1,
  "hero": "predZoo"
}
```

For a new roll:

1. Add originals to `assets/images/<number>_<roll-name>/`.
2. Run `python rolls/build_archive.py` from the project root. This creates or
   refreshes 3200 px WebP gallery images and smaller WebP thumbnails, then
   rewrites `data.js` from the source folders.
3. Optionally assign subject category IDs or a `hero` value in `data.js`. The build
   script preserves those settings by roll ID and filename. Newly discovered photos
   start uncategorized and remain visible in the roll views.

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
directly from a file browser. If the build script cannot read the existing file, it
stops instead of rebuilding and losing category assignments.

Nested image folders are supported and are mirrored beneath the roll's thumbnail
and web-image folders. They remain part of their top-level roll.

High-resolution sources remain local under `assets/images/<number>_*` and are
excluded from Git and deployment. The public lightbox uses the generated files
under `assets/web-images/`. The builder refuses to run if any roll already in
`data.js` is missing its original source folder, so it cannot erase a partial gallery.

`rollCount` records how many physical film rolls are represented by a gallery
group. The Indonesia group represents 10 rolls and the Ukraine group represents 2.

Do not copy files into subject folders: the category filters read the metadata, so an
image can appear under both "Portraits" and "Street" without duplicate files.
