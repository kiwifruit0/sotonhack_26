#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
FORUM_URL="${FORUM_URL:-$BASE_URL/forum}"
USERNAME="arun"

interests=(
  # "Arts & Design"
  # "Digital Culture"
  # "Content Creation"
  # "Crafting & DIY"
  # "Photography & Film"
  # "Competitive Gaming"
  # "Casual Gaming"
  # "Tabletop & Roleplaying"
  # "Live Music & Festivals"
  # "Performing Arts"
  # "Outdoor Adventure"
  # "Team Sports"
  # "Individual Athletics"
  # "Fitness & Wellness"
  # "Combat Sports"
  # "Home Cooking"
  # "Fine Dining & Gastronomy"
  "Coffee & Tea Culture"
  "Mixology & Nightlife"
  "Baking & Pastry"
  "Personal Finance"
  "Tech & Innovation"
  "Science & Nature"
  "History & Humanities"
  "Self-Improvement"
  "Spirituality & Mindfulness"
  "Social Activism"
  "Volunteering & Charity"
  "Language & Linguistics"
  "Global Travel"
  "Local Exploration"
  "Home & Interior Styling"
  "Gardening & Plant Care"
  "Pet Ownership"
  "Fashion & Personal Style"
  "Automotive & Mechanics"
  "Parenting & Family Life"
  "Career & Entrepreneurship"
  "Sustainable Living"
  "Political Discourse"
)

for interest in "${interests[@]}"; do
  payload="$(python3 - "$interest" <<'PY'
import json
import sys

interest = sys.argv[1]
print(json.dumps({
    "transcription": f"I have a question about {interest}: what should a beginner focus on first?"
}))
PY
)"

  echo "Asking question for interest: $interest"
  curl -fsS -X POST "${FORUM_URL}/ask_question/${USERNAME}" \
    -H "Content-Type: application/json" \
    -d "${payload}"
  echo
done

echo "Done: posted ask_question requests for all interests."
