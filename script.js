import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_URL;
const supabaseKey = import.meta.env.VITE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: Chaves do Supabase não encontradas. Verifique o arquivo .env ou a Vercel.");
}

const supabaseClient = createClient(supabaseUrl, supabaseKey);

// --- VARIÁVEIS GLOBAIS ---
let currentUser = null;
// Contexto de áudio para feedback sonoro
let audioCtx = null;
let allScripts = [];
let carregandoRecuperacao = false;
let atendimentoRecuperadoOriginal = null;
// APAGUEI a 'ultimoProtocoloResgatado' porque a de baixo já faz o serviço:
let ultimaBuscaSucesso = { protocolo: "", documento: "" };


// --- LÓGICA DE ABAS (MANTIDA) ---
if (!sessionStorage.getItem('tab_id') || window.location.search.includes('reset=true')) {
    sessionStorage.setItem('tab_id', 'tab_' + Date.now() + Math.random().toString(36).substr(2, 9));
}
const TAB_ID = sessionStorage.getItem('tab_id');

// --- NAVEGAÇÃO E TEMA ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

function toggleTheme() {
    const html = document.documentElement;
    
    // Verifica se atualmente está no Dark Mode
    const isDark = html.classList.contains('dark-mode') || !html.classList.contains('light-mode');

    if (isDark) {
        // Mudar para Light Mode
        html.classList.remove('dark-mode');
        html.classList.add('light-mode');
        localStorage.setItem('docbox_theme', 'light'); // Salva a escolha
    } else {
        // Mudar para Dark Mode
        html.classList.remove('light-mode');
        html.classList.add('dark-mode');
        localStorage.setItem('docbox_theme', 'dark'); // Salva a escolha
    }

    // Atualiza o ícone (Lógica: se virou Light, mostra Lua. Se virou Dark, mostra Sol)
    const icon = html.classList.contains('light-mode') ? 'moon' : 'sun';
    document.getElementById('theme-btn').innerHTML = `<i data-lucide="${icon}"></i>`;
    
    lucide.createIcons();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.add('hidden');
        s.style.display = 'none';
    });
    
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
    }
    
    if (['main-screen', 'admin-screen', 'lgpd-screen', 'history-screen', 'timer-screen'].includes(screenId)) {
        localStorage.setItem('docbox_last_screen', screenId);
    }
    
    // Destaca o item ativo no menu lateral
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navAtivo = document.querySelector(`.nav-item[onclick*="showScreen('${screenId}')"]`);
    if (navAtivo) navAtivo.classList.add('active');

    // SÓ CHAMA O BANCO SE TIVER CONEXÃO
    if ((screenId === 'main-screen' || screenId === 'admin-screen') && supabaseClient) {
        loadScripts();
    }

    lucide.createIcons();

    // ADICIONE ISSO AQUI:
    if (screenId === 'history-screen') {
        renderHistorico();
    }

    if (screenId === 'timer-screen') {
        renderAlarmes();
        garantirRelogio();
    }
}

// --- AUTENTICAÇÃO ---
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.querySelector('.btn-primary'); // Pega o botão de login no HTML

    if(!email || !password) return alert("Preencha os campos!");

    // --- MUDANÇA: FEEDBACK DE LOADING ---
    if(btn) {
        btn.disabled = true; // Trava o botão para evitar múltiplos cliques
        btn.innerText = 'Autenticando...'; // Muda o texto
    }
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert("Erro: " + error.message);
        // VOLTA O BOTÃO AO NORMAL SE DER ERRO
        if(btn) {
            btn.disabled = false;
            btn.innerText = 'Entrar no Sistema';
        }
    } else {
        checkUser();
    }
}

// --- MUDANÇA: GARANTE QUE O ENTER CHAME O FEEDBACK ---
if (document.getElementById('password')) {
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin(); // Chama a função que já tem o loading
        }
    });
}
// ---------------------------------------------------

async function handleSignUp() {
    // Usa os campos da tela de cadastro dedicada
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!email || !password) {
        return alert("Preencha o e-mail e a senha!");
    }

    if (password.length < 6) {
        return alert("A senha deve ter pelo menos 6 caracteres!");
    }

    if (password !== confirmPassword) {
        return alert("As senhas não coincidem! Verifique e tente novamente.");
    }

    const btn = document.querySelector('#signup-screen .btn-primary');
    if (btn) { btn.disabled = true; btn.innerText = 'Criando conta...'; }

    const { error } = await supabaseClient.auth.signUp({ email, password });
    
    if (btn) { btn.disabled = false; btn.innerText = 'Criar Conta'; }

    if (error) {
        alert("Erro: " + error.message);
    } else {
        alert("Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro antes de fazer login.");
        // Limpa os campos e volta para o login
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm-password').value = '';
        showScreen('auth-screen');
    }
}

async function handleLogout() { 
    localStorage.removeItem('docbox_last_screen');
    if (supabaseClient) {
        await supabaseClient.auth.signOut(); 
    }
    window.location.href = window.location.origin + window.location.pathname; // Recarrega na home limpa
}

// --- MUDANÇA: LOGIN E SCRIPTS EM PARALELO (MAIS RÁPIDO) ---
async function checkUser() {
    const loading = document.getElementById('loading-screen');
    
    if (carregandoRecuperacao) return;

    try {
        // --- MUDANÇA: Promise.all dispara as duas coisas ao mesmo tempo ---
        const [authResponse, scriptsResponse] = await Promise.all([
            supabaseClient.auth.getUser(), // Verifica quem é o usuário
            loadScripts() // Já começa a baixar os scripts pro grid
        ]);
        // ------------------------------------------------------------------

        const user = authResponse.data.user;
        
        if (carregandoRecuperacao) return;

        if (user) {
            currentUser = user;
            const userDisplay = document.getElementById('user-display');
            if (userDisplay) userDisplay.innerText = user.email;

            // --- CARREGAR WALLPAPER DO SUPABASE ---
            supabaseClient
                .from('profiles')
                .select('wallpaper_url, header_color')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data && data.wallpaper_url) {
                        document.body.style.setProperty('--custom-bg', `url('${data.wallpaper_url}')`);
                        localStorage.setItem('docbox_wallpaper', data.wallpaper_url);
                        const bgInput = document.getElementById('bg-url');
                        if (bgInput) bgInput.value = data.wallpaper_url;
                    }
                    if (data && data.header_color) {
                        document.documentElement.style.setProperty('--header-bg', data.header_color);
                        localStorage.setItem('docbox_header_color', data.header_color);
                        const colorInput = document.getElementById('header-color');
                        if (colorInput) colorInput.value = data.header_color;
                    }
                });

            let lastScreen = localStorage.getItem('docbox_last_screen');
            const validScreens = ['main-screen', 'admin-screen', 'lgpd-screen', 'history-screen', 'timer-screen']; 
            
            if (!lastScreen || !validScreens.includes(lastScreen)) {
                lastScreen = 'main-screen';
            }
            
            showScreen(lastScreen); // Muda para a tela principal (que já deve estar com os scripts carregados)
        } else {
            showScreen('auth-screen');
        }
    } catch (err) {
        console.error("Erro no checkUser:", err);
        showScreen('auth-screen');
    } finally {
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => { if (loading.parentNode) loading.remove(); }, 300);
        }
    }
}

// --- UTILITÁRIOS: TÍTULO E TELEFONE ---

function atualizarTituloPagina() {
    const nomeCliente = document.getElementById("at-nome")?.value.trim();
    document.title = nomeCliente ? nomeCliente : 'DocBox';
}

function preencherTitular() {
    const input = document.getElementById('at-nome');
    if (input) {
        input.value = "Titular";
        atualizarTituloPagina();
        salvarDadosTemporarios();
        showToast("Nome definido como Titular!");
    }
}

