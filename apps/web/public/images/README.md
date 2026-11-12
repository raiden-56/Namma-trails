# Images

`photos/` holds licensed photographs: most from Wikimedia Commons (CC0, public domain, CC BY, CC BY-SA)
and the homepage hero photo from Unsplash (Unsplash License, free to use).
Their titles, authors, licences and source links live in `src/content/photos.ts` and are shown on
`/photo-credits`, which the CC BY / CC BY-SA licences require. Keep that page linked from the footer.

To add or replace a photo:
1. Use only images you own, commissioned work, or openly licensed images whose licence you record.
2. Put the file in `photos/` (JPEG, about 1600px wide) and add an entry to `src/content/photos.ts`.
3. Reference it from content (`destinations.ts`, `config/categories.ts`) or by scene in `MediaFrame`.

Before launch, replace these with commissioned photography of the launch destinations.
