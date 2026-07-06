# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Coding conventions
- Centralize any parameter on a config file or .env
- All imports must be declared with relation to  the root of the project. This way refactoring and moving files is easier.

## Branch Strategies
main and dev branches are protected to push. You can only pr it.

when finishing a feature you pr to dev first. Only then to main

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
