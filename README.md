# Chatbot e planilhas da May Artes 3D

Protótipo acadêmico de chatbot que conduz o usuário por perguntas armazenadas no SQLite. O usuário pode criar uma planilha por tema, adicionar quantos registros precisar, selecionar planilhas já criadas para acrescentar ou editar registros e baixar o Excel atualizado. Cada planilha contém registros de um tema — pedidos, vendas, produtos, estoque ou eventos — e é gerada em Python quando solicitada.

> Esta entrega é uma demonstração local. Ela não usa serviços em nuvem nem inteligência artificial.
> Não é necessário usar pandas: o Django já organiza os dados e o openpyxl cria e atualiza o Excel diretamente.

## Tecnologias

- Python e Django: páginas, validações e gravação dos registros.
- SQLite: perguntas, mensagens do chatbot, temas e respostas (`db.sqlite3`).
- openpyxl: geração de arquivos `.xlsx`.
- HTML e CSS: estrutura e apresentação responsiva.
- JavaScript: apresenta as perguntas e conduz as etapas conforme roteiro enviado pelo Django.

## Executar no Windows

No PowerShell, na pasta do projeto:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Abra `http://127.0.0.1:8000/` no navegador.

As perguntas e mensagens podem ser atualizadas no Django Admin, em `http://127.0.0.1:8000/admin/`, nos cadastros **Temas do chatbot**, **Perguntas do chatbot** e **Mensagens do chatbot**. O roteiro inicial é carregado no SQLite pelas migrações.

## Testes automatizados

```powershell
python manage.py test home
```

Os testes verificam o roteiro no SQLite, validação das respostas, criação de planilhas, inclusão e edição de vários registros e o conteúdo dos arquivos Excel baixados.

## Estrutura principal

```text
gerador_planilhas/        Configuração e rotas do Django
home/                     Aplicação, roteiro/modelos, views, testes e template
home/migrations/          Estrutura e conteúdo inicial do roteiro SQLite
templates/static/home/    CSS e JavaScript
docs/entrega.md           Mapa, plano de testes e texto-base do relatório
db.sqlite3                Banco local criado pelo Django
```

## Documentação da entrega

O mapa atualizado da conversa, o plano de testes e a segunda versão de trabalho do relatório estão em [docs/entrega.md](docs/entrega.md). Antes de entregar o relatório, o grupo deve confirmar os dados acadêmicos que não constam no documento fornecido e atualizar os resultados após executar os testes.
