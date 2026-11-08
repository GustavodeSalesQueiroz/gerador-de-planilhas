# Converte corpos JSON das requisições e prepara os dados de resposta.
import json
# Oferece operações matemáticas usadas nas validações de números.
import math
# Permite localizar e validar padrões em textos.
import re
# Fornece tipos e conversões para datas e horários.
from datetime import date, datetime, time
# Representa números decimais com precisão e identifica falhas de conversão.
from decimal import Decimal, InvalidOperation
# Cria um arquivo temporário em memória para gerar downloads do Excel.
from io import BytesIO
# Manipula caminhos de arquivos de forma compatível com o sistema operacional.
from pathlib import Path
# Identifica arquivos ZIP inválidos e permite inspecionar o conteúdo do XLSX.
from zipfile import BadZipFile, ZipFile

# Agrupa operações do banco em transações que podem ser revertidas em caso de erro.
from django.db import transaction
# Conta registros relacionados em consultas ao banco.
from django.db.models import Count
# Cria respostas de download e respostas JSON para o navegador.
from django.http import FileResponse, JsonResponse
# Busca objetos ou responde com erro 404 e renderiza páginas HTML.
from django.shortcuts import get_object_or_404, render
# Gera versões simplificadas de textos, usadas em nomes e identificadores.
from django.template.defaultfilters import slugify
# Constrói URLs pelo nome definido nas rotas do Django.
from django.urls import reverse
# Converte datas para o fuso horário configurado na aplicação.
from django.utils import timezone
# Permite exibir respostas dentro de páginas do mesmo site, como o iframe de download.
from django.views.decorators.clickjacking import xframe_options_sameorigin
# Restringe quais métodos HTTP cada view pode receber.
from django.views.decorators.http import require_GET, require_http_methods, require_POST
# Cria e abre pastas de trabalho do Excel.
from openpyxl import Workbook, load_workbook
# Define alinhamento, fontes e preenchimentos nas células do Excel.
from openpyxl.styles import Alignment, Font, PatternFill
# Converte números de coluna em letras, como 1 em A, para formatação da planilha.
from openpyxl.utils import get_column_letter
# Identifica formatos de arquivo Excel não suportados ou inválidos.
from openpyxl.utils.exceptions import InvalidFileException

# Importa os modelos do app usados para consultar e salvar dados no banco.
from .models import MensagemBot, Planilha, RegistroConversa, RegistroOperacional, TemaBot


def home(request):
    """Monta o histórico recente e entrega ao template as URLs da API."""
    planilhas = Planilha.objects.select_related("tema").annotate(
        total_registros=Count("registros"),
    )[:10]
    historico = [
        {
            "planilha_id": planilha.pk,
            "tema": planilha.tema.nome,
            "resumo": f"{planilha.nome} · {planilha.total_registros} registro(s)",
            "criado_em": timezone.localtime(planilha.atualizada_em),
        }
        for planilha in planilhas
    ]

    registros_antigos = RegistroOperacional.objects.order_by("-criado_em")[:10]
    for registro in registros_antigos:
        historico.append({
            "tema": registro.get_categoria_display(),
            "resumo": registro.detalhes,
            "criado_em": timezone.localtime(registro.criado_em),
        })
    historico.sort(key=lambda item: item["criado_em"], reverse=True)

    return render(
        request,
        "home.html",
        {
            "registros": historico[:10],
            "chatbot_config": {
                "roteiro_url": reverse("roteiro_chatbot"),
                "planilhas_url": reverse("listar_planilhas"),
                "criar_planilha_url": reverse("criar_planilha"),
                "editar_planilha_externa_url": reverse("editar_planilha_externa"),
            },
        },
    )


