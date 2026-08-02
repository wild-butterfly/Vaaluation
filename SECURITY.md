# Security Policy

## Supported versions

Only the latest release of Vaaluation is supported with security updates.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Use GitHub's private vulnerability reporting ("Report a vulnerability" under
the Security tab) on this repository. You can expect an acknowledgement within
7 days.

## Scope notes

- Vaaluation ships no backend; the attack surface is the local app and its
  requests to official Path of Exile services.
- Reports about clipboard handling, keystroke synthesis, permission scope, or
  the update mechanism are especially valuable.
- Vaaluation stores no credentials in the MVP. If OAuth support is added,
  tokens will live in the macOS Keychain — anything contrary is a bug.
