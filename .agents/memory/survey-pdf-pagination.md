---
name: Survey PDF pagination
description: Constraint and implementation rule for page numbering in the printable DMM survey PDF.
---

Chromium's CSS paged-media counters are not reliable in this PDF pipeline: `counter(page)` and `counter(pages)` resolve to zero in generated content. Numbered footers must therefore be rendered from the generator's known page structure, with the total computed from the cover, per-layer page chunks, and summary page.

**Why:** A browser-native counter footer was tested and produced `Page 0 of 0`, which would make the downloadable survey misleading.

**How to apply:** When changing capability counts or page chunking, keep the computed page total and each page footer in the same generator logic, then validate the PDF page count and extracted `Page X of Y` entries.