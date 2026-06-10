# Security Policy

Prompt Glider is a **local-only toy**. The event server binds to `127.0.0.1`,
stores no secrets, and requires no authentication.

## Scope notes

- The server binds to localhost only — do **not** expose port 6030 publicly.
- Leaderboard input is hardened: the `glider` field is whitelisted server-side
  and `distance` is coerced to a number, so stored values can't inject markup.
- The Claude Code hooks are gated on a flag file (`~/.glide-armed`) and no-op
  when the game is off.

## Reporting

Found an issue? Please open a GitHub issue. For anything sensitive, use the
repository's private vulnerability reporting if enabled.
