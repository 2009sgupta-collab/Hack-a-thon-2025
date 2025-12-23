// Contact form — saves submissions in localStorage (demo only)
(function () {
  var STORAGE_KEY = 'climate_contacts_v1';
  var form = document.getElementById('contactForm');
  var feedback = document.getElementById('contactFeedback');
  var submissionsList = document.getElementById('submissionsList');
  var clearAllBtn = document.getElementById('clearAllSubmissions');

  var submissions = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      submissions = raw ? JSON.parse(raw) : [];
    } catch (e) {
      submissions = [];
      console.error('Failed to load submissions', e);
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  }

  function render() {
    submissionsList.innerHTML = '';
    if (!submissions.length) {
      var li = document.createElement('li');
      li.className = 'small muted';
      li.textContent = 'No saved submissions.';
      submissionsList.appendChild(li);
      return;
    }
    submissions.slice().reverse().forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'submission-item';
      li.innerHTML = '<strong>' + escapeHtml(s.name) + '</strong> — ' + escapeHtml(s.email) +
        (s.org ? ('<div class="small muted">' + escapeHtml(s.org) + '</div>') : '') +
        '<div class="small">' + escapeHtml(s.message) + '</div>' +
        '<div class="small muted">Saved: ' + new Date(s.submittedAt).toLocaleString() + '</div>';
      submissionsList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      org: form.org.value.trim(),
      message: form.message.value.trim(),
      consent: !!form.consent.checked,
      submittedAt: new Date().toISOString()
    };

    if (!data.name || !validateEmail(data.email) || !data.message) {
      feedback.textContent = 'Please enter your name, a valid email, and a message.';
      feedback.classList.add('muted');
      return;
    }

    submissions.push(data);
    save();
    render();
    form.reset();
    feedback.textContent = 'Thanks — your details have been saved locally. We will contact you if this were a real service.';
    setTimeout(function () { feedback.textContent = ''; }, 7000);
  });

  clearAllBtn.addEventListener('click', function () {
    if (!confirm('Clear all saved submissions from this browser?')) return;
    submissions = [];
    save();
    render();
    feedback.textContent = 'Saved submissions cleared.';
    setTimeout(function () { feedback.textContent = ''; }, 3000);
  });

  function validateEmail(email) {
    // Simple email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // init
  load();
  render();
})();