# Changelog — DocBox Pro

Todas as mudanças significativas neste projeto serão documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

---

## [1.1.0] — 2026-06-28

### Adicionado

#### Feature: Atalhos para Scripts (`#fat`, `#senha`, etc.)

**Arquivos alterados:**
- `index.html` — novo campo `#script-shortcut`, hint, container dropdown
- `style.css` — estilos do dropdown e badge de atalho (~40 linhas)
- `script.js` — CRUD com shortcut, dropdown de sugestões no relato (~130 linhas)

**O que faz:**
- Novo campo "Atalho" no formulário de cadastro/edição de scripts (admin)
- Badge `#atalho` visível nos cards de script na tela principal
- Dropdown de sugestões ao digitar `#` no campo de relato do atendimento
- Navegação por teclado (setas, Enter, Tab, Escape) e clique no dropdown
- Ao selecionar, insere `#atalho + conteúdo do script` no relato
- Barra de busca de scripts agora também pesquisa por atalho

**Banco de Dados (Supabase):**
- Nova coluna: `scripts.shortcut` (text, nullable)

---

## [1.0.0] — Lançamento inicial

- Sistema de autenticação (login, cadastro, recuperação de senha)
- Registro de atendimentos com validação de CPF/CNPJ
- Transferência inteligente (Matrix) via área de transferência
- CRUD completo de scripts com cores personalizáveis
- Histórico local dos últimos 8 atendimentos
- Módulo LGPD para transferência de dados
- Wallpaper personalizado por URL
- Tema Dark/Light
- Links para Extensão Chrome e Planilha de Atalhos