function formatarTelefone(valor) {
    if (!valor) return "";
    let numeros = valor.replace(/\D/g, "");
    // CORRIGIDO: de 'numbers' para 'numeros'
    if (numeros.startsWith("55") && numeros.length === 13) {
        numeros = numeros.substring(2);
    }
    if (numeros.length === 11) {
        return numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return valor;
}

// --- UTILITÁRIOS: VALIDAÇÃO E FORMATAÇÃO DE CPF/CNPJ ---

function processarDoc(devePontuar) {
    const input = document.getElementById('at-doc');
    let valor = input.value.replace(/\D/g, "");

    if (!valor) return showToast("Campo de documento vazio!", true);

    // Validação de tamanho básico
    if (valor.length !== 11 && valor.length !== 14) {
        input.classList.add('input-invalid');
        return showToast("Tamanho incorreto (CPF 11 / CNPJ 14)", true);
    }

    const eValido = validarDocumento(valor);
    
    if (eValido) {
        input.classList.add('input-valid');
        input.classList.remove('input-invalid');
        
        if (devePontuar) valor = formatarDocumento(valor);

        input.value = valor;
        copyToClipboard(valor); // SÓ COPIA SE FOR VÁLIDO
        showToast(valor.length <= 14 ? "Documento Válido e Copiado!" : "CNPJ Válido e Copiado!");
    } else {
        input.classList.add('input-invalid');
        input.classList.remove('input-valid');
        const tipo = valor.length === 11 ? "CPF" : "CNPJ";
        showToast(`${tipo} Inválido! Verifique os números.`, true);
    }
}

document.getElementById('at-doc')?.addEventListener('input', function() {
    this.classList.remove('input-valid', 'input-invalid');
});

function formatarDocumento(v) {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else {
        return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
}

function validarDocumento(doc) {
    doc = doc.replace(/\D/g, "");
    if (doc.length === 11) return validarCPF(doc);
    if (doc.length === 14) return validarCNPJ(doc);
    return false;
}

function validarCPF(cpf) {
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}

function validarCNPJ(cnpj) {
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0, pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(0)) return false;
    tamanho = tamanho + 1; numeros = cnpj.substring(0, tamanho); soma = 0; pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado == digitos.charAt(1);
}

// --- LÓGICA DE ATENDIMENTO ---

async function transferirAtendimento() {
    try {
        const texto = await navigator.clipboard.readText();
        
        const nomeMatch = texto.match(/Nome:\s*(.*?)(?=Telefone:|$)/i);
        const protocoloMatch = texto.match(/N.mero de protocolo:\s*(\d+)/i); // Aceita "Número" ou "N?mero"
        const telMatch = texto.match(/Telefone:\s*(\d+)/i);
        const cpfMatch = texto.match(/(?:cpf|cnpj)\s*Cliente:\s*([\d.-]+)|CPF:\s*([\d.-]+)/i);

        // Preenchimento imediato
        if (nomeMatch?.[1]) document.getElementById("at-nome").value = nomeMatch[1].trim();
        if (protocoloMatch) document.getElementById("at-protocolo").value = protocoloMatch[1];
        
        if (cpfMatch) {
            let docRaw = cpfMatch[1] || cpfMatch[2];
            let docLimpo = docRaw.replace(/\D/g, "");
            if (docLimpo.length === 15 && docLimpo.startsWith("0")) docLimpo = docLimpo.substring(1);
            document.getElementById("at-doc").value = docLimpo;
        }

        if (telMatch) document.getElementById("at-tel").value = formatarTelefone(telMatch[1]);

        // Sincronização e Busca Instantânea
        atualizarTituloPagina();
        salvarDadosTemporarios();
        
        // Dispara a busca no banco no exato milissegundo após colar
        await buscarAtendimentoSalvo(); 
        
        showToast("Dados transferidos e buscados!");
        tocarSomSucesso();

    } catch (err) {
        showToast("Erro ao ler área de transferência.", true);
    }
}

async function saveAtendimento() {
    // 1. Coleta os dados
    const nome = document.getElementById('at-nome').value.trim();
    const protocolo = document.getElementById('at-protocolo').value.trim();
    const doc = document.getElementById('at-doc').value.trim();
    const tel = document.getElementById('at-tel').value.trim();
    const relatoEditor = document.getElementById('at-relato');
    const relato = relatoEditor ? relatoEditor.innerText.trim() : "";
    const relatoHTML = relatoEditor ? relatoEditor.innerHTML : relato;

    // 2. Validação de campos vazios
    if (!nome || !protocolo || !doc || !tel || !relato) {
        return alert("⚠️ Todos os campos são obrigatórios: Nome, Protocolo, CPF/CNPJ, Telefone e Relato!");
    }

    // --- NOVA TRAVA: VERIFICAÇÃO DE DUPLICIDADE NO SUPABASE ---
    try {
        const { data: existente, error: erroBusca } = await supabaseClient
            .from('atendimentos_pendentes')
            .select('protocolo')
            .eq('protocolo', protocolo)
            .maybeSingle(); // Busca se existe um registro com esse protocolo

        if (erroBusca) throw erroBusca;

        if (existente) {
            return alert(`⚠️ Ops! O protocolo ${protocolo} já foi salvo no banco de dados anteriormente.`);
        }
    } catch (err) {
        console.error("Erro ao verificar duplicidade:", err);
    }
    // ---------------------------------------------------------

    // 3. Se passou pela trava, salva no histórico local
    salvarNoHistoricoLocal();

    // 4. Envia para o Supabase
    const { error } = await supabaseClient.from('atendimentos_pendentes').insert([{
        nome: nome, 
        protocolo: protocolo, 
        documento: doc, 
        telefone: tel, 
        relato: relatoHTML
    }]);

    if (error) {
        alert("Erro ao salvar no banco: " + error.message);
    } else {
        showToast("Atendimento enviado e salvo no histórico!");
        limparCamposSemConfirmacao(); 
    }
}

// Guarda protocolos que já buscamos e não retornaram nada, para não repetir a busca à toa
async function buscarAtendimentoSalvo() {
    const protInput = document.getElementById('at-protocolo');
    const docInput = document.getElementById('at-doc');
    if (!protInput || !docInput) return;

    const protocolo = protInput.value.trim();
    const documento = docInput.value.trim();

    // Reset se limpar os campos
    if (!protocolo && !documento) {
        ultimaBuscaSucesso = { protocolo: "", documento: "" };
        return;
    }

    if (protocolo.length < 5 && documento.length < 5) return;

    // --- NOVA LÓGICA DE TRAVA DUPLA ---
    // Só ignora se o protocolo digitado FOR o último resgatado 
    // E o documento digitado TAMBÉM FOR o último resgatado.
    if (protocolo === ultimaBuscaSucesso.protocolo && documento === ultimaBuscaSucesso.documento) {
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('atendimentos_pendentes')
            .select('*')
            .or(`protocolo.eq.${protocolo},documento.eq.${documento}`)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            const atendimento = data[0];
            
            // Grava os dois dados na trava de sucesso
            ultimaBuscaSucesso.protocolo = atendimento.protocolo || "";
            ultimaBuscaSucesso.documento = atendimento.documento || "";

            // Preenche tudo na tela
            document.getElementById('at-nome').value = atendimento.nome || "";
            document.getElementById('at-tel').value = atendimento.telefone || "";
            document.getElementById('at-relato').innerHTML = atendimento.relato || "";
            protInput.value = atendimento.protocolo || "";
            docInput.value = atendimento.documento || "";

            // Deleta do banco para não dar conflito
            await supabaseClient.from('atendimentos_pendentes').delete().eq('id', atendimento.id);
            
            showToast("Atendimento resgatado!");
            atualizarTituloPagina();
            salvarDadosTemporarios();
        }
    } catch (err) {
        console.error("Erro no resgate:", err);
        ultimaBuscaSucesso = { protocolo: "", documento: "" }; 
    }
}

function limparCampos() {
    if (confirm("Deseja realmente apagar todos os campos?")) limparCamposSemConfirmacao();
}

function limparCamposSemConfirmacao() {
    salvarNoHistoricoLocal();
    
    // Reset da trava dupla
    ultimaBuscaSucesso = { protocolo: "", documento: "" }; 

    const campos = ['at-nome', 'at-protocolo', 'at-doc', 'at-tel', 'at-relato'];
    
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.id === 'at-relato') {
                el.innerHTML = '';
            } else {
                el.value = '';
            }
            el.classList.remove('input-valid', 'input-invalid');
        }
    });

    // --- CORREÇÃO PARA MÚLTIPLAS ABAS ---
    // Remove apenas o rascunho desta aba específica usando o TAB_ID global
    localStorage.removeItem(`docbox_temp_${TAB_ID}`);
    // ------------------------------------

    const statusEl = document.getElementById('doc-status');
    if (statusEl) statusEl.innerText = "";
    
    atualizarTituloPagina();
}

