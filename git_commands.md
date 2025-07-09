# Git Commands & Version Control Cheat Sheet

## What You Learned Today (Summary)

### 1. Git Basics
- How to initialize a Git repo for your whole project (`git init`)
- How to avoid/fix nested Git repos (removing extra `.git` folders)
- How to add, commit, and push code to GitHub
- How to check status and history (`git status`, `git log --oneline`)

### 2. Saving & Restoring Your Work
- How to create “save points” (commits) and push them online
- How to restore (reset) your project to any previous commit:
  - `git reset --hard <commit-hash>`
  - `git push --force` (update GitHub to match your local repo)

### 3. Managing Commits & History
- How to delete the latest (or multiple) commits
- How to update author info for future commits and rewrite history for old commits (`git rebase -i --root`)
- How to apply changes from old commits to new code (`git cherry-pick <commit-hash>`)
- How to undo a commit with `git revert <commit-hash>`

### 4. Editors & Troubleshooting
- How to escape “stuck” in Vim, and set Notepad as your default editor (`git config --global core.editor notepad`)

---

## Essential Git Commands

```bash
# Check the status of your repo
git status

# See a short log of all commits
git log --oneline

# Add all changed files to staging
git add .

# Commit staged changes
git commit -m "Describe what you changed"

# Push your commits to GitHub
git push

# Force-push (when you rewrite history)
git push --force

# Set up GitHub remote (first time)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main

# Change Git author info
# (for this repo)
git config user.name "Your New Name"
git config user.email "your@email.com"
# (global, for all repos)
git config --global user.name "Your New Name"
git config --global user.email "your@email.com"

# Go back to a previous commit (erase all after it)
git reset --hard <commit-hash>

# Keep changes but remove commits
git reset --soft <commit-hash>

# Apply an old commit's changes to current code
git cherry-pick <commit-hash>

# Undo a commit (creates a new commit to revert it)
git revert <commit-hash>

# Rewrite commit history (to edit author, delete commits, etc)
git rebase -i --root

# Abort a stuck rebase
git rebase --abort
```

---

## Pro Tips
- **Always use `git status` to see what's changed.**
- **Force-push only after a reset/rebase/changing history.**
- **If you get stuck in Vim, set Notepad as your default git editor.**
- **Use `git log --oneline` to copy commit hashes for resets/cherry-picks.**
- **Commit often! It’s easy to experiment when you can go back any time.**

---

**Congrats, you now have real developer-level version management skills! 🚀**

(Feel free to add project-specific notes below.)
