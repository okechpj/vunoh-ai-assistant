const feedback = document.getElementById('feedback');
const form = document.getElementById('profileForm');
const emailEl = document.getElementById('email');
const nameEl = document.getElementById('full_name');
const saveBtn = document.getElementById('saveBtn');

function showFeedback(msg, type='success'){ feedback.innerHTML = `<div class="alert ${type==='success'?'success':'error'}">${msg}</div>` }

async function loadProfile(){
  try{
    const res = await fetch('/auth/me', { credentials:'same-origin' });
    const data = await res.json();
    if(res.ok && data.success){
      emailEl.value = data.user.email || '';
      nameEl.value = (data.user.user_metadata && data.user.user_metadata.full_name) || '';
    } else {
      showFeedback(data.message || 'Failed to load profile', 'error');
    }
  }catch(err){ showFeedback('Network error', 'error') }
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; feedback.innerHTML='';
  try{
    const res = await fetch('/auth/update', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ full_name: nameEl.value }) });
    const data = await res.json();
    if(res.ok && data.success){ showFeedback('Profile updated','success') }
    else showFeedback(data.message || 'Failed to update profile','error');
  }catch(err){ showFeedback('Network error','error') }
  finally{ saveBtn.disabled=false; saveBtn.textContent='Save profile' }
});

loadProfile();
