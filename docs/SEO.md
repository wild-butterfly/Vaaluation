# Website SEO

The GitHub Pages site is plain HTML in `website/`. Every guide has a standalone
URL, descriptive title and description, canonical link, social metadata and
breadcrumb structured data. Content and links are available without JavaScript.
The Pages workflow copies this directory recursively, so guide directories need
no routing fallback or additional build step.

## Publishing and Search Console

1. Deploy the website changes through the existing GitHub Pages workflow.
2. In the Search Console property for `https://wild-butterfly.github.io/Vaaluation/`,
   submit `https://wild-butterfly.github.io/Vaaluation/sitemap.xml` under Sitemaps.
3. Use URL Inspection on the homepage and the new guide URLs. Test the live URL
   and request indexing where available after a successful deployment.
4. Review Page indexing for exclusions and Performance over a longer period
   (for example, three months). Publishing or submitting a sitemap does not
   guarantee indexing, rankings or immediate traffic.

The sitemap lists only canonical public pages. When adding or removing a guide,
update `website/sitemap.xml` and the guide hub, and add relevant internal links.
Do not insert a fresh `lastmod` on every deployment; only use a date when it
reflects a substantial content change.

## GitHub Pages project-path detail

Crawlers look for robots.txt at the host root:
`https://wild-butterfly.github.io/robots.txt`. The file deployed at
`/Vaaluation/robots.txt` cannot set crawler rules for this project. It is retained
for compatibility, but sitemap discovery must not depend on it. Submit the
sitemap directly in Search Console. If the host-root repository is managed
separately, its robots.txt can also advertise this project's sitemap.

## Content maintenance

Keep requirements, shortcuts and troubleshooting aligned with the README and app
behavior. The guides target the English Path of Exile 1 client on macOS; do not
imply PoE 2 support without testing it. Listed asking prices are comparisons,
not evidence of completed sales.

Google does not use the meta keywords tag, so it is omitted. Social preview tags
help sharing previews. Structured data describes visible content; it does not
guarantee rich results. Do not add invented reviews or ratings.

References:

- [Google SEO guidance for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [robots.txt location and scope](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)
- [Supported meta tags](https://developers.google.com/search/docs/crawling-indexing/special-tags)
