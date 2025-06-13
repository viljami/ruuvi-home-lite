# GitHub Pages for Ruuvi Home Lite

This directory contains the source files for the Ruuvi Home Lite project website, which is published using [GitHub Pages](https://pages.github.com/).

## Structure

- `_config.yml` - Configuration file for the Jekyll site
- `index.md` - Main content file for the website
- `assets/` - Directory containing static assets
  - `images/` - Screenshots and images
  - `css/` - Custom styles

## Enabling GitHub Pages

To enable GitHub Pages for this repository:

1. Go to the repository settings on GitHub
2. Navigate to the "Pages" section
3. Under "Source", select the branch containing this `gh-pages` directory
4. Save the settings

Your site will be published at `https://[username].github.io/ruuvi-home-lite/` or your custom domain if configured.

## Customization

- Edit `_config.yml` to change site title, description, or theme
- Modify `index.md` to update the main content
- Update `assets/css/style.scss` to customize the appearance

## Local Development

To test the site locally, you'll need [Jekyll](https://jekyllrb.com/docs/installation/) installed. Then run:

```bash
cd gh-pages
bundle install
bundle exec jekyll serve
```

This will start a local server at `http://localhost:4000`.
