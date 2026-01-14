// AI Assistant: local issue tracker + optional OpenAI summarization
// Usage: include the ai-snippet HTML into your page (before </body>), include ai.css rules in your styles,
// and add <script src="ai.js"></script> before the page's closing </body>.

(function () {
    var STORAGE_KEY = 'climate_issues_v1';
    var OPENAI_KEY_SESSION = 'openai_key_session';
  
    // DOM roots (these elements come from the ai-snippet)
    var openBtn = null;
    var modal = null;
    var form = null;
    var listRoot = null;
    var settingsBtn = null;
    var apiKeyInput = null;
    var saveKeyBtn = null;
    var useOpenAICheck = null;
    var closeBtn = null;
  
    var issues = [];
  
    // Minimal helper
    function q(sel, root) { return (root || document).querySelector(sel); }
    function qa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  
    // Load/save
    function load() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        issues = raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error('Failed to load issues', e);
        issues = [];
      }
    }
    function save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
    }
  
    // Simple client-side summarizer (fallback)
    function localSummarize(issue) {
      // Create a short description using heuristics: first sentence, keywords (words >6 chars), severity
      var details = (issue.details || '').trim();
      var firstLine = details.split(/[\.\n]/)[0] || issue.title || 'User reported an issue';
      // pick a few long words as 'keywords'
      var kws = (details.match(/\b[a-zA-Z]{6,}\b/g) || []).slice(0, 5);
      var kwStr = kws.length ? ('Keywords: ' + kws.join(', ')) : '';
      return [capitalize(firstLine), 'Severity: ' + (issue.severity || 'medium'), kwStr].filter(Boolean).join(' — ');
    }
  
    function capitalize(str) {
      if (!str) return str;
      return str[0].toUpperCase() + str.slice(1);
    }
  
    // OpenAI summarization (optional). Expects API key from sessionStorage.
    async function openaiSummarize(issue) {
      var key = sessionStorage.getItem(OPENAI_KEY_SESSION);
      if (!key) throw new Error('No OpenAI API key set. Open Settings to paste a key.');
      // Build a prompt
      var system = "You are a helpful assistant that converts a user's problem report into a concise problem description, steps to reproduce, likely causes, and suggested next steps. Be clear and bullet-oriented.";
      var userPrompt = "User report:\nTitle: " + (issue.title || '') + "\nDetails: " + (issue.details || '') +
        "\nSeverity: " + (issue.severity || '') +
        "\nContact: " + (issue.contact || '') +
        "\n\nProduce a short structured description with: Summary (1 line), Steps to reproduce (3 bullets if available), Likely causes (2 bullets), Suggested next steps (2 bullets). Keep it under ~200 words.";
      // Use Chat Completions (gpt-3.5-turbo) as default
      var payload = {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 360,
        temperature: 0.2
      };
  
      var res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key
        },
        body: JSON.stringify(payload)
      });
  
      if (!res.ok) {
        var text = await res.text();
        throw new Error('OpenAI error: ' + res.status + ' ' + text);
      }
      var json = await res.json();
      var content = (json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
      return content.trim();
    }
  
    // UI: render list
    function renderList() {
      if (!listRoot) return;
      listRoot.innerHTML = '';
      if (!issues.length) {
        var p = document.createElement('p');
        p.className = 'small muted';
        p.textContent = 'No reported issues yet.';
        listRoot.appendChild(p);
        return;
      }
  
      // Show most recent first
      issues.slice().reverse().forEach(function (issue) {
        var li = document.createElement('li');
        li.className = 'issue-item';
        li.dataset.id = issue.id;
  
        var head = document.createElement('div');
        head.className = 'issue-head';
        var title = document.createElement('strong');
        title.textContent = issue.title || '(no title)';
        head.appendChild(title);
  
        var meta = document.createElement('div');
        meta.className = 'issue-meta';
        var sev = document.createElement('span');
        sev.className = 'issue-sev';
        sev.textContent = issue.severity || 'medium';
        var dt = document.createElement('span');
        dt.className = 'issue-date';
        dt.textContent = new Date(issue.createdAt).toLocaleString();
        meta.appendChild(sev);
        meta.appendChild(dt);
        head.appendChild(meta);
  
        var details = document.createElement('div');
        details.className = 'issue-details';
        details.textContent = issue.details || '';
  
        var aiBox = document.createElement('div');
        aiBox.className = 'issue-ai';
        if (issue.aiDescription) {
          var pre = document.createElement('pre');
          pre.className = 'ai-desc';
          pre.textContent = issue.aiDescription;
          aiBox.appendChild(pre);
        } else {
          var p = document.createElement('p');
          p.className = 'small muted';
          p.textContent = 'No AI description yet.';
          aiBox.appendChild(p);
        }
  
        var actions = document.createElement('div');
        actions.className = 'issue-actions';
        var describeBtn = document.createElement('button');
        describeBtn.className = 'btn';
        describeBtn.textContent = 'Describe (AI)';
        describeBtn.addEventListener('click', function () { handleDescribe(issue.id, describeBtn); });
  
        var markBtn = document.createElement('button');
        markBtn.className = 'btn ghost';
        markBtn.textContent = issue.status === 'resolved' ? 'Reopen' : 'Mark resolved';
        markBtn.addEventListener('click', function () { toggleResolved(issue.id); });
  
        var delBtn = document.createElement('button');
        delBtn.className = 'btn ghost';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function () { deleteIssue(issue.id); });
  
        actions.appendChild(describeBtn);
        actions.appendChild(markBtn);
        actions.appendChild(delBtn);
  
        li.appendChild(head);
        li.appendChild(details);
        li.appendChild(aiBox);
        li.appendChild(actions);
  
        if (issue.status === 'resolved') {
          li.classList.add('resolved');
        }
  
        listRoot.appendChild(li);
      });
    }
  
    function handleDescribe(issueId, triggerBtn) {
      var issue = issues.find(function (i) { return i.id === issueId; });
      if (!issue) return;
      // show "thinking" state
      var origText = triggerBtn.textContent;
      triggerBtn.textContent = 'Generating...';
      triggerBtn.disabled = true;
  
      // choose mode: useOpenAICheck checked and API key in sessionStorage => call OpenAI
      var useOpenAI = !!(useOpenAICheck && useOpenAICheck.checked && sessionStorage.getItem(OPENAI_KEY_SESSION));
  
      var p;
      if (useOpenAI) {
        p = openaiSummarize(issue).catch(function (err) {
          console.error(err);
          return 'AI failed: ' + (err.message || 'unknown error') + '\n\nFallback summary:\n' + localSummarize(issue);
        });
      } else {
        p = Promise.resolve(localSummarize(issue));
      }
  
      p.then(function (desc) {
        issue.aiDescription = desc;
        save();
        renderList();
      }).finally(function () {
        triggerBtn.textContent = origText;
        triggerBtn.disabled = false;
      });
    }
  
    function toggleResolved(id) {
      var idx = issues.findIndex(function (i) { return i.id === id; });
      if (idx === -1) return;
      issues[idx].status = issues[idx].status === 'resolved' ? 'open' : 'resolved';
      save();
      renderList();
    }
  
    function deleteIssue(id) {
      if (!confirm('Delete this issue?')) return;
      issues = issues.filter(function (i) { return i.id !== id; });
      save();
      renderList();
    }
  
    // Submit new issue
    function submitIssue(e) {
      e.preventDefault();
      var fd = new FormData(form);
      var title = (fd.get('issue_title') || '').trim();
      var details = (fd.get('issue_details') || '').trim();
      var severity = (fd.get('issue_severity') || 'medium');
      var contact = (fd.get('issue_contact') || '').trim();
  
      if (!title && !details) {
        alert('Please provide a short title or some details.');
        return;
      }
  
      var newIssue = {
        id: uid(),
        title: title || details.split(/[\.\n]/)[0],
        details: details,
        severity: severity,
        contact: contact,
        createdAt: new Date().toISOString(),
        status: 'open',
        aiDescription: '' // filled later
      };
  
      issues.push(newIssue);
      save();
      renderList();
      form.reset();
      // optionally auto-generate a local summary immediately
      var last = issues[issues.length - 1];
      last.aiDescription = localSummarize(last);
      save();
      renderList();
    }
  
    // tiny uid
    function uid() {
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    }
  
    // Settings: save API key to sessionStorage (not persistent beyond tab)
    function saveApiKey() {
      var val = (apiKeyInput && apiKeyInput.value || '').trim();
      if (val) {
        sessionStorage.setItem(OPENAI_KEY_SESSION, val);
        alert('API key saved to this session. You can now use "Describe (AI)". If requests fail due to CORS you may need to run a server-side proxy.');
        apiKeyInput.value = '';
      } else {
        sessionStorage.removeItem(OPENAI_KEY_SESSION);
        alert('API key cleared from this session.');
      }
    }
  
    // Initialize: find elements created by the snippet and attach listeners
    function init() {
      // Create elements if snippet isn't present
      openBtn = q('#aiOpenBtn');
      modal = q('#aiModal');
      form = q('#aiForm');
      listRoot = q('#aiList');
      settingsBtn = q('#aiSettingsBtn');
      apiKeyInput = q('#aiApiKey');
      saveKeyBtn = q('#aiSaveKey');
      useOpenAICheck = q('#aiUseOpenAI');
      closeBtn = q('#aiCloseBtn');
  
      if (!openBtn || !modal || !form || !listRoot) {
        console.warn('AI snippet not found in DOM. Please paste ai-snippet HTML into the page.');
        return;
      }
  
      // Open modal
      openBtn.addEventListener('click', function () {
        modal.classList.add('open');
        modal.querySelector('input, textarea').focus();
      });
  
      // Close modal
      closeBtn.addEventListener('click', function () { modal.classList.remove('open'); });
  
      // Form submit
      form.addEventListener('submit', submitIssue);
  
      // Settings actions
      if (saveKeyBtn) saveKeyBtn.addEventListener('click', saveApiKey);
  
      // Toggle settings panel
      if (settingsBtn) {
        settingsBtn.addEventListener('click', function () {
          var s = q('#aiSettingsPanel');
          if (s) s.classList.toggle('open');
        });
      }
  
      // Click outside modal to close
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('open');
      });
  
      // Load and render
      load();
      renderList();
    }
  
    // Attach init to DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
  })();