# Como criar o projeto do zero

Este passo a passo mostra como montar uma aplicação semelhante a este projeto, começando por uma pasta vazia. Ele explica a ordem de trabalho e aponta os arquivos que precisam ser criados ou configurados. Os comandos foram escritos para Windows e PowerShell.

O resultado é uma aplicação Django local que apresenta um chatbot com perguntas configuráveis, salva respostas no SQLite e gera arquivos Excel. A edição de arquivos `.xlsx` externos é apresentada como uma etapa adicional.

> Este guia usa os nomes e as versões deste repositório como referência. Ao iniciar outro projeto, troque `gerador_planilhas` e `home` pelos nomes escolhidos por você.

## 1. Preparar o computador

Instale uma versão do Python compatível com a versão do Django escolhida. Depois, abra o PowerShell e confirme que o Python e o pip estão disponíveis:

```powershell
python --version
python -m pip --version
```

Se `python` não for reconhecido, instale o Python e habilite a opção que o adiciona ao `PATH`, ou use o comando `py` do inicializador do Windows.

## 2. Criar a pasta e o ambiente virtual

Escolha onde ficará o código. Os comandos abaixo criam uma pasta nova e um ambiente virtual isolado para as bibliotecas do projeto:

```powershell
mkdir gerador_planilhas
Set-Location gerador_planilhas
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Se o PowerShell bloquear a ativação do ambiente, permita scripts somente nesta janela e tente novamente:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

Quando o ambiente estiver ativo, o nome `venv` costuma aparecer no início da linha de comando. Para sair dele mais tarde, use `deactivate`.

## 3. Instalar as bibliotecas e criar o esqueleto Django

Este projeto usa Django para o site e as APIs, e `openpyxl` para ler e escrever arquivos Excel:

```powershell
python -m pip install Django==6.1.1 openpyxl==3.1.5
django-admin startproject gerador_planilhas .
python manage.py startapp home
```

O ponto no final de `startproject gerador_planilhas .` pede ao Django que crie o projeto dentro da pasta atual. Sem ele, o Django criaria outra pasta aninhada.

Registre as dependências para que outra pessoa possa recriar o ambiente:

```powershell
@'
Django==6.1.1
openpyxl==3.1.5
'@ | Out-File -Encoding ascii requirements.txt
```

O esqueleto inicial deve conter, entre outros:

```text
gerador_planilhas/
├── manage.py
├── requirements.txt
├── gerador_planilhas/
│   ├── settings.py
│   └── urls.py
└── home/
    ├── admin.py
    ├── apps.py
    ├── models.py
    ├── tests.py
    └── views.py
```

## 4. Configurar o Django

Abra `gerador_planilhas/settings.py` e faça as configurações da aplicação:

1. Adicione `'home'` a `INSTALLED_APPS`.
2. Confirme que o banco padrão usa SQLite. A configuração inicial do Django já usa `db.sqlite3`.
3. Configure `LANGUAGE_CODE` e `TIME_ZONE` para a localidade desejada.
4. Configure os diretórios de templates e arquivos estáticos conforme a estrutura que escolher.

Neste repositório, os templates ficam em `home/templates/` e os arquivos estáticos compartilhados em `templates/static/`. Como os arquivos estáticos ficam fora do app, `settings.py` precisa apontar para essa pasta em `STATICFILES_DIRS`. Escolha uma estrutura e mantenha os caminhos coerentes entre configuração, template e disco.

Não publique o projeto usando as configurações locais de desenvolvimento: `DEBUG`, chave secreta, hosts, HTTPS e banco de produção precisam ser configurados com segurança antes da hospedagem. Não envie uma chave secreta real para o Git.

## 5. Criar os modelos de dados

Desenhe as entidades antes de programar as telas. Para reproduzir a organização deste projeto, os modelos principais são:

| Modelo | O que representa |
|---|---|
| `TemaBot` | Um tema do chatbot, como pedidos, vendas ou estoque. |
| `PerguntaBot` | Uma pergunta ordenada que pertence a um tema. Guarda a chave da resposta, o cabeçalho Excel, o tipo e as opções. |
| `MensagemBot` | Um texto da interface identificado por uma chave. |
| `Planilha` | Uma planilha nomeada que agrupa registros de um tema. |
| `RegistroConversa` | As respostas de uma conversa e suas ligações ao tema e, opcionalmente, à planilha. |

Abra `home/models.py` e defina os campos e relações usando `django.db.models`. Regras importantes do modelo existente:

- Uma pergunta aponta para um tema com `ForeignKey`; seu `related_name="perguntas"` permite consultar `tema.perguntas`.
- Cada registro guarda as respostas como objeto JSON em `JSONField`, por exemplo `{"produto": "Caneca", "quantidade": "2"}`.
- Restrições únicas impedem campos ou ordens repetidas dentro do mesmo tema.
- As opções de uma pergunta são uma lista JSON; uma lista vazia representa uma pergunta sem opções predefinidas.

Um primeiro modelo reduzido pode começar assim:

```python
from django.db import models


