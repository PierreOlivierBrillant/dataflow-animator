const sidebars = {
  docsSidebar: [
    // The `menu-icon-*` classes draw a pictogram through a CSS mask (see custom.css).
    { type: 'doc', id: 'intro', className: 'menu-icon-intro' },
    { type: 'doc', id: 'installation', className: 'menu-icon-installation' },
    {
      type: 'category',
      label: 'Concepts',
      className: 'menu-icon-concepts',
      items: [
        'concepts/nodes',
        'concepts/packets',
        'concepts/decor',
        'concepts/layout',
        'concepts/timeline',
        'concepts/math',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      className: 'menu-icon-reference',
      items: [
        'reference/actions',
        'reference/packages',
        'reference/components',
        'reference/api',
      ],
    },
  ],
};

export default sidebars;
