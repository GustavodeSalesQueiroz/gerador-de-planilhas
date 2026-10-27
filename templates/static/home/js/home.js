const messages = document.querySelector("#chat-messages");
const controls = document.querySelector("#chat-controls");
const statusMessage = document.querySelector("#chat-status");
const recordsList = document.querySelector("#records-list");
const recordsCount = document.querySelector("#records-count");
const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
const config = JSON.parse(document.querySelector("#chatbot-config").textContent);

let script;
let currentSheet;
let selectedTheme;
let currentMode;
let selectedRecord;
let questionIndex = 0;
let answers = {};

function addMessage(text, sender = "bot") {
    const bubble = document.createElement("p");
    bubble.className = `message message-${sender}`;
    bubble.textContent = text;
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
}

function clearControls() {
    controls.replaceChildren();
    statusMessage.textContent = "";
}

function showChoices(choices) {
    clearControls();
    const group = document.createElement("div");
    group.className = "choice-list";

    choices.forEach(({ label, onSelect, secondary = false }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = secondary ? "choice-button choice-secondary" : "choice-button";
        button.textContent = label;
        button.addEventListener("click", () => {
            group.remove();
            onSelect();
        });
        group.append(button);
    });

    controls.append(group);
}

function showDownloadLink(url, label) {
    const link = document.createElement("a");
    link.className = "choice-button download-button";
    link.href = url;
    link.textContent = label;
    link.setAttribute("download", "");
    controls.append(link);
}

async function requestJson(url, method = "GET", data = null) {
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
    currentSheet = null;
    selectedTheme = null;
    currentMode = null;
    selectedRecord = null;
    answers = {};
    showChoices([
        { label: script.mensagens.iniciar_registro, onSelect: chooseTheme },
        { label: script.mensagens.editar_planilha, onSelect: chooseExistingSheet, secondary: true },
        { label: script.mensagens.ver_historico, onSelect: showRecentSheets, secondary: true },
        { label: script.mensagens.como_funciona, onSelect: showHelp, secondary: true },
    ]);
}

function chooseTheme() {
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
    const question = currentSheet.perguntas[questionIndex];
    if (!question) {
        showReview();
        return;
    }

    addMessage(question.pergunta);
    showQuestionInput(question);
}

function showQuestionInput(question) {
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
    addMessage(`${script.mensagens.planilha_pronta}: ${sheetName}`);
    clearControls();
    showChoices([
        { label: script.mensagens.continuar_planilha, onSelect: showSheetOptions, secondary: true },
        { label: script.mensagens.iniciar_registro, onSelect: showMenu, secondary: true },
    ]);
    showDownloadLink(url, script.mensagens.download_planilha);
}

function addRecordToList(record) {
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
    addMessage(script.mensagens.como_funciona, "user");
    addMessage(script.mensagens.menu_ajuda);
    showChoices([{ label: script.mensagens.voltar_menu, onSelect: showMenu, secondary: true }]);
}

async function initializeChatbot() {
    try {
        const response = await fetch(config.roteiro_url);
        if (!response.ok) {
            throw new Error();
        }
        script = await response.json();
        addMessage(script.mensagens.boas_vindas);
        showMenu();
    } catch {
        statusMessage.textContent = "Não foi possível carregar o roteiro do chatbot.";
    }
}

initializeChatbot();
