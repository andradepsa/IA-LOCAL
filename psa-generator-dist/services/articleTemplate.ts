// services/articleTemplate.ts
// Template LaTeX UNIVERSAL — fixo, à prova de erros de compilação.
// A IA só preenche os placeholders __CONTENT_*__ com texto plano.

export const ARTICLE_TEMPLATE = `\\documentclass[12pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[english,brazilian,portuguese,spanish,french]{babel}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{geometry}
\\geometry{a4paper,margin=2.5cm}
\\usepackage{setspace}
\\onehalfspacing
\\usepackage{url}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\hypersetup{
  colorlinks=true,
  linkcolor=blue,
  citecolor=blue,
  urlcolor=blue,
  pdftitle={__TITLE__},
  pdfauthor={__AUTHOR_NAMES__}
}

\\title{__TITLE__}
\\author{__AUTHOR_LATEX__}
\\date{}

\\begin{document}
\\maketitle

\\begin{abstract}
__ABSTRACT__
\\end{abstract}

\\vspace{0.5cm}
\\noindent\\textbf{Keywords:} __KEYWORDS__

\\vspace{1cm}

\\section{Introduction}
__CONTENT_INTRODUCTION__

\\section{Literature Review}
__CONTENT_LITERATURE__

\\section{Methodology}
__CONTENT_METHODOLOGY__

\\section{Results}
__CONTENT_RESULTS__

\\section{Discussion}
__CONTENT_DISCUSSION__

\\section{Conclusion}
__CONTENT_CONCLUSION__

\\section*{References}
\\begingroup
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.5em}
__REFERENCES__
\\endgroup

\\end{document}
`;
