<div align="center">
  <br/>
  <img src="https://img.shields.io/badge/status-ativo-brightgreen?style=flat-square" alt="Status"/>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3"/>
  <img src="https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript ES6"/>
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <br/><br/>
</div>

<h1 align="center">DocBox Pro</h1>

<p align="center">
  <b>Plataforma profissional para gestão de atendimentos e scripts</b><br/>
  Sistema completo com autenticação, painel administrativo e integração em tempo real.
</p>

<p align="center">
  <i>"A evolução do DocBox para equipes que precisam de mais controle e produtividade."</i>
</p>

---

## Sobre o Projeto

**DocBox Pro** é a versão avançada do DocBox, projetada para ambientes de call center que exigem maior controle, segurança e personalização. Construído com **Vite + Supabase**, o sistema oferece autenticação de usuários, gerenciamento centralizado de scripts e histórico de atendimentos — tudo em uma interface moderna com suporte a temas claro/escuro.

Diferente da versão original, o DocBox Pro conta com backend próprio, permitindo que scripts e configurações sejam compartilhados entre toda a equipe em tempo real.

---

## Funcionalidades

### Gestão de Atendimentos
- **Registro Rápido**: Interface otimizada para agilidade no preenchimento
- **Transferência Inteligente**: Cole o texto da área de transferência e os campos são extraídos automaticamente
- **Validação de CPF/CNPJ**: Validação automática com formatação padronizada
- **Cópia Formatada**: Monta o texto do atendimento e copia para a área de transferência

### Painel de Scripts
- **Scripts Centralizados**: Gerencie scripts de atendimento em um só lugar
- **Busca Rápida**: Filtre scripts por palavra-chave em tempo real
- **Cores Personalizáveis**: Atribua cores diferentes por categoria

### Autenticação e Segurança
- **Sistema de Login/Cadastro**: Controle de acesso por email e senha
- **Recuperação de Senha**: Fluxo completo de redefinição
- **Validação de Senha**: Indicador de força e requisitos em tempo real

### Conformidade LGPD
- **Tela de Transferência de Dados**: Módulo dedicado para validação de contatos com o cliente
- **Formatação de Telefones e E-mails**: Exibição mascarada para proteção de dados

### Recursos Extras
- **Histórico**: Últimos 8 atendimentos registrados
- **Modo Escuro/Claro**: Alternância suave com persistência
- **Papel de Parede Personalizado**: URL de imagem ou GIF como background
- **Extensão Chrome**: Integração com extensão dedicada
- **Planilha de Atalhos**: Acesso direto ao Painel de Scripts

---

## Tecnologias

| Tecnologia | Aplicação |
|---|---|
| **HTML5** | Estrutura semântica da aplicação |
| **CSS3** | Design System com variáveis nativas, Flexbox e Grid |
| **JavaScript ES6+** | Lógica da aplicação com módulos |
| **Supabase** | Autenticação, banco de dados e Realtime |
| **Vite** | Bundler e servidor de desenvolvimento |
| **Lucide Icons** | Ícones vetoriais modernos |
| **Google Fonts (Inter)** | Tipografia limpa e profissional |

---

## Estrutura do Projeto

```
DocBox-Pro/
  index.html             Pagina principal (SPA com multi-telas)
  style.css              Estilos completos (temas e design system)
  script.js              Core engine com modulos ES6
  package.json           Dependencias e scripts (Vite + Supabase)
  favicon.png            Icone da aplicacao
  call-center-animate.svg  Ilustracao animada da tela de login
  .gitignore             Arquivos ignorados
```

---

## Como Executar

```bash
# Clone o repositorio
git clone https://github.com/casemiro-dev/DocBox-Pro.git

# Acesse o diretorio
cd DocBox-Pro

# Instale as dependencias
npm install

# Configure o Supabase
# Edite o arquivo script.js com as credenciais do seu projeto Supabase

# Inicie o servidor de desenvolvimento
npm run dev

# Para build de producao
npm run build
```

---

## Fluxo de Uso

1. **Crie sua conta** ou faça login no sistema
2. **Atendimento**: Preencha os campos manualmente ou use "Transferir Matrix" para extrair de um texto
3. **Scripts**: Consulte os scripts disponíveis ou crie novos no painel administrativo
4. **Copie**: Clique em "Copiar" e cole no sistema administrativo
5. **LGPD**: Use o módulo de transferência para validar contatos em conformidade com a LGPD

---

## Projetos Relacionados

| Projeto | Descrição |
|---|---|
| [DocBox](https://github.com/casemiro-dev/DocBox) | Versão original sem backend |
| [SupPaciente](https://sup-paciente.vercel.app/) | Gestão de chamados em tempo real |
| [Painel de Scripts](https://casemiro-dev.github.io/Painel-de-Scripts/) | Dashboard de scripts com Supabase |
| [LGPD](https://casemiro-dev.github.io/LGPD/) | Política e transferência de dados |

---

## Autor

**Casemiro Alves**

[GitHub](https://github.com/casemiro-dev)

"Feito para quem precisa registrar atendimentos com rapidez e precisão."

---

<div align="center">
  <sub>2025-2026 Casemiro Alves. Todos os direitos reservados.</sub>
</div>