function escaparHTML(texto) {
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function relatoHTMLParaTexto(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    let saida = '';

    (function percorrer(node) {
        node.childNodes.forEach(filho => {
            if (filho.nodeType === Node.TEXT_NODE) { saida += filho.textContent; return; }
            const tag = filho.nodeName.toUpperCase();
            if (tag === 'BR') { saida += '\n'; return; }
            if (tag === 'HR') { saida += '\n──────────────\n'; return; }
            if (tag === 'DIV' || tag === 'P') {
                percorrer(filho);
                if (saida && !saida.endsWith('\n')) saida += '\n';
                return;
            }
            if (tag === 'B' || tag === 'STRONG') { saida += '*' + filho.innerText + '*'; return; }
            if (tag === 'I' || tag === 'EM') { saida += '_' + filho.innerText + '_'; return; }
            if (tag === 'STRIKE' || tag === 'S' || tag === 'DEL') { saida += '~' + filho.innerText + '~'; return; }
            if (tag === 'U') { saida += filho.innerText; return; }
            percorrer(filho);
        });
    })(container);

    return saida;
}

function copiarComFormatacao(textoPuro, textoHTML) {
    const sucesso = () => { showToast("Dados copiados!"); tocarSomSucesso(); };

    if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': new Blob([textoPuro], { type: 'text/plain' }),
                'text/html': new Blob([textoHTML], { type: 'text/html' })
            })
        ]).then(sucesso).catch(() => {
            navigator.clipboard.writeText(textoPuro).then(sucesso).catch(() => showToast("Erro ao copiar.", true));
        });
    } else {
        navigator.clipboard.writeText(textoPuro).then(sucesso).catch(() => showToast("Erro ao copiar.", true));
    }
}

function copiarRegistro() {
    const elNome = document.getElementById('at-nome');
    const elProt = document.getElementById('at-protocolo');
    const elTel = document.getElementById('at-tel');
    const elRelato = document.getElementById('at-relato');

    const nome = elNome?.value.trim() || "";
    const protocolo = elProt?.value.trim() || "";
    const telefone = elTel?.value.trim() || "";
    const relatoHTML = elRelato?.innerHTML || "";
    const relatoTexto = relatoHTMLParaTexto(relatoHTML).trim();

    if (!nome && !telefone && !protocolo && !relatoTexto) return showToast("Preencha ao menos um campo!", true);

    // Versão texto puro (com marcadores de formatação compatíveis com WhatsApp)
    let msg = protocolo === ""
        ? `Cliente ${nome} via tel no n° ${telefone}${relatoTexto ? '\n\n' + relatoTexto : ''}`
        : `Protocolo do chat: ${protocolo}\nCliente ${nome} via chat no n° ${telefone}${relatoTexto ? '\n\n' + relatoTexto : ''}`;

    // Versão HTML (preserva negrito, itálico, sublinhado, tachado e as linhas separadoras)
    const cabecalhoHTML = protocolo === ""
        ? `<p>Cliente <b>${escaparHTML(nome)}</b> via tel no n° <b>${escaparHTML(telefone)}</b></p>`
        : `<p>Protocolo do chat: <b>${escaparHTML(protocolo)}</b><br>Cliente <b>${escaparHTML(nome)}</b> via chat no n° <b>${escaparHTML(telefone)}</b></p>`;
    const htmlCompleto = relatoHTML ? cabecalhoHTML + '<br>' + relatoHTML : cabecalhoHTML;

    copiarComFormatacao(msg, htmlCompleto);
}

// --- LÓGICA DE SCRIPTS (CRUD COMPLETO) ---
async function loadScripts(forceRefresh = false) {
    // Cache de scripts para evitar chamadas repetidas ao banco
    if (allScripts.length > 0 && !forceRefresh) return;

    if (!supabaseClient) return;

    // Busca otimizada: apenas os campos necessários
    const { data, error } = await supabaseClient
        .from('scripts')
        .select('id, title, function_name, shortcut, content, color');
    
    if (!error) {
        allScripts = data; 
        
        const colorOrder = {
            "#ff0000": 1, "#ff7f00": 2, "#ffff00": 3, "#00ff00": 4,
            "#0000ff": 5, "#4b0082": 6, "#9400d3": 7, "#000000": 8,
            "#808080": 9, "#ffffff": 10
        };

        const sortedData = [...data].sort((a, b) => {
            const weightA = colorOrder[a.color?.toLowerCase()] || 99;
            const weightB = colorOrder[b.color?.toLowerCase()] || 99;
            if (weightA !== weightB) return weightA - weightB;
            return (a.title || "").localeCompare(b.title || "");
        });

        renderMainGrid(sortedData);
        renderAdminList(sortedData);
        lucide.createIcons();
    }
}

