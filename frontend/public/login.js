const form = document.getElementById('loginForm');
const feedback = document.getElementById('feedback');
const submitBtn = document.getElementById('submitBtn');

function showFeedback(message, type='success'){
  feedback.innerHTML = `<div class="alert ${type==='success'?'success':'error'}">${message}</div>`;
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  feedback.innerHTML = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if(!email || password.length < 8){ showFeedback('Please provide a valid email and password (min 8 chars).','error'); return; }
  submitBtn.disabled = true; submitBtn.textContent = 'Signing in…';
  try{
    const res = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }), credentials: 'same-origin' });
    const data = await res.json();
    if(res.ok && data.success){
      showFeedback(data.message || 'Login successful', 'success');
      // Optionally store session or redirect
      setTimeout(()=>{ window.location.href = '/'; }, 900);
    } else {
      showFeedback(data.message || 'Login failed', 'error');
    }
  }catch(err){
    showFeedback('Network error. Please try again.','error');
  }finally{ submitBtn.disabled=false; submitBtn.textContent='Sign in' }
});
