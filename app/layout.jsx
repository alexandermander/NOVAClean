import './globals.css'

export const metadata = {
  title: 'Opgaveboard',
  description: 'Ugentlige og månedlige opgaver',
}

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  )
}