@require_GET
def roteiro_chatbot(request):
    """Expõe temas, perguntas e mensagens cadastrados para o frontend."""
    temas = TemaBot.objects.filter(ativo=True).prefetch_related("perguntas")
    mensagens = dict(MensagemBot.objects.values_list("chave", "texto"))
    roteiro = [
        {
            "codigo": tema.codigo,
            "nome": tema.nome,
            "perguntas": [
                {
                    "campo": pergunta.campo,
                    "cabecalho": pergunta.cabecalho,
                    "pergunta": pergunta.pergunta,
                    "tipo": pergunta.tipo,
                    "obrigatoria": pergunta.obrigatoria,
                    "opcoes": pergunta.opcoes,
                }
                for pergunta in tema.perguntas.all()
            ],
        }
        for tema in temas
    ]
    return JsonResponse({"mensagens": mensagens, "temas": roteiro})


def texto_bot(chave):
    """Retorna o texto configurado no banco para a chave informada."""
    return MensagemBot.objects.get(chave=chave).texto


def ler_json(request):
    """Decodifica o corpo JSON e responde com erro quando o formato é inválido."""
    try:
        dados = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None, JsonResponse({"erro": texto_bot("erro_formato")}, status=400)
    if not isinstance(dados, dict):
        return None, JsonResponse({"erro": texto_bot("erro_formato")}, status=400)
    return dados, None


def validar_respostas(tema, respostas):
    """Confere campos e valores segundo as perguntas cadastradas para o tema."""
    perguntas = list(tema.perguntas.all())
    campos_esperados = {pergunta.campo for pergunta in perguntas}
    if set(respostas) != campos_esperados:
        return None, texto_bot("erro_respostas")

    respostas_validadas = {}
    for pergunta in perguntas:
        valor = respostas.get(pergunta.campo)
        if not isinstance(valor, str):
            return None, texto_bot("erro_campo_obrigatorio").format(campo=pergunta.cabecalho)
        valor = valor.strip()

        if pergunta.obrigatoria and not valor:
            return None, texto_bot("erro_campo_obrigatorio").format(campo=pergunta.cabecalho)
        if not valor:
            respostas_validadas[pergunta.campo] = ""
            continue
        if len(valor) > 300:
            return None, texto_bot("erro_tamanho").format(campo=pergunta.cabecalho)
        if pergunta.opcoes and valor not in pergunta.opcoes:
            return None, texto_bot("erro_opcao").format(campo=pergunta.cabecalho.lower())

        if pergunta.tipo == "number":
            try:
                numero = Decimal(valor)
            except InvalidOperation:
                return None, texto_bot("erro_numero").format(campo=pergunta.cabecalho.lower())
            if not numero.is_finite() or numero < 0 or numero > Decimal("999999999.99"):
                return None, texto_bot("erro_intervalo").format(campo=pergunta.cabecalho.lower())
            valor = format(numero, "f")
        elif pergunta.tipo == "date":
            try:
                datetime.strptime(valor, "%Y-%m-%d")
            except ValueError:
                return None, texto_bot("erro_data").format(campo=pergunta.cabecalho.lower())

        respostas_validadas[pergunta.campo] = valor

    return respostas_validadas, None


def resumo_registro(tema, respostas):
    """Cria um resumo legível usando os cabeçalhos das perguntas do tema."""
    perguntas = {pergunta.campo: pergunta for pergunta in tema.perguntas.all()}
    return " · ".join(
        f"{perguntas[campo].cabecalho}: {valor}"
        for campo, valor in respostas.items()
        if campo in perguntas
    )


def serializar_registro(registro):
    """Converte um registro salvo para o formato usado pelas respostas da API."""
    return {
        "id": registro.pk,
        "planilha_id": registro.planilha_id,
        "respostas": registro.respostas,
        "resumo": resumo_registro(registro.tema, registro.respostas),
        "criado_em": timezone.localtime(registro.criado_em).strftime("%d/%m/%Y %H:%M"),
    }


