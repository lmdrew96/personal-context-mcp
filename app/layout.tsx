export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f0f11", color: "#f7f5fa" }}>
        {children}
      </body>
    </html>
  );
}
