# Planning des répétitions — Metz Musical

Planning partagé des répétitions de *Neverland Cure*, en vue mensuelle et en liste, avec un code couleur par pôle.

**Lien du planning :** https://obstraqueur.github.io/planning-metz-musical/

- Tout le monde peut **consulter** le planning, sans compte.
- Les **responsables de pôle** peuvent ajouter, modifier ou supprimer des créneaux.
- Le bouton **Exporter .ics** télécharge le planning pour l'importer dans Google Agenda ou Apple Calendrier.

Les créneaux sont enregistrés dans [`data/events.json`](data/events.json). Chaque modification crée un commit au nom du responsable, donc l'historique du dépôt garde la trace de qui a changé quoi, et tout peut être annulé.

---

## 1. Mise en ligne (une seule fois, par le propriétaire du dépôt)

1. Sur GitHub, ouvrez le dépôt, puis **Settings → Pages**.
2. Dans **Build and deployment**, choisissez **Source : Deploy from a branch**, **Branch : `main`**, dossier **`/ (root)`**, puis **Save**.
3. Après une à deux minutes, le site est en ligne à l'adresse ci-dessus.

## 2. Donner l'accès à un responsable

Chaque responsable a besoin d'un compte GitHub gratuit.

1. Le propriétaire du dépôt va dans **Settings → Collaborators → Add people** et invite le compte GitHub du responsable.
2. Le responsable accepte l'invitation (reçue par e-mail ou sur https://github.com/notifications).

## 3. Se connecter sur le planning (chaque responsable)

1. Créez un jeton GitHub :
   - **Collaborateurs** : allez sur https://github.com/settings/tokens/new (jeton « classic »). Dans **Note**, mettez « Planning Metz Musical » et choisissez une **expiration** (par exemple fin mai 2027). Cochez uniquement la case **`public_repo`**, puis cliquez sur **Generate token**.
   - **Propriétaire du dépôt** : vous pouvez aussi utiliser un jeton « fine-grained » (https://github.com/settings/personal-access-tokens/new), limité au dépôt `planning-metz-musical` avec la permission **Contents : Read and write**.
2. Copiez le jeton (il ne s'affiche qu'une fois).
3. Sur le planning, cliquez sur **Accès responsable**, entrez votre prénom et collez le jeton.

Le jeton reste uniquement dans votre navigateur. Ne le partagez pas : en cas de perte, supprimez-le sur GitHub et créez-en un autre.

> Les jetons « fine-grained » ne fonctionnent pas pour les collaborateurs d'un dépôt personnel : c'est une limite de GitHub. Les collaborateurs doivent donc utiliser un jeton « classic ».

## 4. Utilisation

- **Ajouter un créneau** : cliquez sur un jour (ou sur **+ Ajouter**). Renseignez le titre, le pôle, la couleur (celle du pôle par défaut), l'horaire, le lieu et des notes.
- **Créneau récurrent** : cochez **Répéter chaque semaine** et indiquez la date de fin.
- **Modifier ou supprimer** : cliquez sur le créneau. Pour une série, choisissez « Seulement celui-ci » ou « Celui-ci et les suivants ».
- **Journée ou plusieurs jours** : cochez **Toute la journée / horaire à préciser**, puis indiquez une date de fin si besoin (pour un week-end, par exemple).
- **Filtrer** : cliquez sur un pôle dans la légende pour le masquer ou l'afficher.
- **Plusieurs personnes en même temps** : si deux responsables enregistrent au même moment, la page recharge la dernière version et réapplique la modification. Rien n'est écrasé.

## 5. Personnaliser

- **Pôles et couleurs** : modifiez la liste `poles` au début de `data/events.json` (`id`, `name`, `color`).
- **Date de la représentation** (compte à rebours) : modifiez `showDate` dans `config.js`.

## Contenu initial

| Pôle | Créneaux |
| --- | --- |
| Acteurs | Tous les jeudis de 17 h à 18 h 30 jusqu'aux vacances de Noël, puis de 17 h à 19 h de janvier au 8 avril 2027 |
| Week-end de répétition | Samedi 3 et dimanche 4 avril 2027 |
| Générales | Pré-générale le samedi 10 avril 2027, générale le lundi 12 avril 2027 |
| Représentation | Mardi 13 avril 2027 |

Les pôles Musique, Danse, Décors & costumes et Répétition commune sont prêts à être remplis par leurs responsables.
