import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://okpidydmqvqwugaeajmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGlkeWRtcXZxd3VnYWVham1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODQ5MTMsImV4cCI6MjA5NDQ2MDkxM30.XgfD05eEP34eyDsAA6el7sf2jp6GgjjQaZXYCugpLdc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
