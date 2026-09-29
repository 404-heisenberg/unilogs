import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'UniLogs',
  tagline: 'A customisable digital logbook for university students',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://unilogs-docs.vercel.app',
  baseUrl: '/',

  organizationName: '404-heisenberg',
  projectName: 'unilogs',

  onBrokenLinks: 'throw',
  markdown: {
    // Renders ```mermaid code blocks as diagrams (used for the database ERD).
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/404-heisenberg/unilogs/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      // Offline full-text search, indexed at build time. No external service
      // or API key, so it works the same locally and on Vercel.
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        docsRouteBasePath: '/',
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
        searchResultContextMaxLength: 60,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'UniLogs',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        { to: '/features', label: 'Features', position: 'left' },
        { to: '/#rubric-evidence', label: 'Rubric evidence', position: 'left' },
        {
          href: 'https://unilogs.vercel.app',
          label: 'Live app',
          position: 'right',
        },
        {
          href: 'https://unilogs.onrender.com/api/docs#description/introduction',
          label: 'API reference',
          position: 'right',
        },
        {
          href: 'https://github.com/404-heisenberg/unilogs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Introduction', to: '/' },
            { label: 'Features', to: '/features' },
            { label: 'API overview', to: '/api' },
            { label: 'Testing policy', to: '/testing-policy' },
          ],
        },
        {
          title: 'Live',
          items: [
            { label: 'UniLogs app', href: 'https://unilogs.vercel.app' },
            {
              label: 'API reference',
              href: 'https://unilogs.onrender.com/api/docs#description/introduction',
            },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Repository',
              href: 'https://github.com/404-heisenberg/unilogs',
            },
            {
              label: 'Issue board',
              href: 'https://github.com/orgs/404-heisenberg/projects',
            },
          ],
        },
      ],
      copyright: `Team Code of Duty · COMS3011A Software Design Project · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
