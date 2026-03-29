# AGENTS.md - PG_Management

This file defines mandatory working rules for any AI agent operating in this repository.

## 1) Source of Truth

Follow this document hierarchy in order:

1. `docs/PG_management.txt` (business context)
2. `docs/DOC1.MD` to `docs/DOC16.md` (product/tech/ops details)
3. This `AGENTS.md` (execution rules)

If docs conflict, prefer the higher priority document and note assumptions in output.

## 2) Non-Negotiable Workflow

For implementation tasks, always execute this sequence:

1. Understand requirement and identify target modules/files.
2. Implement minimal correct change.
3. Add or update tests.
4. Run validation commands.
5. Summarize changed files, behavior impact, and residual risks.

Do not stop at analysis when code changes are requested.

## 3) Planning and Scope Control

- Use `docs/DOC12.md` for task breakdown standards.
- Keep changes scoped to requested outcome.
- Avoid opportunistic refactors unless they unblock correctness.
- If blocked by missing info, choose safest reasonable assumption and continue.

## 4) Coding Standards

Follow `docs/DOC13.md`:

- Strict typing and validated boundaries
- Standardized error responses
- No secrets in code or logs
- Clear module boundaries

## 5) API and Data Rules

- API conventions must follow `docs/DOC7.md`.
- Security behavior must follow `docs/DOC8.md`.
- Deployment and migration constraints must follow `docs/DOC9.md`.
- Use money values as integers in paisa.

## 6) UI/UX Rules

For UI work, follow `docs/DOC14.md`:

- Mobile-first by default
- Clear primary action per screen
- Explicit loading/empty/error states
- Accessibility baseline checks

## 7) Definition of Done (Mandatory)

A task is not complete unless relevant items in `docs/DOC15.md` are satisfied.

Minimum required checks before final response:

- Lint passes
- Typecheck passes
- Tests pass for affected areas
- Security-sensitive changes reviewed against DOC8 rules
- Docs updated if behavior or interfaces changed

If any check cannot be run, explicitly state what was not run and why.

## 8) Local Setup and Commands

Use `docs/DOC16.md` for environment and command expectations.

If repository scripts are missing, propose exact scripts needed and continue with available validation.

## 9) Security and Privacy

- Enforce authorization and tenant/property isolation on all protected paths.
- Never expose sensitive data (KYC, tokens, secrets, full identifiers).
- Verify webhook signatures for payment events.
- Do not log raw secrets or personal identifiers.

## 10) Output Format for Task Completion

Every final task response should include:

1. What changed (files/modules)
2. Why it changed
3. Validation performed (commands/tests)
4. Any limitations, assumptions, or next actions

Keep responses concise and factual.

## 11) Forbidden Actions

- Do not fabricate test results.
- Do not claim completion without validation evidence.
- Do not ignore failing checks silently.
- Do not commit secrets or environment values.

---

Status: Active project execution rules for PG_Management.

