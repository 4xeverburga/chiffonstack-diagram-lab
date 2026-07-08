# CLAUDE.md

Guidance for Claude Code when working in this repository.

<!-- SPECKIT START -->
Current feature plan: specs/012-overload-collapse/plan.md (constitution: .specify/memory/constitution.md v3.3.0; feature includes v3.4.0 amendment)
<!-- SPECKIT END -->

## Coding conventions
- Centralize any parameter on a config file or .env
- All imports must be declared with relation to  the root of the project. This way refactoring and moving files is easier.

## Branch Strategies
main branch is protected to push. You can only pr it.

when finishing a feature you merge to dev first. Only then pr to main

### No default parameter values

Never use default values on function, method, constructor, or arrow-function
parameters. Every argument must be passed explicitly at the call site.

```ts
// ✗ don't — implicit behavior hidden in the signature
function loadKey(name = "RESEND_API_KEY") { … }

// ✓ do — caller states intent
function loadKey(name: string) { … }
```

If a call site needs "the usual" value, pass it explicitly (or use an options
object with every key provided). Behavior should never depend on an omitted
argument.
