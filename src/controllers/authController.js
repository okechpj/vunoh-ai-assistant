const { supabase } = require('../../db/supabaseClient');

function validateEmail(email){ return typeof email === 'string' && email.includes('@') && email.length>5 }
function validatePassword(pw){ return typeof pw === 'string' && pw.length >= 8 }

async function signup(req, res){
  try{
    const { email, password } = req.body || {};
    if(!validateEmail(email) || !validatePassword(password)){
      return res.status(400).json({ success:false, message:'Invalid email or password (min 8 chars).' });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if(error){
      return res.status(400).json({ success:false, message: error.message || 'Signup failed' });
    }

    // Supabase returns user/session; do not expose sensitive tokens
    return res.json({ success:true, message: 'Signup successful. Please check your email to confirm your account.' });
  }catch(err){
    console.error('Signup error', err);
    return res.status(500).json({ success:false, message: 'Server error during signup' });
  }
}

async function login(req, res){
  try{
    const { email, password } = req.body || {};
    if(!validateEmail(email) || !validatePassword(password)){
      return res.status(400).json({ success:false, message:'Invalid email or password.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){
      // Handle common Supabase messages
      let msg = error.message || 'Login failed';
      if(/invalid login|invalid credentials/i.test(msg)) msg = 'Invalid credentials';
      if(/email not confirmed|confirm/i.test(msg)) msg = 'Please confirm your email before logging in';
      return res.status(400).json({ success:false, message: msg });
    }

    // On success data will include session and user
    const session = data?.session || null;
    // Set httpOnly cookie with access token
    if(session && session.access_token){
      const maxAge = (session.expires_in || 60*60) * 1000;
      res.cookie('sb_access_token', session.access_token, { httpOnly:true, secure: process.env.NODE_ENV==='production', sameSite: 'lax', maxAge });
    }
    return res.json({ success:true, message:'Login successful', data: { user: data.user || null, session } });
  }catch(err){
    console.error('Login error', err);
    return res.status(500).json({ success:false, message: 'Server error during login' });
  }
}

module.exports = { signup, login };
