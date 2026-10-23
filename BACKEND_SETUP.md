# Activarea backend-ului Noir

Site-ul public este o previzualizare demonstrativă; profilurile și activitatea afișate nu sunt conturi reale. Backend-ul nu este configurat încă. Pentru previzualizare locală, pornește `node dev-server.mjs` și deschide `http://127.0.0.1:4173`. Serverul de dezvoltare este doar pentru acest computer. Proiectul este pregătit pentru Supabase Auth, Postgres și Realtime.

1. Creează un proiect Supabase și configurează autentificarea prin e-mail.
2. În SQL Editor, rulează `supabase/schema.sql`. Schema include profiluri pentru adulți, like-uri, potriviri reciproce și crearea automată a unei conversații la potrivire. `like_profile` este funcția securizată care înregistrează like-ul și întoarce dacă s-a format o potrivire.
3. Copiază Project URL și cheia publică (`publishable` sau `anon`) în `backend-config.js`.
4. Publică fișierele site-ului pe un serviciu de hosting HTTPS și adaugă adresa publică în URL-urile permise pentru autentificare.
5. Configurează e-mailul de confirmare și înregistrarea cu un cont adult.

Nu pune cheia `service_role` în fișierele site-ului. Ea oferă privilegii ridicate și trebuie să rămână doar pe server. Înaintea lansării publice mai sunt necesare fluxurile UI de autentificare, potrivire reală, creare conversație, moderare și verificarea vârstei care nu se bazează doar pe data declarată de utilizator.

Metodele `discoverProfiles`, `likeProfile`, `listConversations`, `listMessages` și `sendMessage` din `backend.js` sunt clientul de integrare. Interfața demonstrativă nu este încă legată de aceste metode, iar autentificarea/chatul nu funcționează pe site până la configurarea Supabase și conectarea fluxurilor UI.

