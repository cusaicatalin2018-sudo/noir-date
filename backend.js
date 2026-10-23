(() => {
  const config = window.NOIR_BACKEND_CONFIG || {};
  const configured = Boolean(config.url && config.publishableKey);
  let client = null;
  if (configured && window.supabase?.createClient) {
    client = window.supabase.createClient(config.url, config.publishableKey);
  }

  const unavailable = () => ({
    ok: false,
    error: configured
      ? 'Biblioteca backend indisponibilă. Reîncarcă pagina când ești conectat la internet.'
      : 'Backend-ul Noir nu este configurat încă. Completează URL-ul și cheia publică în backend-config.js.'
  });

  window.noirBackend = {
    get ready() { return Boolean(client); },
    async signUp({ email, password, displayName, birthDate }) {
      if (!client) return unavailable();
      if (!birthDate || new Date(birthDate) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))) {
        return { ok: false, error: 'Noir este disponibil doar persoanelor de 18 ani sau peste.' };
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, birth_date: birthDate } }
      });
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
    async signIn({ email, password }) {
      if (!client) return unavailable();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
    async signOut() {
      if (!client) return unavailable();
      const { error } = await client.auth.signOut();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async currentUser() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      return data.user || null;
    },
    async sendMessage(conversationId, body) {
      if (!client) return unavailable();
      const user = await this.currentUser();
      if (!user) return { ok: false, error: 'Conectează-te pentru a trimite mesaje.' };
      const { data, error } = await client.from('messages')
        .insert({ conversation_id: conversationId, sender_id: user.id, body })
        .select().single();
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
    watchMessages(conversationId, onMessage) {
      if (!client) return null;
      return client.channel(`conversation:${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, payload => onMessage(payload.new))
        .subscribe();
    },
    async stopWatching(channel) {
      if (client && channel) await client.removeChannel(channel);
    }
  };
})();

