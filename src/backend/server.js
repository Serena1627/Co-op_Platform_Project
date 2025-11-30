import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = 'https://xvdbeuqgtyonbbsdkcqu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGJldXFndHlvbmJic2RrY3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjUwNjYsImV4cCI6MjA3ODY0MTA2Nn0.ZF-zhsVH2OCyhljoC_G3Rlug5IwZS_OTcdkYwfL1d84';
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/sign-in', async(req, res) => {
    let { firstName, lastName, emailAddress, password, accountType} = req.body;

    if (!firstName || !lastName || !emailAddress || !password || !accountType) {
        return res.status(400).json({error: 'All fields are requireed.'});
    }

    try {
        let {data, error} = await supabase
        .from('user_sign_in')
        .insert([{
            first_name: firstName,
            last_name: lastName,
            email_address: emailAddress,
            pass_hash: password,
            account_type: accountType
        }]);

        if (error) throw error;
        res.json({ message: 'Account created successfully!'});
    } catch (err) {
        res.status(500).json({error: err.message})
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));