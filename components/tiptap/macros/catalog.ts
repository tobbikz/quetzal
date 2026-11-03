export type MacroGroup = 'elements' | 'structure' | 'discovery' | 'people' | 'embeds' | 'jira';

export type MacroDef = {
  id: string;
  title: string;
  group: MacroGroup;
  /** TipTap node kind */
  kind: 'atom' | 'expand' | 'decision' | 'layout' | 'date' | 'anchor' | 'panel' | 'status' | 'excerpt';
  hint?: string;
  /** Prompt keys when inserting atom macros */
  prompts?: { key: string; label: string; placeholder?: string }[];
  defaults?: Record<string, string>;
};

/** Full Quetzal macro catalog (Jira ADF elements + Confluence macros). */
export const MACRO_CATALOG: MacroDef[] = [
  // Elements / ADF
  { id: 'expand', title: 'Expand', group: 'elements', kind: 'expand' },
  { id: 'date', title: 'Date', group: 'elements', kind: 'date' },
  { id: 'decision', title: 'Decision', group: 'elements', kind: 'decision' },
  { id: 'layout-2', title: 'Layout 2 columns', group: 'elements', kind: 'layout' },
  { id: 'anchor', title: 'Anchor', group: 'elements', kind: 'anchor', prompts: [{ key: 'name', label: 'Anchor name', placeholder: 'section-1' }] },
  { id: 'status', title: 'Status', group: 'elements', kind: 'status' },
  { id: 'panel', title: 'Panel', group: 'elements', kind: 'panel' },
  { id: 'excerpt', title: 'Excerpt', group: 'structure', kind: 'excerpt' },

  // Structure / reuse
  { id: 'toc', title: 'Table of Contents', group: 'structure', kind: 'atom', hint: 'Auto headings from this page' },
  { id: 'toc-zone', title: 'TOC Zone', group: 'structure', kind: 'atom', hint: 'TOC limited to following section' },
  { id: 'children', title: 'Children Display', group: 'structure', kind: 'atom' },
  {
    id: 'include-page',
    title: 'Include Page',
    group: 'structure',
    kind: 'atom',
    hint: 'Embed another page body',
    prompts: [
      { key: 'slug', label: 'Page slug (or SPACE/slug)', placeholder: 'overview' },
      { key: 'space', label: 'Space key (optional)', placeholder: 'ENG' },
    ],
  },
  {
    id: 'excerpt-include',
    title: 'Excerpt Include',
    group: 'structure',
    kind: 'atom',
    hint: 'Pull Excerpt block from another page',
    prompts: [
      { key: 'slug', label: 'Page slug (or SPACE/slug)', placeholder: 'overview' },
      { key: 'space', label: 'Space key (optional)', placeholder: 'ENG' },
    ],
  },
  {
    id: 'include-excerpt',
    title: 'Include Excerpt',
    group: 'structure',
    kind: 'atom',
    hint: 'Alias of Excerpt Include',
    prompts: [
      { key: 'slug', label: 'Page slug (or SPACE/slug)', placeholder: 'overview' },
      { key: 'space', label: 'Space key (optional)', placeholder: 'ENG' },
    ],
  },
  { id: 'page-tree', title: 'Page Tree', group: 'structure', kind: 'atom' },
  { id: 'page-tree-search', title: 'Page Tree Search', group: 'structure', kind: 'atom' },
  { id: 'attachments', title: 'Attachments', group: 'structure', kind: 'atom' },
  { id: 'page-index', title: 'Page Index', group: 'structure', kind: 'atom' },

  // Discovery
  { id: 'content-by-label', title: 'Content by Label', group: 'discovery', kind: 'atom', prompts: [{ key: 'label', label: 'Label', placeholder: 'runbook' }] },
  { id: 'labels-list', title: 'Labels List', group: 'discovery', kind: 'atom' },
  { id: 'popular-labels', title: 'Popular Labels', group: 'discovery', kind: 'atom' },
  { id: 'related-labels', title: 'Related Labels', group: 'discovery', kind: 'atom' },
  { id: 'recently-updated', title: 'Recently Updated', group: 'discovery', kind: 'atom' },
  { id: 'recently-updated-dashboard', title: 'Recently Updated Dashboard', group: 'discovery', kind: 'atom' },
  { id: 'livesearch', title: 'Livesearch', group: 'discovery', kind: 'atom' },
  { id: 'spaces-list', title: 'Spaces List', group: 'discovery', kind: 'atom' },
  { id: 'blog-posts', title: 'Blog Posts', group: 'discovery', kind: 'atom' },
  { id: 'content-report-table', title: 'Content Report Table', group: 'discovery', kind: 'atom', prompts: [{ key: 'label', label: 'Label', placeholder: 'ops' }] },

  // People
  { id: 'contributors', title: 'Contributors', group: 'people', kind: 'atom' },
  { id: 'contributors-summary', title: 'Contributors Summary', group: 'people', kind: 'atom' },
  { id: 'user-list', title: 'User List', group: 'people', kind: 'atom' },
  { id: 'user-profile', title: 'User Profile', group: 'people', kind: 'atom', prompts: [{ key: 'name', label: 'User name', placeholder: 'Ana Solis' }] },
  { id: 'profile-picture', title: 'Profile Picture', group: 'people', kind: 'atom', prompts: [{ key: 'name', label: 'User name', placeholder: 'Ana Solis' }] },
  { id: 'change-history', title: 'Change History', group: 'people', kind: 'atom' },
  { id: 'task-report', title: 'Task Report', group: 'people', kind: 'atom' },
  { id: 'decision-report', title: 'Decision Report', group: 'people', kind: 'atom' },
  { id: 'create-from-template', title: 'Create from Template', group: 'people', kind: 'atom', prompts: [{ key: 'title', label: 'New page title', placeholder: 'New runbook' }] },

  // Embeds
  { id: 'iframe', title: 'iFrame', group: 'embeds', kind: 'atom', prompts: [{ key: 'url', label: 'URL', placeholder: 'https://' }] },
  { id: 'widget', title: 'Widget Connector', group: 'embeds', kind: 'atom', prompts: [{ key: 'url', label: 'YouTube / media URL', placeholder: 'https://youtube.com/watch?v=' }] },
  { id: 'pdf', title: 'PDF', group: 'embeds', kind: 'atom', prompts: [{ key: 'url', label: 'PDF URL', placeholder: 'https://' }] },
  { id: 'office', title: 'Microsoft Office', group: 'embeds', kind: 'atom', prompts: [{ key: 'url', label: 'File URL', placeholder: 'https://' }] },
  { id: 'onedrive', title: 'OneDrive', group: 'embeds', kind: 'atom', prompts: [{ key: 'url', label: 'OneDrive URL', placeholder: 'https://' }] },
  { id: 'gallery', title: 'Gallery', group: 'embeds', kind: 'atom' },
  { id: 'chart', title: 'Chart', group: 'embeds', kind: 'atom' },
  {
    id: 'page-properties',
    title: 'Page Properties',
    group: 'embeds',
    kind: 'atom',
    hint: 'Key-value table for this page',
    prompts: [{ key: 'key', label: 'Property key (optional)', placeholder: 'owner' }],
  },
  { id: 'page-properties-report', title: 'Page Properties Report', group: 'embeds', kind: 'atom' },
  { id: 'roadmap-planner', title: 'Roadmap Planner', group: 'embeds', kind: 'atom' },
  { id: 'network', title: 'Network', group: 'embeds', kind: 'atom', prompts: [{ key: 'url', label: 'Profile URL', placeholder: 'https://' }] },

  // Jira bridge (live expand via lib/jql.ts — = and ~ only, no !=)
  {
    id: 'jira-issues',
    title: 'Jira Issues',
    group: 'jira',
    kind: 'atom',
    hint: 'Issue table from QQL',
    prompts: [{ key: 'jql', label: 'QQL', placeholder: 'project = OPS AND status = todo' }],
  },
  {
    id: 'work-items',
    title: 'Work Items',
    group: 'jira',
    kind: 'atom',
    hint: 'Alias of Jira Issues',
    prompts: [{ key: 'jql', label: 'QQL', placeholder: 'project = OPS AND status = "In Progress"' }],
  },
  {
    id: 'jira-chart',
    title: 'Jira Chart',
    group: 'jira',
    kind: 'atom',
    hint: 'Status count bars from QQL',
    prompts: [{ key: 'jql', label: 'QQL', placeholder: 'project = OPS' }],
  },
  { id: 'jira-roadmap', title: 'Jira Roadmap', group: 'jira', kind: 'atom', prompts: [{ key: 'project', label: 'Project key', placeholder: 'OPS' }] },
];

export const MACRO_GROUPS: { id: MacroGroup; title: string }[] = [
  { id: 'elements', title: 'Elements' },
  { id: 'structure', title: 'Structure' },
  { id: 'discovery', title: 'Discovery' },
  { id: 'people', title: 'People' },
  { id: 'embeds', title: 'Embeds' },
  { id: 'jira', title: 'Jira' },
];
