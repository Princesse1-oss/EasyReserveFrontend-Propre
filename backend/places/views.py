from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from .models import Place
from .serializers import PlaceSerializer

class PlaceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API en lecture seule pour consulter les sièges.
    La création et suppression sont gérées automatiquement par les signaux du Bus.
    """
    queryset = Place.objects.all().select_related('bus')
    serializer_class = PlaceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['bus', 'disponible']
