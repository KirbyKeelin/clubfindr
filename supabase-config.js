/*  ================================================
    ClubFinder — Browser-side Supabase Client
    ================================================  */

const SUPABASE_URL = 'https://ehiovmmqhujpwpguamyn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ynuZ7hvGKgXUJY4fyJU3JQ_L3iC21SK';

// The supabase global is loaded from the CDN script tag
window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
