from rest_framework import permissions

class IsAdminUserCustom(permissions.BasePermission):
    """Permet l'accès uniquement aux utilisateurs ayant le rôle ADMIN."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user, 'role', None) == 'ADMIN'
        )

class IsGestionnaire(permissions.BasePermission):
    """Permet l'accès uniquement aux utilisateurs ayant le rôle GESTIONNAIRE."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user, 'role', None) == 'GESTIONNAIRE'
        )

class IsClient(permissions.BasePermission):
    """Permet l'accès uniquement aux utilisateurs ayant le rôle CLIENT."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user, 'role', None) == 'CLIENT'
        )

class IsAdminOrGestionnaire(permissions.BasePermission):
    """Permet l'accès aux utilisateurs ayant le rôle ADMIN ou GESTIONNAIRE."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user, 'role', None) in ['ADMIN', 'GESTIONNAIRE']
        )

class IsAdminOrReadOnly(permissions.BasePermission):
    """Autorise l'écriture uniquement aux administrateurs, lecture pour les authentifiés."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user, 'role', None) == 'ADMIN'
        )
