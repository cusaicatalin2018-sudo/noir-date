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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '') || !Number.isFinite(Date.parse(birthDate))) {
        return { ok: false, error: 'Data nașterii nu este validă. Verifică ziua, luna și anul (4 cifre).' };
      }
      if (new Date(birthDate) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))) {
        return { ok: false, error: 'Noir este disponibil doar persoanelor de 18 ani sau peste.' };
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: new URL('cont.html', window.location.href).href.split('?')[0].split('#')[0],
          data: { display_name: displayName, birth_date: birthDate }
        }
      });
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
    async signIn({ email, password }) {
      if (!client) return unavailable();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
    async resendConfirmation(email) {
      if (!client) return unavailable();
      const { error } = await client.auth.resend({
        type: 'signup', email,
        options: { emailRedirectTo: new URL('cont.html', window.location.href).href.split('?')[0].split('#')[0] }
      });
      return error ? { ok: false, error: error.message } : { ok: true };
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
    async discoverProfiles({ limit = 20, exclude = [] } = {}) {
      if (!client) return unavailable();
      const user = await this.currentUser();
      if (!user) return { ok: false, error: 'Conectează-te pentru a descoperi profiluri.' };
      let query = client.from('profiles')
        .select('id, display_name, birth_date, bio, city')
        .eq('discoverable', true)
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(Number(limit) || 20, 50)));
      if (exclude.length) query = query.not('id', 'in', `(${exclude.join(',')})`);
      const { data, error } = await query;
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
    async likeProfile(profileId) {
      if (!client) return unavailable();
      const { data, error } = await client.rpc('like_profile', { target_user: profileId });
      return error ? { ok: false, error: error.message } : { ok: true, data: data?.[0] || null };
    },
    async listConversations() {
      if (!client) return unavailable();
      const user = await this.currentUser();
      if (!user) return { ok: false, error: 'Conectează-te pentru a vedea conversațiile.' };
      const { data, error } = await client.from('conversation_members')
        .select('conversation_id, conversations(id, created_at)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });
      if (error) return { ok: false, error: error.message };
      const ids = [...new Set((data || []).map(row => row.conversation_id))];
      if (!ids.length) return { ok: true, data: [] };
      const { data: members, error: membersError } = await client.from('conversation_members')
        .select('conversation_id, user_id, profiles(id, display_name)')
        .in('conversation_id', ids)
        .neq('user_id', user.id);
      if (membersError) return { ok: false, error: membersError.message };
      return {
        ok: true,
        data: data.map(row => ({
          ...row,
          other_member: (members || []).find(member => member.conversation_id === row.conversation_id) || null
        }))
      };
    },
    async listMessages(conversationId, limit = 50) {
      if (!client) return unavailable();
      const { data, error } = await client.from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(Math.max(1, Math.min(Number(limit) || 50, 100)));
      return error ? { ok: false, error: error.message } : { ok: true, data };
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

