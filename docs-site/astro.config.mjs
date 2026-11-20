// Documentación de Organon. Se publica en GitHub Pages con
// .github/workflows/docs.yml cada vez que cambia docs-site/ en main.
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://la-borbolla-editorial.github.io',
  base: '/organon',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Organon',
      description: 'Lector de PDF, fichero y editor para escribir una tesis, con la cita y la página impresa correctas.',
      defaultLocale: 'root',
      locales: { root: { label: 'Español', lang: 'es' } },
      favicon: '/favicon.png',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/La-Borbolla-Editorial/organon' }],
      editLink: { baseUrl: 'https://github.com/La-Borbolla-Editorial/organon/edit/main/docs-site/' },
      lastUpdated: true,
      customCss: ['./src/styles/organon.css'],
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      sidebar: [
        { label: 'Empezar', items: [{ autogenerate: { directory: 'empezar' } }] },
        { label: 'Conceptos', items: [{ autogenerate: { directory: 'conceptos' } }] },
        { label: 'Guías', items: [{ autogenerate: { directory: 'guias' } }] },
        { label: 'Referencia', items: [{ autogenerate: { directory: 'referencia' } }] },
        { label: 'Problemas frecuentes', link: '/problemas-frecuentes/' },
      ],
    }),
  ],
})
