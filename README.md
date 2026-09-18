# Signaly

Application web / PWA de rappels et rendez-vous, simple et sans serveur (HTML, CSS, JavaScript uniquement).

## 1. Lancer le projet en local

Comme c'est un site 100% statique, un simple serveur local suffit (le microphone et le service worker exigent `http://` ou `https://`, pas `file://`) :

```bash
# à la racine du projet
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Ou avec l'extension VS Code "Live Server", ou `npx serve`.

## 2. Où mettre le robot vidéo / les images

- `/assets/robot.mp4` → la vidéo du robot animé (déjà en place). Remplacez ce fichier par votre propre export pour changer l'animation ; gardez le même nom pour ne rien avoir à modifier dans le code.
- `/assets/robot-fallback.png` → image affichée si la vidéo ne peut pas se charger. À remplacer par une capture représentative du robot si besoin.
- `/assets/icons/` → icônes de l'application (192px, 512px, version "maskable", favicon, icône iOS). Régénérez-les si vous changez de logo.

## 3. Remplacer le logo

Le logo texte « Signaly » + la cloche dorée sont directement dans `index.html` (bloc `<header class="header">`) et stylés dans `styles.css` (`.logo`, `.logo-text`, `.logo-bell`, `.logo-underline`). Pour changer :
- le texte : modifiez `<span class="logo-text">Signaly</span>` ;
- les couleurs : variables CSS `--navy` et `--gold` en haut de `styles.css` ;
- l'icône d'app (écran d'accueil du téléphone) : remplacez les fichiers dans `/assets/icons/`.

## 4. Publier avec GitHub Pages

1. Poussez le projet sur GitHub (branche `main`).
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Le site sera disponible sur `https://<utilisateur>.github.io/<depot>/` après quelques minutes.

Tous les chemins du projet sont relatifs : le site fonctionne aussi bien à la racine d'un domaine que sous un sous-dossier GitHub Pages.

## Structure du projet

```
index.html
styles.css
app.js                  # contrôleur principal (câblage UI)
js/
  storage.js            # localStorage (CRUD des rappels/rendez-vous)
  parser.js             # compréhension de phrases en français (sans IA)
  reminders.js          # logique des notifications / alerte de l'accueil
  calendar.js           # rendu du calendrier
  speech.js             # reconnaissance vocale (Web Speech API)
  notifications.js      # notifications navigateur
assets/
  robot.mp4
  robot-fallback.png
  icons/
manifest.json
service-worker.js
```

## Limites connues (V1)

- Aucun serveur, aucune clé API : tout est stocké dans le `localStorage` du navigateur (propre à chaque appareil/navigateur).
- Les notifications ne sont vérifiées que lorsque l'application est ouverte (au chargement, toutes les 30 secondes, et au retour au premier plan). Un site GitHub Pages ne peut pas déclencher d'alarme quand le navigateur est complètement fermé — `js/notifications.js` est isolé exprès pour pouvoir être remplacé plus tard par des notifications Push ou une app native (Capacitor) sans toucher au reste du code.
