// Referências à interface, ao token CSRF e à configuração fornecida pelo Django.
const messages = document.querySelector("#chat-messages");
const controls = document.querySelector("#chat-controls");
const statusMessage = document.querySelector("#chat-status");
const recordsList = document.querySelector("#records-list");
const recordsCount = document.querySelector("#records-count");
const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
const config = JSON.parse(document.querySelector("#chatbot-config").textContent);

// Controles e estado da edição local de arquivos Excel externos.
const externalUploadForm = document.querySelector("#external-upload-form");
const externalWorkbookInput = document.querySelector("#external-workbook");
const externalChangesInput = document.querySelector("#external-changes");
const externalSheetPicker = document.querySelector("#external-sheet-picker");
const externalSheetSelect = document.querySelector("#external-sheet");
const externalLoadSheetButton = document.querySelector("#external-load-sheet");
const externalEditor = document.querySelector("#external-editor");
const externalEditorStatus = document.querySelector("#external-editor-status");
const externalSheetTitle = document.querySelector("#external-sheet-title");
const externalGrid = document.querySelector("#external-grid");
const externalDownloadButton = document.querySelector("#external-download");
const externalDownloadFrame = document.querySelector(".download-frame");

// Estado da conversa atual: roteiro, planilha, tema, respostas e edição em curso.
let script;
let currentSheet;
let selectedTheme;
let currentMode;
let selectedRecord;
let questionIndex = 0;
let answers = {};
let externalRows = [];
let externalChanges = new Map();

function addMessage(text, sender = "bot") {
    // Cria uma mensagem textual e mantém a conversa rolada até a última resposta.
    const bubble = document.createElement("p");
    bubble.className = `message message-${sender}`;
    bubble.textContent = text;
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
}

function clearControls() {
    // Remove os controles de interação anteriores e limpa avisos de validação.
    controls.replaceChildren();
    statusMessage.textContent = "";
}

function showChoices(choices) {
    // Renderiza botões de escolha e chama a ação associada a cada opção.
    clearControls();
    const group = document.createElement("div");
    group.className = "choice-list";

    choices.forEach(({ label, onSelect, secondary = false, href, external = false }) => {
        const choice = document.createElement(href ? "a" : "button");
        choice.className = secondary ? "choice-button choice-secondary" : "choice-button";
        choice.textContent = label;
        if (href) {
            choice.href = href;
            if (external) {
                choice.target = "_blank";
                choice.rel = "noopener noreferrer";
            }
        } else {
            choice.type = "button";
            choice.addEventListener("click", () => {
                group.remove();
                onSelect();
            });
        }
        group.append(choice);
    });

    controls.append(group);
}

function showDownloadLink(url, label) {
    // Adiciona à área de ações um link para baixar a planilha gerada.
    const link = document.createElement("a");
    link.className = "choice-button download-button";
    link.href = url;
    link.textContent = label;
    controls.append(link);
}

async function requestJson(url, method = "GET", data = null) {
    // Centraliza chamadas JSON, CSRF nas gravações e conversão de erros da API.
    const options = { method, headers: {} };
    if (data !== null) {
        options.headers["Content-Type"] = "application/json";
        options.headers["X-CSRFToken"] = csrfToken;
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.erro || script.mensagens.erro_salvamento);
    }
    return result;
}

function showMenu() {
    // Reinicia o estado local e apresenta as opções principais da conversa.
    currentSheet = null;
    selectedTheme = null;
    currentMode = null;
    selectedRecord = null;
    answers = {};
    showChoices([
        { label: "Quem somos", onSelect: showCompanyMenu },
        { label: script.mensagens.iniciar_registro, onSelect: chooseTheme },
        { label: "Contato", onSelect: showContact },
        { label: "Mais opções", onSelect: showMoreOptions, secondary: true },
    ]);
}

function footerText(selector) {
    return document.querySelector(selector).textContent.trim();
}

