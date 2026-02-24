const FATE_ID = "com.fatesystem.metadata";

// O seu Grimório com a letra M codificado de forma 100% segura para o Owlbear não bloquear
const rawSVG = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="6" width="48" height="52" rx="4" /><line x1="18" y1="6" x2="18" y2="58" /><line x1="8" y1="16" x2="18" y2="16" /><line x1="8" y1="48" x2="18" y2="48" /><polyline points="26,42 26,24 36,34 46,24 46,42" /></svg>`;
const MENU_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rawSVG);

let originalPositions = {};

OBR.onReady(() => {
    setupTabs();
    setupTurnos();
    setupMovementTracker();
    setupContextMenu(); 
});

// === 1. MENU DE CONTEXTO (Agora funciona em QUALQUER token) ===
function setupContextMenu() {
    OBR.contextMenu.create({
        id: "seediam.fatesystem.menu.add", // ID Novo para fugir do cache
        icons: [{
            icon: MENU_ICON, 
            label: "Adicionar à Matriz (Fate)",
            filter: {
                every: [{ key: "type", value: "IMAGE" }] // <- O SEGREDO: Funciona em Prop, Mount, Character, qualquer imagem!
            }
        }],
        onClick: async (context) => {
            const tokenIds = context.items.map(item => item.id);
            
            await OBR.scene.items.updateItems(tokenIds, (tokens) => {
                tokens.forEach(t => {
                    if (!t.metadata[FATE_ID]) {
                        t.metadata[FATE_ID] = { hpAtual: 100, hpMax: 100, mpAtual: 50, mpMax: 50, movimento: 0 };
                    }
                });
            });
            renderTrackerList();
        }
    });
}

// === 2. BOTÃO DE "+" DE EMERGÊNCIA (Agora aceita qualquer seleção) ===
function setupTurnos() {
    document.getElementById('fallbackAddBtn').addEventListener('click', async () => {
        const selectionIds = await OBR.player.getSelection();
        
        if (!selectionIds || selectionIds.length === 0) {
            alert("Selecione um token no mapa primeiro!");
            return;
        }

        // Ignoramos a checagem de "CHARACTER". Se está selecionado, ele entra na Matriz.
        await OBR.scene.items.updateItems(selectionIds, (tokens) => {
            tokens.forEach(t => {
                if (!t.metadata[FATE_ID]) {
                    t.metadata[FATE_ID] = { hpAtual: 100, hpMax: 100, mpAtual: 50, mpMax: 50, movimento: 0 };
                }
            });
        });
        renderTrackerList();
    });

    OBR.scene.items.onChange(() => {
        setTimeout(renderTrackerList, 150); 
    });
    
    renderTrackerList();
}

// === 3. RENDERIZAR A LISTA ===
async function renderTrackerList() {
    if (document.activeElement && (document.activeElement.classList.contains('stat-input') || document.activeElement.classList.contains('ft-input'))) return; 

    const container = document.getElementById('tokenTrackerList');
    const items = await OBR.scene.items.getItems(item => item.metadata[FATE_ID] !== undefined);

    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">Nenhum personagem registrado.</p>';
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

                <div class="ft-group" title="Movimento (Ft.) | 0 = Livre">
                    <input type="text" value="${meta.movimento || 0}" class="ft-input" data-id="${item.id}">
                </div>

                <button class="remove-btn" data-id="${item.id}" title="Remover">✖</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
    attachMatrizEvents();
}

// === 4. MATEMÁTICA E ATUALIZAÇÕES ===
function attachMatrizEvents() {
    document.querySelectorAll('.stat-input, .ft-input').forEach(input => {
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const tokenId = e.target.dataset.id;
                let val = e.target.value.trim();
                
                const isHpAtual = e.target.classList.contains('hp-atual');
                const isHpMax = e.target.classList.contains('hp-max');
                const isMpAtual = e.target.classList.contains('mp-atual');
                const isMpMax = e.target.classList.contains('mp-max');
                const isFt = e.target.classList.contains('ft-input');

                const tokens = await OBR.scene.items.getItems([tokenId]);
                let meta = tokens[0].metadata[FATE_ID];

                if (val.startsWith('-') || val.startsWith('+')) {
                    let modifier = parseInt(val);
                    if (isHpAtual) val = meta.hpAtual + modifier;
                    if (isHpMax) val = meta.hpMax + modifier;
                    if (isMpAtual) val = meta.mpAtual + modifier;
                    if (isMpMax) val = meta.mpMax + modifier;
                    if (isFt) val = (meta.movimento || 0) + modifier;
                    e.target.value = val; 
                } else {
                    val = parseInt(val) || 0; 
                }

                await OBR.scene.items.updateItems([tokenId], (t) => {
                    if (isHpAtual) t[0].metadata[FATE_ID].hpAtual = val;
                    if (isHpMax) t[0].metadata[FATE_ID].hpMax = val;
                    if (isMpAtual) t[0].metadata[FATE_ID].mpAtual = val;
                    if (isMpMax) t[0].metadata[FATE_ID].mpMax = val;
                    if (isFt) t[0].metadata[FATE_ID].movimento = val;
                });
                
                e.target.blur(); 
            }
        });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tokenId = e.target.dataset.id;
            await OBR.scene.items.updateItems([tokenId], t => delete t[0].metadata[FATE_ID]);
            renderTrackerList();
        });
    });
}

// === 5. BLOQUEIO DE MOVIMENTO ===
function setupMovementTracker() {
    OBR.player.onChange(async (player) => {
        if(player.selection.length > 0) {
            const items = await OBR.scene.items.getItems(player.selection);
            items.forEach(i => originalPositions[i.id] = {x: i.x, y: i.y});
        }
    });

    OBR.scene.items.onChange(async (items) => {
        const dpi = await OBR.scene.grid.getDpi(); 
        const scale = await OBR.scene.grid.getScale(); 
        
        items.forEach(async item => {
            if (item.metadata[FATE_ID] && originalPositions[item.id]) {
                const limit = parseInt(item.metadata[FATE_ID].movimento) || 0;
                if (limit === 0) return; 

                const orig = originalPositions[item.id];
                const distPx = Math.sqrt(Math.pow(item.x - orig.x, 2) + Math.pow(item.y - orig.y, 2));
                const distFt = (distPx / dpi) * scale.parsed.multiplier;

                if (distFt > limit) {
                    await OBR.scene.items.updateItems([item.id], t => { 
                        t[0].x = orig.x; 
                        t[0].y = orig.y; 
                    });
                }
            }
        });
    });
}

// === 6. ABAS ===
function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    }));
}
