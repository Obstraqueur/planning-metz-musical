// Réglages du planning.
window.PLANNING_CONFIG = {
  // Projet Supabase : Project Settings → API (ou « Connect »).
  // La clé « anon » / « publishable » est faite pour être publique :
  // ce sont les règles de la base (supabase/setup.sql) qui décident de ce qui est permis.
  supabaseUrl: "https://uqgjfkljwqcswbkmheta.supabase.co",
  supabaseKey: "sb_publishable_8HGi8IedITNSAIn7upmNsw_RLMkJ7iM",

  // Date de la représentation : sert au compte à rebours en haut de page.
  showDate: "2027-04-13",
  showLabel: "la représentation",

  // Pôles : id (ne pas changer une fois utilisé), nom affiché, couleur.
  poles: [
    { id: "acteurs",   name: "Acteurs",                color: "#2563eb" },
    { id: "musique",   name: "Musique",                color: "#7c3aed" },
    { id: "danse",     name: "Danse",                  color: "#c026d3" },
    { id: "decors",    name: "Décors & costumes",      color: "#a16207" },
    { id: "commune",   name: "Répétition commune",     color: "#059669" },
    { id: "weekend",   name: "Week-end de répétition", color: "#0891b2" },
    { id: "generale",  name: "Générales",              color: "#ea580c" },
    { id: "spectacle", name: "Représentation",         color: "#e11d48" },
    { id: "autre",     name: "Autre",                  color: "#64748b" }
  ]
};
