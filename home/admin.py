from django.contrib import admin
from .models import MensagemBot, PerguntaBot, Planilha, RegistroConversa, RegistroOperacional, TemaBot

admin.site.register(RegistroOperacional)
admin.site.register(TemaBot)
admin.site.register(PerguntaBot)
admin.site.register(MensagemBot)
admin.site.register(Planilha)
admin.site.register(RegistroConversa)
