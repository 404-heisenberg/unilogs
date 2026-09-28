// Categorical colours for projects and tags, from the Figma palette (see the
// data-* tokens in index.css). Projects have no stored colour yet, so each
// project gets a stable colour from its id; tags get one from their name so
// the same tag matches on every page, including the public shared report.

// Same order as the Create Project colour picker.
export const PROJECT_COLORS = ['#d4a373', '#c9b559', '#7a9e6b', '#8c709c', '#6b8fad'] as const;

export function projectColor(projectId: number): string {
  const index =
    (((projectId - 1) % PROJECT_COLORS.length) + PROJECT_COLORS.length) % PROJECT_COLORS.length;
  return PROJECT_COLORS[index];
}

// Tag chips: gold, blue and green, as in the Figma entry and report screens.
const TAG_STYLES = ['bg-gold text-espresso', 'bg-data-blue text-white', 'bg-success text-white'];
const TAG_DOTS = ['#d4a843', '#4a7ab5', '#3e7a52'];

function tagIndex(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % TAG_STYLES.length;
}

export function tagStyle(name: string): string {
  return TAG_STYLES[tagIndex(name)];
}

export function tagDotColor(name: string): string {
  return TAG_DOTS[tagIndex(name)];
}
