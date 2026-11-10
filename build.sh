#!/usr/bin/env bash
set -e

# Install Rust toolchain with the wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-target wasm32-unknown-unknown

# Source cargo into PATH
source "$HOME/.cargo/env"

# Run your frontend / application build
pnpm run build
