# Entrega do chatbot — versão de trabalho

Este documento reúne o mapa de conversação, o planejamento de testes e o texto-base revisado do relatório extensionista para a entrega de 04/11/2026. A proposta parte do relatório fornecido sobre a May Artes 3D.

## 1. Mapa de conversação

```text
INÍCIO
  └─ Assistente: apresenta-se e mostra o menu
      ├─ Criar uma nova planilha
      │   └─ Escolher tema no SQLite: Pedido | Venda | Produto | Estoque | Evento
      │       └─ Informar nome da planilha
      │           └─ Responder perguntas para o primeiro registro
      │               └─ Revisar e confirmar → criar planilha e salvar primeiro registro
      │                   ├─ Adicionar outro registro → repetir perguntas para o mesmo tema
      │                   └─ Finalizar → mostrar botão para baixar Excel
      ├─ Editar uma planilha existente
      │   └─ Escolher planilha salva
      │       ├─ Adicionar registro → perguntar campos do tema
      │       ├─ Editar registro → escolher uma linha e revisar seus campos
      │       └─ Finalizar → baixar Excel atualizado
      ├─ Em cada resposta
      │   ├─ Campo inválido/incompleto → mostrar erro e pedir novamente
      │   ├─ Confirmar → validar e salvar no SQLite
      │   └─ Cancelar → descartar respostas da edição atual
      ├─ Ver registros recentes
      │   └─ Mostrar orientação; registros aparecem na lista da página
      └─ Como funciona?
          └─ Explicar as etapas e voltar ao menu
```

| Etapa | Pergunta ou resposta | Regra / próximo caminho |
|---|---|---|
| Boas-vindas | Mensagem obtida do SQLite. | Apresenta criar planilha, consultar histórico ou ajuda. |
| Seleção de tema | Pedidos, Vendas, Produtos, Estoque ou Eventos, obtidos do SQLite. | Carrega as perguntas cadastradas para o tema selecionado e permite nomear a planilha. |
| Perguntas | Campos e tipos de resposta definidos no banco. | Perguntas variam por tema; números, datas e opções são validados. |
| Revisão | Resumo com os dados respondidos. | Confirma para salvar ou cancela sem gravar. |
| Continuação | “Adicionar outro registro” ou “Finalizar e baixar a planilha”. | O usuário pode repetir o conjunto de perguntas; cada resposta confirmada acrescenta uma linha à mesma planilha. |
| Edição | Escolher uma planilha salva; depois adicionar uma linha ou escolher uma linha para editar. | Os valores atuais são apresentados como respostas iniciais; a confirmação atualiza a linha existente. |
| Conclusão | Botão “Baixar planilha Excel”. | Django consulta os registros vinculados àquela planilha e gera um `.xlsx` atualizado. |
| Planilha | Nome, tema e registros ficam vinculados no SQLite. | Planilhas diferentes, inclusive do mesmo tema, mantêm seus registros separados. |
| Erro | Mensagens de validação configuradas no SQLite. | Permite corrigir o campo ou tentar novamente. |
| Consulta e ajuda | Histórico recente ou explicação do fluxo. | Retorna ao menu principal. |

As perguntas e mensagens ficam nas tabelas `PerguntaBot` e `MensagemBot`; temas e opções também são carregados do SQLite. A tabela `Planilha` guarda o nome e o tema de cada planilha. Cada linha/resposta fica em `RegistroConversa`, relacionada a uma planilha. O chatbot funciona por regras; não há uso de IA generativa. A interface orienta o usuário a não inserir senhas, dados de pagamento ou dados pessoais de clientes.

### Perguntas cadastradas por tema

| Tema | Campos perguntados na conversa |
|---|---|
| Pedidos | Produto, quantidade, data do pedido e status. |
| Vendas | Produto, quantidade, valor total e data da venda. |
| Produtos | Nome, descrição e preço. |
| Estoque | Produto, quantidade, tipo de movimentação e data. |
| Eventos | Nome, data, local e status. |

## 2. Plano de testes

Os testes automatizados estão em `home/tests.py` e podem ser executados com `python manage.py test home`.

| ID | Cenário | Resultado esperado |
|---|---|---|
| T01 | Abrir a página inicial | Resposta HTTP 200 e carregamento do ponto de montagem do chatbot. |
| T02 | Consultar o roteiro | Temas, perguntas e mensagens são retornados pelo banco, incluindo Eventos. |
| T03 | Editar uma pergunta no banco e consultar o roteiro | API retorna o novo texto, sem alterar JavaScript. |
| T04 | Criar uma planilha de Eventos com primeiro registro | Resposta HTTP 201 e planilha e linha persistidas no SQLite. |
| T05 | Enviar resposta vazia, data inválida, opção inválida ou número negativo | Resposta HTTP 400 e nenhuma conversa gravada. |
| T06 | Adicionar vários registros a uma planilha | Registros ficam no mesmo arquivo e são exportados em linhas separadas. |
| T07 | Editar um registro existente e baixar a planilha | A linha é atualizada no SQLite e o Excel baixado reflete a alteração. |
| T08 | Baixar a planilha Excel de Eventos | Arquivo `.xlsx` abre, tem cabeçalhos, data tipada e somente os registros da planilha selecionada. |
| T09 | Criar duas planilhas diferentes com o mesmo tema | Cada arquivo contém apenas as linhas da planilha correspondente. |
| T10 | Enviar JSON malformado ou campos extras | Resposta HTTP 400 e nenhum registro é criado. |
| T11 | Enviar POST sem token CSRF | Resposta HTTP 403 e nenhum registro é criado. |
| T12 | Usar métodos HTTP não permitidos | Resposta HTTP 405 nos endpoints. |
| T13 | Percorrer a conversa, adicionar linhas e editar uma existente | A lista e o download refletem as alterações, sem misturar outras planilhas. |
| T14 | Abrir em tela estreita e navegar usando teclado | Conteúdo permanece legível e opções podem ser acionadas sem mouse. |

