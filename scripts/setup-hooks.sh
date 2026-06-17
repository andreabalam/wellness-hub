#!/bin/sh
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
set -e

# Block .env files from being staged
if git diff --cached --name-only | grep -qE '\.env(\.local)?$'; then
  echo "ERROR: .env file staged. Remove it with: git restore --staged <file>"
  exit 1
fi

# Block common secret patterns in staged content. Exclude this hook script
# itself so its own pattern definitions don't trip the scanner.
if git diff --cached -- . ':(exclude)scripts/setup-hooks.sh' | grep -qiE '(sk-ant-|hf_[A-Za-z0-9]{30,}|DEMO[A-Z_]+=.{10,})'; then
  echo "ERROR: Possible secret detected in staged changes. Review before committing."
  exit 1
fi

# Formatting (fail if anything is unformatted)
npm run format:check

# Lint (fail on errors; warnings are allowed)
npm run lint

# Unit tests + coverage (exits non-zero if any threshold is missed)
npm run test:coverage -- --reporter=dot
EOF
chmod +x .git/hooks/pre-commit
echo "Pre-commit hook installed."
