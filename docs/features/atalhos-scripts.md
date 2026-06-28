# Atalhos para Scripts

## Descrição

Permite que cada script cadastrado tenha um **atalho** (ex: `#fat`, `#senha`, `#cancelamento`). Ao digitar `#` no campo de **Relato do Atendimento**, um dropdown é exibido com sugestões dos scripts que possuem atalho. Ao selecionar, o conteúdo do script é inserido automaticamente no texto.

## Banco de Dados

### Nova coluna

```sql
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS shortcut text;
```

- **Tipo:** `text` (nullable)
- **Descrição:** Atalho do script, ex: `#fat`, `#senha`
- O `#` é armazenado junto com a palavra (ex: `#fat`)
- Pode ser `null` para scripts sem atalho

## Como usar

### Cadastrar um atalho

1. Vá em **Gerenciar Scripts** no menu lateral
2. Preencha os campos normally (Título, Categoria, Conteúdo, Cor)
3. No campo **Atalho**, digite `#` + palavra (ex: `#fat`)
4. Clique em **Registrar Atalho**

### Usar no atendimento

1. No campo **Relato do Atendimento**, digite `#` + parte do atalho (ex: `#fa`)
2. Um dropdown aparecerá com os scripts correspondentes
3. Navegue com as **setas do teclado** ou **clique** com o mouse
4. Pressione **Enter** ou **Tab** para selecionar
5. O conteúdo do script será inserido automaticamente após o atalho
6. **Escape** fecha o dropdown

### Buscar por atalho

Na barra de busca de scripts na tela principal, digite `#fat` para filtrar os scripts que contenham esse atalho.

## Comportamento do Dropdown

- **Atalho detectado:** Quando o cursor está logo após `#` + letras (ex: `|#fat|`)
- **Filtro:** Busca scripts cujo `shortcut` (sem `#`) comece com o que foi digitado
- **Posicionamento:** Aparece abaixo da linha do cursor no textarea
- **Fechamento:** Ao selecionar, ao pressionar Escape, ou ao clicar fora do campo
- **Proteção:** Ignora `#` no meio de palavras (ex: `contato#2024` não ativa)

## Interface

### Card de script na tela principal

```
┌──────────────────────────┐
│ Título do Script  [#fat] │
│ Conteúdo do script...    │
│                    Geral │
└──────────────────────────┘
```

### Formulário admin

```
[Atalho (ex: #fat)]  ← novo campo
Digite # + palavra. Ex: #fat, #senha, #cancelamento  ← hint
```

## Código Fonte

### Arquivos alterados

| Arquivo | Mudanças |
|---|---|
| `index.html` | + input `#script-shortcut`, + hint, + dropdown container |
| `style.css` | + `.shortcut-dropdown`, + `.shortcut-badge`, + estados |
| `script.js` | CRUD expandido + 7 novas funções de dropdown |

### Funções no script.js

| Função | Descrição |
|---|---|
| `iniciarMonitoramentoAtalhos()` | Configura listeners do textarea |
| `detectarAtalho(textarea)` | Analisa texto e filtra scripts |
| `mostrarSugestoes(resultados, textarea)` | Renderiza e posiciona dropdown |
| `inserirAtalhoDoDropdown(script, textarea)` | Substitui e insere conteúdo |
| `esconderDropdown()` | Limpa estado e oculta |
| `atualizarItemAtivo(items)` | Destaca item com teclado |
| `calcularPosicaoCursor(textarea)` | Mede posição para o dropdown |

## Versão

Adicionado na **v1.1.0** (2026-06-28)
