(() => {
  const form = document.querySelector('#authForm');
  const status = document.querySelector('#status');
  const toggle = document.querySelector('#switch');
  const submit = document.querySelector('#submit');
  const logout = document.querySelector('#logout');
  let signup = false;
  const birthInput = form.elements.birthDate;
  const today = new Date();
  const adultDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const dateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  birthInput.max = dateValue(adultDate);
  birthInput.addEventListener('input', () => {
    birthInput.setCustomValidity('');
    if (birthInput.value && !/^\d{4}-\d{2}-\d{2}$/.test(birthInput.value)) {
      birthInput.setCustomValidity('Verifică anul nașterii: introdu un an din 4 cifre.');
    } else if (birthInput.value > birthInput.max) {
      birthInput.setCustomValidity('Verifică data nașterii. Pentru înregistrare trebuie să ai cel puțin 18 ani.');
    }
  });
  toggle.onclick = () => {
    signup = !signup;
    document.querySelector('#signupFields').hidden = !signup;
    form.elements.displayName.required = signup;
    form.elements.birthDate.required = signup;
    form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
    submit.textContent = signup ? 'Creează contul' : 'Conectează-te';
    toggle.textContent = signup ? 'Am deja cont' : 'Creează un cont';
    status.textContent = '';
  };
  const refresh = async () => {
    const user = await window.noirBackend.currentUser();
    form.hidden = Boolean(user);
    toggle.hidden = Boolean(user);
    logout.hidden = !user;
    if (user) status.textContent = `Ești conectat: ${user.email}. Potrivirile și conversațiile din interfața principală sunt încă demonstrative.`;
  };
  form.onsubmit = async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Se procesează…';
    try {
      const values = Object.fromEntries(new FormData(form));
      const result = await window.noirBackend[signup ? 'signUp' : 'signIn'](values);
      status.textContent = result.ok ? (signup ? 'Cont creat. Verifică e-mailul pentru confirmare.' : 'Autentificare reușită.') : result.error;
      if (result.ok) { form.elements.password.value = ''; await refresh(); }
    } catch { status.textContent = 'Conectarea nu a reușit. Verifică accesul la internet și încearcă din nou.'; }
    finally { submit.disabled = false; }
  };
  logout.onclick = async () => {
    const result = await window.noirBackend.signOut();
    status.textContent = result.ok ? 'Te-ai deconectat.' : result.error;
    await refresh();
  };
  if (!window.noirBackend.ready) status.textContent = 'Autentificarea va fi disponibilă după conectarea proiectului Supabase.';
  refresh();
})();

