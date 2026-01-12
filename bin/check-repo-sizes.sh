#!/bin/bash
# Fetch GitHub repo sizes for key projects

REPOS=(
    "moondev-algotrade"
    "moondev-algotrade2"
    "trae-agent"
    "scx-loader"
    "g3"
    "algotrade-saas"
    "JOBSPRINT-ANTIGRAVITY"
)

echo "Fetching repository sizes from GitHub..."
echo "----------------------------------------"
printf "%-30s %-10s\n" "REPOSITORY" "SIZE (KB)"

for repo in "${REPOS[@]}"; do
    SIZE=$(gh api "repos/CGDarkstardev1/$repo" --jq '.size' 2>/dev/null || echo "Not Found")
    printf "%-30s %-10s\n" "$repo" "$SIZE"
done
