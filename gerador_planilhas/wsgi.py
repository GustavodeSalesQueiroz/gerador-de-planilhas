"""
WSGI config for gerador_planilhas project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

# Define variáveis de ambiente usadas para selecionar as configurações do Django.
import os

# Cria a aplicação WSGI que servidores web tradicionais usarão para atender requisições.
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gerador_planilhas.settings')

# Expõe a aplicação WSGI para servidores web compatíveis.
application = get_wsgi_application()
