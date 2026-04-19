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

async function logout(req, res){
  try{
    // clear auth cookie
    res.clearCookie('sb_access_token');
    return res.json({ success:true, message: 'Logged out' });
  }catch(err){
    console.error('Logout error', err);
    return res.status(500).json({ success:false, message: 'Server error during logout' });
  }
}

async function me(req, res){
  try{
    // token from cookie or authorization header
    const token = (req.cookies && req.cookies.sb_access_token) || (req.get('Authorization') && req.get('Authorization').replace('Bearer ', ''));
    if(!token) return res.status(401).json({ success:false, message:'Not authenticated' });

    const { data, error } = await supabase.auth.getUser(token);
    if(error) return res.status(401).json({ success:false, message: error.message || 'Invalid session' });
    return res.json({ success:true, user: data.user });
  }catch(err){
    console.error('Me error', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
}

async function updateProfile(req, res){
  try{
    const token = (req.cookies && req.cookies.sb_access_token) || (req.get('Authorization') && req.get('Authorization').replace('Bearer ', ''));
    if(!token) return res.status(401).json({ success:false, message:'Not authenticated' });
    const { full_name } = req.body || {};
    if(typeof full_name !== 'string') return res.status(400).json({ success:false, message:'Invalid profile data' });

    // Use the token to update the user's metadata
    const { data, error } = await supabase.auth.updateUser({ access_token: token, data: { full_name } });
    if(error) return res.status(400).json({ success:false, message: error.message || 'Failed to update profile' });
    return res.json({ success:true, message:'Profile updated', user: data.user });
  }catch(err){
    console.error('Update profile error', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
}

module.exports = { signup, login, logout, me, updateProfile };