def serializar_planilha(planilha):
    """Converte uma planilha e seus metadados para o formato da API."""
    return {
        "id": planilha.pk,
        "nome": planilha.nome,
        "tema": planilha.tema.codigo,
        "tema_nome": planilha.tema.nome,
        "quantidade": planilha.registros.count(),
        "atualizada_em": timezone.localtime(planilha.atualizada_em).strftime("%d/%m/%Y %H:%M"),
        "url": reverse("baixar_planilha_por_id", args=[planilha.pk]),
    }


def resposta_salva(planilha, registro, mensagem_chave, status=200):
    """Atualiza a data da planilha e monta a resposta comum de salvamento."""
    planilha.atualizada_em = timezone.now()
    planilha.save(update_fields=["atualizada_em"])
    return JsonResponse(
        {
            "mensagem": texto_bot(mensagem_chave),
            "mensagem_download": texto_bot("download_planilha"),
            "mensagem_novo": texto_bot("iniciar_outro"),
            "mensagem_adicionar": texto_bot("adicionar_registro"),
            "mensagem_editar": texto_bot("editar_planilha"),
            "mensagem_editar_linha": texto_bot("editar_registro"),
            "planilha": serializar_planilha(planilha),
            "registro": serializar_registro(registro),
            "download_url": reverse("baixar_planilha_por_id", args=[planilha.pk]),
        },
        status=status,
    )


@require_GET
def listar_planilhas(request):
    """Lista planilhas com o tema e a quantidade atual de registros."""
    planilhas = Planilha.objects.select_related("tema").annotate(
        total_registros=Count("registros"),
    )
    return JsonResponse({
        "planilhas": [
            {
                **serializar_planilha(planilha),
                "quantidade": planilha.total_registros,
            }
            for planilha in planilhas
        ],
    })


@require_GET
def detalhe_planilha(request, planilha_id):
    """Retorna perguntas e registros para abrir uma planilha no chatbot."""
    planilha = get_object_or_404(
        Planilha.objects.select_related("tema").prefetch_related("registros"),
        pk=planilha_id,
    )
    return JsonResponse({
        "planilha": serializar_planilha(planilha),
        "perguntas": [
            {
                "campo": pergunta.campo,
                "cabecalho": pergunta.cabecalho,
                "pergunta": pergunta.pergunta,
                "tipo": pergunta.tipo,
                "obrigatoria": pergunta.obrigatoria,
                "opcoes": pergunta.opcoes,
            }
            for pergunta in planilha.tema.perguntas.all()
        ],
        "registros": [
            serializar_registro(registro)
            for registro in planilha.registros.all()
        ],
    })


@require_POST
def criar_planilha(request):
    """Valida e cria uma planilha já contendo o primeiro registro."""
    dados, erro_json = ler_json(request)
    if erro_json:
        return erro_json

    codigo_tema = dados.get("tema")
    nome = dados.get("nome")
    respostas = dados.get("respostas")
    if not isinstance(codigo_tema, str) or not isinstance(respostas, dict):
        return JsonResponse({"erro": texto_bot("erro_respostas")}, status=400)
    if not isinstance(nome, str) or not nome.strip() or len(nome.strip()) > 100:
        return JsonResponse({"erro": texto_bot("erro_nome_planilha")}, status=400)

    tema = TemaBot.objects.filter(codigo=codigo_tema, ativo=True).first()
    if tema is None:
        return JsonResponse({"erro": texto_bot("erro_tema")}, status=404)
    respostas_validadas, erro = validar_respostas(tema, respostas)
    if erro:
        return JsonResponse({"erro": erro}, status=400)

    with transaction.atomic():
        planilha = Planilha.objects.create(tema=tema, nome=nome.strip())
        registro = RegistroConversa.objects.create(
            tema=tema,
            planilha=planilha,
            respostas=respostas_validadas,
        )
    return resposta_salva(planilha, registro, "planilha_criada", status=201)


