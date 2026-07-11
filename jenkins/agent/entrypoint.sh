#!/bin/bash
set -euo pipefail

install -d -o jenkins -g jenkins -m 0700 /home/jenkins/.ssh
install -o jenkins -g jenkins -m 0600 /run/secrets/agent_ssh_public_key /home/jenkins/.ssh/authorized_keys

exec /usr/local/bin/setup-sshd "$@"
