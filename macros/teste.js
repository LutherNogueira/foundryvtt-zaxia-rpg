// Hook para interceptar rolagens de ataque e usar Hope and Fear Roll
Hooks.on("preCreateChatMessage", async (chatMessage, data, options, userId) => {
  // Verifica se é uma rolagem de ataque
  if (!chatMessage.isRoll) return true;
  
  const roll = chatMessage.rolls?.[0];
  if (!roll) return true;
  
  // Detecta se é uma rolagem de ataque (d20 + modificadores)
  const isAttackRoll = roll.terms?.some(term => 
    term instanceof Die && term.faces === 20
  ) && (
    chatMessage.flavor?.toLowerCase().includes('attack') ||
    chatMessage.flavor?.toLowerCase().includes('ataque') ||
    data.content?.toLowerCase().includes('attack') ||
    data.content?.toLowerCase().includes('ataque')
  );
  
  if (!isAttackRoll) return true;
  
  // Previne a criação da mensagem original
  chatMessage.updateSource({ content: "" });
  
  // Executa a macro Hope and Fear Roll
  let macro = game.macros.get("Macro.vtvsDaIjiWFlgjrx");
  
  // Se não encontrar pelo UUID, tenta pelo nome
  if (!macro) {
    macro = game.macros.find(m => m.name === "HopeAndFearRoll");
  }
  
  // Se ainda não encontrar, lista todas as macros para debug
  if (!macro) {
    console.log("Macros disponíveis:", game.macros.map(m => ({ name: m.name, id: m.id, uuid: m.uuid })));
    ui.notifications.error("Macro Hope and Fear Roll não encontrada! Verifique o console para ver macros disponíveis.");
    return true;
  }
  
  try {
    // Executa a macro e aguarda o resultado
    const result = await macro.execute();
    
    // Pega o resultado da rolagem da macro
    // Assumindo que a macro retorna um objeto com o resultado
    const hopeAndFearResult = result || await getLastRollResult();
    
    // Determina se acertou baseado no resultado
    const success = determineSuccess(hopeAndFearResult, chatMessage);
    
    // Cria nova mensagem com o resultado
    await createCustomAttackMessage(chatMessage, hopeAndFearResult, success);
    
  } catch (error) {
    console.error("Erro ao executar Hope and Fear Roll:", error);
    ui.notifications.error("Erro ao executar Hope and Fear Roll");
    return true;
  }
  
  return false; // Previne a criação da mensagem original
});

// Função para determinar sucesso baseado no resultado Hope and Fear
function determineSuccess(rollResult, originalMessage) {
  // Extrai a dificuldade/AC do ataque original
  const targetAC = extractTargetAC(originalMessage);
  
  // Lógica para determinar sucesso com Hope and Fear
  // Ajuste conforme as regras da sua macro
  if (rollResult.total >= targetAC) {
    return true;
  }
  
  // Regras especiais para Hope and Fear (ajuste conforme necessário)
  if (rollResult.hope > rollResult.fear) {
    return rollResult.total + 2 >= targetAC; // Bônus por esperança
  } else if (rollResult.fear > rollResult.hope) {
    return rollResult.total - 1 >= targetAC; // Penalidade por medo
  }
  
  return rollResult.total >= targetAC;
}

// Função para extrair AC/dificuldade do ataque original
function extractTargetAC(chatMessage) {
  // Tenta extrair AC do target selecionado
  const targets = game.user.targets;
  if (targets.size > 0) {
    const target = targets.first();
    return target.actor.system.attributes.ac.value || 10;
  }
  
  // AC padrão se não encontrar target
  return 10;
}

// Função para pegar o último resultado de rolagem
async function getLastRollResult() {
  // Espera um pouco para a macro processar
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Pega a última mensagem de chat que contém uma rolagem
  const messages = game.messages.contents.slice(-5);
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.isRoll && msg.rolls?.[0]) {
      return {
        total: msg.rolls[0].total,
        result: msg.rolls[0].result,
        hope: extractHopeValue(msg),
        fear: extractFearValue(msg)
      };
    }
  }
  
  return { total: 10, hope: 0, fear: 0 }; // Fallback
}

