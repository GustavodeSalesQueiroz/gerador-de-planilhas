from django.db import migrations


MESSAGES = [
    ("iniciar_registro", "Criar uma nova planilha"),
    ("editar_planilha", "Editar uma planilha existente"),
    ("adicionar_registro", "Adicionar outro registro"),
    ("editar_registro", "Editar registros existentes"),
    ("pergunta_nome_planilha", "Qual será o nome desta planilha?"),
    ("nome_planilha", "Nome da planilha"),
    ("confirmar_planilha", "Criar planilha"),
    ("escolher_planilha", "Qual planilha você deseja alterar?"),
    ("escolher_acao_planilha", "O que deseja fazer nesta planilha?"),
    ("escolher_registro", "Qual registro você deseja editar?"),
    ("registro_atualizado", "Registro atualizado com sucesso!"),
    ("planilha_criada", "Planilha criada com o primeiro registro. Você pode adicionar mais registros antes de baixar."),
    ("planilha_atualizada", "Planilha atualizada. Você pode baixar a versão atualizada."),
    ("planilha_pronta", "Planilha pronta para baixar"),
    ("nao_informado", "Não informado"),
    ("carregando", "Carregando..."),
    ("finalizar_planilha", "Finalizar e baixar a planilha"),
    ("continuar_planilha", "Continuar nesta planilha"),
    ("voltar_planilhas", "Voltar às planilhas"),
    ("planilhas_vazias", "Ainda não existem planilhas salvas. Crie uma para começar."),
    ("erro_nome_planilha", "Informe um nome com até 100 caracteres para a planilha."),
    ("criar_planilha_sucesso", "Planilha criada com sucesso."),
]


def add_messages(apps, schema_editor):
    """Carrega mensagens utilizadas no fluxo de criar, editar e baixar planilhas."""
    MensagemBot = apps.get_model("home", "MensagemBot")
    MensagemBot.objects.bulk_create(
        [MensagemBot(chave=chave, texto=texto) for chave, texto in MESSAGES],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("home", "0005_planilha_registroconversa_planilha"),
    ]

    operations = [
        # Adiciona mensagens do fluxo sem sobrescrever textos já cadastrados.
        migrations.RunPython(add_messages, migrations.RunPython.noop),
    ]
