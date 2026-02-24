const FATE_ID = "com.fatesystem.metadata";
let isAiming = false;
let targetedTokens = [];
let originalPositions = {};

// Ícone SVG embutido em Base64 (Nunca vai falhar)
const MENU_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 2.18l7 3.89v4.93c0 4.27-2.61 8.27-7 9.38-4.39-1.11-7-5.11-7-9.38V8.07l7-3.89z'/%3E%3C/svg%3E";

OBR.onReady(() => {
    setupTabs();
    setupContextMenu(); 
    setupMatriz();
    setupSpells();
    setupMovementTracker();
});

// CRIA O BOTÃO NO MENU DO TOKEN
function setupContextMenu() {
    OBR.contextMenu.create({
        id: "com.fatesystem.add",
        icons: [{
            icon: MENU_ICON, 
            label: "Add to Fate Matriz",
            filter: {
                every: [{ key: "layer", value: "CHARACTER" }]
            }
        }],
        onClick: async (context) => {
            const items = context.items;
            await OBR.scene.items.updateItems(items, (tokens) => {
                tokens.forEach(t => {
                    if (!t.metadata[FATE_ID]) {
                        t.metadata[FATE_ID] = { hpAtual: 100, hpMax: 100, mpAtual: 50, mpMax: 50 };
                    }
                });
            });
            renderTrackerList();
        }
    });
}

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
    OBR.scene.items.onChange(() => {
        setTimeout(renderTrackerList, 150); 
    });
    renderTrackerList();
}

