const FATE_ID = "com.fatesystem.metadata";
let activeTokenId = null;
let isAiming = false;
let targetedTokens = [];
let originalPositions = {}; // Para o sistema de movimento

OBR.onReady(() => {
    setupTabs();
    setupMatriz();
    setupSpells();
    setupMovementTracker();
});

function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    }));
    document.getElementById('closeLogBtn').addEventListener('click', () => {
        document.getElementById('combatLogOverlay').classList.add('hidden');
    });
}

function setupMatriz() {
    const regBtn = document.getElementById('registerTokenBtn');
    const updateBtn = document.getElementById('updateHudBtn');
    
    regBtn.addEventListener('click', async () => {
        const selection = await OBR.player.getSelection();
        if (!selection || selection.length === 0) return alert("Selecione um token!");
        const items = await OBR.scene.items.getItems(selection);
        activeTokenId = items[0].id;
        document.getElementById('activeTokenName').innerText = items[0].name || "Token Sem Nome";
        
        const meta = items[0].metadata[FATE_ID] || { hp: "100/100", mana: "50/50" };
        document.getElementById('hpInput').value = meta.hp;
        document.getElementById('manaInput').value = meta.mana;
    });

    updateBtn.addEventListener('click', async () => {
        if (!activeTokenId) return;
        let hpVal = document.getElementById('hpInput').value.trim();
        let manaVal = document.getElementById('manaInput').value.trim();
        
        // Matemática do HP (-X ou +X)
        const items = await OBR.scene.items.getItems([activeTokenId]);
        let meta = items[0].metadata[FATE_ID] || { hp: "100/100", mana: "50/50" };
        
        if (hpVal.startsWith('-') || hpVal.startsWith('+')) {
            let [atual, max] = meta.hp.split('/').map(Number);
            atual += parseInt(hpVal);
            hpVal = `${atual}/${max}`;
            document.getElementById('hpInput').value = hpVal;
        }

        // Salva metadados e atualiza texto visual no mapa (HUD)
        await OBR.scene.items.updateItems([activeTokenId], (tokens) => {
            tokens[0].metadata[FATE_ID] = { hp: hpVal, mana: manaVal };
        });
        updateVisualHUD(activeTokenId, hpVal, manaVal);
    });
}

async function updateVisualHUD(tokenId, hp, mana) {
    const textId = `${tokenId}-hud`;
    const existing = await OBR.scene.items.getItems([textId]);
    const isGmOnly = document.getElementById('gmOnlyHudToggle').checked;
    const role = await OBR.player.getRole();
    
    const textContent = `HP: ${hp} | MP: ${mana}`;

    if (existing.length > 0) {
        await OBR.scene.items.updateItems([textId], (items) => {
            items[0].text.plainText = textContent;
            items[0].visible = isGmOnly ? (role === "GM") : true;
        });
    } else {
        // Cria o texto grudado no token
        const parent = await OBR.scene.items.getItems([tokenId]);
        const textItem = {
            id: textId,
            type: "TEXT",
            text: { type: "PLAIN", plainText: textContent },
            x: parent[0].x,
            y: parent[0].y + 50, // Fica embaixo do token
            attachedTo: tokenId,
            locked: true,
            layer: "TEXT",
            visible: isGmOnly ? (role === "GM") : true
        };
        await OBR.scene.local.addItems([textItem]); // Usa local/scene dependendo da permissão
    }
}

