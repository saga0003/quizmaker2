/* ScholarOS Version 3 cloud bootstrap: configuration, auth and sync transport. */
(() => {
  const DB_KEY = 'scholaros-v2-db';
  const SESSION_KEY = 'scholaros-v2-session';
  const VERSION_KEY = 'scholaros-cloud-version';
  const originalSetItem = Storage.prototype.setItem;
  let suppressChangeEvent = false;

  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (!suppressChangeEvent && this === localStorage && key === DB_KEY) {
      window.dispatchEvent(new CustomEvent('scholaros-db-changed'));
    }
  };

  const cloud = {
    config: { loaded: false, configured: false, release: '3.0' },
    client: null,
    user: null,
    status: 'checking',
    lastSyncAt: localStorage.getItem('scholaros-last-sync') || null,
    error: null,

    async init() {
      try {
        const response = await fetch('/api/config', { cache: 'no-store' });
        this.config = await response.json();
        this.config.loaded = true;
        if (this.config.configured && window.supabase?.createClient) {
          this.client = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          });
          const { data } = await this.client.auth.getSession();
          this.user = data.session?.user || null;
          this.status = this.user ? 'connected' : 'available';
          this.client.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user || null;
            this.status = this.user ? 'connected' : 'available';
            window.dispatchEvent(new CustomEvent('scholar-cloud-auth-changed'));
          });
        } else {
          this.status = 'local';
        }
      } catch (error) {
        this.error = error.message;
        this.status = 'offline';
        this.config.loaded = true;
      }
      window.dispatchEvent(new CustomEvent('scholar-cloud-ready'));
      return this;
    },

    async signIn(email, password) {
      if (!this.client) throw new Error('Cloud backend is not configured.');
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this.user = data.user;
      this.status = 'connected';
      return this.pullOrBootstrap();
    },

    async sendMagicLink(email) {
      if (!this.client) throw new Error('Cloud backend is not configured.');
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      return true;
    },

    async signOut() {
      if (this.client) await this.client.auth.signOut();
      this.user = null;
      this.status = this.config.configured ? 'available' : 'local';
      localStorage.removeItem(VERSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new CustomEvent('scholar-cloud-auth-changed'));
    },

    async token() {
      if (!this.client) return null;
      const { data } = await this.client.auth.getSession();
      return data.session?.access_token || null;
    },

    async request(path, options = {}) {
      const token = await this.token();
      if (!token) throw new Error('Sign in to a cloud account first.');
      const response = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || `Cloud request failed (${response.status}).`);
        error.status = response.status;
        error.body = body;
        throw error;
      }
      return body;
    },

    mergeRemoteData(remoteData) {
      const local = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
      return { ...remoteData, users: local.users || [] };
    },

    applyRemote(payload) {
      suppressChangeEvent = true;
      try {
        originalSetItem.call(localStorage, DB_KEY, JSON.stringify(this.mergeRemoteData(payload.data)));
        if (payload.session) originalSetItem.call(localStorage, SESSION_KEY, JSON.stringify(payload.session));
        if (payload.version !== undefined) originalSetItem.call(localStorage, VERSION_KEY, String(payload.version));
        this.lastSyncAt = new Date().toISOString();
        originalSetItem.call(localStorage, 'scholaros-last-sync', this.lastSyncAt);
      } finally {
        suppressChangeEvent = false;
      }
    },

    async pull() {
      this.status = 'syncing';
      window.dispatchEvent(new CustomEvent('scholar-cloud-status'));
      try {
        const payload = await this.request('/api/sync');
        this.applyRemote(payload);
        this.status = 'connected';
        this.error = null;
        return payload;
      } catch (error) {
        this.status = 'error';
        this.error = error.message;
        throw error;
      } finally {
        window.dispatchEvent(new CustomEvent('scholar-cloud-status'));
      }
    },

    async push({ bootstrap = false } = {}) {
      this.status = 'syncing';
      window.dispatchEvent(new CustomEvent('scholar-cloud-status'));
      try {
        const data = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
        const baseVersion = Number(localStorage.getItem(VERSION_KEY) || 0);
        const payload = await this.request('/api/sync', {
          method: 'POST',
          body: JSON.stringify({ data, baseVersion, bootstrap })
        });
        this.applyRemote(payload);
        this.status = 'connected';
        this.error = null;
        return payload;
      } catch (error) {
        if (error.status === 409 && error.body?.data) this.applyRemote(error.body);
        this.status = 'error';
        this.error = error.message;
        throw error;
      } finally {
        window.dispatchEvent(new CustomEvent('scholar-cloud-status'));
      }
    },

    async pullOrBootstrap() {
      try {
        return await this.pull();
      } catch (error) {
        if (error.status === 404 && error.body?.canBootstrap) return this.push({ bootstrap: true });
        throw error;
      }
    },

    async submitAttempt(payload) {
      this.status = 'syncing';
      window.dispatchEvent(new CustomEvent('scholar-cloud-status'));
      try {
        const result = await this.request('/api/attempts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        this.applyRemote(result);
        this.status = 'connected';
        return result;
      } finally {
        window.dispatchEvent(new CustomEvent('scholar-cloud-status'));
      }
    }
  };

  window.scholarCloud = cloud;
  cloud.init();
})();
