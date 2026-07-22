# Git Commit Workflow
Whenever I ask you to commit changes, or after you finish making a file modification:
1. Run `git diff` internally to see what changed.
2. Draft a **relevant, short, and concise** conventional commit message (e.g., "feat: add user login" or "fix: resolve crash on null pointer").
3. Present the message to me clearly.
4. **STOP and ask for my explicit approval.** Do NOT execute the `git commit` command yourself until I say "yes", "approve", or "go ahead".

## Knowledge Base Guidelines (OKF)
- Project knowledge lives in `.okf/` following the Open Knowledge Format spec.
- **Before major edits:** Read `.okf/index.md` to get context on project conventions.
- **After major refactors/features:** Update or add a concept `.md` file inside `.okf/`.
- Ensure all new concept files in `.okf/` start with YAML frontmatter containing `type: <category>`.