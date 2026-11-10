#!/usr/bin/env bash
set -e

# 1. Install Rust quietly with default host settings
echo Installing rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y -t wasm32-unknown-unknown --default-toolchain nightly

# 2. Add cargo to PATH in the current subshell
echo Adding rustup and cargo to PATH
source "$HOME/.cargo/env"

# 5. Run your project build
echo Building
pnpm run build
