from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("api/roteiro/", views.roteiro_chatbot, name="roteiro_chatbot"),
    path("api/planilhas/", views.listar_planilhas, name="listar_planilhas"),
    path("api/planilhas/criar/", views.criar_planilha, name="criar_planilha"),
    path("api/planilhas/<int:planilha_id>/", views.detalhe_planilha, name="detalhe_planilha"),
    path(
        "api/planilhas/<int:planilha_id>/registros/",
        views.salvar_registro_planilha,
        name="adicionar_registro_planilha",
    ),
    path(
        "api/planilhas/<int:planilha_id>/registros/<int:registro_id>/",
        views.salvar_registro_planilha,
        name="editar_registro_planilha",
    ),
    path(
        "planilhas/arquivo/<int:planilha_id>/baixar/",
        views.baixar_planilha_por_id,
        name="baixar_planilha_por_id",
    ),
    path("api/conversas/", views.criar_conversa, name="criar_conversa"),
    path("planilhas/<slug:codigo>/baixar/", views.baixar_planilha, name="baixar_planilha"),
]