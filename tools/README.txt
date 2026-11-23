# The Qingquan Xiao Lab — Online Tools

Upload these four HTML files to the repository's `tools/` directory:

- `random-sequence.html`
- `dna-sequence-analyzer.html`
- `grna-sequence-tools.html`
- `sequence-utilities.html`

Each page links back to `../index.html` and runs entirely in the browser. No backend or API is required.

Suggested URLs:
- `/tools/random-sequence.html`
- `/tools/dna-sequence-analyzer.html`
- `/tools/grna-sequence-tools.html`
- `/tools/sequence-utilities.html`

Add links to these URLs from both the English and Chinese homepages as desired.

Notes:
- The gRNA page performs basic sequence heuristics and motif-based PAM scanning only. It does not perform genome-wide off-target analysis or predict editing efficiency.
- The analyzer calculates GC content over unambiguous A/C/G/T bases, excluding N.
- Sequence operations run locally in the visitor's browser; sequences are not uploaded.
