from django.db import models


class TemaBot(models.Model):
    codigo = models.SlugField(max_length=30, unique=True)
    nome = models.CharField(max_length=80)
    nome_planilha = models.CharField(max_length=31)
    ordem = models.PositiveSmallIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ["ordem", "nome"]
        verbose_name = "tema do chatbot"
        verbose_name_plural = "temas do chatbot"

    def __str__(self):
        return self.nome


class PerguntaBot(models.Model):
    TIPOS = [
        ("text", "Texto"),
        ("number", "Número"),
        ("date", "Data"),
    ]

    tema = models.ForeignKey(TemaBot, on_delete=models.CASCADE, related_name="perguntas")
    campo = models.SlugField(max_length=40)
    cabecalho = models.CharField(max_length=80)
    pergunta = models.CharField(max_length=200)
    tipo = models.CharField(max_length=10, choices=TIPOS, default="text")
    obrigatoria = models.BooleanField(default=True)
    opcoes = models.JSONField(default=list, blank=True)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordem"]
        constraints = [
            models.UniqueConstraint(fields=["tema", "campo"], name="unique_pergunta_campo_tema"),
            models.UniqueConstraint(fields=["tema", "ordem"], name="unique_pergunta_ordem_tema"),
        ]
        verbose_name = "pergunta do chatbot"
        verbose_name_plural = "perguntas do chatbot"

    def __str__(self):
        return f"{self.tema.nome}: {self.pergunta}"


class MensagemBot(models.Model):
    chave = models.SlugField(max_length=40, unique=True)
    texto = models.CharField(max_length=300)

    def __str__(self):
        return self.chave


class Planilha(models.Model):
    tema = models.ForeignKey(TemaBot, on_delete=models.PROTECT, related_name="planilhas")
    nome = models.CharField(max_length=100)
    criada_em = models.DateTimeField(auto_now_add=True)
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-atualizada_em", "nome"]
        verbose_name = "planilha"
        verbose_name_plural = "planilhas"

    def __str__(self):
        return self.nome


class RegistroConversa(models.Model):
    tema = models.ForeignKey(TemaBot, on_delete=models.PROTECT, related_name="registros")
    planilha = models.ForeignKey(
        Planilha,
        on_delete=models.CASCADE,
        related_name="registros",
        null=True,
        blank=True,
    )
    respostas = models.JSONField()
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "registro de conversa"
        verbose_name_plural = "registros de conversa"

    def __str__(self):
        return f"{self.tema.nome} - {self.criado_em:%d/%m/%Y}"


class usuarios(models.Model):
    nome = models.CharField(max_length=100)
    email = models.EmailField(max_length=100)
    senha = models.CharField(max_length=100)

    def __str__(self) -> str:
        return self.nome


class RegistroOperacional(models.Model):
    CATEGORIAS = [
        ("pedido", "Pedido"),
        ("venda", "Venda"),
        ("produto", "Produto"),
        ("estoque", "Estoque"),
        ("evento", "Evento"),
    ]

    categoria = models.CharField(max_length=20, choices=CATEGORIAS)
    detalhes = models.CharField(max_length=500)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "registro operacional"
        verbose_name_plural = "registros operacionais"

    def __str__(self):
        return f"{self.get_categoria_display()} - {self.criado_em:%d/%m/%Y}"
