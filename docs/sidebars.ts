import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// Grouped by what a reader is looking for rather than by when a page was
// written. Doc ids are file names, so page URLs stay the same as before.
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Product',
      collapsed: false,
      items: ['features', 'auth-wireframes', 'app-wireframes'],
    },
    {
      type: 'category',
      label: 'Technical',
      collapsed: false,
      items: ['tech-stack', 'api', 'database-design', 'testing-policy', 'performance'],
    },
    {
      type: 'category',
      label: 'Feedback',
      collapsed: false,
      items: ['user-testing', 'stakeholder-meetings'],
    },
    {
      type: 'category',
      label: 'Process',
      collapsed: false,
      items: [
        'methodology',
        'bug-tracking',
        'git-methodology',
        'development-plan',
        'sprint-1-standups',
        'sprint-2-standups',
        'sprint-3-standups',
      ],
    },
  ],
};

export default sidebars;