class TemaBot(models.Model):
    codigo = models.SlugField(max_length=30, unique=True)
    nome = models.CharField(max_length=80)
    ativo = models.BooleanField(default=True)


class PerguntaBot(models.Model):
    tema = models.ForeignKey(
        TemaBot,
        on_delete=models.CASCADE,
        related_name="perguntas",
    )
    campo = models.SlugField(max_length=40)
    pergunta = models.CharField(max_length=200)
    ordem = models.PositiveSmallIntegerField(default=0)


class RegistroConversa(models.Model):
    tema = models.ForeignKey(TemaBot, on_delete=models.PROTECT)
    respostas = models.JSONField()
    criado_em = models.DateTimeField(auto_now_add=True)
```

Esse exemplo mostra as ligações essenciais, mas ainda não inclui campos de opções, planilhas nomeadas, restrições únicas nem as regras completas deste projeto. Acrescente esses campos conforme o escopo que pretende implementar.

Depois de salvar os modelos, gere e aplique a primeira migração:

```powershell
python manage.py makemigrations home
python manage.py migrate
```

**Migração** é o arquivo que registra uma mudança de estrutura do banco. Sempre que mudar os modelos, gere uma nova migração com `makemigrations` e aplique-a com `migrate`; não edite manualmente o `db.sqlite3` para acompanhar uma alteração no código.

## 6. Cadastrar os temas e perguntas iniciais

Há duas formas comuns de começar:

- Cadastre os temas e as perguntas pelo Django Admin. É simples para testar, mas exige repetir o cadastro em cada banco novo.
- Crie uma migração de dados com `migrations.RunPython`. Assim, a configuração inicial é recriada ao preparar um banco novo.

Este repositório usa uma migração de dados em `home/migrations/0003_mensagembot_temabot_and_more.py`. A função `seed_chatbot()` cria temas, perguntas e mensagens. Ao iniciar um projeto diferente, **não copie esse arquivo de migração diretamente**: ele depende das migrações `home.0001` e `home.0002` e pressupõe que os modelos e campos estejam criados. Em vez disso, crie os modelos do seu projeto, gere as migrações estruturais e então crie uma migração de dados compatível com elas.

Para criar uma migração de dados nova depois da migração estrutural:

```powershell
python manage.py makemigrations home --empty --name seed_chatbot
```

No arquivo vazio criado em `home/migrations/`, adicione uma função que obtenha os modelos por `apps.get_model()` e uma operação `migrations.RunPython()`. Use os modelos históricos fornecidos por `apps`, em vez de importar diretamente as classes atuais de `home.models`:

```python
def seed_chatbot(apps, schema_editor):
    TemaBot = apps.get_model("home", "TemaBot")
    PerguntaBot = apps.get_model("home", "PerguntaBot")

    tema = TemaBot.objects.create(codigo="pedido", nome="Pedidos")
    PerguntaBot.objects.create(
        tema=tema,
        campo="produto",
        pergunta="Qual produto foi pedido?",
        ordem=0,
    )
```

Inclua `migrations.RunPython(seed_chatbot, migrations.RunPython.noop)` em `operations` da migração. Para apagar ou reverter esses dados de forma controlada, substitua `noop` por uma função reversa apropriada. Depois aplique a migração com `python manage.py migrate`.

Para administrar os modelos pelo painel, registre-os em `home/admin.py`:

```python
from django.contrib import admin

