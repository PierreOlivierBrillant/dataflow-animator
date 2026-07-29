// Side-effect stylesheet imports (the bundler extracts the CSS). Core's tsconfig
// sets `types: []`, so no bundler client typing supplies this declaration.
declare module '*.css';
