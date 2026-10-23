# Activarea backend-ului Noir

Prototipul nu este încă public și nu are un backend configurat. Pentru previzualizare locală, pornește `node dev-server.mjs` și deschide `http://127.0.0.1:4173`. Serverul de dezvoltare este doar pentru acest computer, nu publică aplicația pe internet. Proiectul este pregătit pentru Supabase Auth, Postgres și Realtime.

1. Creează un proiect Supabase și configurează autentificarea prin e-mail.
2. În SQL Editor, rulează `supabase/schema.sql`.
3. Copiază Project URL și cheia publică (`publishable` sau `anon`) în `backend-config.js`.
4. Publică fișierele site-ului pe un serviciu de hosting HTTPS și adaugă adresa publică în URL-urile permise pentru autentificare.
5. Configurează e-mailul de confirmare și testează înregistrarea cu un cont adult.

Nu pune cheia `service_role` în fișierele site-ului. Ea oferă privilegii ridicate și trebuie să rămână doar pe server. Înaintea lansării publice mai sunt necesare fluxurile UI de autentificare, potrivire reală, creare conversație, moderare și verificarea vârstei care nu se bazează doar pe data declarată de utilizator.