T01–T12 são cobertos pelo Django TestCase. T13–T14 são verificações manuais de interface; devem ser executadas pelo grupo antes da apresentação e seus resultados anotados.

## 3. Segunda versão do relatório extensionista — texto-base revisado

### 3.1 Contextualização e problema identificado

A empresa parceira deste projeto é a May Artes 3D, empreendimento de produção e comercialização de peças impressas em 3D, com produtos relacionados a universos geek, gamer e otaku. O relatório de referência descreve divulgação por canais digitais e comercialização de peças colecionáveis.

O problema identificado está na dependência de processos manuais e descentralizados para registrar e organizar informações operacionais em planilhas. A ausência de um fluxo padronizado de preenchimento pode gerar campos incompletos, diferenças de formato, erros de digitação e retrabalho na conferência dos dados. Essas dificuldades afetam a organização das informações sobre atividades como pedidos, vendas, produtos e estoque.

### 3.2 Objetivo

Desenvolver e testar um chatbot baseado em regras que oriente o registro de informações operacionais, valide os dados essenciais e os armazene de forma estruturada. A proposta busca facilitar o preenchimento, reduzir inconsistências e apoiar a organização dos dados utilizados pela empresa parceira.

### 3.3 Solução proposta e mapa de conversa

A solução é uma aplicação web simples. O colaborador cria uma planilha nomeada e escolhe seu tema. Cada rodada de perguntas gera um registro; após salvar uma linha, pode adicionar outra à mesma planilha ou finalizar. Também pode selecionar uma planilha salva para adicionar registros ou escolher uma linha e atualizá-la. O botão final solicita ao Django a geração, em Python com openpyxl, do arquivo `.xlsx` daquela planilha.

O chatbot utiliza opções predefinidas e regras de validação; não utiliza inteligência artificial. O texto das perguntas e das mensagens do bot não fica fixo no JavaScript: o Django o consulta no SQLite e entrega o roteiro à interface. O mapa detalhado e as respostas condicionais estão na seção 1 deste documento.

### 3.4 Tecnologias e arquitetura

O navegador apresenta HTML e CSS, enquanto o JavaScript obtém o roteiro e as planilhas existentes pelo Django, apresenta perguntas e envia as respostas. O Django valida e salva ou atualiza registros vinculados a uma planilha no SQLite. Ao baixar, o Django lê somente as linhas daquela planilha e gera o arquivo Excel usando Python e openpyxl. Não foi necessário adicionar pandas: para este fluxo simples, o ORM do Django consulta o SQLite e o openpyxl grava diretamente as células do arquivo. O caminho implementado é:

```text
Perguntas/mensagens SQLite → Django → JavaScript/HTML → respostas do colaborador
Planilha + registros → SQLite → Django/Python/openpyxl → download Excel atualizado
```

Nesta etapa, o protótipo funciona localmente. O Excel é criado para download; integração com nuvem, sincronização automática com planilhas externas, autenticação de usuários e uso em produção não fazem parte do que foi implementado.

### 3.5 Testes e validação

O plano inclui testes automatizados para o roteiro lido do SQLite, alteração de perguntas, persistência de respostas, validações e geração do arquivo Excel. Também prevê verificações manuais do fluxo de confirmação e cancelamento, download, responsividade e navegação por teclado. Os resultados devem ser registrados após a execução; não são apresentados aqui como se já tivessem sido obtidos.

### 3.6 Resultados esperados e próximos passos

Espera-se que o fluxo guiado facilite a padronização dos registros e reduza erros de preenchimento. Esses benefícios ainda precisam ser avaliados com usuários e comparados ao processo atual; não se afirma que erros serão eliminados nem que houve ganho quantitativo sem medição.

Como próximos passos, recomenda-se demonstrar o protótipo à empresa parceira, confirmar quais campos são realmente necessários por categoria, executar os testes manuais, coletar feedback e só então avaliar exportação de planilhas ou integração com serviços em nuvem.

### 3.7 Informações a confirmar pelo grupo

O documento de referência não fornece todos os dados administrativos e evidências finais. Antes de entregar a versão institucional do relatório, o grupo deve confirmar a denominação da instituição conforme o modelo do professor, nomes e responsabilidades dos integrantes, datas do projeto, autorização para identificação da empresa e os resultados observados nos testes. Não incluir CPF, senhas ou outros dados pessoais sem necessidade e autorização.
