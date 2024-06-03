console.log(`***************************************\n\n
CREATING HOOK LISTNER FOR UPDATE ITEM FOR HEROIC VARIANT\n\n

************************************`)

const hookindex = Hooks.on('updateItem', async (itemInfo) => {
  // if wounded

  if (itemInfo._source.name === "Wounded"){
    if (! itemInfo.actor?.flags.heroicVariant?.previousWound){
      await itemInfo.actor.update({"flags.heroicVariant.previousWound": 0})
    }

    if (itemInfo.actor.flags.heroicVariant.previousWound > itemInfo.system.value.value){

      // check here if we already maxed out and then increase the value right back or stop it somehow.
      const macroId = await fromUuid("Compendium.heroic-variant.heroic-variant-macros.Macro.UGMhMZNNyn8RU5t3")
      macroId.execute({"actorIn":itemInfo.actor})
    }
    // itemInfo.actor.flags.heroicVariant.previousWound = 
    await itemInfo.actor.update({"flags.heroicVariant.previousWound": itemInfo.system.value.value})
  }
  
});

const hookindex2 = Hooks.on('deleteItem', async (itemInfo) => {

  if (itemInfo._source.name === "Wounded"){
    const macroId = await fromUuid("Compendium.heroic-variant.heroic-variant-macros.Macro.UGMhMZNNyn8RU5t3")
    macroId.execute({"actorIn":itemInfo.actor})
    
    await itemInfo.actor.update({"flags.heroicVariant.previousWound": 0})
  }
  
});

console.log("Hook created for update item for Heroic Variant")
