import type { Metadata } from "next";
import "./globals.css";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";

export const metadata: Metadata = {
  title: "Notion to HTML",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ fontSize: "16px" }} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <link rel="icon" href="/icon.png" sizes="any" />
      <body style={{ fontSize: "1rem", lineHeight: "1.5" }}>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
}
