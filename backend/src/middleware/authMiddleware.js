const { supabase } = require('../../db/supabaseClient');

// Allowed public paths that don't require authentication
const PUBLIC_PATHS = new Set([
  '/login.html', '/register.html', '/404.html', '/styles.css', '/register.js', '/login.js', '/favicon.ico'
]);

async function requireAuth(req, res, next){
  try{
    // Allow preflight
    if (req.method === 'OPTIONS') return next();

    // allow auth API and public assets
    if (req.path.startsWith('/auth') || PUBLIC_PATHS.has(req.path) || req.path.startsWith('/public')) return next();

    // Try cookie first
    const token = (req.cookies && req.cookies.sb_access_token) || (req.get('Authorization') && req.get('Authorization').replace('Bearer ', ''));
    if(!token){
      // API route -> 401 JSON
      if (req.path.startsWith('/api')) return res.status(401).json({ success:false, message:'Authentication required' });
      // Page -> redirect to login
      return res.redirect('/login.html');
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    if(error || !data || !data.user){
      // clear cookie
      res.clearCookie('sb_access_token');
      if (req.path.startsWith('/api')) return res.status(401).json({ success:false, message:'Invalid or expired session' });
      return res.redirect('/login.html');
    }

    // attach user
    req.user = data.user;
    return next();
  }catch(err){
    console.error('Auth middleware error', err);
    if (req.path.startsWith('/api')) return res.status(500).json({ success:false, message:'Authentication error' });
    return res.redirect('/login.html');
  }
}

module.exports = requireAuth;
