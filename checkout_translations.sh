#!/bin/bash
paths=(
  "src/views/settings/player-panel"
  "src/views/settings/webhooks-panel.tsx"
  "src/views/settings/webhooks-panel"
  "src/views/settings/relay-panel.tsx"
  "src/views/settings/relay-panel"
  "src/views/settings/player-layout-panel"
  "src/components/profile-picker"
  "src/components/together-modal.tsx"
  "src/components/together-deploy-modal.tsx"
  "src/components/together-relay-banner.tsx"
  "src/components/together-chat-toast.tsx"
  "src/components/together-host-leaving-prompt.tsx"
  "src/components/together-leave-for-live-modal.tsx"
  "src/components/together-participant-left-toast.tsx"
  "src/components/together-summon-toast.tsx"
  "src/lib/together"
  "src/views/together"
)

for p in "${paths[@]}"; do
  if git ls-tree -r userrepo/main | grep -q "$p"; then
    echo "Checking out $p..."
    git checkout userrepo/main -- "$p"
  else
    echo "Warning: $p not found in userrepo/main"
  fi
done