// Funções para extrair valores de Hope e Fear (ajuste conforme sua macro)
function extractHopeValue(message) {
  const content = message.content || "";
  const hopeMatch = content.match(/Hope[:\s]*(\d+)/i);
  return hopeMatch ? parseInt(hopeMatch[1]) : 0;
}

function extractFearValue(message) {
  const content = message.content || "";
  const fearMatch = content.match(/Fear[:\s]*(\d+)/i);
  return fearMatch ? parseInt(fearMatch[1]) : 0;
}

// Função para criar mensagem personalizada de ataque
async function createCustomAttackMessage(originalMessage, rollResult, success) {
  const actor = originalMessage.speaker?.actor ? game.actors.get(originalMessage.speaker.actor) : null;
  const actorName = actor?.name || originalMessage.speaker?.alias || "Unknown";
  
  const successText = success ? "🎯 **ACERTOU!**" : "❌ **ERROU!**";
  const resultColor = success ? "#28a745" : "#dc3545";
  
  const content = `
    <div style="border: 2px solid ${resultColor}; border-radius: 8px; padding: 10px; margin: 5px 0;">
      <h3 style="margin: 0 0 10px 0; color: ${resultColor};">
        ${actorName} - Ataque (Hope & Fear)
      </h3>
      <div style="margin-bottom: 10px;">
        <strong>Resultado:</strong> ${rollResult.total}
      </div>
      <div style="margin-bottom: 10px;">
        Hope: ${rollResult.hope} | Fear: ${rollResult.fear}
      </div>
      <div style="font-size: 16px; font-weight: bold;">
        ${successText}
      </div>
    </div>
  `;
  
  await ChatMessage.create({
    user: game.user.id,
    speaker: originalMessage.speaker,
    content: content,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
}

// Hook alternativo para interceptar rolagens de armas especificamente
Hooks.on("dnd5e.preRollAttack", async (item, rollConfig) => {
  // Previne a rolagem normal
  rollConfig.event?.preventDefault?.();
  
  // Executa a macro Hope and Fear
  let macro = game.macros.get("Macro.vtvsDaIjiWFlgjrx");
  
  // Se não encontrar pelo UUID, tenta pelo nome
  if (!macro) {
    macro = game.macros.find(m => m.name === "HopeAndFearRoll");
  }
  
  if (macro) {
    try {
      await macro.execute();
      
      // Aguarda o resultado e processa
      setTimeout(async () => {
        const result = await getLastRollResult();
        const targetAC = extractTargetAC({ speaker: { actor: item.actor.id } });
        const success = determineSuccess(result, { speaker: { actor: item.actor.id } });
        
        await createCustomAttackMessage(
          { speaker: { actor: item.actor.id, alias: item.actor.name } },
          result,
          success
        );
      }, 200);
      
    } catch (error) {
      console.error("Erro ao executar Hope and Fear Roll:", error);
    }
  }
  
  return false; // Previne a rolagem original
});

console.log("Hook Hope and Fear Roll ativo!");

// Função de teste para verificar se a macro está acessível
function testMacroAccess() {
  console.log("Testando acesso à macro...");
  
  // Testa por UUID
  let macro = game.macros.get("Macro.vtvsDaIjiWFlgjrx");
  if (macro) {
    console.log("✅ Macro encontrada por UUID:", macro.name);
    return macro;
  }
  
  // Testa por nome
  macro = game.macros.find(m => m.name === "HopeAndFearRoll");
  if (macro) {
    console.log("✅ Macro encontrada por nome:", macro.name, "UUID:", macro.uuid);
    return macro;
  }
  
  // Lista todas as macros disponíveis
  console.log("❌ Macro não encontrada. Macros disponíveis:");
  game.macros.forEach(m => {
    console.log(`- Nome: "${m.name}", UUID: ${m.uuid}, ID: ${m.id}`);
  });
  
  return null;
}

// Executa o teste
testMacroAccess();