function showCompanyMenu() {
    addMessage("Quem somos", "user");
    addMessage("Sobre a May Artes 3D, escolha uma opção:");
    showChoices([
        { label: "Institucional", onSelect: showInstitutional },
        { label: "O que fazemos", onSelect: showWhatWeDo },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function showInstitutional() {
    addMessage("Institucional", "user");
    addMessage(footerText("#footer-company-description"));
    addMessage([
        `Razão social: ${footerText("#footer-company-legal-name")}`,
        `CNPJ: ${footerText("#footer-company-cnpj")}`,
        `Representante: ${footerText("#footer-company-representative")}`,
        `CPF do representante: ${footerText("#footer-company-cpf")}`,
        `Endereço: ${footerText("#footer-company-address")}, ${footerText("#footer-company-city")}`,
    ].join("\n"));
    showChoices([
        { label: "O que fazemos", onSelect: showWhatWeDo },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function showWhatWeDo() {
    addMessage("O que fazemos", "user");
    addMessage(footerText("#footer-company-description"));
    showChoices([
        { label: "Ver produtos", href: "#produtos" },
        { label: script.mensagens.iniciar_registro, onSelect: chooseTheme, secondary: true },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function showContact() {
    addMessage("Contato", "user");
    addMessage([
        `Endereço: ${footerText("#footer-company-address")}`,
        footerText("#footer-company-city"),
        footerText("#footer-company-instagram"),
    ].join("\n"));
    showChoices([
        { label: "Abrir Instagram", href: document.querySelector("#footer-company-instagram").href, external: true },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function showMoreOptions() {
    addMessage("Mais opções", "user");
    addMessage("Escolha uma função:");
    showChoices([
        { label: script.mensagens.editar_planilha, onSelect: chooseExistingSheet },
        { label: script.mensagens.ver_historico, onSelect: showRecentSheets, secondary: true },
        { label: script.mensagens.como_funciona, onSelect: showHelp, secondary: true },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function chooseTheme() {
    // Exibe os temas disponíveis no roteiro e encaminha a escolha para nomeação.
    addMessage(script.mensagens.iniciar_registro, "user");
    addMessage(script.mensagens.escolher_tema);
    showChoices([
        ...script.temas.map((theme) => ({
            label: theme.nome,
            onSelect: () => askSheetName(theme),
        })),
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function askSheetName(theme) {
    // Solicita o nome da nova planilha antes de iniciar as perguntas do tema.
    selectedTheme = theme;
    addMessage(theme.nome, "user");
    addMessage(script.mensagens.pergunta_nome_planilha);
    clearControls();

    const form = document.createElement("form");
    form.className = "details-form";
    const label = document.createElement("label");
    label.htmlFor = "sheet-name";
    label.textContent = script.mensagens.nome_planilha;

    const input = document.createElement("input");
    input.id = "sheet-name";
    input.name = "nome";
    input.maxLength = 100;
    input.required = true;
    input.placeholder = theme.nome;

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "choice-button";
    submit.textContent = script.mensagens.continuar;

    form.append(label, input, submit);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) {
            statusMessage.textContent = script.mensagens.erro_nome_planilha;
            input.focus();
            return;
        }

        currentSheet = {
            id: null,
            nome: name,
            tema: theme.codigo,
            tema_nome: theme.nome,
            perguntas: theme.perguntas,
            registros: [],
        };
        beginEntry("new");
    });

    controls.append(form);
    input.focus();
}

async function chooseExistingSheet() {
    // Busca planilhas salvas e permite selecionar uma para consultar ou editar.
    addMessage(script.mensagens.editar_planilha, "user");
    addMessage(script.mensagens.escolher_planilha);
    clearControls();
    statusMessage.textContent = script.mensagens.carregando;

    try {
        const result = await requestJson(config.planilhas_url);
        if (!result.planilhas.length) {
            addMessage(script.mensagens.planilhas_vazias);
            showChoices([{ label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true }]);
            return;
        }

        showChoices([
            ...result.planilhas.map((sheet) => ({
                label: `${sheet.nome} · ${sheet.tema_nome} · ${sheet.quantidade} registro(s)`,
                onSelect: () => loadExistingSheet(sheet.id),
            })),
            { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
        ]);
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

async function loadExistingSheet(sheetId) {
    // Carrega perguntas e registros da planilha escolhida para a conversa.
    clearControls();
    statusMessage.textContent = script.mensagens.carregando;
    try {
        const result = await requestJson(`${config.planilhas_url}${sheetId}/`);
        currentSheet = result;
        selectedTheme = script.temas.find((theme) => theme.codigo === currentSheet.planilha.tema);
        addMessage(`${currentSheet.planilha.nome} · ${currentSheet.registros.length} registro(s)`, "user");
        showSheetOptions();
    } catch (error) {
        statusMessage.textContent = error.message;
        showChoices([{ label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true }]);
    }
}

function showSheetOptions() {
    // Mostra ações disponíveis para a planilha atualmente carregada.
    const sheet = currentSheet.planilha;
    const choices = [
        { label: script.mensagens.adicionar_registro, onSelect: () => beginEntry("add") },
    ];
    if (currentSheet.registros.length) {
        choices.push({
            label: script.mensagens.editar_registro,
            onSelect: chooseRecordToEdit,
            secondary: true,
        });
    }
    choices.push({
        label: script.mensagens.finalizar_planilha,
        onSelect: () => showCompletion(sheet.url, sheet.nome),
        secondary: true,
    });
    choices.push({
        label: script.mensagens.voltar_menu,
        onSelect: showMenu,
        secondary: true,
    });
    showChoices(choices);
}

function chooseRecordToEdit() {
    // Lista os registros atuais para que o usuário escolha qual alterar.
    addMessage(script.mensagens.escolher_registro);
    showChoices([
        ...currentSheet.registros.map((record, index) => ({
            label: `${index + 1}. ${record.resumo}`,
            onSelect: () => beginEntry("edit", record),
        })),
        { label: script.mensagens.voltar_planilhas, onSelect: showSheetOptions, secondary: true },
    ]);
}

function beginEntry(mode, record = null) {
    // Inicializa o preenchimento ou edição e prepara as respostas existentes.
    currentMode = mode;
    selectedRecord = record;
    questionIndex = 0;
    answers = record ? { ...record.respostas } : {};
    if (mode === "edit") {
        addMessage(`${script.mensagens.editar_registro}: ${record.resumo}`, "user");
    } else {
        addMessage(script.mensagens.adicionar_registro, "user");
    }
    askCurrentQuestion();
}

function askCurrentQuestion() {
    // Seleciona a pergunta atual ou avança para a confirmação das respostas.
    const question = currentSheet.perguntas[questionIndex];
    if (!question) {
        showReview();
        return;
    }

    addMessage(question.pergunta);
    showQuestionInput(question);
}

function showQuestionInput(question) {
    // Monta o campo de entrada adequado ao tipo e às opções da pergunta.
    clearControls();
    const form = document.createElement("form");
    form.className = "details-form";

    const label = document.createElement("label");
    const inputId = `resposta-${question.campo}`;
    label.htmlFor = inputId;
    label.textContent = question.cabecalho;

    let input;
    if (question.opcoes.length) {
        input = document.createElement("select");
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = script.mensagens.selecionar_opcao;
        input.append(placeholder);

        question.opcoes.forEach((optionText) => {
            const option = document.createElement("option");
            option.value = optionText;
            option.textContent = optionText;
            input.append(option);
        });
    } else {
        input = document.createElement("input");
        input.type = question.tipo;
        if (question.tipo === "text") {
            input.maxLength = 300;
        }
        if (question.tipo === "number") {
            input.min = "0";
            input.max = "999999999.99";
            input.step = "any";
        }
    }
    input.id = inputId;
    input.name = question.campo;
    input.required = question.obrigatoria;
    input.value = answers[question.campo] || "";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "choice-button";
    submit.textContent = script.mensagens.continuar;

    form.append(label, input, submit);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const answer = input.value.trim();
        if (!answer && question.obrigatoria) {
            statusMessage.textContent = script.mensagens.erro_resposta;
            input.focus();
            return;
        }

        answers[question.campo] = answer;
        addMessage(answer || script.mensagens.nao_informado, "user");
        questionIndex += 1;
        askCurrentQuestion();
    });

    controls.append(form);
    input.focus();
}

function showReview() {
    // Resume as respostas e solicita confirmação antes de persistir os dados.
    currentSheet.perguntas.forEach((question) => {
        addMessage(`${question.cabecalho}: ${answers[question.campo] || script.mensagens.nao_informado}`, "user");
    });
    addMessage(script.mensagens.confirmar_registro);
    showChoices([
        { label: script.mensagens.confirmar, onSelect: saveEntry },
        { label: script.mensagens.cancelar, onSelect: cancelEntry, secondary: true },
    ]);
}

async function saveEntry() {
    // Envia criação, adição ou edição ao endpoint e sincroniza o estado da tela.
    addMessage(script.mensagens.confirmar, "user");
    clearControls();
    statusMessage.textContent = script.mensagens.salvando;

    let url = config.criar_planilha_url;
    let method = "POST";
    const data = { respostas: answers };
    if (currentMode === "new") {
        data.tema = currentSheet.tema;
        data.nome = currentSheet.nome;
    } else if (currentMode === "add") {
        url = `${config.planilhas_url}${currentSheet.planilha.id}/registros/`;
    } else {
        url = `${config.planilhas_url}${currentSheet.planilha.id}/registros/${selectedRecord.id}/`;
        method = "PATCH";
    }

    try {
        const result = await requestJson(url, method, data);
        statusMessage.textContent = "";
        addMessage(result.mensagem);
        currentSheet.planilha = result.planilha;
        if (currentMode === "edit") {
            currentSheet.registros = currentSheet.registros.map((record) =>
                record.id === result.registro.id ? result.registro : record,
            );
        } else {
            currentSheet.registros.push(result.registro);
        }
        addRecordToList({
            planilha_id: result.planilha.id,
            tema: result.planilha.tema_nome,
            resumo: `${result.planilha.nome} · ${result.planilha.quantidade} registro(s)`,
            criado_em: result.planilha.atualizada_em,
        });
        if (currentMode === "edit") {
            showUpdatedRecordOptions(result);
        } else {
            currentMode = "add";
            showAddAnotherOptions(result);
        }
    } catch (error) {
        statusMessage.textContent = error.message || script.mensagens.erro_salvamento;
        showChoices([
            { label: script.mensagens.confirmar, onSelect: saveEntry },
            { label: script.mensagens.cancelar, onSelect: cancelEntry, secondary: true },
        ]);
    }
}

function showAddAnotherOptions(result) {
    // Oferece adicionar outro registro, baixar ou voltar após um salvamento.
    clearControls();
    showChoices([
        { label: result.mensagem_adicionar, onSelect: () => beginEntry("add") },
        {
            label: script.mensagens.finalizar_planilha,
            onSelect: () => showCompletion(result.download_url, result.planilha.nome),
            secondary: true,
        },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function showUpdatedRecordOptions(result) {
    // Oferece editar outra linha ou concluir após a atualização de um registro.
    clearControls();
    showChoices([
        { label: result.mensagem_editar_linha, onSelect: chooseRecordToEdit },
        {
            label: script.mensagens.finalizar_planilha,
            onSelect: () => showCompletion(result.download_url, result.planilha.nome),
            secondary: true,
        },
        { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
    ]);
}

function showCompletion(url, sheetName) {
    // Informa que a planilha está pronta e apresenta o link de download.
    addMessage(`${script.mensagens.planilha_pronta}: ${sheetName}`);
    clearControls();
    showChoices([
        { label: script.mensagens.continuar_planilha, onSelect: showSheetOptions, secondary: true },
        { label: script.mensagens.iniciar_registro, onSelect: showMenu, secondary: true },
    ]);
    showDownloadLink(url, script.mensagens.download_planilha);
}

function addRecordToList(record) {
    // Atualiza o histórico local e limita a lista visual aos dez itens recentes.
    const emptyState = recordsList.querySelector(".empty-records");
    if (emptyState) {
        emptyState.remove();
    }

    let item = record.planilha_id
        ? recordsList.querySelector(`[data-planilha-id="${record.planilha_id}"]`)?.closest(".record-item")
        : null;
    if (!item) {
        item = document.createElement("article");
        item.className = "record-item";
        recordsList.prepend(item);
    }
    if (record.planilha_id) {
        item.dataset.planilhaId = record.planilha_id;
    }

    const theme = document.createElement("span");
    theme.className = "record-category";
    theme.textContent = record.tema;

    const summary = document.createElement("p");
    summary.textContent = record.resumo;

    const createdAt = document.createElement("time");
    createdAt.textContent = record.criado_em;

    item.replaceChildren(theme, summary, createdAt);

    const allRecords = recordsList.querySelectorAll(".record-item");
    allRecords.forEach((recordItem, index) => {
        if (index >= 10) {
            recordItem.remove();
        }
    });
    recordsCount.textContent = `${Math.min(allRecords.length, 10)} de 10`;
}

function cancelEntry() {
    // Cancela somente a etapa atual e retorna às opções da planilha ou ao menu.
    addMessage(script.mensagens.cancelar, "user");
    addMessage(script.mensagens.conversa_cancelada);
    if (currentSheet && currentSheet.planilha?.id) {
        showSheetOptions();
    } else if (currentSheet && currentSheet.id) {
        showSheetOptions();
    } else {
        showMenu();
    }
}

async function showRecentSheets() {
    // Busca planilhas salvas e as apresenta como histórico navegável.
    addMessage(script.mensagens.ver_historico, "user");
    clearControls();
    try {
        const result = await requestJson(config.planilhas_url);
        addMessage(result.planilhas.length ? script.mensagens.historico_com_registros : script.mensagens.historico_vazio);
        showChoices(result.planilhas.map((sheet) => ({
            label: `${sheet.nome} · ${sheet.tema_nome} · ${sheet.quantidade} registro(s)`,
            onSelect: () => loadExistingSheet(sheet.id),
        })).concat([
            { label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true },
        ]));
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

function showHelp() {
    // Apresenta instruções curtas e oferece retorno ao menu principal.
    addMessage(script.mensagens.como_funciona, "user");
    addMessage(script.mensagens.menu_ajuda);
    showChoices([{ label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true }]);
}

async function initializeChatbot() {
    // Carrega o roteiro do servidor e inicia a primeira interação do assistente.
    try {
        const response = await fetch(config.roteiro_url);
        if (!response.ok) {
            throw new Error();
        }
        script = await response.json();
        addMessage(script.mensagens.boas_vindas);
        addMessage("Escolha uma opção para saber mais sobre a empresa ou organizar suas planilhas.");
        showMenu();
    } catch {
        statusMessage.textContent = "Não foi possível carregar o roteiro do chatbot.";
    }
}

function initializeExternalEditor() {
    externalWorkbookInput.addEventListener("change", () => {
        externalSheetPicker.hidden = true;
        externalEditor.hidden = true;
        externalEditorStatus.textContent = "";
        externalGrid.replaceChildren();
        externalRows = [];
        externalChanges.clear();
    });

    externalUploadForm.addEventListener("submit", (event) => {
        event.preventDefault();
        loadExternalWorkbook();
    });
    externalLoadSheetButton.addEventListener("click", loadExternalWorkbook);
    externalDownloadButton.addEventListener("click", downloadExternalWorkbook);
    externalDownloadFrame.addEventListener("load", showExternalDownloadError);
}

function externalWorkbookFormData(includeChanges = false) {
    // Reenvia o arquivo original junto à aba e, ao exportar, somente células alteradas.
    const formData = new FormData();
    formData.append("arquivo", externalWorkbookInput.files[0]);
    if (!externalSheetPicker.hidden && externalSheetSelect.value) {
        formData.append("aba", externalSheetSelect.value);
    }
    if (includeChanges) {
        formData.append("alteracoes", JSON.stringify([...externalChanges.values()]));
    }
    return formData;
}

async function externalRequest(formData) {
    // Usa multipart/form-data para o arquivo e CSRF para proteger a requisição POST.
    const response = await fetch(config.editar_planilha_externa_url, {
        method: "POST",
        headers: { "X-CSRFToken": csrfToken },
        body: formData,
    });
    if (!response.ok) {
        let message = "Não foi possível processar a planilha.";
        try {
            const result = await response.json();
            message = result.erro || message;
        } catch {
            // Mantém uma mensagem legível quando o servidor retorna erro sem JSON.
        }
        throw new Error(message);
    }
    return response;
}

async function loadExternalWorkbook() {
    if (!externalWorkbookInput.files.length) {
        externalEditorStatus.textContent = "Selecione um arquivo .xlsx primeiro.";
        return;
    }

    externalEditorStatus.textContent = "Carregando planilha...";
    externalLoadSheetButton.disabled = true;
    externalUploadForm.querySelector('button[type="submit"]').disabled = true;
    try {
        // A resposta JSON contém as abas, a aba ativa e os valores preparados para edição.
        const response = await externalRequest(externalWorkbookFormData());
        const result = await response.json();
        externalSheetSelect.replaceChildren();
        result.abas.forEach((sheetName) => {
            const option = document.createElement("option");
            option.value = sheetName;
            option.textContent = sheetName;
            externalSheetSelect.append(option);
        });
        externalSheetSelect.value = result.aba;
        externalSheetPicker.hidden = false;
        renderExternalGrid(result);
        externalEditorStatus.textContent = "Edite as células desejadas e baixe uma cópia quando terminar.";
    } catch (error) {
        externalEditor.hidden = true;
        externalEditorStatus.textContent = error.message;
    } finally {
        externalLoadSheetButton.disabled = false;
        externalUploadForm.querySelector('button[type="submit"]').disabled = false;
    }
}

function renderExternalGrid(sheet) {
    // Registra só diferenças em relação à prévia, reduzindo o tamanho do envio final.
    externalRows = sheet.linhas;
    externalChanges.clear();
    externalSheetTitle.textContent = `Aba: ${sheet.aba}`;
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const rowHeading = document.createElement("th");
    rowHeading.scope = "col";
    rowHeading.textContent = "Linha";
    headerRow.append(rowHeading);
    sheet.colunas.forEach((column) => {
        const heading = document.createElement("th");
        heading.scope = "col";
        heading.textContent = column;
        headerRow.append(heading);
    });
    head.append(headerRow);
    table.append(head);

    const body = document.createElement("tbody");
    sheet.linhas.forEach((row, rowIndex) => {
        const tableRow = document.createElement("tr");
        const rowHeading = document.createElement("th");
        rowHeading.scope = "row";
        rowHeading.textContent = String(rowIndex + 1);
        tableRow.append(rowHeading);

        row.forEach((value, columnIndex) => {
            const cell = document.createElement("td");
            const input = document.createElement("input");
            input.type = "text";
            input.maxLength = 32767;
            input.value = value;
            input.setAttribute("aria-label", `Célula ${sheet.colunas[columnIndex]}${rowIndex + 1}`);
            input.addEventListener("input", () => {
                const key = `${rowIndex + 1}:${columnIndex + 1}`;
                if (input.value === externalRows[rowIndex][columnIndex]) {
                    externalChanges.delete(key);
                } else {
                    externalChanges.set(key, {
                        linha: rowIndex + 1,
                        coluna: columnIndex + 1,
                        valor: input.value,
                    });
                }
            });
            cell.append(input);
            tableRow.append(cell);
        });
        body.append(tableRow);
    });
    table.append(body);
    externalGrid.replaceChildren(table);
    externalEditor.hidden = false;
}

async function downloadExternalWorkbook() {
    if (!externalWorkbookInput.files.length) {
        externalEditorStatus.textContent = "Selecione novamente o arquivo Excel para baixar a cópia editada.";
        return;
    }

    // O envio nativo mantém o clique do usuário e deixa o navegador tratar o download.
    externalChangesInput.value = JSON.stringify([...externalChanges.values()]);
    externalUploadForm.action = config.editar_planilha_externa_url;
    externalEditorStatus.textContent = "Enviando a planilha. O download deve começar automaticamente.";
    externalDownloadButton.disabled = true;
    externalUploadForm.submit();
    setTimeout(() => {
        externalDownloadButton.disabled = false;
    }, 1500);
}

function showExternalDownloadError() {
    // Erros JSON do servidor carregam no iframe oculto e continuam visíveis na página.
    const body = externalDownloadFrame.contentDocument?.body;
    if (!body) {
        return;
    }

    try {
        const result = JSON.parse(body.textContent);
        if (result.erro) {
            externalEditorStatus.textContent = result.erro;
            externalDownloadButton.disabled = false;
        }
    } catch {
        // Respostas binárias de Excel não contêm JSON e são baixadas pelo navegador.
    }
}

initializeChatbot();
initializeExternalEditor();