@require_http_methods(["POST", "PATCH"])
def salvar_registro_planilha(request, planilha_id, registro_id=None):
    """Adiciona um registro à planilha ou atualiza um registro existente."""
    planilha = get_object_or_404(
        Planilha.objects.select_related("tema"),
        pk=planilha_id,
    )
    dados, erro_json = ler_json(request)
    if erro_json:
        return erro_json

    respostas = dados.get("respostas")
    if not isinstance(respostas, dict):
        return JsonResponse({"erro": texto_bot("erro_respostas")}, status=400)
    respostas_validadas, erro = validar_respostas(planilha.tema, respostas)
    if erro:
        return JsonResponse({"erro": erro}, status=400)

    if request.method == "POST":
        if registro_id is not None:
            return JsonResponse(
                {"erro": texto_bot("erro_respostas")},
                status=405,
                headers={"Allow": "PATCH"},
            )
        registro = RegistroConversa.objects.create(
            tema=planilha.tema,
            planilha=planilha,
            respostas=respostas_validadas,
        )
        return resposta_salva(planilha, registro, "registro_salvo", status=201)

    if registro_id is None:
        return JsonResponse(
            {"erro": texto_bot("erro_respostas")},
            status=405,
            headers={"Allow": "POST"},
        )

    registro = get_object_or_404(
        RegistroConversa,
        pk=registro_id,
        planilha=planilha,
    )
    registro.respostas = respostas_validadas
    registro.save(update_fields=["respostas"])
    return resposta_salva(planilha, registro, "registro_atualizado")


@require_POST
def criar_conversa(request):
    """Salva uma conversa sem planilha nomeada e fornece o link de exportação."""
    dados, erro_json = ler_json(request)
    if erro_json:
        return erro_json

    codigo_tema = dados.get("tema")
    respostas = dados.get("respostas")
    if not isinstance(codigo_tema, str) or not isinstance(respostas, dict):
        return JsonResponse({"erro": texto_bot("erro_respostas")}, status=400)

    tema = TemaBot.objects.filter(codigo=codigo_tema, ativo=True).first()
    if tema is None:
        return JsonResponse({"erro": texto_bot("erro_tema")}, status=404)
    respostas_validadas, erro = validar_respostas(tema, respostas)
    if erro:
        return JsonResponse({"erro": erro}, status=400)

    conversa = RegistroConversa.objects.create(tema=tema, respostas=respostas_validadas)
    return JsonResponse(
        {
            "mensagem": texto_bot("registro_salvo"),
            "mensagem_download": texto_bot("download_planilha"),
            "mensagem_novo": texto_bot("iniciar_outro"),
            "registro": {
                "tema": tema.nome,
                "resumo": resumo_registro(tema, respostas_validadas),
                "criado_em": timezone.localtime(conversa.criado_em).strftime("%d/%m/%Y %H:%M"),
            },
            "download_url": reverse("baixar_planilha", args=[tema.codigo]),
        },
        status=201,
    )


MAX_EXTERNAL_WORKBOOK_SIZE = 2 * 1024 * 1024
MAX_EXTERNAL_UNCOMPRESSED_SIZE = 20 * 1024 * 1024
MAX_EXTERNAL_SHEET_CELLS = 5000
EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def abrir_planilha_externa(request):
    """Valida e abre o arquivo Excel enviado sem armazená-lo no servidor."""
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return None, None, JsonResponse({"erro": "Selecione um arquivo Excel .xlsx."}, status=400)
    if not arquivo.name.lower().endswith(".xlsx"):
        return None, None, JsonResponse({"erro": "Envie um arquivo no formato .xlsx."}, status=400)
    if arquivo.size > MAX_EXTERNAL_WORKBOOK_SIZE:
        return None, None, JsonResponse({"erro": "O arquivo deve ter no máximo 2 MB."}, status=400)

    # Limites comprimido e descomprimido reduzem o risco de uploads excessivos.
    conteudo = arquivo.read()
    try:
        with ZipFile(BytesIO(conteudo)) as pacote:
            itens = pacote.infolist()
            if len(itens) > 1000 or sum(item.file_size for item in itens) > MAX_EXTERNAL_UNCOMPRESSED_SIZE:
                return None, None, JsonResponse({"erro": "O conteúdo descompactado do arquivo excede o limite permitido."}, status=400)
        workbook = load_workbook(BytesIO(conteudo), data_only=False)
    except (BadZipFile, InvalidFileException, KeyError, OSError, RuntimeError, ValueError):
        return None, None, JsonResponse({"erro": "Não foi possível abrir o arquivo. Confira se ele é um Excel .xlsx válido."}, status=400)

    nome_aba = request.POST.get("aba") or workbook.active.title
    if nome_aba not in workbook.sheetnames:
        return None, None, JsonResponse({"erro": "A aba escolhida não existe nesse arquivo."}, status=400)

    sheet = workbook[nome_aba]
    if sheet.max_row * sheet.max_column > MAX_EXTERNAL_SHEET_CELLS:
        return None, None, JsonResponse({"erro": "A aba deve ter no máximo 5.000 células para edição."}, status=400)
    return workbook, sheet, None


