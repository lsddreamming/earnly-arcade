-- TEST DATABASE ONLY. Never apply this fixture to production.
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users, username text UNIQUE NOT NULL);
CREATE TABLE public.coin_wallets(user_id uuid PRIMARY KEY REFERENCES auth.users,
 balance bigint NOT NULL CHECK(balance >= 0), lifetime_earned bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.leaderboard_scores(user_id uuid REFERENCES auth.users,game text,
 score bigint,achieved_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,game));
CREATE TABLE public.leaderboard_bans(user_id uuid PRIMARY KEY REFERENCES auth.users);
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO profiles VALUES ('00000000-0000-4000-8000-000000000001','PlayerOne'),('00000000-0000-4000-8000-000000000002','AstraKing');
INSERT INTO coin_wallets(user_id,balance) VALUES ('00000000-0000-4000-8000-000000000001',1250),('00000000-0000-4000-8000-000000000002',2000);
INSERT INTO leaderboard_scores(user_id,game,score) VALUES ('00000000-0000-4000-8000-000000000001','snake',120),('00000000-0000-4000-8000-000000000002','snake',245);
