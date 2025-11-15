import { createClient } from "@supabase/supabase-js";
let apiKey = process.env.SUPABASE_API_KEY;
let projectUrl = process.env.SUPABASE_PROJECT_URL;
export const supabase = createClient(
    "https://xvdbeuqgtyonbbsdkcqu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGJldXFndHlvbmJic2RrY3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjUwNjYsImV4cCI6MjA3ODY0MTA2Nn0.ZF-zhsVH2OCyhljoC_G3Rlug5IwZS_OTcdkYwfL1d84"
)