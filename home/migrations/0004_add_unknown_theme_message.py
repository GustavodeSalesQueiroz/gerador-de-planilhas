from django.db import migrations


def add_unknown_theme_message(apps, schema_editor):
    """Registra a mensagem usada quando a API recebe um tema inválido."""
    MensagemBot = apps.get_model("home", "MensagemBot")
    MensagemBot.objects.get_or_create(
        chave="erro_tema",
        defaults={"texto": "Este tema não está disponível. Escolha um tema da lista."},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("home", "0003_mensagembot_temabot_and_more"),
    ]

    operations = [
        # Insere a mensagem inicial sem duplicá-la ao aplicar a migração.
        migrations.RunPython(add_unknown_theme_message, migrations.RunPython.noop),
    ]