async function renderTrackerList() {
    if (document.activeElement && document.activeElement.classList.contains('stat-input')) return; 

    const container = document.getElementById('tokenTrackerList');
    const items = await OBR.scene.items.getItems(item => item.layer === "CHARACTER" && item.metadata[FATE_ID]);

    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">Nenhum personagem na Matriz.</p>';
        return;
    }

    let html = '';
    items.forEach(item => {
        const meta = item.metadata[FATE_ID];
        html += `
            <div class="tracker-item" id="tracker-${item.id}">
                <div class="tracker-name" title="${item.name}">${item.name || "Desconhecido"}</div>
                
                <div class="stats-group" title="HP">
                    <input type="text" value="${meta.hpAtual}" class="stat-input hp-atual" data-id="${item.id}">
                    <span class="stat-div">/</span>
                    <input type="text" value="${meta.hpMax}" class="stat-input hp-max" data-id="${item.id}">
                </div>
                
                <div class="stats-group" title="Mana">
                    <input type="text" value="${meta.mpAtual}" class="stat-input mp-atual" data-id="${item.id}">
                    <span class="stat-div">/</span>
                    <input type="text" value="${meta.mpMax}" class="stat-input mp-max" data-id="${item.id}">
                </div>

                <button class="remove-btn" data-id="${item.id}" title="Remover da Matriz">✖</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
    attachMatrizEvents();
}

function attachMatrizEvents() {
    document.querySelectorAll('.stat-input').forEach(input => {
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const tokenId = e.target.dataset.id;
                let val = e.target.value.trim();
                
                const isHpAtual = e.target.classList.contains('hp-atual');
                const isHpMax = e.target.classList.contains('hp-max');
                const isMpAtual = e.target.classList.contains('mp-atual');
                const isMpMax = e.target.classList.contains('mp-max');

                const tokens = await OBR.scene.items.getItems([tokenId]);
                let meta = tokens[0].metadata[FATE_ID];

                if (val.startsWith('-') || val.startsWith('+')) {
                    let modifier = parseInt(val);
                    if (isHpAtual) val = meta.hpAtual + modifier;
                    if (isHpMax) val = meta.hpMax + modifier;
                    if (isMpAtual) val = meta.mpAtual + modifier;
                    if (isMpMax) val = meta.mpMax + modifier;
                    e.target.value = val; 
                } else {
                    val = parseInt(val) || 0; 
                }

                await OBR.scene.items.updateItems([tokenId], (t) => {
                    if (isHpAtual) t[0].metadata[FATE_ID].hpAtual = val;
                    if (isHpMax) t[0].metadata[FATE_ID].hpMax = val;
                    if (isMpAtual) t[0].metadata[FATE_ID].mpAtual = val;
                    if (isMpMax) t[0].metadata[FATE_ID].mpMax = val;
                });
                
                const updatedMeta = (await OBR.scene.items.getItems([tokenId]))[0].metadata[FATE_ID];
                updateVisualHUD(tokenId, updatedMeta.hpAtual, updatedMeta.hpMax, updatedMeta.mpAtual, updatedMeta.mpMax);
                e.target.blur(); 
            }
        });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tokenId = e.target.dataset.id;
            await OBR.scene.items.updateItems([tokenId], t => delete t[0].metadata[FATE_ID]);
            await OBR.scene.items.deleteItems([`${tokenId}-hud`]);
            renderTrackerList();
        });
    });
}

async function updateVisualHUD(tokenId, hpAtual, hpMax, mpAtual, mpMax) {
    const textId = `${tokenId}-hud`;
    const existing = await OBR.scene.items.getItems([textId]);
    const isGmOnly = document.getElementById('gmOnlyHudToggle').checked;
    const role = await OBR.player.getRole();
    const textContent = `HP ${hpAtual}/${hpMax} | MP ${mpAtual}/${mpMax}`;

    if (existing.length > 0) {
        await OBR.scene.items.updateItems([textId], items => {
            items[0].text.plainText = textContent;
            items[0].visible = isGmOnly ? (role === "GM") : true;
        });
    } else {
        const parent = await OBR.scene.items.getItems([tokenId]);
        if(parent.length === 0) return;
        const textItem = {
            id: textId, type: "TEXT",
            text: { type: "PLAIN", plainText: textContent },
            x: parent[0].x, y: parent[0].y + (parent[0].image ? parent[0].image.height / 2 : 50),
            attachedTo: tokenId, locked: true, layer: "TEXT",
            visible: isGmOnly ? (role === "GM") : true
        };
        await OBR.scene.local.addItems([textItem]); 
    }
}

function setupSpells() {
    const aimBtn = document.getElementById('aimBtn');
    
    aimBtn.addEventListener('click', () => {
        isAiming = !isAiming;
        aimBtn.innerText = isAiming ? "🛑 Parar Mira" : "🎯 Iniciar Mira";
        aimBtn.classList.toggle('active', isAiming);
        if(isAiming) targetedTokens = [];
        document.getElementById('targetList').innerHTML = "Nenhum alvo na mira.";
    });

    OBR.player.onChange(async (player) => {
        if (isAiming && player.selection.length > 0) {
            const items = await OBR.scene.items.getItems(player.selection);
            items.forEach(item => {
                if (item.layer === "CHARACTER" && !targetedTokens.find(t => t.id === item.id)) {
                    targetedTokens.push({ id: item.id, name: item.name || "Alvo" });
                }
            });
            document.getElementById('targetList').innerHTML = targetedTokens.map(t => `• ${t.name}`).join('<br>');
            OBR.player.deselect(); 
        }
    });

    document.getElementById('castSpellBtn').addEventListener('click', async () => {
        if (targetedTokens.length === 0) return alert("Mire em pelo menos um alvo!");
        
        const skillName = document.getElementById('spellName').value || "Ataque";
        let totalDmg = rollDice(document.getElementById('baseDice').value);
        
        for(let i=1; i<=2; i++) {
            const type = document.getElementById(`rune${i}Type`).value;
            if(type !== "none") totalDmg += rollDice(document.getElementById(`rune${i}Dice`).value);
        }

        const autoKill = document.getElementById('autoKillToggle').checked;

        for (const target of targetedTokens) {
            const items = await OBR.scene.items.getItems([target.id]);
            if(items.length > 0 && items[0].metadata[FATE_ID]) {
                let meta = items[0].metadata[FATE_ID];
                meta.hpAtual -= totalDmg;
                
                await OBR.scene.items.updateItems([target.id], t => t[0].metadata[FATE_ID].hpAtual = meta.hpAtual);
                updateVisualHUD(target.id, meta.hpAtual, meta.hpMax, meta.mpAtual, meta.mpMax);
                
                const log = document.getElementById('combatLogContent');
                log.innerHTML = `<div class="log-entry"><b style="color:var(--text-main)">${target.name}</b> sofreu <b style="color:var(--danger)">${totalDmg} dano</b> de <i>${skillName}</i>.</div>` + log.innerHTML;
                document.getElementById('combatLogOverlay').classList.remove('hidden');

                if(meta.hpAtual <= 0 && autoKill) {
                    const deathId = `${target.id}-death`;
                    const existingDeath = await OBR.scene.items.getItems([deathId]);
                    if(existingDeath.length === 0) {
                        await OBR.scene.items.addItems([{
                            id: deathId, type: "TEXT", text: { type: "PLAIN", plainText: "❌" },
                            x: items[0].x, y: items[0].y, attachedTo: target.id,
                            locked: true, layer: "DRAWING", scale: { x: 3, y: 3 }
                        }]);
                    }
                }
            }
        }
        
        isAiming = false; aimBtn.innerText = "🎯 Iniciar Mira"; aimBtn.classList.remove('active');
        targetedTokens = []; document.getElementById('targetList').innerHTML = "Nenhum alvo na mira.";
    });
}

function rollDice(diceString) {
    if(!diceString) return 0;
    const parts = diceString.toLowerCase().split('d');
    const qtd = parseInt(parts[0]) || 1;
    const faces = parseInt(parts[1]) || 0;
    if (faces === 0) return qtd; 
    let total = 0;
    for(let i=0; i<qtd; i++) total += Math.floor(Math.random() * faces) + 1;
    return total;
}

function setupMovementTracker() {
    OBR.player.onChange(async (player) => {
        if(player.selection.length > 0) {
            const items = await OBR.scene.items.getItems(player.selection);
            items.forEach(i => originalPositions[i.id] = {x: i.x, y: i.y});
        }
    });

    OBR.scene.items.onChange(async (items) => {
        const limit = parseInt(document.getElementById('moveLimit').value) || 0;
        if (limit === 0) return; 
        const dpi = await OBR.scene.grid.getDpi(); 
        const scale = await OBR.scene.grid.getScale(); 
        
        items.forEach(async item => {
            if (originalPositions[item.id] && item.layer === "CHARACTER") {
                const orig = originalPositions[item.id];
                const distPx = Math.sqrt(Math.pow(item.x - orig.x, 2) + Math.pow(item.y - orig.y, 2));
                const distFt = (distPx / dpi) * scale.parsed.multiplier;

                if (distFt > limit) {
                    await OBR.scene.items.updateItems([item.id], t => { t[0].x = orig.x; t[0].y = orig.y; });
                }
            }
        });
    });
}
