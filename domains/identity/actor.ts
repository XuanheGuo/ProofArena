// Identity seam: domains/* import Actor-related helpers from here instead of
// reaching into lib/is-moderator.ts / lib/require-moderator.ts directly, so
// the dependency direction (domains depend on a named identity contract) is
// explicit. This is a re-export, not a reimplementation -- CLAUDE.md is
// explicit that the moderator/admin check must never be duplicated. See
// docs/ARCHITECTURE_V2.md §3, §10.
export { isModerator } from "@/lib/is-moderator";
export { requireModerator } from "@/lib/require-moderator";
export type { Actor } from "@/contracts/capability";
