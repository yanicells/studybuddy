import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import stylesHref from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Studybuddy' },
      {
        name: 'description',
        content: 'A focused flashcard library for short, effective study sessions.',
      },
      { name: 'theme-color', content: '#f4f4f3' },
    ],
    links: [{ rel: 'stylesheet', href: stylesHref }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: () => <main className="route-message">Page not found.</main>,
  errorComponent: ({ error }) => (
    <main className="route-message">
      <h1>Studybuddy could not open.</h1>
      <p>{error.message}</p>
    </main>
  ),
})

function RootComponent() {
  return <Outlet />
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
