# Planning des répétitions — Metz Musical

Planning partagé des répétitions de *Neverland Cure*, en vue mensuelle et en liste, avec un code couleur par pôle.

**Lien du planning :** https://obstraqueur.github.io/planning-metz-musical/

- **Tout le monde, sans compte**, peut consulter, ajouter, modifier et supprimer des créneaux depuis le lien.
- Chaque ajout, modification ou suppression est **signé d'un prénom**.
- La **cloche** en haut à droite ouvre le centre de notifications : les dernières activités, avec un badge pour les nouveautés depuis votre dernière visite. Un créneau supprimé par erreur peut y être **restauré** en un clic.
- Les changements des autres apparaissent **en direct**, sans recharger la page.
- Le bouton **Exporter .ics** télécharge le planning pour l'importer dans Google Agenda ou Apple Calendrier.

Le site est hébergé gratuitement par GitHub Pages. Les créneaux sont enregistrés dans une base [Supabase](https://supabase.com) gratuite.

---

## Mise en route (une seule fois, environ 10 minutes)

### 1. Créer la base Supabase

1. Créez un compte sur https://supabase.com (bouton **Start your project**). Vous pouvez vous connecter avec GitHub.
2. Cliquez sur **New project**. Donnez un nom (par exemple « planning-metz-musical »), choisissez un mot de passe de base de données (à garder de côté) et la région **Europe (Paris ou Frankfurt)**, puis validez.
3. Une fois le projet prêt, ouvrez **SQL Editor** dans le menu de gauche, puis **New query**.
4. Copiez tout le contenu de [`supabase/setup.sql`](supabase/setup.sql), collez-le et cliquez sur **Run**. Le script crée les tables, les droits et les créneaux de départ. Vous pouvez le relancer sans risque : il ne crée pas de doublons.

### 2. Relier le site à la base

1. Dans Supabase, ouvrez **Project Settings → API** (ou le bouton **Connect**).
2. Copiez la **Project URL** et la clé **anon public** (parfois appelée **publishable key**).
3. Collez-les dans [`config.js`](config.js), dans `supabaseUrl` et `supabaseKey`, puis enregistrez (commit).

Cette clé est faite pour être publique. Ce sont les règles du script SQL qui décident de ce que le site peut faire. N'utilisez **jamais** la clé `service_role` ni la « secret key ».

### 3. Mettre le site en ligne

1. Sur GitHub, ouvrez le dépôt, puis **Settings → Pages**.
2. Choisissez **Source : Deploy from a branch**, **Branch : `main`**, dossier **`/ (root)`**, puis **Save**.
3. Une ou deux minutes après, le planning est en ligne. Partagez le lien à la troupe.

---

## Utilisation

- **Ajouter** : cliquez sur un jour (sur téléphone : touchez le jour, puis **+ Ajouter ce jour**). Renseignez le titre, le pôle, la couleur (celle du pôle par défaut), l'horaire, le lieu, des notes et **votre prénom**.
- **Créneau récurrent** : cochez **Répéter chaque semaine** et indiquez la date de fin.
- **Modifier ou supprimer** : cliquez sur le créneau. Pour une série, choisissez « Seulement celui-ci » ou « Celui-ci et les suivants ».
- **Journée entière ou plusieurs jours** : cochez **Toute la journée / horaire à préciser**, puis indiquez une date de fin si besoin.
- **Vue Liste** : tous les mois à la suite, de la première à la dernière date ; la page s'ouvre sur les prochains créneaux et les dates passées sont grisées. Un créneau sur plusieurs jours n'apparaît qu'à sa date de début.
- **Filtrer** : cliquez sur un pôle dans la légende pour le masquer ou l'afficher.
- **Changer de prénom** : bouton « Prénom » en haut à droite.

## Sécurité, en clair

Comme tout le monde peut modifier sans compte, quelqu'un qui a le lien pourrait supprimer des créneaux. Le centre de notifications garde la trace de qui a fait quoi, et chaque suppression peut être restaurée. Le journal des notifications, lui, ne peut être ni modifié ni effacé depuis le site. Le prénom est déclaratif : il n'est pas vérifié.

En dernier recours, tout l'historique est visible dans Supabase (**Table Editor → events / activity**).

## Bon à savoir

- **Mise en veille** : sur l'offre gratuite, Supabase met un projet en pause après une semaine sans aucune visite. Il suffit alors de cliquer sur **Restore project** dans le tableau de bord. Pendant la saison, les visites régulières de la troupe l'en empêchent.
- **Pôles et couleurs** : modifiez la liste `poles` dans `config.js`. Ne changez pas l'`id` d'un pôle déjà utilisé.
- **Date de la représentation** (compte à rebours) : modifiez `showDate` dans `config.js`.

## Rétroplanning (représentation le 24 mars 2027)

Le rétroplanning de la troupe est dans [`supabase/retroplanning.sql`](supabase/retroplanning.sql). Pour le charger : Supabase → **SQL Editor** → **New query**, collez tout le fichier, puis **Run**. Le script retire l'ancien planning à partir du 20 novembre 2026 (copie restaurable depuis la cloche du site), ajoute les 36 créneaux du rétroplanning et ne touche pas aux créneaux ajoutés à la main. Relancé une seconde fois, il s'arrête sans rien changer.

| Période | Contenu |
| --- | --- |
| 16 → 26 nov. | Fin de l'écriture ; script verrouillé le jeudi 26 |
| Déc. → janv. | Jeudis 17 h – 19 h : mise en place des Actes I et II (+ musique certains jeudis de 19 h à 20 h 30) ; vacances pour apprendre le texte |
| Février | Jeudis 17 h – 19 h avec musique et danse ; week-end cohésion les 20 – 21 fév. (filage complet n° 1) |
| Mars | Jeudi 4 (17 h – 21 h) : montage des décors ; samedi 6 : filage n° 2 ; jeudis 11 et 18 ; samedi 20 : pré-générale |
| Mercredi 24 mars | Montage à l'IRTS le matin, générale à 13 h 30, représentation à 19 h |

Les achats et la fabrication des décors et des costumes, et les échéances (financement FACS, décors et costumes terminés), sont aussi dans le planning. Le week-end des 12 – 13 février est marqué indisponible.
