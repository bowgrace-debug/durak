-- ZW-Unit Durak Tracker — run this in your Supabase SQL editor

-- Players (the people who play, independent of auth users)
CREATE TABLE IF NOT EXISTS public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_players" ON public.players FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sessions (an evening / sitting of playing)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sessions" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Which players are in a session
CREATE TABLE IF NOT EXISTS public.session_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  UNIQUE(session_id, player_id)
);

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_session_players" ON public.session_players FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Individual game rounds within a session
CREATE TABLE IF NOT EXISTS public.games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  durak_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_games" ON public.games FOR ALL TO authenticated USING (true) WITH CHECK (true);
