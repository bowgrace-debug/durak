# Durak Tracker

Durak-Leaderboard und Spielverlauf-App. Frontend (HTML/CSS/JS) mit Supabase Auth + PostgreSQL.

## Features

- **Rangliste** — Wer hat die meisten 1. Plätze? Wer ist am häufigsten der Durak?
- **Spielverlauf** — Alle Runden mit 1. Platz, 2. Platz und Durak
- **Spieler verwalten** — Spieler hinzufügen und entfernen
- **Google Login** — Authentifizierung über Supabase Google OAuth
- **Live-Updates** — Supabase Realtime aktualisiert die Daten in Echtzeit

## Setup

### 1. Supabase-Projekt erstellen

1. Gehe zu [Supabase Dashboard](https://supabase.com/dashboard)
2. Erstelle ein neues Projekt
3. Aktiviere **Authentication** → Providers → **Google** (Client ID + Secret eintragen)
4. Gehe zu **SQL Editor** und fuehre das SQL unten aus

### 2. Datenbank-Schema (SQL)

```sql
-- Spieler
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Spiele (1. Platz, 2. Platz, Durak)
create table games (
  id uuid primary key default gen_random_uuid(),
  first_id uuid not null references players(id),
  second_id uuid not null references players(id),
  durak_id uuid not null references players(id),
  played_on date default current_date,
  created_at timestamptz default now()
);

-- Indizes
create index idx_games_created_at on games(created_at desc);
create index idx_games_first on games(first_id);
create index idx_games_second on games(second_id);
create index idx_games_durak on games(durak_id);
```

### 3. Row Level Security (RLS)

```sql
alter table players enable row level security;
alter table games enable row level security;

-- Lesen fuer alle (auch nicht angemeldete, damit das Board ohne Login sichtbar ist)
create policy "Players readable by all" on players for select using (true);
create policy "Games readable by all" on games for select using (true);

-- Schreiben nur fuer authentifizierte User
create policy "Auth users can insert players" on players for insert with check (auth.role() = 'authenticated');
create policy "Auth users can delete players" on players for delete using (auth.role() = 'authenticated');
create policy "Auth users can insert games" on games for insert with check (auth.role() = 'authenticated');
create policy "Auth users can delete games" on games for delete using (auth.role() = 'authenticated');
```

### 4. Realtime aktivieren

Im Supabase Dashboard unter **Database** → **Replication** die Tabellen `players` und `games` fuer Realtime aktivieren.

### 5. Supabase-Config eintragen

Erstelle eine `.env`-Datei im Projektroot:

```env
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...dein-anon-key
```

Die Werte findest du im Supabase Dashboard unter **Settings** → **API**.

### 6. Starten

```bash
npm install
npm run dev
```

Dann im Browser `http://localhost:5173` oeffnen.

## Datenmodell

### `players`
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | uuid | Primary Key |
| `name` | text | Spielername (unique) |
| `created_at` | timestamptz | Erstellzeitpunkt |

### `games`
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | uuid | Primary Key |
| `first_id` | uuid | FK → players.id (1. Platz) |
| `second_id` | uuid | FK → players.id (2. Platz) |
| `durak_id` | uuid | FK → players.id (Durak) |
| `played_on` | date | Spieltag |
| `created_at` | timestamptz | Erstellzeitpunkt |
