const form = document.getElementById('registerForm');
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
  submitBtn.disabled = true; submitBtn.textContent = 'Signing up…';
  try{
    const res = await fetch('/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }), credentials: 'same-origin' });
    const data = await res.json();
    if(res.ok && data.success){
      showFeedback(data.message || 'Signup successful. Please confirm your email.', 'success');
      form.reset();
    } else {
      showFeedback(data.message || 'Signup failed', 'error');
    }
  }catch(err){
    showFeedback('Network error. Please try again.','error');
  }finally{ submitBtn.disabled=false; submitBtn.textContent='Sign up' }
});
