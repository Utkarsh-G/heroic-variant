console.log(`***************************************\n\n
CREATING HOOK LISTENERS FOR HEROIC VARIANT\n\n
************************************`)
const MODULE_ID = 'pf2e-heroic-variant'

Hooks.on('init', ()=>{
  libWrapper.register(
    MODULE_ID,
    'ChatLog.prototype._getEntryContextOptions',
    _getEntryContextOptions_Wrapper,
    'WRAPPER',
  )
  game.settings.register(MODULE_ID, 'more-hero-points', {
    name: "Increase max hero points to 5 (requires reload)",
    hint: "Max Hero Points increases to 5 for all existing and new actors with a player character sheet.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'better-hero-points', {
    name: "Enable additional hero point usage",
    hint: "Players get the options to spend two to reroll with d10+10. GMs can reroll npc rolls by selecting player token, spending two of their hero points.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'unsettled-injuries', {
    name: "Automate granting Unsettled Injuries",
    hint: "Unsettled Injuries automatically increase when wounded value is decreased. Wounded cannot be decreased while at max Unsettled Injuries.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'unsettled-injuries-thp', {
    name: "Enable temporary hit points with Unsettled Injuries",
    hint: "If the actor has any unsettled injuries, they get THP equal to half their level when rolling initiative. If they have max unsettled unjuries and the wounded condition, the THP is equal to their level.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'phalanx-bonus-automation', {
    name: "Automate Phalanx Bonus for NPCs.",
    hint: "Whenever any npc token is added, removed, or moved on the canvas, all NPCs are checked for adjacency. Adjacent NPCs get the phalanx bonus.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
})

Hooks.once('ready', async ()=>{
  if (game.settings.get(MODULE_ID, 'more-hero-points')){
    const macroId = await fromUuid("Compendium.pf2e-heroic-variant.heroic-variant-macros.Macro.vGMOmkgKTzbgGEqA")
    macroId.execute()
  } else {
    const macroId = await fromUuid("Compendium.pf2e-heroic-variant.heroic-variant-macros.Macro.5XL3VXhcinVSQTsa")
    macroId.execute()
  }
})

Hooks.on('createActor', async (actor)=>{
  if (game.settings.get(MODULE_ID, 'more-hero-points')){
    const macroId = await fromUuid("Compendium.pf2e-heroic-variant.heroic-variant-macros.Macro.cv1VZWwnu1kczsx8")
    macroId.execute({"actor":actor})
  } 
})

const canKeelyHeroPointReroll = ($li) => {
  if (!game.settings.get(MODULE_ID, 'better-hero-points')) return false;
  const message = game.messages.get($li[0].dataset.messageId, { strict: true });
  const messageActor = message.actor;
  const actor = messageActor?.isOfType("familiar") ? messageActor.master : messageActor;
  return message.isRerollable && !!actor?.isOfType("character") && actor.heroPoints.value > 1;
};

const canMisfortuneReroll = ($li) => {
  if (!game.settings.get(MODULE_ID, 'better-hero-points')) return false;
  const message = game.messages.get($li[0].dataset.messageId, { strict: true });
  const messageActor = message.actor;
  if (!_token || !_token.actor || !_token.actor.heroPoints) return false;
  return message.isRerollable && !messageActor?.isOfType("character") && _token.actor.heroPoints.value > 1;
};

const _getEntryContextOptions_Wrapper = (wrapped) => {
  const buttons = wrapped.bind(this)()
  const defaultHeroPointIndex = buttons.findIndex((button) => 
  {return button.name === "PF2E.RerollMenu.HeroPoint";});
  // Add a button
  buttons.push(
    {
      name: 'Reroll with 2 Hero Points (d10+10)',
      icon: '<i class="fas fa-star"></i>',
      condition: canKeelyHeroPointReroll,
      callback:  li => {
        const message = game.messages.get(li[0].dataset.messageId, {strict: true});

        const tempHook = Hooks.on('pf2e.reroll', pf2eRerollHook);

        game.pf2e.Check.rerollFromMessage(message, {heroPoint: true}).then(() => {
          Hooks.off('pf2e.reroll', tempHook)
        })
        const messageActor = message.actor;
        const actor = messageActor?.isOfType("familiar") ? messageActor.master : messageActor;
        const newValue = actor.heroPoints.value - 2;
        actor.update({'system.resources.heroPoints.value': newValue}).then() // clamp to min 0? handle returned promise?

        
      },
    },
    {
      name: 'Reroll with 2 Hero Points and Take Newer',
      icon: '<i class="fas fa-star"></i>',
      condition: canMisfortuneReroll,
      callback:  li => {
        if (!_token || !_token.actor || !_token.actor.heroPoints){console.log("No selected token for hero point source."); return;}
        if (_token.actor.heroPoints.value > 1) {
          const message = game.messages.get(li[0].dataset.messageId, {strict: true});
          game.pf2e.Check.rerollFromMessage(message, {heroPoint: false, keep: 'new'}).then(() => {})
          const newValue = _token.actor.heroPoints.value - 2;
          _token.actor.update({'system.resources.heroPoints.value': newValue}).then() // clamp to min 0? handle returned promise?
        }
      },
    }
  )
  return buttons
}

// Code copied from github.com/xdy/xdy-pf2e-workbench
function pf2eRerollHook(
  _oldRoll,
  newRoll,
  heroPoint,
  keep, // : "new" | "higher" | "lower",
) {
  if (!heroPoint || keep !== "new") return;

  // @ts-ignore
  const die = newRoll.dice.find((d) => d instanceof Die && d.number === 1 && d.faces === 20);
  const result = die?.results.find((r) => r.active && r.result <= 10);
  if (die && result) {
      newRoll.terms.push(
          // @ts-ignore
          OperatorTerm.fromData({ class: "OperatorTerm", operator: "+", evaluated: true }),
          // @ts-ignore
          NumericTerm.fromData({ class: "NumericTerm", number: 10, evaluated: true }),
      );
      // @ts-ignore It's protected. Meh.
      newRoll._total += 10;
      newRoll.options.keeleyAdd10 = true;
  }
}

// Code modified from github.com/xdy/xdy-pf2e-workbench
function renderChatMessageHook(message, jq) {
  const html = jq.get(0);

  const lastRoll = message.rolls.at(-1);
  if (lastRoll?.options.keeleyAdd10) {
    const element = jq.get(0);

    if (element) {
        const tags = element.querySelector(".flavor-text > .tags.modifiers");
        const formulaElem = element.querySelector(".reroll-discard .dice-formula");
        const newTotalElem = element.querySelector(".reroll-second .dice-total");
        if (tags && formulaElem && newTotalElem) {
            // Add a tag to the list of modifiers
            const newTag = document.createElement("span");
            newTag.classList.add("tag", "tag_transparent", "keeley-add-10");
            newTag.innerText = 'Rolled Under 10 +10';
            newTag.dataset.slug = "keeley-add-10";
            newTag.style.color = "darkblue";
            const querySelector = tags.querySelector(".tag");
            if (querySelector?.dataset.visibility === "gm") {
                newTag.dataset.visibility = "gm";
            }
            tags.append(newTag);

            // Show +10 in the formula
            const span = document.createElement("span");
            span.className = "keeley-add-10";
            span.innerText = " + 10";
            formulaElem?.append(span);
            formulaElem.style.color = "darkblue";

            // Make the total purple
            newTotalElem.classList.add("keeley-add-10");
            newTotalElem.style.color = "darkblue";
        }
    }
  }
}

Hooks.on('renderChatMessage', renderChatMessageHook);

Hooks.on('preUpdateItem', async (itemInfo, change) => {
  if (!game.settings.get(MODULE_ID, 'unsettled-injuries')) return;
  // if wounded
  if (itemInfo._source.name === "Wounded"){
    if (! itemInfo.actor?.flags.heroicVariant?.previousWound){
      await itemInfo.actor.update({"flags.heroicVariant.previousWound": 0})
    }

    let incomingValue = change.system.value.value

    if (itemInfo.actor.flags.heroicVariant.previousWound > incomingValue){
      updateUnsettledInjuriesByOneOnSelectedActor(itemInfo.actor)
    }
    updateActorsPreviousWound(itemInfo.actor, incomingValue)
  }
  
});

Hooks.on('preDeleteItem', async (itemInfo, options, userID) => {
  if (!game.settings.get(MODULE_ID, 'unsettled-injuries')) return;
  if(options.hardResetHeroicVariant) return;
  ifWoundedThenUpdate(itemInfo.actor, itemInfo._source.name, 0)
});

Hooks.on('preCreateItem', async (itemInfo) => {
  if (!game.settings.get(MODULE_ID, 'unsettled-injuries')) return;
  if(itemInfo._source.name === "Wounded") updateActorsPreviousWound(itemInfo.actor, 1)
});

async function ifWoundedThenUpdate(actor, itemName, prevWoundedValue){
  if (itemName === "Wounded"){
    updateUnsettledInjuriesByOneOnSelectedActor(actor)
    updateActorsPreviousWound(actor, prevWoundedValue)
  }
}

async function updateUnsettledInjuriesByOneOnSelectedActor(actor){
  const macroId = await fromUuid("Compendium.pf2e-heroic-variant.heroic-variant-macros.Macro.UGMhMZNNyn8RU5t3")
  macroId.execute({"actor":actor})
}

async function updateActorsPreviousWound(actor, value){
  await actor.update({"flags.heroicVariant.previousWound": value})
}

// adding THP on initiative when unsettled injuries exist.
Hooks.on('createCombatant', (combatant) => {
  if (!game.settings.get(MODULE_ID, 'unsettled-injuries-thp')) return;
  if (combatant.actor.type !== "character" || !game.users.current.isGM) return;
  addTempHPifUnsettled(combatant.actor)
})

async function addTempHPifUnsettled(actor){
  const unsettledInjuries = actor.itemTypes.effect.find(effect => effect.name === "Unsettled Injuries");
  if (typeof unsettledInjuries === 'undefined') return;
  const desperation = (unsettledInjuries.system.badge.value === unsettledInjuries.system.badge.max) && !!actor.itemTypes.condition.find(condition => condition.sourceId === "Compendium.pf2e.conditionitems.Item.Yl48xTdMh3aeQYL2");
  const currentTHP = actor.system.attributes.hp.temp;
  const thp = desperation ? Math.max(actor.level, 2) : Math.max(Math.floor(actor.level / 2),1);
  console.log(`Actor ${actor.name} has unsettled injuries and will get ${thp} thp if it is greater than ${currentTHP}. Is desperate: ${desperation}`)
  if(thp > currentTHP) {
    const chatMessage = `<body><p> ${actor.name} was added to combat with ${thp} Temporary Hit Points due to Unsettled Injuries.</p></body>`
    await ChatMessage.create({speaker: ChatMessage.getSpeaker({ actor }), content: chatMessage})
    actor.update({"system.attributes.hp.temp": thp})
  };
}


// when an npc token moves, check all npc tokens to add or remove a phalanx bonus

Hooks.on("createToken", (tokenInfo) => {
  if (!game.settings.get(MODULE_ID, 'phalanx-bonus-automation')) return;
  if (tokenInfo.actor.type !== "npc" || !game.users.current.isGM) return;
  updatePhalanxBonus();
})

Hooks.on("updateToken", (tokenInfo) => {
  if (!game.settings.get(MODULE_ID, 'phalanx-bonus-automation')) return;
  if (tokenInfo.actor.type !== "npc" || !game.users.current.isGM) return;
  updatePhalanxBonus();
})

Hooks.on("deleteToken", (tokenInfo) => {
  if (!game.settings.get(MODULE_ID, 'phalanx-bonus-automation')) return;
  if (tokenInfo.actor.type !== "npc" || !game.users.current.isGM) return;
  updatePhalanxBonus();
})


function updatePhalanxBonus(){
  const npcTokensOnCanvas = canvas.tokens.objects.children.filter(token => token.actor.type === "npc");

  if (npcTokensOnCanvas.length === 0) return;

  npcTokensOnCanvas.forEach(async token => {
    let hasAdjacentAlly = false;
    npcTokensOnCanvas.forEach(token2 => {
      if (token.distanceTo(token2) === 5) hasAdjacentAlly = true;
    });

    const phalanxEffect = await fromUuid("Compendium.pf2e-heroic-variant.hv-effects-and-abilities.Item.Epii4QJxe6cFImI1");
    if (hasAdjacentAlly){
      const preExistingEffect = token.actor.itemTypes.effect.find((e) => e.name === "Phalanx Bonus");
      if (!preExistingEffect){await token.actor.createEmbeddedDocuments("Item", [phalanxEffect.toObject()]);}
    } else {
      const preExistingEffect = token.actor.itemTypes.effect.find((e) => e.name === "Phalanx Bonus");
      if (preExistingEffect) {await token.actor.deleteEmbeddedDocuments("Item", [preExistingEffect.id]);}
    }

  });
}