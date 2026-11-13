declare module 'citeproc'
declare module '@citation-js/core'
declare module '@citation-js/plugin-bibtex'
declare module '*.csl?raw' {
  const text: string
  export default text
}
declare module 'markdown-it-footnote'
