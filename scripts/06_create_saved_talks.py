"""
Custom feature: create saved_talks table with per-user RLS.

Each authenticated user can only SELECT/INSERT/DELETE their own rows
(auth.uid() = user_id). Demonstrates ownership RLS beyond the course's
"any logged-in user can read embeddings" policy.

Usage:
    python scripts/06_create_saved_talks.py
"""

import json
import sys

import requests

with open('config.public.json') as f:
    public = json.load(f)
with open('config.secret.json') as f:
    secrets = json.load(f)

PROJECT_REF = secrets['SUPABASE_PROJECT_REF']
ACCESS_TOKEN = secrets['SUPABASE_ACCESS_TOKEN']

SQL = """
CREATE TABLE IF NOT EXISTS saved_talks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    talk_id UUID NOT NULL,
    title TEXT NOT NULL,
    speaker TEXT,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, talk_id)
);

CREATE INDEX IF NOT EXISTS saved_talks_user_id_idx ON saved_talks(user_id);

ALTER TABLE saved_talks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved talks" ON saved_talks;
CREATE POLICY "Users can read own saved talks"
ON saved_talks FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved talks" ON saved_talks;
CREATE POLICY "Users can insert own saved talks"
ON saved_talks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved talks" ON saved_talks;
CREATE POLICY "Users can delete own saved talks"
ON saved_talks FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
"""


def main():
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, headers=headers, json={"query": SQL})
    if resp.status_code not in (200, 201):
        print(f"❌ Failed: {resp.status_code}")
        print(resp.text[:500])
        sys.exit(1)

    print("✅ saved_talks table + per-user RLS policies ready")
    print(f"   Project: {public['SUPABASE_URL']}")
    print("   Policies: SELECT/INSERT/DELETE where auth.uid() = user_id")


if __name__ == '__main__':
    main()
