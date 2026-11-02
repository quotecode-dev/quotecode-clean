-- ============================================================================================================================
-- 20261101070000_social_care.sql  -  Shira's daily care: the results of every post, the follower counts, the stills folder
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-02 (typed: "מאשר את התוכנית לשירה: מדידה יומית של כל פרסום, מסך מה תופס, טיוטות תשובה לכל התגובות באישור שלי, ושורת תחזוקה יומית, שחרור עד הלייב -
--   שהיא תוכל לפרסם חוץ מהמאמרים שלה גם את הפרסומים שאתה עשית הסטילס, נשים לה בתיקיה, והיא תאסוף משם ותתן לי לאשר").
--   * social_content_stats: the latest results of every post and video of our own accounts. NULL = the network did not return it, never 0.
--     Our own captions only; no comment and no person is stored here.
--   * social_followers: one count per account and day, for the daily line.
--   * social_stills + the public bucket social-stills: the folder of ready ads (JPEG only). The ads are public by nature: Meta reads them from their address.
--   Closed to the app: RLS forced, no policy, no grant to PUBLIC / anon / authenticated; the service role only.
--   ROLLBACK: stop the collection (no code calls it); keep the history; a published post stays as it is.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.social_content_stats (
  network    text        NOT NULL CHECK (network IN ('facebook', 'instagram', 'youtube')),
  post_id    text        NOT NULL CHECK (char_length(post_id) BETWEEN 1 AND 120),
  channel    text        NOT NULL CHECK (char_length(channel) BETWEEN 1 AND 20),
  market     text        NOT NULL CHECK (market IN ('il', 'intl')),
  kind       text        NOT NULL CHECK (kind IN ('video', 'image', 'text')),
  title      text        NOT NULL DEFAULT '' CHECK (char_length(title) <= 120),
  url        text        NULL CHECK (url IS NULL OR url ~ '^https://'),
  posted_at  timestamptz NULL,
  views      integer     NULL CHECK (views IS NULL OR views >= 0),
  likes      integer     NULL CHECK (likes IS NULL OR likes >= 0),
  comments   integer     NULL CHECK (comments IS NULL OR comments >= 0),
  shares     integer     NULL CHECK (shares IS NULL OR shares >= 0),
  reach      integer     NULL CHECK (reach IS NULL OR reach >= 0),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (network, post_id)
);

CREATE TABLE IF NOT EXISTS public.social_followers (
  channel   text    NOT NULL CHECK (char_length(channel) BETWEEN 1 AND 20),
  day       date    NOT NULL,
  followers integer NOT NULL CHECK (followers >= 0),
  PRIMARY KEY (channel, day)
);

CREATE TABLE IF NOT EXISTS public.social_stills (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  market     text        NOT NULL CHECK (market IN ('il', 'intl')),
  path       text        NOT NULL UNIQUE CHECK (path ~ '^(il|intl)/[0-9a-f-]{36}\.jpg$'),
  file_name  text        NOT NULL DEFAULT '' CHECK (char_length(file_name) <= 120),
  status     text        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'queued')),
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at  timestamptz NULL
);

ALTER TABLE public.social_content_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_stats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_followers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_stills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_stills FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_content_stats, public.social_followers, public.social_stills FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_content_stats, public.social_followers, public.social_stills TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('social-stills', 'social-stills', true, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;
