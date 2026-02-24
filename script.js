// Substitua o setupMatriz atual por este:

function setupMatriz() {
    const regBtn = document.getElementById('registerTokenBtn');
    
    // Botão para registrar token selecionado na Matriz
    regBtn.addEventListener('click', async () => {
        const selection = await OBR.player.getSelection();
        if (!selection || selection.length === 0) return alert("Selecione tokens no mapa primeiro!");
        
        const items = await OBR.scene.items.getItems(selection);
        
        // Adiciona a tag FATE_ID em todos os selecionados
        await OBR.scene.items.updateItems(selection, (tokens) => {
            tokens.forEach(t => {
                if (!t.metadata[FATE_ID]) {
                    t.metadata[FATE_ID] = { hp: "100/100", mana: "50/50" };
                }
            });
        });
    });

    // Escuta mudanças na cena para atualizar a lista em tempo real para todos
    OBR.scene.items.onChange(async (items) => {
        renderTrackerList();
    });

    // Renderiza a lista na primeira vez que abre
    renderTrackerList();
}

// Função que cria a lista visual de todos os tokens registrados
async function renderTrackerList() {
    const trackerContainer = document.getElementById('tokenTrackerList');
    
    // Pega todos os itens da cena que são personagens e têm a metadata do nosso sistema
    const items = await OBR.scene.items.getItems((item) => {
        return item.layer === "CHARACTER" && item.metadata[FATE_ID] !== undefined;
    });

    trackerContainer.innerHTML = ''; // Limpa a lista

    if (items.length === 0) {
        trackerContainer.innerHTML = '<p style="font-size:12px; color:#888; text-align:center;">Nenhum token na Matriz.</p>';
        return;
    }

    items.forEach(item => {
        const meta = item.metadata[FATE_ID];
        const imageUrl = item.image ? item.image.url : ''; // Pega a imagem do token

        const div = document.createElement('div');
        div.className = 'tracker-item';
        div.innerHTML = `
            <img src="${imageUrl}" class="tracker-img" alt="Token">
            <div class="tracker-info">
                <span class="tracker-name">${item.name || "Desconhecido"}</span>
                <div class="tracker-stats">
                    <span>HP</span>
                    <input type="text" value="${meta.hp}" class="hp-track" data-id="${item.id}" title="Aperte Enter para calcular (-30 ou +20)">
                    <span>MP</span>
                    <input type="text" value="${meta.mana}" class="mp-track" data-id="${item.id}">
                </div>
            </div>
            <button class="remove-btn" data-id="${item.id}" title="Remover da Matriz">X</button>
        `;
        trackerContainer.appendChild(div);
    });

    // Adiciona os eventos de edição (Apertar Enter no HP/Mana)
    document.querySelectorAll('.hp-track, .mp-track').forEach(input => {
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const tokenId = e.target.getAttribute('data-id');
                const isHp = e.target.classList.contains('hp-track');
                let val = e.target.value.trim();

                const tokens = await OBR.scene.items.getItems([tokenId]);
                let currentMeta = tokens[0].metadata[FATE_ID];
                let baseVal = isHp ? currentMeta.hp : currentMeta.mana;

                if (val.startsWith('-') || val.startsWith('+')) {
                    let [atual, max] = baseVal.split('/').map(Number);
                    atual += parseInt(val);
                    val = `${atual}/${max}`;
                }

                await OBR.scene.items.updateItems([tokenId], (t) => {
                    if (isHp) t[0].metadata[FATE_ID].hp = val;
                    else t[0].metadata[FATE_ID].mana = val;
                });
                
                updateVisualHUD(tokenId, isHp ? val : currentMeta.hp, isHp ? currentMeta.mana : val);
            }
        });
    });

    // Botão de remover o token da lista
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tokenId = e.target.getAttribute('data-id');
            await OBR.scene.items.updateItems([tokenId], (t) => {
                delete t[0].metadata[FATE_ID]; // Apaga os dados, tirando-o da lista
            });
            
            // Remove o HUD de texto flutuante, se houver
            const textId = `${tokenId}-hud`;
            await OBR.scene.items.deleteItems([textId]);
        });
    });
}
