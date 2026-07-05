# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Coding conventions

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

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
[specs/002-node-connection-handles/plan.md](specs/002-node-connection-handles/plan.md)
<!-- SPECKIT END -->