from .models import MensagemBot, PerguntaBot, Planilha, RegistroConversa, TemaBot

admin.site.register([TemaBot, PerguntaBot, MensagemBot, Planilha, RegistroConversa])
```

Crie um usuário administrador e inicie o servidor:

```powershell
python manage.py createsuperuser
python manage.py runserver
```

O painel administrativo fica em `http://127.0.0.1:8000/admin/`. Use-o para conferir se os modelos e os dados iniciais foram criados corretamente.

## 7. Ligar URLs às funções do servidor

O Django separa a lista de endereços da lógica que os atende:

1. Em `gerador_planilhas/urls.py`, mantenha o painel administrativo e inclua as rotas do app com `include("home.urls")`.
2. Crie `home/urls.py` e associe cada caminho a uma função de `home/views.py`.
3. Dê nomes às rotas. Use `reverse()` no servidor para obter os endereços sem repeti-los como texto em vários lugares.

O arquivo de rotas principal pode incluir o app assim:

```python
# gerador_planilhas/urls.py
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("home.urls")),
]
```

E o app associa endereços a funções:

```python
# home/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("api/roteiro/", views.roteiro_chatbot, name="roteiro_chatbot"),
]
```

Neste projeto, as rotas têm responsabilidades distintas: mostrar a página inicial, entregar o roteiro do chatbot, listar/consultar planilhas, criar/editar registros e baixar arquivos Excel. Ao adicionar uma funcionalidade, defina primeiro qual método HTTP ela precisa: `GET` para consultar, `POST` para criar ou enviar, e `PATCH` para alterar um registro existente.

## 8. Implementar as funções e regras no servidor

Em `home/views.py`, implemente as operações nessa ordem:

1. **Página inicial:** consulta dados para o histórico e renderiza `home.html`.
2. **Roteiro:** busca temas ativos, perguntas ordenadas e mensagens; devolve os dados em JSON.
3. **Validação:** confirma que as respostas pertencem ao tema, que campos obrigatórios estão preenchidos e que números, datas e opções são válidos.
4. **Gravação:** cria a planilha e seu primeiro registro ou adiciona/atualiza um registro numa planilha existente.
5. **Exportação:** carrega os registros da planilha, prepara o Excel em memória e responde com um arquivo para download.

Como primeiro endpoint, uma view de leitura pode consultar os temas e devolver JSON:

```python
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import TemaBot


@require_GET
def roteiro_chatbot(request):
    temas = TemaBot.objects.filter(ativo=True).order_by("nome")
    return JsonResponse({
        "temas": [
            {"codigo": tema.codigo, "nome": tema.nome}
            for tema in temas
        ]
    })
```

Depois, amplie o JSON para incluir as perguntas e mensagens e implemente endpoints separados para criar, consultar, editar e baixar. O exemplo é só o primeiro passo de leitura; ele não substitui a validação e as operações completas descritas acima.

Valide as entradas no servidor, mesmo que o navegador também valide. O JavaScript melhora a experiência, mas o servidor é responsável por proteger os dados e manter as regras consistentes. Para criar uma planilha e o primeiro registro como uma única operação, use `transaction.atomic()`: se uma etapa falhar, o banco não fica com apenas metade da operação gravada.

Use decoradores como `require_GET`, `require_POST` ou `require_http_methods` para limitar os métodos aceitos. Retorne erros com códigos HTTP adequados e uma mensagem clara; não trate uma gravação inválida como se tivesse dado certo.

## 9. Montar a página e a conversa

Crie o HTML da página em `home/templates/home.html`. Ele contém a estrutura visual e os elementos que o JavaScript atualiza. Coloque o estilo em um arquivo CSS e as interações em um arquivo JavaScript; carregar o JavaScript separado torna cada responsabilidade mais fácil de encontrar.

O fluxo do chatbot é:

```text
Banco de dados → API de roteiro → JavaScript mostra perguntas
Usuário responde → JavaScript envia JSON → view valida e grava
Banco de dados → view gera Excel → navegador baixa o arquivo
```

