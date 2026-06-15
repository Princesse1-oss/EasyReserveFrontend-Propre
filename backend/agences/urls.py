from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AgenceViewSet

router = DefaultRouter()
router.register(r'', AgenceViewSet, basename='agence')

urlpatterns = [
    path('', include(router.urls)),
]
