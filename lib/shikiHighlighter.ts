import {
  BundledLanguage,
  BundledTheme,
  createHighlighter,
  HighlighterGeneric,
} from "shiki";

let highlighter: HighlighterGeneric<BundledLanguage, BundledTheme> | null =
  null;

export async function createShikiHighlighter() {
  if (highlighter) {
    return highlighter;
  }

  highlighter = await createHighlighter({
    langs: [
      "py",
      "python",
      "bash",
      "c",
      "cpp",
      "yaml",
      "markdown",
      "json",
      "llvm",
    ],
    themes: ["material-theme-palenight"],
  });

  return highlighter;
}