O JavaScript mantém as respostas durante a conversa num objeto indexado pelo campo de cada pergunta. Ao confirmar, envia o tema e as respostas à API. Ao editar, carrega as respostas existentes, permite a alteração e envia a atualização ao endpoint do registro.

Inclua o token CSRF nos formulários e nas requisições que alteram dados. Use o mecanismo do Django para emitir e validar esse token; não desative a proteção CSRF para facilitar uma chamada do frontend.

## 10. Criar o Excel do chatbot

Use `openpyxl` para escrever a pasta de trabalho. O fluxo recomendado é:

1. Criar um `Workbook` e selecionar a aba.
2. Usar os cabeçalhos configurados nas perguntas.
3. Escrever uma linha para cada registro salvo.
4. Converter números e datas para tipos reconhecidos pelo Excel quando aplicável.
5. Aplicar formatação básica e ajustar as colunas.
6. Salvar em `BytesIO` e devolver a resposta como anexo para download.

Gerar o arquivo em memória evita criar arquivos temporários no servidor. Defina um nome de arquivo seguro e o tipo MIME correto. Teste os valores e os tipos das células abrindo o conteúdo baixado com `openpyxl`, não apenas verificando se a resposta HTTP foi bem-sucedida.

## 11. Adicionar a edição de planilhas externas (opcional)

Esta parte é independente do chatbot e pode ser feita depois que criar e exportar uma planilha do próprio app.

1. No HTML, crie um formulário de upload para arquivos `.xlsx`.
2. No servidor, valide a presença, extensão, tamanho e conteúdo do arquivo antes de abrir com `openpyxl`.
3. Devolva nomes das abas e uma prévia dos valores para o navegador.
4. Mostre as células numa grade editável; guarde as alterações com índices de linha/coluna.
5. Ao baixar, reenvie o arquivo e as alterações, aplique-as numa cópia em memória e devolva o Excel sem sobrescrever o original.

Valide os índices e limite os valores recebidos. Texto digitado pelo usuário que comece com `=` deve continuar texto, não virar uma fórmula executável. Este projeto implementa o download do arquivo enviado por um formulário POST para um iframe oculto, evitando depender da criação de um download a partir de uma resposta `fetch`.

## 12. Criar testes e verificar o projeto

Adicione testes em `home/tests.py` à medida que cada fluxo ficar pronto. Cubra pelo menos:

- Roteiro retornado pela API.
- Campos obrigatórios, opções, números e datas inválidos.
- Criação, consulta e edição de registros.
- Exportação Excel e conteúdo das células.
- Upload inválido e alterações fora do limite no editor externo, se ele for implementado.

Execute os testes e as verificações básicas no PowerShell:

```powershell
python manage.py check
python manage.py test home
```

Se os modelos mudaram, confirme também que não há migrações pendentes:

```powershell
python manage.py makemigrations --check --dry-run
```

## 13. Recriar o ambiente a partir dos arquivos do projeto

Depois da configuração inicial, outra pessoa pode preparar o ambiente local com:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

As migrações recriam as tabelas e, quando há uma migração de dados corretamente configurada, também o roteiro inicial. O banco `db.sqlite3` local e a pasta `venv` não substituem o código e não devem ser usados como única forma de compartilhar o projeto.

## 14. Ordem resumida de construção

```text
Ambiente Python
    ↓
Projeto Django e app home
    ↓
Configurações, modelos e migrações
    ↓
Temas/perguntas iniciais e painel admin
    ↓
URLs e APIs do servidor
    ↓
Página HTML, CSS e JavaScript
    ↓
Validação, persistência e exportação Excel
    ↓
Testes e verificação final
    ↓
Editor de arquivos externos (opcional)
```

## Referência ao código deste projeto

O passo a passo descreve a ordem de construção. Para consultar como as partes já implementadas se relacionam, veja o [guia técnico](./guia-tecnico.md). Os principais pontos de partida no código são `home/models.py`, `home/migrations/`, `home/urls.py`, `home/views.py`, `home/templates/home.html`, `templates/static/home/js/home.js`, `templates/static/home/css/home.css` e `home/tests.py`.
