from abc import ABC, abstractmethod

class SMSProviderInterface(ABC):
    """Interface de base pour tous les providers SMS"""
    
    @abstractmethod
    def send(self, to: str, message: str) -> bool:
        """Envoie un SMS"""
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Retourne le nom du provider"""
        pass