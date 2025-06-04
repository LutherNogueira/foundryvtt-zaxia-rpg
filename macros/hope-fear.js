// Macro HopeFear - Hope e Fear
// Sistema com seleção de dados e modificadores

async function rollHopeFear() {
    // Dialog to choose dice and modifiers
    let dialogContent = `
        <form>
            <div class="form-group">
                <label>✨ Hope Dice (d12):</label>
                <input type="number" name="hopeDice" value="1" min="0" max="10">
            </div>
            <div class="form-group">
                <label>😱 Fear Dice (d12):</label>
                <input type="number" name="fearDice" value="1" min="0" max="10">
            </div>
            <hr style="margin: 15px 0;">
            <div class="form-group">
                <label>🎯 Fixed Modifier:</label>
                <input type="number" name="fixedModifier" value="0" step="1">
            </div>
            <div class="form-group">
                <label>🎲 Variable Modifier:</label>
                <input type="text" name="variableModifier" placeholder="1d6" pattern="[0-9]*d[0-9]+">
                <small style="display: block; color: #666; font-size: 0.8em;">Leave empty to skip</small>
            </div>
        </form>
    `;

    let d = new Dialog({
        title: "HopeFear - Hope & Fear Roll",
        content: dialogContent,
        buttons: {
            roll: {
                icon: '<i class="fas fa-dice"></i>',
                label: "Roll Dice",
                callback: async (html) => {
                    let hopeDice = parseInt(html.find('[name="hopeDice"]').val()) || 0;
                    let fearDice = parseInt(html.find('[name="fearDice"]').val()) || 0;
                    let fixedModifier = parseInt(html.find('[name="fixedModifier"]').val()) || 0;
                    let variableModifier = html.find('[name="variableModifier"]').val().trim();
                    
                    if (hopeDice === 0 && fearDice === 0) {
                        ui.notifications.warn("You must roll at least one die!");
                        return;
                    }
                    
                    await executeRoll(hopeDice, fearDice, fixedModifier, variableModifier);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "roll"
    });
    
    d.render(true);
}

async function executeRoll(hopeDice, fearDice, fixedModifier, variableModifier) {
    // Construir fórmula combinada
    let formula = "";
    let parts = [];
    
    if (hopeDice > 0) {
        parts.push(`${hopeDice}d12`);
    }
    if (fearDice > 0) {
        parts.push(`${fearDice}d12`);
    }
    
    formula = parts.join(" + ");
    
    // Rolar todos os dados de uma vez
    let combinedRoll = new Roll(formula);
    await combinedRoll.evaluate({async: false});
    
    // Aplicar cores aos dados individuais
    let termIndex = 0;
    
    // Colorir dados de Hope (azul)
    if (hopeDice > 0) {
        if (combinedRoll.terms[termIndex].results) {
            combinedRoll.terms[termIndex].options = combinedRoll.terms[termIndex].options || {};
            combinedRoll.terms[termIndex].options.appearance = {
                foreground: "#ffffff",
                edge: "#2c5aa0", 
                background: "#4a90e2",
                fontColor: "#ffffff"
            };
        }
        termIndex += 2; // Pular o operador "+"
    }
    
    // Colorir dados de Fear (vermelho)
    if (fearDice > 0) {
        if (combinedRoll.terms[termIndex].results) {
            combinedRoll.terms[termIndex].options = combinedRoll.terms[termIndex].options || {};
            combinedRoll.terms[termIndex].options.appearance = {
                foreground: "#ffffff",
                edge: "#991b1b",
                background: "#dc2626", 
                fontColor: "#ffffff"
            };
        }
    }
    
    // Mostrar dados com Dice So Nice
    if (game.dice3d) {
        await game.dice3d.showForRoll(combinedRoll, game.user, true);
    }
    
    // Separar resultados por tipo
    termIndex = 0;
    
    // Extrair resultados dos dados de Hope
    let hopeResults = [];
    if (hopeDice > 0) {
        hopeResults = combinedRoll.terms[termIndex].results.map(r => r.result);
        termIndex += 2; // Pular o operador "+"
    }
    
    // Extrair resultados dos dados de Fear
    let fearResults = [];
    if (fearDice > 0) {
        fearResults = combinedRoll.terms[termIndex].results.map(r => r.result);
    }
    
    // Rolar modificador variável se especificado
    let modifierRoll = null;
    let modifierResult = 0;
    if (variableModifier && variableModifier.length > 0) {
        try {
            modifierRoll = new Roll(variableModifier);
            await modifierRoll.evaluate({async: false});
            modifierResult = modifierRoll.total;
            
            // Mostrar dados do modificador
            if (game.dice3d) {
                await game.dice3d.showForRoll(modifierRoll, game.user, true);
            }
        } catch (error) {
            ui.notifications.warn("Invalid variable modifier! Using only fixed modifier.");
            modifierResult = 0;
        }
    }
    
    // Se há múltiplos dados, permitir seleção
    if ((hopeDice + fearDice) > 1) {
        await showDiceSelection(hopeResults, fearResults, hopeDice, fearDice, fixedModifier, modifierResult, modifierRoll, variableModifier);
    } else {
        // Usar o único dado disponível
        let selectedHope = hopeResults.length > 0 ? hopeResults[0] : 0;
        let selectedFear = fearResults.length > 0 ? fearResults[0] : 0;
        await showFinalResult(selectedHope, selectedFear, hopeResults, fearResults, hopeDice, fearDice, fixedModifier, modifierResult, modifierRoll, variableModifier);
    }
}

async function showDiceSelection(hopeResults, fearResults, hopeDice, fearDice, fixedModifier, modifierResult, modifierRoll, variableModifier) {
    let selectionContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h3>Choose which die to use from each type:</h3>
        </div>
        <form>
    `;
    
    // Seleção de dados Hope
    if (hopeResults.length > 0) {
        selectionContent += `
            <div style="margin: 10px 0; padding: 10px; background: #f0f7ff; border-radius: 4px;">
                <div style="color: #4a90e2; font-weight: bold; margin-bottom: 8px;">
                    ✨ Choose a Hope die:
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
        `;
        
        hopeResults.forEach((result, index) => {
            selectionContent += `
                <label style="cursor: pointer;">
                    <input type="radio" name="selectedHope" value="${result}" ${index === 0 ? 'checked' : ''}>
                    <div style="
                        width: 40px; 
                        height: 40px; 
                        border: 2px solid #4a90e2; 
                        border-radius: 6px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        background: white; 
                        font-weight: bold;
                        font-size: 16px;
                        color: #4a90e2;
                        margin-top: 5px;
                    ">${result}</div>
                </label>
            `;
        });
        
        selectionContent += `</div></div>`;
    }
    
    // Seleção de dados Fear
    if (fearResults.length > 0) {
        selectionContent += `
            <div style="margin: 10px 0; padding: 10px; background: #fff0f0; border-radius: 4px;">
                <div style="color: #dc2626; font-weight: bold; margin-bottom: 8px;">
                    😱 Choose a Fear die:
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
        `;
        
        fearResults.forEach((result, index) => {
            selectionContent += `
                <label style="cursor: pointer;">
                    <input type="radio" name="selectedFear" value="${result}" ${index === 0 ? 'checked' : ''}>
                    <div style="
                        width: 40px; 
                        height: 40px; 
                        border: 2px solid #dc2626; 
                        border-radius: 6px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        background: white; 
                        font-weight: bold;
                        font-size: 16px;
                        color: #dc2626;
                        margin-top: 5px;
                    ">${result}</div>
                </label>
            `;
        });
        
        selectionContent += `</div></div>`;
    }
    
    selectionContent += `</form>`;
    
    let selectionDialog = new Dialog({
        title: "Select Dice",
        content: selectionContent,
        buttons: {
            confirm: {
                icon: '<i class="fas fa-check"></i>',
                label: "Confirm Selection",
                callback: async (html) => {
                    let selectedHope = hopeResults.length > 0 ? parseInt(html.find('[name="selectedHope"]:checked').val()) || 0 : 0;
                    let selectedFear = fearResults.length > 0 ? parseInt(html.find('[name="selectedFear"]:checked').val()) || 0 : 0;
                    
                    await showFinalResult(selectedHope, selectedFear, hopeResults, fearResults, hopeDice, fearDice, fixedModifier, modifierResult, modifierRoll, variableModifier);
                }
            }
        },
        default: "confirm"
    });
    
    selectionDialog.render(true);
}

async function showFinalResult(selectedHope, selectedFear, hopeResults, fearResults, hopeDice, fearDice, fixedModifier, modifierResult, modifierRoll, variableModifier) {
    // Determinar resultado final
    let finalResult = "";
    let resultColor = "";
    let resultEmoji = "";
    let baseTotal = selectedHope + selectedFear;
    let totalModifier = fixedModifier + modifierResult;
    let finalTotal = baseTotal + totalModifier;
    let totalText = "";
    
    if (selectedHope > selectedFear) {
        finalResult = "Hope";
        resultColor = "#4a90e2";
        resultEmoji = "✨";
        totalText = `${finalTotal} with Hope`;
    } else if (selectedFear > selectedHope) {
        finalResult = "Fear";
        resultColor = "#dc2626";
        resultEmoji = "😱";
        totalText = `${finalTotal} with Fear`;
    } else {
        finalResult = "Hope";
        resultColor = "#4a90e2";
        resultEmoji = "✨";
        totalText = `${finalTotal} with Hope`;
    }
    
    // Criar mensagem de chat detalhada
    let chatContent = `
        <div style="border: 2px solid #8b5a3c; border-radius: 8px; padding: 10px; background: #f8f4e6; margin: 0;">
            <!-- Resultado Principal -->
            <div style="text-align: center; font-size: 1.3em; color: ${resultColor}; margin-bottom: 10px;">
                <strong>${resultEmoji} ${finalResult} ${resultEmoji}</strong>
            </div>
            
            <!-- Dados Selecionados -->
            <div style="display: flex; justify-content: center; gap: 20px; margin: 10px 0;">
                ${selectedHope > 0 ? `
                    <div style="text-align: center;">
                        <div style="color: #4a90e2; font-weight: bold; margin-bottom: 5px;">✨ Hope Used</div>
                        <div style="
                            width: 50px; 
                            height: 50px; 
                            border: 3px solid #4a90e2; 
                            border-radius: 8px; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            background: #4a90e2; 
                            font-weight: bold;
                            font-size: 20px;
                            color: white;
                            margin: 0 auto;
                        ">${selectedHope}</div>
                    </div>
                ` : ''}
                
                ${selectedFear > 0 ? `
                    <div style="text-align: center;">
                        <div style="color: #dc2626; font-weight: bold; margin-bottom: 5px;">😱 Fear Used</div>
                        <div style="
                            width: 50px; 
                            height: 50px; 
                            border: 3px solid #dc2626; 
                            border-radius: 8px; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            background: #dc2626; 
                            font-weight: bold;
                            font-size: 20px;
                            color: white;
                            margin: 0 auto;
                        ">${selectedFear}</div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Todos os Dados Rolados (se múltiplos) -->
            ${(hopeDice + fearDice) > 1 ? `
                <div style="margin: 15px 0; padding: 10px; background: #f9f9f9; border-radius: 4px; border: 1px solid #ddd;">
                    <div style="font-weight: bold; margin-bottom: 8px; text-align: center; color: #666;">
                        📋 All Dices:
                    </div>
            ` : ''}
            
            <!-- Resultados Hope (todos) -->
            ${hopeResults.length > 0 && (hopeDice + fearDice) > 1 ? `
                <div style="margin: 8px 0;">
                    <div style="color: #4a90e2; font-weight: bold; margin-bottom: 5px; font-size: 0.9em;">
                        ✨ Hope (${hopeDice}d12):
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${hopeResults.map(result => `
                            <div style="
                                width: 25px; 
                                height: 25px; 
                                border: 1px solid #4a90e2; 
                                border-radius: 3px; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                background: ${result === selectedHope ? '#4a90e2' : 'white'}; 
                                font-weight: bold;
                                font-size: 12px;
                                color: ${result === selectedHope ? 'white' : '#4a90e2'};
                                ${result === selectedHope ? 'box-shadow: 0 0 5px rgba(74, 144, 226, 0.5);' : ''}
                            ">${result}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Resultados Fear (todos) -->
            ${fearResults.length > 0 && (hopeDice + fearDice) > 1 ? `
                <div style="margin: 8px 0;">
                    <div style="color: #dc2626; font-weight: bold; margin-bottom: 5px; font-size: 0.9em;">
                        😱 Fear (${fearDice}d12):
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${fearResults.map(result => `
                            <div style="
                                width: 25px; 
                                height: 25px; 
                                border: 1px solid #dc2626; 
                                border-radius: 3px; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                background: ${result === selectedFear ? '#dc2626' : 'white'}; 
                                font-weight: bold;
                                font-size: 12px;
                                color: ${result === selectedFear ? 'white' : '#dc2626'};
                                ${result === selectedFear ? 'box-shadow: 0 0 5px rgba(220, 38, 38, 0.5);' : ''}
                            ">${result}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${(hopeDice + fearDice) > 1 ? `</div>` : ''}
            
            <!-- Modifiers -->
            ${(fixedModifier !== 0 || modifierResult !== 0) ? `
                <div style="margin: 10px 0; padding: 8px; background: #fff8e1; border-radius: 4px; border: 1px solid #ffb74d;">
                    <div style="color: #e65100; font-weight: bold; margin-bottom: 5px; text-align: center;">
                        🎯 Modifiers:
                    </div>
                    <div style="text-align: center; font-size: 0.9em;">
                        ${fixedModifier !== 0 ? `Mod: ${fixedModifier >= 0 ? '+' : ''}${fixedModifier}` : ''}
                        ${fixedModifier !== 0 && modifierResult !== 0 ? ' | ' : ''}
                        ${modifierResult !== 0 ? `Mod Dice (${variableModifier}): +${modifierResult}` : ''}
                        ${totalModifier !== 0 ? `<br><strong>Total Modifier: ${totalModifier >= 0 ? '+' : ''}${totalModifier}</strong>` : ''}
                    </div>
                </div>
            ` : ''}
            
            <!-- Cálculo Final -->
            ${(fixedModifier !== 0 || modifierResult !== 0) ? `
                <div style="text-align: center; margin: 10px 0; font-size: 0.9em; color: #666;">
                    ${baseTotal} (dices) ${totalModifier >= 0 ? '+' : ''}${totalModifier} (modifiers) = ${finalTotal}
                </div>
            ` : ''}
            
            <!-- Total em Destaque -->
            <div style="
                text-align: center; 
                margin-top: 12px; 
                padding: 12px; 
                background: ${resultColor}; 
                border-radius: 8px; 
                color: white;
                font-size: 1.4em;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
                ${totalText}
            </div>
        </div>
    `;
    
    // Enviar mensagem para o chat
    ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({actor: canvas.tokens.controlled[0]?.actor}),
        content: chatContent,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL
    });
}

// Executar a macro
rollHopeFear();