def valor_excel_para_texto(valor):
    """Converte valores de células em texto simples para a grade de edição."""
    if valor is None:
        return ""
    if isinstance(valor, datetime):
        return valor.isoformat(sep=" ")
    if isinstance(valor, (date, time)):
        return valor.isoformat()
    return str(valor)


def editar_valor_excel(valor_original, valor_novo):
    """Preserva tipos básicos ao editar células e mantém fórmulas digitadas como texto."""
    if valor_novo == "":
        return None
    if isinstance(valor_original, bool):
        valor_normalizado = valor_novo.strip().lower()
        if valor_normalizado in {"true", "verdadeiro"}:
            return True
        if valor_normalizado in {"false", "falso"}:
            return False
    elif isinstance(valor_original, (int, float)) and not isinstance(valor_original, bool):
        try:
            numero = Decimal(valor_novo)
        except InvalidOperation:
            pass
        else:
            if numero.is_finite() and abs(numero) <= Decimal("1e308"):
                if isinstance(valor_original, int) and numero == numero.to_integral_value():
                    return int(numero)
                numero_float = float(numero)
                if math.isfinite(numero_float):
                    return numero_float
    elif isinstance(valor_original, datetime):
        try:
            return datetime.fromisoformat(valor_novo)
        except ValueError:
            pass
    elif isinstance(valor_original, date):
        try:
            return date.fromisoformat(valor_novo)
        except ValueError:
            pass

    return valor_novo


@require_POST
@xframe_options_sameorigin
def editar_planilha_externa(request):
    """Mostra uma aba de um .xlsx ou devolve o arquivo com células editadas."""
    # A prévia recebe somente o nome da aba; o envio de alterações gera o arquivo final.
    workbook, sheet, error = abrir_planilha_externa(request)
    if error:
        return error

    alteracoes_json = request.POST.get("alteracoes")
    if alteracoes_json is None:
        linhas = [
            [
                valor_excel_para_texto(sheet.cell(row=row, column=column).value)
                for column in range(1, sheet.max_column + 1)
            ]
            for row in range(1, sheet.max_row + 1)
        ]
        return JsonResponse({
            "abas": workbook.sheetnames,
            "aba": sheet.title,
            "linhas": linhas,
            "colunas": [get_column_letter(column) for column in range(1, sheet.max_column + 1)],
        })

    try:
        alteracoes = json.loads(alteracoes_json)
    except json.JSONDecodeError:
        return JsonResponse({"erro": "As alterações enviadas não são válidas."}, status=400)
    if not isinstance(alteracoes, list) or len(alteracoes) > MAX_EXTERNAL_SHEET_CELLS:
        return JsonResponse({"erro": "A lista de alterações não é válida."}, status=400)

    for alteracao in alteracoes:
        if not isinstance(alteracao, dict):
            return JsonResponse({"erro": "Uma das alterações está inválida."}, status=400)
        linha = alteracao.get("linha")
        coluna = alteracao.get("coluna")
        valor = alteracao.get("valor")
        if (
            not isinstance(linha, int)
            or isinstance(linha, bool)
            or not isinstance(coluna, int)
            or isinstance(coluna, bool)
            or not 1 <= linha <= sheet.max_row
            or not 1 <= coluna <= sheet.max_column
            or not isinstance(valor, str)
            or len(valor) > 32767
        ):
            return JsonResponse({"erro": "Uma das células editadas está fora dos limites ou contém texto muito longo."}, status=400)

        cell = sheet.cell(row=linha, column=coluna)
        cell.value = editar_valor_excel(cell.value, valor)
        # Entradas iniciadas com "=" permanecem texto e não viram fórmulas executáveis.
        if isinstance(cell.value, str):
            cell.data_type = "s"

    # A cópia é gerada em memória para não salvar o arquivo enviado no servidor.
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    nome_base = Path(request.FILES["arquivo"].name).stem
    nome_seguro = slugify(nome_base) or "planilha"
    return FileResponse(
        output,
        as_attachment=True,
        filename=f"{nome_seguro}-editada.xlsx",
        content_type=EXCEL_CONTENT_TYPE,
    )


