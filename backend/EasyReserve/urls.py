from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from users.serializers import CustomTokenObtainPairSerializer

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Documentation OpenAPI / Swagger UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ✅ AUTHENTIFICATION JWT (Routes alignées avec le frontend)
    path('api/token/', TokenObtainPairView.as_view(serializer_class=CustomTokenObtainPairSerializer), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # ✅ AJOUT CRUCIAL : Alias pour correspondre aux appels du frontend
    path('api/auth/jwt/create/', TokenObtainPairView.as_view(serializer_class=CustomTokenObtainPairSerializer), name='auth_jwt_create'),
    path('api/auth/jwt/refresh/', TokenRefreshView.as_view(), name='auth_jwt_refresh'),
    
    # Modules métiers
    path('api/users/', include('users.urls')),
    path('api/agences/', include('agences.urls')),
    path('api/bus/', include('buses.urls')),
    path('api/places/', include('places.urls')),
    path('api/trajets/', include('trajets.urls')),
    path('api/reservations/', include('reservations.urls')),
    path('api/paiements/', include('paiements.urls')),
    path('api/chauffeurs/', include('chauffeurs.urls')),
]