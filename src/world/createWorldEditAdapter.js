import { getNpcModelById } from '../npc/npcCatalog.js';

function errorResult(error) {
  return { ok: false, error };
}

function successResult(placementId = null) {
  return {
    ok: true,
    placementId,
    appliedImmediately: true
  };
}

function toTransportPayload(edit) {
  switch (edit.op) {
    case 'placeTile':
        return {
          itemId: edit.item.id,
          cellX: edit.cellX,
          cellZ: edit.cellZ,
          rotationQuarterTurns: edit.rotationQuarterTurns,
          interactable: edit.item.interactable ?? null
        };
    case 'placeProp':
        return {
          itemId: edit.item.id,
          x: edit.x,
          z: edit.z,
          rotationQuarterTurns: edit.rotationQuarterTurns,
          interactable: edit.item.interactable ?? null
        };
    case 'placeNpc':
      return {
        modelId: edit.item.modelId,
        x: edit.x,
        z: edit.z,
        rotationQuarterTurns: edit.rotationQuarterTurns,
        name: edit.npc.name,
        prompt: edit.npc.prompt,
        interactRadius: edit.npc.interactRadius,
        speed: edit.npc.speed,
        respawnDelayMs: edit.npc.respawnDelayMs,
        deliveryQuestEnabled: edit.npc.deliveryQuestEnabled === true,
        gymCheckInEnabled: edit.npc.gymCheckInEnabled === true,
        rentCollectorEnabled: edit.npc.rentCollectorEnabled === true,
        stockMarketEnabled: edit.npc.stockMarketEnabled === true,
        bartenderEnabled: edit.npc.bartenderEnabled === true,
        pawnShopOwnerEnabled: edit.npc.pawnShopOwnerEnabled === true,
        marthaEnabled: edit.npc.marthaEnabled === true,
        blackjackDealerEnabled: edit.npc.blackjackDealerEnabled === true,
        schoolMicrogameEnabled: edit.npc.schoolMicrogameEnabled === true,
        schoolMicrogameId: edit.npc.schoolMicrogameId
      };
    case 'rotatePlacement':
      return {
        placementId: edit.placementId
      };
    case 'movePlacement':
      return {
        placementId: edit.placementId,
        ...(Object.hasOwn(edit, 'cellX') ? { cellX: edit.cellX, cellZ: edit.cellZ } : {}),
        ...(Object.hasOwn(edit, 'x') ? { x: edit.x, z: edit.z } : {})
      };
    case 'deletePlacement':
      return {
        placementId: edit.placementId
      };
    case 'updateNpc':
      return {
        placementId: edit.placementId,
        ...edit.changes
      };
    case 'updatePlacementInteractable':
      return {
        placementId: edit.placementId,
        interactable: edit.interactable
      };
    case 'updateMissionSequence':
      return {
        missionSequence: edit.missionSequence
      };
    default:
      return {};
  }
}

async function applyLocalNpcUpdate(edit, worldState, worldRenderer) {
  const existingPlacement = worldState.getPlacement(edit.placementId);
  if (!existingPlacement || existingPlacement.layer !== 'npc') {
    return errorResult('That NPC is not available.');
  }

  const nextChanges = { ...edit.changes };
  if (nextChanges.modelId) {
    const model = getNpcModelById(nextChanges.modelId);
    if (!model) {
      return errorResult('That NPC model is not available.');
    }
    nextChanges.itemId = model.itemId;
  }

  const updatedPlacement = worldState.updateNpc(edit.placementId, nextChanges);
  if (!updatedPlacement) {
    return errorResult('That NPC is not available.');
  }

  if (existingPlacement.itemId !== updatedPlacement.itemId) {
    worldRenderer.removePlacement(updatedPlacement.id);
    await worldRenderer.addPlacement(updatedPlacement);
  } else {
    worldRenderer.updatePlacement(updatedPlacement);
  }

  return successResult(updatedPlacement.id);
}

async function applyLocalEdit(edit, worldState, worldRenderer) {
  switch (edit.op) {
    case 'placeTile': {
      const result = worldState.placeTile(
        edit.item,
        edit.cellX,
        edit.cellZ,
        edit.rotationQuarterTurns,
        edit.item.interactable ?? null
      );
      for (const replacedPlacementId of result.replacedPlacementIds ?? []) {
        worldRenderer.removePlacement(replacedPlacementId);
      }
      await worldRenderer.addPlacement(result.placement);
      return successResult(result.placement.id);
    }
    case 'placeProp': {
      const placement = worldState.placeProp(
        edit.item,
        edit.x,
        edit.z,
        edit.rotationQuarterTurns,
        edit.item.interactable ?? null
      );
      await worldRenderer.addPlacement(placement);
      return successResult(placement.id);
    }
    case 'placeNpc': {
      const placement = worldState.placeNpc(
        edit.item,
        edit.x,
        edit.z,
        edit.rotationQuarterTurns,
        edit.npc
      );
      await worldRenderer.addPlacement(placement);
      return successResult(placement.id);
    }
    case 'rotatePlacement': {
      const result = worldState.rotatePlacement(edit.placementId);
      if (!result?.placement) {
        return errorResult(result?.error ?? 'That placement is not available.');
      }
      worldRenderer.updatePlacement(result.placement);
      return successResult(result.placement.id);
    }
    case 'movePlacement': {
      const result = worldState.movePlacement(edit.placementId, edit);
      if (!result?.placement) {
        return errorResult(result?.error ?? 'That placement is not available.');
      }
      for (const replacedPlacementId of result.replacedPlacementIds ?? []) {
        worldRenderer.removePlacement(replacedPlacementId);
      }
      worldRenderer.updatePlacement(result.placement);
      return successResult(result.placement.id);
    }
    case 'deletePlacement': {
      const placement = worldState.deletePlacement(edit.placementId);
      if (!placement) {
        return errorResult('That placement is not available.');
      }
      worldRenderer.removePlacement(placement.id);
      return successResult(placement.id);
    }
    case 'updateNpc':
      return applyLocalNpcUpdate(edit, worldState, worldRenderer);
    case 'updatePlacementInteractable': {
      const updatedPlacement = worldState.updatePlacementInteractable(edit.placementId, edit.interactable);
      if (!updatedPlacement) {
        return errorResult('That placement is not available.');
      }
      worldRenderer.updatePlacement(updatedPlacement);
      return successResult(updatedPlacement.id);
    }
    case 'updateMissionSequence':
      worldState.updateMissionSequence(edit.missionSequence);
      return successResult(null);
    default:
      return errorResult('That world edit is not supported.');
  }
}

export function createWorldEditAdapter({ transport = null, worldState, worldRenderer }) {
  if (transport?.editWorld) {
    return {
      edit(edit) {
        return transport.editWorld(edit.op, toTransportPayload(edit));
      }
    };
  }

  return {
    edit(edit) {
      return applyLocalEdit(edit, worldState, worldRenderer);
    }
  };
}
