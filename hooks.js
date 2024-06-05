console.log(`***************************************\n\n
CREATING HOOK LISTENERS FOR HEROIC VARIANT\n\n
************************************`)
//import {CheckPF2e} from systems/pf2e/pf2e.mjs
const MODULE_ID = 'pf2e-heroic-variant'

Hooks.on('init', ()=>{
  libWrapper.register(
    MODULE_ID,
    'ChatLog.prototype._getEntryContextOptions',
    _getEntryContextOptions_Wrapper,
    'WRAPPER',
  )
})

const canKeelyHeroPointReroll = ($li) => {
            const message = game.messages.get($li[0].dataset.messageId, { strict: true });
            const messageActor = message.actor;
            const actor = messageActor?.isOfType("familiar") ? messageActor.master : messageActor;
            return message.isRerollable && !!actor?.isOfType("character") && actor.heroPoints.value > 1;
        };

const _getEntryContextOptions_Wrapper = (wrapped) => {
  const buttons = wrapped.bind(this)()

  // Add a button
  buttons.unshift(
    {
      name: 'Reroll using Keely Hero Point Rule',
      icon: '<i class="fas fa-star"></i>',
      condition: canKeelyHeroPointReroll,
      callback:  li => {
        console.log(`Okay, button was clicked. in data:`)
        console.log(li)
        const message = game.messages.get(li[0].dataset.messageId, {strict: true});
        
        game.settings.set("xdy-pf2e-workbench", "keeleysHeroPointRule", true).then(_ => {
          game.pf2e.Check.rerollFromMessage(message, {heroPoint: true});
          const messageActor = message.actor;
          const actor = messageActor?.isOfType("familiar") ? messageActor.master : messageActor;
          const newValue = actor.heroPoints.value - 2;
          console.log(`New value of hero point should be: ${newValue}`)
          actor.update({'system.resources.heroPoints.value': newValue}).then() // clamp to min 0? handle returned promise?
        })
        
      },
    }
  )
  return buttons
}

Hooks.on('preUpdateItem', async (itemInfo, change) => {
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
  if(options.hardResetHeroicVariant) return;
  ifWoundedThenUpdate(itemInfo.actor, itemInfo._source.name, 0)
});

Hooks.on('preCreateItem', async (itemInfo) => {
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
  macroId.execute({"actorIn":actor})
}

async function updateActorsPreviousWound(actor, value){
  await actor.update({"flags.heroicVariant.previousWound": value})
}