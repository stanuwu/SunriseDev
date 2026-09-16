# Sunrise website

The Sunrise website.

Needs Hugo 0.146 or newer. The standard build is enough; the extended build is not needed.

```sh
hugo server                            # preview at http://localhost:1313, add -D to show drafts
hugo --minify --cleanDestinationDir    # build the site into public/
```

`--cleanDestinationDir` removes pages that no longer exist from `public/`. `hugo server` also writes
development pages there, with a live-reload script. Always run the build command before you upload
`public/`.

| Path | Holds |
|---|---|
| `hugo.toml` | Site settings, links and the header menu |
| `content/` | All pages, one Markdown file each |
| `layouts/home.html` | The landing page |
| `layouts/section.html`, `layouts/page.html` | Updates list and post |
| `layouts/docs/` | Guides and docs pages with the sidebar |
| `layouts/imprint.html` | Imprint & Credits page; owner data is in `hugo.toml` `[params.imprint]` |
| `layouts/_partials/` | Header, footer, cards, docs sidebar and `icon.html` |
| `assets/css/`, `assets/js/` | Styles and script, bundled at build time |
| `assets/icons/` | Icon SVGs from Tabler Icons, one file per icon |
| `static/images/` | Logos and page images |
| `static/fonts/` | Inter and Space Grotesk, loaded by `assets/css/fonts.css` |
| `static/licenses/` | Licenses for third-party files |

The site loads nothing from other servers. Keep it that way: host fonts and scripts in this folder,
and credit them under [Credits](#credits). The landing page numbers are fixed values in `hugo.toml`
under `[params.stats]`; update them by hand.

## Pages

Every page is a Markdown file under `content/`. The folder picks the section.

| Folder | Section | Order |
|---|---|---|
| `content/updates/` | Updates | Newest first, by `date` |
| `content/guides/` | Guides | By `weight`, then title |
| `content/docs/<section>/` | Docs | Sections by `weight`, pages by `weight`, then title |

Create a page with Hugo, then edit it:

```sh
hugo new content docs/sunrise/settings.md
```

A new page is a draft. `hugo server -D` shows drafts. Set `draft: false` to publish it.

```yaml
---
title: "My page"        # heading and sidebar label
date: 2026-09-15        # sets the order of updates
description: "One line" # text on the list card; without it, the page start is used
weight: 20              # order in the guides and docs sidebar, lower first
draft: false
---
```

Docs pages always go in a section folder: `mission-scripting/`, `sunrise/` or `destiny-2/`. To add a
section, create a subfolder of `content/docs/` with an `_index.md` that sets `title`, `description`
and `weight`.

Put images in `static/images/` and link them as `![A screenshot](/images/screenshot.png)`. Embed a
YouTube video with `{{</* youtube VIDEO_ID */>}}`.

## Icons

Icons come from [Tabler Icons](https://tabler.io/icons), MIT license. `content/imprint.md` credits
them and links to `static/licenses/tabler-icons.txt`.

To add or change an icon:

1. Find the icon on [tabler.io/icons](https://tabler.io/icons). Use the **Outline** style.
2. Download its SVG into `assets/icons/`. Keep Tabler's file name, for example `device-floppy.svg`.
3. Use the file name without `.svg` in a template:

   ```go-html-template
   {{ partial "icon.html" (dict "name" "device-floppy" "size" 38 "stroke" 1.5) }}
   ```

`size` is in pixels. `stroke` is the line width and defaults to 2. A name with no file stops the
build with an error. Use Tabler only, so the set stays consistent.

Add the SVG file before you use its name. If `hugo server` rebuilt while the file was missing, it
keeps the "not found" error after the file is added. Restart `hugo server` to fix that.

## Credits

| Work | By | License |
|---|---|---|
| Sunrise, site setup and content | [stanuwu](https://github.com/stanuwu) | [GPL-3.0](LICENSE) |
| Site design, layout and landing page | [zfreezie](https://github.com/zfreezie) | [GPL-3.0](LICENSE) |
| Sunrise logo | [Solus](https://www.youtube.com/@Solus-yt) | All rights reserved, used with permission |
| [Hugo](https://gohugo.io) | The Hugo Authors | Apache License 2.0 |
| [Tabler Icons](https://tabler.io/icons) | Paweł Kuna | [MIT](static/licenses/tabler-icons.txt) |
| [Inter](https://github.com/rsms/inter) font | The Inter Project Authors | [SIL OFL 1.1](static/licenses/inter-ofl.txt) |
| [Space Grotesk](https://github.com/floriankarsten/space-grotesk) font | The Space Grotesk Project Authors | [SIL OFL 1.1](static/licenses/space-grotesk-ofl.txt) |

Thanks to all [Sunrise contributors](https://github.com/stanuwu/Sunrise) and to the staff of the
[Sunrise Discord](https://discord.gg/projectsunrise).

The website shows the same list in `content/imprint.md`. Change both together.

## License

The website source is licensed under the GNU General Public License v3.0. The full text is in
[LICENSE](LICENSE). It covers the templates, styles, script, configuration and page content.

These files keep their own terms and are not covered by the GPL:

| Files | Terms |
|---|---|
| `static/images/sunrise-*.png` (the Sunrise logo) | Copyright Solus, all rights reserved. Do not reuse it outside this project. |
| `static/fonts/` | SIL Open Font License 1.1, see `static/licenses/inter-ofl.txt` and `space-grotesk-ofl.txt` |
| `assets/icons/` | MIT, see `static/licenses/tabler-icons.txt` |

Destiny 2 is a trademark of Bungie. Sunrise is not affiliated with Bungie or Sony.