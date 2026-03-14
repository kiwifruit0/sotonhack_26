#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
DB_URL="${DB_URL:-$BASE_URL/db}"

json_get() {
  local payload="$1"
  local field="$2"
  JSON_PAYLOAD="$payload" python3 - "$field" <<'PY'
import json
import os
import sys

field = sys.argv[1]
data = json.loads(os.environ["JSON_PAYLOAD"])
value = data.get(field)
if value is None:
    raise SystemExit(f"Missing field: {field}")
print(value)
PY
}

print_json() {
  python3 -m json.tool
}

require_server() {
  if ! curl -fsS "$BASE_URL/test/hello" >/dev/null; then
    echo "Backend is not reachable at $BASE_URL"
    echo "Start it first: uv run --project backend uvicorn backend.main:app --reload"
    exit 1
  fi
}

require_server

NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_ID="$(date +%s)"
AUDIO_FILE="$(mktemp /tmp/db-router-audio-XXXX.webm)"
DOWNLOADED_FILE="$(mktemp /tmp/db-router-download-XXXX.webm)"
trap 'rm -f "$AUDIO_FILE" "$DOWNLOADED_FILE"' EXIT
printf 'test-audio-%s' "$RUN_ID" >"$AUDIO_FILE"

echo "== Create user =="
USER_RESPONSE="$(curl -fsS -X POST "$DB_URL/users" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"script-user-$RUN_ID\",
    \"email\": \"script-user-$RUN_ID@example.co.uk\",
    \"avatarUrl\": \"https://example.com/avatar.png\",
    \"interestIds\": [],
    \"voiceId\": \"voice_script_$RUN_ID\",
    \"createdAt\": \"$NOW_UTC\"
  }")"
printf '%s' "$USER_RESPONSE" | print_json
USER_ID="$(json_get "$USER_RESPONSE" id)"

echo "== List users =="
curl -fsS "$DB_URL/users" | print_json

echo "== Get user by id =="
curl -fsS "$DB_URL/users/$USER_ID" | print_json

echo "== Create daily note (JSON) =="
DAILY_NOTE_RESPONSE="$(curl -fsS -X POST "$DB_URL/daily-notes" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"date\": \"$(date -u +%F)\",
    \"audioUrl\": \"https://example.com/audio/$RUN_ID.webm\",
    \"durationSec\": 30,
    \"createdAt\": \"$NOW_UTC\"
  }")"
printf '%s' "$DAILY_NOTE_RESPONSE" | print_json
DAILY_NOTE_ID="$(json_get "$DAILY_NOTE_RESPONSE" id)"

echo "== List daily notes for user =="
curl -fsS -G "$DB_URL/daily-notes" --data-urlencode "user_id=$USER_ID" | print_json

echo "== Get daily note by id =="
curl -fsS "$DB_URL/daily-notes/$DAILY_NOTE_ID" | print_json

echo "== Upload daily note audio =="
DAILY_UPLOAD_RESPONSE="$(curl -fsS -X POST "$DB_URL/daily-notes/upload" \
  -F "user_id=$USER_ID" \
  -F "date=$(date -u +%F)" \
  -F "duration_sec=30" \
  -F "audio_file=@$AUDIO_FILE;type=audio/webm")"
printf '%s' "$DAILY_UPLOAD_RESPONSE" | print_json
DAILY_AUDIO_PATH="$(json_get "$DAILY_UPLOAD_RESPONSE" audioPath)"

echo "== Create forum post =="
FORUM_POST_RESPONSE="$(curl -fsS -X POST "$DB_URL/forum-posts" \
  -H "Content-Type: application/json" \
  -d "{
    \"authorId\": \"$USER_ID\",
    \"interestIds\": [],
    \"questionText\": \"How does this API smoke test look?\",
    \"createdAt\": \"$NOW_UTC\"
  }")"
printf '%s' "$FORUM_POST_RESPONSE" | print_json
POST_ID="$(json_get "$FORUM_POST_RESPONSE" id)"

echo "== List forum posts for user =="
curl -fsS -G "$DB_URL/forum-posts" --data-urlencode "author_id=$USER_ID" | print_json

echo "== Get forum post by id =="
curl -fsS "$DB_URL/forum-posts/$POST_ID" | print_json

echo "== Create forum answer (JSON) =="
FORUM_ANSWER_RESPONSE="$(curl -fsS -X POST "$DB_URL/forum-answers" \
  -H "Content-Type: application/json" \
  -d "{
    \"postId\": \"$POST_ID\",
    \"authorId\": \"$USER_ID\",
    \"audioUrl\": \"https://example.com/audio/answer-$RUN_ID.webm\",
    \"transcriptText\": \"This is a scripted test answer\",
    \"transcriptMeta\": {\"provider\": \"script\"},
    \"createdAt\": \"$NOW_UTC\"
  }")"
printf '%s' "$FORUM_ANSWER_RESPONSE" | print_json
ANSWER_ID="$(json_get "$FORUM_ANSWER_RESPONSE" id)"

echo "== List forum answers for post =="
curl -fsS -G "$DB_URL/forum-answers" --data-urlencode "post_id=$POST_ID" | print_json

echo "== Get forum answer by id =="
curl -fsS "$DB_URL/forum-answers/$ANSWER_ID" | print_json

echo "== Upload forum answer audio =="
FORUM_UPLOAD_RESPONSE="$(curl -fsS -X POST "$DB_URL/forum-answers/upload" \
  -F "post_id=$POST_ID" \
  -F "author_id=$USER_ID" \
  -F "transcript_text=Uploaded answer from bash script" \
  -F 'transcript_meta={"provider":"script-upload"}' \
  -F "audio_file=@$AUDIO_FILE;type=audio/webm")"
printf '%s' "$FORUM_UPLOAD_RESPONSE" | print_json

echo "== Request signed URL for uploaded daily note path =="
SIGNED_URL_RESPONSE="$(curl -fsS -G "$DB_URL/storage/signed-url" \
  --data-urlencode "path=$DAILY_AUDIO_PATH" \
  --data-urlencode "expires_in=300")"
printf '%s' "$SIGNED_URL_RESPONSE" | print_json
SIGNED_URL="$(json_get "$SIGNED_URL_RESPONSE" signedUrl)"

echo "== Download from signed URL =="
curl -fsS "$SIGNED_URL" -o "$DOWNLOADED_FILE"
if [[ ! -s "$DOWNLOADED_FILE" ]]; then
  echo "Downloaded file is empty"
  exit 1
fi
echo "Downloaded $(wc -c <"$DOWNLOADED_FILE") bytes from signed URL."

echo "All db_router endpoint smoke tests completed successfully."
