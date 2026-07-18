import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://raxmesafecqxirgmrbux.supabase.co';
const supabaseKey = 'sb_publishable_ZIeT0TkhlIJ__7VbFCZlJg_5DaBCL5W';

export const supabase = createClient(supabaseUrl, supabaseKey);