def gerar_arquivo_excel(planilha, registros, nome_arquivo):
    """Gera um Excel formatado, convertendo respostas para os tipos adequados."""
    tema = planilha.tema
    perguntas = list(tema.perguntas.all())
    workbook = Workbook()
    sheet = workbook.active
    titulo = re.sub(r"[\[\]:*?/\\]", " ", planilha.nome).strip("'")[:31]
    sheet.title = titulo or tema.nome_planilha
    sheet.append(["Data do registro"] + [pergunta.cabecalho for pergunta in perguntas])

    for registro in registros:
        created_at = timezone.localtime(registro.criado_em).replace(tzinfo=None)
        row = [created_at]
        for pergunta in perguntas:
            valor = registro.respostas.get(pergunta.campo, "")
            if pergunta.tipo == "number" and valor:
                valor = float(Decimal(valor))
            elif pergunta.tipo == "date" and valor:
                valor = datetime.strptime(valor, "%Y-%m-%d").date()
            row.append(valor)
        sheet.append(row)
        for column_index, pergunta in enumerate(perguntas, start=2):
            if pergunta.tipo == "text":
                sheet.cell(row=sheet.max_row, column=column_index).data_type = "s"

    header_fill = PatternFill(fill_type="solid", fgColor="245C4A")
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        cell.data_type = "s"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for column in sheet.columns:
        max_width = max(len(str(cell.value or "")) for cell in column)
        sheet.column_dimensions[get_column_letter(column[0].column)].width = min(max(max_width + 2, 14), 40)

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return FileResponse(
        output,
        as_attachment=True,
        filename=nome_arquivo,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@require_GET
def baixar_planilha_por_id(request, planilha_id):
    """Exporta todos os registros vinculados à planilha selecionada."""
    planilha = get_object_or_404(
        Planilha.objects.select_related("tema").prefetch_related("registros"),
        pk=planilha_id,
    )
    nome = slugify(planilha.nome) or planilha.tema.codigo
    filename = f"{nome}-{planilha.pk}.xlsx"
    return gerar_arquivo_excel(
        planilha,
        planilha.registros.order_by("criado_em", "pk"),
        filename,
    )


@require_GET
def baixar_planilha(request, codigo):
    """Exporta registros avulsos de um tema que ainda não pertencem a planilhas."""
    tema = get_object_or_404(TemaBot, codigo=codigo, ativo=True)
    planilha = Planilha(tema=tema, nome=tema.nome_planilha)
    registros = RegistroConversa.objects.filter(tema=tema, planilha__isnull=True)
    filename = f"{tema.codigo}-{timezone.localtime():%Y%m%d-%H%M%S}.xlsx"
    return gerar_arquivo_excel(planilha, registros.order_by("criado_em", "pk"), filename)