function editarScript(id) {
    const script = allScripts.find(s => s.id == id);
    if (script) {
        const sc = script.shortcut || "";
        document.getElementById('edit-script-id').value = script.id;
        document.getElementById('script-title').value = script.title || "";
        document.getElementById('script-function').value = script.function_name || "";
        document.getElementById('script-shortcut-prefix').value = sc.length > 0 ? sc[0] : "";
        document.getElementById('script-shortcut-name').value = sc.length > 1 ? sc.slice(1) : "";
        document.getElementById('script-content').value = script.content || "";
        document.getElementById('script-color').value = script.color || "#ff0000";
        
        const btnSalvar = document.querySelector('#admin-screen .btn-primary');
        if (btnSalvar) btnSalvar.innerText = "Atualizar Atalho";
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function saveScript() {
    const idEdicao = document.getElementById('edit-script-id').value;
    const title = document.getElementById('script-title').value;
    const func = document.getElementById('script-function').value;
    const shortcutPrefix = document.getElementById('script-shortcut-prefix').value.trim();
    const shortcutName = document.getElementById('script-shortcut-name').value.trim();
    const shortcut = shortcutPrefix && shortcutName ? shortcutPrefix + shortcutName : null;
    const content = document.getElementById('script-content').value;
    const color = document.getElementById('script-color').value;

    if (!content) return alert("O conteúdo do script é obrigatório!");

    // --- PROTEÇÃO: VERIFICA SE O BANCO ESTÁ CONECTADO ---
    if (!supabaseClient) {
        return alert("Erro: Conexão com o banco de dados não configurada. Verifique suas chaves.");
    }

    // --- LOGICA DE LIMITE DE 50 SCRIPTS ---
    if (!idEdicao) {
        try {
            const { count, error: countError } = await supabaseClient
                .from('scripts')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            if (count >= 50) {
                return alert("⚠️ Limite atingido! Você só pode ter no máximo 50 scripts.");
            }
        } catch (err) {
            return alert("Erro ao verificar limite: " + err.message);
        }
    }

    // --- MONTAGEM DOS DADOS ---
    const scriptData = {
        title: title || func || "Sem título",
        function_name: func || "Geral",
        shortcut: shortcut || null,
        content: content,
        color: color
    };

    // --- SALVAMENTO ---
    let result;
    if (idEdicao) {
        result = await supabaseClient.from('scripts').update(scriptData).eq('id', idEdicao);
    } else {
        result = await supabaseClient.from('scripts').insert([scriptData]);
    }

    if (!result.error) {
        showToast(idEdicao ? "Atalho atualizado!" : "Atalho criado!");
        
        // Limpa o formulário (se você tiver essa função definida)
        if (typeof resetFormAdmin === 'function') resetFormAdmin();
        
        loadScripts(true); // Recarrega a lista
    } else {
        alert("Erro ao salvar: " + result.error.message);
    }
}

function resetFormAdmin() {
    // Limpa o ID de edição para o sistema entender que o próximo é NOVO
    const idInput = document.getElementById('edit-script-id');
    if (idInput) idInput.value = '';

    // Limpa os textos
    document.getElementById('script-title').value = '';
    document.getElementById('script-function').value = '';
    document.getElementById('script-shortcut-prefix').value = '';
    document.getElementById('script-shortcut-name').value = '';
    document.getElementById('script-content').value = '';
    document.getElementById('script-color').value = '#ff0000';
    
    // Volta o texto do botão para "Criar"
    const btnSalvar = document.querySelector('#admin-screen .btn-primary');
    if (btnSalvar) {
        btnSalvar.innerText = "Criar Atalho";
        btnSalvar.style.background = "var(--accent)"; // Volta para a cor padrão
    }
}

// --- RENDERIZAÇÃO E UI ---

function renderMainGrid(list) {
    const grid = document.getElementById('grid-display');
    if (!grid) return;
    
    if (list.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; opacity: 0.5;">Nenhum script encontrado.</div>`;
        return;
    }

    grid.innerHTML = list.map(s => {
        const escapedContent = s.content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        return `
        <div class="script-card" style="border-left-color: ${s.color}" onclick="copyToClipboard(\`${escapedContent}\`)">
            <div>
                <h3>${s.title}${s.shortcut ? ` <span class="shortcut-badge">${s.shortcut}</span>` : ''}</h3>
                <p>${s.content}</p>
            </div>
            <small style="color: var(--accent); font-weight: bold; margin-top: 8px;">${s.function_name}</small>
        </div>`;
    }).join('');
}

function filtrarScripts() {
    const termo = document.getElementById('script-search').value.toLowerCase().trim();
    
    const filtrados = allScripts.filter(s => {
        const titulo = (s.title || "").toLowerCase();
        const categoria = (s.function_name || "").toLowerCase();
        const conteudo = (s.content || "").toLowerCase();
        const atalho = (s.shortcut || "").toLowerCase();
        
        return titulo.includes(termo) || categoria.includes(termo) || conteudo.includes(termo) || atalho.includes(termo);
    });

    renderMainGrid(filtrados);
}

function renderAdminList(list) {
    const adminList = document.getElementById('admin-list');
    if (!adminList) return;
    adminList.innerHTML = list.map(s => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border)">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:12px; height:12px; border-radius:50%; background:${s.color}"></div>
                <span style="font-size: 14px; color: var(--text-bold)">${s.title}${s.shortcut ? ` <span style="font-family:monospace; font-size:11px; opacity:0.5; margin-left:6px;">${s.shortcut}</span>` : ''}</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="editarScript(${s.id})" style="color:var(--accent); background:none; border:none; cursor:pointer; font-size: 12px; font-weight: bold;">Editar</button>
                <button onclick="deleteScript(${s.id})" style="color:#f85149; background:none; border:none; cursor:pointer; font-size: 12px; font-weight: bold;">Excluir</button>
            </div>
        </div>
    `).join('');
}

function tocarSomSucesso() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota A5
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1); // Nota E6

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
        console.warn("Áudio não suportado ou bloqueado pelo navegador.");
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copiado com sucesso!");
        tocarSomSucesso();
    });
}

function showToast(message, isError = false) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = message;
        t.style.background = isError ? "#f85149" : "var(--success)";
        t.style.visibility = 'visible'; t.style.opacity = '1';
        setTimeout(() => { t.style.visibility = 'hidden'; t.style.opacity = '0'; }, 2500);
    }
}

async function deleteScript(id) {
    if (!confirm("Tem certeza que deseja excluir este script?")) return;
    if (!supabaseClient) return;

    const { error } = await supabaseClient.from('scripts').delete().eq('id', id);
    if (!error) {
        showToast("Script excluído!");
        loadScripts(true);
    } else {
        alert("Erro ao excluir: " + error.message);
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurações de Interface (Scripts, Tema e Wallpaper)
    if (localStorage.getItem('docbox_hide_scripts') === 'true') {
        toggleScripts();
    }

    const savedTheme = localStorage.getItem('docbox_theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        document.documentElement.classList.remove('dark-mode');
    }

    const savedBg = localStorage.getItem('docbox_wallpaper');
    if (savedBg) {
        document.body.style.setProperty('--custom-bg', `url('${savedBg}')`);
        const bgInput = document.getElementById('bg-url');
        if (bgInput) bgInput.value = savedBg;
    }

    const savedHeaderColor = localStorage.getItem('docbox_header_color');
    if (savedHeaderColor) {
        document.documentElement.style.setProperty('--header-bg', savedHeaderColor);
        const colorInput = document.getElementById('header-color');
        if (colorInput) colorInput.value = savedHeaderColor;
    }

    // Restaura despertadores salvos e inicia o relógio em tempo real
    restaurarAlarmes();
    garantirRelogio();

    // 2. Verificação de Usuário e Sessão
    setTimeout(() => {
        if (!carregandoRecuperacao) {
            checkUser();
        }
    }, 100);

    // 3. RESTAURAR DADOS (Evita perda no F5)
    restaurarDadosTemporarios();

    // 4. BUSCA AUTOMÁTICA OTIMIZADA
    let debounceTimer;

    ['at-protocolo', 'at-doc'].forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', () => {
                const val = elemento.value.trim();
                
                if (val === "") {
                    ultimoProtocoloResgatado = "";
                    return;
                }

                clearTimeout(debounceTimer);
                // Só busca se tiver um tamanho mínimo razoável
                if (val.length >= 6) {
                    debounceTimer = setTimeout(() => {
                        buscarAtendimentoSalvo();
                    }, 400); // Debounce levemente maior para reduzir carga no banco
                }
            });
        }
    });

    // 5. SALVAMENTO DINÂMICO (Monitora todos os campos para o rascunho)
    const camposAtendimento = ['at-nome', 'at-protocolo', 'at-doc', 'at-tel', 'at-relato'];
    
    camposAtendimento.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            // Salva enquanto digita
            elemento.addEventListener('input', () => {
                salvarDadosTemporarios();
                if (id === 'at-nome') atualizarTituloPagina();
            });
            // Salva quando o campo é alterado via script (Botão Matrix)
            elemento.addEventListener('change', salvarDadosTemporarios);
        }
    });

    // 6. FORMATAÇÃO DE TELEFONE EM TEMPO REAL
    document.getElementById('at-tel')?.addEventListener('input', function() {
        let val = this.value.replace(/\D/g, "");
        if (val.length === 11 || (val.startsWith("55") && val.length === 13)) {
            this.value = formatarTelefone(this.value);
        }
    });

    // 7. MONITORAMENTO DE ATALHOS NO RELATO
    iniciarMonitoramentoAtalhos();

    // Inicializa ícones do Lucide
    lucide.createIcons();
});

// --- DROPDOWN DE ATALHOS NO RELATO ---
let dropdownState = {
    visible: false,
    selectedIndex: 0,
    resultados: [],
    inicioAtalho: 0,
    textoAteCursor: ''
};

function iniciarMonitoramentoAtalhos() {
    const editor = document.getElementById('at-relato');
    if (!editor) return;

    let debounceDropdown;

    editor.addEventListener('input', () => {
        clearTimeout(debounceDropdown);
        debounceDropdown = setTimeout(() => detectarAtalho(editor), 100);
    });

    editor.addEventListener('keydown', (e) => {
        if (!dropdownState.visible) return;

        const dropdown = document.getElementById('shortcut-dropdown');
        const items = dropdown?.querySelectorAll('.shortcut-dropdown-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            dropdownState.selectedIndex = Math.min(dropdownState.selectedIndex + 1, items.length - 1);
            atualizarItemAtivo(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            dropdownState.selectedIndex = Math.max(dropdownState.selectedIndex - 1, 0);
            atualizarItemAtivo(items);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (items && items[dropdownState.selectedIndex]) {
                e.preventDefault();
                const index = parseInt(items[dropdownState.selectedIndex].dataset.index);
                const script = dropdownState.resultados[index];
                if (script) inserirAtalhoDoDropdown(script, editor);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            esconderDropdown();
        }
    });

    editor.addEventListener('blur', () => {
        setTimeout(esconderDropdown, 200);
    });
}

function detectarAtalho(editor) {
    if (allScripts.length === 0) {
        esconderDropdown();
        return;
    }

    const infoCursor = obterTextoAteCursor(editor);
    if (!infoCursor.range) {
        esconderDropdown();
        return;
    }

    const textoAteCursor = infoCursor.texto;

    // Encontra o último caractere especial (não alfanumérico) no texto antes do cursor
    const matchEspecial = textoAteCursor.match(/[\W_](?=[\w_]*$)/);
    if (!matchEspecial) {
        esconderDropdown();
        return;
    }

    const prefixIndex = matchEspecial.index;

    // Verifica se está no início de uma palavra
    if (prefixIndex > 0) {
        const charAntes = textoAteCursor[prefixIndex - 1];
        if (charAntes !== ' ' && charAntes !== '\n' && charAntes !== '\t' && charAntes !== '(' && charAntes !== '[') {
            esconderDropdown();
            return;
        }
    }

    // Extrai a palavra parcial após o prefixo (incluindo ele)
    const depoisDoPrefix = textoAteCursor.slice(prefixIndex);
    const matchPalavra = depoisDoPrefix.match(/^[\W_]?[a-zA-Z0-9_]*/);
    const textoDigitado = matchPalavra ? matchPalavra[0].toLowerCase() : '';

    if (textoDigitado.length < 2) {
        esconderDropdown();
        return;
    }

    // Filtra scripts cujo shortcut (ex: #fate, %fatura) comece com o que foi digitado
    const resultados = allScripts.filter(s => {
        const atalho = (s.shortcut || '').toLowerCase();
        return atalho.startsWith(textoDigitado);
    });

    if (resultados.length === 0) {
        esconderDropdown();
        return;
    }

    dropdownState.resultados = resultados;
    dropdownState.selectedIndex = 0;
    dropdownState.inicioAtalho = prefixIndex;
    dropdownState.textoAteCursor = textoAteCursor;

    mostrarSugestoes(resultados, editor, infoCursor.range);
}

function mostrarSugestoes(resultados, editor, rangeCursor) {
    const dropdown = document.getElementById('shortcut-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = resultados.map((s, i) => `
        <div class="shortcut-dropdown-item ${i === 0 ? 'active' : ''}" data-index="${i}" data-id="${s.id}">
            <span class="s-dropdown-shortcut">${s.shortcut || '#' + (s.function_name || '').toLowerCase().replace(/\s+/g, '')}</span>
            <span class="s-dropdown-title">${s.title}</span>
        </div>
    `).join('');

    // Posiciona o dropdown logo abaixo do cursor (posição fixa na tela)
    const rect = rangeCursor.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.bottom + 8) + 'px';
    dropdown.classList.remove('hidden');

    dropdownState.visible = true;

    // Evento de clique nos itens
    dropdown.querySelectorAll('.shortcut-dropdown-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const index = parseInt(item.dataset.index);
            const script = resultados[index];
            if (script) inserirAtalhoDoDropdown(script, editor);
        });
    });
}

function inserirAtalhoDoDropdown(script, editor) {
    const conteudo = script.content || '';

    // Calcula quantos caracteres apagar (do início do atalho até o cursor)
    const infoCursor = obterTextoAteCursor(editor);
    const totalAteCursor = infoCursor.texto.length;
    const qtdApagar = totalAteCursor - dropdownState.inicioAtalho;
    if (qtdApagar < 0) {
        esconderDropdown();
        return;
    }

    // Monta os nós do conteúdo inserido (com quebras de linha)
    const nosInserir = [];
    conteudo.split('\n').forEach((linha, i) => {
        if (i > 0) nosInserir.push(document.createElement('br'));
        if (linha) nosInserir.push(document.createTextNode(linha));
    });

    // Localiza a posição de início do atalho dentro do editor
    const rangeInicio = posicionarRangePorOffset(editor, dropdownState.inicioAtalho);
    const range = document.createRange();
    range.setStart(rangeInicio.startContainer, rangeInicio.startOffset);

    // Remove o atalho digitado
    if (qtdApagar > 0) {
        const rangeFim = posicionarRangePorOffset(editor, dropdownState.inicioAtalho + qtdApagar);
        range.setEnd(rangeFim.startContainer, rangeFim.startOffset);
        range.deleteContents();
    } else {
        range.collapse(true);
    }

    // Insere o conteúdo
    nosInserir.forEach(n => {
        range.insertNode(n);
        range.setStartAfter(n);
    });
    range.collapse(true);

    // Posiciona o cursor no final do conteúdo inserido
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    esconderDropdown();
    editor.focus();
    salvarDadosTemporarios();
    lucide.createIcons();
}

// Obtém o texto (puro) do início do editor até o cursor, junto com o range atual
function obterTextoAteCursor(editor) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { texto: '', range: null };
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return { texto: '', range: null };

    const preRange = document.createRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.startContainer, range.startOffset);

    return { texto: preRange.toString(), range };
}

// Posiciona um range colapsado em um offset de texto dentro do editor
function posicionarRangePorOffset(editor, offset) {
    const range = document.createRange();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let total = 0;
    let node;
    while ((node = walker.nextNode())) {
        const tamanho = node.textContent.length;
        if (total + tamanho >= offset) {
            range.setStart(node, offset - total);
            range.collapse(true);
            return range;
        }
        total += tamanho;
    }
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
}

function esconderDropdown() {
    const dropdown = document.getElementById('shortcut-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    dropdownState.visible = false;
    dropdownState.resultados = [];
    dropdownState.selectedIndex = 0;
}

function atualizarItemAtivo(items) {
    if (!items) return;
    items.forEach((item, i) => {
        item.classList.toggle('active', i === dropdownState.selectedIndex);
    });
    items[dropdownState.selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

// --- FIM DO DROPDOWN DE ATALHOS ---

// --- EDITOR RICH TEXT (FORMATAÇÃO WYSIWYG) ---
let selecaoSalvaEditor = null;

document.addEventListener('selectionchange', () => {
    const editor = document.getElementById('at-relato');
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        selecaoSalvaEditor = sel.getRangeAt(0).cloneRange();
    }
});

function formatarTexto(comando) {
    const editor = document.getElementById('at-relato');
    if (!editor) return;

    editor.focus();

    // Restaura a seleção salva caso o clique no botão tenha tirado o foco do editor
    const sel = window.getSelection();
    if (selecaoSalvaEditor && (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode))) {
        sel.removeAllRanges();
        sel.addRange(selecaoSalvaEditor);
    }

    document.execCommand(comando, false, null);
    salvarDadosTemporarios();
    editor.focus();
}

function inserirLinhaSeparadora() {
    const editor = document.getElementById('at-relato');
    if (!editor) return;

    editor.focus();

    const sel = window.getSelection();
    let range = null;

    // Prioriza a seleção salva dentro do editor (posição do cursor)
    if (selecaoSalvaEditor && editor.contains(selecaoSalvaEditor.startContainer)) {
        range = selecaoSalvaEditor;
    } else if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
        range = sel.getRangeAt(0);
    } else {
        // Fallback: final do editor
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
    }

    // Colapsa a seleção para inserir exatamente no ponto do cursor
    if (!range.collapsed) range.collapse(true);

    const hr = document.createElement('hr');
    range.insertNode(hr);

    // Posiciona o cursor logo após a linha inserida
    range.setStartAfter(hr);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    editor.focus();
    salvarDadosTemporarios();
    showToast("Linha separadora inserida!");
}

function solicitarRecuperacao() {
    const email = document.getElementById('email').value;
    if (!email) return alert("Digite seu e-mail no campo acima!");

    // O erro "requested path is invalid" no Supabase Auth ocorre quando a URL de redirecionamento não está cadastrada na Vercel/Supabase Dashboard ou está sendo enviada de forma incompleta.
    // Vamos garantir que a URL seja exatamente a raiz do seu site (sem barras extras no final se possível).
    const siteUrl = window.location.origin;

    supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl,
    }).then(({error}) => {
        if (error) alert("Erro: " + error.message);
        else alert("E-mail de recuperação enviado! Verifique sua caixa de entrada e clique no link recebido.");
    });
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        carregandoRecuperacao = true;
        // Esconde a tela de carregamento se ainda estiver visível
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => { if (loading.parentNode) loading.remove(); }, 300);
        }
        showScreen('reset-password-screen');
    }
    // Quando o usuário faz login após redefinir a senha, redireciona para a tela principal
    if (event === "SIGNED_IN" && carregandoRecuperacao) {
        // Não redireciona automaticamente durante o fluxo de recuperação
        return;
    }
});

async function atualizarSenha() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password')?.value;

    if (!newPassword) return alert("Digite a nova senha!");
    
    // Validação mínima de segurança
    if (newPassword.length < 6) {
        return alert("A senha deve ter pelo menos 6 caracteres!");
    }

    // Verifica confirmação se o campo existir
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
        return alert("As senhas não coincidem! Verifique e tente novamente.");
    }

    const btn = document.querySelector('#reset-password-screen .btn-primary');
    if (btn) { btn.disabled = true; btn.innerText = 'Atualizando...'; }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        alert("Erro ao atualizar: " + error.message);
        if (btn) { btn.disabled = false; btn.innerText = 'Atualizar Senha'; }
    } else {
        alert("Senha atualizada com sucesso! Faça login com a nova senha.");
        carregandoRecuperacao = false;
        // Faz logout para forçar novo login com a senha atualizada
        await supabaseClient.auth.signOut();
        showScreen('auth-screen');
    }
}

async function aplicarWallpaper() {
    const url = document.getElementById('bg-url').value.trim();
    if (!url) return showToast("Insira uma URL válida", true);

    localStorage.setItem('docbox_wallpaper', url);
    document.body.style.setProperty('--custom-bg', `url('${url}')`);

    // Salvar no Supabase para persistência entre dispositivos
    if (currentUser && supabaseClient) {
        try {
            await supabaseClient
                .from('profiles')
                .upsert({ 
                    id: currentUser.id, 
                    wallpaper_url: url,
                    updated_at: new Date()
                });
        } catch (e) { console.error("Erro ao salvar no Supabase:", e); }
    }
    showToast("Wallpaper aplicado e salvo na conta!");
}

async function removerWallpaper() {
    localStorage.removeItem('docbox_wallpaper');
    document.body.style.setProperty('--custom-bg', 'none');
    document.getElementById('bg-url').value = '';

    if (currentUser && supabaseClient) {
        try {
            await supabaseClient
                .from('profiles')
                .upsert({ 
                    id: currentUser.id, 
                    wallpaper_url: null,
                    updated_at: new Date()
                });
        } catch (e) { console.error("Erro ao remover do Supabase:", e); }
    }
    showToast("Wallpaper removido");
}

// --- LÓGICA LGPD ---

function limparLGPD() {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`lgpd-tel${i}`);
        if (el) el.value = '';
    }
    const emailEl = document.getElementById('lgpd-email');
    if (emailEl) emailEl.value = '';
    showToast("Campos LGPD limpos!");
}

async function transferirLGPD(tipo) {
    try {
        const texto = await navigator.clipboard.readText();
        
        // Validação básica para garantir que é uma página de cliente válida do sistema
        if (!texto.includes("Clientes → Editar") && !texto.includes("Número")) {
            return alert("Os dados na área de transferência não parecem ser de um cliente válido.");
        }

        let dadosNovosInseridos = false;

        // Identifica qual aba foi copiada com base nos textos exclusivos de cada uma
        const ehAbaTelefone = texto.includes("Fone Principal") || texto.includes("Fone Alternativo") || texto.includes("WhatsApp");
        const ehAbaEmail = texto.includes("Email externo");

        // --- SE FOR A ABA DE TELEFONE ---
        if (ehAbaTelefone) {
            const diretos = texto.match(/\b(\d{2})(\d{8,9})\b/g) || [];
            if (diretos.length > 0) {
                const telefonesEncontrados = [...new Set(diretos)];
                
                for (let i = 0; i < 4 && i < telefonesEncontrados.length; i++) {
                    const campo = document.getElementById(`lgpd-tel${i + 1}`);
                    // Preenche apenas se o campo estiver vazio, preservando o e-mail ou outros telefones já preenchidos
                    if (campo && !campo.value) {
                        campo.value = telefonesEncontrados[i];
                        dadosNovosInseridos = true;
                    }
                }
            }
        }

        // --- SE FOR A ABA DE E-MAIL ---
        if (ehAbaEmail) {
            // Procura e-mails no texto, mas ignorando o e-mail técnico padrão do plano (*@desktop.com.br)
            const matches = texto.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
            const emailCliente = matches.find(e => !e.endsWith('@desktop.com.br'));

            if (emailCliente) {
                const emailEl = document.getElementById('lgpd-email');
                // Preenche apenas se o campo de e-mail estiver vazio, preservando os telefones já colados
                if (emailEl && !emailEl.value) {
                    emailEl.value = emailCliente;
                    dadosNovosInseridos = true;
                }
            }
        }

        if (dadosNovosInseridos) {
            showToast("Dados transferidos e acumulados com sucesso!");
            tocarSomSucesso();
        } else {
            showToast("Nenhum dado novo encontrado ou os campos já estão preenchidos.", true);
        }

    } catch (err) {
        showToast("Erro ao ler área de transferência", true);
    }
}

function copiarLGPD(tipo) {
    const telefones = [];
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`lgpd-tel${i}`);
        if (el) {
            const valor = el.value.trim();
            if (valor.length >= 10) {
                const ddd = valor.slice(0, 2);
                const numero = valor.slice(2);
                const ultimos4 = numero.slice(-4);
                telefones.push(`(${ddd}) X XXXX-${ultimos4}`);
            }
        }
    }

    const emailEl = document.getElementById('lgpd-email');
    const email = emailEl ? emailEl.value.trim() : '';
    const telFormatados = telefones.join(", ");
    
    let mensagem = `No seu cadastro constam as seguintes informações para contato: ${telFormatados}`;

    if (email) {
        const [usuario, dominio] = email.split("@");
        const emailFormatado = usuario.slice(0, 2) + "********@" + dominio;
        mensagem += ` e ${emailFormatado}. Deseja remover ou adicionar algum contato?`;
    } else {
        mensagem += `. Deseja remover ou adicionar algum contato?\nIdentificamos que não há e-mail cadastrado em sistema, deseja adicionar algum?`;
    }

    navigator.clipboard.writeText(mensagem).then(() => {
        showToast("Mensagem LGPD copiada!");
        tocarSomSucesso();
    });
}
//___________________________________//

function salvarDadosTemporarios() {
    const dados = {
        nome: document.getElementById('at-nome')?.value,
        protocolo: document.getElementById('at-protocolo')?.value,
        doc: document.getElementById('at-doc')?.value,
        tel: document.getElementById('at-tel')?.value,
        relato: document.getElementById('at-relato')?.innerHTML,
        tabId: TAB_ID // Guardamos o ID da aba no objeto
    };
    
    // Salvamos com uma chave ÚNICA para esta aba
    localStorage.setItem(`docbox_temp_${TAB_ID}`, JSON.stringify(dados));
}

function restaurarDadosTemporarios() {
    // Busca o dado específico desta aba
    const salvo = localStorage.getItem(`docbox_temp_${TAB_ID}`);
    if (salvo) {
        const d = JSON.parse(salvo);
        if (d.nome) document.getElementById('at-nome').value = d.nome;
        if (d.protocolo) document.getElementById('at-protocolo').value = d.protocolo;
        if (d.doc) document.getElementById('at-doc').value = d.doc;
        if (d.tel) document.getElementById('at-tel').value = d.tel;
        if (d.relato) document.getElementById('at-relato').innerHTML = d.relato;
        if (d.nome) atualizarTituloPagina();
    }
}

function abrirNovaAba() {
    // Cria o link primeiro para o navegador não bloquear o pop-up
    const urlComReset = `${window.location.origin}${window.location.pathname}?reset=true`;
    
    // Abre imediatamente
    const novaAba = window.open(urlComReset, '_blank');
    
    // Se por acaso a aba abrir, mas o foco não for nela:
    if (novaAba) novaAba.focus();
}

// Adicione este bloco no final do seu script.js ou dentro do window.onload
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    
    // Se a URL tiver o "reset=true", limpa os campos sem perguntar nada
    if (params.get('reset') === 'true') {
        // Limpa os IDs específicos que você tem no HTML
        document.title = 'DocBox';
        document.getElementById('at-nome').value = '';
        document.getElementById('at-protocolo').value = '';
        document.getElementById('at-doc').value = '';
        document.getElementById('at-tel').value = '';
        document.getElementById('at-relato').innerHTML = '';
        
        // Remove qualquer rascunho salvo no navegador (localStorage)
        localStorage.removeItem('atendimento_rascunho'); 
        
        // Limpa a URL para não resetar de novo se o usuário der F5
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

function toggleScripts() {
    // Pega o container que engloba os scripts e o formulário
    const container = document.querySelector('.main-content'); 
    container.classList.toggle('scripts-hidden');

    // Opcional: Salva a preferência do usuário
    const isHidden = container.classList.contains('scripts-hidden');
    localStorage.setItem('docbox_hide_scripts', isHidden);

    // Atualiza o ícone (exemplo: troca entre grid e foco)
    const btn = document.getElementById('toggle-scripts-btn');
    const icon = isHidden ? 'maximize' : 'layout-grid';
    btn.innerHTML = `<i data-lucide="${icon}"></i><span>${isHidden ? '' : ''}</span>`;
    
    lucide.createIcons();
}

function salvarNoHistoricoLocal() {
    const nome = document.getElementById('at-nome')?.value.trim() || "";
    const protocolo = document.getElementById('at-protocolo')?.value.trim() || "";
    const doc = document.getElementById('at-doc')?.value.trim() || "";

    // --- REGRA DE OURO: VALIDAÇÃO DOS 3 PILARES ---
    // Só salva se tiver os 3 preenchidos. Se faltar um, ele não polui o histórico.
    if (!nome || !protocolo || !doc) {
        return; 
    }

    // --- TRAVA: Evita salvar o que você acabou de recuperar do banco ---
    if (atendimentoRecuperadoOriginal && 
        atendimentoRecuperadoOriginal.nome === nome && 
        atendimentoRecuperadoOriginal.protocolo === protocolo && 
        atendimentoRecuperadoOriginal.documento === doc) {
        
        atendimentoRecuperadoOriginal = null; // Reseta para a próxima ação
        return; 
    }

    // Carrega o histórico existente
    let historico = JSON.parse(localStorage.getItem('docbox_historico')) || [];

    // --- FILTRO ANTI-DUPLICIDADE: Não salva o mesmo cliente duas vezes seguidas ---
    if (historico.length > 0) {
        const ultimo = historico[0];
        if (ultimo.protocolo === protocolo && ultimo.documento === doc) {
            return;
        }
    }

    // --- CRIAÇÃO DO ITEM ---
    const item = {
        id: Date.now(),
        nome: nome,
        protocolo: protocolo,
        documento: doc,
        // Formato de hora amigável para o histórico
        data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    // Adiciona no topo da lista
    historico.unshift(item);

    // Mantém apenas os últimos 8 registros para o histórico ficar limpo e rápido
    if (historico.length > 8) {
        historico = historico.slice(0, 8);
    }

    // Salva no navegador
    localStorage.setItem('docbox_historico', JSON.stringify(historico));
    
    // Reseta a trava global de recuperação
    atendimentoRecuperadoOriginal = null;

    // Se você tiver uma função que desenha o histórico na tela, chame-a aqui:
    if (typeof renderHistorico === 'function') {
        renderHistorico();
    }
}

// --- FUNÇÕES DE VALIDAÇÃO DE SENHA EM TEMPO REAL (TELA DE CADASTRO) ---

function validarSenhaSignup() {
    const senha = document.getElementById('signup-password')?.value || '';
    
    // Validação dos requisitos
    const temMinimo = senha.length >= 6;
    const temLetra = /[a-zA-Z]/.test(senha);
    const temNumero = /[0-9]/.test(senha);

    // Atualiza as regras visuais
    atualizarRegra('rule-length', temMinimo);
    atualizarRegra('rule-letter', temLetra);
    atualizarRegra('rule-number', temNumero);

    // Calcula força
    let forca = 0;
    if (temMinimo) forca++;
    if (temLetra) forca++;
    if (temNumero) forca++;
    if (senha.length >= 8) forca++;
    if (/[^a-zA-Z0-9]/.test(senha)) forca++; // Símbolo especial

    const fill = document.getElementById('signup-strength-fill');
    const label = document.getElementById('signup-strength-label');
    
    if (fill && label) {
        const pct = (forca / 5) * 100;
        fill.style.width = pct + '%';
        
        if (forca <= 1) {
            fill.style.background = '#f85149';
            label.innerText = 'Senha fraca';
            label.style.color = '#f85149';
        } else if (forca <= 3) {
            fill.style.background = '#e3b341';
            label.innerText = 'Senha média';
            label.style.color = '#e3b341';
        } else {
            fill.style.background = '#3fb950';
            label.innerText = 'Senha forte';
            label.style.color = '#3fb950';
        }
    }
}

function validarConfirmacaoSignup() {
    const senha = document.getElementById('signup-password')?.value || '';
    const confirmar = document.getElementById('signup-confirm-password')?.value || '';
    const input = document.getElementById('signup-confirm-password');
    
    if (!input || !confirmar) return;
    
    if (senha === confirmar) {
        input.style.borderColor = '#3fb950';
    } else {
        input.style.borderColor = '#f85149';
    }
}

function atualizarRegra(id, valido) {
    const el = document.getElementById(id);
    if (!el) return;
    if (valido) {
        el.classList.add('rule-ok');
        el.classList.remove('rule-fail');
    } else {
        el.classList.remove('rule-ok');
        el.classList.add('rule-fail');
    }
}

// --- PERSONALIZAÇÃO DA COR DO CABEÇALHO ---
function aplicarCorHeader() {
    const input = document.getElementById('header-color');
    if (!input) return;
    const cor = input.value;

    document.documentElement.style.setProperty('--header-bg', cor);
    localStorage.setItem('docbox_header_color', cor);

    if (currentUser && supabaseClient) {
        supabaseClient
            .from('profiles')
            .upsert({ id: currentUser.id, header_color: cor, updated_at: new Date() })
            .then(() => {});
    }
    showToast("Cor do cabeçalho aplicada!");
}

function removerCorHeader() {
    document.documentElement.style.removeProperty('--header-bg');
    localStorage.removeItem('docbox_header_color');

    if (currentUser && supabaseClient) {
        supabaseClient
            .from('profiles')
            .upsert({ id: currentUser.id, header_color: null, updated_at: new Date() })
            .then(() => {});
    }
    showToast("Cor do cabeçalho removida!");
}

// --- DESPERTADOR DE PAUSAS (HORA EXATA) ---
let alarmes = [];
let relogioInterval = null;
let alarmeSomInterval = null;
let alarmeAtivo = false;
let alarmeAtual = null;
let filaAlarmes = [];

function adicionarAlarme() {
    const timeInput = document.getElementById('alarm-time');
    const labelInput = document.getElementById('alarm-label');
    if (!timeInput) return;

    const valor = timeInput.value.trim();
    if (!valor) return showToast("Escolha a hora do despertador!", true);

    const [horaStr, minStr] = valor.split(':');
    const horas = parseInt(horaStr, 10);
    const minutos = parseInt(minStr, 10);
    if (isNaN(horas) || isNaN(minutos)) return showToast("Hora inválida!", true);

    const label = (labelInput?.value.trim() || "") || ("Pausa " + (alarmes.length + 1));

    // Calcula o próximo horário de disparo (se já passou hoje, dispara amanhã)
    const agora = new Date();
    const alvo = new Date(agora);
    alvo.setHours(horas, minutos, 0, 0);
    const isTomorrow = alvo <= agora;
    if (isTomorrow) alvo.setDate(alvo.getDate() + 1);

    const alarme = {
        id: Date.now() + Math.random(),
        label: label,
        horas: horas,
        minutos: minutos,
        endAt: alvo.getTime(),
        status: 'pending',
        isTomorrow: isTomorrow
    };

    alarmes.push(alarme);
    timeInput.value = '';
    if (labelInput) labelInput.value = '';

    garantirRelogio();
    renderAlarmes();
    salvarAlarmes();

    showToast(isTomorrow
        ? `Despertador criado para amanhã às ${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}!`
        : `Despertador criado para hoje às ${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}!`);
}

function removerAlarme(id) {
    alarmes = alarmes.filter(a => a.id !== id);
    renderAlarmes();
    salvarAlarmes();
    atualizarRelogioHeader();
}

function garantirRelogio() {
    if (relogioInterval) return;
    relogioInterval = setInterval(() => {
        atualizarRelogioHeader();
        verificarAlarmes();
    }, 1000);
    atualizarRelogioHeader();
    verificarAlarmes();
}

// Relógio em tempo real no cabeçalho + contagem para a próxima pausa
function atualizarRelogioHeader() {
    const clockEl = document.getElementById('header-clock');
    const timeEl = document.getElementById('header-clock-time');
    const nextEl = document.getElementById('header-clock-next');
    if (!clockEl || !timeEl || !nextEl) return;

    const agora = new Date();
    timeEl.textContent = agora.toLocaleTimeString('pt-BR');

    const proximo = alarmes
        .filter(a => a.status === 'pending' || a.status === 'done')
        .sort((a, b) => a.endAt - b.endAt)[0];

    if (proximo) {
        if (proximo.status === 'done') {
            nextEl.textContent = `⏰ ${proximo.label} tocou!`;
            clockEl.classList.add('alarm-soon');
            return;
        }
        const restante = Math.max(0, proximo.endAt - agora.getTime());
        const horaAlvo = `${String(proximo.horas).padStart(2, '0')}:${String(proximo.minutos).padStart(2, '0')}`;
        nextEl.textContent = `${proximo.label} às ${horaAlvo} · em ${formatarDuracao(restante)}`;
        clockEl.classList.toggle('alarm-soon', restante <= 5 * 60 * 1000);
    } else {
        nextEl.textContent = 'Sem despertadores';
        clockEl.classList.remove('alarm-soon');
    }
}

function formatarDuracao(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function verificarAlarmes() {
    const agora = Date.now();
    let mudou = false;

    alarmes.forEach(a => {
        if (a.status !== 'pending') return;
        if (a.endAt <= agora) {
            a.status = 'done';
            mudou = true;
            filaAlarmes.push(a);
        }
    });

    if (mudou) {
        renderAlarmes();
        salvarAlarmes();
    }

    processarFilaAlarmes();
}

function renderAlarmes() {
    const list = document.getElementById('alarm-list');
    if (!list) return;

    if (alarmes.length === 0) {
        list.innerHTML = '<p class="timer-empty">Nenhum despertador ativo. Escolha um horário acima para criar o primeiro.</p>';
    } else {
        const ordenados = [...alarmes].sort((a, b) => a.endAt - b.endAt);
        list.innerHTML = ordenados.map(a => {
            const pendente = a.status === 'pending';
            const restante = pendente ? Math.max(0, a.endAt - Date.now()) : 0;
            const horaAlvo = `${String(a.horas).padStart(2, '0')}:${String(a.minutos).padStart(2, '0')}`;
            return `
            <div class="timer-item ${!pendente ? 'done' : ''}">
                <div class="timer-info">
                    <span class="timer-label">
                        <span class="timer-seq">${horaAlvo}${pendente && a.isTomorrow ? ' · amanhã' : ''}</span>
                        ${a.label}
                        ${!pendente ? '<span class="timer-seq" style="background: rgba(248,81,73,0.15); color: #f85149;">Tocou</span>' : ''}
                    </span>
                    <span class="timer-time">${pendente ? 'em ' + formatarDuracao(restante) : '00:00'}</span>
                </div>
                <div class="timer-actions">
                    <button class="btn-danger timer-btn" onclick="removerAlarme(${a.id})" title="Remover"><i data-lucide="trash-2"></i></button>
                </div>
            </div>`;
        }).join('');
    }

    lucide.createIcons();
    atualizarRelogioHeader();
}

function processarFilaAlarmes() {
    if (alarmeAtivo || filaAlarmes.length === 0) return;
    const alarme = filaAlarmes.shift();
    alarmeAtual = alarme;
    alarmeAtivo = true;
    mostrarAlarme(alarme);
    iniciarSomAlarme();
}

function mostrarAlarme(alarme) {
    const alertEl = document.getElementById('timer-alert');
    const msg = document.getElementById('timer-alert-msg');
    if (msg) {
        const horaAlvo = alarme
            ? `${String(alarme.horas).padStart(2, '0')}:${String(alarme.minutos).padStart(2, '0')}`
            : '';
        msg.innerText = alarme && alarme.label
            ? `O despertador "${alarme.label}" (${horaAlvo}) tocou. Levante, alongue-se e descanse os olhos!`
            : 'Hora da pausa! Levante, alongue-se e descanse os olhos.';
    }
    if (alertEl) alertEl.classList.remove('hidden');
}

function esconderAlarme() {
    const alertEl = document.getElementById('timer-alert');
    if (alertEl) alertEl.classList.add('hidden');
}

function dismissAlarme() {
    alarmeAtivo = false;
    pararSomAlarme();
    esconderAlarme();

    if (alarmeAtual) {
        alarmes = alarmes.filter(a => a.id !== alarmeAtual.id);
        showToast("Despertador removido!");
        alarmeAtual = null;
    }

    renderAlarmes();
    salvarAlarmes();
    processarFilaAlarmes();
}

function iniciarSomAlarme() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const tocar = () => {
            [0, 0.35, 0.7].forEach(atraso => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + atraso);
                gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + atraso + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + atraso + 0.3);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + atraso);
                osc.stop(audioCtx.currentTime + atraso + 0.35);
            });
        };

        tocar();
        alarmeSomInterval = setInterval(tocar, 1800);
    } catch (e) {
        console.warn("Som de alarme indisponível.");
    }
}

function pararSomAlarme() {
    if (alarmeSomInterval) {
        clearInterval(alarmeSomInterval);
        alarmeSomInterval = null;
    }
}

function salvarAlarmes() {
    const dados = alarmes.map(a => ({
        id: a.id,
        label: a.label,
        horas: a.horas,
        minutos: a.minutos,
        endAt: a.endAt,
        status: a.status,
        isTomorrow: a.isTomorrow
    }));
    localStorage.setItem('docbox_alarmes', JSON.stringify(dados));
}

function restaurarAlarmes() {
    try {
        const salvo = localStorage.getItem('docbox_alarmes');
        if (!salvo) return;
        const dados = JSON.parse(salvo);

        alarmes = dados.map(d => {
            // Se o horário já passou enquanto o app estava fechado, dispara ao abrir
            if (d.endAt <= Date.now()) {
                return { ...d, endAt: Date.now(), status: 'pending', isTomorrow: false };
            }
            return d;
        });

        renderAlarmes();
        garantirRelogio();
    } catch (e) {
        console.warn("Erro ao restaurar despertadores:", e);
    }
}

// Garante que o relógio e os despertadores estejam corretos ao voltar para a aba
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        atualizarRelogioHeader();
        verificarAlarmes();
    }
});

// EXPOSIÇÃO GLOBAL COMPLETA
window.handleLogin = handleLogin;
window.handleSignUp = handleSignUp;
window.handleLogout = handleLogout;
window.toggleSidebar = toggleSidebar;
window.showScreen = showScreen;
window.toggleTheme = toggleTheme;
window.toggleScripts = toggleScripts;
window.abrirNovaAba = abrirNovaAba;
window.filtrarScripts = filtrarScripts;

// Funções de Atendimento e Scripts
window.processarDoc = processarDoc;
window.preencherTitular = preencherTitular;
window.transferirAtendimento = transferirAtendimento;
window.copiarRegistro = copiarRegistro;
window.saveAtendimento = saveAtendimento;
window.limparCampos = limparCampos;

// Funções LGPD
window.limparLGPD = limparLGPD;
window.transferirLGPD = transferirLGPD;
window.copiarLGPD = copiarLGPD;
window.copyToClipboard = copyToClipboard; 

// Funções do Painel Admin
window.saveScript = saveScript;
window.editarScript = editarScript;
window.deleteScript = deleteScript;
window.resetFormAdmin = resetFormAdmin;
window.aplicarWallpaper = aplicarWallpaper;
window.removerWallpaper = removerWallpaper;
window.solicitarRecuperacao = solicitarRecuperacao;
window.atualizarSenha = atualizarSenha;
window.validarSenhaSignup = validarSenhaSignup;
window.validarConfirmacaoSignup = validarConfirmacaoSignup;

// Novas funções: editor rich text, despertador e cor do cabeçalho
window.formatarTexto = formatarTexto;
window.inserirLinhaSeparadora = inserirLinhaSeparadora;
window.adicionarAlarme = adicionarAlarme;
window.removerAlarme = removerAlarme;
window.dismissAlarme = dismissAlarme;
window.aplicarCorHeader = aplicarCorHeader;
window.removerCorHeader = removerCorHeader;

// --- FUNÇÃO PARA RENDERIZAR O HISTÓRICO LOCAL ---
window.renderHistorico = function() {
    const listaContainer = document.getElementById('history-list');
    if (!listaContainer) return;
    
    const historico = JSON.parse(localStorage.getItem('docbox_historico')) || [];

    if (historico.length === 0) {
        listaContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 20px;">Histórico vazio.</p>';
        return;
    }

    listaContainer.innerHTML = historico.map(at => `
        <div class="history-card" style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 10px; position: relative;">
            <button onclick="excluirItemHistorico(${at.id})" style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: #f85149; cursor: pointer; font-size: 16px; font-weight: bold; padding: 5px;">
                &times;
            </button>

            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px; padding-right: 20px;">
                <h4 style="margin:0; color:var(--accent); font-size: 14px;">${at.nome}</h4>
                <small style="opacity:0.5; font-size: 10px;">${at.data}</small>
            </div>
            <div style="font-size: 12px; line-height: 1.4;">
                <p style="margin: 2px 0;"><strong>Prot:</strong> ${at.protocolo}</p>
                <p style="margin: 2px 0;"><strong>Doc:</strong> ${at.documento}</p>
            </div>
            <button class="btn-secondary" onclick="reaproveitarAtendimento(${at.id})" style="width: 100%; margin-top: 10px; padding: 6px; font-size: 11px; cursor: pointer;">
                Recuperar Dados
            </button>
        </div>
    `).join('');
};

window.excluirItemHistorico = function(id) {
    // 1. Pega o histórico atual
    let historico = JSON.parse(localStorage.getItem('docbox_historico')) || [];
    
    // 2. Filtra removendo o item com o ID clicado
    historico = historico.filter(item => item.id !== id);
    
    // 3. Salva de volta no LocalStorage
    localStorage.setItem('docbox_historico', JSON.stringify(historico));
    
    // 4. Atualiza a tela imediatamente
    renderHistorico();
    
    showToast("Item removido do histórico");
};


// Função para jogar os dados de volta nos campos de texto
window.reaproveitarAtendimento = function(id) {
    const historico = JSON.parse(localStorage.getItem('docbox_historico')) || [];
    const at = historico.find(item => item.id === id);
    
    if (at) {
        document.getElementById('at-nome').value = at.nome !== "Sem Nome" ? at.nome : "";
        document.getElementById('at-protocolo').value = at.protocolo !== "Sem Protocolo" ? at.protocolo : "";
        document.getElementById('at-doc').value = at.documento !== "Sem CPF/CNPJ" ? at.documento : "";
        
        // --- NOVA TRAVA: Guarda uma cópia do que foi recuperado ---
        atendimentoRecuperadoOriginal = {
            nome: document.getElementById('at-nome').value,
            protocolo: document.getElementById('at-protocolo').value,
            documento: document.getElementById('at-doc').value
        };

        showScreen('main-screen');
        if (typeof atualizarTituloPagina === 'function') atualizarTituloPagina();
    }
};

// --- TOGGLE DE VISIBILIDADE DE SENHA ---
window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    // Busca o botão de forma segura, seja via event ou pelo pai do input
    const button = (window.event && window.event.currentTarget) || document.querySelector(`#${inputId} + .btn-toggle-password`);
    
    if (!input) return;
    
    // Alterna entre password e text
    const isCurrentlyPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isCurrentlyPassword ? 'text' : 'password');
    
    if (button) {
        // Adiciona animação ao botão
        button.classList.add('active');
        setTimeout(() => button.classList.remove('active'), 300);
        
        // Alterna o ícone: se virou texto (visível), mostra "eye". Se virou password (escondido), mostra "eye-off".
        const icon = button.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isCurrentlyPassword ? 'eye' : 'eye-off');
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
};
