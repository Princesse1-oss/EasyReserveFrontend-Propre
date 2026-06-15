from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, RegisterView, ProfileView, GestionnaireAdminViewSet

router = DefaultRouter()
# ✅ Route pour les utilisateurs (CRUD Admin)
router.register(r'users', UserViewSet, basename='user')
# ✅ Route pour les gestionnaires (Liste, Activer, Désactiver, Activités)
router.register(r'gestionnaires', GestionnaireAdminViewSet, basename='gestionnaire-admin')

urlpatterns = [
    # Inscription et Profil individuel
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', ProfileView.as_view(), name='profile'),
    

    # Inclusion des routes du routeur
    path('', include(router.urls)),
]