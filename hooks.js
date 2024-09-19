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
  game.settings.register(MODULE_ID, 'easy-hero-points', {
    name: "Grant hero point from chat",
    hint: "GM can right click any chat message owned by a PC and grant them a Hero Point from the menu. Option only appears if the PC has fewer than maximum hero points.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'raw-scars', {
    name: "Automate granting Raw Scars",
    hint: "Raw Scars automatically increase when wounded value is decreased. Wounded cannot be decreased while at max Raw Scars.",
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

const canEarnHeroPoint = ($li) => {
  if (!game.settings.get(MODULE_ID, 'easy-hero-points')) return false;
  const message = game.messages.get($li[0].dataset.messageId, { strict: true });
  const messageActor = message.actor;
  return game.user.isGM && messageActor?.isOfType("character") && messageActor.heroPoints.value < messageActor.heroPoints.max;
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
    },
    {
      name: 'Grant actor a Hero Point',
      icon: '<i class="fas fa-star"></i>',
      condition: canEarnHeroPoint,
      callback:  li => {
        const message = game.messages.get(li[0].dataset.messageId, {strict: true});
        if (!message.actor) return;
        const messageActor = message.actor;
        const newValue = messageActor.heroPoints.value + 1;
        messageActor.update({'system.resources.heroPoints.value': newValue}).then(()=> {
          const chatMessage = `<body><p>Granted Hero Point to ${message.actor.name}. Increased from ${messageActor.heroPoints.value-1} to ${messageActor.heroPoints.value}.</p></body>`
          ChatMessage.create({speaker: ChatMessage.getSpeaker({ messageActor }), content: chatMessage})
        });
      
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
  const die = newRoll.dice.find((d) => d instanceof foundry.dice.terms.Die && d.number === 1 && d.faces === 20);
  const result = die?.results.find((r) => r.active && r.result <= 10);
  if (die && result) {
      newRoll.terms.push(
          // @ts-ignore
          foundry.dice.terms.OperatorTerm.fromData({ class: "OperatorTerm", operator: "+", evaluated: true }),
          // @ts-ignore
          foundry.dice.terms.NumericTerm.fromData({ class: "NumericTerm", number: 10, evaluated: true }),
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
            newTag.innerText = 'Rolled Under 11 +10';
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
  if (!game.settings.get(MODULE_ID, 'raw-scars')) return;
  // if wounded
  if (itemInfo.system.slug === "wounded"){
    if (! itemInfo.actor?.flags.heroicVariant?.previousWound){
      await itemInfo.actor.update({"flags.heroicVariant.previousWound": 0})
    }

    let incomingValue = change.system.value.value

    if (itemInfo.actor.flags.heroicVariant.previousWound > incomingValue){
      updateRawScarsByOneOnSelectedActor(itemInfo.actor)
    }
    updateActorsPreviousWound(itemInfo.actor, incomingValue)
  }
  
});

Hooks.on('preDeleteItem', async (itemInfo, options, userID) => {
  if (!game.settings.get(MODULE_ID, 'raw-scars')) return;
  if(options.hardResetHeroicVariant) return;
  ifWoundedThenUpdate(itemInfo.actor, itemInfo.system.slug, 0)
});

Hooks.on('preCreateItem', async (itemInfo) => {
  if (!game.settings.get(MODULE_ID, 'raw-scars')) return;
  if(itemInfo.system.slug === "wounded") updateActorsPreviousWound(itemInfo.actor, 1)
});

async function ifWoundedThenUpdate(actor, itemSlug, prevWoundedValue){
  if (itemSlug === "wounded"){
    updateRawScarsByOneOnSelectedActor(actor)
    updateActorsPreviousWound(actor, prevWoundedValue)
  }
}

async function updateRawScarsByOneOnSelectedActor(actor){
  const macroId = await fromUuid("Compendium.pf2e-heroic-variant.heroic-variant-macros.Macro.UGMhMZNNyn8RU5t3")
  macroId.execute({"actor":actor})
}

async function updateActorsPreviousWound(actor, value){
  await actor.update({"flags.heroicVariant.previousWound": value})
}

// when an npc token moves, check all npc tokens to add or remove a phalanx bonus

Hooks.on("createToken", (tokenInfo) => {
  if (!game.settings.get(MODULE_ID, 'phalanx-bonus-automation')) return;
  if (tokenInfo.actor?.type !== "npc" || !game.users.current.isGM) return;
  updatePhalanxBonus();
})

Hooks.on("updateToken", (tokenInfo) => {
  if (!game.settings.get(MODULE_ID, 'phalanx-bonus-automation')) return;
  if (tokenInfo.actor?.type !== "npc" || !game.users.current.isGM) return;
  updatePhalanxBonus();
})

Hooks.on("deleteToken", (tokenInfo) => {
  if (!game.settings.get(MODULE_ID, 'phalanx-bonus-automation')) return;
  if (tokenInfo.actor?.type !== "npc" || !game.users.current.isGM) return;
  updatePhalanxBonus();
})


function updatePhalanxBonus(){
  const npcTokensOnCanvas = canvas.tokens.objects.children.filter(token => {
    const isNPC = token.actor?.type === "npc";
    const doesNotHavePhalanxImmunity = !token.actor?.itemTypes.effect.find((e) => e.slug === "hv-phalanx-immunity");
    return (isNPC && doesNotHavePhalanxImmunity);
  });

  if (npcTokensOnCanvas.length === 0) return;

  npcTokensOnCanvas.forEach(async token => {
    if (!token.actor) return;
    let hasAdjacentAlly = false;
    npcTokensOnCanvas.forEach(token2 => {
      // Note for the future. In foundry v11, it was sufficient to use token.distanctT(token2) to calculate the distance.
      // v12 broke this functionality, so I have copy pasted the distanceTo code below and am using it with tokenDocument since it doesn't
      // work for tokens. Perhaps in v13, this functionality will be restored?
      const distanceBetweenTokens = distanceTo({ 
        "x": token.document.x,
        "y": token.document.y,
        "bounds": token.document.bounds,
        "document": {
          "elevation": token.document.elevation
        },
        "actor":{
          "dimensions": token.document.actor.dimensions
        }
      }, { 
        "x": token2.document.x,
        "y": token2.document.y,
        "bounds": token2.document.bounds,
        "document": {
          "elevation": token2.document.elevation
        },
        "actor":{
          "dimensions": token2.document.actor.dimensions
        }
      })

      if (distanceBetweenTokens === 5) hasAdjacentAlly = true;
      
    });

    const phalanxEffect = await fromUuid("Compendium.pf2e-heroic-variant.hv-effects-and-abilities.Item.Epii4QJxe6cFImI1");
    if (hasAdjacentAlly){
      const preExistingEffect = token.actor.itemTypes.effect.find((e) => e.slug === "hv-phalanx-bonus");
      if (!preExistingEffect){await token.actor.createEmbeddedDocuments("Item", [phalanxEffect.toObject()]);}
    } else {
      const preExistingEffect = token.actor.itemTypes.effect.find((e) => e.slug === "hv-phalanx-bonus");
      if (preExistingEffect) {await token.actor.deleteEmbeddedDocuments("Item", [preExistingEffect.id]);}
    }

  });
}


/// helpers for distance calculations

function distanceTo(token, target, { reach = null } = {}) {
  if (!canvas.ready) return NaN;

  if (token === target) return 0;

  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) {
      const waypoints= [
          { x: token.x, y: token.y },
          { x: target.x, y: target.y },
      ];
      return canvas.grid.measurePath(waypoints).distance;
  }

  const selfElevation = token.document.elevation;
  const targetElevation = target.document?.elevation ?? selfElevation;
  const targetBounds = target.bounds ?? squareAtPoint(target);
  if (selfElevation === targetElevation || !token.actor || !target.bounds || !target.actor) {
      return measureDistanceCuboid(token.bounds, targetBounds, { reach });
  }

  return measureDistanceCuboid(token.bounds, targetBounds, { reach, token: token, target });
}


function measureDistanceCuboid(
  r0,
  r1,
  {
      reach = null,
      token = null,
      target = null,
  } = {},
){
  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) {
      return canvas.grid.measurePath([r0, r1]).distance;
  }

  const gridWidth = canvas.grid.sizeX;

  const distance = {
      dx: 0,
      dy: 0,
      dz: 0,
  };
  // Return early if the rectangles overlap
  const rectanglesOverlap = [
      [r0, r1],
      [r1, r0],
  ].some(([rA, rB]) => rB.right > rA.left && rB.left < rA.right && rB.bottom > rA.top && rB.top < rA.bottom);
  if (rectanglesOverlap) {
      distance.dx = 0;
      distance.dy = 0;
  } else {
      // Snap the dimensions and position of the rectangle to grid square units
      const snapBounds = (rectangle, { toward }) => {
          const roundLeft = rectangle.left < toward.left ? Math.ceil : Math.floor;
          const roundTop = rectangle.top < toward.top ? Math.ceil : Math.floor;

          const left = roundLeft(rectangle.left / gridWidth) * gridWidth;
          const top = roundTop(rectangle.top / gridWidth) * gridWidth;
          const width = Math.ceil(rectangle.width / gridWidth) * gridWidth;
          const height = Math.ceil(rectangle.height / gridWidth) * gridWidth;

          return new PIXI.Rectangle(left, top, width, height);
      };

      // Find the minimum distance between the rectangles for each dimension
      const r0Snapped = snapBounds(r0, { toward: r1 });
      const r1Snapped = snapBounds(r1, { toward: r0 });
      distance.dx = Math.max(r0Snapped.left - r1Snapped.right, r1Snapped.left - r0Snapped.right, 0) + gridWidth;
      distance.dy = Math.max(r0Snapped.top - r1Snapped.bottom, r1Snapped.top - r0Snapped.bottom, 0) + gridWidth;
  }

  if (token && target && token.document.elevation !== target.document.elevation && token.actor && target.actor) {
      const selfElevation = token.document.elevation;
      const targetElevation = target.document.elevation;

      const [selfDimensions, targetDimensions] = [token.actor.dimensions, target.actor.dimensions];

      const gridSize = canvas.dimensions.size;
      const gridDistance = canvas.dimensions.distance;

      const elevation0 = Math.floor((selfElevation / gridDistance) * gridSize);
      const height0 = Math.floor((selfDimensions.height / gridDistance) * gridSize);
      const elevation1 = Math.floor((targetElevation / gridDistance) * gridSize);
      const height1 = Math.floor((targetDimensions.height / gridDistance) * gridSize);

      // simulate xz plane
      const xzPlane = {
          self: new PIXI.Rectangle(r0.x, elevation0, r0.width, height0),
          target: new PIXI.Rectangle(r1.x, elevation1, r1.width, height1),
      };

      // check for overlappig
      const elevationOverlap = [
          [xzPlane.self, xzPlane.target],
          [xzPlane.target, xzPlane.self],
      ].some(([rA, rB]) => rB.bottom > rA.top && rB.top < rA.bottom);
      if (elevationOverlap) {
          distance.dz = 0;
      } else {
          // Snap the dimensions and position of the rectangle to grid square units
          const snapBounds = (rectangle, { toward }) => {
              const roundLeft = rectangle.left < toward.left ? Math.ceil : Math.floor;
              const roundTop = rectangle.top < toward.top ? Math.ceil : Math.floor;

              const left = roundLeft(rectangle.left / gridWidth) * gridWidth;
              const top = roundTop(rectangle.top / gridWidth) * gridWidth;
              const width = Math.ceil(rectangle.width / gridWidth) * gridWidth;
              const height = Math.ceil(rectangle.height / gridWidth) * gridWidth;

              return new PIXI.Rectangle(left, top, width, height);
          };

          // Find the minimum distance between the rectangles for each dimension
          const r0Snapped = snapBounds(xzPlane.self, { toward: xzPlane.target });
          const r1Snapped = snapBounds(xzPlane.target, { toward: xzPlane.self });
          distance.dz = Math.max(r0Snapped.top - r1Snapped.bottom, r1Snapped.top - r0Snapped.bottom, 0) + gridWidth;
      }
  } else {
      distance.dz = 0;
  }

  return measureDistanceOnGrid(distance, { reach });
}

/**
* Measure distance using Pathfinder 2e grid-counting rules
* @param p0 The origin point
* @param p1 The destination point
*/
// function measureDistance(p0, p1) {
//   if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) {
//       return canvas.grid.measurePath([p0, p1]).distance;
//   }

//   return measureDistanceOnGrid(new Ray(p0, p1));
// }

/**
* Given the distance in each dimension, measure the distance in grid units
* @param segment A pair of x/y distances constituting the line segment between two points
* @param [reach] If this is a reach measurement, the origin actor's reach
*/
function measureDistanceOnGrid(
  segment,
  { reach = null } = {},
) {
  if (!canvas.dimensions) return NaN;

  const gridSize = canvas.dimensions.size;
  const gridDistance = canvas.dimensions.distance;

  const nx = Math.ceil(Math.abs(segment.dx / gridSize));
  const ny = Math.ceil(Math.abs(segment.dy / gridSize));
  const nz = Math.ceil(Math.abs((segment.dz || 0) / gridSize));

  // ingore the lowest difference
  const sortedDistance = [nx, ny, nz].sort((a, b) => a - b);
  // Get the number of straight and diagonal moves
  const squares = {
      doubleDiagonal: sortedDistance[0],
      diagonal: sortedDistance[1] - sortedDistance[0],
      straight: sortedDistance[2] - sortedDistance[1],
  };

  // "Unlike with measuring most distances, 10-foot reach can reach 2 squares diagonally." (CRB pg 455)
  const reduction = squares.diagonal + squares.doubleDiagonal > 1 && reach === 10 ? 1 : 0;

  // Diagonals in PF pretty much count as 1.5 times a straight
  // for diagonals across the x, y, and z axis count it as 1.75 as a best guess
  const distance = Math.floor(squares.doubleDiagonal * 1.75 + squares.diagonal * 1.5 + squares.straight) - reduction;

  return distance * gridDistance;
}

/** Get a grid square at an arbitrary point. */
function squareAtPoint(point) {
  const snapped =
      canvas.grid.type === CONST.GRID_TYPES.SQUARE
          ? canvas.grid.getTopLeftPoint(point)
          : canvas.grid.getSnappedPoint(point, { mode: CONST.GRID_SNAPPING_MODES.CENTER });

  return new PIXI.Rectangle(snapped.x, snapped.y, canvas.grid.sizeX, canvas.grid.sizeY);
}