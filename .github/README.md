# 🤖 GitHub Automation

This directory contains automated workflows for the Petrie Dish project.

## 📋 Auto-Generated TODO.md

### How it works:

1. **Trigger:** When any issue is opened, closed, edited, or labeled
2. **Action:** GitHub Action runs automatically
3. **Script:** Python script fetches all issues via API
4. **Generate:** Creates new TODO.md with current status
5. **Commit:** Auto-commits changes (if any)

### Workflow: `.github/workflows/update-todo.yml`

```yaml
on:
  issues:
    types: [opened, closed, reopened, edited, labeled, unlabeled]
```

Triggers on any issue change.

### Script: `.github/scripts/generate-todo.py`

Python script that:
- Fetches all issues from GitHub API
- Categorizes by priority (labels: `priority-high`, `priority-medium`, `priority-low`)
- Groups by milestone (`v5.1-C2`, `v5.2`, etc)
- Generates markdown with:
  - Overall progress bar
  - Checkboxes (✓ if closed)
  - Issue links
  - Labels
  - Statistics

### Generated TODO.md format:

```markdown
# TODO List

## 📊 Overall Progress
**3/10** tasks completed (30%)
`███░░░░░░░` 30%

## 🔥 Priority 1
### v5.1-C2
**Progress:** `██░░░░░░░░` 2/4 (50%)

- [x] **[#1](link)** - Remove legacy CPU physics
- [ ] **[#2](link)** - Optimize GPU compute
- [x] **[#3](link)** - Improve buffer sync
- [ ] **[#4](link)** - Performance benchmarking
```

## 🎯 Usage

### For developers:

**Don't edit TODO.md manually!** It will be overwritten.

Instead:
1. Create/edit issues on GitHub
2. Add labels (`priority-high`, `v5.1-C2`, etc)
3. Close issues when done
4. TODO.md updates automatically!

### Manual trigger:

You can manually trigger the workflow:
1. Go to: Actions → Auto-Update TODO.md
2. Click "Run workflow"
3. Select branch
4. Click "Run workflow" button

## 🔧 Configuration

### Priority mapping:

- `priority-high` or `v5.1-*` → 🔥 Priority 1
- `priority-medium` or `v5.2` → 📌 Priority 2  
- `priority-low` → 💡 Priority 3
- No labels → 📋 Other

### Milestone grouping:

Issues are grouped by milestone within each priority.

## 📊 Benefits:

✅ Always up-to-date TODO  
✅ Zero manual work  
✅ Links to actual issues  
✅ Progress tracking  
✅ Commit history preserved  

## 🛠️ Troubleshooting:

### Action fails?

1. Check Actions tab for error logs
2. Verify `GITHUB_TOKEN` has permissions
3. Check Python script syntax

### TODO.md not updating?

1. Check if action ran (Actions tab)
2. Verify issues have proper labels
3. Manual trigger: Actions → Run workflow

---

**Created:** 2025-01-07  
**Status:** ✅ Active
