# Disponibiliza a classe base para configurar um aplicativo Django.
from django.apps import AppConfig


class HomeConfig(AppConfig):
    """Configura o aplicativo Django responsável pela interface e dados."""
    name = 'home'
