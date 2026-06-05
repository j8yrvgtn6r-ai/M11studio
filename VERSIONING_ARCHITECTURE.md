# Protocol Versioning Architecture

## Current (v2 PR 2) — local scaffold

M11 Studio stores protocol version history locally using a Git-inspired commit model:

- **ProtocolVersion** — labeled workspace version with `headCommitId` and lifecycle status
- **ProtocolCommit** — snapshot metadata with parent chain, message, source, changed sections, validation summary

### Commit triggers (local)

| Event | `source` | When |
|-------|----------|------|
| Import processing completes | `importRewrite` | After DOCX extraction + draft generation |
| Import overwrites prior import | `importRewrite` | New upload replaces existing drafts |
| Section approved (validation passed) | `sectionApproval` | Human approval + validation success |

Storage: `localStorage` key `m11-protocol-versioning-v1`.

### Comparison scaffold

- `compareProtocolCommits(commitA, commitB)` — returns changed section ids + placeholder note
- `compareProtocolVersions(versionA, versionB)` — placeholder only
- UI: **Compare Versions** disabled (coming soon)

### Archive export

**Export M11 Studio Archive** downloads JSON (`m11-studio-archive/v1`) containing:

- Protocol document snapshot
- Import metadata, section drafts, review states
- Protocol knowledge model
- Commits and current version
- Reference document metadata
- Controlled terminology meta + app schema version

## Future hosted solution (not implemented)

Planned cloud capabilities:

- Authenticated users and study-scoped protocol workspaces
- Team members, invitations, and roles: owner, editor, reviewer, approver, viewer
- Threaded comments and review assignments
- Server-side immutable version history and audit trail
- Side-by-side comparison between versions and commits
- Export/archive packages stored in regulated object storage
- Integration with change control and amendment baselines

Local commits in v2 PR 2 are designed to map to server-side revision records without changing the UI model.
