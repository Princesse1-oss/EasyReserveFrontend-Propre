# REBUS - Système de Réservation de Bus

Une plateforme complète de réservation de billets de bus en ligne, développée avec **Django REST Framework** (backend) et **Angular 17+** (frontend).

## Table des matières
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancement du projet](#lancement-du-projet)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Déploiement](#déploiement)

---

## Fonctionnalités

### Utilisateurs (Client)
- Inscription sécurisée
- Recherche de trajets (ville de départ, destination, date)
- Consultation des horaires et places disponibles
- Réservation de sièges
- Paiement en ligne
- Téléchargement du billet électronique (PDF)
- Historique des réservations
- Annulation de réservation

### Administrateur
- Gestion des utilisateurs
- Gestion des agences
- Ajout/modification/suppression des trajets
- Gestion des horaires et tarifs
- Visualisation des statistiques (réservations, revenus)
- Validation des paiements

### Gestionnaire d'Agence
- Gestion des bus
- Gestion des chauffeurs
- Gestion des places
- Consultation des réservations
- Confirmation des départs

---

## Prérequis

### Méthode 1 : Avec Docker (Recommandée pour la portabilité)
- Docker et Docker Compose installés sur votre machine
  - [Télécharger Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Méthode 2 : Installation classique
- **Backend** :
  - Python 3.8+
  - pip
- **Frontend** :
  - Node.js 18+
  - npm ou yarn
- **Base de données** : SQLite (développement)

---

## Lancement du projet

### Avec Docker (Portable, une seule commande !)
1. Cloner le dépôt et se rendre dans le répertoire :
   ```bash
   git clone <URL_DU_DEPOT_GITHUB>
   cd EasyReserve
   ```
2. Copier le fichier d'environnement d'exemple :
   ```bash
   cd backend
   cp .env.example .env
   cd ..
   ```
3. Lancer le projet avec Docker Compose :
   ```bash
   docker-compose up --build
   ```
4. Initialiser la base de données (dans un nouveau terminal) :
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python create_users.py
   ```
5. Accéder à l'application :
   - Frontend : http://localhost
   - Backend API : http://localhost:8000
   - Documentation API : http://localhost:8000/api/docs/swagger/

### Installation et lancement classique
#### Backend
```bash
cd backend
# Créer un environnement virtuel (optionnel mais recommandé)
python -m venv venv
# Activer l'environnement virtuel
# Sur Windows :
venv\Scripts\activate
# Sur macOS/Linux :
source venv/bin/activate
# Copier le fichier d'environnement
cp .env.example .env
# Installer les dépendances
pip install -r requirements.txt
# Appliquer les migrations
python manage.py migrate
# Créer des comptes de test (optionnel)
python create_users.py
```

#### Frontend
```bash
cd ../frontend
npm install
```

### Lancement classique
#### Backend
```bash
cd backend
python manage.py runserver
```
Le backend est accessible à http://localhost:8000/

#### Frontend
```bash
cd frontend
npm start
```
Le frontend est accessible à http://localhost:4200/

---

## Comptes de démonstration

| Rôle          | Nom d'utilisateur | Mot de passe |
|---------------|-------------------|--------------|
| Administrateur| admin             | admin123     |
| Gestionnaire  | gestionnaire      | pass1234     |
| Client        | client            | client123    |

---

## Déploiement

---

### 🚀 Étape 1 : Déployer le Backend sur Render

1. **Créez un compte** sur [Render](https://render.com)
2. **Créez un nouveau Web Service**
3. **Connectez votre dépôt GitHub** et sélectionnez-le
4. **Configurez le Web Service** :
   - **Name** : `easy-reserve-backend` (ou autre nom)
   - **Region** : Sélectionnez une région (ex: Oregon)
   - **Branch** : `main` (ou votre branche de déploiement)
   - **Root Directory** : `backend`
   - **Runtime** : `Python 3`
   - **Build Command** : `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command** : `gunicorn EasyReserve.wsgi`
5. **Ajoutez une Base de Données** :
   - Dans le menu, cliquez sur **Databases**
   - Créez une base de données PostgreSQL (plan Free)
   - Copiez le **DATABASE_URL** généré
6. **Ajoutez les Variables d'Environnement** dans les paramètres du Web Service :
   | Clé | Valeur |
   |-----|--------|
   | `SECRET_KEY` | Cliquez sur **Generate** pour créer une clé sécurisée |
   | `DEBUG` | `False` |
   | `FRONTEND_URL` | (sera rempli après déploiement du frontend, ex: `https://easy-reserve.vercel.app`) |
   | `DATABASE_URL` | Collez l'URL de la base de données PostgreSQL |
7. **Déployez !** Cliquez sur **Create Web Service**
8. **Copiez l'URL de votre backend** (ex: `https://easy-reserve-backend.onrender.com`)

---

### 🚀 Étape 2 : Déployer le Frontend sur Vercel

1. **Mettez à jour environment.prod.ts** dans `frontend/src/environments/` :
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://VOTRE_BACKEND.onrender.com/api',
   };
   ```
   Remplacez par l'URL de votre backend Render !

2. **Committez et pushez** cette modification sur GitHub

3. **Créez un compte** sur [Vercel](https://vercel.com)
4. **Importez votre dépôt GitHub** :
   - Cliquez sur **New Project**
   - Sélectionnez votre dépôt EasyReserve
5. **Configurez le projet** :
   - **Project Name** : `easy-reserve` (ou autre nom)
   - **Root Directory** : `frontend`
   - **Framework Preset** : Angular (détecté automatiquement)
6. **Déployez !** Cliquez sur **Deploy**
7. **Copiez l'URL de votre frontend** (ex: `https://easy-reserve.vercel.app`)

---

### 🔄 Étape 3 : Finaliser la Configuration

1. **Mettez à jour les Variables d'Environnement sur Render** :
   - Allez dans les paramètres de votre backend Render
   - Mettez à jour `FRONTEND_URL` avec l'URL de votre frontend Vercel
2. **Redéployez le backend** sur Render (pour que les changements prennent effet)

---

## URLs de Production
- **Backend Render** : `https://<VOTRE_APP>.onrender.com`
- **Frontend Vercel** : `https://<VOTRE_APP>.vercel.app`

---

## Auteur
Projet réalisé dans le cadre du cours de Développement Web (Licence 2) à l'Institut Universitaire Saint Jean (Saint Jean Ingenieur), année académique 2025-2026.