function setupSpells() {
    const aimBtn = document.getElementById('aimBtn');
    
    aimBtn.addEventListener('click', () => {
        isAiming = !isAiming;
        aimBtn.innerText = isAiming ? "🛑 Parar Mira" : "🎯 Iniciar Mira";
        aimBtn.classList.toggle('active', isAiming);
        if(isAiming) targetedTokens = [];
        updateTargetUI();
    });

    OBR.player.onChange(async (player) => {
        if (isAiming && player.selection.length > 0) {
            const items = await OBR.scene.items.getItems(player.selection);
            items.forEach(item => {
                if (!targetedTokens.find(t => t.id === item.id) && item.layer === "CHARACTER") {
                    targetedTokens.push({ id: item.id, name: item.name || "Alvo" });
                }
            });
            updateTargetUI();
        }
    });

    document.getElementById('castSpellBtn').addEventListener('click', async () => {
        if (targetedTokens.length === 0) return alert("Mire em alguém!");
        
        const name = document.getElementById('spellName').value || "Ataque";
        let totalDmg = rollDice(document.getElementById('baseDice').value);
        
        // Soma Runas
        for(let i=1; i<=3; i++) {
            const type = document.getElementById(`rune${i}Type`).value;
            if(type !== "none") {
                totalDmg += rollDice(document.getElementById(`rune${i}Dice`).value);
            }
        }

        const autoKill = document.getElementById('autoKillToggle').checked;

        for (const target of targetedTokens) {
            const items = await OBR.scene.items.getItems([target.id]);
            if(items.length > 0) {
                let meta = items[0].metadata[FATE_ID] || { hp: "100/100" };
                let [atual, max] = meta.hp.split('/').map(Number);
                atual -= totalDmg;
                
                const newHp = `${atual}/${max}`;
                await OBR.scene.items.updateItems([target.id], (t) => {
                    t[0].metadata[FATE_ID].hp = newHp;
                });
                updateVisualHUD(target.id, newHp, meta.mana);
                logCombat(target.name, totalDmg, name);

                // Auto-kill visual (Deixa translúcido)
                if(atual <= 0 && autoKill) {
                    await OBR.scene.items.updateItems([target.id], t => t[0].opacity = 0.4);
                }
            }
        }
        
        // Reseta mira
        isAiming = false;
        aimBtn.innerText = "🎯 Iniciar Mira";
        aimBtn.classList.remove('active');
        targetedTokens = [];
        updateTargetUI();
    });
}

function setupMovementTracker() {
    // Registra posições iniciais ao selecionar
    OBR.player.onChange(async (player) => {
        if(player.selection.length > 0) {
            const items = await OBR.scene.items.getItems(player.selection);
            items.forEach(i => originalPositions[i.id] = {x: i.x, y: i.y});
        }
    });

    // Impede movimento se passar do limite
    OBR.scene.items.onChange(async (items) => {
        const limit = parseInt(document.getElementById('moveLimit').value) || 0;
        if (limit === 0) return; // 0 = Livre

        const dpi = await OBR.scene.grid.getDpi(); // Para converter pixels em Ft.
        const scale = await OBR.scene.grid.getScale(); 
        
        items.forEach(async item => {
            if (originalPositions[item.id] && item.layer === "CHARACTER") {
                const orig = originalPositions[item.id];
                // Distância Euclidiana básica
                const distPx = Math.sqrt(Math.pow(item.x - orig.x, 2) + Math.pow(item.y - orig.y, 2));
                const distFt = (distPx / dpi) * scale.parsed.multiplier;

                if (distFt > limit) {
                    // Retorna o token para a posição original
                    await OBR.scene.items.updateItems([item.id], t => {
                        t[0].x = orig.x;
                        t[0].y = orig.y;
                    });
                }
            }
        });
    });
}

function updateTargetUI() {
    const list = document.getElementById('targetList');
    list.innerHTML = targetedTokens.length ? targetedTokens.map(t => `• ${t.name}`).join('<br>') : "Nenhum alvo na mira.";
}

function rollDice(diceString) {
    if(!diceString) return 0;
    const parts = diceString.toLowerCase().split('d');
    const qtd = parseInt(parts[0]) || 1;
    const faces = parseInt(parts[1]) || 0;
    let total = 0;
    for(let i=0; i<qtd; i++) total += Math.floor(Math.random() * faces) + 1;
    return total;
}

function logCombat(target, dmg, skill) {
    const log = document.getElementById('combatLogContent');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span style="color:var(--accent)">[SISTEMA]</span> <b style="color:white">${target}</b> sofreu <b style="color:var(--danger)">${dmg} de dano</b> de <i>${skill}</i>.`;
    log.prepend(entry);
    document.getElementById('combatLogOverlay').classList.remove('hidden');
    if(log.children.length > 5) log.lastChild.remove();
}
