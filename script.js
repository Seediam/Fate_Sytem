// Inicialização do SDK do Owlbear Rodeo
OBR.onReady(() => {
    console.log("Fate_System Inicializado com Sucesso!");
    // Aqui no futuro vamos colocar os Listeners de movimento e os metadata dos tokens
});

// --- SISTEMA DE ABAS ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove 'active' de todas as abas e botões
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Adiciona 'active' na aba clicada
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
    });
});

// --- SISTEMA DE LOG DE RESULTADOS ---
const logOverlay = document.getElementById('combatLogOverlay');
const logContent = document.getElementById('combatLogContent');
const closeLogBtn = document.getElementById('closeLogBtn');

closeLogBtn.addEventListener('click', () => {
    logOverlay.classList.add('hidden');
});

/**
 * Exibe a mensagem de dano na janela de resultados
 * @param {string} tokenName - Nome do alvo
 * @param {number} damage - Valor do dano
 * @param {string} skillName - Nome da habilidade usada
 */
function logDamageResult(tokenName, damage, skillName) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // Montando a frase com spans para colorir via CSS
    entry.innerHTML = `O alvo <span class="highlight-token">${tokenName}</span> sofreu <span class="highlight-damage">${damage} de dano</span> do ataque <span class="highlight-skill">${skillName}</span>.`;
    
    // Adiciona no topo da lista
    logContent.prepend(entry);
    
    // Mostra a janela se estiver escondida
    logOverlay.classList.remove('hidden');

    // Mantém apenas os últimos 5 registros para não poluir a tela
    if (logContent.children.length > 5) {
        logContent.lastChild.remove();
    }
}

// --- MOCK DE TESTE (Para vermos funcionando agora) ---
// Quando clicar no botão de conjurar da Aba Spells, disparamos um teste
const castSpellBtn = document.getElementById('castSpellBtn');
castSpellBtn.addEventListener('click', () => {
    const spellName = document.getElementById('spellName').value || "Ataque Desconhecido";
    
    // Isso é temporário! Depois vamos puxar o alvo real selecionado com a "mira" e rolar os dados de verdade.
    const alvoSimulado = "Stand Inimigo"; 
    const danoSimulado = Math.floor(Math.random() * 20) + 1; // Rola 1d20 de mentira

    logDamageResult(alvoSimulado, danoSimulado, spellName);
});
